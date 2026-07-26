import { buildWorkflow } from '../../packages/workflow-core/index.mjs';
import { LegacyCapabilityRegistry } from '../adapters/smart-renew/capabilities.mjs';
import { mergePrimaryReadModel } from '../adapters/smart-renew/read-model-policy.mjs';
import { assessCollection } from './collection-validation-service.mjs';
import { mergePhotoMetadata } from './photo-metadata-service.mjs';

function isAiReady(health) {
  return Boolean(health?.ready);
}

export async function getCapabilities(client, capabilityRegistry = new LegacyCapabilityRegistry()) {
  let health = null;
  let upstreamReady = false;
  let upstreamError = null;
  try {
    health = await client.health();
    upstreamReady = true;
  } catch (error) {
    upstreamError = {
      code: error.code || 'UPSTREAM_UNAVAILABLE',
      message: error.message
    };
  }

  return {
    upstream: {
      ready: upstreamReady,
      baseUrl: client.baseUrl,
      error: upstreamError
    },
    database: {
      ready: upstreamReady,
      reason: upstreamReady ? null : 'smart_renew_unavailable',
      mode: 'local-json-files',
      managedDatabaseReady: false,
      managedDatabaseReason: 'managed_database_not_integrated'
    },
    storage: {
      ready: upstreamReady,
      reason: upstreamReady ? null : 'smart_renew_unavailable',
      mode: 'local-filesystem',
      objectStorageReady: false,
      objectStorageReason: 'object_storage_not_integrated'
    },
    ai: {
      ready: upstreamReady && isAiReady(health),
      reason: !upstreamReady ? 'smart_renew_unavailable' : isAiReady(health) ? null : 'ai_not_configured',
      model: health?.model || null
    },
    gis: {
      ready: true,
      reason: null,
      provider: 'manual-coordinate',
      mapReady: false,
      mapReason: 'map_provider_not_integrated'
    },
    indicator: { ready: false, reason: 'indicator_engine_not_integrated' },
    report: { ready: upstreamReady, reason: upstreamReady ? null : 'smart_renew_unavailable', pdfReady: false },
    legacy: capabilityRegistry.snapshot({
      upstreamReady,
      upstreamError,
      health
    })
  };
}

function projectDataByType(items, type) {
  return items.filter((item) => item?.dataType === type || item?.type === type);
}

function markSpatialStaleness(runs, project, issues) {
  const issueMap = new Map(issues.map((issue) => [String(issue.id), issue]));
  return runs.map((run) => {
    const reasons = [];
    const snapshot = run.sourceSnapshot || {};
    if (
      snapshot.boundaryUpdatedAt
      && String(snapshot.boundaryUpdatedAt) !== String(project.boundaryUpdatedAt || '')
    ) reasons.push('PROJECT_BOUNDARY_CHANGED');
    if (Number(snapshot.officialIssueCount) !== issues.length) reasons.push('OFFICIAL_ISSUE_SET_CHANGED');
    for (const reference of snapshot.issueRevisions || []) {
      const current = issueMap.get(String(reference.id));
      if (!current) {
        reasons.push('OFFICIAL_ISSUE_REMOVED');
        continue;
      }
      if (reference.updatedAt && String(reference.updatedAt) !== String(current.updatedAt || '')) {
        reasons.push('OFFICIAL_ISSUE_CHANGED');
      }
    }
    return reasons.length
      ? { ...run, status: 'stale', staleReasons: [...new Set(reasons)] }
      : run;
  });
}

export function markAnalysisStaleness(jobs, photos) {
  const photoMap = new Map(photos.map((photo) => [String(photo.id), photo]));
  return jobs.map((job) => {
    if (!Array.isArray(job.photoSnapshot) || !job.photoSnapshot.length) return job;
    const reasons = [];
    for (const reference of job.photoSnapshot) {
      const current = photoMap.get(String(reference.id));
      if (!current) {
        reasons.push('PHOTO_REMOVED');
        continue;
      }
      if (current.governanceStatus === 'inactive') reasons.push('PHOTO_INACTIVE');
      if (
        reference.metadataRevision !== undefined
        && Number(reference.metadataRevision) !== Number(current.metadataRevision || 0)
      ) reasons.push('PHOTO_METADATA_CHANGED');
      if (
        reference.contentHash
        && current.contentHash
        && String(reference.contentHash) !== String(current.contentHash)
      ) reasons.push('PHOTO_CONTENT_CHANGED');
    }
    return reasons.length
      ? { ...job, status: 'stale', staleReasons: [...new Set(reasons)] }
      : job;
  });
}

export function markReportStaleness(reports, project, issues, spatialAnalyses, photos = []) {
  const issueMap = new Map(issues.map((issue) => [String(issue.id), issue]));
  const currentSpatialIds = new Set(spatialAnalyses.filter((run) => run.status !== 'stale').map((run) => String(run.id)));
  const currentPhotoMap = new Map(
    photos
      .filter((photo) => photo.governanceStatus !== 'inactive')
      .map((photo) => [String(photo.id), photo])
  );
  return reports.map((report) => {
    const reasons = [];
    if (
      report.projectSnapshot?.revision !== undefined
      && Number(report.projectSnapshot.revision) !== Number(project.revision || 0)
    ) reasons.push('PROJECT_CHANGED');
    for (const reference of report.dataSnapshot?.issueRevisions || []) {
      const current = issueMap.get(String(reference.id));
      if (!current) {
        reasons.push('OFFICIAL_ISSUE_REMOVED');
        continue;
      }
      if (reference.updatedAt && String(reference.updatedAt) !== String(current.updatedAt || '')) {
        reasons.push('OFFICIAL_ISSUE_CHANGED');
      }
    }
    const reportSpatialIds = new Set((report.dataSnapshot?.spatialAnalysisIds || []).map(String));
    if (
      reportSpatialIds.size !== currentSpatialIds.size
      || [...currentSpatialIds].some((id) => !reportSpatialIds.has(id))
    ) reasons.push('SPATIAL_ANALYSIS_CHANGED');
    const photoRevisions = report.dataSnapshot?.photoRevisions || [];
    if (photoRevisions.length) {
      const snapshotPhotoIds = new Set(photoRevisions.map((item) => String(item.id)));
      if (
        snapshotPhotoIds.size !== currentPhotoMap.size
        || [...currentPhotoMap.keys()].some((id) => !snapshotPhotoIds.has(id))
      ) reasons.push('PHOTO_SET_CHANGED');
      for (const reference of photoRevisions) {
        const current = currentPhotoMap.get(String(reference.id));
        if (!current) {
          reasons.push('PHOTO_REMOVED_OR_INACTIVE');
          continue;
        }
        if (Number(reference.metadataRevision || 0) !== Number(current.metadataRevision || 0)) {
          reasons.push('PHOTO_METADATA_CHANGED');
        }
        if (
          reference.contentHash
          && current.contentHash
          && String(reference.contentHash) !== String(current.contentHash)
        ) reasons.push('PHOTO_CONTENT_CHANGED');
      }
    }
    return reasons.length
      ? { ...report, status: 'stale', staleReasons: [...new Set(reasons)] }
      : report;
  });
}

export async function getProjectWorkflow(
  client,
  projectId,
  issueRepository = null,
  reportRepository = null,
  analysisJobRepository = null,
  uploadSessionRepository = null,
  reviewSessionRepository = null,
  spatialAnalysisRepository = null,
  photoMetadataRepository = null,
  sourceAssetRepository = null
) {
  const [project, collections, capabilities, businessIssues, businessReports, analysisJobs, uploadSessions, reviewConclusions, businessSpatialAnalyses, photoMetadata, businessAssets] = await Promise.all([
    client.getProject(projectId),
    client.projectCollections(projectId),
    getCapabilities(client),
    issueRepository ? issueRepository.list(projectId) : [],
    reportRepository ? reportRepository.list(projectId) : [],
    analysisJobRepository ? analysisJobRepository.list(projectId) : [],
    uploadSessionRepository ? uploadSessionRepository.list(projectId) : [],
    reviewSessionRepository ? reviewSessionRepository.list(projectId) : [],
    spatialAnalysisRepository ? spatialAnalysisRepository.list(projectId) : [],
    photoMetadataRepository ? photoMetadataRepository.list(projectId) : [],
    sourceAssetRepository ? sourceAssetRepository.list(projectId) : []
  ]);

  const projectData = collections.projectData.items;
  const officialIssues = mergePrimaryReadModel('officialIssue', {
    businessItems: businessIssues,
    legacyItems: collections.issues.items
  });
  const rawSpatialAnalyses = [...projectDataByType(projectData, 'spatialAnalysis'), ...businessSpatialAnalyses];
  const spatialAnalyses = markSpatialStaleness(rawSpatialAnalyses, project, officialIssues);
  const governedPhotosAll = mergePhotoMetadata(collections.photos.items, photoMetadata, true);
  const governedAssets = [
    ...projectDataByType(projectData, 'sourceAsset'),
    ...businessAssets.filter((item) => item.status === 'active' && item.uploadStatus === 'completed')
  ];
  const staleAwareJobs = markAnalysisStaleness(analysisJobs, governedPhotosAll);
  const staleJobsByAnalysisId = new Map(
    staleAwareJobs
      .filter((job) => job.status === 'stale' && job.analysisId)
      .map((job) => [String(job.analysisId), job])
  );
  const reports = markReportStaleness(
    mergePrimaryReadModel('report', {
      businessItems: businessReports,
      legacyItems: collections.reports.items
    }),
    project,
    officialIssues,
    spatialAnalyses,
    governedPhotosAll
  );
  const workflowAnalyses = [
    ...collections.analyses.items.map((analysis) => {
      const staleJob = staleJobsByAnalysisId.get(String(analysis.id));
      return staleJob
        ? { ...analysis, status: 'stale', staleReasons: staleJob.staleReasons, analysisJobId: staleJob.id }
        : analysis;
    }),
    ...staleAwareJobs.filter((job) =>
      ['queued', 'running', 'failed', 'canceled'].includes(job.status)
      || (job.status === 'stale' && !job.analysisId)
    )
  ];
  const governedPhotos = governedPhotosAll.filter((photo) => photo.governanceStatus !== 'inactive');
  const collectionValidation = assessCollection({
    projectId,
    project,
    photos: governedPhotos,
    uploadSessions,
    assets: governedAssets,
    fieldRecords: collections.fieldRecords.items
  });
  const workflow = buildWorkflow({
    projectId,
    project,
    photos: governedPhotos,
    assets: governedAssets,
    fieldRecords: collections.fieldRecords.items,
    analyses: workflowAnalyses,
    uploadSessions,
    reviewConclusions,
    officialIssues,
    spatialAnalyses,
    indicatorRuns: projectDataByType(projectData, 'indicatorResult'),
    reports,
    collectionValidation,
    capabilities,
    standardIndicatorCount: 61
  });

  workflow.sources = {
    photos: collections.photos.available,
    analyses: collections.analyses.available,
    officialIssues: issueRepository ? true : collections.issues.available,
    reports: collections.reports.available,
    fieldRecords: collections.fieldRecords.available,
    projectData: collections.projectData.available
  };
  return workflow;
}

export async function getProjectSummary(
  client,
  projectId,
  issueRepository = null,
  reportRepository = null,
  analysisJobRepository = null,
  uploadSessionRepository = null,
  reviewSessionRepository = null,
  spatialAnalysisRepository = null,
  photoMetadataRepository = null,
  sourceAssetRepository = null
) {
  const [project, collections, capabilities, businessIssues, businessReports, analysisJobs, uploadSessions, reviewConclusions, businessSpatialAnalyses, photoMetadata, businessAssets] = await Promise.all([
    client.getProject(projectId),
    client.projectCollections(projectId),
    getCapabilities(client),
    issueRepository ? issueRepository.list(projectId) : [],
    reportRepository ? reportRepository.list(projectId) : [],
    analysisJobRepository ? analysisJobRepository.list(projectId) : [],
    uploadSessionRepository ? uploadSessionRepository.list(projectId) : [],
    reviewSessionRepository ? reviewSessionRepository.list(projectId) : [],
    spatialAnalysisRepository ? spatialAnalysisRepository.list(projectId) : [],
    photoMetadataRepository ? photoMetadataRepository.list(projectId) : [],
    sourceAssetRepository ? sourceAssetRepository.list(projectId) : []
  ]);
  const officialIssues = mergePrimaryReadModel('officialIssue', {
    businessItems: businessIssues,
    legacyItems: collections.issues.items
  });
  const reports = mergePrimaryReadModel('report', {
    businessItems: businessReports,
    legacyItems: collections.reports.items
  });
  const governedPhotos = mergePhotoMetadata(collections.photos.items, photoMetadata);
  const collectionValidation = assessCollection({
    projectId,
    project,
    photos: governedPhotos,
    uploadSessions,
    assets: [
      ...projectDataByType(collections.projectData.items, 'sourceAsset'),
      ...businessAssets.filter((item) => item.status === 'active' && item.uploadStatus === 'completed')
    ],
    fieldRecords: collections.fieldRecords.items
  });
  return {
    project,
    collectionValidation,
    counts: {
      photos: governedPhotos.length,
      assets: projectDataByType(collections.projectData.items, 'sourceAsset').length
        + businessAssets.filter((item) => item.status === 'active' && item.uploadStatus === 'completed').length,
      analyses: analysisJobs.length || collections.analyses.items.length,
      uploadSessions: uploadSessions.length,
      reviewConclusions: reviewConclusions.length,
      spatialAnalyses: businessSpatialAnalyses.length + projectDataByType(collections.projectData.items, 'spatialAnalysis').length,
      officialIssues: officialIssues.length,
      reports: reports.length,
      fieldRecords: collections.fieldRecords.items.length,
      projectData: collections.projectData.items.length
    },
    capabilities
  };
}
