import { randomUUID } from 'node:crypto';
import {
  normalizeCrs,
  normalizeGeometry,
  SPATIAL_SCHEMA_VERSION
} from '../../packages/api-contracts/spatial.mjs';
import { getProjectMapView } from './map-view-service.mjs';

const PI = Math.PI;
const SEMI_MAJOR_AXIS = 6378245.0;
const ECCENTRICITY_SQUARED = 0.00669342162296594323;
export const COORDINATE_TRANSFORM_METHOD = 'gcj02-standard-formula';
export const COORDINATE_TRANSFORM_VERSION = '1.0.0';

function transformError(message, status = 400, code = 'COORDINATE_TRANSFORM_INVALID', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function outsideChina([longitude, latitude]) {
  return longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271;
}

function latitudeOffset(longitude, latitude) {
  let value = -100 + 2 * longitude + 3 * latitude + 0.2 * latitude ** 2
    + 0.1 * longitude * latitude + 0.2 * Math.sqrt(Math.abs(longitude));
  value += (20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) * 2 / 3;
  value += (20 * Math.sin(latitude * PI) + 40 * Math.sin(latitude / 3 * PI)) * 2 / 3;
  value += (160 * Math.sin(latitude / 12 * PI) + 320 * Math.sin(latitude * PI / 30)) * 2 / 3;
  return value;
}

function longitudeOffset(longitude, latitude) {
  let value = 300 + longitude + 2 * latitude + 0.1 * longitude ** 2
    + 0.1 * longitude * latitude + 0.1 * Math.sqrt(Math.abs(longitude));
  value += (20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) * 2 / 3;
  value += (20 * Math.sin(longitude * PI) + 40 * Math.sin(longitude / 3 * PI)) * 2 / 3;
  value += (150 * Math.sin(longitude / 12 * PI) + 300 * Math.sin(longitude / 30 * PI)) * 2 / 3;
  return value;
}

export function wgs84ToGcj02(position) {
  const point = [Number(position[0]), Number(position[1])];
  if (outsideChina(point)) return point;
  const deltaLongitudeInput = point[0] - 105;
  const deltaLatitudeInput = point[1] - 35;
  let deltaLatitude = latitudeOffset(deltaLongitudeInput, deltaLatitudeInput);
  let deltaLongitude = longitudeOffset(deltaLongitudeInput, deltaLatitudeInput);
  const radLatitude = point[1] / 180 * PI;
  let magic = Math.sin(radLatitude);
  magic = 1 - ECCENTRICITY_SQUARED * magic ** 2;
  const sqrtMagic = Math.sqrt(magic);
  deltaLatitude = deltaLatitude * 180
    / ((SEMI_MAJOR_AXIS * (1 - ECCENTRICITY_SQUARED)) / (magic * sqrtMagic) * PI);
  deltaLongitude = deltaLongitude * 180
    / (SEMI_MAJOR_AXIS / sqrtMagic * Math.cos(radLatitude) * PI);
  return [point[0] + deltaLongitude, point[1] + deltaLatitude];
}

export function gcj02ToWgs84(position, options = {}) {
  const target = [Number(position[0]), Number(position[1])];
  if (outsideChina(target)) return target;
  const tolerance = Math.max(1e-9, Number(options.tolerance) || 1e-7);
  const maxIterations = Math.max(1, Math.min(30, Number(options.maxIterations) || 12));
  let estimate = [...target];
  for (let index = 0; index < maxIterations; index += 1) {
    const projected = wgs84ToGcj02(estimate);
    const delta = [projected[0] - target[0], projected[1] - target[1]];
    estimate = [estimate[0] - delta[0], estimate[1] - delta[1]];
    if (Math.max(Math.abs(delta[0]), Math.abs(delta[1])) <= tolerance) break;
  }
  return estimate;
}

function mapCoordinates(value, transformer) {
  if (!Array.isArray(value)) return value;
  if (
    value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]))
  ) return transformer([Number(value[0]), Number(value[1])]);
  return value.map((item) => mapCoordinates(item, transformer));
}

export function transformGeometry(geometry, sourceCrs, targetCrs) {
  const source = normalizeCrs(sourceCrs);
  const target = normalizeCrs(targetCrs);
  const normalized = normalizeGeometry(geometry, { closeRings: true });
  if (source === target) return normalized;
  const transformer = source === 'WGS84' && target === 'GCJ02'
    ? wgs84ToGcj02
    : source === 'GCJ02' && target === 'WGS84'
      ? gcj02ToWgs84
      : null;
  if (!transformer) {
    throw transformError(
      `暂不支持从${source}转换到${target}。`,
      422,
      'COORDINATE_TRANSFORM_PAIR_UNSUPPORTED',
      { sourceCrs: source, targetCrs: target }
    );
  }
  return {
    type: normalized.type,
    coordinates: mapCoordinates(normalized.coordinates, transformer)
  };
}

export async function createCoordinateTransform(repository, input, options = {}) {
  const projectId = String(input?.projectId || '').trim();
  if (!projectId) {
    throw transformError('坐标转换必须关联真实项目。', 400, 'COORDINATE_TRANSFORM_PROJECT_REQUIRED');
  }
  const transformedBy = String(input?.transformedBy || '').trim().slice(0, 120);
  if (!transformedBy) {
    throw transformError('请记录坐标转换操作人员。', 400, 'COORDINATE_TRANSFORM_OPERATOR_REQUIRED');
  }
  const sourceCrs = normalizeCrs(input?.sourceCrs);
  const targetCrs = normalizeCrs(input?.targetCrs);
  const sourceGeometry = normalizeGeometry(input?.geometry, { closeRings: true });
  const transformedGeometry = transformGeometry(sourceGeometry, sourceCrs, targetCrs);
  const now = options.now || new Date().toISOString();
  const record = {
    id: options.id || `CRSTRANS-${randomUUID()}`,
    projectId,
    sourceObject: {
      kind: String(input?.sourceObject?.kind || '').trim().slice(0, 80) || 'unknown',
      id: String(input?.sourceObject?.id || '').trim().slice(0, 160) || null,
      revision: Math.max(0, Number(input?.sourceObject?.revision) || 0)
    },
    sourceCrs,
    targetCrs,
    sourceGeometry,
    transformedGeometry,
    method: sourceCrs === targetCrs ? 'identity' : COORDINATE_TRANSFORM_METHOD,
    methodVersion: COORDINATE_TRANSFORM_VERSION,
    transformedBy,
    createdAt: now,
    schemaVersion: SPATIAL_SCHEMA_VERSION
  };
  return repository.put(record);
}

export function coordinateTransformCapability() {
  return {
    ready: true,
    supportedPairs: [
      ['WGS84', 'GCJ02'],
      ['GCJ02', 'WGS84']
    ],
    method: COORDINATE_TRANSFORM_METHOD,
    methodVersion: COORDINATE_TRANSFORM_VERSION,
    preservesSourceGeometry: true
  };
}

export async function ensureProjectDisplayTransforms(dependencies, projectId, input, options = {}) {
  const transformedBy = String(input?.transformedBy || '').trim().slice(0, 120);
  if (!transformedBy) {
    throw transformError('请记录坐标转换操作人员。', 400, 'COORDINATE_TRANSFORM_OPERATOR_REQUIRED');
  }
  const limit = Math.max(1, Math.min(500, Number(input?.limit) || 500));
  const view = await getProjectMapView(dependencies, projectId, {
    includePhotos: true,
    includeRoutes: true,
    limit: 100000,
    internalMaximum: 100000,
    forTransform: true
  });
  const candidates = [
    view.boundary,
    ...(view.boundaryHistory?.items || []),
    ...(view.issues?.items || []),
    ...(view.photos?.items || []),
    ...(view.routes?.items || []),
    ...(view.stops?.items || [])
  ].filter((feature) =>
    feature
    && feature.displayReady === false
    && feature.crs === 'WGS84'
  );
  const created = [];
  const persist = async (repository) => {
    for (const feature of candidates.slice(0, limit)) {
      created.push(await createCoordinateTransform(
        repository,
        {
          projectId,
          geometry: feature.geometry,
          sourceCrs: feature.crs,
          targetCrs: 'GCJ02',
          sourceObject: {
            kind: feature.kind,
            id: feature.id,
            revision: feature.revision
          },
          transformedBy
        },
        options
      ));
    }
  };
  if (typeof dependencies.coordinateTransformRepository.transaction === 'function') {
    await dependencies.coordinateTransformRepository.transaction(persist);
  } else {
    await persist(dependencies.coordinateTransformRepository);
  }
  return {
    projectId: String(projectId),
    createdCount: created.length,
    pendingInCurrentWindow: Math.max(0, candidates.length - created.length),
    sourceWindowTruncated: Boolean(
      view.issues?.truncated
      || view.boundaryHistory?.truncated
      || view.photos?.truncated
      || view.routes?.truncated
      || view.stops?.truncated
    ),
    items: created.map((item) => ({
      id: item.id,
      sourceObject: item.sourceObject,
      method: item.method,
      methodVersion: item.methodVersion
    }))
  };
}
