import test from 'node:test';
import assert from 'node:assert/strict';
import { exifJpegFixture } from '../fixtures/exif-jpeg.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const businessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repositoryRoot = path.resolve(businessRoot, '..');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitFor(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The child service may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function jsonRequest(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body && !(options.body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: options.body instanceof Uint8Array ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = payload?.error?.code || payload?.code;
    throw error;
  }
  return payload?.ok === true ? payload.data : payload;
}

test('isolated local BFF completes the real manual workflow across both services', { timeout: 30000 }, async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'urban-health-business-integration-'));
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  assert.ok(resolvedTemporaryRoot.startsWith(path.resolve(os.tmpdir())));
  const legacyPort = await freePort();
  const businessPort = await freePort();
  const legacyBase = `http://127.0.0.1:${legacyPort}`;
  const businessBase = `http://127.0.0.1:${businessPort}`;
  const children = [];

  try {
    children.push(spawn(process.execPath, ['server.mjs'], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(legacyPort),
        SMART_RENEW_DATA_DIR: path.join(temporaryRoot, 'legacy'),
        DASHSCOPE_API_KEY: ''
      },
      stdio: 'ignore'
    }));
    await waitFor(`${legacyBase}/api/health`);

    children.push(spawn(process.execPath, ['server/index.mjs'], {
      cwd: businessRoot,
      env: {
        ...process.env,
        URBAN_HEALTH_HOST: '127.0.0.1',
        URBAN_HEALTH_PORT: String(businessPort),
        URBAN_HEALTH_DATA_DIR: path.join(temporaryRoot, 'business'),
        SMART_RENEW_API_BASE: legacyBase
      },
      stdio: 'ignore'
    }));
    await waitFor(`${businessBase}/api/ready`);
    const readiness = await jsonRequest(businessBase, '/api/ready');
    assert.equal(readiness.status, 'ready');
    assert.equal(readiness.optional.ai.ready, false);
    assert.equal(readiness.optional.legacy.projectData.status, 'available');
    assert.equal(readiness.optional.legacy.reportSnapshots.mode, 'read-only');
    const meta = await jsonRequest(businessBase, '/api/meta');
    assert.equal(meta.features.legacyCapabilityRegistry, true);
    assert.equal(meta.features.sourceOfTruthRegistry, true);
    assert.equal(meta.dataSources.officialIssue.primary, 'business');
    assert.equal(meta.dataSources.report.legacyRole, 'read-only-and-explicit-migration');

    const created = await jsonRequest(businessBase, '/api/projects', {
      method: 'POST',
      body: { name: '集成测试真实项目', area: '测试区', description: '自动化隔离数据' }
    });
    const project = created.item || created;
    const projectId = String(project.id);
    const revisedProjectResult = await jsonRequest(businessBase, `/api/projects/${projectId}`, {
      method: 'PATCH',
      body: {
        name: '集成测试真实项目（修订）',
        area: '测试区',
        description: '自动化隔离数据',
        expectedRevision: 1
      }
    });
    assert.equal((revisedProjectResult.item || revisedProjectResult).revision, 2);

    const communityResult = await jsonRequest(businessBase, `/api/projects/${projectId}/communities`, {
      method: 'POST',
      body: { name: '测试小区', address: '测试路1号' }
    });
    const community = communityResult.item || communityResult;
    const renamedCommunityResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/communities/${community.id}`,
      {
        method: 'PATCH',
        body: {
          name: '测试小区（修订）',
          address: '测试路1号',
          expectedRevision: 1
        }
      }
    );
    const renamedCommunity = renamedCommunityResult.item || renamedCommunityResult;
    assert.equal(renamedCommunity.name, '测试小区（修订）');
    const incompleteValidation = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/collection/validation`
    );
    assert.equal(incompleteValidation.status, 'incomplete');
    assert.equal(
      incompleteValidation.checks.find((item) => item.code === 'PROJECT_BOUNDARY_REQUIRED').status,
      'failed'
    );

    const boundaryResult = await jsonRequest(businessBase, `/api/projects/${projectId}/boundary`, {
      method: 'PATCH',
      body: {
        coordinates: [[108.94, 34.26], [108.96, 34.26], [108.96, 34.28], [108.94, 34.28]],
        crs: 'WGS84',
        updatedBy: '集成测试',
        expectedRevision: 4
      }
    });
    assert.equal((boundaryResult.item || boundaryResult).scopeBoundary.length, 4);

    const buildingResult = await jsonRequest(businessBase, `/api/projects/${projectId}/communities/${community.id}/buildings`, {
      method: 'POST',
      body: { name: '1号楼', householdCount: 36, unitCount: 2, floorCount: 6 }
    });
    const building = buildingResult.item || buildingResult;
    const inactiveBuildingResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/communities/${community.id}/buildings/${building.id}`,
      {
        method: 'PATCH',
        body: { status: 'inactive', expectedRevision: 1 }
      }
    );
    const inactiveBuilding = inactiveBuildingResult.item || inactiveBuildingResult;
    assert.equal(inactiveBuilding.status, 'inactive');
    const recoveredBuildingResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/communities/${community.id}/buildings/${building.id}`,
      {
        method: 'PATCH',
        body: { status: 'active', expectedRevision: 2 }
      }
    );
    assert.equal((recoveredBuildingResult.item || recoveredBuildingResult).status, 'active');

    const photoBytes = exifJpegFixture();
    const uploadResult = await jsonRequest(businessBase, '/api/uploads', {
      method: 'POST',
      body: {
        projectId,
        communityId: community.id,
        buildingId: building.id,
        name: 'evidence-with-exif.jpg',
        mimeType: 'image/jpeg',
        size: photoBytes.length,
        clientRequestId: 'integration-upload-001'
      }
    });
    const uploadSession = uploadResult.session;
    const uploaded = await jsonRequest(businessBase, `/api/uploads/${uploadSession.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: photoBytes
    });
    assert.equal(uploaded.session.status, 'completed');
    assert.equal(uploaded.session.exifApplyStatus, 'applied');

    const photoId = uploaded.session.photoId;
    const exifGovernedPhotos = await jsonRequest(
      businessBase,
      `/api/photos?projectId=${projectId}&includeInactive=true`
    );
    assert.equal(exifGovernedPhotos.items[0].metadataRevision, 1);
    assert.equal(exifGovernedPhotos.items[0].capturedAt, '2026-07-26T12:34:56');
    assert.equal(exifGovernedPhotos.items[0].capturedAtSource, 'exif');
    assert.equal(exifGovernedPhotos.items[0].coordinateSource, 'exif');
    assert.ok(Math.abs(exifGovernedPhotos.items[0].coordinates[0] - 108.95) < 1e-10);
    assert.ok(Math.abs(exifGovernedPhotos.items[0].coordinates[1] - 34.27) < 1e-10);
    await jsonRequest(businessBase, `/api/projects/${projectId}/photos/${photoId}`, {
      method: 'PATCH',
      body: {
        displayName: '现场证据照片（治理）',
        communityId: community.id,
        buildingId: building.id,
        longitude: 108.951,
        latitude: 34.271,
        updatedBy: '集成测试资料员',
        expectedRevision: 1
      }
    });
    const governedPhotos = await jsonRequest(
      businessBase,
      `/api/photos?projectId=${projectId}&includeInactive=true`
    );
    assert.equal(governedPhotos.items[0].name, '现场证据照片（治理）');
    assert.deepEqual(governedPhotos.items[0].coordinates, [108.951, 34.271]);
    assert.equal(governedPhotos.items[0].coordinateSource, 'manual');
    const batchFailure = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/photos/batch-metadata`,
      {
        method: 'POST',
        body: {
          updatedBy: '集成测试批量治理员',
          items: [{
            photoId: 'PHOTO-NOT-FOUND',
            longitude: 108.952,
            latitude: 34.272,
            expectedRevision: 0
          }]
        }
      }
    );
    assert.equal(batchFailure.failed, 1);
    assert.equal(batchFailure.results[0].error.code, 'PHOTO_NOT_FOUND');

    const sourceAssetContent = new TextEncoder().encode(JSON.stringify({
      type: 'Feature',
      properties: { name: '导入项目范围' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [108.941, 34.261],
          [108.959, 34.261],
          [108.959, 34.279],
          [108.941, 34.279],
          [108.941, 34.261]
        ]]
      }
    }));
    const sourceAssetResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/assets`,
      {
        method: 'POST',
        body: {
          name: '项目范围.geojson',
          mimeType: 'application/geo+json',
          size: sourceAssetContent.length,
          category: 'gis',
          communityId: community.id,
          createdBy: '集成测试资料员',
          clientRequestId: 'integration-source-asset-001'
        }
      }
    );
    const sourceAsset = sourceAssetResult.asset;
    const completedAssetResult = await jsonRequest(
      businessBase,
      `/api/assets/${sourceAsset.id}/content`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/geo+json' },
        body: sourceAssetContent
      }
    );
    assert.equal((completedAssetResult.item || completedAssetResult).uploadStatus, 'completed');
    const sourceAssetPreview = await jsonRequest(
      businessBase,
      `/api/assets/${sourceAsset.id}/preview`
    );
    assert.equal(sourceAssetPreview.preview.kind, 'geojson-feature');
    assert.equal(sourceAssetPreview.preview.featureCount, 1);
    const downloadedAsset = await fetch(`${businessBase}/api/assets/${sourceAsset.id}/content`);
    assert.equal(downloadedAsset.status, 200);
    assert.deepEqual(new Uint8Array(await downloadedAsset.arrayBuffer()), sourceAssetContent);
    const duplicateSourceAssetResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/assets`,
      {
        method: 'POST',
        body: {
          name: '项目范围-重复.geojson',
          mimeType: 'application/geo+json',
          size: sourceAssetContent.length,
          category: 'gis',
          communityId: community.id,
          createdBy: '集成测试资料员',
          clientRequestId: 'integration-source-asset-duplicate'
        }
      }
    );
    const duplicateSourceAsset = duplicateSourceAssetResult.asset;
    const duplicateContentResult = await jsonRequest(
      businessBase,
      `/api/assets/${duplicateSourceAsset.id}/content`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/geo+json' },
        body: sourceAssetContent
      }
    );
    assert.equal((duplicateContentResult.item || duplicateContentResult).uploadStatus, 'duplicate');
    assert.equal((duplicateContentResult.item || duplicateContentResult).duplicateOf, sourceAsset.id);
    const inactiveAssetResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/assets/${sourceAsset.id}`,
      {
        method: 'PATCH',
        body: {
          status: 'inactive',
          updatedBy: '集成测试资料员',
          expectedRevision: 1
        }
      }
    );
    assert.equal((inactiveAssetResult.item || inactiveAssetResult).status, 'inactive');
    const recoveredAssetResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/assets/${sourceAsset.id}`,
      {
        method: 'PATCH',
        body: {
          status: 'active',
          updatedBy: '集成测试资料员',
          expectedRevision: 2
        }
      }
    );
    assert.equal((recoveredAssetResult.item || recoveredAssetResult).assetRevision, 3);
    const importedBoundaryResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/boundary/import`,
      {
        method: 'POST',
        body: {
          sourceAssetId: sourceAsset.id,
          updatedBy: '集成测试GIS资料员',
          expectedRevision: 8
        }
      }
    );
    const importedBoundary = importedBoundaryResult.item || importedBoundaryResult;
    assert.equal(importedBoundary.scopeBoundarySource, 'source-asset-geojson');
    assert.equal(importedBoundary.scopeBoundarySourceAssetId, sourceAsset.id);
    assert.equal(importedBoundary.scopeBoundary.length, 4);
    const boundaryRevisionsAfterImport = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/boundary`
    );
    assert.equal(boundaryRevisionsAfterImport.items[0].sourceAssetId, sourceAsset.id);

    const completeValidation = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/collection/validation`
    );
    assert.equal(completeValidation.status, 'complete');
    assert.equal(
      completeValidation.checks.find((item) => item.code === 'SUPPORTING_RECORDS_RECOMMENDED').status,
      'passed'
    );
    const validationRunResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/collection/validate`,
      {
        method: 'POST',
        body: { validatedBy: '集成测试资料员' }
      }
    );
    assert.equal((validationRunResult.item || validationRunResult).status, 'complete');
    const validationRuns = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/collection/validation-runs`
    );
    assert.equal(validationRuns.items.length, 1);

    await assert.rejects(
      () => jsonRequest(businessBase, `/api/projects/${projectId}/analysis-jobs`, {
        method: 'POST',
        body: {
          photoIds: [photoId],
          analysisType: '综合巡检分析',
          clientRequestId: 'integration-ai-001'
        }
      }),
      (error) => error.status === 503 && error.code === 'AI_NOT_CONFIGURED'
    );

    await jsonRequest(businessBase, `/api/projects/${projectId}/photos/${photoId}`, {
      method: 'PATCH',
      body: {
        status: 'inactive',
        updatedBy: '集成测试资料员',
        expectedRevision: 2
      }
    });
    const summaryWithInactivePhoto = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/summary`
    );
    assert.equal(summaryWithInactivePhoto.counts.photos, 0);
    await assert.rejects(
      () => jsonRequest(businessBase, `/api/projects/${projectId}/analysis-jobs`, {
        method: 'POST',
        body: {
          photoIds: [photoId],
          analysisType: '综合巡检分析',
          clientRequestId: 'integration-ai-inactive'
        }
      }),
      (error) => error.status === 409 && error.code === 'PHOTO_INACTIVE'
    );
    await jsonRequest(businessBase, `/api/projects/${projectId}/photos/${photoId}`, {
      method: 'PATCH',
      body: {
        status: 'active',
        updatedBy: '集成测试资料员',
        expectedRevision: 3
      }
    });
    const summaryWithRecoveredPhoto = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/summary`
    );
    assert.equal(summaryWithRecoveredPhoto.counts.photos, 1);

    const reviewAnalysisId = '777000099';
    const reviewCandidateId = 'CAND-INTEGRATION-001';
    await jsonRequest(legacyBase, `/api/analysis-records/${reviewAnalysisId}`, {
      method: 'PUT',
      body: {
        id: reviewAnalysisId,
        projectId,
        analysisType: '集成人工复核测试',
        status: 'reviewing',
        result: {
          issues: [{
            id: reviewCandidateId,
            photoId,
            title: '待复核候选',
            desc: '模型候选描述',
            evidence: '模型候选证据',
            severity: 'medium',
            reviewStatus: 'pending'
          }]
        }
      }
    });
    const savedCandidateResult = await jsonRequest(
      businessBase,
      `/api/analysis-candidates/${reviewCandidateId}`,
      {
        method: 'PATCH',
        body: {
          analysisId: reviewAnalysisId,
          reviewStatus: 'excluded',
          changes: { title: '人工核对后排除' },
          updatedBy: '集成测试复核员',
          expectedRevision: 1
        }
      }
    );
    const savedCandidate = savedCandidateResult.item || savedCandidateResult;
    assert.equal(savedCandidate.candidateRevision, 2);
    assert.equal(savedCandidate.reviewStatus, 'excluded');
    await jsonRequest(
      businessBase,
      `/api/analyses/${reviewAnalysisId}/review/finalize`,
      {
        method: 'POST',
        body: {
          reviewerName: '集成测试复核员',
          decisions: [{ candidateId: reviewCandidateId, status: 'excluded' }]
        }
      }
    );
    const archivedCandidateResult = await jsonRequest(
      businessBase,
      `/api/analysis-candidates/${reviewCandidateId}`
    );
    const archivedCandidate = archivedCandidateResult.item || archivedCandidateResult;
    assert.equal(archivedCandidate.candidateRevision, 3);
    assert.deepEqual(
      archivedCandidate.auditTrail.map((item) => item.action),
      ['candidate_review_saved', 'candidate_archived']
    );

    const issueResult = await jsonRequest(businessBase, `/api/projects/${projectId}/issues`, {
      method: 'POST',
      body: {
        title: '现场人工发现的问题',
        description: '测试设施存在可见损坏',
        evidence: '现场照片可见',
        severity: 'medium',
        originalPhotoId: photoId,
        recordedBy: '集成测试巡检员'
      }
    });
    const issue = issueResult.item || issueResult;

    await jsonRequest(businessBase, `/api/projects/${projectId}/manual-reviews`, {
      method: 'POST',
      body: {
        reviewerName: '集成测试复核员',
        notes: '已完成人工复核',
        clientRequestId: 'integration-review-001'
      }
    });
    const geometryResult = await jsonRequest(businessBase, `/api/issues/${issue.id}/geometry`, {
      method: 'PATCH',
      body: {
        longitude: 108.951,
        latitude: 34.271,
        crs: 'WGS84',
        confirmedBy: '集成测试GIS',
        expectedGeometryRevision: 0
      }
    });
    const locatedIssue = geometryResult.item || geometryResult;
    assert.equal(locatedIssue.geometryRevision, 1);
    assert.equal(locatedIssue.geometryAudit.length, 1);
    const spatialResult = await jsonRequest(businessBase, `/api/projects/${projectId}/spatial-analyses`, {
      method: 'POST',
      body: { radiusMeters: 500, createdBy: '集成测试GIS' }
    });
    assert.equal((spatialResult.item || spatialResult).result.matchedIssueCount, 1);

    const reportResult = await jsonRequest(businessBase, `/api/projects/${projectId}/reports`, {
      method: 'POST',
      body: {
        title: '集成测试体检报告',
        executiveSummary: '仅使用隔离测试中的真实输入。',
        generatedBy: '集成测试报告员'
      }
    });
    const report = reportResult.item || reportResult;
    const updatedReportResult = await jsonRequest(businessBase, `/api/reports/${report.id}`, {
      method: 'PATCH',
      body: {
        title: '集成测试体检报告（修订）',
        recommendations: '按现场情况安排修复。',
        updatedBy: '集成测试编辑',
        expectedRevision: 1
      }
    });
    assert.equal((updatedReportResult.item || updatedReportResult).reportRevision, 2);

    const printResponse = await fetch(`${businessBase}/api/reports/${report.id}/print`);
    assert.equal(printResponse.status, 200);
    assert.match(await printResponse.text(), /集成测试体检报告（修订）/);

    await jsonRequest(businessBase, `/api/projects/${projectId}/photos/${photoId}`, {
      method: 'PATCH',
      body: {
        notes: '报告生成后修订照片治理证据',
        updatedBy: '集成测试资料员',
        expectedRevision: 4
      }
    });
    const staleReportList = await jsonRequest(
      businessBase,
      `/api/reports?projectId=${projectId}`
    );
    const staleReport = staleReportList.items.find((item) => item.id === report.id);
    assert.equal(staleReport.status, 'stale');
    assert.ok(staleReport.staleReasons.includes('PHOTO_METADATA_CHANGED'));
    const staleWorkflow = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/workflow`
    );
    assert.equal(
      staleWorkflow.stages.find((stage) => stage.id === 'reports').status,
      'stale'
    );

    const refreshedReportResult = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/reports`,
      {
        method: 'POST',
        body: {
          title: '集成测试体检报告（证据刷新）',
          generatedBy: '集成测试报告员'
        }
      }
    );
    const refreshedReport = refreshedReportResult.item || refreshedReportResult;
    assert.equal(refreshedReport.version, 2);
    const reportComparison = await jsonRequest(
      businessBase,
      `/api/projects/${projectId}/reports/compare?baseReportId=${encodeURIComponent(report.id)}&targetReportId=${encodeURIComponent(refreshedReport.id)}`
    );
    assert.equal(reportComparison.summary.changed, true);
    assert.ok(reportComparison.contentChanges.some((item) => item.field === 'title'));
    assert.equal(reportComparison.photoChanges.changed[0].id, photoId);

    const workflow = await jsonRequest(businessBase, `/api/projects/${projectId}/workflow`);
    const stages = Object.fromEntries(workflow.stages.map((stage) => [stage.id, stage.status]));
    assert.deepEqual(stages, {
      collection: 'completed',
      'ai-analysis': 'completed',
      'human-review': 'completed',
      'gis-and-issues': 'completed',
      indicators: 'unavailable',
      reports: 'completed'
    });
    assert.equal(JSON.stringify(workflow).includes('92.6'), false);
    assert.equal(JSON.stringify(workflow).includes('500/800/1000'), false);

    const exportResponse = await fetch(`${businessBase}/api/projects/${projectId}/export`);
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get('content-disposition'), /attachment/);
    const projectExport = await exportResponse.json();
    assert.equal(projectExport.manifest.includesPhotoBinaries, false);
    assert.equal(projectExport.project.id, projectId);
    assert.equal(projectExport.business.boundaryRevisions.length, 2);
    assert.equal(projectExport.business.boundaryRevisions[0].sourceAssetId, sourceAsset.id);
    assert.equal(projectExport.business.collectionValidations.length, 1);
    assert.equal(projectExport.business.sourceAssets.length, 2);
    assert.equal(projectExport.manifest.includesSourceAssetBinaries, false);
    assert.equal(projectExport.business.photoMetadata.length, 1);
    assert.equal(projectExport.business.reviewSessions.length, 1);
    assert.equal(projectExport.business.spatialAnalyses.length, 1);
    assert.equal(projectExport.business.reports.length, 2);
    const metrics = await jsonRequest(businessBase, '/api/metrics');
    assert.ok(metrics.requests > 10);
    assert.ok(Number(metrics.byStatus['200']) > 0);
  } finally {
    for (const child of children.reverse()) {
      if (!child.killed) child.kill();
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(resolvedTemporaryRoot, { recursive: true, force: true });
  }
});
