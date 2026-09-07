import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGisViewState,
  gisUrlState,
  mapViewQueryFromState,
  serializeGisLayerSelection
} from '../../apps/business/src/modules/gis/gis-view-model.js';
import { filterOfficialIssues } from '../../apps/business/src/modules/gis/gis-filters.js';
import {
  haversineMeters,
  parseIssueGeometryBatch,
  pointInsideSimplePolygon
} from '../../apps/business/src/modules/gis/gis-geometry.js';

test('GIS view state keeps display choices separate from formal business data', () => {
  const state = createGisViewState({
    selectedIssueId: 'ISS-REAL-001',
    visibleLayers: { photos: true },
    filters: {
      issueRisk: 'high',
      issueStatus: 'stale',
      staleStatus: 'stale',
      search: '消防'
    }
  });
  const query = mapViewQueryFromState(state, {
    bounds: [108.9, 34.2, 109, 34.3],
    limit: 500
  });
  assert.equal(query.get('issueRisk'), 'high');
  assert.equal(query.get('issueStatus'), 'stale');
  assert.equal(query.get('staleStatus'), 'stale');
  assert.equal(query.get('search'), '消防');
  assert.equal(query.get('includePhotos'), 'true');
  assert.equal(query.get('bounds'), '108.9,34.2,109,34.3');
  assert.equal('issues' in state, false);
});

test('GIS URL state restores only non-authoritative selection and display fields', () => {
  const state = gisUrlState('?issue=ISS-REAL-001&run=SPRUN-REAL-001&mapStyle=satellite-road&layers=boundary,issues,poi');
  assert.deepEqual(state, {
    selectedIssueId: 'ISS-REAL-001',
    selectedRouteId: '',
    selectedSpatialRunId: 'SPRUN-REAL-001',
    mapStyle: 'satellite-road',
    visibleLayers: {
      boundary: true,
      boundaryLabel: false,
      boundaryHistory: false,
      issues: true,
      pendingIssues: false,
      issueLabels: false,
      photos: false,
      manualPhotos: false,
      routes: false,
      stops: false,
      poi: true,
      excludedPoi: false,
      analysisRange: false,
      distanceLines: false
    }
  });
  assert.equal(
    serializeGisLayerSelection(state.visibleLayers),
    'boundary,issues,poi'
  );
});

test('manual-photo visibility requests photo data without enabling original-photo markers', () => {
  const query = mapViewQueryFromState(createGisViewState({
    visibleLayers: { photos: false, manualPhotos: true }
  }));
  assert.equal(query.get('includePhotos'), 'true');
});

test('GIS geometry and issue filters stay independent from page assembly', () => {
  assert.equal(pointInsideSimplePolygon(
    [108.95, 34.27],
    [[108.94, 34.26], [108.96, 34.26], [108.96, 34.28], [108.94, 34.28]]
  ), true);
  assert.ok(haversineMeters([108.95, 34.27], [108.951, 34.271]) > 100);
  const issues = filterOfficialIssues([
    {
      id: 'ISS-1',
      title: '消防通道',
      severity: 'high',
      status: 'active',
      geometry: { type: 'Point', coordinates: [108.95, 34.27] }
    },
    { id: 'ISS-2', title: '绿化', severity: 'low', status: 'active' }
  ], {
    issueRisk: 'high',
    issueType: 'all',
    issueStatus: 'active',
    bindingStatus: 'located',
    staleStatus: 'current',
    search: '消防'
  });
  assert.deepEqual(issues.map((item) => item.id), ['ISS-1']);
});

test('GIS batch geometry parser binds current revisions and rejects unknown issues', () => {
  const items = parseIssueGeometryBatch(
    'ISS-1,108.95,34.27,GCJ-02\nISS-2,108.951,34.271',
    [{ id: 'ISS-1', geometryRevision: 2 }, { id: 'ISS-2', geometryRevision: 0 }],
    'WGS84'
  );
  assert.deepEqual(items.map((item) => [
    item.issueId,
    item.crs,
    item.expectedGeometryRevision
  ]), [
    ['ISS-1', 'GCJ02', 2],
    ['ISS-2', 'WGS84', 0]
  ]);
  assert.throws(
    () => parseIssueGeometryBatch('UNKNOWN,108.95,34.27', [], 'WGS84'),
    /不属于当前项目/
  );
});
