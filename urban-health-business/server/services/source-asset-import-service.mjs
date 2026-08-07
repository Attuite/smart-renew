import { randomUUID } from 'node:crypto';
import {
  appendBuilding,
  appendCommunity
} from './project-service.mjs';
import { parseCsv } from './source-asset-preview-service.mjs';

const TARGETS = new Set(['communities', 'buildings']);

function importError(message, status = 400, code = 'SOURCE_ASSET_IMPORT_INVALID', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function clean(value, maxLength = 240) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function structuredRows(asset, content) {
  if (asset.mimeType === 'text/csv') {
    const preview = parseCsv(content, 501);
    if (preview.totalRows > 500) {
      throw importError('单次最多导入500行。', 413, 'SOURCE_ASSET_IMPORT_TOO_LARGE');
    }
    return { columns: preview.columns, rows: preview.rows };
  }
  if (asset.mimeType === 'application/json') {
    let value;
    try {
      value = JSON.parse(content.toString('utf8'));
    } catch {
      throw importError('JSON内容无法解析。', 422, 'JSON_PARSE_FAILED');
    }
    if (!Array.isArray(value)) {
      throw importError('业务对象导入只接受JSON对象数组。', 422, 'JSON_ARRAY_REQUIRED');
    }
    if (!value.length || value.length > 500) {
      throw importError('JSON数组必须包含1到500行。', 413, 'SOURCE_ASSET_IMPORT_SIZE_INVALID');
    }
    if (value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      throw importError('JSON数组的每一项必须是对象。', 422, 'JSON_ROW_INVALID');
    }
    return {
      columns: [...new Set(value.flatMap(Object.keys))],
      rows: value
    };
  }
  throw importError('当前只有CSV和JSON数组可导入业务对象。', 415, 'SOURCE_ASSET_IMPORT_UNSUPPORTED');
}

function mapped(row, mapping, field, required = false) {
  const column = clean(mapping?.[field]);
  if (!column) {
    if (required) throw importError(`缺少${field}字段映射。`, 400, 'SOURCE_ASSET_MAPPING_REQUIRED', { field });
    return '';
  }
  return row[column];
}

function validateMappingColumns(columns, mapping) {
  const available = new Set(columns);
  for (const [field, columnValue] of Object.entries(mapping || {})) {
    const column = clean(columnValue);
    if (column && !available.has(column)) {
      throw importError(`映射字段${field}引用了不存在的列${column}。`, 400, 'SOURCE_ASSET_MAPPING_COLUMN_NOT_FOUND', {
        field,
        column
      });
    }
  }
}

function activeCommunity(project, communityId) {
  return (Array.isArray(project?.residentialInventory?.items) ? project.residentialInventory.items : [])
    .find((item) =>
      item?.status !== 'deleted'
      && String(item.id || item.sourceId) === String(communityId)
    );
}

export async function importSourceAsset(
  client,
  assetRepository,
  importRepository,
  projectId,
  assetId,
  input,
  options = {}
) {
  const target = clean(input?.target, 40);
  if (!TARGETS.has(target)) {
    throw importError('导入目标必须为communities或buildings。', 400, 'SOURCE_ASSET_IMPORT_TARGET_INVALID');
  }
  const importedBy = clean(input?.importedBy, 120);
  if (!importedBy) throw importError('请填写资料导入人员。', 400, 'SOURCE_ASSET_IMPORTER_REQUIRED');
  const clientRequestId = clean(input?.clientRequestId, 160);
  if (!clientRequestId) throw importError('缺少导入幂等编号。', 400, 'CLIENT_REQUEST_ID_REQUIRED');
  const existingRun = await importRepository.findByClientRequest(String(projectId), clientRequestId);
  if (existingRun) return { run: existingRun, duplicated: true };

  const [project, asset] = await Promise.all([
    client.getProject(projectId),
    assetRepository.get(assetId)
  ]);
  if (!asset || String(asset.projectId) !== String(project.id)) {
    throw importError('资料资产不存在或不属于当前项目。', 404, 'SOURCE_ASSET_NOT_FOUND');
  }
  if (asset.status !== 'active' || asset.uploadStatus !== 'completed') {
    throw importError('只有使用中且上传完成的资料可以导入。', 409, 'SOURCE_ASSET_NOT_ACTIVE');
  }
  const currentRevision = Math.max(0, Number(project.revision) || 0);
  if (
    input?.expectedProjectRevision !== undefined
    && Number(input.expectedProjectRevision) !== currentRevision
  ) {
    throw importError('项目已被其他操作修改，请刷新后重新确认映射。', 409, 'PROJECT_REVISION_CONFLICT');
  }
  const content = await assetRepository.readContent(asset.id);
  if (!content) throw importError('资料二进制不存在。', 404, 'SOURCE_ASSET_CONTENT_NOT_FOUND');
  const { columns, rows } = structuredRows(asset, content);
  const mapping = input?.mapping && typeof input.mapping === 'object' ? input.mapping : {};
  validateMappingColumns(columns, mapping);

  let workingProject = project;
  const importedItems = [];
  if (target === 'communities') {
    mapped(rows[0], mapping, 'name', true);
    const existingNames = new Set(
      (Array.isArray(project?.residentialInventory?.items) ? project.residentialInventory.items : [])
        .filter((item) => item?.status !== 'deleted')
        .map((item) => clean(item.name).toLowerCase())
    );
    for (let index = 0; index < rows.length; index += 1) {
      const name = clean(mapped(rows[index], mapping, 'name', true), 160);
      if (!name) throw importError(`第${index + 1}行小区名称为空。`, 422, 'SOURCE_ASSET_IMPORT_ROW_INVALID', { row: index + 1 });
      const normalized = name.toLowerCase();
      if (existingNames.has(normalized)) {
        throw importError(`第${index + 1}行小区名称${name}重复。`, 409, 'SOURCE_ASSET_IMPORT_DUPLICATE_NAME', { row: index + 1 });
      }
      const outcome = appendCommunity(workingProject, {
        name,
        address: clean(mapped(rows[index], mapping, 'address'), 300)
      }, {
        idSuffix: `import-${asset.id}-${index + 1}`,
        now: options.now || new Date().toISOString()
      });
      workingProject = outcome.project;
      importedItems.push({ id: outcome.community.id, name: outcome.community.name });
      existingNames.add(normalized);
    }
  } else {
    mapped(rows[0], mapping, 'name', true);
    const communityId = clean(input?.communityId, 160);
    const community = activeCommunity(project, communityId);
    if (!community) throw importError('请选择当前项目中使用中的小区。', 400, 'COMMUNITY_NOT_FOUND');
    const existingNames = new Set(
      (Array.isArray(community.buildings) ? community.buildings : [])
        .filter((item) => item?.status !== 'deleted')
        .map((item) => clean(item.name).toLowerCase())
    );
    for (let index = 0; index < rows.length; index += 1) {
      const name = clean(mapped(rows[index], mapping, 'name', true), 160);
      if (!name) throw importError(`第${index + 1}行楼栋名称为空。`, 422, 'SOURCE_ASSET_IMPORT_ROW_INVALID', { row: index + 1 });
      const normalized = name.toLowerCase();
      if (existingNames.has(normalized)) {
        throw importError(`第${index + 1}行楼栋名称${name}重复。`, 409, 'SOURCE_ASSET_IMPORT_DUPLICATE_NAME', { row: index + 1 });
      }
      const outcome = appendBuilding(workingProject, communityId, {
        name,
        address: clean(mapped(rows[index], mapping, 'address'), 300),
        householdCount: mapped(rows[index], mapping, 'householdCount'),
        unitCount: mapped(rows[index], mapping, 'unitCount'),
        floorCount: mapped(rows[index], mapping, 'floorCount')
      }, {
        idSuffix: `import-${asset.id}-${index + 1}`,
        now: options.now || new Date().toISOString()
      });
      workingProject = outcome.project;
      importedItems.push({ id: outcome.building.id, name: outcome.building.name, communityId });
      existingNames.add(normalized);
    }
  }
  await client.putProject(workingProject);
  const completedAt = options.now || new Date().toISOString();
  const run = {
    id: options.id || `ASSETIMP-${randomUUID()}`,
    clientRequestId,
    projectId: String(project.id),
    assetId: asset.id,
    assetName: asset.name,
    sourceContentHash: asset.contentHash,
    sourceAssetRevision: Number(asset.assetRevision) || 1,
    target,
    communityId: target === 'buildings' ? clean(input.communityId, 160) : null,
    mapping,
    status: 'completed',
    importedCount: importedItems.length,
    importedItems,
    projectRevisionBefore: currentRevision,
    projectRevisionAfter: Number(workingProject.revision) || currentRevision,
    importedBy,
    completedAt,
    schemaVersion: '1.0.0'
  };
  await importRepository.put(run);
  return { run, project: workingProject, duplicated: false };
}

export { structuredRows };
