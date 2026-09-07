import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundaryGeometryStats,
  pointInBoundaryGeometry,
  validateBoundaryGeometry
} from '../../server/services/spatial-geometry-service.mjs';

const outer = [
  [108.94, 34.26],
  [108.98, 34.26],
  [108.98, 34.30],
  [108.94, 34.30],
  [108.94, 34.26]
];
const hole = [
  [108.95, 34.27],
  [108.96, 34.27],
  [108.96, 34.28],
  [108.95, 34.28],
  [108.95, 34.27]
];

test('complex boundary supports polygon holes and excludes points inside a hole', () => {
  const geometry = validateBoundaryGeometry({
    type: 'Polygon',
    coordinates: [outer, hole]
  });
  assert.equal(pointInBoundaryGeometry([108.945, 34.265], geometry), true);
  assert.equal(pointInBoundaryGeometry([108.955, 34.275], geometry), false);
  assert.equal(pointInBoundaryGeometry([109, 34.27], geometry), false);
  const stats = boundaryGeometryStats(geometry);
  assert.equal(stats.holeCount, 1);
  assert.ok(stats.areaSqKm > 0);
});

test('complex boundary supports multiple disjoint polygons', () => {
  const second = outer.map(([longitude, latitude]) => [longitude + 0.1, latitude]);
  const geometry = validateBoundaryGeometry({
    type: 'MultiPolygon',
    coordinates: [[outer], [second]]
  });
  assert.equal(pointInBoundaryGeometry([108.945, 34.265], geometry), true);
  assert.equal(pointInBoundaryGeometry([109.045, 34.265], geometry), true);
  assert.equal(boundaryGeometryStats(geometry).polygonCount, 2);
});

test('complex boundary rejects self-intersecting rings', () => {
  assert.throws(
    () => validateBoundaryGeometry({
      type: 'Polygon',
      coordinates: [[
        [108.94, 34.26],
        [108.98, 34.30],
        [108.98, 34.26],
        [108.94, 34.30],
        [108.94, 34.26]
      ]]
    }),
    (error) => error.code === 'BOUNDARY_RING_SELF_INTERSECTION'
  );
});
