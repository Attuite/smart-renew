import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { API_VERSION, SCHEMA_VERSION } from '../packages/api-contracts/constants.mjs';
import { SmartRenewClient } from './adapters/smart-renew/client.mjs';
import { createSmartRenewAdapters } from './adapters/smart-renew/index.mjs';
import { mergePrimaryReadModel } from './adapters/smart-renew/read-model-policy.mjs';
import { sourceOfTruthSnapshot } from './adapters/smart-renew/source-of-truth.mjs';
import { OfficialIssueRepository } from './repositories/official-issue-repository.mjs';
import { PhotoMetadataRepository } from './repositories/photo-metadata-repository.mjs';
import { AnalysisCandidateRepository } from './repositories/analysis-candidate-repository.mjs';
import { AnalysisJobRepository } from './repositories/analysis-job-repository.mjs';
import { BoundaryRevisionRepository } from './repositories/boundary-revision-repository.mjs';
import { CollectionValidationRepository } from './repositories/collection-validation-repository.mjs';
import { ReportRepository } from './repositories/report-repository.mjs';
import { ReviewSessionRepository } from './repositories/review-session-repository.mjs';
import { SpatialAnalysisRepository } from './repositories/spatial-analysis-repository.mjs';
import { SourceAssetRepository } from './repositories/source-asset-repository.mjs';
import { UploadSessionRepository } from './repositories/upload-session-repository.mjs';
import { FieldTaskReferenceRepository } from './repositories/field-task-reference-repository.mjs';
import { LegacyMigrationRunRepository } from './repositories/legacy-migration-run-repository.mjs';
import { runAnalysis } from './services/analysis-service.mjs';
import {
  AnalysisJobRunner,
  cancelAnalysisJob,
  createAnalysisJob,
  retryAnalysisJob
} from './services/analysis-job-service.mjs';
import { updateAnalysisCandidate } from './services/analysis-candidate-service.mjs';
import {
  addBuilding,
  addCommunity,
  createProject,
  listBuildingInventory,
  listCommunityInventory,
  updateBuilding,
  updateCommunity,
  updateProjectMetadata,
  updateProjectBoundary
} from './services/project-service.mjs';
import { ProjectWriteCoordinator } from './services/project-write-coordinator.mjs';
import { finalizeReview } from './services/review-service.mjs';
import { createManualIssue, finalizeManualReview } from './services/manual-review-service.mjs';
import { mergePhotoMetadata, updatePhotoMetadata } from './services/photo-metadata-service.mjs';
import { batchUpdatePhotoMetadata } from './services/photo-metadata-batch-service.mjs';
import { getCollectionValidation } from './services/collection-validation-service.mjs';
import { compareReports } from './services/report-comparison-service.mjs';
import { importBoundaryFromSourceAsset } from './services/geojson-boundary-service.mjs';
import { bindIssueGeometry } from './services/spatial-binding-service.mjs';
import { runIssueRadiusAnalysis } from './services/spatial-analysis-service.mjs';
import {
  createSourceAsset,
  updateSourceAsset,
  uploadSourceAssetContent
} from './services/source-asset-service.mjs';
import { previewSourceAsset } from './services/source-asset-preview-service.mjs';
import {
  cancelUploadSession,
  createUploadSession,
  uploadSessionContent
} from './services/upload-service.mjs';
import { createFieldTask, listFieldTasks } from './services/field-task-service.mjs';
import {
  applyLegacyMigration,
  auditLegacyMigration
} from './services/legacy-migration-service.mjs';
import {
  getCapabilities,
  getProjectSummary,
  getProjectWorkflow,
  markAnalysisStaleness,
  markReportStaleness
} from './services/workflow-service.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const businessRoot = path.join(projectRoot, 'apps', 'business');
const demoRoot = path.join(projectRoot, 'apps', 'demo-v9.1');
const port = Number(process.env.URBAN_HEALTH_PORT || 4182);
const host = process.env.URBAN_HEALTH_HOST || '127.0.0.1';
const startedAt = new Date().toISOString();
const runtimeMetrics = {
  requests: 0,
  errors: 0,
  byStatus: {}
};
const businessDataRoot = path.resolve(
  process.env.URBAN_HEALTH_DATA_DIR || path.join(projectRoot, '.data')
);
const smartRenewClient = new SmartRenewClient();
const smartRenewAdapters = createSmartRenewAdapters(smartRenewClient);
const officialIssueRepository = new OfficialIssueRepository(
  path.join(businessDataRoot, 'official-issues')
);
const photoMetadataRepository = new PhotoMetadataRepository(path.join(businessDataRoot, 'photo-metadata'));
const reportRepository = new ReportRepository(path.join(businessDataRoot, 'reports'));
const reviewSessionRepository = new ReviewSessionRepository(path.join(businessDataRoot, 'review-sessions'));
const spatialAnalysisRepository = new SpatialAnalysisRepository(path.join(businessDataRoot, 'spatial-analyses'));
const projectWriteCoordinator = new ProjectWriteCoordinator();
const uploadSessionRepository = new UploadSessionRepository(path.join(businessDataRoot, 'upload-sessions'));
const analysisJobRepository = new AnalysisJobRepository(path.join(businessDataRoot, 'analysis-jobs'));
const analysisCandidateRepository = new AnalysisCandidateRepository(
  path.join(businessDataRoot, 'analysis-candidates')
);
const boundaryRevisionRepository = new BoundaryRevisionRepository(
  path.join(businessDataRoot, 'boundary-revisions')
);
const collectionValidationRepository = new CollectionValidationRepository(
  path.join(businessDataRoot, 'collection-validations')
);
const sourceAssetRepository = new SourceAssetRepository(
  path.join(businessDataRoot, 'source-assets'),
  path.join(businessDataRoot, 'source-asset-content')
);
const fieldTaskReferenceRepository = new FieldTaskReferenceRepository(
  path.join(businessDataRoot, 'field-task-references')
);
const legacyMigrationRunRepository = new LegacyMigrationRunRepository(
  path.join(businessDataRoot, 'legacy-migration-runs')
);
const analysisJobRunner = new AnalysisJobRunner({
  client: smartRenewClient,
  jobRepository: analysisJobRepository,
  candidateRepository: analysisCandidateRepository
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function requestId(req) {
  if (!req.__urbanHealthRequestId) {
    req.__urbanHealthRequestId = String(req.headers['x-request-id'] || randomUUID());
  }
  return req.__urbanHealthRequestId;
}

function sendJson(res, status, payload, id) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-request-id': id
  });
  res.end(body);
}

function sendSuccess(res, data, id, status = 200) {
  sendJson(res, status, { ok: true, data, requestId: id }, id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function reportPrintHtml(report) {
  const severity = report.dataSnapshot?.severity || {};
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
<style>
body{font-family:"Microsoft YaHei",sans-serif;color:#17252b;max-width:900px;margin:40px auto;line-height:1.75}
h1{border-bottom:3px solid #1593a3;padding-bottom:12px}h2{margin-top:32px;color:#126b78}
.meta{color:#60747b}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.metrics div{border:1px solid #c9d6d9;padding:12px}.notice{background:#fff7dc;border-left:4px solid #d9a820;padding:10px 14px}
@media print{body{margin:18mm}.no-print{display:none}}
</style></head><body>
<button class="no-print" onclick="window.print()">打印 / 另存为PDF</button>
<h1>${escapeHtml(report.title)}</h1>
<p class="meta">版本 V${Number(report.version) || 1} · 修订 ${Number(report.reportRevision) || 1} · ${escapeHtml(report.generatedAt || '')}</p>
<h2>项目概况</h2>
<p>${escapeHtml(report.projectSnapshot?.name || '')} · ${escapeHtml(report.projectSnapshot?.area || '')}</p>
<div class="metrics">
<div>正式问题<br><strong>${Number(report.dataSnapshot?.officialIssueCount) || 0}</strong></div>
<div>高风险<br><strong>${Number(severity.high) || 0}</strong></div>
<div>中风险<br><strong>${Number(severity.medium) || 0}</strong></div>
<div>低风险<br><strong>${Number(severity.low) || 0}</strong></div>
</div>
<h2>执行摘要</h2><p>${escapeHtml(report.editorial?.executiveSummary || '尚未编辑执行摘要。')}</p>
<h2>建议</h2><p>${escapeHtml(report.editorial?.recommendations || '尚未编辑建议。')}</p>
<h2>数据快照</h2><p>已定位问题 ${Number(report.dataSnapshot?.locatedIssueCount) || 0}；AI分析 ${Number(report.dataSnapshot?.analysisRunCount) || 0}；人工复核 ${Number(report.dataSnapshot?.manualReviewCount) || 0}；空间分析 ${Number(report.dataSnapshot?.spatialAnalysisCount) || 0}。</p>
<p class="notice">${escapeHtml((report.notices || []).join(' '))}</p>
</body></html>`;
}

function sendError(res, error, id) {
  const status = Number(error?.status || 500);
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  sendJson(res, safeStatus, {
    ok: false,
    error: {
      code: error?.code || 'INTERNAL_ERROR',
      message: error?.message || '服务暂时不可用。',
      details: error?.details || {},
      retryable: Boolean(error?.retryable)
    },
    requestId: id
  }, id);
}

function redirect(res, location) {
  res.writeHead(302, { location, 'cache-control': 'no-store' });
  res.end();
}

function staticPath(root, relativePath) {
  const decoded = decodeURIComponent(relativePath || '');
  const normalized = decoded.replace(/^[/\\]+/, '');
  const target = path.resolve(root, normalized || 'index.html');
  const allowed = target === root || target.startsWith(`${root}${path.sep}`);
  if (!allowed) {
    const error = new Error('Invalid static path');
    error.status = 400;
    error.code = 'INVALID_STATIC_PATH';
    throw error;
  }
  return target;
}

async function sendFile(res, filePath) {
  let target = filePath;
  const info = await stat(target);
  if (info.isDirectory()) target = path.join(target, 'index.html');
  const bytes = await readFile(target);
  const contentType = MIME_TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'content-type': contentType,
    'content-length': bytes.length,
    'cache-control': 'no-store'
  });
  res.end(bytes);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 25 * 1024 * 1024) {
      const error = new Error('Request body is too large');
      error.status = 413;
      error.code = 'REQUEST_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function readJsonBody(req) {
  const body = await readBody(req);
  if (!body?.length) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    const error = new Error('请求体必须是有效JSON。');
    error.status = 400;
    error.code = 'INVALID_JSON';
    throw error;
  }
}

async function proxyLegacy(req, res, url, id) {
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
  const headers = {};
  for (const name of ['content-type', 'accept', 'idempotency-key', 'if-match']) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }
  headers['x-request-id'] = id;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), smartRenewClient.timeoutMs);
  try {
    const upstream = await fetch(smartRenewClient.url(`${url.pathname}${url.search}`), {
      method: req.method,
      headers,
      body,
      signal: controller.signal
    });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'content-length': bytes.length,
      'cache-control': 'no-store',
      'x-request-id': id
    });
    res.end(bytes);
  } catch (error) {
    if (error?.name === 'AbortError') {
      error.status = 504;
      error.code = 'UPSTREAM_TIMEOUT';
      error.message = 'smart-renew后端响应超时。';
    } else {
      error.status = 502;
      error.code = 'UPSTREAM_UNAVAILABLE';
      error.message = '无法连接smart-renew后端。';
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleMeta(res, id) {
  const services = await getCapabilities(smartRenewClient, smartRenewAdapters.capabilities);
  sendSuccess(res, {
    apiVersion: API_VERSION,
    schemaVersion: SCHEMA_VERSION,
    build: 'urban-health-business-local',
    services: {
      database: services.database,
      storage: services.storage,
      ai: services.ai,
      gis: services.gis,
      indicator: services.indicator,
      report: services.report,
      legacy: services.legacy
    },
    dataSources: sourceOfTruthSnapshot(),
    features: {
      optimisticConcurrency: true,
      localJsonPersistence: true,
      managedDatabase: false,
      directUpload: false,
      localFileStorage: true,
      objectStorage: false,
      resumableUploadSessions: true,
      sourceAssets: true,
      geoJsonBoundaryImport: true,
      asyncAnalysis: true,
      persistentAnalysisCandidates: true,
      clickToLocateIssues: true,
      requestObservability: true,
      legacyCapabilityRegistry: true,
      sourceOfTruthRegistry: true,
      serverPdf: false,
      workflowAggregation: true,
      demoIsolation: true
    },
    upstream: {
      ready: services.upstream.ready
    }
  }, id);
}

async function handleRequest(req, res) {
  const id = requestId(req);
  const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

  try {
    if (req.method === 'GET' && url.pathname === '/') return redirect(res, '/business/');
    if (req.method === 'GET' && url.pathname === '/business') return redirect(res, '/business/');
    if (req.method === 'GET' && url.pathname === '/demo') return redirect(res, '/demo/');

    if (req.method === 'GET' && url.pathname === '/api/meta') {
      return await handleMeta(res, id);
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendSuccess(res, {
        status: 'alive',
        service: 'urban-health-business',
        startedAt,
        apiVersion: API_VERSION
      }, id);
    }
    if (req.method === 'GET' && url.pathname === '/api/metrics') {
      return sendSuccess(res, {
        startedAt,
        uptimeSeconds: Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 1000)),
        requests: runtimeMetrics.requests,
        errors: runtimeMetrics.errors,
        byStatus: runtimeMetrics.byStatus
      }, id);
    }

    if (req.method === 'GET' && url.pathname === '/api/photos') {
      const projectId = url.searchParams.get('projectId') || '';
      const [photos, metadata] = await Promise.all([
        smartRenewClient.listPhotos(Object.fromEntries(url.searchParams)),
        photoMetadataRepository.list(projectId)
      ]);
      return sendSuccess(res, {
        items: mergePhotoMetadata(
          photos.items,
          metadata,
          url.searchParams.get('includeInactive') === 'true'
        ),
        storage: 'legacy-files-with-business-metadata'
      }, id);
    }

    const projectPhotoMetadataMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/photos\/([^/]+)$/);
    if (req.method === 'PATCH' && projectPhotoMetadataMatch) {
      const metadata = await updatePhotoMetadata(
        smartRenewClient,
        photoMetadataRepository,
        decodeURIComponent(projectPhotoMetadataMatch[1]),
        decodeURIComponent(projectPhotoMetadataMatch[2]),
        await readJsonBody(req)
      );
      return sendSuccess(res, { item: metadata }, id);
    }
    const projectPhotoBatchMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/photos\/batch-metadata$/);
    if (req.method === 'POST' && projectPhotoBatchMatch) {
      const projectId = decodeURIComponent(projectPhotoBatchMatch[1]);
      const outcome = await batchUpdatePhotoMetadata(
        smartRenewClient,
        photoMetadataRepository,
        projectId,
        await readJsonBody(req)
      );
      return sendSuccess(res, outcome, id, outcome.failed ? 207 : 200);
    }

    const projectAssetsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/assets$/);
    if (req.method === 'GET' && projectAssetsMatch) {
      return sendSuccess(res, {
        items: await sourceAssetRepository.list(
          decodeURIComponent(projectAssetsMatch[1]),
          url.searchParams.get('includeInactive') === 'true'
        ),
        storage: 'business-local-files'
      }, id);
    }
    if (req.method === 'POST' && projectAssetsMatch) {
      const outcome = await createSourceAsset(
        smartRenewClient,
        sourceAssetRepository,
        decodeURIComponent(projectAssetsMatch[1]),
        await readJsonBody(req)
      );
      return sendSuccess(res, outcome, id, outcome.duplicated ? 200 : 201);
    }

    const projectAssetMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/assets\/([^/]+)$/);
    if (req.method === 'PATCH' && projectAssetMatch) {
      const asset = await updateSourceAsset(
        smartRenewClient,
        sourceAssetRepository,
        decodeURIComponent(projectAssetMatch[1]),
        decodeURIComponent(projectAssetMatch[2]),
        await readJsonBody(req)
      );
      return sendSuccess(res, { item: asset }, id);
    }

    const assetContentMatch = url.pathname.match(/^\/api\/assets\/([^/]+)\/content$/);
    if (req.method === 'PUT' && assetContentMatch) {
      const asset = await uploadSourceAssetContent(
        sourceAssetRepository,
        decodeURIComponent(assetContentMatch[1]),
        await readBody(req),
        req.headers['content-type'] || ''
      );
      return sendSuccess(res, { item: asset }, id);
    }
    if (req.method === 'GET' && assetContentMatch) {
      const assetId = decodeURIComponent(assetContentMatch[1]);
      const asset = await sourceAssetRepository.get(assetId);
      const content = asset ? await sourceAssetRepository.readContent(assetId) : null;
      if (!asset || !content) {
        const error = new Error('资料文件不存在或尚未上传完成。');
        error.status = 404;
        error.code = 'SOURCE_ASSET_CONTENT_NOT_FOUND';
        throw error;
      }
      res.writeHead(200, {
        'content-type': asset.mimeType || 'application/octet-stream',
        'content-length': content.length,
        'content-disposition': `attachment; filename="${asset.id}"`,
        'cache-control': 'no-store',
        'x-request-id': id
      });
      res.end(content);
      return;
    }
    const assetPreviewMatch = url.pathname.match(/^\/api\/assets\/([^/]+)\/preview$/);
    if (req.method === 'GET' && assetPreviewMatch) {
      const requestedRows = Number(url.searchParams.get('maxRows') || 100);
      const maxRows = Number.isInteger(requestedRows)
        ? Math.max(1, Math.min(200, requestedRows))
        : 100;
      return sendSuccess(
        res,
        await previewSourceAsset(
          sourceAssetRepository,
          decodeURIComponent(assetPreviewMatch[1]),
          maxRows
        ),
        id
      );
    }
    if (req.method === 'GET' && url.pathname === '/api/ready') {
      const capabilities = await getCapabilities(smartRenewClient, smartRenewAdapters.capabilities);
      const ready = capabilities.upstream.ready;
      return sendSuccess(res, {
        status: ready ? 'ready' : 'not_ready',
        upstream: capabilities.upstream,
        required: {
          database: capabilities.database,
          storage: capabilities.storage
        },
        optional: {
          ai: capabilities.ai,
          gisMap: {
            ready: capabilities.gis.mapReady,
            reason: capabilities.gis.mapReason
          },
          indicator: capabilities.indicator,
          legacy: capabilities.legacy,
          serverPdf: {
            ready: capabilities.report.pdfReady,
            reason: capabilities.report.pdfReady ? null : 'server_pdf_not_integrated'
          }
        }
      }, id, ready ? 200 : 503);
    }

    if (req.method === 'GET' && url.pathname === '/api/uploads') {
      return sendSuccess(res, {
        items: await uploadSessionRepository.list(url.searchParams.get('projectId') || '')
      }, id);
    }

    if (req.method === 'POST' && url.pathname === '/api/uploads') {
      const outcome = await createUploadSession(
        smartRenewClient,
        uploadSessionRepository,
        await readJsonBody(req)
      );
      return sendSuccess(res, outcome, id, outcome.duplicated ? 200 : 201);
    }

    const uploadSessionMatch = url.pathname.match(/^\/api\/uploads\/([^/]+)$/);
    if (req.method === 'GET' && uploadSessionMatch) {
      const session = await uploadSessionRepository.get(decodeURIComponent(uploadSessionMatch[1]));
      if (!session) {
        const error = new Error('上传会话不存在。');
        error.status = 404;
        error.code = 'UPLOAD_SESSION_NOT_FOUND';
        throw error;
      }
      return sendSuccess(res, { item: session }, id);
    }

    if (req.method === 'PUT' && uploadSessionMatch) {
      let outcome = await uploadSessionContent(
        smartRenewClient,
        uploadSessionRepository,
        decodeURIComponent(uploadSessionMatch[1]),
        await readBody(req),
        req.headers['content-type'] || ''
      );
      if (outcome.session?.exif?.found && !outcome.duplicated) {
        try {
          const coordinates = outcome.session.exif.coordinates;
          const metadata = await updatePhotoMetadata(
            smartRenewClient,
            photoMetadataRepository,
            outcome.session.projectId,
            outcome.session.photoId,
            {
              displayName: outcome.session.photo?.name,
              communityId: outcome.session.communityId,
              buildingId: outcome.session.buildingId,
              capturedAt: outcome.session.exif.capturedAt || outcome.session.photo?.capturedAt,
              ...(coordinates ? {
                longitude: coordinates[0],
                latitude: coordinates[1],
                coordinateCrs: 'WGS84',
                coordinateSource: 'exif'
              } : {}),
              capturedAtSource: outcome.session.exif.capturedAt ? 'exif' : 'file-last-modified',
              status: 'active',
              notes: outcome.session.exif.timezoneStatus === 'unknown'
                ? '由照片EXIF自动提取；拍摄时间未包含时区。'
                : '由照片EXIF自动提取。',
              updatedBy: '系统EXIF解析',
              expectedRevision: 0
            }
          );
          const session = {
            ...outcome.session,
            exifApplyStatus: 'applied',
            photoMetadataRevision: metadata.metadataRevision,
            updatedAt: new Date().toISOString()
          };
          await uploadSessionRepository.put(session);
          outcome = { ...outcome, session };
        } catch (error) {
          const session = {
            ...outcome.session,
            exifApplyStatus: 'failed',
            exifApplyError: {
              code: error.code || 'EXIF_METADATA_APPLY_FAILED',
              message: error.message
            },
            updatedAt: new Date().toISOString()
          };
          await uploadSessionRepository.put(session);
          outcome = { ...outcome, session };
        }
      }
      return sendSuccess(res, outcome, id);
    }

    const uploadCancelMatch = url.pathname.match(/^\/api\/uploads\/([^/]+)\/cancel$/);
    if (req.method === 'POST' && uploadCancelMatch) {
      const session = await cancelUploadSession(
        uploadSessionRepository,
        decodeURIComponent(uploadCancelMatch[1])
      );
      return sendSuccess(res, { item: session }, id);
    }

    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const project = await createProject(smartRenewClient, await readJsonBody(req));
      return sendSuccess(res, { item: project }, id, 201);
    }

    const projectUpdateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (req.method === 'PATCH' && projectUpdateMatch) {
      const projectId = decodeURIComponent(projectUpdateMatch[1]);
      const input = await readJsonBody(req);
      const project = await projectWriteCoordinator.run(projectId, () =>
        updateProjectMetadata(smartRenewClient, projectId, input)
      );
      return sendSuccess(res, { item: project }, id);
    }

    const projectExportMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/export$/);
    if (req.method === 'GET' && projectExportMatch) {
      const projectId = decodeURIComponent(projectExportMatch[1]);
      const [
        project,
        collections,
        boundaryRevisions,
        collectionValidations,
        sourceAssets,
        photoMetadata,
        uploadSessions,
        analysisJobs,
        analysisCandidates,
        businessIssues,
        reviewSessions,
        spatialAnalyses,
        businessReports,
        fieldTaskReferences,
        legacyMigrationRuns
      ] = await Promise.all([
        smartRenewClient.getProject(projectId),
        smartRenewClient.projectCollections(projectId),
        boundaryRevisionRepository.list(projectId),
        collectionValidationRepository.list(projectId),
        sourceAssetRepository.list(projectId, true),
        photoMetadataRepository.list(projectId),
        uploadSessionRepository.list(projectId),
        analysisJobRepository.list(projectId),
        analysisCandidateRepository.list({ projectId }),
        officialIssueRepository.list(projectId),
        reviewSessionRepository.list(projectId),
        spatialAnalysisRepository.list(projectId),
        reportRepository.list(projectId),
        fieldTaskReferenceRepository.list(projectId),
        legacyMigrationRunRepository.list(projectId)
      ]);
      const artifact = {
        manifest: {
          format: 'urban-health-business-project-export',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          projectId,
          includesPhotoBinaries: false,
          includesSourceAssetBinaries: false,
          apiVersion: API_VERSION,
          schemaVersion: SCHEMA_VERSION
        },
        project,
        legacy: {
          photos: collections.photos.items,
          analyses: collections.analyses.items,
          officialIssues: collections.issues.items,
          reports: collections.reports.items,
          fieldRecords: collections.fieldRecords.items,
          projectData: collections.projectData.items
        },
        business: {
          boundaryRevisions,
          collectionValidations,
          sourceAssets,
          photoMetadata,
          uploadSessions,
          analysisJobs,
          analysisCandidates,
          officialIssues: businessIssues,
          reviewSessions,
          spatialAnalyses,
          reports: businessReports,
          fieldTaskReferences,
          legacyMigrationRuns
        }
      };
      const body = JSON.stringify(artifact, null, 2);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'content-disposition': `attachment; filename="urban-health-${projectId}.json"`,
        'cache-control': 'no-store',
        'x-request-id': id
      });
      res.end(body);
      return;
    }

    const projectDataMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/project-data$/);
    if (req.method === 'GET' && projectDataMatch) {
      const projectId = decodeURIComponent(projectDataMatch[1]);
      const filters = Object.fromEntries(url.searchParams);
      delete filters.projectId;
      return sendSuccess(
        res,
        await smartRenewAdapters.projectData.list(projectId, filters),
        id
      );
    }
    if (req.method === 'POST' && projectDataMatch) {
      const projectId = decodeURIComponent(projectDataMatch[1]);
      const input = await readJsonBody(req);
      const result = await projectWriteCoordinator.run(
        projectId,
        () => smartRenewAdapters.projectData.importRecords(
          projectId,
          Array.isArray(input?.records) ? input.records : [],
          { mode: input?.mode }
        )
      );
      return sendSuccess(res, result, id);
    }

    const projectDataExportMatch = url.pathname.match(
      /^\/api\/projects\/([^/]+)\/project-data\/export$/
    );
    if (req.method === 'GET' && projectDataExportMatch) {
      return sendSuccess(
        res,
        await smartRenewAdapters.projectData.export(
          decodeURIComponent(projectDataExportMatch[1])
        ),
        id
      );
    }

    const fieldCommunitiesMatch = url.pathname.match(
      /^\/api\/projects\/([^/]+)\/field\/communities$/
    );
    if (req.method === 'GET' && fieldCommunitiesMatch) {
      return sendSuccess(res, {
        items: await smartRenewAdapters.field.listCommunities(
          decodeURIComponent(fieldCommunitiesMatch[1])
        ),
        source: 'smart-renew'
      }, id);
    }

    const fieldBuildingsMatch = url.pathname.match(
      /^\/api\/projects\/([^/]+)\/field\/communities\/([^/]+)\/buildings$/
    );
    if (req.method === 'GET' && fieldBuildingsMatch) {
      return sendSuccess(res, {
        items: await smartRenewAdapters.field.listBuildings(
          decodeURIComponent(fieldBuildingsMatch[1]),
          decodeURIComponent(fieldBuildingsMatch[2])
        ),
        source: 'smart-renew'
      }, id);
    }

    const fieldTasksMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/field\/tasks$/);
    if (req.method === 'GET' && fieldTasksMatch) {
      return sendSuccess(
        res,
        await listFieldTasks(
          smartRenewAdapters.field,
          fieldTaskReferenceRepository,
          decodeURIComponent(fieldTasksMatch[1])
        ),
        id
      );
    }
    if (req.method === 'POST' && fieldTasksMatch) {
      const projectId = decodeURIComponent(fieldTasksMatch[1]);
      const input = await readJsonBody(req);
      const outcome = await projectWriteCoordinator.run(
        projectId,
        () => createFieldTask(
          smartRenewAdapters.field,
          fieldTaskReferenceRepository,
          projectId,
          input
        )
      );
      return sendSuccess(res, outcome, id, outcome.duplicated ? 200 : 201);
    }

    const fieldTaskDetailMatch = url.pathname.match(
      /^\/api\/projects\/([^/]+)\/field\/tasks\/([^/]+)$/
    );
    if (req.method === 'GET' && fieldTaskDetailMatch) {
      const projectId = decodeURIComponent(fieldTaskDetailMatch[1]);
      const task = await smartRenewAdapters.field.getTask(
        decodeURIComponent(fieldTaskDetailMatch[2])
      );
      if (String(task?.projectId) !== String(projectId)) {
        const error = new Error('外业任务不属于当前项目。');
        error.status = 404;
        error.code = 'FIELD_TASK_NOT_FOUND';
        throw error;
      }
      return sendSuccess(res, { item: task, source: 'smart-renew' }, id);
    }

    const legacyMigrationMatch = url.pathname.match(
      /^\/api\/projects\/([^/]+)\/legacy-migration$/
    );
    if (req.method === 'GET' && legacyMigrationMatch) {
      return sendSuccess(
        res,
        await auditLegacyMigration(
          smartRenewAdapters.legacyMigration,
          legacyMigrationRunRepository,
          decodeURIComponent(legacyMigrationMatch[1])
        ),
        id
      );
    }
    if (req.method === 'POST' && legacyMigrationMatch) {
      const projectId = decodeURIComponent(legacyMigrationMatch[1]);
      const input = await readJsonBody(req);
      const outcome = await projectWriteCoordinator.run(
        projectId,
        () => applyLegacyMigration(
          smartRenewAdapters.legacyMigration,
          legacyMigrationRunRepository,
          projectId,
          input
        )
      );
      return sendSuccess(res, outcome, id, outcome.duplicated ? 200 : 201);
    }

    const communityCreateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/communities$/);
    if (req.method === 'GET' && communityCreateMatch) {
      const project = await smartRenewClient.getProject(decodeURIComponent(communityCreateMatch[1]));
      return sendSuccess(res, { items: listCommunityInventory(project) }, id);
    }
    if (req.method === 'POST' && communityCreateMatch) {
      const projectId = decodeURIComponent(communityCreateMatch[1]);
      const input = await readJsonBody(req);
      const community = await projectWriteCoordinator.run(projectId, () =>
        addCommunity(smartRenewClient, projectId, input)
      );
      return sendSuccess(res, { item: community }, id, 201);
    }

    const communityUpdateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/communities\/([^/]+)$/);
    if (req.method === 'PATCH' && communityUpdateMatch) {
      const projectId = decodeURIComponent(communityUpdateMatch[1]);
      const communityId = decodeURIComponent(communityUpdateMatch[2]);
      const input = await readJsonBody(req);
      const community = await projectWriteCoordinator.run(projectId, () =>
        updateCommunity(smartRenewClient, projectId, communityId, input)
      );
      return sendSuccess(res, { item: community }, id);
    }

    const boundaryUpdateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/boundary$/);
    if (req.method === 'GET' && boundaryUpdateMatch) {
      return sendSuccess(res, {
        items: await boundaryRevisionRepository.list(decodeURIComponent(boundaryUpdateMatch[1]))
      }, id);
    }
    if (req.method === 'PATCH' && boundaryUpdateMatch) {
      const projectId = decodeURIComponent(boundaryUpdateMatch[1]);
      const input = await readJsonBody(req);
      const project = await projectWriteCoordinator.run(projectId, () =>
        updateProjectBoundary(smartRenewClient, projectId, input)
      );
      const revision = await boundaryRevisionRepository.putFromProject(project);
      return sendSuccess(res, { item: project, revision }, id);
    }
    const boundaryImportMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/boundary\/import$/);
    if (req.method === 'POST' && boundaryImportMatch) {
      const projectId = decodeURIComponent(boundaryImportMatch[1]);
      const input = await readJsonBody(req);
      const project = await projectWriteCoordinator.run(projectId, () =>
        importBoundaryFromSourceAsset(
          smartRenewClient,
          sourceAssetRepository,
          projectId,
          input
        )
      );
      const revision = await boundaryRevisionRepository.putFromProject(project);
      return sendSuccess(res, { item: project, revision }, id);
    }

    const buildingCreateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/communities\/([^/]+)\/buildings$/);
    if (req.method === 'GET' && buildingCreateMatch) {
      const project = await smartRenewClient.getProject(decodeURIComponent(buildingCreateMatch[1]));
      const items = listBuildingInventory(project, decodeURIComponent(buildingCreateMatch[2]));
      if (!items) {
        const error = new Error('小区不存在或已删除。');
        error.status = 404;
        error.code = 'COMMUNITY_NOT_FOUND';
        throw error;
      }
      return sendSuccess(res, { items }, id);
    }
    if (req.method === 'POST' && buildingCreateMatch) {
      const projectId = decodeURIComponent(buildingCreateMatch[1]);
      const communityId = decodeURIComponent(buildingCreateMatch[2]);
      const input = await readJsonBody(req);
      const building = await projectWriteCoordinator.run(projectId, () =>
        addBuilding(smartRenewClient, projectId, communityId, input)
      );
      return sendSuccess(res, { item: building }, id, 201);
    }

    const buildingUpdateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/communities\/([^/]+)\/buildings\/([^/]+)$/);
    if (req.method === 'PATCH' && buildingUpdateMatch) {
      const projectId = decodeURIComponent(buildingUpdateMatch[1]);
      const communityId = decodeURIComponent(buildingUpdateMatch[2]);
      const buildingId = decodeURIComponent(buildingUpdateMatch[3]);
      const input = await readJsonBody(req);
      const building = await projectWriteCoordinator.run(projectId, () =>
        updateBuilding(smartRenewClient, projectId, communityId, buildingId, input)
      );
      return sendSuccess(res, { item: building }, id);
    }

    const workflowMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/workflow$/);
    if (req.method === 'GET' && workflowMatch) {
      const workflow = await getProjectWorkflow(
        smartRenewClient,
        decodeURIComponent(workflowMatch[1]),
        officialIssueRepository,
        reportRepository,
        analysisJobRepository,
        uploadSessionRepository,
        reviewSessionRepository,
        spatialAnalysisRepository,
        photoMetadataRepository,
        sourceAssetRepository
      );
      return sendSuccess(res, workflow, id);
    }

    const collectionValidationMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/collection\/validation$/);
    if (req.method === 'GET' && collectionValidationMatch) {
      const validation = await getCollectionValidation(
        smartRenewClient,
        decodeURIComponent(collectionValidationMatch[1]),
        uploadSessionRepository,
        photoMetadataRepository,
        sourceAssetRepository
      );
      return sendSuccess(res, validation, id);
    }

    const collectionValidateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/collection\/validate$/);
    if (req.method === 'POST' && collectionValidateMatch) {
      const projectId = decodeURIComponent(collectionValidateMatch[1]);
      const input = await readJsonBody(req);
      const validatedBy = String(input?.validatedBy || '').trim().slice(0, 120);
      if (!validatedBy) {
        const error = new Error('请填写资料校验人员。');
        error.status = 400;
        error.code = 'COLLECTION_VALIDATOR_REQUIRED';
        throw error;
      }
      const validation = await getCollectionValidation(
        smartRenewClient,
        projectId,
        uploadSessionRepository,
        photoMetadataRepository,
        sourceAssetRepository
      );
      const run = await collectionValidationRepository.create(validation, validatedBy);
      return sendSuccess(res, { item: run }, id, 201);
    }

    const collectionValidationRunsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/collection\/validation-runs$/);
    if (req.method === 'GET' && collectionValidationRunsMatch) {
      return sendSuccess(res, {
        items: await collectionValidationRepository.list(
          decodeURIComponent(collectionValidationRunsMatch[1])
        )
      }, id);
    }

    const summaryMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/summary$/);
    if (req.method === 'GET' && summaryMatch) {
      const summary = await getProjectSummary(
        smartRenewClient,
        decodeURIComponent(summaryMatch[1]),
        officialIssueRepository,
        reportRepository,
        analysisJobRepository,
        uploadSessionRepository,
        reviewSessionRepository,
        spatialAnalysisRepository,
        photoMetadataRepository,
        sourceAssetRepository
      );
      return sendSuccess(res, summary, id);
    }

    const analysisCreateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/analyses$/);
    if (req.method === 'POST' && analysisCreateMatch) {
      const analysis = await runAnalysis(
        smartRenewClient,
        decodeURIComponent(analysisCreateMatch[1]),
        await readJsonBody(req)
      );
      return sendSuccess(res, { item: analysis }, id, 201);
    }

    const analysisJobsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/analysis-jobs$/);
    if (req.method === 'GET' && analysisJobsMatch) {
      const projectId = decodeURIComponent(analysisJobsMatch[1]);
      const [jobs, photos, photoMetadata] = await Promise.all([
        analysisJobRepository.list(projectId),
        smartRenewClient.listPhotos({ projectId }),
        photoMetadataRepository.list(projectId)
      ]);
      return sendSuccess(res, {
        items: markAnalysisStaleness(
          jobs,
          mergePhotoMetadata(photos.items, photoMetadata, true)
        )
      }, id);
    }

    if (req.method === 'POST' && analysisJobsMatch) {
      const outcome = await createAnalysisJob(
        smartRenewClient,
        analysisJobRepository,
        decodeURIComponent(analysisJobsMatch[1]),
        await readJsonBody(req),
        { photoMetadataRepository }
      );
      if (!outcome.duplicated) analysisJobRunner.enqueue(outcome.job.id);
      return sendSuccess(res, outcome, id, outcome.duplicated ? 200 : 202);
    }

    const analysisJobMatch = url.pathname.match(/^\/api\/analysis-jobs\/([^/]+)$/);
    if (req.method === 'GET' && analysisJobMatch) {
      const job = await analysisJobRepository.get(decodeURIComponent(analysisJobMatch[1]));
      if (!job) {
        const error = new Error('AI任务不存在。');
        error.status = 404;
        error.code = 'ANALYSIS_JOB_NOT_FOUND';
        throw error;
      }
      const [photos, photoMetadata] = await Promise.all([
        smartRenewClient.listPhotos({ projectId: job.projectId }),
        photoMetadataRepository.list(job.projectId)
      ]);
      return sendSuccess(res, {
        item: markAnalysisStaleness(
          [job],
          mergePhotoMetadata(photos.items, photoMetadata, true)
        )[0]
      }, id);
    }

    const analysisJobCandidatesMatch = url.pathname.match(/^\/api\/analysis-jobs\/([^/]+)\/candidates$/);
    if (req.method === 'GET' && analysisJobCandidatesMatch) {
      return sendSuccess(res, {
        items: await analysisCandidateRepository.list({
          jobId: decodeURIComponent(analysisJobCandidatesMatch[1])
        })
      }, id);
    }

    if (req.method === 'GET' && url.pathname === '/api/analysis-candidates') {
      return sendSuccess(res, {
        items: await analysisCandidateRepository.list({
          projectId: url.searchParams.get('projectId') || '',
          analysisId: url.searchParams.get('analysisId') || '',
          jobId: url.searchParams.get('jobId') || ''
        })
      }, id);
    }

    const analysisCandidateMatch = url.pathname.match(/^\/api\/analysis-candidates\/([^/]+)$/);
    if (req.method === 'GET' && analysisCandidateMatch) {
      const candidate = await analysisCandidateRepository.get(
        decodeURIComponent(analysisCandidateMatch[1])
      );
      if (!candidate) {
        const error = new Error('AI候选不存在。');
        error.status = 404;
        error.code = 'ANALYSIS_CANDIDATE_NOT_FOUND';
        throw error;
      }
      return sendSuccess(res, { item: candidate }, id);
    }
    if (req.method === 'PATCH' && analysisCandidateMatch) {
      const candidate = await updateAnalysisCandidate(
        smartRenewClient,
        analysisCandidateRepository,
        decodeURIComponent(analysisCandidateMatch[1]),
        await readJsonBody(req)
      );
      return sendSuccess(res, { item: candidate }, id);
    }

    const analysisJobCancelMatch = url.pathname.match(/^\/api\/analysis-jobs\/([^/]+)\/cancel$/);
    if (req.method === 'POST' && analysisJobCancelMatch) {
      const job = await cancelAnalysisJob(
        analysisJobRepository,
        decodeURIComponent(analysisJobCancelMatch[1])
      );
      return sendSuccess(res, { item: job }, id);
    }

    const analysisJobRetryMatch = url.pathname.match(/^\/api\/analysis-jobs\/([^/]+)\/retry$/);
    if (req.method === 'POST' && analysisJobRetryMatch) {
      const outcome = await retryAnalysisJob(
        smartRenewClient,
        analysisJobRepository,
        decodeURIComponent(analysisJobRetryMatch[1]),
        { photoMetadataRepository }
      );
      analysisJobRunner.enqueue(outcome.job.id);
      return sendSuccess(res, outcome, id, 202);
    }

    const reviewFinalizeMatch = url.pathname.match(/^\/api\/analyses\/([^/]+)\/review\/finalize$/);
    if (req.method === 'POST' && reviewFinalizeMatch) {
      const outcome = await finalizeReview(
        smartRenewClient,
        officialIssueRepository,
        decodeURIComponent(reviewFinalizeMatch[1]),
        await readJsonBody(req),
        {},
        analysisCandidateRepository
      );
      return sendSuccess(res, outcome, id);
    }

    if (req.method === 'GET' && url.pathname === '/api/issues') {
      const projectId = url.searchParams.get('projectId') || '';
      const [businessIssues, legacyIssues] = await Promise.all([
        officialIssueRepository.list(projectId),
        smartRenewClient.listIssues(Object.fromEntries(url.searchParams))
      ]);
      const items = mergePrimaryReadModel('officialIssue', {
        businessItems: businessIssues,
        legacyItems: legacyIssues.items
      });
      return sendSuccess(res, {
        items,
        storage: 'business-primary-legacy-read-only'
      }, id);
    }

    const projectIssuesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/issues$/);
    if (req.method === 'POST' && projectIssuesMatch) {
      const issue = await createManualIssue(
        smartRenewClient,
        officialIssueRepository,
        decodeURIComponent(projectIssuesMatch[1]),
        await readJsonBody(req),
        { photoMetadataRepository }
      );
      return sendSuccess(res, { item: issue }, id, 201);
    }

    const projectManualReviewsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/manual-reviews$/);
    if (req.method === 'GET' && projectManualReviewsMatch) {
      return sendSuccess(res, {
        items: await reviewSessionRepository.list(decodeURIComponent(projectManualReviewsMatch[1]))
      }, id);
    }
    if (req.method === 'POST' && projectManualReviewsMatch) {
      const outcome = await finalizeManualReview(
        smartRenewClient,
        officialIssueRepository,
        reviewSessionRepository,
        decodeURIComponent(projectManualReviewsMatch[1]),
        await readJsonBody(req)
      );
      return sendSuccess(res, outcome, id, outcome.duplicated ? 200 : 201);
    }

    const issueDetailsMatch = url.pathname.match(/^\/api\/issues\/([^/]+)$/);
    if (req.method === 'PATCH' && issueDetailsMatch) {
      const issue = await officialIssueRepository.updateDetails(
        decodeURIComponent(issueDetailsMatch[1]),
        await readJsonBody(req)
      );
      return sendSuccess(res, { item: issue }, id);
    }

    const issueGeometryMatch = url.pathname.match(/^\/api\/issues\/([^/]+)\/geometry$/);
    if (req.method === 'PATCH' && issueGeometryMatch) {
      const issue = await bindIssueGeometry(
        smartRenewClient,
        officialIssueRepository,
        decodeURIComponent(issueGeometryMatch[1]),
        await readJsonBody(req)
      );
      return sendSuccess(res, { item: issue }, id);
    }

    const spatialAnalysesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/spatial-analyses$/);
    if (req.method === 'GET' && spatialAnalysesMatch) {
      return sendSuccess(res, {
        items: await spatialAnalysisRepository.list(decodeURIComponent(spatialAnalysesMatch[1]))
      }, id);
    }
    if (req.method === 'POST' && spatialAnalysesMatch) {
      const run = await runIssueRadiusAnalysis(
        smartRenewClient,
        officialIssueRepository,
        spatialAnalysisRepository,
        decodeURIComponent(spatialAnalysesMatch[1]),
        await readJsonBody(req)
      );
      return sendSuccess(res, { item: run }, id, 201);
    }

    if (req.method === 'GET' && url.pathname === '/api/indicator-engine/meta') {
      return sendSuccess(res, {
        ready: false,
        contractVersion: '1.0.0-draft',
        reason: 'indicator_engine_not_integrated',
        expectedInput: {
          projectId: 'string',
          officialIssueSnapshotId: 'string|null',
          spatialAnalysisSnapshotId: 'string|null',
          fieldDataSnapshotId: 'string|null'
        },
        expectedOutput: {
          runId: 'string',
          status: 'queued|running|completed|failed',
          results: 'IndicatorResult[]'
        }
      }, id);
    }

    const indicatorRunMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/indicator-runs$/);
    if (req.method === 'POST' && indicatorRunMatch) {
      const error = new Error('指标引擎尚未接入，当前不会生成演示指标或分数。');
      error.status = 501;
      error.code = 'INDICATOR_ENGINE_NOT_INTEGRATED';
      error.details = {
        projectId: decodeURIComponent(indicatorRunMatch[1]),
        contract: '/api/indicator-engine/meta'
      };
      throw error;
    }

    const reportCompareMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/reports\/compare$/);
    if (req.method === 'GET' && reportCompareMatch) {
      const projectId = decodeURIComponent(reportCompareMatch[1]);
      const baseReportId = String(url.searchParams.get('baseReportId') || '').trim();
      const targetReportId = String(url.searchParams.get('targetReportId') || '').trim();
      if (!baseReportId || !targetReportId) {
        const error = new Error('请提供baseReportId和targetReportId。');
        error.status = 400;
        error.code = 'REPORT_COMPARE_IDS_REQUIRED';
        throw error;
      }
      const [businessReports, legacyReports] = await Promise.all([
        reportRepository.list(projectId),
        smartRenewClient.listReports({ projectId })
      ]);
      const reportMap = new Map(
        mergePrimaryReadModel('report', {
          businessItems: businessReports,
          legacyItems: legacyReports.items
        }).map((report) => [String(report.id), report])
      );
      const baseReport = reportMap.get(baseReportId);
      const targetReport = reportMap.get(targetReportId);
      if (!baseReport || !targetReport) {
        const error = new Error('所选报告版本不存在或不属于当前项目。');
        error.status = 404;
        error.code = 'REPORT_COMPARE_NOT_FOUND';
        throw error;
      }
      return sendSuccess(res, compareReports(baseReport, targetReport), id);
    }

    const reportArtifactMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\/(json|print)$/);
    if (req.method === 'GET' && reportArtifactMatch) {
      const report = await reportRepository.get(decodeURIComponent(reportArtifactMatch[1]));
      if (!report) {
        const error = new Error('Business报告不存在。');
        error.status = 404;
        error.code = 'REPORT_NOT_FOUND';
        throw error;
      }
      if (reportArtifactMatch[2] === 'print') {
        const body = reportPrintHtml(report);
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-length': Buffer.byteLength(body),
          'cache-control': 'no-store',
          'x-request-id': id
        });
        res.end(body);
        return;
      }
      const body = JSON.stringify(report, null, 2);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body),
        'content-disposition': `attachment; filename="${report.id}.json"`,
        'cache-control': 'no-store',
        'x-request-id': id
      });
      res.end(body);
      return;
    }

    const reportDetailMatch = url.pathname.match(/^\/api\/reports\/([^/]+)$/);
    if (req.method === 'GET' && reportDetailMatch) {
      const report = await reportRepository.get(decodeURIComponent(reportDetailMatch[1]));
      if (!report) {
        const error = new Error('Business报告不存在。');
        error.status = 404;
        error.code = 'REPORT_NOT_FOUND';
        throw error;
      }
      return sendSuccess(res, { item: report }, id);
    }
    if (req.method === 'PATCH' && reportDetailMatch) {
      const report = await reportRepository.update(
        decodeURIComponent(reportDetailMatch[1]),
        await readJsonBody(req)
      );
      return sendSuccess(res, { item: report }, id);
    }

    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const projectId = url.searchParams.get('projectId') || '';
      const [businessReports, legacyReports] = await Promise.all([
        reportRepository.list(projectId),
        smartRenewClient.listReports(Object.fromEntries(url.searchParams))
      ]);
      let items = mergePrimaryReadModel('report', {
        businessItems: businessReports,
        legacyItems: legacyReports.items
      });
      if (projectId) {
        const [
          project,
          businessIssues,
          legacyIssues,
          spatialAnalyses,
          photos,
          photoMetadata
        ] = await Promise.all([
          smartRenewClient.getProject(projectId),
          officialIssueRepository.list(projectId),
          smartRenewClient.listIssues({ projectId }),
          spatialAnalysisRepository.list(projectId),
          smartRenewClient.listPhotos({ projectId }),
          photoMetadataRepository.list(projectId)
        ]);
        const mergedIssues = mergePrimaryReadModel('officialIssue', {
          businessItems: businessIssues,
          legacyItems: legacyIssues.items
        });
        items = markReportStaleness(
          items,
          project,
          mergedIssues,
          spatialAnalyses,
          mergePhotoMetadata(photos.items, photoMetadata, true)
        );
      }
      return sendSuccess(res, {
        items,
        storage: 'business-primary-legacy-read-only'
      }, id);
    }

    const reportCreateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/reports$/);
    if (req.method === 'POST' && reportCreateMatch) {
      const projectId = decodeURIComponent(reportCreateMatch[1]);
      const [
        project,
        businessIssues,
        legacyIssues,
        analyses,
        manualReviews,
        spatialAnalyses,
        photos,
        photoMetadata
      ] = await Promise.all([
        smartRenewClient.getProject(projectId),
        officialIssueRepository.list(projectId),
        smartRenewClient.listIssues({ projectId }),
        smartRenewClient.listAnalyses({ projectId }),
        reviewSessionRepository.list(projectId),
        spatialAnalysisRepository.list(projectId),
        smartRenewClient.listPhotos({ projectId }),
        photoMetadataRepository.list(projectId)
      ]);
      const issues = mergePrimaryReadModel('officialIssue', {
        businessItems: businessIssues,
        legacyItems: legacyIssues.items
      });
      if (
        !analyses.items.some((analysis) => analysis.status === 'archived')
        && !manualReviews.some((review) => review.status === 'archived')
      ) {
        const error = new Error('请先完成人工复核并归档分析结论。');
        error.status = 409;
        error.code = 'REVIEW_ARCHIVE_REQUIRED';
        throw error;
      }
      const report = await reportRepository.create(
        project,
        issues,
        analyses.items,
        await readJsonBody(req),
        {
          reviewConclusions: manualReviews,
          spatialAnalyses,
          photos: mergePhotoMetadata(photos.items, photoMetadata)
        }
      );
      return sendSuccess(res, { item: report }, id, 201);
    }

    if (url.pathname.startsWith('/api/')) {
      return await proxyLegacy(req, res, url, id);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/business/')) {
      const relative = url.pathname.slice('/business/'.length);
      return await sendFile(res, staticPath(businessRoot, relative));
    }

    if (req.method === 'GET' && url.pathname.startsWith('/demo/')) {
      const relative = url.pathname.slice('/demo/'.length);
      return await sendFile(res, staticPath(demoRoot, relative || 'index-v9.1.html'));
    }

    const error = new Error('页面或接口不存在。');
    error.status = 404;
    error.code = 'RESOURCE_NOT_FOUND';
    throw error;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      error.status = 404;
      error.code = 'RESOURCE_NOT_FOUND';
      error.message = '文件不存在。';
    }
    sendError(res, error, id);
  }
}

const server = http.createServer((req, res) => {
  const beganAt = Date.now();
  const id = requestId(req);
  res.once('finish', () => {
    const status = String(res.statusCode || 0);
    runtimeMetrics.requests += 1;
    runtimeMetrics.byStatus[status] = Number(runtimeMetrics.byStatus[status] || 0) + 1;
    if (res.statusCode >= 400) runtimeMetrics.errors += 1;
    console.log(JSON.stringify({
      type: 'request_completed',
      requestId: id,
      method: req.method,
      path: String(req.url || '').split('?')[0],
      status: res.statusCode,
      durationMs: Date.now() - beganAt
    }));
  });
  handleRequest(req, res).catch((error) => {
    if (!res.headersSent) sendError(res, error, id);
    else res.destroy(error);
  });
});

server.listen(port, host, () => {
  console.log(`Urban Health Business: http://${host}:${port}/business/`);
  console.log(`V9.1 Demo: http://${host}:${port}/demo/`);
  console.log(`smart-renew upstream: ${smartRenewClient.baseUrl}`);
  analysisJobRunner.recover().catch((error) => {
    console.error(`Analysis job recovery failed: ${error.message}`);
  });
});
