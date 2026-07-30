export const SPATIAL_SCHEMA_VERSION = '1.0.0';
export const SUPPORTED_GEOMETRY_TYPES = Object.freeze([
  'Point',
  'LineString',
  'Polygon',
  'MultiPolygon'
]);
export const SUPPORTED_CRS = Object.freeze(['WGS84', 'GCJ02']);

function spatialContractError(message, code = 'INVALID_SPATIAL_CONTRACT', details = {}) {
  const error = new Error(message);
  error.status = 422;
  error.code = code;
  error.details = details;
  return error;
}

export function normalizeCrs(value, options = {}) {
  const source = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const aliases = {
    WGS84: 'WGS84',
    EPSG4326: 'WGS84',
    GCJ02: 'GCJ02',
    AMAP: 'GCJ02'
  };
  const normalized = aliases[source] || '';
  if (!normalized && options.required !== false) {
    throw spatialContractError(
      `不支持或缺少坐标系：${String(value || 'empty')}`,
      'UNSUPPORTED_SPATIAL_CRS',
      { value: value ?? null, supported: SUPPORTED_CRS }
    );
  }
  return normalized || null;
}

export function normalizePosition(value, path = 'coordinates') {
  if (!Array.isArray(value) || value.length < 2) {
    throw spatialContractError('空间坐标必须至少包含经度和纬度。', 'INVALID_SPATIAL_POSITION', { path });
  }
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw spatialContractError('经度必须在-180到180之间。', 'INVALID_LONGITUDE', { path, value: value[0] });
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw spatialContractError('纬度必须在-90到90之间。', 'INVALID_LATITUDE', { path, value: value[1] });
  }
  return [longitude, latitude];
}

function positionsEqual(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function normalizeLineString(value, path, minimum = 2) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw spatialContractError(
      `空间坐标至少需要${minimum}个点。`,
      'SPATIAL_COORDINATES_TOO_SHORT',
      { path, minimum }
    );
  }
  return value.map((point, index) => normalizePosition(point, `${path}[${index}]`));
}

function normalizeRing(value, path, closeRings) {
  const ring = normalizeLineString(value, path, 3);
  if (!positionsEqual(ring[0], ring.at(-1))) {
    if (!closeRings) {
      throw spatialContractError('Polygon环必须闭合。', 'SPATIAL_RING_NOT_CLOSED', { path });
    }
    ring.push([...ring[0]]);
  }
  if (ring.length < 4) {
    throw spatialContractError('Polygon闭合环至少需要4个坐标。', 'SPATIAL_RING_TOO_SHORT', { path });
  }
  return ring;
}

function countPositions(value) {
  if (!Array.isArray(value)) return 0;
  if (value.length >= 2 && value.slice(0, 2).every((item) => Number.isFinite(Number(item)))) return 1;
  return value.reduce((total, item) => total + countPositions(item), 0);
}

export function normalizeGeometry(value, options = {}) {
  if (!value || typeof value !== 'object') {
    throw spatialContractError('Geometry不能为空。', 'SPATIAL_GEOMETRY_REQUIRED');
  }
  const type = String(value.type || '');
  if (!SUPPORTED_GEOMETRY_TYPES.includes(type)) {
    throw spatialContractError(
      `不支持的Geometry类型：${type || 'empty'}`,
      'UNSUPPORTED_GEOMETRY_TYPE',
      { type, supported: SUPPORTED_GEOMETRY_TYPES }
    );
  }
  let coordinates;
  if (type === 'Point') {
    coordinates = normalizePosition(value.coordinates);
  } else if (type === 'LineString') {
    coordinates = normalizeLineString(value.coordinates, 'coordinates');
  } else if (type === 'Polygon') {
    if (!Array.isArray(value.coordinates) || !value.coordinates.length) {
      throw spatialContractError('Polygon至少需要一个外环。', 'SPATIAL_POLYGON_RING_REQUIRED');
    }
    coordinates = value.coordinates.map((ring, index) =>
      normalizeRing(ring, `coordinates[${index}]`, options.closeRings === true)
    );
  } else {
    if (!Array.isArray(value.coordinates) || !value.coordinates.length) {
      throw spatialContractError('MultiPolygon至少需要一个Polygon。', 'SPATIAL_MULTIPOLYGON_REQUIRED');
    }
    coordinates = value.coordinates.map((polygon, polygonIndex) => {
      if (!Array.isArray(polygon) || !polygon.length) {
        throw spatialContractError(
          'MultiPolygon中的Polygon至少需要一个外环。',
          'SPATIAL_POLYGON_RING_REQUIRED',
          { polygonIndex }
        );
      }
      return polygon.map((ring, ringIndex) =>
        normalizeRing(
          ring,
          `coordinates[${polygonIndex}][${ringIndex}]`,
          options.closeRings === true
        )
      );
    });
  }
  const pointCount = countPositions(coordinates);
  const maxPoints = Math.max(1, Number(options.maxPoints) || 100000);
  if (pointCount > maxPoints) {
    throw spatialContractError(
      `Geometry包含${pointCount}个点，超过上限${maxPoints}。`,
      'SPATIAL_POINT_LIMIT_EXCEEDED',
      { pointCount, maxPoints }
    );
  }
  return { type, coordinates };
}

function flattenPositions(value, output = []) {
  if (!Array.isArray(value)) return output;
  if (
    value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]))
  ) {
    output.push([Number(value[0]), Number(value[1])]);
    return output;
  }
  for (const item of value) flattenPositions(item, output);
  return output;
}

export function geometryBounds(geometry) {
  const normalized = normalizeGeometry(geometry, { closeRings: true });
  const positions = flattenPositions(normalized.coordinates);
  const longitudes = positions.map((point) => point[0]);
  const latitudes = positions.map((point) => point[1]);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes)
  ];
}

export function parseSpatialBounds(value) {
  if (value == null || value === '') return null;
  const source = Array.isArray(value) ? value : String(value).split(',');
  if (source.length !== 4) {
    throw spatialContractError(
      '视口范围必须是minLongitude,minLatitude,maxLongitude,maxLatitude。',
      'INVALID_SPATIAL_BOUNDS'
    );
  }
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = source.map(Number);
  normalizePosition([minLongitude, minLatitude], 'bounds.minimum');
  normalizePosition([maxLongitude, maxLatitude], 'bounds.maximum');
  if (minLongitude > maxLongitude || minLatitude > maxLatitude) {
    throw spatialContractError('视口最小值不能大于最大值。', 'INVALID_SPATIAL_BOUNDS_ORDER');
  }
  return [minLongitude, minLatitude, maxLongitude, maxLatitude];
}

export function positionInBounds(position, bounds) {
  if (!bounds) return true;
  const [longitude, latitude] = normalizePosition(position);
  return longitude >= bounds[0]
    && longitude <= bounds[2]
    && latitude >= bounds[1]
    && latitude <= bounds[3];
}

export function createSpatialFeature(input, options = {}) {
  const id = String(input?.id || '').trim();
  if (!id) throw spatialContractError('空间要素必须有ID。', 'SPATIAL_FEATURE_ID_REQUIRED');
  return {
    id,
    kind: String(input.kind || '').trim() || 'unknown',
    geometry: normalizeGeometry(input.geometry, { closeRings: options.closeRings === true }),
    crs: normalizeCrs(input.crs),
    properties: input.properties && typeof input.properties === 'object'
      ? { ...input.properties }
      : {},
    revision: Math.max(0, Number(input.revision) || 0),
    schemaVersion: SPATIAL_SCHEMA_VERSION
  };
}

export function crsCompatibility(crsValues, target = 'GCJ02') {
  const targetCrs = normalizeCrs(target);
  const normalized = [...new Set(
    (Array.isArray(crsValues) ? crsValues : [])
      .map((value) => normalizeCrs(value, { required: false }))
      .filter(Boolean)
  )];
  const mismatched = normalized.filter((value) => value !== targetCrs);
  return {
    target: targetCrs,
    sources: normalized,
    compatible: mismatched.length === 0,
    requiresTransform: mismatched.length > 0,
    mismatched
  };
}
