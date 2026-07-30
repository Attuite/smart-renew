import { randomUUID } from 'node:crypto';
import {
  normalizeCrs,
  normalizeGeometry,
  normalizePosition
} from '../../packages/api-contracts/spatial.mjs';
import { haversineMeters } from './spatial-analysis-service.mjs';

export const SURVEY_ROUTE_CLEANING_VERSION = 'survey-route-cleaning-v1';
export const SURVEY_STOP_RULE_VERSION = 'survey-stop-detection-v1';
export const PHOTO_ROUTE_BINDING_RULE_VERSION = 'photo-route-binding-v1';

export function markSurveyStopStaleness(stops, route) {
  return (Array.isArray(stops) ? stops : []).map((stop) => {
    const staleReasons = [];
    if (!route || String(stop.routeId) !== String(route.id)) {
      staleReasons.push('ROUTE_MISSING');
    } else if (Number(stop.routeRevision) !== Number(route.routeRevision)) {
      staleReasons.push('ROUTE_CHANGED');
    }
    return staleReasons.length
      ? {
          ...stop,
          originalStatus: stop.originalStatus || stop.status || 'candidate',
          status: 'stale',
          staleReasons
        }
      : { ...stop, staleReasons: [] };
  });
}

export function markPhotoRouteBindingStaleness(bindings, route, photos) {
  const photoById = new Map(
    (Array.isArray(photos) ? photos : []).map((photo) => [String(photo.id), photo])
  );
  return (Array.isArray(bindings) ? bindings : []).map((binding) => {
    const staleReasons = [];
    if (!route || String(binding.routeId) !== String(route.id)) {
      staleReasons.push('ROUTE_MISSING');
    } else if (Number(binding.routeRevision) !== Number(route.routeRevision)) {
      staleReasons.push('ROUTE_CHANGED');
    }
    const photo = photoById.get(String(binding.photoId));
    if (!photo) {
      staleReasons.push('PHOTO_MISSING');
    } else {
      if (photo.governanceStatus === 'inactive') staleReasons.push('PHOTO_INACTIVE');
      if (Number(binding.photoMetadataRevision) !== Number(photo.metadataRevision || 0)) {
        staleReasons.push('PHOTO_METADATA_CHANGED');
      }
    }
    return staleReasons.length
      ? {
          ...binding,
          originalStatus: binding.originalStatus || binding.status || 'suggested',
          status: 'stale',
          staleReasons
        }
      : { ...binding, staleReasons: [] };
  });
}

function routeError(message, status = 400, code = 'SURVEY_ROUTE_INVALID', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function clean(value, maximum = 300) {
  return String(value || '').trim().slice(0, maximum);
}

function normalizedSamples(input, geometry) {
  const source = Array.isArray(input?.samples) ? input.samples : [];
  if (!source.length) {
    return geometry.coordinates.map((coordinates) => ({
      coordinates,
      capturedAt: null,
      accuracyMeters: null
    }));
  }
  return source.map((sample, index) => ({
    coordinates: normalizePosition(sample?.coordinates || geometry.coordinates[index]),
    capturedAt: clean(sample?.capturedAt, 80) || null,
    accuracyMeters: sample?.accuracyMeters == null
      ? null
      : Math.max(0, Number(sample.accuracyMeters) || 0)
  }));
}

export async function createSurveyRoute(client, repository, projectId, input, options = {}) {
  const project = await client.getProject(projectId);
  if (!project?.id) throw routeError('项目不存在。', 404, 'PROJECT_NOT_FOUND');
  const maxPoints = Math.max(
    1000,
    Math.min(100000, Number(process.env.GIS_MAX_ROUTE_POINTS) || 100000)
  );
  const geometry = normalizeGeometry(
    input?.geometry || { type: 'LineString', coordinates: input?.coordinates },
    { maxPoints }
  );
  if (geometry.type !== 'LineString') {
    throw routeError('踏勘路线必须是LineString。', 422, 'SURVEY_ROUTE_GEOMETRY_INVALID');
  }
  const createdBy = clean(input?.createdBy, 120);
  if (!createdBy) throw routeError('请填写踏勘路线创建人员。', 400, 'SURVEY_ROUTE_CREATOR_REQUIRED');
  const crs = normalizeCrs(input?.crs || 'WGS84');
  const now = options.now || new Date().toISOString();
  const route = {
    id: options.id || `ROUTE-${randomUUID()}`,
    projectId: String(project.id),
    name: clean(input?.name, 200) || `踏勘路线 ${now.slice(0, 10)}`,
    status: 'draft',
    geometry,
    crs,
    samples: normalizedSamples(input, geometry),
    source: {
      kind: clean(input?.source?.kind, 60) || 'manual',
      assetId: clean(input?.source?.assetId, 160) || null,
      contentHash: clean(input?.source?.contentHash, 128) || null
    },
    cleaning: null,
    routeRevision: 1,
    createdBy,
    createdAt: now,
    updatedAt: now,
    schemaVersion: '1.0.0'
  };
  return repository.put(route);
}

export async function updateSurveyRoute(repository, routeId, input, options = {}) {
  const route = await repository.get(routeId);
  if (!route) throw routeError('踏勘路线不存在。', 404, 'SURVEY_ROUTE_NOT_FOUND');
  const expectedRevision = Number(input?.expectedRevision);
  if (Number.isFinite(expectedRevision) && expectedRevision !== Number(route.routeRevision || 1)) {
    throw routeError('踏勘路线已被其他操作修改。', 409, 'SURVEY_ROUTE_REVISION_CONFLICT');
  }
  const updatedBy = clean(input?.updatedBy, 120);
  if (!updatedBy) throw routeError('请填写路线更新人员。', 400, 'SURVEY_ROUTE_EDITOR_REQUIRED');
  const status = clean(input?.status ?? route.status, 30);
  if (!['draft', 'confirmed', 'inactive'].includes(status)) {
    throw routeError('路线状态必须为draft、confirmed或inactive。', 400, 'SURVEY_ROUTE_STATUS_INVALID');
  }
  const geometry = input?.geometry
    ? normalizeGeometry(input.geometry, {
        maxPoints: Math.max(
          1000,
          Math.min(100000, Number(process.env.GIS_MAX_ROUTE_POINTS) || 100000)
        )
      })
    : route.geometry;
  if (geometry.type !== 'LineString') {
    throw routeError('踏勘路线必须是LineString。', 422, 'SURVEY_ROUTE_GEOMETRY_INVALID');
  }
  const now = options.now || new Date().toISOString();
  return repository.put({
    ...route,
    name: clean(input?.name ?? route.name, 200) || route.name,
    status,
    geometry,
    samples: input?.samples ? normalizedSamples(input, geometry) : route.samples,
    crs: input?.crs ? normalizeCrs(input.crs) : route.crs,
    routeRevision: Number(route.routeRevision || 1) + 1,
    updatedBy,
    updatedAt: now
  });
}

function parsedTime(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? time : null;
}

export async function cleanSurveyRoute(repository, routeId, input, options = {}) {
  const route = await repository.get(routeId);
  if (!route) throw routeError('踏勘路线不存在。', 404, 'SURVEY_ROUTE_NOT_FOUND');
  const expectedRevision = Number(input?.expectedRevision);
  if (Number.isFinite(expectedRevision) && expectedRevision !== Number(route.routeRevision || 1)) {
    throw routeError('踏勘路线已被其他操作修改。', 409, 'SURVEY_ROUTE_REVISION_CONFLICT');
  }
  const cleanedBy = clean(input?.cleanedBy, 120);
  if (!cleanedBy) throw routeError('请填写路线清洗人员。', 400, 'SURVEY_ROUTE_CLEANER_REQUIRED');
  const maxSpeedMps = Math.max(2, Math.min(100, Number(input?.maxSpeedMps) || 45));
  const maxAccuracyMeters = Math.max(5, Math.min(1000, Number(input?.maxAccuracyMeters) || 200));
  const accepted = [];
  const rejected = [];
  for (const [index, sample] of (route.samples || []).entries()) {
    const point = normalizePosition(sample.coordinates);
    if (sample.accuracyMeters != null && Number(sample.accuracyMeters) > maxAccuracyMeters) {
      rejected.push({
        index,
        reason: 'LOW_ACCURACY',
        coordinates: point,
        capturedAt: sample.capturedAt || null
      });
      continue;
    }
    const previous = accepted.at(-1);
    if (previous && previous.coordinates[0] === point[0] && previous.coordinates[1] === point[1]) {
      rejected.push({
        index,
        reason: 'DUPLICATE_POINT',
        coordinates: point,
        capturedAt: sample.capturedAt || null
      });
      continue;
    }
    const previousTime = parsedTime(previous?.capturedAt);
    const currentTime = parsedTime(sample.capturedAt);
    if (previous && previousTime != null && currentTime != null && currentTime > previousTime) {
      const speed = haversineMeters(previous.coordinates, point)
        / ((currentTime - previousTime) / 1000);
      if (speed > maxSpeedMps) {
        rejected.push({
          index,
          reason: 'IMPLAUSIBLE_SPEED',
          speedMps: speed,
          coordinates: point,
          capturedAt: sample.capturedAt || null
        });
        continue;
      }
    }
    accepted.push({ ...sample, coordinates: point, sourceIndex: index });
  }
  if (accepted.length < 2) {
    throw routeError('路线清洗后少于2个有效点。', 422, 'SURVEY_ROUTE_CLEANING_EMPTY');
  }
  const now = options.now || new Date().toISOString();
  return repository.put({
    ...route,
    geometry: {
      type: 'LineString',
      coordinates: accepted.map((sample) => sample.coordinates)
    },
    samples: accepted,
    cleaning: {
      ruleVersion: SURVEY_ROUTE_CLEANING_VERSION,
      maxSpeedMps,
      maxAccuracyMeters,
      sourcePointCount: route.samples.length,
      acceptedPointCount: accepted.length,
      removedPointCount: rejected.length,
      rejected,
      cleanedBy,
      cleanedAt: now
    },
    routeRevision: Number(route.routeRevision || 1) + 1,
    updatedAt: now,
    schemaVersion: '1.1.0'
  });
}

export async function detectSurveyStops(routeRepository, stopRepository, routeId, input, options = {}) {
  const route = await routeRepository.get(routeId);
  if (!route) throw routeError('踏勘路线不存在。', 404, 'SURVEY_ROUTE_NOT_FOUND');
  const detectedBy = clean(input?.detectedBy, 120);
  if (!detectedBy) throw routeError('请填写停留检测人员。', 400, 'SURVEY_STOP_OPERATOR_REQUIRED');
  const radiusMeters = Math.max(5, Math.min(200, Number(input?.radiusMeters) || 25));
  const minimumDurationSeconds = Math.max(
    30,
    Math.min(7200, Number(input?.minimumDurationSeconds) || 120)
  );
  const samples = route.samples || [];
  const candidates = [];
  let start = 0;
  while (start < samples.length - 1) {
    const startTime = parsedTime(samples[start].capturedAt);
    if (startTime == null) {
      start += 1;
      continue;
    }
    let end = start + 1;
    while (
      end < samples.length
      && haversineMeters(samples[start].coordinates, samples[end].coordinates) <= radiusMeters
    ) end += 1;
    const last = end - 1;
    const endTime = parsedTime(samples[last]?.capturedAt);
    const durationSeconds = endTime == null ? 0 : (endTime - startTime) / 1000;
    if (last > start && durationSeconds >= minimumDurationSeconds) {
      const group = samples.slice(start, end);
      candidates.push({
        id: `STOP-${options.idFactory ? options.idFactory(candidates.length) : randomUUID()}`,
        projectId: route.projectId,
        routeId: route.id,
        geometry: {
          type: 'Point',
          coordinates: [
            group.reduce((sum, item) => sum + item.coordinates[0], 0) / group.length,
            group.reduce((sum, item) => sum + item.coordinates[1], 0) / group.length
          ]
        },
        crs: route.crs,
        arrivedAt: samples[start].capturedAt,
        departedAt: samples[last].capturedAt,
        durationSeconds,
        status: 'candidate',
        ruleVersion: SURVEY_STOP_RULE_VERSION,
        routeRevision: route.routeRevision,
        confirmedBy: null,
        revision: 1,
        detectedBy,
        createdAt: options.now || new Date().toISOString()
      });
    }
    start = Math.max(end, start + 1);
  }
  if (typeof stopRepository.putMany === 'function') await stopRepository.putMany(candidates);
  else for (const candidate of candidates) await stopRepository.put(candidate);
  return candidates;
}

export async function reviewSurveyStop(repository, stopId, input, options = {}) {
  const stop = await repository.get(stopId);
  if (!stop) throw routeError('停留节点不存在。', 404, 'SURVEY_STOP_NOT_FOUND');
  const expectedRevision = Number(input?.expectedRevision);
  if (Number.isFinite(expectedRevision) && expectedRevision !== Number(stop.revision || 1)) {
    throw routeError('停留节点已被其他操作修改。', 409, 'SURVEY_STOP_REVISION_CONFLICT');
  }
  const status = clean(input?.status, 30);
  if (!['confirmed', 'rejected'].includes(status)) {
    throw routeError('停留节点状态必须为confirmed或rejected。', 400, 'SURVEY_STOP_STATUS_INVALID');
  }
  const confirmedBy = clean(input?.confirmedBy, 120);
  if (!confirmedBy) throw routeError('请填写停留节点确认人员。', 400, 'SURVEY_STOP_CONFIRMER_REQUIRED');
  const now = options.now || new Date().toISOString();
  return repository.put({
    ...stop,
    status,
    confirmedBy,
    confirmedAt: now,
    reviewNote: clean(input?.reviewNote, 1000) || null,
    revision: Number(stop.revision || 1) + 1,
    updatedAt: now
  });
}

export async function suggestPhotoRouteBindings(
  routeRepository,
  bindingRepository,
  routeId,
  photos,
  input,
  options = {}
) {
  const route = await routeRepository.get(routeId);
  if (!route) throw routeError('踏勘路线不存在。', 404, 'SURVEY_ROUTE_NOT_FOUND');
  const suggestedBy = clean(input?.suggestedBy, 120);
  if (!suggestedBy) throw routeError('请填写照片关联操作人员。', 400, 'PHOTO_ROUTE_OPERATOR_REQUIRED');
  const maximumDistanceMeters = Math.max(
    5,
    Math.min(1000, Number(input?.maximumDistanceMeters) || 100)
  );
  const maximumTimeDifferenceSeconds = Math.max(
    0,
    Math.min(86400, Number(input?.maximumTimeDifferenceSeconds) || 1800)
  );
  const bindings = [];
  for (const photo of Array.isArray(photos) ? photos : []) {
    if (!Array.isArray(photo.coordinates)) continue;
    const photoTime = parsedTime(photo.capturedAt);
    let best = null;
    for (const [sampleIndex, sample] of (route.samples || []).entries()) {
      const distanceMeters = haversineMeters(photo.coordinates, sample.coordinates);
      const sampleTime = parsedTime(sample.capturedAt);
      const timeDifferenceSeconds = photoTime == null || sampleTime == null
        ? null
        : Math.abs(photoTime - sampleTime) / 1000;
      if (distanceMeters > maximumDistanceMeters) continue;
      if (
        timeDifferenceSeconds != null
        && timeDifferenceSeconds > maximumTimeDifferenceSeconds
      ) continue;
      const score = distanceMeters + (timeDifferenceSeconds == null ? 0 : timeDifferenceSeconds / 30);
      if (!best || score < best.score) {
        best = { sampleIndex, distanceMeters, timeDifferenceSeconds, score };
      }
    }
    if (!best) continue;
    const now = options.now || new Date().toISOString();
    const binding = {
      id: `PRB-${options.idFactory ? options.idFactory(bindings.length) : randomUUID()}`,
      projectId: route.projectId,
      photoId: String(photo.id),
      routeId: route.id,
      stopId: null,
      routeSampleIndex: best.sampleIndex,
      distanceMeters: Math.round(best.distanceMeters * 10) / 10,
      timeDifferenceSeconds: best.timeDifferenceSeconds == null
        ? null
        : Math.round(best.timeDifferenceSeconds),
      source: 'automatic',
      ruleVersion: PHOTO_ROUTE_BINDING_RULE_VERSION,
      routeRevision: route.routeRevision,
      photoMetadataRevision: Number(photo.metadataRevision) || 0,
      status: 'suggested',
      revision: 1,
      suggestedBy,
      confirmedBy: null,
      createdAt: now,
      updatedAt: now
    };
    bindings.push(binding);
  }
  if (typeof bindingRepository.putMany === 'function') await bindingRepository.putMany(bindings);
  else for (const binding of bindings) await bindingRepository.put(binding);
  return bindings;
}

export async function reviewPhotoRouteBinding(repository, bindingId, input, options = {}) {
  const binding = await repository.get(bindingId);
  if (!binding) throw routeError('照片路线关联不存在。', 404, 'PHOTO_ROUTE_BINDING_NOT_FOUND');
  const expectedRevision = Number(input?.expectedRevision);
  if (Number.isFinite(expectedRevision) && expectedRevision !== Number(binding.revision || 1)) {
    throw routeError('照片路线关联已被其他操作修改。', 409, 'PHOTO_ROUTE_BINDING_REVISION_CONFLICT');
  }
  const status = clean(input?.status, 30);
  if (!['confirmed', 'rejected'].includes(status)) {
    throw routeError('关联状态必须为confirmed或rejected。', 400, 'PHOTO_ROUTE_BINDING_STATUS_INVALID');
  }
  const confirmedBy = clean(input?.confirmedBy, 120);
  if (!confirmedBy) throw routeError('请填写关联确认人员。', 400, 'PHOTO_ROUTE_BINDING_CONFIRMER_REQUIRED');
  const now = options.now || new Date().toISOString();
  return repository.put({
    ...binding,
    status,
    confirmedBy,
    confirmedAt: now,
    revision: Number(binding.revision || 1) + 1,
    updatedAt: now
  });
}
