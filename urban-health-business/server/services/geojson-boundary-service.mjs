import { updateProjectBoundary } from './project-service.mjs';

function boundaryImportError(message, status = 400, code = 'GEOJSON_BOUNDARY_INVALID') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function polygonGeometries(document) {
  if (!document || typeof document !== 'object') return [];
  if (document.type === 'FeatureCollection') {
    return (Array.isArray(document.features) ? document.features : [])
      .map((feature) => feature?.geometry)
      .filter((geometry) => ['Polygon', 'MultiPolygon'].includes(geometry?.type));
  }
  if (document.type === 'Feature') {
    return ['Polygon', 'MultiPolygon'].includes(document.geometry?.type)
      ? [document.geometry]
      : [];
  }
  return ['Polygon', 'MultiPolygon'].includes(document.type) ? [document] : [];
}

export function parseGeoJsonBoundary(content) {
  let document;
  try {
    document = JSON.parse(Buffer.isBuffer(content) ? content.toString('utf8') : String(content));
  } catch {
    throw boundaryImportError('资料内容不是有效的JSON。', 400, 'GEOJSON_PARSE_FAILED');
  }
  const geometries = polygonGeometries(document);
  if (!geometries.length) {
    throw boundaryImportError('GeoJSON中没有可用的Polygon项目边界。', 400, 'GEOJSON_POLYGON_NOT_FOUND');
  }
  if (geometries.length > 1) {
    throw boundaryImportError('GeoJSON包含多个面，当前项目边界只能明确导入一个面。', 409, 'GEOJSON_BOUNDARY_AMBIGUOUS');
  }
  const geometry = geometries[0];
  let polygon;
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 1) {
      throw boundaryImportError('MultiPolygon包含多个分离面，当前项目边界模型暂不支持。', 422, 'GEOJSON_MULTIPOLYGON_UNSUPPORTED');
    }
    [polygon] = geometry.coordinates;
  } else {
    polygon = geometry.coordinates;
  }
  if (!Array.isArray(polygon) || polygon.length !== 1 || !Array.isArray(polygon[0])) {
    throw boundaryImportError('带孔洞或结构无效的Polygon暂不能导入为项目边界。', 422, 'GEOJSON_POLYGON_HOLES_UNSUPPORTED');
  }
  return polygon[0];
}

export async function importBoundaryFromSourceAsset(client, repository, projectId, input) {
  const sourceAssetId = String(input?.sourceAssetId || '').trim();
  const updatedBy = String(input?.updatedBy || '').trim().slice(0, 120);
  if (!sourceAssetId) {
    throw boundaryImportError('请选择要导入的GeoJSON资料。', 400, 'SOURCE_ASSET_ID_REQUIRED');
  }
  if (!updatedBy) {
    throw boundaryImportError('请填写边界导入人员。', 400, 'BOUNDARY_IMPORT_EDITOR_REQUIRED');
  }
  const asset = await repository.get(sourceAssetId);
  if (!asset || String(asset.projectId) !== String(projectId)) {
    throw boundaryImportError('GeoJSON资料不存在或不属于当前项目。', 404, 'SOURCE_ASSET_NOT_FOUND');
  }
  if (asset.status !== 'active' || asset.uploadStatus !== 'completed') {
    throw boundaryImportError('只有已上传完成且使用中的资料可以导入边界。', 409, 'SOURCE_ASSET_NOT_ACTIVE');
  }
  if (
    asset.category !== 'gis'
    || !['application/json', 'application/geo+json'].includes(asset.mimeType)
  ) {
    throw boundaryImportError('只有GIS分类的JSON或GeoJSON资料可以导入边界。', 415, 'SOURCE_ASSET_NOT_GEOJSON');
  }
  const content = await repository.readContent(asset.id);
  if (!content) {
    throw boundaryImportError('资料文件内容不存在。', 404, 'SOURCE_ASSET_CONTENT_NOT_FOUND');
  }
  const coordinates = parseGeoJsonBoundary(content);
  return updateProjectBoundary(client, projectId, {
    coordinates,
    crs: input?.crs || 'WGS84',
    updatedBy,
    expectedRevision: input?.expectedRevision,
    source: 'source-asset-geojson',
    sourceAssetId: asset.id,
    sourceAssetContentHash: asset.contentHash
  });
}
