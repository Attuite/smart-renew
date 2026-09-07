import { createSurveyRoute } from './survey-route-service.mjs';

function importError(message, status = 400, code = 'SURVEY_ROUTE_IMPORT_INVALID', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function clean(value, maximum = 300) {
  return String(value || '').trim().slice(0, maximum);
}

function parseGeoJson(text, featureIndex = 0) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw importError('路线GeoJSON不是有效JSON。', 400, 'SURVEY_ROUTE_GEOJSON_INVALID');
  }
  const features = parsed?.type === 'FeatureCollection'
    ? parsed.features || []
    : [parsed?.type === 'Feature' ? parsed : { type: 'Feature', geometry: parsed, properties: {} }];
  const feature = features[Number(featureIndex) || 0];
  if (!feature) {
    throw importError('所选GeoJSON图层不存在。', 400, 'SURVEY_ROUTE_FEATURE_NOT_FOUND');
  }
  const geometry = feature.geometry;
  if (geometry?.type !== 'LineString') {
    throw importError(
      '路线资料必须选择LineString图层。',
      422,
      'SURVEY_ROUTE_GEOJSON_GEOMETRY_INVALID'
    );
  }
  const times = Array.isArray(feature.properties?.coordinateTimes)
    ? feature.properties.coordinateTimes
    : Array.isArray(feature.properties?.times)
      ? feature.properties.times
      : [];
  return {
    geometry,
    samples: geometry.coordinates.map((coordinates, index) => ({
      coordinates,
      capturedAt: clean(times[index], 80) || null,
      accuracyMeters: null
    })),
    suggestedName: clean(feature.properties?.name, 200)
  };
}

function xmlAttribute(source, name) {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(source);
  return match?.[1] || '';
}

function xmlElement(source, name) {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)<\\/${name}>`, 'i').exec(source);
  return clean(match?.[1], 120) || null;
}

function parseGpx(text) {
  const samples = [];
  const pattern = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi;
  let match;
  while ((match = pattern.exec(text))) {
    const longitude = Number(xmlAttribute(match[1], 'lon'));
    const latitude = Number(xmlAttribute(match[1], 'lat'));
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
    samples.push({
      coordinates: [longitude, latitude],
      capturedAt: xmlElement(match[2], 'time'),
      accuracyMeters: Number(xmlElement(match[2], 'hdop')) || null
    });
  }
  if (samples.length < 2) {
    throw importError('GPX中未找到至少2个有效trkpt轨迹点。', 422, 'SURVEY_ROUTE_GPX_EMPTY');
  }
  return {
    geometry: {
      type: 'LineString',
      coordinates: samples.map((sample) => sample.coordinates)
    },
    samples,
    suggestedName: xmlElement(text, 'name')
  };
}

function csvColumns(header) {
  const aliases = {
    longitude: ['longitude', 'lon', 'lng', '经度'],
    latitude: ['latitude', 'lat', '纬度'],
    capturedAt: ['capturedat', 'time', 'timestamp', 'datetime', '采集时间', '时间'],
    accuracyMeters: ['accuracymeters', 'accuracy', '精度', '定位精度']
  };
  const normalized = header.map((value) => clean(value, 80).toLowerCase());
  return Object.fromEntries(Object.entries(aliases).map(([key, names]) => [
    key,
    normalized.findIndex((value) => names.includes(value))
  ]));
}

function parseCsv(text) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length < 3) {
    throw importError('路线CSV必须包含表头和至少2个采样点。', 422, 'SURVEY_ROUTE_CSV_EMPTY');
  }
  const delimiter = rows[0].includes('\t') ? '\t' : ',';
  const header = rows.shift().split(delimiter);
  const columns = csvColumns(header);
  if (columns.longitude < 0 || columns.latitude < 0) {
    throw importError('路线CSV必须包含经度和纬度列。', 422, 'SURVEY_ROUTE_CSV_COLUMNS_MISSING');
  }
  const samples = rows.map((row, index) => {
    const values = row.split(delimiter).map((value) => value.trim());
    const longitude = Number(values[columns.longitude]);
    const latitude = Number(values[columns.latitude]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw importError(
        `路线CSV第${index + 2}行经纬度无效。`,
        422,
        'SURVEY_ROUTE_CSV_COORDINATE_INVALID',
        { row: index + 2 }
      );
    }
    const accuracy = columns.accuracyMeters < 0 ? null : Number(values[columns.accuracyMeters]);
    return {
      coordinates: [longitude, latitude],
      capturedAt: columns.capturedAt < 0 ? null : clean(values[columns.capturedAt], 80) || null,
      accuracyMeters: Number.isFinite(accuracy) ? Math.max(0, accuracy) : null
    };
  });
  return {
    geometry: {
      type: 'LineString',
      coordinates: samples.map((sample) => sample.coordinates)
    },
    samples,
    suggestedName: ''
  };
}

export function parseSurveyRouteAsset(asset, content, input = {}) {
  const text = content?.toString('utf8') || '';
  if (!text.trim()) {
    throw importError('路线资料内容为空。', 400, 'SURVEY_ROUTE_ASSET_CONTENT_REQUIRED');
  }
  const name = clean(asset?.name, 240).toLowerCase();
  const mimeType = clean(asset?.mimeType, 160).toLowerCase();
  if (name.endsWith('.gpx') || mimeType.includes('gpx') || /<gpx[\s>]/i.test(text.slice(0, 500))) {
    return { ...parseGpx(text), sourceKind: 'gpx' };
  }
  if (
    name.endsWith('.geojson')
    || name.endsWith('.json')
    || mimeType === 'application/geo+json'
    || mimeType === 'application/json'
  ) {
    return {
      ...parseGeoJson(text, input.featureIndex),
      sourceKind: 'geojson'
    };
  }
  if (name.endsWith('.csv') || mimeType === 'text/csv' || mimeType === 'text/plain') {
    return { ...parseCsv(text), sourceKind: 'csv' };
  }
  throw importError(
    '当前路线资料仅支持GPX、GeoJSON和CSV。',
    415,
    'SURVEY_ROUTE_ASSET_TYPE_UNSUPPORTED'
  );
}

export async function importSurveyRouteFromSourceAsset(
  client,
  assetRepository,
  routeRepository,
  projectId,
  input,
  options = {}
) {
  const asset = await assetRepository.get(input?.sourceAssetId);
  if (
    !asset
    || String(asset.projectId) !== String(projectId)
    || asset.status !== 'active'
    || asset.uploadStatus !== 'completed'
  ) {
    throw importError(
      '路线资料不存在、未上传完成或不属于当前项目。',
      404,
      'SURVEY_ROUTE_SOURCE_ASSET_NOT_READY'
    );
  }
  const content = await assetRepository.readContent(asset.id);
  const parsed = parseSurveyRouteAsset(asset, content, input);
  return createSurveyRoute(client, routeRepository, projectId, {
    name: clean(input?.name, 200) || parsed.suggestedName || asset.name,
    crs: input?.crs || 'WGS84',
    geometry: parsed.geometry,
    samples: parsed.samples,
    source: {
      kind: parsed.sourceKind,
      assetId: asset.id,
      contentHash: asset.contentHash
    },
    createdBy: input?.createdBy
  }, options);
}
