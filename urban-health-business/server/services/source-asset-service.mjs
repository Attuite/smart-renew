import { createHash, randomUUID } from 'node:crypto';

const MAX_ASSET_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'application/geo+json',
  'application/gpx+xml',
  'text/csv',
  'text/plain',
  'application/vnd.sqlite3',
  'application/x-sqlite3',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip'
]);
const CATEGORIES = new Set(['gis', 'survey', 'document', 'drone', 'other']);

function clean(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function assetError(message, status = 400, code = 'SOURCE_ASSET_VALIDATION_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function activeCommunities(project) {
  return (Array.isArray(project?.residentialInventory?.items) ? project.residentialInventory.items : [])
    .filter((item) => item?.status !== 'deleted');
}

export async function createSourceAsset(client, repository, projectId, input, options = {}) {
  const project = await client.getProject(projectId);
  const name = clean(input?.name, 240);
  const mimeType = clean(input?.mimeType, 160).toLowerCase();
  const size = Number(input?.size);
  const category = clean(input?.category, 40).toLowerCase() || 'other';
  const clientRequestId = clean(input?.clientRequestId, 160);
  if (!name) throw assetError('请填写资料文件名。', 400, 'SOURCE_ASSET_NAME_REQUIRED');
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw assetError('当前资料格式不支持，请上传PDF、JSON/GeoJSON、GPX、CSV、SQLite、TXT、XLSX、DOCX或ZIP。', 415, 'SOURCE_ASSET_TYPE_UNSUPPORTED');
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_ASSET_SIZE) {
    throw assetError('资料文件大小必须在1字节到20MB之间。', 413, 'SOURCE_ASSET_SIZE_INVALID');
  }
  if (!CATEGORIES.has(category)) throw assetError('资料分类无效。', 400, 'SOURCE_ASSET_CATEGORY_INVALID');
  if (!clientRequestId) throw assetError('缺少资料上传幂等编号。', 400, 'CLIENT_REQUEST_ID_REQUIRED');
  const duplicated = await repository.findByClientRequest(String(project.id), clientRequestId);
  if (duplicated) return { asset: duplicated, duplicated: true };

  const communityId = clean(input?.communityId, 160);
  let community = null;
  if (communityId) {
    community = activeCommunities(project)
      .find((item) => String(item.id || item.sourceId) === communityId);
    if (!community) throw assetError('资料关联的小区不存在或已停用。', 400, 'COMMUNITY_NOT_FOUND');
  }
  const now = options.now || new Date().toISOString();
  const asset = {
    id: options.id || `ASSET-${randomUUID()}`,
    clientRequestId,
    projectId: String(project.id),
    name,
    mimeType,
    size,
    category,
    communityId: communityId || null,
    communityName: community?.name || '',
    notes: clean(input?.notes, 2000),
    status: 'ready',
    uploadStatus: 'ready',
    contentHash: null,
    assetRevision: 1,
    createdBy: clean(input?.createdBy, 120),
    createdAt: now,
    updatedAt: now,
    schemaVersion: '1.0.0'
  };
  if (!asset.createdBy) throw assetError('请填写资料上传人员。', 400, 'SOURCE_ASSET_CREATOR_REQUIRED');
  await repository.put(asset);
  return { asset, duplicated: false };
}

export async function uploadSourceAssetContent(repository, assetId, content, mimeType, options = {}) {
  const asset = await repository.get(assetId);
  if (!asset) throw assetError('资料资产不存在。', 404, 'SOURCE_ASSET_NOT_FOUND');
  if (!content?.length) throw assetError('资料文件内容为空。', 400, 'SOURCE_ASSET_CONTENT_REQUIRED');
  if (content.length !== Number(asset.size)) {
    const failed = {
      ...asset,
      uploadStatus: 'failed',
      error: { code: 'SOURCE_ASSET_SIZE_MISMATCH', message: '实际文件大小与登记大小不一致。' },
      updatedAt: options.now || new Date().toISOString()
    };
    await repository.put(failed);
    throw assetError('实际文件大小与登记大小不一致。', 400, 'SOURCE_ASSET_SIZE_MISMATCH');
  }
  const actualMimeType = clean(mimeType, 160).toLowerCase();
  if (actualMimeType && actualMimeType !== asset.mimeType && actualMimeType !== 'application/octet-stream') {
    await repository.put({
      ...asset,
      uploadStatus: 'failed',
      error: { code: 'SOURCE_ASSET_MIME_MISMATCH', message: '实际文件类型与登记类型不一致。' },
      updatedAt: options.now || new Date().toISOString()
    });
    throw assetError('实际文件类型与登记类型不一致。', 415, 'SOURCE_ASSET_MIME_MISMATCH');
  }
  const contentHash = createHash('sha256').update(content).digest('hex');
  if (asset.uploadStatus === 'completed') {
    if (asset.contentHash === contentHash) return asset;
    throw assetError(
      '已完成的资料二进制不可覆盖，请登记为新的资料版本。',
      409,
      'SOURCE_ASSET_CONTENT_IMMUTABLE'
    );
  }
  const duplicated = (await repository.list(asset.projectId, true))
    .find((item) =>
      item.id !== asset.id
      && item.uploadStatus === 'completed'
      && item.contentHash === contentHash
    );
  if (duplicated) {
    const now = options.now || new Date().toISOString();
    const duplicateRecord = {
      ...asset,
      status: 'inactive',
      uploadStatus: 'duplicate',
      contentHash,
      duplicateOf: duplicated.id,
      error: null,
      updatedAt: now,
      duplicateDetectedAt: now
    };
    await repository.put(duplicateRecord);
    return duplicateRecord;
  }
  await repository.writeContent(asset.id, content);
  const now = options.now || new Date().toISOString();
  const completed = {
    ...asset,
    status: 'active',
    uploadStatus: 'completed',
    contentHash,
    error: null,
    updatedAt: now,
    completedAt: now
  };
  await repository.put(completed);
  return completed;
}

export async function updateSourceAsset(client, repository, projectId, assetId, input, options = {}) {
  const [project, asset] = await Promise.all([
    client.getProject(projectId),
    repository.get(assetId)
  ]);
  if (!asset || String(asset.projectId) !== String(project.id)) {
    throw assetError('资料资产不存在或不属于当前项目。', 404, 'SOURCE_ASSET_NOT_FOUND');
  }
  const currentRevision = Math.max(1, Number(asset.assetRevision) || 1);
  if (input?.expectedRevision !== undefined && Number(input.expectedRevision) !== currentRevision) {
    throw assetError('资料资产已被其他操作修改，请刷新后重试。', 409, 'SOURCE_ASSET_REVISION_CONFLICT');
  }
  const updatedBy = clean(input?.updatedBy, 120);
  if (!updatedBy) throw assetError('请填写资料治理人员。', 400, 'SOURCE_ASSET_EDITOR_REQUIRED');
  const status = input?.status === undefined ? asset.status : clean(input.status, 20);
  if (input?.status !== undefined && !['active', 'inactive'].includes(status)) {
    throw assetError('资料状态无效。', 400, 'SOURCE_ASSET_STATUS_INVALID');
  }
  const category = clean(input?.category ?? asset.category, 40).toLowerCase();
  if (!CATEGORIES.has(category)) throw assetError('资料分类无效。', 400, 'SOURCE_ASSET_CATEGORY_INVALID');
  const communityId = clean(input?.communityId ?? asset.communityId, 160);
  let community = null;
  if (communityId) {
    community = activeCommunities(project)
      .find((item) => String(item.id || item.sourceId) === communityId);
    if (!community) throw assetError('资料关联的小区不存在或已停用。', 400, 'COMMUNITY_NOT_FOUND');
  }
  const now = options.now || new Date().toISOString();
  return repository.put({
    ...asset,
    name: clean(input?.name ?? asset.name, 240),
    category,
    communityId: communityId || null,
    communityName: community?.name || '',
    notes: clean(input?.notes ?? asset.notes, 2000),
    status,
    assetRevision: currentRevision + 1,
    updatedBy,
    updatedAt: now
  });
}

export { ALLOWED_MIME_TYPES, MAX_ASSET_SIZE };
