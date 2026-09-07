import { createHash, randomUUID } from 'node:crypto';
import { extractPhotoExif } from './photo-exif-service.mjs';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

function clean(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function uploadError(message, status = 400, code = 'UPLOAD_VALIDATION_FAILED', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function activeCommunity(project, communityId) {
  const items = Array.isArray(project?.residentialInventory?.items)
    ? project.residentialInventory.items
    : [];
  return items.find((item) =>
    item?.status !== 'deleted' && String(item.id || item.sourceId || '') === String(communityId)
  ) || null;
}

function activeBuilding(community, buildingId) {
  if (!buildingId) return null;
  const items = Array.isArray(community?.buildings) ? community.buildings : [];
  return items.find((item) => item?.status !== 'deleted' && String(item.id) === String(buildingId)) || null;
}

export async function createUploadSession(client, repository, input, options = {}) {
  const projectId = clean(input?.projectId, 40);
  if (!/^\d+$/.test(projectId)) throw uploadError('项目编号无效。', 400, 'INVALID_PROJECT_ID');
  const name = clean(input?.name, 240);
  if (!name) throw uploadError('文件名称不能为空。', 400, 'UPLOAD_FILE_NAME_REQUIRED');
  const mimeType = clean(input?.mimeType, 80).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw uploadError('仅支持JPEG、PNG或WebP照片。', 400, 'UPLOAD_MIME_TYPE_UNSUPPORTED');
  }
  const size = Number(input?.size);
  if (!Number.isInteger(size) || size <= 0 || size > MAX_PHOTO_BYTES) {
    throw uploadError('照片大小必须大于0且不超过12MB。', 400, 'UPLOAD_SIZE_INVALID');
  }
  const clientRequestId = clean(input?.clientRequestId, 160);
  const existing = await repository.findByClientRequest(projectId, clientRequestId);
  if (existing) return { session: existing, duplicated: true };

  const project = await client.getProject(projectId);
  const communityId = clean(input?.communityId, 120);
  const community = activeCommunity(project, communityId);
  if (!community) throw uploadError('照片必须关联当前项目的有效小区。', 400, 'UPLOAD_COMMUNITY_INVALID');
  const buildingId = clean(input?.buildingId, 120);
  const building = activeBuilding(community, buildingId);
  if (buildingId && !building) {
    throw uploadError('所选楼栋不属于当前小区或已删除。', 400, 'UPLOAD_BUILDING_INVALID');
  }
  const kind = clean(input?.kind, 30).toLowerCase() || 'original';
  if (!['original', 'annotated'].includes(kind)) {
    throw uploadError('照片归档类型无效。', 400, 'UPLOAD_KIND_INVALID');
  }
  let derivation = null;
  if (kind === 'annotated') {
    const analysisId = clean(input?.analysisId, 120);
    const sourcePhotoId = clean(input?.sourcePhotoId, 120);
    const candidateIds = [...new Set(
      (Array.isArray(input?.candidateIds) ? input.candidateIds : [])
        .map((item) => clean(item, 120))
        .filter(Boolean)
    )];
    if (!analysisId || !sourcePhotoId || !candidateIds.length) {
      throw uploadError(
        '标注图必须关联分析、原始照片和至少一个候选问题。',
        400,
        'ANNOTATION_DERIVATION_REQUIRED'
      );
    }
    const analysis = await client.getAnalysis(analysisId);
    if (String(analysis?.projectId) !== projectId) {
      throw uploadError('标注图分析不属于当前项目。', 400, 'ANNOTATION_ANALYSIS_INVALID');
    }
    if (analysis?.status !== 'reviewing') {
      throw uploadError('只有复核中的分析可生成标注图。', 409, 'ANNOTATION_ANALYSIS_READ_ONLY');
    }
    if (typeof options.assertAnalysisFresh === 'function') {
      await options.assertAnalysisFresh(analysis);
    }
    const sourcePhotoIds = (Array.isArray(analysis.photoIds) ? analysis.photoIds : []).map(String);
    if (!sourcePhotoIds.includes(sourcePhotoId)) {
      throw uploadError('标注图原始照片不属于当前分析。', 400, 'ANNOTATION_SOURCE_PHOTO_INVALID');
    }
    const candidateIdSet = new Set(
      (Array.isArray(analysis.reviewIssues)
        ? analysis.reviewIssues
        : Array.isArray(analysis?.result?.issues) ? analysis.result.issues : [])
        .map((candidate) => String(candidate.id || ''))
    );
    if (candidateIds.some((candidateId) => !candidateIdSet.has(candidateId))) {
      throw uploadError('标注图包含不属于当前分析的候选问题。', 400, 'ANNOTATION_CANDIDATE_INVALID');
    }
    derivation = {
      kind,
      analysisId,
      sourcePhotoId,
      candidateIds,
      imageIndex: Math.max(1, Math.trunc(Number(input?.imageIndex) || 1)),
      createdBy: clean(input?.createdBy, 120)
    };
  }

  const now = options.now || new Date().toISOString();
  const session = {
    id: options.id || `UPL-${randomUUID()}`,
    clientRequestId,
    projectId,
    fieldTaskId: clean(input?.fieldTaskId, 180) || null,
    communityId,
    communityName: clean(community.name, 160),
    buildingId: buildingId || '',
    buildingName: clean(building?.name, 160),
    kind,
    derivation,
    file: {
      name,
      mimeType,
      size,
      lastModified: input?.lastModified || null
    },
    status: 'ready',
    attempts: 0,
    bytesReceived: 0,
    contentHash: null,
    photoId: null,
    photo: null,
    error: null,
    storageProvider: 'smart-renew-server-filesystem-adapter',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    schemaVersion: '1.0.0'
  };
  await repository.put(session);
  return { session, duplicated: false };
}

export async function uploadSessionContent(client, repository, sessionId, bytes, contentType, options = {}) {
  const session = await repository.get(sessionId);
  if (!session) throw uploadError('上传会话不存在。', 404, 'UPLOAD_SESSION_NOT_FOUND');
  if (session.status === 'completed') return { session, duplicated: true };
  if (session.status === 'canceled') throw uploadError('上传会话已取消。', 409, 'UPLOAD_SESSION_CANCELED');
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw uploadError('上传内容为空。', 400, 'UPLOAD_CONTENT_EMPTY');
  if (bytes.length !== session.file.size) {
    throw uploadError('上传内容大小与会话声明不一致。', 400, 'UPLOAD_SIZE_MISMATCH', {
      expected: session.file.size,
      received: bytes.length
    });
  }
  const mimeType = clean(contentType, 80).split(';')[0].toLowerCase();
  if (mimeType !== session.file.mimeType) {
    throw uploadError('上传内容类型与会话声明不一致。', 400, 'UPLOAD_MIME_TYPE_MISMATCH');
  }

  const now = options.now || new Date().toISOString();
  const uploading = {
    ...session,
    status: 'uploading',
    attempts: Number(session.attempts || 0) + 1,
    bytesReceived: bytes.length,
    error: null,
    updatedAt: now
  };
  await repository.put(uploading);
  try {
    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const exif = extractPhotoExif(bytes, session.file.mimeType);
    const photoSeed = [
      session.projectId,
      session.communityId,
      session.buildingId,
      session.kind || 'original',
      session.derivation?.analysisId || '',
      session.derivation?.sourcePhotoId || '',
      contentHash
    ].join('|');
    const photoId = `PHOTO-${createHash('sha256').update(photoSeed).digest('hex').slice(0, 24)}`;
    const payload = await client.uploadPhoto({
      photoId,
      projectId: session.projectId,
      communityId: session.communityId,
      buildingId: session.buildingId,
      name: session.file.name,
      analysisId: session.derivation?.analysisId || '',
      imageIndex: session.derivation?.imageIndex || null,
      description: session.kind === 'annotated'
        ? `人工复核标注图，来源照片 ${session.derivation.sourcePhotoId}`
        : '',
      capturedAt: exif.capturedAt || session.file.lastModified || now,
      dataUrl: `data:${session.file.mimeType};base64,${bytes.toString('base64')}`
    });
    const photo = payload?.item || payload;
    const completed = {
      ...uploading,
      status: 'completed',
      contentHash,
      photoId: photo.id,
      photo,
      exif,
      completedAt: now,
      updatedAt: now
    };
    await repository.put(completed);
    return { session: completed, duplicated: Boolean(payload?.duplicated) };
  } catch (error) {
    const failed = {
      ...uploading,
      status: 'failed',
      error: {
        code: error.code || 'UPLOAD_STORAGE_FAILED',
        message: error.message
      },
      updatedAt: new Date().toISOString()
    };
    await repository.put(failed);
    throw error;
  }
}

export async function cancelUploadSession(repository, sessionId, options = {}) {
  const session = await repository.get(sessionId);
  if (!session) throw uploadError('上传会话不存在。', 404, 'UPLOAD_SESSION_NOT_FOUND');
  if (session.status === 'completed') throw uploadError('已完成会话不能取消。', 409, 'UPLOAD_ALREADY_COMPLETED');
  const canceled = {
    ...session,
    status: 'canceled',
    updatedAt: options.now || new Date().toISOString()
  };
  await repository.put(canceled);
  return canceled;
}
