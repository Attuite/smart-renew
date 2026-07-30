import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectMapView } from '../../server/services/map-view-service.mjs';

const project = {
  id: '170000000000001',
  name: '真实项目',
  revision: 5,
  scopeBoundaryCrs: 'GCJ02',
  scopeBoundary: [
    [108.94, 34.26],
    [108.96, 34.26],
    [108.96, 34.28],
    [108.94, 34.28]
  ]
};

test('map view builds bounded real spatial features without demo fallback', () => {
  const view = buildProjectMapView({
    project,
    issues: [
      {
        id: 'ISS-REAL-HIGH',
        title: '真实高风险问题',
        severity: 'high',
        categoryCode: 'FACILITY',
        geometry: { type: 'Point', coordinates: [108.95, 34.27] },
        geometryCrs: 'GCJ02',
        geometryRevision: 2
      },
      {
        id: 'ISS-UNLOCATED',
        title: '待定位问题',
        severity: 'medium'
      }
    ],
    photos: [{
      id: 'PHOTO-REAL-1',
      name: '真实照片',
      coordinates: [109.051, 34.371],
      coordinateCrs: 'GCJ02',
      metadataRevision: 1
    }],
    boundaryRevisions: [{
      id: 'BNDREV-REAL-004',
      projectId: project.id,
      projectRevision: 4,
      crs: 'GCJ02',
      areaSqKm: 1.2,
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [108.941, 34.261],
          [108.959, 34.261],
          [108.959, 34.279],
          [108.941, 34.261]
        ]]
      }
    }],
    spatialAnalyses: []
  });

  assert.equal(view.boundary.kind, 'project-boundary');
  assert.equal(view.issues.items.length, 1);
  assert.equal(view.issues.unlocatedTotal, 1);
  assert.equal(view.photos.items.length, 1);
  assert.equal(view.photos.items[0].properties.outsideBoundary, true);
  assert.equal(view.boundaryHistory.total, 1);
  assert.equal(view.boundaryHistory.items[0].properties.projectRevision, 4);
  assert.equal(view.coordinateCompatibility.onlineMapOverlayReady, true);
  assert.equal(JSON.stringify(view).includes('MAP-021'), false);
});

test('map view applies filters, viewport and truncation deterministically', () => {
  const view = buildProjectMapView({
    project,
    issues: [
      {
        id: 'ISS-IN',
        severity: 'high',
        categoryCode: 'A',
        geometry: { type: 'Point', coordinates: [108.95, 34.27] },
        geometryCrs: 'GCJ02'
      },
      {
        id: 'ISS-OUT',
        severity: 'high',
        categoryCode: 'A',
        geometry: { type: 'Point', coordinates: [109.1, 34.27] },
        geometryCrs: 'GCJ02'
      },
      {
        id: 'ISS-MEDIUM',
        severity: 'medium',
        categoryCode: 'A',
        geometry: { type: 'Point', coordinates: [108.951, 34.271] },
        geometryCrs: 'GCJ02'
      }
    ]
  }, {
    issueRisk: 'high',
    bounds: '108.94,34.26,108.96,34.28',
    limit: 1
  });

  assert.deepEqual(view.issues.items.map((item) => item.id), ['ISS-IN']);
  assert.equal(view.issues.total, 1);
  assert.equal(view.issues.truncated, false);
});

test('map view refuses to claim high-deck overlay readiness for WGS84 sources', () => {
  const view = buildProjectMapView({
    project: { ...project, scopeBoundaryCrs: 'WGS84' },
    issues: []
  });
  assert.equal(view.coordinateCompatibility.onlineMapOverlayReady, false);
  assert.equal(view.coordinateCompatibility.reason, 'COORDINATE_TRANSFORM_REQUIRED');
});

test('map view uses a matching audited transform for display without overwriting source geometry', () => {
  const wgsProject = { ...project, scopeBoundaryCrs: 'WGS84' };
  const sourceGeometry = {
    type: 'Polygon',
    coordinates: [[
      [108.94, 34.26],
      [108.96, 34.26],
      [108.96, 34.28],
      [108.94, 34.28],
      [108.94, 34.26]
    ]]
  };
  const transformedGeometry = {
    type: 'Polygon',
    coordinates: [[
      [108.945, 34.258],
      [108.965, 34.258],
      [108.965, 34.278],
      [108.945, 34.278],
      [108.945, 34.258]
    ]]
  };
  const view = buildProjectMapView({
    project: { ...wgsProject, scopeBoundaryGeometry: sourceGeometry },
    issues: [],
    coordinateTransforms: [{
      id: 'CRSTRANS-REAL-001',
      sourceObject: {
        kind: 'project-boundary',
        id: wgsProject.id,
        revision: wgsProject.revision
      },
      sourceCrs: 'WGS84',
      targetCrs: 'GCJ02',
      transformedGeometry,
      method: 'reviewed-transform',
      methodVersion: '1.0.0'
    }]
  });
  assert.deepEqual(view.boundary.geometry, transformedGeometry);
  assert.deepEqual(view.boundary.sourceGeometry, sourceGeometry);
  assert.equal(view.boundary.coordinateTransformId, 'CRSTRANS-REAL-001');
  assert.equal(view.coordinateCompatibility.onlineMapOverlayReady, true);
});

test('map view combines lifecycle, stale and search filters', () => {
  const view = buildProjectMapView({
    project,
    issues: [
      {
        id: 'ISS-STALE-FIRE',
        title: '消防通道占用',
        status: 'stale',
        staleReasons: ['PHOTO_METADATA_CHANGED'],
        geometry: { type: 'Point', coordinates: [108.95, 34.27] },
        geometryCrs: 'GCJ02'
      },
      {
        id: 'ISS-ACTIVE-FIRE',
        title: '消防设施完好',
        status: 'active',
        geometry: { type: 'Point', coordinates: [108.951, 34.271] },
        geometryCrs: 'GCJ02'
      }
    ]
  }, {
    issueStatus: 'stale',
    staleStatus: 'stale',
    search: '通道'
  });
  assert.deepEqual(view.issues.items.map((item) => item.id), ['ISS-STALE-FIRE']);
});

test('map view bounds 10,000 issue points and simplifies 50,000-point routes', () => {
  const issues = Array.from({ length: 10000 }, (_, index) => ({
    id: `ISS-CAP-${index}`,
    title: `容量问题${index}`,
    status: 'active',
    geometry: {
      type: 'Point',
      coordinates: [108.94 + (index % 100) / 10000, 34.26 + (index % 80) / 10000]
    },
    geometryCrs: 'GCJ02'
  }));
  const routeCoordinates = Array.from({ length: 50000 }, (_, index) => [
    108.94 + index / 10000000,
    34.26 + (index % 100) / 10000000
  ]);
  const photos = Array.from({ length: 10000 }, (_, index) => ({
    id: `PHOTO-CAP-${index}`,
    name: `容量照片${index}`,
    coordinates: [108.94 + (index % 100) / 10000, 34.26 + (index % 80) / 10000],
    coordinateCrs: 'GCJ02'
  }));
  const poiItems = Array.from({ length: 5000 }, (_, index) => ({
    normalizedId: `POI-CAP-${index}`,
    name: `容量设施${index}`,
    coordinates: [108.94 + (index % 100) / 10000, 34.26 + (index % 80) / 10000],
    crs: 'GCJ02',
    reviewStatus: index % 10 === 0 ? 'excluded' : 'pending'
  }));
  const view = buildProjectMapView({
    project,
    issues,
    photos,
    routes: Array.from({ length: 20 }, (_, index) => ({
      id: `ROUTE-CAP-50000-${index}`,
      name: '五万点路线',
      status: 'confirmed',
      crs: 'GCJ02',
      routeRevision: 1,
      geometry: { type: 'LineString', coordinates: routeCoordinates }
    })),
    spatialAnalyses: [{
      id: 'SPRUN-CAPACITY-0001',
      type: 'poi-search',
      status: 'completed',
      parameters: { center: [108.95, 34.27], radiusMeters: 1000 },
      result: { items: poiItems }
    }]
  }, {
    limit: 2000,
    zoom: 12
  });
  assert.equal(view.issues.total, 10000);
  assert.equal(view.issues.items.length, 2000);
  assert.equal(view.issues.truncated, true);
  assert.equal(view.photos.total, 10000);
  assert.equal(view.photos.items.length, 2000);
  assert.equal(view.photos.truncated, true);
  assert.equal(view.routes.total, 20);
  assert.equal(view.routes.items[0].properties.sourcePointCount, 50000);
  assert.equal(view.routes.items[0].geometry.coordinates.length, 1000);
  assert.equal(view.routes.items[0].properties.displaySimplified, true);
  assert.equal(view.spatialAnalyses.items[0].result.mapItemTotal, 5000);
  assert.equal(view.spatialAnalyses.items[0].result.items.length, 2000);
  assert.equal(view.spatialAnalyses.items[0].result.mapItemsTruncated, true);
});
