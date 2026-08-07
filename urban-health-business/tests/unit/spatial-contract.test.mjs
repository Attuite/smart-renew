import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpatialFeature,
  crsCompatibility,
  geometryBounds,
  normalizeCrs,
  normalizeGeometry,
  parseSpatialBounds
} from '../../packages/api-contracts/spatial.mjs';

test('spatial contract normalizes supported CRS aliases without accepting unknown CRS', () => {
  assert.equal(normalizeCrs('EPSG:4326'), 'WGS84');
  assert.equal(normalizeCrs('GCJ-02'), 'GCJ02');
  assert.throws(
    () => normalizeCrs('BD09'),
    (error) => error.code === 'UNSUPPORTED_SPATIAL_CRS'
  );
});

test('spatial contract closes polygon rings only when explicitly requested', () => {
  const openRing = [[108.94, 34.26], [108.96, 34.26], [108.96, 34.28], [108.94, 34.28]];
  assert.throws(
    () => normalizeGeometry({ type: 'Polygon', coordinates: [openRing] }),
    (error) => error.code === 'SPATIAL_RING_NOT_CLOSED'
  );
  const geometry = normalizeGeometry(
    { type: 'Polygon', coordinates: [openRing] },
    { closeRings: true }
  );
  assert.deepEqual(geometry.coordinates[0][0], geometry.coordinates[0].at(-1));
  assert.deepEqual(geometryBounds(geometry), [108.94, 34.26, 108.96, 34.28]);
});

test('spatial contract preserves valid MultiLineString route segments', () => {
  const geometry = normalizeGeometry({
    type: 'MultiLineString',
    coordinates: [
      [[108.95, 34.27], [108.951, 34.271]],
      [[108.955, 34.275], [108.956, 34.276]]
    ]
  });
  assert.equal(geometry.coordinates.length, 2);
  assert.deepEqual(geometryBounds(geometry), [108.95, 34.27, 108.956, 34.276]);
});

test('spatial feature preserves geometry, CRS, revision and bounded properties', () => {
  const feature = createSpatialFeature({
    id: 'ISS-REAL-001',
    kind: 'official-issue',
    geometry: { type: 'Point', coordinates: [108.95, 34.27] },
    crs: 'GCJ-02',
    revision: 3,
    properties: { severity: 'high' }
  });
  assert.equal(feature.crs, 'GCJ02');
  assert.equal(feature.revision, 3);
  assert.equal(feature.properties.severity, 'high');
});

test('spatial bounds and CRS compatibility expose transformation requirements', () => {
  assert.deepEqual(
    parseSpatialBounds('108.9,34.2,109,34.3'),
    [108.9, 34.2, 109, 34.3]
  );
  const compatibility = crsCompatibility(['GCJ02', 'WGS84'], 'GCJ02');
  assert.equal(compatibility.compatible, false);
  assert.deepEqual(compatibility.mismatched, ['WGS84']);
});
