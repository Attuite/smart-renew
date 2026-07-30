import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSurveyRoute,
  createSurveyRoute,
  detectSurveyStops,
  markPhotoRouteBindingStaleness,
  markSurveyStopStaleness,
  reviewPhotoRouteBinding,
  suggestPhotoRouteBindings
} from '../../server/services/survey-route-service.mjs';

test('survey route persists real coordinates, times and source lineage', async () => {
  let stored;
  const route = await createSurveyRoute({
    async getProject() { return { id: '1' }; }
  }, {
    async put(value) { stored = value; return value; }
  }, '1', {
    name: '上午踏勘',
    crs: 'WGS84',
    createdBy: '采集员',
    geometry: {
      type: 'LineString',
      coordinates: [[108.95, 34.27], [108.951, 34.271]]
    },
    samples: [
      { coordinates: [108.95, 34.27], capturedAt: '2026-07-30T01:00:00Z' },
      { coordinates: [108.951, 34.271], capturedAt: '2026-07-30T01:01:00Z' }
    ],
    source: { kind: 'gpx', assetId: 'ASSET-REAL-001', contentHash: 'hash' }
  }, {
    id: 'ROUTE-fixed-real-001',
    now: '2026-07-30T02:00:00Z'
  });
  assert.equal(route.samples.length, 2);
  assert.equal(route.source.assetId, 'ASSET-REAL-001');
  assert.equal(stored.routeRevision, 1);
});

test('route cleaning removes duplicate and implausible samples with rule audit', async () => {
  let stored;
  const repository = {
    async get() {
      return {
        id: 'ROUTE-fixed-real-001',
        routeRevision: 1,
        samples: [
          { coordinates: [108.95, 34.27], capturedAt: '2026-07-30T01:00:00Z' },
          { coordinates: [108.95, 34.27], capturedAt: '2026-07-30T01:00:10Z' },
          { coordinates: [108.951, 34.271], capturedAt: '2026-07-30T01:01:00Z' }
        ]
      };
    },
    async put(value) { stored = value; return value; }
  };
  const route = await cleanSurveyRoute(repository, 'ROUTE-fixed-real-001', {
    cleanedBy: 'GIS人员',
    expectedRevision: 1
  });
  assert.equal(route.samples.length, 2);
  assert.equal(route.cleaning.removedPointCount, 1);
  assert.deepEqual(route.cleaning.rejected[0].coordinates, [108.95, 34.27]);
  assert.equal(stored.routeRevision, 2);
});

test('stop detection and photo-route suggestions are data-driven and reviewable', async () => {
  const route = {
    id: 'ROUTE-fixed-real-001',
    projectId: '1',
    crs: 'WGS84',
    routeRevision: 2,
    samples: [
      { coordinates: [108.95, 34.27], capturedAt: '2026-07-30T01:00:00Z' },
      { coordinates: [108.95001, 34.27001], capturedAt: '2026-07-30T01:03:00Z' },
      { coordinates: [108.952, 34.272], capturedAt: '2026-07-30T01:04:00Z' }
    ]
  };
  const routeRepository = { async get() { return route; } };
  const stops = [];
  const candidates = await detectSurveyStops(routeRepository, {
    async put(value) { stops.push(value); return value; }
  }, route.id, {
    detectedBy: 'GIS人员',
    radiusMeters: 25,
    minimumDurationSeconds: 120
  }, {
    idFactory: () => 'fixed-real-001',
    now: '2026-07-30T02:00:00Z'
  });
  assert.equal(candidates.length, 1);
  assert.equal(stops[0].status, 'candidate');

  const savedBindings = [];
  const bindings = await suggestPhotoRouteBindings(routeRepository, {
    async put(value) { savedBindings.push(value); return value; }
  }, route.id, [{
    id: 'PHOTO-REAL-001',
    coordinates: [108.95002, 34.27002],
    capturedAt: '2026-07-30T01:02:00Z',
    metadataRevision: 3
  }], {
    suggestedBy: 'GIS人员'
  }, {
    idFactory: () => 'fixed-real-001',
    now: '2026-07-30T02:00:00Z'
  });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].status, 'suggested');

  let reviewed;
  await reviewPhotoRouteBinding({
    async get() { return bindings[0]; },
    async put(value) { reviewed = value; return value; }
  }, bindings[0].id, {
    status: 'confirmed',
    confirmedBy: '项目负责人',
    expectedRevision: 1
  });
  assert.equal(reviewed.status, 'confirmed');
  assert.equal(reviewed.revision, 2);
});

test('route and photo revisions derive stale stop and binding status without rewriting history', () => {
  const route = { id: 'ROUTE-1', routeRevision: 4 };
  const [stop] = markSurveyStopStaleness([{
    id: 'STOP-1',
    routeId: 'ROUTE-1',
    routeRevision: 3,
    status: 'confirmed'
  }], route);
  assert.equal(stop.status, 'stale');
  assert.equal(stop.originalStatus, 'confirmed');
  assert.deepEqual(stop.staleReasons, ['ROUTE_CHANGED']);

  const [binding] = markPhotoRouteBindingStaleness([{
    id: 'PRB-1',
    routeId: 'ROUTE-1',
    routeRevision: 4,
    photoId: 'PHOTO-1',
    photoMetadataRevision: 2,
    status: 'confirmed'
  }], route, [{
    id: 'PHOTO-1',
    metadataRevision: 3,
    governanceStatus: 'active'
  }]);
  assert.equal(binding.status, 'stale');
  assert.deepEqual(binding.staleReasons, ['PHOTO_METADATA_CHANGED']);
});
