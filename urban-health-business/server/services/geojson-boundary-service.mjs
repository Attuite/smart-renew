import { updateProjectBoundary } from './project-service.mjs';
import { validateBoundaryGeometry } from './spatial-geometry-service.mjs';

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

export function parseGeoJsonBoundaryGeometry(content, options = {}) {
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
  const featureIndex = options.featureIndex === undefined ? null : Number(options.featureIndex);
  if (geometries.length > 1 && !Number.isInteger(featureIndex)) {
    throw boundaryImportError('GeoJSON包含多个面，当前项目边界只能明确导入一个面。', 409, 'GEOJSON_BOUNDARY_AMBIGUOUS');
  }
  const geometry = Number.isInteger(featureIndex) ? geometries[featureIndex] : geometries[0];
  if (!geometry) {
    throw boundaryImportError('选择的GeoJSON面不存在。', 404, 'GEOJSON_FEATURE_NOT_FOUND');
  }
  try {
    return validateBoundaryGeometry(geometry, { maxPoints: 50000 });
  } catch (error) {
    if (error.code) throw error;
    throw boundaryImportError('GeoJSON项目边界结构无效。');
  }
}

export function parseGeoJsonBoundary(content) {
  const geometry = parseGeoJsonBoundaryGeometry(content);
  if (geometry.type !== 'Polygon' || geometry.coordinates.length !== 1) {
    throw boundaryImportError(
      '当前调用需要单一无孔洞Polygon；请使用完整Geometry接口。',
      422,
      'GEOJSON_COMPLEX_BOUNDARY_REQUIRES_GEOMETRY'
    );
  }
  return geometry.coordinates[0];
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
  const geometry = parseGeoJsonBoundaryGeometry(content, {
    featureIndex: input?.featureIndex
  });
  return updateProjectBoundary(client, projectId, {
    geometry,
    crs: input?.crs || 'WGS84',
    updatedBy,
    expectedRevision: input?.expectedRevision,
    source: 'source-asset-geojson',
    sourceAssetId: asset.id,
    sourceAssetContentHash: asset.contentHash
  });
}
