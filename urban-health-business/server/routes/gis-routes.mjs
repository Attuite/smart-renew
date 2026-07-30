import {
  coordinateTransformCapability,
  createCoordinateTransform
} from '../services/coordinate-transform-service.mjs';
import {
  batchReviewPois,
  hydratePoiReviewRun,
  reviewPoi
} from '../services/poi-review-service.mjs';
import { batchUpdatePhotoMetadata } from '../services/photo-metadata-batch-service.mjs';
import { mergePhotoMetadata, updatePhotoMetadata } from '../services/photo-metadata-service.mjs';
import { bindIssueGeometry } from '../services/spatial-binding-service.mjs';
import { sourceEvidencePhotos } from '../services/workflow-service.mjs';

export async function handleGisRoutes(context) {
  const {
    req,
    res,
    url,
    requestId,
    readJsonBody,
    sendSuccess,
    dependencies,
    authorize,
    accountableActor
  } = context;
  if (req.method === 'GET' && url.pathname === '/api/gis/coordinate-transforms/capability') {
    sendSuccess(res, coordinateTransformCapability(), requestId);
    return true;
  }
  if (req.method === 'POST' && url.pathname === '/api/gis/coordinate-transforms') {
    const input = await readJsonBody(req);
    const identity = authorize?.('gis.boundary.edit', input.projectId);
    const record = await createCoordinateTransform(
      dependencies.coordinateTransformRepository,
      {
        ...input,
        transformedBy: accountableActor?.(identity, input.transformedBy) || input.transformedBy
      }
    );
    sendSuccess(res, { item: record }, requestId, 201);
    return true;
  }
  const detailMatch = url.pathname.match(/^\/api\/gis\/coordinate-transforms\/([^/]+)$/);
  if (req.method === 'GET' && detailMatch) {
    const record = await dependencies.coordinateTransformRepository.get(
      decodeURIComponent(detailMatch[1])
    );
    if (!record) {
      const error = new Error('坐标转换记录不存在。');
      error.status = 404;
      error.code = 'COORDINATE_TRANSFORM_NOT_FOUND';
      throw error;
    }
    authorize?.('gis.audit.view', record.projectId);
    sendSuccess(res, { item: record }, requestId);
    return true;
  }
  const poiReviewMatch = url.pathname.match(
    /^\/api\/spatial-analyses\/([^/]+)\/pois\/([^/]+)$/
  );
  if (req.method === 'PATCH' && poiReviewMatch) {
    const runId = decodeURIComponent(poiReviewMatch[1]);
    const run = await dependencies.spatialAnalysisRepository.get(runId);
    const identity = authorize?.('gis.poi.review', run?.projectId);
    const input = await readJsonBody(req);
    const item = await reviewPoi(
      dependencies.spatialAnalysisRepository,
      runId,
      decodeURIComponent(poiReviewMatch[2]),
      {
        ...input,
        reviewedBy: accountableActor?.(identity, input.reviewedBy) || input.reviewedBy
      }
    );
    sendSuccess(res, { item }, requestId);
    return true;
  }
  const poiItemsMatch = url.pathname.match(/^\/api\/spatial-analyses\/([^/]+)\/pois$/);
  if (req.method === 'GET' && poiItemsMatch) {
    const run = await dependencies.spatialAnalysisRepository.get(
      decodeURIComponent(poiItemsMatch[1])
    );
    if (!run || run.type !== 'poi-search') {
      const error = new Error('POI分析运行不存在。');
      error.status = 404;
      error.code = 'POI_ANALYSIS_NOT_FOUND';
      throw error;
    }
    authorize?.('gis.view', run.projectId);
    const hydrated = hydratePoiReviewRun(run);
    sendSuccess(res, {
      items: hydrated.result?.items || [],
      status: hydrated.status,
      runId: hydrated.id
    }, requestId);
    return true;
  }
  const poiBatchReviewMatch = url.pathname.match(
    /^\/api\/spatial-analyses\/([^/]+)\/pois\/batch-review$/
  );
  if (req.method === 'POST' && poiBatchReviewMatch) {
    const runId = decodeURIComponent(poiBatchReviewMatch[1]);
    const run = await dependencies.spatialAnalysisRepository.get(runId);
    const identity = authorize?.('gis.poi.review', run?.projectId);
    const input = await readJsonBody(req);
    const items = await batchReviewPois(
      dependencies.spatialAnalysisRepository,
      runId,
      {
        ...input,
        reviewedBy: accountableActor?.(identity, input.reviewedBy) || input.reviewedBy
      }
    );
    sendSuccess(res, { items }, requestId);
    return true;
  }
  const issueGeometryRevisionsMatch = url.pathname.match(
    /^\/api\/issues\/([^/]+)\/geometry-revisions$/
  );
  if (req.method === 'GET' && issueGeometryRevisionsMatch) {
    const issue = await dependencies.issueRepository.get(
      decodeURIComponent(issueGeometryRevisionsMatch[1])
    );
    if (!issue) {
      const error = new Error('正式问题不存在。');
      error.status = 404;
      error.code = 'OFFICIAL_ISSUE_NOT_FOUND';
      throw error;
    }
    authorize?.('gis.audit.view', issue.projectId);
    sendSuccess(res, {
      items: Array.isArray(issue.geometryAudit) ? [...issue.geometryAudit].reverse() : [],
      geometryRevision: Number(issue.geometryRevision) || 0
    }, requestId);
    return true;
  }
  const issueBatchMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/issues\/geometry-batch-confirm$/
  );
  if (req.method === 'POST' && issueBatchMatch) {
    const projectId = decodeURIComponent(issueBatchMatch[1]);
    const identity = authorize?.('gis.issue.geometry.edit', projectId);
    const input = await readJsonBody(req);
    input.confirmedBy = accountableActor?.(identity, input.confirmedBy) || input.confirmedBy;
    const items = Array.isArray(input?.items) ? input.items : [];
    if (!items.length || items.length > 200) {
      const error = new Error('问题点位批量确认每次必须包含1到200条记录。');
      error.status = 400;
      error.code = 'ISSUE_GEOMETRY_BATCH_SIZE_INVALID';
      throw error;
    }
    const results = [];
    for (const item of items) {
      try {
        const issue = await dependencies.issueRepository.get(item?.issueId);
        if (!issue || String(issue.projectId) !== String(projectId)) {
          const error = new Error('正式问题不属于当前项目。');
          error.code = 'OFFICIAL_ISSUE_PROJECT_MISMATCH';
          throw error;
        }
        const updated = await bindIssueGeometry(
          dependencies.client,
          dependencies.issueRepository,
          item.issueId,
          {
            ...item,
            confirmedBy: input.confirmedBy || item.confirmedBy
          }
        );
        results.push({
          issueId: String(item.issueId),
          status: 'updated',
          geometryRevision: updated.geometryRevision
        });
      } catch (error) {
        results.push({
          issueId: String(item?.issueId || ''),
          status: 'failed',
          error: { code: error.code || 'ISSUE_GEOMETRY_BATCH_ITEM_FAILED', message: error.message }
        });
      }
    }
    const succeeded = results.filter((item) => item.status === 'updated').length;
    sendSuccess(res, {
      projectId,
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      results
    }, requestId, succeeded === results.length ? 200 : 207);
    return true;
  }
  const photoMapPointsMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/photos\/map-points$/
  );
  if (req.method === 'GET' && photoMapPointsMatch) {
    const projectId = decodeURIComponent(photoMapPointsMatch[1]);
    authorize?.('gis.view', projectId);
    const [photos, metadata, uploadSessions] = await Promise.all([
      dependencies.client.listPhotos({ projectId }),
      dependencies.photoMetadataRepository.list(projectId),
      dependencies.uploadSessionRepository.list(projectId)
    ]);
    const items = sourceEvidencePhotos(
      mergePhotoMetadata(photos.items, metadata, false),
      uploadSessions
    )
      .filter((photo) => Array.isArray(photo.coordinates))
      .map((photo) => ({
        id: String(photo.id),
        name: photo.name || '',
        coordinates: photo.coordinates,
        crs: photo.coordinateCrs || 'WGS84',
        coordinateSource: photo.coordinateSource || 'legacy',
        capturedAt: photo.capturedAt || null,
        communityId: photo.communityId || null,
        communityName: photo.communityName || '',
        buildingId: photo.buildingId || null,
        buildingName: photo.buildingName || '',
        metadataRevision: Number(photo.metadataRevision) || 0
      }));
    sendSuccess(res, { items, total: items.length }, requestId);
    return true;
  }
  const photoGeometryMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/photos\/([^/]+)\/geometry$/
  );
  if (req.method === 'PATCH' && photoGeometryMatch) {
    const projectId = decodeURIComponent(photoGeometryMatch[1]);
    const identity = authorize?.('gis.photo.geometry.edit', projectId);
    const input = await readJsonBody(req);
    const item = await updatePhotoMetadata(
      dependencies.client,
      dependencies.photoMetadataRepository,
      projectId,
      decodeURIComponent(photoGeometryMatch[2]),
      {
        ...input,
        coordinateSource: 'manual-map',
        updatedBy: accountableActor?.(identity, input.updatedBy) || input.updatedBy
      }
    );
    sendSuccess(res, { item }, requestId);
    return true;
  }
  const photoGeometryBatchMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/photos\/geometry-batch$/
  );
  if (req.method === 'POST' && photoGeometryBatchMatch) {
    const projectId = decodeURIComponent(photoGeometryBatchMatch[1]);
    const identity = authorize?.('gis.photo.geometry.edit', projectId);
    const input = await readJsonBody(req);
    const outcome = await batchUpdatePhotoMetadata(
      dependencies.client,
      dependencies.photoMetadataRepository,
      projectId,
      {
        ...input,
        updatedBy: accountableActor?.(identity, input.updatedBy) || input.updatedBy
      }
    );
    sendSuccess(res, outcome, requestId, outcome.failed ? 207 : 200);
    return true;
  }
  return false;
}
