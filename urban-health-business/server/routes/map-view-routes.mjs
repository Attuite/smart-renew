import { getProjectMapView } from '../services/map-view-service.mjs';
import { ensureProjectDisplayTransforms } from '../services/coordinate-transform-service.mjs';

function queryObject(url) {
  const query = Object.fromEntries(url.searchParams.entries());
  const maximum = Math.max(
    100,
    Math.min(5000, Number(process.env.GIS_MAX_VIEW_FEATURES) || 5000)
  );
  const requestedLimit = Number(query.limit);
  return {
    ...query,
    limit: Number.isFinite(requestedLimit) ? Math.min(requestedLimit, maximum) : maximum,
    includePhotos: query.includePhotos !== 'false',
    includeRoutes: query.includeRoutes !== 'false'
  };
}

export async function handleMapViewRoutes(context) {
  const {
    req,
    res,
    url,
    requestId,
    sendSuccess,
    dependencies
  } = context;
  const transformMatch = url.pathname.match(
    /^\/api\/projects\/([^/]+)\/map-view\/display-transforms$/
  );
  if (transformMatch && req.method === 'POST') {
    const projectId = decodeURIComponent(transformMatch[1]);
    const identity = context.authorize?.('gis.boundary.edit', projectId);
    const input = await context.readJsonBody(req);
    const outcome = await ensureProjectDisplayTransforms(
      dependencies,
      projectId,
      {
        ...input,
        transformedBy: context.accountableActor?.(identity, input.transformedBy)
          || input.transformedBy
      }
    );
    sendSuccess(res, outcome, requestId, 201);
    return true;
  }
  const match = url.pathname.match(/^\/api\/projects\/([^/]+)\/map-view$/);
  if (match && req.method === 'GET') {
    const projectId = decodeURIComponent(match[1]);
    context.authorize?.('gis.view', projectId);
    const view = await getProjectMapView(dependencies, projectId, queryObject(url));
    sendSuccess(res, view, requestId);
    return true;
  }
  return false;
}
