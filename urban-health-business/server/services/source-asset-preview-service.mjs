function previewError(message, status = 400, code = 'SOURCE_ASSET_PREVIEW_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function parseCsv(content, maxRows = 100) {
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content || '');
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field.replace(/\r$/, ''));
      records.push(record);
      record = [];
      field = '';
    } else field += character;
  }
  if (quoted) throw previewError('CSV存在未闭合的引号。', 422, 'CSV_QUOTE_UNCLOSED');
  if (field || record.length) {
    record.push(field.replace(/\r$/, ''));
    records.push(record);
  }
  const nonEmpty = records.filter((row) => row.some((value) => String(value).trim()));
  if (!nonEmpty.length) throw previewError('CSV没有可预览的数据。', 422, 'CSV_EMPTY');
  const columns = nonEmpty[0].map((value, index) => String(value).trim() || `column_${index + 1}`);
  const data = nonEmpty.slice(1);
  return {
    kind: 'csv',
    columns,
    rows: data.slice(0, maxRows).map((row) =>
      Object.fromEntries(columns.map((column, index) => [column, row[index] ?? '']))
    ),
    totalRows: data.length,
    truncated: data.length > maxRows
  };
}

function jsonPreview(content, maxRows) {
  let value;
  try {
    value = JSON.parse(Buffer.isBuffer(content) ? content.toString('utf8') : String(content || ''));
  } catch {
    throw previewError('JSON内容无法解析。', 422, 'JSON_PARSE_FAILED');
  }
  if (value?.type === 'FeatureCollection' && Array.isArray(value.features)) {
    const geometryTypes = [...new Set(value.features.map((feature) => feature?.geometry?.type).filter(Boolean))];
    const propertyKeys = [...new Set(value.features.flatMap((feature) =>
      feature?.properties && typeof feature.properties === 'object'
        ? Object.keys(feature.properties)
        : []
    ))];
    return {
      kind: 'geojson-feature-collection',
      featureCount: value.features.length,
      geometryTypes,
      propertyKeys
    };
  }
  if (value?.type === 'Feature' && value.geometry) {
    return {
      kind: 'geojson-feature',
      featureCount: 1,
      geometryTypes: value.geometry.type ? [value.geometry.type] : [],
      propertyKeys: value.properties && typeof value.properties === 'object'
        ? Object.keys(value.properties)
        : []
    };
  }
  if (Array.isArray(value)) {
    const rows = value.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
    const columns = [...new Set(rows.flatMap(Object.keys))];
    return {
      kind: 'json-array',
      columns,
      rows: rows.slice(0, maxRows),
      totalRows: rows.length,
      truncated: rows.length > maxRows
    };
  }
  if (value && typeof value === 'object') {
    return { kind: 'json-object', keys: Object.keys(value) };
  }
  return { kind: 'json-scalar', valueType: typeof value };
}

export async function previewSourceAsset(repository, assetId, maxRows = 100) {
  const asset = await repository.get(assetId);
  if (!asset) throw previewError('资料资产不存在。', 404, 'SOURCE_ASSET_NOT_FOUND');
  if (asset.status !== 'active' || asset.uploadStatus !== 'completed') {
    throw previewError('只有使用中且上传完成的资料可以预览。', 409, 'SOURCE_ASSET_NOT_ACTIVE');
  }
  const content = await repository.readContent(asset.id);
  if (!content) throw previewError('资料二进制不存在。', 404, 'SOURCE_ASSET_CONTENT_NOT_FOUND');
  let preview;
  if (asset.mimeType === 'text/csv') preview = parseCsv(content, maxRows);
  else if (['application/json', 'application/geo+json'].includes(asset.mimeType)) {
    preview = jsonPreview(content, maxRows);
  } else {
    throw previewError('当前只支持CSV、JSON和GeoJSON结构预览。', 415, 'SOURCE_ASSET_PREVIEW_UNSUPPORTED');
  }
  return {
    asset: {
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      contentHash: asset.contentHash,
      assetRevision: asset.assetRevision
    },
    preview
  };
}
