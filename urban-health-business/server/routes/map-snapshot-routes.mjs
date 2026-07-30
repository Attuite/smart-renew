import {
  createMapSnapshot,
  markMapSnapshotStaleness,
  retryMapSnapshot
} from '../services/map-snapshot-service.mjs';
import { getProjectMapView } from '../services/map-view-service.mjs';

export async function handleMapSnapshotRoutes(context) {
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
  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/map-snapshots$/);
  if (projectMatch && req.method === 'GET') {
    const projectId = decodeURIComponent(projectMatch[1]);
    authorize?.('gis.view', projectId);
    const [items, currentView] = await Promise.all([
      dependencies.mapSnapshotRepository.list(
        projectId,
        url.searchParams.get('reportId') || '',
        {
          status: url.searchParams.get('status') || '',
          offset: url.searchParams.get('offset'),
          limit: url.searchParams.get('limit')
        }
      ),
      getProjectMapView(dependencies.mapViewDependencies, projectId, {
        limit: 5000
      })
    ]);
    sendSuccess(res, {
      items: markMapSnapshotStaleness(items, currentView)
    }, requestId);
    return true;
  }
  if (projectMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(projectMatch[1]);
    const identity = authorize?.('gis.map_snapshot.create', projectId);
    const input = await readJsonBody(req);
    const item = await createMapSnapshot(
      dependencies,
      projectId,
      {
        ...input,
        createdBy: accountableActor?.(identity, input.createdBy) || input.createdBy
      }
    );
    sendSuccess(res, { item }, requestId, 201);
    return true;
  }
  const detailMatch = url.pathname.match(/^\/api\/map-snapshots\/([^/]+)$/);
  if (detailMatch && req.method === 'GET') {
    const item = await dependencies.mapSnapshotRepository.get(
      decodeURIComponent(detailMatch[1])
    );
    if (!item) {
      const error = new Error('地图快照不存在。');
      error.status = 404;
      error.code = 'MAP_SNAPSHOT_NOT_FOUND';
      throw error;
    }
    authorize?.('gis.view', item.projectId);
    sendSuccess(res, { item }, requestId);
    return true;
  }
  const retryMatch = url.pathname.match(/^\/api\/map-snapshots\/([^/]+)\/retry$/);
  if (retryMatch && req.method === 'POST') {
    const snapshotId = decodeURIComponent(retryMatch[1]);
    const existing = await dependencies.mapSnapshotRepository.get(snapshotId);
    if (!existing) {
      const error = new Error('地图快照不存在。');
      error.status = 404;
      error.code = 'MAP_SNAPSHOT_NOT_FOUND';
      throw error;
    }
    const identity = authorize?.('gis.map_snapshot.create', existing.projectId);
    const input = await readJsonBody(req);
    const item = await retryMapSnapshot(dependencies, snapshotId, {
      createdBy: accountableActor?.(identity, input.createdBy) || input.createdBy
    });
    sendSuccess(res, { item }, requestId);
    return true;
  }
  const contentMatch = url.pathname.match(/^\/api\/map-snapshots\/([^/]+)\/content$/);
  if (contentMatch && req.method === 'GET') {
    const snapshotId = decodeURIComponent(contentMatch[1]);
    const item = await dependencies.mapSnapshotRepository.get(snapshotId);
    if (item) authorize?.('gis.view', item.projectId);
    const content = item?.status === 'generated'
      ? await dependencies.mapSnapshotRepository.readContent(snapshotId)
      : null;
    if (!item || !content) {
      const error = new Error('地图快照内容不存在或尚未生成。');
      error.status = 404;
      error.code = 'MAP_SNAPSHOT_CONTENT_NOT_FOUND';
      throw error;
    }
    const bytes = Buffer.from(content, 'utf8');
    res.writeHead(200, {
      'content-type': 'image/svg+xml; charset=utf-8',
      'content-length': bytes.length,
      'cache-control': 'private, max-age=3600',
      etag: `"${item.contentHash}"`,
      'x-request-id': requestId
    });
    res.end(bytes);
    return true;
  }
  return false;
}
