import {
  createSpatialFeature,
  crsCompatibility,
  normalizeCrs,
  normalizeGeometry,
  parseSpatialBounds,
  positionInBounds,
  SPATIAL_SCHEMA_VERSION
} from '../../packages/api-contracts/spatial.mjs';
import { mergePrimaryReadModel } from '../adapters/smart-renew/read-model-policy.mjs';
import { mergePhotoMetadata } from './photo-metadata-service.mjs';
import {
  markSpatialStaleness,
  sourceEvidencePhotos
} from './workflow-service.mjs';
import { hydratePoiReviewRun } from './poi-review-service.mjs';
import { markSurveyStopStaleness } from './survey-route-service.mjs';
import { pointInBoundaryGeometry } from './spatial-geometry-service.mjs';

function boundedLimit(value, fallback = 1000, maximum = 5000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(parsed)));
}

function legacyBoundaryGeometry(project) {
  if (project?.scopeBoundaryGeometry) {
    return normalizeGeometry(project.scopeBoundaryGeometry, { closeRings: true });
  }
  if (!Array.isArray(project?.scopeBoundary) || project.scopeBoundary.length < 3) return null;
  return normalizeGeometry(
    { type: 'Polygon', coordinates: [project.scopeBoundary] },
    { closeRings: true }
  );
}

function issueBindingStatus(issue) {
  if (!issue?.geometry) return 'unlocated';
  if (issue?.spatialBinding?.status === 'pending' || issue?.bindingStatus === 'pending') return 'pending';
  return 'located';
}

function issueMatches(issue, query, bounds) {
  if (issue.status === 'deleted') return false;
  const issueStatus = String(issue.status || 'active');
  const stale = issueStatus === 'stale' || Boolean(issue.staleReasons?.length);
  if (query.issueStatus) {
    if (issueStatus !== String(query.issueStatus)) return false;
  } else if (issueStatus === 'inactive') {
    return false;
  }
  if (query.staleStatus === 'stale' && !stale) return false;
  if (query.staleStatus === 'current' && stale) return false;
  if (query.issueRisk && String(issue.severity) !== String(query.issueRisk)) return false;
  if (
    query.issueType
    && ![issue.categoryCode, issue.categoryName].some((value) => String(value || '') === String(query.issueType))
  ) return false;
  const bindingStatus = issueBindingStatus(issue);
  if (query.bindingStatus && bindingStatus !== query.bindingStatus) return false;
  const search = String(query.search || '').trim().toLowerCase();
  if (search && ![
    issue.id,
    issue.title,
    issue.categoryCode,
    issue.categoryName,
    issue.communityName,
    issue.buildingName,
    issue.originalPhotoId
  ].some((value) => String(value || '').toLowerCase().includes(search))) return false;
  if (bounds && issue?.geometry?.type === 'Point' && !positionInBounds(issue.geometry.coordinates, bounds)) {
    return false;
  }
  return !bounds || issue?.geometry?.type === 'Point';
}

function issueFeature(issue) {
  if (!issue?.geometry) return null;
  try {
    return createSpatialFeature({
      id: issue.id,
      kind: 'official-issue',
      geometry: issue.geometry,
      crs: issue.geometryCrs || issue.spatialBinding?.crs || 'WGS84',
      revision: issue.geometryRevision,
      properties: {
        title: issue.title || '',
        categoryCode: issue.categoryCode || '',
        categoryName: issue.categoryName || '',
        severity: issue.severity || 'unknown',
        status: issue.status || 'active',
        bindingStatus: issueBindingStatus(issue),
        stale: issue.status === 'stale' || Boolean(issue.staleReasons?.length),
        communityName: issue.communityName || '',
        buildingName: issue.buildingName || '',
        source: issue.source || issue.sourceType || '',
        evidence: String(issue.evidence || '').slice(0, 300),
        issueRevision: Number(issue.issueRevision) || 0,
        geometryRevision: Number(issue.geometryRevision) || 0
      }
    });
  } catch {
    return null;
  }
}

function photoFeature(photo) {
  if (!Array.isArray(photo?.coordinates)) return null;
  try {
    return createSpatialFeature({
      id: photo.id,
      kind: 'source-photo',
      geometry: { type: 'Point', coordinates: photo.coordinates },
      crs: photo.coordinateCrs || 'WGS84',
      revision: photo.metadataRevision,
      properties: {
        name: photo.name || '',
        communityId: photo.communityId || null,
        communityName: photo.communityName || '',
        buildingId: photo.buildingId || null,
        buildingName: photo.buildingName || '',
        capturedAt: photo.capturedAt || null,
        coordinateSource: photo.coordinateSource || 'legacy',
        governanceStatus: photo.governanceStatus || 'active'
      }
    });
  } catch {
    return null;
  }
}

function decimateLineCoordinates(coordinates, maximumPoints) {
  if (coordinates.length <= maximumPoints) return coordinates;
  const output = [];
  const lastIndex = coordinates.length - 1;
  for (let index = 0; index < maximumPoints; index += 1) {
    output.push(coordinates[Math.round(index * lastIndex / (maximumPoints - 1))]);
  }
  return output;
}

function linePointCount(geometry) {
  if (geometry?.type === 'LineString') return geometry.coordinates?.length || 0;
  if (geometry?.type === 'MultiLineString') {
    return (geometry.coordinates || []).reduce((total, line) => total + line.length, 0);
  }
  return 0;
}

function decimateLineGeometry(geometry, maximumPoints) {
  if (geometry?.type === 'LineString') {
    return {
      type: 'LineString',
      coordinates: decimateLineCoordinates(geometry.coordinates || [], maximumPoints)
    };
  }
  if (geometry?.type !== 'MultiLineString') return geometry;
  let lines = (geometry.coordinates || []).filter((line) => line.length >= 2);
  const maximumSegments = Math.max(1, Math.floor(maximumPoints / 2));
  if (lines.length > maximumSegments) {
    lines = decimateLineCoordinates(lines, maximumSegments);
  }
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  if (total <= maximumPoints) return { type: 'MultiLineString', coordinates: lines };
  const minimum = lines.length * 2;
  const distributable = Math.max(0, maximumPoints - minimum);
  const extraSource = Math.max(1, total - minimum);
  const coordinates = lines.map((line) => {
    const extra = Math.floor((line.length - 2) / extraSource * distributable);
    return decimateLineCoordinates(line, Math.max(2, Math.min(line.length, 2 + extra)));
  });
  return { type: 'MultiLineString', coordinates };
}

function routeFeature(route, maximumPoints = 2000) {
  if (!route?.geometry || (route.cleaning && !route.displayGeometry)) return null;
  try {
    const routeGeometry = route.displayGeometry || route.geometry;
    const sourcePointCount = linePointCount(routeGeometry);
    const geometry = decimateLineGeometry(routeGeometry, maximumPoints);
    return createSpatialFeature({
      id: route.id,
      kind: 'survey-route',
      geometry,
      crs: route.crs,
      revision: route.routeRevision,
      properties: {
        name: route.name || '',
        status: route.status || 'draft',
        sourcePointCount,
        displayPointCount: linePointCount(geometry),
        displaySegmentCount: geometry.type === 'MultiLineString'
          ? geometry.coordinates.length
          : 1,
        displaySimplified: linePointCount(geometry) < sourcePointCount,
        anomalies: (route.cleaning?.rejected || []).slice(0, 100)
          .filter((item) => Array.isArray(item.coordinates))
          .map((item) => ({
            index: Number(item.index),
            reason: item.reason || 'REJECTED_SAMPLE',
            coordinates: item.coordinates.slice(0, 2),
            capturedAt: item.capturedAt || null
          })),
        anomaliesTruncated: (route.cleaning?.rejected || []).length > 100
      }
    });
  } catch {
    return null;
  }
}

function stopFeature(stop) {
  if (!stop?.geometry) return null;
  try {
    return createSpatialFeature({
      id: stop.id,
      kind: 'survey-stop',
      geometry: stop.geometry,
      crs: stop.crs,
      revision: stop.revision,
      properties: {
        routeId: stop.routeId,
        status: stop.status || 'candidate',
        durationSeconds: Number(stop.durationSeconds) || 0
      }
    });
  } catch {
    return null;
  }
}

function boundaryRevisionFeature(revision) {
  if (!revision?.geometry || !revision?.id) return null;
  try {
    return createSpatialFeature({
      id: revision.id,
      kind: 'project-boundary-revision',
      geometry: revision.geometry,
      crs: revision.crs || 'WGS84',
      revision: revision.projectRevision,
      properties: {
        projectRevision: Number(revision.projectRevision) || 0,
        areaSqKm: Number(revision.areaSqKm) || 0,
        source: revision.source || '',
        updatedBy: revision.updatedBy || '',
        createdAt: revision.createdAt || null
      }
    }, { closeRings: true });
  } catch {
    return null;
  }
}

function withBoundaryStatus(feature, boundaryGeometry, boundaryCrs) {
  if (!feature || !boundaryGeometry || normalizeCrs(feature.crs) !== normalizeCrs(boundaryCrs)) {
    return feature;
  }
  const points = feature.geometry?.type === 'Point'
    ? [feature.geometry.coordinates]
    : feature.geometry?.type === 'LineString'
      ? feature.geometry.coordinates
      : feature.geometry?.type === 'MultiLineString'
        ? feature.geometry.coordinates.flat()
      : [];
  if (!points.length) return feature;
  const outsideBoundary = points.some((point) => !pointInBoundaryGeometry(point, boundaryGeometry));
  return {
    ...feature,
    properties: {
      ...feature.properties,
      outsideBoundary
    }
  };
}

function boundedFeatures(items, limit) {
  return {
    items: items.slice(0, limit),
    total: items.length,
    truncated: items.length > limit,
    limit
  };
}

function itemCoordinates(item) {
  if (Array.isArray(item?.coordinates)) return item.coordinates;
  if (item?.geometry?.type === 'Point') return item.geometry.coordinates;
  return null;
}

function boundedSpatialRun(run, bounds, limit) {
  const result = run?.result || {};
  const poiSource = Array.isArray(result.accepted)
    ? result.accepted
    : Array.isArray(result.items)
      ? result.items
      : [];
  const visiblePoi = poiSource.filter((item) => {
    const point = itemCoordinates(item);
    return point && (!bounds || positionInBounds(point, bounds));
  });
  const distances = (Array.isArray(result.distances) ? result.distances : []).filter((item) => {
    const point = itemCoordinates(item);
    return point && (!bounds || positionInBounds(point, bounds));
  });
  const boundedPoi = visiblePoi.slice(0, limit);
  const boundedDistances = distances.slice(0, limit);
  return {
    id: String(run.id),
    type: run.type || '',
    status: run.status || 'completed',
    parameters: run.parameters || {},
    result: {
      ...result,
      ...(Array.isArray(result.accepted) ? { accepted: boundedPoi } : {}),
      ...(Array.isArray(result.items) ? { items: boundedPoi } : {}),
      ...(distances.length ? { distances: boundedDistances } : {}),
      ...(Array.isArray(result.matchedIssueIds)
        ? { matchedIssueIds: result.matchedIssueIds.slice(0, limit) }
        : {}),
      mapItemTotal: visiblePoi.length,
      mapItemsTruncated: visiblePoi.length > limit,
      mapDistanceTotal: distances.length,
      mapDistancesTruncated: distances.length > limit,
      mapLimit: limit
    },
    completedAt: run.completedAt || null,
    staleReasons: Array.isArray(run.staleReasons) ? run.staleReasons : []
  };
}

function displayFeature(feature, transforms) {
  if (!feature) return feature;
  if (feature.crs === 'GCJ02') return { ...feature, displayReady: true };
  const record = (Array.isArray(transforms) ? transforms : []).find((item) =>
    item.targetCrs === 'GCJ02'
    && item.sourceCrs === feature.crs
    && String(item.sourceObject?.id || '') === String(feature.id)
    && (!item.sourceObject?.kind || item.sourceObject.kind === feature.kind)
    && Number(item.sourceObject?.revision || 0) === Number(feature.revision || 0)
  );
  if (!record?.transformedGeometry) return { ...feature, displayReady: false };
  return {
    ...feature,
    sourceGeometry: feature.geometry,
    sourceCrs: feature.crs,
    geometry: normalizeGeometry(record.transformedGeometry, { closeRings: true }),
    crs: 'GCJ02',
    coordinateTransformId: record.id,
    coordinateTransformMethod: record.method,
    coordinateTransformVersion: record.methodVersion,
    displayReady: true
  };
}

function simplifyDisplayedRoute(feature, maximumPoints) {
  if (!feature?.geometry || !['LineString', 'MultiLineString'].includes(feature.geometry.type)) {
    return feature;
  }
  const geometry = decimateLineGeometry(feature.geometry, maximumPoints);
  return {
    ...feature,
    geometry,
    properties: {
      ...feature.properties,
      displayPointCount: linePointCount(geometry),
      displaySegmentCount: geometry.type === 'MultiLineString'
        ? geometry.coordinates.length
        : 1,
      displaySimplified: linePointCount(geometry)
        < Number(feature.properties?.sourcePointCount || geometry.coordinates.length)
    }
  };
}

export function buildProjectMapView(input, query = {}) {
  const project = input?.project;
  if (!project?.id) {
    const error = new Error('项目不存在。');
    error.status = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  const limit = boundedLimit(query.limit, 1000, query.internalMaximum || 5000);
  const zoom = Number(query.zoom);
  const routeDisplayPointLimit = query.forTransform
    ? 100000
    : Number.isFinite(zoom) && zoom >= 17
      ? 5000
      : Number.isFinite(zoom) && zoom >= 14
        ? 2500
        : 1000;
  const bounds = parseSpatialBounds(query.bounds);
  const boundaryGeometry = legacyBoundaryGeometry(project);
  const projectCrs = normalizeCrs(
    project.scopeBoundaryCrs || project.boundaryCrs || (boundaryGeometry ? 'WGS84' : null),
    { required: Boolean(boundaryGeometry) }
  );
  const allIssues = Array.isArray(input.issues) ? input.issues : [];
  const filteredIssues = allIssues.filter((issue) => issueMatches(issue, query, bounds));
  const transforms = Array.isArray(input.coordinateTransforms) ? input.coordinateTransforms : [];
  const locatedIssueFeatures = filteredIssues
    .map(issueFeature)
    .filter(Boolean)
    .map((feature) => withBoundaryStatus(feature, boundaryGeometry, projectCrs))
    .map((feature) => displayFeature(feature, transforms));
  const unlocatedIssues = filteredIssues
    .filter((issue) => !issue?.geometry)
    .map((issue) => ({
      id: String(issue.id),
      title: issue.title || '',
      categoryCode: issue.categoryCode || '',
      categoryName: issue.categoryName || '',
      severity: issue.severity || 'unknown',
      bindingStatus: issueBindingStatus(issue),
      issueRevision: Number(issue.issueRevision) || 0
    }));
  const photoFeatures = (query.includePhotos === false ? [] : (input.photos || []))
    .map(photoFeature)
    .map((feature) => withBoundaryStatus(feature, boundaryGeometry, projectCrs))
    .map((feature) => displayFeature(feature, transforms))
    .filter((feature) =>
      feature
      && (!bounds || positionInBounds(feature.geometry.coordinates, bounds))
    );
  const routeFeatures = (query.includeRoutes === false ? [] : (input.routes || []))
    .map((route) => routeFeature(route, routeDisplayPointLimit))
    .map((feature) => withBoundaryStatus(feature, boundaryGeometry, projectCrs))
    .filter(Boolean);
  const stopFeatures = (query.includeRoutes === false ? [] : (input.stops || []))
    .map(stopFeature)
    .map((feature) => withBoundaryStatus(feature, boundaryGeometry, projectCrs))
    .filter(Boolean);
  const spatialRuns = (Array.isArray(input.spatialAnalyses) ? input.spatialAnalyses : [])
    .filter((run) => !query.spatialRunId || String(run.id) === String(query.spatialRunId))
    .map((run) => boundedSpatialRun(run, bounds, limit));
  const historicalBoundaryFeatures = (Array.isArray(input.boundaryRevisions)
    ? input.boundaryRevisions
    : [])
    .filter((revision) =>
      Number(revision.projectRevision) !== Number(project.revision)
    )
    .map(boundaryRevisionFeature)
    .filter(Boolean)
    .map((feature) => displayFeature(feature, transforms));
  const boundarySource = boundaryGeometry
    ? createSpatialFeature({
        id: String(project.id),
        kind: 'project-boundary',
        geometry: boundaryGeometry,
        crs: projectCrs,
        revision: project.revision,
        properties: {
          projectId: String(project.id),
          projectName: project.name || '',
          source: project.scopeBoundarySource || 'project',
          updatedAt: project.boundaryUpdatedAt || null
        }
      }, { closeRings: true })
    : null;
  const boundary = displayFeature(boundarySource, transforms);
  const displayedRoutes = routeFeatures
    .map((feature) => displayFeature(feature, transforms))
    .map((feature) => simplifyDisplayedRoute(feature, routeDisplayPointLimit));
  const displayedStops = stopFeatures.map((feature) => displayFeature(feature, transforms));
  const sourceCrs = [
    boundary?.crs,
    ...historicalBoundaryFeatures.map((feature) => feature.crs),
    ...locatedIssueFeatures.map((feature) => feature.crs),
    ...photoFeatures.map((feature) => feature.crs),
    ...displayedRoutes.map((feature) => feature.crs),
    ...displayedStops.map((feature) => feature.crs)
  ].filter(Boolean);
  const compatibility = crsCompatibility(sourceCrs, 'GCJ02');
  const pendingDisplayFeatures = [
    boundary,
    ...historicalBoundaryFeatures,
    ...locatedIssueFeatures,
    ...photoFeatures,
    ...displayedRoutes,
    ...displayedStops
  ].filter((feature) => feature && feature.displayReady === false);
  const boundaryDisplayReady = Boolean(boundary?.displayReady && boundary.crs === 'GCJ02');
  return {
    project: {
      id: String(project.id),
      name: project.name || '',
      revision: Number(project.revision) || 0
    },
    viewport: {
      requestedBounds: bounds,
      targetCrs: 'GCJ02'
    },
    boundary,
    boundaryHistory: boundedFeatures(historicalBoundaryFeatures, 20),
    issues: {
      ...boundedFeatures(locatedIssueFeatures, limit),
      unlocatedItems: unlocatedIssues.slice(0, limit),
      unlocatedTotal: unlocatedIssues.length,
      unlocatedTruncated: unlocatedIssues.length > limit
    },
    photos: boundedFeatures(photoFeatures, limit),
    routes: boundedFeatures(displayedRoutes, Math.min(limit, 500)),
    stops: boundedFeatures(displayedStops, limit),
    spatialAnalyses: {
      items: spatialRuns.slice(0, 100),
      total: spatialRuns.length,
      truncated: spatialRuns.length > 100,
      limit: 100
    },
    coordinateCompatibility: {
      ...compatibility,
      onlineMapOverlayReady: boundaryDisplayReady,
      pendingDisplayFeatureCount: pendingDisplayFeatures.length,
      pendingDisplayFeaturesTruncated: pendingDisplayFeatures.length > 100,
      pendingDisplayFeatures: pendingDisplayFeatures.slice(0, 100).map((feature) => ({
        id: feature.id,
        kind: feature.kind,
        crs: feature.crs,
        revision: feature.revision
      })),
      reason: !boundary
        ? 'PROJECT_BOUNDARY_MISSING'
        : boundaryDisplayReady
          ? null
          : 'COORDINATE_TRANSFORM_REQUIRED'
    },
    sourceRevisions: {
      projectRevision: Number(project.revision) || 0,
      issueRevisions: allIssues.map((issue) => ({
        id: String(issue.id),
        issueRevision: Number(issue.issueRevision) || 0,
        geometryRevision: Number(issue.geometryRevision) || 0
      })),
      photoRevisions: (input.photos || []).map((photo) => ({
        id: String(photo.id),
        metadataRevision: Number(photo.metadataRevision) || 0
      })),
      routeRevisions: (input.routes || []).map((route) => ({
        id: String(route.id),
        routeRevision: Number(route.routeRevision) || 0,
        status: route.status || 'draft'
      })),
      stopRevisions: (input.stops || []).map((stop) => ({
        id: String(stop.id),
        revision: Number(stop.revision) || 0,
        status: stop.status || 'candidate'
      }))
    },
    schemaVersion: SPATIAL_SCHEMA_VERSION
  };
}

export async function getProjectMapView(dependencies, projectId, query = {}) {
  const {
    client,
    issueRepository,
    photoMetadataRepository,
    uploadSessionRepository,
    spatialAnalysisRepository,
    surveyRouteRepository,
    surveyStopRepository,
    boundaryRevisionRepository,
    coordinateTransformRepository
  } = dependencies;
  const requestedBounds = parseSpatialBounds(query.bounds);
  const spatialList = (repository, fallbackArguments = [projectId]) =>
    requestedBounds && typeof repository?.listInBounds === 'function'
      ? repository.listInBounds(projectId, requestedBounds)
      : repository?.list(...fallbackArguments) || [];
  const [
    project,
    businessIssues,
    legacyIssues,
    legacyPhotos,
    photoMetadata,
    uploadSessions,
    spatialAnalyses,
    routes,
    stops,
    boundaryRevisions,
    coordinateTransforms
  ] = await Promise.all([
    client.getProject(projectId),
    spatialList(issueRepository),
    client.listIssues({ projectId }),
    client.listPhotos({ projectId }),
    photoMetadataRepository?.list(projectId) || [],
    uploadSessionRepository?.list(projectId) || [],
    spatialList(spatialAnalysisRepository),
    spatialList(surveyRouteRepository),
    spatialList(surveyStopRepository),
    boundaryRevisionRepository?.list(projectId) || [],
    coordinateTransformRepository?.list(projectId) || []
  ]);
  const issues = mergePrimaryReadModel('officialIssue', {
    businessItems: businessIssues,
    legacyItems: legacyIssues.items
  });
  const photos = sourceEvidencePhotos(
    mergePhotoMetadata(legacyPhotos.items, photoMetadata, true),
    uploadSessions
  );
  const routeById = new Map(routes.map((route) => [String(route.id), route]));
  const currentStops = stops.flatMap((stop) =>
    markSurveyStopStaleness([stop], routeById.get(String(stop.routeId)))
  );
  return buildProjectMapView({
    project,
    issues,
    photos,
    spatialAnalyses: markSpatialStaleness(spatialAnalyses, project, issues).map(hydratePoiReviewRun),
    routes,
    stops: currentStops,
    boundaryRevisions,
    coordinateTransforms
  }, query);
}
