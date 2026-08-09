import crypto from 'node:crypto';
import { findCommunity, listFieldBuildings } from './field-collection-core.js';
import { findHousingProblem } from './housing-problem-catalog.js';

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

function clean(value, maxLength = 200) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

export function decodePhotoDataUrl(dataUrl, maxBytes = 12 * 1024 * 1024) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl || ''));
  if (!match || !MIME_EXTENSIONS[match[1]]) throw new Error('照片格式无效，仅支持 JPEG、PNG 或 WebP');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > maxBytes) throw new Error('照片大小无效或超过 12MB');
  return { buffer, mimeType: match[1], extension: MIME_EXTENSIONS[match[1]] };
}

export function normalizePhotoUpload(input, project, decoded) {
  const projectId = String(project.id);
  if (String(input?.projectId || '') !== projectId) throw new Error('项目编号不一致');
  const community = findCommunity(project, input?.communityId);
  if (!community) throw new Error('照片必须关联有效小区');
  const buildingId = clean(input?.buildingId, 120);
  const buildings = listFieldBuildings(project, community.id) || [];
  const building = buildingId ? buildings.find((item) => item.id === buildingId) : null;
  if (buildingId && !building) throw new Error('所选楼栋不属于该小区或已删除');
  const requestedProblemCode = clean(input?.problemCode, 20);
  const problem = requestedProblemCode ? findHousingProblem(requestedProblemCode) : null;
  if (requestedProblemCode && !problem) throw new Error('照片关联的住区问题类型无效');

  const requestedId = clean(input?.photoId, 120);
  const seed = requestedId || `${projectId}-${community.id}-${buildingId}-${input?.capturedAt || ''}-${input?.name || ''}-${decoded.buffer.length}`;
  const photoId = requestedId && /^[A-Za-z0-9][A-Za-z0-9_.-]{2,119}$/.test(requestedId)
    ? requestedId
    : `PHOTO-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
  const safeCommunity = community.id.replace(/[^A-Za-z0-9_.-]/g, '_');
  const safeBuilding = (buildingId || 'community').replace(/[^A-Za-z0-9_.-]/g, '_');
  const cloudPath = `projects/${projectId}/photos/${safeCommunity}/${safeBuilding}/${photoId}.${decoded.extension}`;
  const now = new Date().toISOString();
  return {
    id: photoId,
    projectId,
    communityId: community.id,
    communityName: clean(community.item.name || '未命名小区'),
    buildingId: building?.id || '',
    buildingName: building?.name || '',
    taskId: clean(input?.taskId, 180),
    householdCount: Math.max(0, Number(input?.householdCount) || 0),
    problemCode: problem?.code || '',
    problemName: problem?.name || '',
    problemGroupCode: problem?.groupCode || '',
    problemGroupName: problem?.groupName || '',
    indicatorCode: problem?.indicatorCode || '',
    collectorId: clean(input?.collectorId, 120),
    analysisId: clean(input?.analysisId, 120),
    imageIndex: Math.max(1, Number(input?.imageIndex) || 1),
    name: clean(input?.name || `${photoId}.${decoded.extension}`, 240),
    description: clean(input?.description, 1000),
    capturedAt: input?.capturedAt || now,
    uploadedAt: now,
    status: 'archived',
    mimeType: decoded.mimeType,
    size: decoded.buffer.length,
    width: Math.max(0, Number(input?.width) || 0),
    height: Math.max(0, Number(input?.height) || 0),
    cloudPath,
    storage: '',
    fileId: '',
    schemaVersion: '1.0.0'
  };
}

export function filterPhotoRecords(items, searchParams) {
  const projectId = clean(searchParams.get('projectId'), 40);
  const communityId = clean(searchParams.get('communityId'), 120);
  const buildingId = clean(searchParams.get('buildingId'), 120);
  const analysisId = clean(searchParams.get('analysisId'), 120);
  let output = Array.isArray(items) ? items : [];
  if (projectId) output = output.filter((item) => String(item.projectId) === projectId);
  if (communityId) output = output.filter((item) => String(item.communityId) === communityId);
  if (buildingId) output = output.filter((item) => String(item.buildingId) === buildingId);
  if (analysisId) output = output.filter((item) => String(item.analysisId) === analysisId);
  return output.sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
}
