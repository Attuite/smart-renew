import {
  geometryBounds,
  normalizeGeometry
} from '../../packages/api-contracts/spatial.mjs';

function geometryError(message, code = 'INVALID_BOUNDARY_GEOMETRY', details = {}) {
  const error = new Error(message);
  error.status = 422;
  error.code = code;
  error.details = details;
  return error;
}

function samePoint(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) + 1e-12
    && b[0] >= Math.min(a[0], c[0]) - 1e-12
    && b[1] <= Math.max(a[1], c[1]) + 1e-12
    && b[1] >= Math.min(a[1], c[1]) - 1e-12;
}

function segmentsIntersect(a1, a2, b1, b2) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

function assertSimpleRing(ring, path) {
  const segmentCount = ring.length - 1;
  for (let left = 0; left < segmentCount; left += 1) {
    for (let right = left + 1; right < segmentCount; right += 1) {
      const adjacent = Math.abs(left - right) <= 1
        || (left === 0 && right === segmentCount - 1);
      if (adjacent) continue;
      if (segmentsIntersect(ring[left], ring[left + 1], ring[right], ring[right + 1])) {
        throw geometryError(
          '项目边界存在自相交线段。',
          'BOUNDARY_RING_SELF_INTERSECTION',
          { path, leftSegment: left, rightSegment: right }
        );
      }
    }
  }
}

function pointOnRing(point, ring) {
  for (let index = 0; index < ring.length - 1; index += 1) {
    if (orientation(ring[index], point, ring[index + 1]) === 0
      && onSegment(ring[index], point, ring[index + 1])) return true;
  }
  return false;
}

export function pointInRing(point, ring) {
  if (pointOnRing(point, ring)) return true;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const start = ring[previous];
    const end = ring[index];
    const intersects = (end[1] > point[1]) !== (start[1] > point[1])
      && point[0] < ((start[0] - end[0]) * (point[1] - end[1])) / (start[1] - end[1]) + end[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function polygonContainsPoint(point, polygon) {
  if (!pointInRing(point, polygon[0])) return false;
  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

export function pointInBoundaryGeometry(point, geometry) {
  const normalized = normalizeGeometry(geometry, { closeRings: true });
  if (normalized.type === 'Polygon') return polygonContainsPoint(point, normalized.coordinates);
  if (normalized.type === 'MultiPolygon') {
    return normalized.coordinates.some((polygon) => polygonContainsPoint(point, polygon));
  }
  throw geometryError(
    '项目边界必须是Polygon或MultiPolygon。',
    'BOUNDARY_GEOMETRY_TYPE_INVALID',
    { type: normalized.type }
  );
}

function ringAreaSqKm(ring) {
  const radians = Math.PI / 180;
  const earthRadius = 6_378_137;
  let accumulator = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    accumulator += (next[0] - current[0]) * radians
      * (2 + Math.sin(current[1] * radians) + Math.sin(next[1] * radians));
  }
  return Math.abs(accumulator * earthRadius * earthRadius / 2) / 1_000_000;
}

function polygonAreaSqKm(polygon) {
  return Math.max(
    0,
    ringAreaSqKm(polygon[0])
      - polygon.slice(1).reduce((sum, hole) => sum + ringAreaSqKm(hole), 0)
  );
}

export function boundaryGeometryStats(geometry) {
  const normalized = validateBoundaryGeometry(geometry);
  const polygons = normalized.type === 'Polygon'
    ? [normalized.coordinates]
    : normalized.coordinates;
  const areaSqKm = polygons.reduce((sum, polygon) => sum + polygonAreaSqKm(polygon), 0);
  const bounds = geometryBounds(normalized);
  return {
    areaSqKm,
    center: [
      (bounds[0] + bounds[2]) / 2,
      (bounds[1] + bounds[3]) / 2
    ],
    bounds,
    polygonCount: polygons.length,
    holeCount: polygons.reduce((sum, polygon) => sum + Math.max(0, polygon.length - 1), 0)
  };
}

export function validateBoundaryGeometry(value, options = {}) {
  const geometry = normalizeGeometry(value, {
    closeRings: true,
    maxPoints: Number(options.maxPoints) || 50000
  });
  if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    throw geometryError(
      '项目边界必须是Polygon或MultiPolygon。',
      'BOUNDARY_GEOMETRY_TYPE_INVALID',
      { type: geometry.type }
    );
  }
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  polygons.forEach((polygon, polygonIndex) => {
    polygon.forEach((ring, ringIndex) => {
      assertSimpleRing(ring, `polygons[${polygonIndex}].rings[${ringIndex}]`);
      if (ringAreaSqKm(ring) < 0.000001) {
        throw geometryError(
          '项目边界环面积为0或过小。',
          'BOUNDARY_RING_AREA_TOO_SMALL',
          { polygonIndex, ringIndex }
        );
      }
    });
    for (let holeIndex = 1; holeIndex < polygon.length; holeIndex += 1) {
      const representative = polygon[holeIndex][0];
      if (!pointInRing(representative, polygon[0])) {
        throw geometryError(
          '项目边界孔洞必须位于外环内部。',
          'BOUNDARY_HOLE_OUTSIDE_OUTER_RING',
          { polygonIndex, holeIndex: holeIndex - 1 }
        );
      }
    }
  });
  return geometry;
}

export function legacyBoundaryProjection(geometry) {
  const normalized = validateBoundaryGeometry(geometry);
  const outer = normalized.type === 'Polygon'
    ? normalized.coordinates[0]
    : normalized.coordinates[0][0];
  const projection = [...outer];
  if (projection.length > 3 && samePoint(projection[0], projection.at(-1))) projection.pop();
  return projection;
}
