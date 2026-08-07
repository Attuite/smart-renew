import { mergePhotoMetadata } from '../services/photo-metadata-service.mjs';
import {
  cleanSurveyRoute,
  createSurveyRoute,
  detectSurveyStops,
  markPhotoRouteBindingStaleness,
  markSurveyStopStaleness,
  reviewPhotoRouteBinding,
  reviewSurveyStop,
  suggestPhotoRouteBindings,
  updateSurveyRoute
} from '../services/survey-route-service.mjs';
import { importSurveyRouteFromSourceAsset } from '../services/survey-route-import-service.mjs';

function decode(value) {
  return decodeURIComponent(value);
}

function responseWindow(items, searchParams) {
  const status = searchParams.get('status') || '';
  const filtered = status
    ? items.filter((item) => String(item.status) === status)
    : items;
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0);
  const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit')) || 100));
  return filtered.slice(offset, offset + limit);
}

export async function handleSurveyRouteRoutes(context) {
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
  const {
    client,
    photoMetadataRepository,
    surveyRouteRepository,
    surveyStopRepository,
    photoRouteBindingRepository,
    sourceAssetRepository
  } = dependencies;
  const actor = (identity, value) => accountableActor?.(identity, value) || value;

  const projectRoutesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/survey-routes$/);
  if (projectRoutesMatch && req.method === 'GET') {
    const projectId = decode(projectRoutesMatch[1]);
    authorize?.('gis.view', projectId);
    sendSuccess(res, {
      items: await surveyRouteRepository.list(projectId, {
        status: url.searchParams.get('status') || '',
        offset: url.searchParams.get('offset'),
        limit: url.searchParams.get('limit')
      })
    }, requestId);
    return true;
  }
  if (projectRoutesMatch && req.method === 'POST') {
    const projectId = decode(projectRoutesMatch[1]);
    const input = await readJsonBody(req);
    const identity = authorize?.('gis.route.manage', projectId);
    input.createdBy = actor(identity, input.createdBy);
    const item = input?.sourceAssetId
      ? await importSurveyRouteFromSourceAsset(
          client,
          sourceAssetRepository,
          surveyRouteRepository,
          projectId,
          input
        )
      : await createSurveyRoute(client, surveyRouteRepository, projectId, input);
    sendSuccess(res, { item }, requestId, 201);
    return true;
  }

  const routeDetailMatch = url.pathname.match(/^\/api\/survey-routes\/([^/]+)$/);
  if (routeDetailMatch && req.method === 'GET') {
    const item = await surveyRouteRepository.get(decode(routeDetailMatch[1]));
    if (!item) {
      const error = new Error('踏勘路线不存在。');
      error.status = 404;
      error.code = 'SURVEY_ROUTE_NOT_FOUND';
      throw error;
    }
    authorize?.('gis.view', item.projectId);
    sendSuccess(res, { item }, requestId);
    return true;
  }
  if (routeDetailMatch && req.method === 'PATCH') {
    const routeId = decode(routeDetailMatch[1]);
    const route = await surveyRouteRepository.get(routeId);
    const identity = authorize?.('gis.route.manage', route?.projectId);
    const input = await readJsonBody(req);
    const item = await updateSurveyRoute(
      surveyRouteRepository,
      routeId,
      { ...input, updatedBy: actor(identity, input.updatedBy) }
    );
    sendSuccess(res, { item }, requestId);
    return true;
  }

  const routeCleanMatch = url.pathname.match(/^\/api\/survey-routes\/([^/]+)\/clean$/);
  if (routeCleanMatch && req.method === 'POST') {
    const routeId = decode(routeCleanMatch[1]);
    const route = await surveyRouteRepository.get(routeId);
    const identity = authorize?.('gis.route.manage', route?.projectId);
    const input = await readJsonBody(req);
    const item = await cleanSurveyRoute(
      surveyRouteRepository,
      routeId,
      { ...input, cleanedBy: actor(identity, input.cleanedBy) }
    );
    sendSuccess(res, { item }, requestId);
    return true;
  }

  const routeStopsMatch = url.pathname.match(/^\/api\/survey-routes\/([^/]+)\/stops$/);
  if (routeStopsMatch && req.method === 'GET') {
    const routeId = decode(routeStopsMatch[1]);
    const route = await surveyRouteRepository.get(routeId);
    authorize?.('gis.view', route?.projectId);
    const stops = await surveyStopRepository.list('', routeId, { limit: 500 });
    sendSuccess(res, {
      items: responseWindow(markSurveyStopStaleness(stops, route), url.searchParams)
    }, requestId);
    return true;
  }
  const routeStopDetectMatch = url.pathname.match(
    /^\/api\/survey-routes\/([^/]+)\/stops\/detect$/
  );
  if (routeStopDetectMatch && req.method === 'POST') {
    const routeId = decode(routeStopDetectMatch[1]);
    const route = await surveyRouteRepository.get(routeId);
    const identity = authorize?.('gis.route.manage', route?.projectId);
    const input = await readJsonBody(req);
    const items = await detectSurveyStops(
      surveyRouteRepository,
      surveyStopRepository,
      routeId,
      { ...input, detectedBy: actor(identity, input.detectedBy) }
    );
    sendSuccess(res, { items }, requestId, 201);
    return true;
  }

  const stopReviewMatch = url.pathname.match(/^\/api\/survey-stops\/([^/]+)$/);
  if (stopReviewMatch && req.method === 'PATCH') {
    const stopId = decode(stopReviewMatch[1]);
    const stop = await surveyStopRepository.get(stopId);
    const identity = authorize?.('gis.route.manage', stop?.projectId);
    const input = await readJsonBody(req);
    const item = await reviewSurveyStop(
      surveyStopRepository,
      stopId,
      { ...input, confirmedBy: actor(identity, input.confirmedBy) }
    );
    sendSuccess(res, { item }, requestId);
    return true;
  }

  const routeBindingsMatch = url.pathname.match(
    /^\/api\/survey-routes\/([^/]+)\/photo-bindings$/
  );
  if (routeBindingsMatch && req.method === 'GET') {
    const routeId = decode(routeBindingsMatch[1]);
    const route = await surveyRouteRepository.get(routeId);
    authorize?.('gis.view', route?.projectId);
    const [bindings, photos, metadata] = await Promise.all([
      photoRouteBindingRepository.list('', routeId, { limit: 500 }),
      client.listPhotos({ projectId: route?.projectId }),
      photoMetadataRepository.list(route?.projectId || '')
    ]);
    const currentPhotos = mergePhotoMetadata(photos.items, metadata, true);
    sendSuccess(res, {
      items: responseWindow(
        markPhotoRouteBindingStaleness(bindings, route, currentPhotos),
        url.searchParams
      )
    }, requestId);
    return true;
  }
  const routeBindingSuggestMatch = url.pathname.match(
    /^\/api\/survey-routes\/([^/]+)\/photo-bindings\/suggest$/
  );
  if (routeBindingSuggestMatch && req.method === 'POST') {
    const routeId = decode(routeBindingSuggestMatch[1]);
    const route = await surveyRouteRepository.get(routeId);
    if (!route) {
      const error = new Error('踏勘路线不存在。');
      error.status = 404;
      error.code = 'SURVEY_ROUTE_NOT_FOUND';
      throw error;
    }
    const identity = authorize?.('gis.route.manage', route.projectId);
    const [photos, metadata] = await Promise.all([
      client.listPhotos({ projectId: route.projectId }),
      photoMetadataRepository.list(route.projectId)
    ]);
    const sourcePhotos = mergePhotoMetadata(photos.items, metadata, false);
    const input = await readJsonBody(req);
    const items = await suggestPhotoRouteBindings(
      surveyRouteRepository,
      photoRouteBindingRepository,
      routeId,
      sourcePhotos,
      { ...input, suggestedBy: actor(identity, input.suggestedBy) }
    );
    sendSuccess(res, { items }, requestId, 201);
    return true;
  }

  const bindingReviewMatch = url.pathname.match(/^\/api\/photo-route-bindings\/([^/]+)$/);
  if (bindingReviewMatch && req.method === 'PATCH') {
    const bindingId = decode(bindingReviewMatch[1]);
    const binding = await photoRouteBindingRepository.get(bindingId);
    const identity = authorize?.('gis.route.manage', binding?.projectId);
    const input = await readJsonBody(req);
    const item = await reviewPhotoRouteBinding(
      photoRouteBindingRepository,
      bindingId,
      { ...input, confirmedBy: actor(identity, input.confirmedBy) }
    );
    sendSuccess(res, { item }, requestId);
    return true;
  }
  return false;
}
