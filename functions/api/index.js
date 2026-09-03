import http from 'node:http';
import crypto from 'node:crypto';
import cloudbase from '@cloudbase/node-sdk';
import {
  buildNativeProjectIndex,
  normalizeProjectDataRecord,
  projectDataStats
} from './project-data-core.js';
import {
  fieldProjectSummary,
  listFieldBuildings,
  listFieldCommunities,
  normalizeCollectionTask
} from './field-collection-core.js';
import {
  decodePhotoDataUrl,
  filterPhotoRecords,
  normalizePhotoUpload
} from './photo-storage-core.js';
import {
  filterOfficialIssues,
  normalizeOfficialIssue
} from './official-issue-core.js';
import { housingProblemCatalogResponse } from './housing-problem-catalog.js';
import {
  buildReportSnapshot
} from './report-snapshot-core.js';
import {
  normalizeReportTemplate
} from './report-template-core.js';
import {
  auditLegacyData,
  inferLegacyProblemCode
} from './legacy-migration-core.js';

const envId = process.env.TCB_ENV || process.env.SCF_NAMESPACE || 'smart-renew-d2gamusvr1b96ce95';
const cloudbaseAccessKey = String(process.env.CLOUDBASE_APIKEY || '').trim();
const cloudbaseCollectionNames = new WeakMap();
let app;
let db;
let projectCollection;
let analysisCollection;
let projectDataCollection;
let settingsCollection;
let apiKeyUsersCollection;
let fieldTaskCollection;
let photoRecordCollection;
let officialIssueCollection;
let reportSnapshotCollection;
let reportTemplateCollection;
let groupVisionJobCollection;
let groupVisionWorkerCollection;

function registerCloudbaseCollection(name) {
  const collection = db.collection(name);
  cloudbaseCollectionNames.set(collection, name);
  return collection;
}

function initializeCloudbaseClient() {
  app = cloudbase.init(cloudbaseAccessKey ? { env: envId, accessKey: cloudbaseAccessKey } : { env: envId });
  db = app.database();
  projectCollection = registerCloudbaseCollection('projects');
  analysisCollection = registerCloudbaseCollection('analysisRecords');
  projectDataCollection = registerCloudbaseCollection('projectDataRecords');
  settingsCollection = registerCloudbaseCollection('settings');
  apiKeyUsersCollection = registerCloudbaseCollection('apiKeyUsers');
  fieldTaskCollection = registerCloudbaseCollection('fieldCollectionTasks');
  photoRecordCollection = registerCloudbaseCollection('photoRecords');
  officialIssueCollection = registerCloudbaseCollection('officialIssues');
  reportSnapshotCollection = registerCloudbaseCollection('reportSnapshots');
  reportTemplateCollection = registerCloudbaseCollection('reportTemplates');
  groupVisionJobCollection = registerCloudbaseCollection('groupVisionJobs');
  groupVisionWorkerCollection = registerCloudbaseCollection('groupVisionWorkers');
}

function isCloudbaseCredentialError(error) {
  return /tmp secret key expire|SIGN_PARAM_INVALID|getCredential failed|secretId or secretKey not found|credential.*expir|token.*expir/i.test(String(error?.message || error));
}

function writeCloudbaseError(res, error, status, fallbackMessage) {
  if (isCloudbaseCredentialError(error)) {
    return writeJson(res, 503, {
      message: 'CloudBase 服务凭证刷新失败，请稍后重试',
      code: 'CLOUDBASE_CREDENTIAL_EXPIRED',
      retryable: true
    });
  }
  return writeJson(res, status, { message: error?.message || fallbackMessage });
}

function waitForCloudbaseRetry(attempt) {
  return new Promise((resolve) => setTimeout(resolve, attempt * 300));
}

async function withCloudbaseRetry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isCloudbaseCredentialError(error) || attempt >= attempts) throw error;
      initializeCloudbaseClient();
      await waitForCloudbaseRetry(attempt);
    }
  }
  throw lastError;
}

function activeCloudbaseCollection(collection) {
  const name = cloudbaseCollectionNames.get(collection);
  return name ? db.collection(name) : collection;
}

initializeCloudbaseClient();

const appUsername = process.env.APP_USERNAME || 'admin';
const appPassword = process.env.APP_PASSWORD || '';
const projectDeletePassword = '888';
const defaultModel = process.env.DASHSCOPE_MODEL || 'qwen3-vl-plus';
const baseUrl = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
let apiKey = process.env.DASHSCOPE_API_KEY || '';
let apiKeyLoaded = Boolean(apiKey);
const groupVisionModel = process.env.GROUP_VISION_MODEL || 'qwen3-vl-plus';
const groupVisionBaseUrl = (process.env.GROUP_VISION_BASE_URL || '').replace(/\/$/, '');
const groupVisionApiKey = process.env.GROUP_VISION_API_KEY || '';
const arkApiKey = String(process.env.ARK_API_KEY || '').trim();
const arkBaseUrl = String(process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
const arkModel = String(process.env.ARK_MODEL || 'doubao-seed-2-0-lite-260215').trim();
const groupRelaySecret = String(process.env.GROUP_RELAY_SECRET || '').trim();
const keyEncryptionSecret = process.env.KEY_ENCRYPTION_SECRET || `${envId}:smart-renew-default-key`;
const sessionTtlMs = 12 * 60 * 60 * 1000;
const allowedModels = new Set([
  'qwen3-vl-plus',
  'qwen3-vl-flash',
  'qwen-vl-plus',
  'qwen-vl-max',
  'qwen2.5-vl-72b-instruct'
]);
const allowedVisionProviders = new Set(['dashscope', 'group']);

function normalizeVisionProvider(value) {
  const provider = String(value || 'dashscope').trim().toLowerCase();
  return allowedVisionProviders.has(provider) ? provider : 'dashscope';
}

function unwrapVisionResponse(payload) {
  if (payload && !payload.choices && payload.data) {
    if (payload.code && payload.code !== '00000') {
      throw new Error(payload.message || `集团视觉模型接口错误: ${payload.code}`);
    }
    return payload.data;
  }
  return payload || {};
}
function writeJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorizeGroupRelay(req, res) {
  const supplied = String(req.headers['x-smart-renew-relay-secret'] || '');
  if (groupRelaySecret && supplied && secureEqual(supplied, groupRelaySecret)) return true;
  writeJson(res, 401, { message: '集团模型中转认证失败' });
  return false;
}

async function groupRelayStatus() {
  if (!groupRelaySecret) return { ready: false, lastSeenAt: '' };
  await ensureCollection('groupVisionWorkers', groupVisionWorkerCollection);
  const worker = await getDocument(groupVisionWorkerCollection, 'primary').catch(() => null);
  const lastSeen = Date.parse(worker?.lastSeenAt || '');
  return { ready: Number.isFinite(lastSeen) && Date.now() - lastSeen < 20000, lastSeenAt: worker?.lastSeenAt || '' };
}

async function createGroupVisionJob(body) {
  await ensureCollection('groupVisionJobs', groupVisionJobCollection);
  await ensureCollection('groupVisionWorkers', groupVisionWorkerCollection);
  const analysisMode = String(body.analysisMode || 'vision');
  const images = Array.isArray(body.images) ? body.images : [];
  if (analysisMode !== 'community-gap' && !images.length) throw new Error('至少需要上传 1 张图片');
  if (analysisMode === 'community-gap' && images.length > 0) throw new Error('社区短板分析不应携带现场图片');
  if (images.some((item) => typeof item !== 'string' || !item.startsWith('data:image/'))) throw new Error('图片格式无效');
  const relay = await groupRelayStatus();
  if (!relay.ready) throw new Error('集团视觉模型工作站当前离线，请联系管理员确认姚工电脑已开机并连接单位内网');
  const id = `GVJ-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  const now = new Date();
  const job = {
    id,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    payload: {
      provider: 'group',
      images,
      prompt: String(body.prompt || ''),
      model: groupVisionModel,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      topP: body.topP,
      analysisMode
    }
  };
  await putDocument(groupVisionJobCollection, id, job);
  return job;
}

async function handleGroupVisionJobStatus(req, res, pathname) {
  const match = pathname.match(/^\/vision\/jobs\/(GVJ-[A-Za-z0-9-]+)$/);
  if (!match || req.method !== 'GET') return false;
  await ensureCollection('groupVisionJobs', groupVisionJobCollection);
  const job = await getDocument(groupVisionJobCollection, match[1]).catch(() => null);
  if (!job) return writeJson(res, 404, { message: '集团模型任务不存在或已过期' });
  if (Date.parse(job.expiresAt || '') < Date.now() && !['completed', 'failed'].includes(job.status)) {
    await putDocument(groupVisionJobCollection, job.id, { ...job, status: 'failed', message: '集团模型任务已过期', payload: null });
    return writeJson(res, 200, { id: job.id, status: 'failed', message: '集团模型任务已过期' });
  }
  return writeJson(res, 200, { id: job.id, status: job.status, createdAt: job.createdAt, startedAt: job.startedAt || '', expiresAt: job.expiresAt, result: job.status === 'completed' ? job.result : undefined, message: job.status === 'failed' ? job.message : undefined });
}

async function handleGroupRelayApi(req, res, pathname) {
  if (!pathname.startsWith('/group-relay/')) return false;
  if (!authorizeGroupRelay(req, res)) return true;
  try {
  await ensureCollection('groupVisionJobs', groupVisionJobCollection);
  await ensureCollection('groupVisionWorkers', groupVisionWorkerCollection);
  if (req.method === 'POST' && pathname === '/group-relay/jobs/next') {
    const body = await readJson(req, 16 * 1024).catch(() => ({}));
    const workerId = String(body.workerId || 'primary').slice(0, 100);
    await putDocument(groupVisionWorkerCollection, 'primary', { id: 'primary', workerId, lastSeenAt: new Date().toISOString() });
    if (body.acceptJob === false) { res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end(); return true; }
    const jobs = await listCollection(groupVisionJobCollection).catch(() => []);
    const nowMs = Date.now();
    const expiredJobs = jobs.filter((item) => Date.parse(item.expiresAt || '') <= nowMs);
    await Promise.all(expiredJobs.map((item) => removeDocument(groupVisionJobCollection, item.id).catch(() => null)));
    const activeJobs = jobs.filter((item) => Date.parse(item.expiresAt || '') > nowMs);
    for (const item of activeJobs) {
      if (item.status === 'processing' && nowMs - Date.parse(item.startedAt || item.createdAt || '') > 240000) {
        item.status = 'pending';
        delete item.workerId;
        delete item.startedAt;
        await putDocument(groupVisionJobCollection, item.id, item);
      }
    }
    const job = activeJobs
      .filter((item) => item.status === 'pending' && Date.parse(item.expiresAt || '') > Date.now())
      .sort((a, b) => Date.parse(a.createdAt || '') - Date.parse(b.createdAt || ''))[0];
    if (!job) { res.writeHead(204, { 'Cache-Control': 'no-store' }); res.end(); return true; }
    job.status = 'processing';
    job.workerId = workerId;
    job.startedAt = new Date().toISOString();
    await putDocument(groupVisionJobCollection, job.id, job);
    writeJson(res, 200, { id: job.id, payload: job.payload });
    return true;
  }
  const completeMatch = pathname.match(/^\/group-relay\/jobs\/(GVJ-[A-Za-z0-9-]+)\/complete$/);
  if (req.method === 'POST' && completeMatch) {
    const body = await readJson(req, 2 * 1024 * 1024);
    const job = await getDocument(groupVisionJobCollection, completeMatch[1]).catch(() => null);
    if (!job) { writeJson(res, 404, { message: '任务不存在' }); return true; }
    const completed = {
      ...job,
      status: body.ok === true ? 'completed' : 'failed',
      completedAt: new Date().toISOString(),
      payload: null,
      result: body.ok === true ? body.result : null,
      message: body.ok === true ? '' : String(body.message || '集团模型分析失败')
    };
    await putDocument(groupVisionJobCollection, job.id, completed);
    writeJson(res, 200, { ok: true });
    return true;
  }
  writeJson(res, 404, { message: '集团模型中转接口不存在' });
  return true;
  } catch (error) {
    writeCloudbaseError(res, error, 500, '集团模型中转处理失败');
    return true;
  }
}

function authorize(req, res, url) {
  if (!appPassword || url.pathname === '/api/health' || url.pathname === '/health') return true;
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const splitAt = decoded.indexOf(':');
      const username = splitAt >= 0 ? decoded.slice(0, splitAt) : '';
      const password = splitAt >= 0 ? decoded.slice(splitAt + 1) : '';
      if (secureEqual(username, appUsername) && secureEqual(password, appPassword)) return true;
    } catch {}
  }
  res.writeHead(401, {
    'Content-Type': 'text/plain; charset=utf-8',
    'WWW-Authenticate': 'Basic realm="Smart Renew", charset="UTF-8"',
    'Cache-Control': 'no-store'
  });
  res.end('需要登录后访问');
  return false;
}

async function readJson(req, maxBytes = 120 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8') || '{}';
  return JSON.parse(text);
}

function safeId(value) {
  const id = String(value || '');
  return /^\d+$/.test(id) ? id : '';
}

function safeDataId(value) {
  const id = String(value || '');
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{2,159}$/.test(id) ? id : '';
}

function normalizePath(pathname) {
  if (pathname === '/api') return '/';
  return pathname.startsWith('/api/') ? pathname.slice(4) : pathname;
}

function stripCloudId(item) {
  if (!item || typeof item !== 'object') return item;
  const { _id, ...rest } = item;
  return rest.id ? rest : { id: _id, ...rest };
}

async function listCollection(collection) {
  const items = [];
  const pageSize = 100;
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const result = await withCloudbaseRetry(() => activeCloudbaseCollection(collection).skip(offset).limit(pageSize).get());
    const page = (result.data || []).map(stripCloudId);
    items.push(...page);
    if (page.length < pageSize) break;
  }
  return items;
}

async function getDocument(collection, id) {
  const result = await withCloudbaseRetry(() => activeCloudbaseCollection(collection).doc(id).get());
  const data = Array.isArray(result.data) ? result.data[0] : result.data;
  return data ? stripCloudId(data) : null;
}

async function putDocument(collection, id, body) {
  const updateData = { ...body };
  delete updateData._id;
  const existing = await getDocument(collection, id).catch(() => null);
  if (existing) await withCloudbaseRetry(() => activeCloudbaseCollection(collection).doc(id).update(updateData));
  else await withCloudbaseRetry(() => activeCloudbaseCollection(collection).add({ ...updateData, _id: id }));
  return body;
}

async function removeDocument(collection, id) {
  return withCloudbaseRetry(() => activeCloudbaseCollection(collection).doc(String(id)).remove());
}

async function clearCollection(collection) {
  const items = await listCollection(collection);
  await Promise.all(items.map((item) => removeDocument(collection, item.id).catch(() => null)));
}

async function listCollectionOrEmpty(collection) {
  try {
    return await listCollection(collection);
  } catch (error) {
    if (isCollectionMissingError(error)) return [];
    throw error;
  }
}

async function deleteProjectCloudData(projectId) {
  const collectionItems = await Promise.all([
    [analysisCollection, await listCollectionOrEmpty(analysisCollection)],
    [projectDataCollection, await listCollectionOrEmpty(projectDataCollection)],
    [fieldTaskCollection, await listCollectionOrEmpty(fieldTaskCollection)],
    [photoRecordCollection, await listCollectionOrEmpty(photoRecordCollection)],
    [officialIssueCollection, await listCollectionOrEmpty(officialIssueCollection)],
    [reportSnapshotCollection, await listCollectionOrEmpty(reportSnapshotCollection)],
    [reportTemplateCollection, await listCollectionOrEmpty(reportTemplateCollection)]
  ]);
  const photoItems = collectionItems.find(([collection]) => collection === photoRecordCollection)?.[1] || [];
  const projectPhotoFileIds = photoItems
    .filter((item) => String(item.projectId) === String(projectId) && item.fileId)
    .map((item) => item.fileId);
  if (projectPhotoFileIds.length && typeof app.deleteFile === 'function') {
    for (let index = 0; index < projectPhotoFileIds.length; index += 50) {
      await withCloudbaseRetry(() => app.deleteFile({ fileList: projectPhotoFileIds.slice(index, index + 50) }));
    }
  }
  let deletedRecords = 0;
  for (const [collection, items] of collectionItems) {
    const projectItems = items.filter((item) => String(item.projectId) === String(projectId));
    await Promise.all(projectItems.map((item) => removeDocument(collection, item.id)));
    deletedRecords += projectItems.length;
  }
  await removeDocument(projectCollection, projectId);
  return { deleted: true, projectId: String(projectId), deletedRecords, storage: 'cloudbase' };
}

async function putDocuments(collection, records, batchSize = 20) {
  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    await Promise.all(batch.map((record) => putDocument(collection, record.id, record)));
  }
}

async function listProjectData(projectId) {
  const items = await listCollection(projectDataCollection);
  return items.filter((item) => String(item.projectId) === String(projectId));
}

async function replaceNativeProjectIndex(projectId) {
  const project = await getDocument(projectCollection, projectId);
  if (!project) throw new Error('项目不存在');
  const analyses = (await listCollection(analysisCollection))
    .filter((item) => String(item.projectId) === String(projectId));
  const existing = await listProjectData(projectId);
  const nativeItems = existing.filter((item) => item.source === 'smart-renew');
  await Promise.all(nativeItems.map((item) => removeDocument(projectDataCollection, item.id).catch(() => null)));
  const records = buildNativeProjectIndex(project, analyses);
  await putDocuments(projectDataCollection, records);
  const combined = existing.filter((item) => item.source !== 'smart-renew').concat(records);
  return { records, stats: projectDataStats(combined) };
}

async function handleProjectDataApi(req, res, url, pathname) {
  try {
    await ensureCollection('projectDataRecords', projectDataCollection);
    const recordMatch = pathname.match(/^\/project-data\/([A-Za-z0-9][A-Za-z0-9_.-]{2,159})$/);
    const rebuildMatch = pathname.match(/^\/projects\/(\d+)\/data-index\/rebuild$/);
    const statsMatch = pathname.match(/^\/projects\/(\d+)\/data-index\/stats$/);
    const exportMatch = pathname.match(/^\/projects\/(\d+)\/data-export$/);
    if (req.method === 'GET' && pathname === '/project-data') {
      const projectId = safeId(url.searchParams.get('projectId'));
      if (!projectId) return writeJson(res, 400, { message: '项目 ID 无效' });
      let items = await listProjectData(projectId);
      const type = String(url.searchParams.get('type') || '');
      const tag = String(url.searchParams.get('tag') || '');
      const communityId = String(url.searchParams.get('communityId') || '');
      const buildingId = String(url.searchParams.get('buildingId') || '');
      const referenceId = String(url.searchParams.get('referenceId') || '');
      const query = String(url.searchParams.get('q') || '').trim().toLowerCase();
      if (type) items = items.filter((item) => item.dataType === type);
      if (tag) items = items.filter((item) => (item.tags || []).includes(tag));
      if (communityId) items = items.filter((item) => String(item.payload?.communityId || item.sourceId || '') === communityId);
      if (buildingId) items = items.filter((item) => String(item.payload?.buildingId || item.sourceId || '') === buildingId);
      if (referenceId) items = items.filter((item) => (item.references || []).some((reference) => String(reference.targetId) === referenceId));
      if (query) items = items.filter((item) => JSON.stringify([item.id, item.code, item.title, item.tags, item.sourceId]).toLowerCase().includes(query));
      items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
      return writeJson(res, 200, { items, stats: projectDataStats(items), storage: 'cloudbase' });
    }
    if (req.method === 'GET' && recordMatch) {
      const item = await getDocument(projectDataCollection, recordMatch[1]);
      return item ? writeJson(res, 200, item) : writeJson(res, 404, { message: '索引数据不存在' });
    }
    if (req.method === 'PUT' && recordMatch) {
      const body = await readJson(req);
      const id = safeDataId(body.id);
      const projectId = safeId(body.projectId);
      if (!id || id !== recordMatch[1] || !projectId) return writeJson(res, 400, { message: '索引数据编号无效' });
      const normalized = normalizeProjectDataRecord(body, projectId);
      return writeJson(res, 200, await putDocument(projectDataCollection, id, normalized));
    }
    if (req.method === 'DELETE' && recordMatch) {
      await removeDocument(projectDataCollection, recordMatch[1]);
      return writeJson(res, 200, { deleted: true, id: recordMatch[1] });
    }
    if (req.method === 'POST' && pathname === '/project-data/import') {
      const body = await readJson(req);
      const projectId = safeId(body.projectId);
      const inputs = Array.isArray(body.records) ? body.records : [];
      if (!projectId || !inputs.length) return writeJson(res, 400, { message: '请选择项目并提供需要导入的数据' });
      if (inputs.length > 3000) return writeJson(res, 400, { message: '单次最多导入 3000 条数据' });
      if (body.mode === 'replace') {
        const existing = await listProjectData(projectId);
        const imported = existing.filter((item) => item.source !== 'smart-renew');
        await Promise.all(imported.map((item) => removeDocument(projectDataCollection, item.id).catch(() => null)));
      }
      const records = inputs.map((item) => normalizeProjectDataRecord(item, projectId));
      await putDocuments(projectDataCollection, records);
      return writeJson(res, 200, { imported: records.length, stats: projectDataStats(await listProjectData(projectId)) });
    }
    if (req.method === 'POST' && rebuildMatch) {
      const result = await replaceNativeProjectIndex(rebuildMatch[1]);
      return writeJson(res, 200, { rebuilt: result.records.length, stats: result.stats });
    }
    if (req.method === 'GET' && statsMatch) {
      const records = await listProjectData(statsMatch[1]);
      return writeJson(res, 200, projectDataStats(records));
    }
    if (req.method === 'GET' && exportMatch) {
      const project = await getDocument(projectCollection, exportMatch[1]);
      if (!project) return writeJson(res, 404, { message: '项目不存在' });
      const records = await listProjectData(exportMatch[1]);
      return writeJson(res, 200, {
        format: 'smart-renew-project-data',
        schemaVersion: '2.0.0',
        exportedAt: new Date().toISOString(),
        project: { id: String(project.id), name: project.name || '', area: project.area || '' },
        records
      });
    }
    return writeJson(res, 404, { message: '项目数据索引接口不存在' });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return writeJson(res, 413, { message: '导入数据过大，请拆分后重试' });
    if (isCollectionMissingError(error)) return writeJson(res, 503, { message: 'CloudBase 缺少 projectDataRecords 集合，请创建后重试' });
    return writeCloudbaseError(res, error, 500, '项目数据索引操作失败');
  }
}

function normalizeApiKey(value) {
  let nextKey = String(value || '').trim();
  if (/^DASHSCOPE_API_KEY\s*=/.test(nextKey)) nextKey = nextKey.replace(/^DASHSCOPE_API_KEY\s*=\s*/, '').trim();
  if ((nextKey.startsWith('"') && nextKey.endsWith('"')) || (nextKey.startsWith("'") && nextKey.endsWith("'"))) nextKey = nextKey.slice(1, -1).trim();
  if (nextKey.length < 10 || nextKey.length > 512 || /\s/.test(nextKey)) throw new Error('API Key 内容无效，请检查是否复制完整或包含空格');
  return nextKey;
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(String(keyEncryptionSecret)).digest();
}

function encryptText(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    value: encrypted.toString('base64')
  };
}

function decryptText(payload) {
  if (!payload || !payload.iv || !payload.tag || !payload.value) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.value, 'base64')), decipher.final()]).toString('utf8');
}

function isCollectionMissingError(error) {
  return /not exist|Db or Table not exist|COLLECTION_NOT_EXIST|DATABASE_COLLECTION_NOT_EXIST/i.test(String(error?.message || error));
}

async function ensureSettingsCollection() {
  try {
    await withCloudbaseRetry(() => activeCloudbaseCollection(settingsCollection).limit(1).get());
  } catch (error) {
    if (!isCollectionMissingError(error)) throw error;
    await withCloudbaseRetry(() => activeCloudbaseCollection(settingsCollection).add({ _id: '__init__', createdAt: new Date().toISOString() }));
    await removeDocument(settingsCollection, '__init__').catch(() => null);
  }
}

async function ensureApiKeyUsersCollection() {
  try {
    await withCloudbaseRetry(() => activeCloudbaseCollection(apiKeyUsersCollection).limit(1).get());
  } catch (error) {
    if (isCollectionMissingError(error)) {
      throw new Error('CloudBase 数据库缺少 apiKeyUsers 集合，请先创建后再保存用户密钥');
    }
    throw error;
  }
}

async function ensureOfficialIssueCollection() {
  try {
    await withCloudbaseRetry(() => activeCloudbaseCollection(officialIssueCollection).limit(1).get());
  } catch (error) {
    if (!isCollectionMissingError(error)) throw error;
    await withCloudbaseRetry(() => db.createCollection('officialIssues'));
  }
}

async function ensureCollection(collectionName, collection) {
  try {
    await withCloudbaseRetry(() => activeCloudbaseCollection(collection).limit(1).get());
  } catch (error) {
    if (!isCollectionMissingError(error)) throw error;
    try {
      await withCloudbaseRetry(() => db.createCollection(collectionName));
    } catch (createError) {
      if (!/already exist|已存在|RESOURCE_EXIST/i.test(String(createError?.message || createError))) throw createError;
    }
  }
}

function normalizeUsername(value) {
  const username = String(value || '').trim();
  if (username.length < 2 || username.length > 40) throw new Error('用户名需为 2-40 个字符');
  if (/[\r\n\t]/.test(username)) throw new Error('用户名不能包含换行或制表符');
  return username;
}

function normalizePassword(value) {
  const password = String(value || '');
  if (password.length < 6 || password.length > 128) throw new Error('密码需为 6-128 个字符');
  return password;
}

function userIdFromName(username) {
  return crypto.createHash('sha256').update(normalizeUsername(username)).digest('hex').slice(0, 40);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('base64')) {
  const hash = crypto.pbkdf2Sync(normalizePassword(password), salt, 120000, 32, 'sha256').toString('base64');
  return { salt, hash, iterations: 120000, digest: 'sha256' };
}

function verifyPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const next = crypto.pbkdf2Sync(normalizePassword(password), stored.salt, Number(stored.iterations) || 120000, 32, stored.digest || 'sha256').toString('base64');
  return secureEqual(next, stored.hash);
}

function createSessionToken(userId, username) {
  const payload = {
    userId,
    username,
    exp: Date.now() + sessionTtlMs
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getEncryptionKey()).update(encoded).digest('base64url');
  return { token: `${encoded}.${signature}`, expiresAt: new Date(payload.exp).toISOString() };
}

function verifySessionToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', getEncryptionKey()).update(encoded).digest('base64url');
  if (!secureEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.userId || !payload.username || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

async function getUserApiKeyByToken(token) {
  const session = verifySessionToken(token);
  if (!session) return { key: '', session: null };
  await ensureApiKeyUsersCollection();
  const user = await getDocument(apiKeyUsersCollection, session.userId).catch(() => null);
  if (!user?.encrypted) return { key: '', session: null };
  return { key: decryptText(user.encrypted), session };
}

async function getApiKeyFromRequest(req, tokenFromBody = '') {
  const token = tokenFromBody || String(req.headers['x-smart-renew-key-session'] || '').trim();
  const userKey = await getUserApiKeyByToken(token);
  if (userKey.key) return userKey;
  return { key: '', session: null };
}

async function getStoredApiKey() {
  if (apiKeyLoaded) return apiKey;
  if (apiKey) {
    apiKeyLoaded = true;
    return apiKey;
  }
  await ensureSettingsCollection();
  const setting = await getDocument(settingsCollection, 'dashscopeApiKey').catch(() => null);
  if (setting?.encrypted) {
    apiKey = decryptText(setting.encrypted);
    apiKeyLoaded = Boolean(apiKey);
  }
  return apiKey;
}

async function saveStoredApiKey(nextKey) {
  await ensureSettingsCollection();
  apiKey = nextKey;
  apiKeyLoaded = Boolean(nextKey);
  await putDocument(settingsCollection, 'dashscopeApiKey', {
    id: 'dashscopeApiKey',
    encrypted: encryptText(nextKey),
    updatedAt: new Date().toISOString()
  });
}

async function clearStoredApiKey() {
  await ensureSettingsCollection();
  apiKey = '';
  apiKeyLoaded = false;
  await removeDocument(settingsCollection, 'dashscopeApiKey').catch(() => null);
}

async function listApiKeyUsers(req, res) {
  try {
    await ensureApiKeyUsersCollection();
    const items = await listCollection(apiKeyUsersCollection);
    return writeJson(res, 200, {
      items: items
        .filter((item) => item.username)
        .map((item) => ({ username: item.username, updatedAt: item.updatedAt || '', configured: Boolean(item.encrypted) }))
        .sort((a, b) => String(a.username).localeCompare(String(b.username), 'zh-Hans-CN')),
      storage: 'cloudbase-user-encrypted'
    });
  } catch (error) {
    return writeJson(res, isCollectionMissingError(error) ? 503 : 500, { message: error.message || '读取用户列表失败' });
  }
}

async function configureUserKey(body) {
  await ensureApiKeyUsersCollection();
  const username = normalizeUsername(body.username);
  const password = normalizePassword(body.password);
  const id = userIdFromName(username);
  const existing = await getDocument(apiKeyUsersCollection, id).catch(() => null);

  if (body.clear === true) {
    if (!existing || !verifyPassword(password, existing.password)) throw new Error('用户名或密码不正确');
    await removeDocument(apiKeyUsersCollection, id);
    return { ready: false, username, model: defaultModel, storage: 'cloudbase-user-encrypted' };
  }

  if (body.select === true && !body.apiKey) {
    if (!existing || !verifyPassword(password, existing.password)) throw new Error('用户名或密码不正确');
    const session = createSessionToken(id, existing.username || username);
    return { ready: true, username: existing.username || username, model: defaultModel, storage: 'cloudbase-user-encrypted', ...session };
  }

  const nextKey = normalizeApiKey(body.apiKey);
  const passwordMeta = existing?.password && verifyPassword(password, existing.password) ? existing.password : hashPassword(password);
  if (existing?.password && !verifyPassword(password, existing.password)) throw new Error('该用户名已存在，密码不正确');

  await putDocument(apiKeyUsersCollection, id, {
    id,
    username,
    password: passwordMeta,
    encrypted: encryptText(nextKey),
    updatedAt: new Date().toISOString()
  });
  const session = createSessionToken(id, username);
  return { ready: true, username, model: defaultModel, storage: 'cloudbase-user-encrypted', ...session };
}

async function handleStorageApi(req, res, url, pathname) {
  try {
    const projectMatch = pathname.match(/^\/projects\/(\d+)$/);
    const recordMatch = pathname.match(/^\/analysis-records\/(\d+)$/);
    if (req.method === 'GET' && pathname === '/projects') {
      return writeJson(res, 200, { items: await listCollection(projectCollection), storage: 'cloudbase' });
    }
    if (req.method === 'GET' && projectMatch) {
      const item = await getDocument(projectCollection, projectMatch[1]);
      return item ? writeJson(res, 200, item) : writeJson(res, 404, { message: '项目不存在' });
    }
    if (req.method === 'PUT' && projectMatch) {
      const body = await readJson(req);
      const id = safeId(body.id);
      if (!id || id !== projectMatch[1]) return writeJson(res, 400, { message: '项目 ID 无效' });
      return writeJson(res, 200, await putDocument(projectCollection, id, body));
    }
    if (req.method === 'DELETE' && projectMatch) {
      const body = await readJson(req, 16 * 1024);
      if (!secureEqual(body.password, projectDeletePassword)) return writeJson(res, 403, { message: '项目删除密码不正确' });
      const project = await getDocument(projectCollection, projectMatch[1]);
      if (!project) return writeJson(res, 404, { message: '项目不存在' });
      return writeJson(res, 200, await deleteProjectCloudData(projectMatch[1]));
    }
    if (req.method === 'GET' && pathname === '/analysis-records') {
      let items = await listCollection(analysisCollection);
      const projectId = safeId(url.searchParams.get('projectId'));
      if (projectId) items = items.filter((item) => String(item.projectId) === projectId);
      return writeJson(res, 200, { items, storage: 'cloudbase' });
    }
    if (req.method === 'GET' && recordMatch) {
      const item = await getDocument(analysisCollection, recordMatch[1]);
      return item ? writeJson(res, 200, item) : writeJson(res, 404, { message: '分析记录不存在' });
    }
    if (req.method === 'PUT' && recordMatch) {
      const body = await readJson(req);
      const id = safeId(body.id);
      if (!id || id !== recordMatch[1]) return writeJson(res, 400, { message: '分析记录 ID 无效' });
      return writeJson(res, 200, await putDocument(analysisCollection, id, body));
    }
    if (req.method === 'DELETE' && pathname === '/analysis-records') {
      await clearCollection(analysisCollection);
      return writeJson(res, 200, { deleted: true });
    }
    return writeJson(res, 404, { message: '数据接口不存在' });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return writeJson(res, 413, { message: '保存数据过大，请压缩图片或分批处理' });
    return writeCloudbaseError(res, error, 500, 'CloudBase 数据库存储失败');
  }
}

async function handleFieldCollectionApi(req, res, pathname) {
  try {
    const projectCommunitiesMatch = pathname.match(/^\/field\/projects\/(\d+)\/communities$/);
    const communityBuildingsMatch = pathname.match(/^\/field\/projects\/(\d+)\/communities\/([A-Za-z0-9_.-]+)\/buildings$/);
    const taskMatch = pathname.match(/^\/field\/collection-tasks\/([A-Za-z0-9_.-]+)$/);
    const taskCompleteMatch = pathname.match(/^\/field\/collection-tasks\/([A-Za-z0-9_.-]+)\/complete$/);
    if (req.method === 'GET' && pathname === '/field/problem-types') {
      return writeJson(res, 200, { items: housingProblemCatalogResponse(), schemaVersion: '1.0.0' });
    }
    if (req.method === 'GET' && pathname === '/field/projects') {
      const projects = (await listCollection(projectCollection)).map(fieldProjectSummary);
      return writeJson(res, 200, { items: projects, storage: 'cloudbase' });
    }
    if (req.method === 'GET' && projectCommunitiesMatch) {
      const project = await getDocument(projectCollection, projectCommunitiesMatch[1]);
      if (!project) return writeJson(res, 404, { message: '项目不存在' });
      return writeJson(res, 200, { items: listFieldCommunities(project), storage: 'cloudbase' });
    }
    if (req.method === 'GET' && communityBuildingsMatch) {
      const project = await getDocument(projectCollection, communityBuildingsMatch[1]);
      if (!project) return writeJson(res, 404, { message: '项目不存在' });
      const items = listFieldBuildings(project, communityBuildingsMatch[2]);
      return items ? writeJson(res, 200, { items, storage: 'cloudbase' }) : writeJson(res, 404, { message: '小区不存在' });
    }
    if (req.method === 'POST' && pathname === '/field/collection-tasks') {
      const body = await readJson(req, 256 * 1024);
      const projectId = safeId(body.projectId);
      if (!projectId) return writeJson(res, 400, { message: '项目编号无效' });
      const project = await getDocument(projectCollection, projectId);
      if (!project) return writeJson(res, 404, { message: '项目不存在' });
      const candidate = normalizeCollectionTask(body, project);
      const existing = await getDocument(fieldTaskCollection, candidate.id).catch(() => null);
      if (existing) return writeJson(res, 200, { item: existing, duplicated: true, storage: 'cloudbase' });
      await putDocument(fieldTaskCollection, candidate.id, candidate);
      return writeJson(res, 201, { item: candidate, duplicated: false, storage: 'cloudbase' });
    }
    if (req.method === 'GET' && taskMatch) {
      const task = await getDocument(fieldTaskCollection, taskMatch[1]);
      return task ? writeJson(res, 200, { item: task, storage: 'cloudbase' }) : writeJson(res, 404, { message: '现场任务不存在' });
    }
    if (req.method === 'POST' && taskCompleteMatch) {
      const task = await getDocument(fieldTaskCollection, taskCompleteMatch[1]);
      if (!task) return writeJson(res, 404, { message: '现场任务不存在' });
      const body = await readJson(req, 64 * 1024);
      const uploadedPhotoCount = Math.max(0, Number(body.uploadedPhotoCount) || 0);
      if (uploadedPhotoCount < Number(task.photoCount || 0)) {
        return writeJson(res, 400, { message: '仍有照片未上传完成' });
      }
      const completed = {
        ...task,
        status: 'completed',
        syncStatus: 'completed',
        uploadedPhotoCount,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await putDocument(fieldTaskCollection, task.id, completed);
      return writeJson(res, 200, { item: completed, storage: 'cloudbase' });
    }
    return writeJson(res, 404, { message: '现场采集接口不存在' });
  } catch (error) {
    return writeCloudbaseError(res, error, 400, '现场采集数据无效');
  }
}

async function photoWithTemporaryUrl(record) {
  if (!record?.fileId) return record;
  const result = await withCloudbaseRetry(() => app.getTempFileURL({ fileList: [{ fileID: record.fileId, maxAge: 3600 }] }));
  return { ...record, url: result.fileList?.[0]?.tempFileURL || '' };
}

async function handlePhotoApi(req, res, url, pathname) {
  try {
    const recordMatch = pathname.match(/^\/photos\/([A-Za-z0-9_.-]+)$/);
    const contentMatch = pathname.match(/^\/photos\/([A-Za-z0-9_.-]+)\/content$/);
    if (req.method === 'GET' && pathname === '/photos') {
      const items = filterPhotoRecords(await listCollection(photoRecordCollection), url.searchParams)
        .map((item) => ({ ...item, url: `/api/photos/${item.id}/content` }));
      return writeJson(res, 200, { items, storage: 'cloudbase-storage' });
    }
    if (req.method === 'DELETE' && recordMatch) {
      const photoId = recordMatch[1];
      const record = await getDocument(photoRecordCollection, photoId);
      if (!record) return writeJson(res, 404, { message: '照片不存在' });
      if (record.analysisId) return writeJson(res, 409, { message: '该照片已被分析记录引用，不能删除' });
      const [analyses, issues, reports] = await Promise.all([
        listCollectionOrEmpty(analysisCollection),
        listCollectionOrEmpty(officialIssueCollection),
        listCollectionOrEmpty(reportSnapshotCollection)
      ]);
      const referenced = analyses.some((item) =>
        [item.photoIds, item.annotatedPhotoIds].some((ids) => Array.isArray(ids) && ids.some((id) => String(id) === photoId))
      ) || issues.some((item) => String(item.originalPhotoId || '') === photoId || String(item.annotatedPhotoId || '') === photoId)
        || reports.some((item) => Array.isArray(item.sourceIds?.photoIds) && item.sourceIds.photoIds.some((id) => String(id) === photoId));
      if (referenced) return writeJson(res, 409, { message: '该照片已被历史成果引用，不能删除' });
      if (record.fileId) {
        if (typeof app.deleteFile !== 'function') return writeJson(res, 500, { message: '当前云端环境不支持删除照片文件' });
        await withCloudbaseRetry(() => app.deleteFile({ fileList: [record.fileId] }));
      }
      await removeDocument(photoRecordCollection, photoId);
      return writeJson(res, 200, { deleted: true, item: { id: photoId }, storage: 'cloudbase-storage' });
    }
    if (req.method === 'GET' && contentMatch) {
      const record = await getDocument(photoRecordCollection, contentMatch[1]);
      if (!record?.fileId) return writeJson(res, 404, { message: '照片不存在' });
      const downloaded = await withCloudbaseRetry(() => app.downloadFile({ fileID: record.fileId }));
      res.writeHead(200, {
        'Content-Type': record.mimeType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(downloaded.fileContent);
    }
    if (req.method === 'POST' && pathname === '/photos/upload') {
      const body = await readJson(req, 18 * 1024 * 1024);
      const projectId = safeId(body.projectId);
      if (!projectId) return writeJson(res, 400, { message: '项目编号无效' });
      const project = await getDocument(projectCollection, projectId);
      if (!project) return writeJson(res, 404, { message: '项目不存在' });
      if (body.taskId) {
        const task = await getDocument(fieldTaskCollection, String(body.taskId));
        if (!task) return writeJson(res, 404, { message: '现场采集任务不存在' });
        if (
          String(task.projectId) !== String(body.projectId) ||
          String(task.communityId) !== String(body.communityId) ||
          String(task.buildingId) !== String(body.buildingId) ||
          String(task.problemCode) !== String(body.problemCode)
        ) {
          return writeJson(res, 400, { message: '照片信息与现场采集任务不一致' });
        }
        body.householdCount = task.householdCount;
        body.collectorId = task.collectorId;
      }
      const decoded = decodePhotoDataUrl(body.dataUrl);
      const record = normalizePhotoUpload(body, project, decoded);
      const existing = await getDocument(photoRecordCollection, record.id).catch(() => null);
      if (existing) return writeJson(res, 200, { item: await photoWithTemporaryUrl(existing), duplicated: true });
      const uploaded = await withCloudbaseRetry(() => app.uploadFile({ cloudPath: record.cloudPath, fileContent: decoded.buffer }));
      record.storage = 'cloudbase-storage';
      record.fileId = uploaded.fileID || '';
      await putDocument(photoRecordCollection, record.id, record);
      return writeJson(res, 201, { item: await photoWithTemporaryUrl(record), duplicated: false });
    }
    if (req.method === 'GET' && recordMatch) {
      const record = await getDocument(photoRecordCollection, recordMatch[1]);
      return record ? writeJson(res, 200, { item: await photoWithTemporaryUrl(record) }) : writeJson(res, 404, { message: '照片不存在' });
    }
    return writeJson(res, 404, { message: '照片档案接口不存在' });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return writeJson(res, 413, { message: '照片数据过大' });
    return writeCloudbaseError(res, error, 400, '照片归档失败');
  }
}

async function handleOfficialIssueApi(req, res, url, pathname) {
  try {
    await ensureOfficialIssueCollection();
    if (req.method === 'GET' && pathname === '/issues') {
      return writeJson(res, 200, { items: filterOfficialIssues(await listCollection(officialIssueCollection), url.searchParams), storage: 'cloudbase' });
    }
    if (req.method === 'POST' && pathname === '/issues/finalize') {
      const body = await readJson(req, 2 * 1024 * 1024);
      const analysisId = safeId(body.analysisId);
      if (!analysisId) return writeJson(res, 400, { message: '分析批次编号无效' });
      const analysis = await getDocument(analysisCollection, analysisId);
      if (!analysis) return writeJson(res, 404, { message: '分析批次不存在' });
      const issues = Array.isArray(body.issues) ? body.issues : [];
      if (!issues.length) return writeJson(res, 400, { message: '没有可写入的正式问题' });
      const records = issues.map((issue) => normalizeOfficialIssue(issue, analysis, body.reviewerName));
      await putDocuments(officialIssueCollection, records);
      return writeJson(res, 200, { items: records, finalized: records.length, storage: 'cloudbase' });
    }
    return writeJson(res, 404, { message: '正式问题接口不存在' });
  } catch (error) {
    return writeCloudbaseError(res, error, 400, '正式问题写入失败');
  }
}

async function handleReportTemplateApi(req, res, pathname) {
  try {
    await ensureCollection('reportTemplates', reportTemplateCollection);
    const match = pathname.match(/^\/report-templates\/([A-Za-z0-9][A-Za-z0-9_.-]{2,119})\/projects\/(\d+)$/);
    if (!match) return writeJson(res, 404, { message: '报告模板接口不存在' });
    const baseTemplateId = match[1];
    const projectId = match[2];
    const project = await getDocument(projectCollection, projectId);
    if (!project) return writeJson(res, 404, { message: '项目不存在，不能读写报告模板' });
    const id = `${baseTemplateId}-P-${projectId}`;
    if (req.method === 'GET') {
      const item = await getDocument(reportTemplateCollection, id);
      return item ? writeJson(res, 200, { item, storage: 'cloudbase' }) : writeJson(res, 404, { message: '尚未保存报告模板草稿' });
    }
    if (req.method === 'PUT') {
      const body = await readJson(req, 24 * 1024 * 1024);
      const item = normalizeReportTemplate(body, id);
      item.baseTemplateId = baseTemplateId;
      item.projectId = projectId;
      item.projectName = project.name || '';
      item.dataScope = { isolation: 'project', projectId, projectDataCollection: 'projectDataRecords', officialIssueCollection: 'officialIssues', photoCollection: 'photoRecords', analysisCollection: 'analysisRecords' };
      await putDocument(reportTemplateCollection, id, item);
      return writeJson(res, 200, { item, storage: 'cloudbase' });
    }
    return writeJson(res, 405, { message: '不支持的报告模板操作' });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return writeJson(res, 413, { message: '报告模板数据过大' });
    return writeCloudbaseError(res, error, 400, '报告模板保存失败');
  }
}

async function handleReportSnapshotApi(req, res, url, pathname) {
  try {
    await ensureCollection('reportSnapshots', reportSnapshotCollection);
    const reportMatch = pathname.match(/^\/reports\/(RPT-[A-Za-z0-9_.-]+)$/);
    if (req.method === 'GET' && pathname === '/reports') {
      const projectId = safeId(url.searchParams.get('projectId'));
      let items = await listCollection(reportSnapshotCollection);
      if (projectId) items = items.filter((item) => String(item.projectId) === projectId);
      items.sort((a, b) => Number(b.version) - Number(a.version));
      return writeJson(res, 200, { items, storage: 'cloudbase' });
    }
    if (req.method === 'GET' && reportMatch) {
      const item = await getDocument(reportSnapshotCollection, reportMatch[1]);
      return item ? writeJson(res, 200, { item, storage: 'cloudbase' }) : writeJson(res, 404, { message: '报告版本不存在' });
    }
    if (req.method === 'POST' && pathname === '/reports/generate') {
      const body = await readJson(req, 256 * 1024);
      const projectId = safeId(body.projectId);
      if (!projectId) return writeJson(res, 400, { message: '项目编号无效' });
      const project = await getDocument(projectCollection, projectId);
      if (!project) return writeJson(res, 404, { message: '项目不存在' });
      const issues = filterOfficialIssues(await listCollection(officialIssueCollection), new URLSearchParams({ projectId }));
      if (!issues.length) return writeJson(res, 400, { message: '项目尚无人工确认的正式问题' });
      const photos = filterPhotoRecords(await listCollection(photoRecordCollection), new URLSearchParams({ projectId }));
      const analyses = (await listCollection(analysisCollection)).filter((item) => String(item.projectId) === projectId);
      const existing = (await listCollection(reportSnapshotCollection)).filter((item) => String(item.projectId) === projectId);
      const report = buildReportSnapshot({ project, issues, photos, analyses, existing, generatedBy: body.generatedBy });
      await putDocument(reportSnapshotCollection, report.id, report);
      return writeJson(res, 201, { item: report, storage: 'cloudbase' });
    }
    return writeJson(res, 404, { message: '报告版本接口不存在' });
  } catch (error) {
    return writeCloudbaseError(res, error, 400, '报告版本生成失败');
  }
}

async function storeMigratedCloudPhoto(project, analysis, dataUrl, meta, imageIndex, variant) {
  const decoded = decodePhotoDataUrl(dataUrl);
  const record = normalizePhotoUpload({
    photoId: `PHOTO-${analysis.id}-${variant.toUpperCase()}-${imageIndex}`,
    projectId: String(project.id),
    communityId: meta.communityId || analysis.communityId,
    buildingId: meta.buildingId || analysis.buildingId || '',
    analysisId: String(analysis.id),
    imageIndex,
    name: `${variant === 'annotated' ? '历史标注图' : '历史原图'}-${imageIndex}.${decoded.extension}`,
    description: '由旧版分析记录迁移',
    capturedAt: analysis.timestamp || analysis.archivedAt || new Date().toISOString(),
    width: meta.width || 0,
    height: meta.height || 0
  }, project, decoded);
  const existing = await getDocument(photoRecordCollection, record.id).catch(() => null);
  if (existing) return existing;
  const uploaded = await withCloudbaseRetry(() => app.uploadFile({ cloudPath: record.cloudPath, fileContent: decoded.buffer }));
  record.storage = 'cloudbase-storage';
  record.fileId = uploaded.fileID || '';
  await putDocument(photoRecordCollection, record.id, record);
  return record;
}

async function handleLegacyMigrationApi(req, res, url, pathname) {
  try {
    const body = req.method === 'POST' ? await readJson(req, 64 * 1024) : {};
    const projectId = safeId(body.projectId || url.searchParams.get('projectId'));
    if (!projectId) return writeJson(res, 400, { message: '项目编号无效' });
    const project = await getDocument(projectCollection, projectId);
    if (!project) return writeJson(res, 404, { message: '项目不存在' });
    const analyses = await listCollection(analysisCollection);
    const photos = await listCollection(photoRecordCollection);
    const issues = await listCollection(officialIssueCollection);
    const before = auditLegacyData(projectId, analyses, photos, issues);
    if (req.method === 'GET' || body.apply !== true) return writeJson(res, 200, { audit: before, applied: false });
    let migratedPhotos = 0;
    let migratedIssues = 0;
    for (const analysis of analyses.filter((item) => String(item.projectId) === projectId)) {
      const meta = Array.isArray(analysis.imageMeta) ? analysis.imageMeta : [];
      if (Array.isArray(analysis.imagesBase64) && analysis.imagesBase64.length) {
        analysis.photoIds = [];
        for (let index = 0; index < analysis.imagesBase64.length; index += 1) {
          const photo = await storeMigratedCloudPhoto(project, analysis, analysis.imagesBase64[index], meta[index] || {}, index + 1, 'original');
          analysis.photoIds.push(photo.id);
          meta[index] = { ...(meta[index] || {}), photoId: photo.id, communityId: photo.communityId, buildingId: photo.buildingId, storage: photo.storage, fileId: photo.fileId, cloudPath: photo.cloudPath };
          migratedPhotos += 1;
        }
        delete analysis.imagesBase64;
      }
      if (Array.isArray(analysis.annotatedImages) && analysis.annotatedImages.length) {
        analysis.annotatedPhotoIds = [];
        for (let index = 0; index < analysis.annotatedImages.length; index += 1) {
          const photo = await storeMigratedCloudPhoto(project, analysis, analysis.annotatedImages[index], meta[index] || {}, index + 1, 'annotated');
          analysis.annotatedPhotoIds.push(photo.id);
          migratedPhotos += 1;
        }
        delete analysis.annotatedImages;
      }
      analysis.imageMeta = meta;
      await putDocument(analysisCollection, String(analysis.id), analysis);
      if (analysis.status === 'archived' && Array.isArray(analysis.result?.issues)) {
        for (const candidate of analysis.result.issues) {
          const official = normalizeOfficialIssue({
            ...candidate,
            problemCode: inferLegacyProblemCode(candidate),
            reviewStatus: candidate.reviewStatus === 'modified' ? 'modified' : 'accepted'
          }, analysis, analysis.reviewerName || body.reviewerName || '历史数据迁移');
          await putDocument(officialIssueCollection, official.id, official);
          migratedIssues += 1;
        }
      }
    }
    await replaceNativeProjectIndex(projectId);
    const after = auditLegacyData(projectId, await listCollection(analysisCollection), await listCollection(photoRecordCollection), await listCollection(officialIssueCollection));
    return writeJson(res, 200, { applied: true, migratedPhotos, migratedIssues, before, after });
  } catch (error) {
    return writeCloudbaseError(res, error, 400, '旧数据迁移失败');
  }
}

async function configureKey(req, res) {
  try {
    const body = await readJson(req, 16 * 1024);
    if (body.username || body.password) {
      return writeJson(res, 200, await configureUserKey(body));
    }
    if (body.clear === true) {
      await clearStoredApiKey();
      return writeJson(res, 200, { ready: false, model: defaultModel, storage: 'cloudbase-encrypted' });
    }
    const nextKey = normalizeApiKey(body.apiKey);
    await saveStoredApiKey(nextKey);
    return writeJson(res, 200, { ready: true, model: defaultModel, storage: 'cloudbase-encrypted' });
  } catch (error) {
    return writeCloudbaseError(res, error, 400, '密钥配置失败');
  }
}

async function sessionHealth(req, res) {
  try {
    const body = await readJson(req);
    const provider = normalizeVisionProvider(body.provider);
    if (provider === 'group') {
      const relay = await groupRelayStatus();
      return writeJson(res, 200, {
        ready: relay.ready,
        provider,
        model: groupVisionModel,
        storage: 'private-workstation-relay',
        lastSeenAt: relay.lastSeenAt
      });
    }
    const active = await getApiKeyFromRequest(req, body.keySessionToken);
    return writeJson(res, 200, {
      ready: Boolean(active.key),
      provider,
      username: active.session?.username || '',
      model: defaultModel,
      storage: active.session ? 'cloudbase-user-encrypted' : (active.key ? 'cloudbase-encrypted' : 'cloudbase')
    });
  } catch (error) {
    return writeJson(res, 200, { ready: false, model: defaultModel, storage: 'cloudbase', message: error.message || '密钥未启用' });
  }
}

async function analyze(req, res) {
  let provider = 'dashscope';
  try {
    const body = await readJson(req);
    provider = normalizeVisionProvider(body.provider);
    if (provider === 'group') {
      const job = await createGroupVisionJob(body);
      return writeJson(res, 202, { jobId: job.id, status: job.status, expiresAt: job.expiresAt, provider, model: groupVisionModel });
    }
    const active = provider === 'group' ? { key: groupVisionApiKey, session: null } : await getApiKeyFromRequest(req, body.keySessionToken);
    const activeApiKey = active.key;
    if (!activeApiKey) return writeJson(res, 503, { message: provider === 'group' ? '集团视觉模型尚未配置服务端密钥' : '请先选择用户并输入密码启用 API Key' });
    if (provider === 'group' && !groupVisionBaseUrl) return writeJson(res, 503, { message: '集团视觉模型尚未配置接口地址' });
    const analysisMode = String(body.analysisMode || 'vision');
    const images = Array.isArray(body.images) ? body.images : [];
    if (analysisMode !== 'community-gap' && !images.length) return writeJson(res, 400, { message: '至少需要上传 1 张图片' });
    if (analysisMode === 'community-gap' && images.length > 0) return writeJson(res, 400, { message: '社区短板分析不应携带现场图片' });
    if (images.some((item) => typeof item !== 'string' || !item.startsWith('data:image/'))) return writeJson(res, 400, { message: '图片格式无效' });
    const requestedModel = String(body.model || defaultModel);
    const model = provider === 'group' ? groupVisionModel : (allowedModels.has(requestedModel) ? requestedModel : defaultModel);
    const upstreamBaseUrl = provider === 'group' ? groupVisionBaseUrl : baseUrl;
    const content = [{ type: 'text', text: String(body.prompt || '') }];
    for (const image of images) content.push({ type: 'image_url', image_url: { url: image } });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    let upstream;
    try {
      const requestPayload = {
        model,
        stream: false,
        messages: [
          { role: 'system', content: [{ type: 'text', text: '你是一位专业的住区安全体检专家。只输出符合要求的 JSON。' }] },
          { role: 'user', content }
        ],
        max_tokens: Math.max(500, Math.min(8000, Number(body.maxTokens) || 3000)),
        temperature: Math.max(0, Math.min(1, Number(body.temperature) || 0.2)),
        top_p: Math.max(0.1, Math.min(1, Number(body.topP) || 0.9))
      };
      if (provider === 'dashscope') requestPayload.response_format = { type: 'json_object' };
      upstream = await fetch(`${upstreamBaseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeApiKey}` },
        body: JSON.stringify(requestPayload)
      });
    } finally {
      clearTimeout(timer);
    }
    const rawData = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return writeJson(res, upstream.status, { message: rawData.message || rawData.code || `模型请求失败: HTTP ${upstream.status}` });
    const data = unwrapVisionResponse(rawData);
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) return writeJson(res, 502, { message: '模型没有返回可解析内容' });
    return writeJson(res, 200, { content: answer, requestId: data.request_id || data.id || '', model: data.model || model, provider, usage: data.usage || null });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return writeJson(res, 413, { message: '本次图片数据过大，请减少图片数量' });
    if (error.name === 'AbortError') return writeJson(res, 504, { message: '模型响应超时，请稍后重试' });
    if (provider === 'group' && /fetch failed|connect|network|socket/i.test(String(error.message || error))) return writeJson(res, 502, { message: '集团视觉模型网络连接失败：当前云函数无法访问集团内网接口，请配置公网网关或专线/VPN' });
    return writeJson(res, 500, { message: error.message || '服务端分析失败' });
  }
}

function extractArkResponseText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) return content.text.trim();
    }
  }
  return '';
}

function communitySummaryInput(body) {
  const rows = (Array.isArray(body.categories) ? body.categories : []).slice(0, 20).map((item) => {
    const names = (Array.isArray(item.names) ? item.names : []).slice(0, 6).map((name) => String(name || '').slice(0, 60)).filter(Boolean);
    return `- ${String(item.label || '未分类').slice(0, 40)}：${Math.max(0, Number(item.count) || 0)} 个${names.length ? `；代表设施：${names.join('、')}` : ''}`;
  }).join('\n');
  return `你是一位熟悉中国城市更新、完整社区建设和社区生活圈评估的规划咨询专家。请基于以下项目所在地与高德地图 POI 检索结果，形成一份明显区别于“基础分析结论”的深入中文总结。\n\n写作要求：\n1. 输出 500 至 800 个汉字，分为 4 个自然段，不使用 Markdown 标题或项目符号。\n2. 第一段结合项目所在地，解释本次设施结构对当地社区日常生活与城市更新的含义；可以提出符合当地实施场景的一般性判断，但不得虚构当地政策、人口、规划指标或政府承诺。\n3. 第二段说明相对充足的设施、可能形成的服务基础及代表设施，不要只重复数量。\n4. 第三段分析当前地图检索未识别到或相对薄弱的类别。数量为 0 必须表述为“当前地图检索未识别到，仍需现场核实”，不能断言不存在。\n5. 第四段提出具有空间指向的补充建议，包括项目范围内部优化、与周边社区共享衔接、步行联系、服务半径、运营开放情况和现场核查优先级。建议应有先后顺序，并说明哪些内容适合内部补齐、哪些可通过周边共享完善。\n6. 只能使用给定的项目和设施事实，不得编造具体设施、道路、政策标准或距离。避免复述基础结论，重点提供解释、关联判断和可执行建议。\n\n项目：${String(body.projectName || '未命名项目').slice(0, 80)}\n项目所在地：${String(body.projectLocation || '项目所在地未填写').slice(0, 160)}\n项目说明：${String(body.projectDescription || '未填写').slice(0, 300)}\n分析维度：${String(body.dimensionLabel || '社区／街区').slice(0, 30)}\n检索范围：${String(body.scopeLabel || '当前范围').slice(0, 80)}\n归并后设施：${Math.max(0, Number(body.spaceTotal) || 0)} 个\n高德原始 POI：${Math.max(0, Number(body.rawTotal) || 0)} 个\n分类结果：\n${rows || '- 暂无分类结果'}\n\n基础分析结论：${String(body.conclusion || '').slice(0, 300)}\n基础建议：${String(body.advice || '').slice(0, 300)}`;
}

async function generateCommunitySummary(req, res) {
  try {
    if (!arkApiKey) return writeJson(res, 503, { message: '服务端尚未配置 ARK_API_KEY' });
    const body = await readJson(req, 128 * 1024);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    let upstream;
    try {
      upstream = await fetch(`${arkBaseUrl}/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${arkApiKey}` },
        body: JSON.stringify({ model: arkModel, input: communitySummaryInput(body), max_output_tokens: 1600, thinking: { type: 'disabled' } })
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return writeJson(res, upstream.status, { message: data?.error?.message || data?.message || `方舟请求失败: HTTP ${upstream.status}` });
    const content = extractArkResponseText(data);
    if (!content) return writeJson(res, 502, { message: '方舟模型没有返回有效总结' });
    return writeJson(res, 200, { content, model: data.model || arkModel, requestId: data.id || '', provider: 'volcengine-ark' });
  } catch (error) {
    if (error.name === 'AbortError') return writeJson(res, 504, { message: '方舟总结响应超时，请稍后重试' });
    return writeJson(res, 500, { message: error.message || '方舟总结生成失败' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = normalizePath(url.pathname);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (pathname.startsWith('/group-relay/')) return handleGroupRelayApi(req, res, pathname);
  if (!authorize(req, res, url)) return;
  if (pathname.startsWith('/vision/jobs/')) return handleGroupVisionJobStatus(req, res, pathname);
  if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
    const active = await getApiKeyFromRequest(req).catch(() => ({ key: '' }));
    const relay = await groupRelayStatus();
    return writeJson(res, 200, { ready: Boolean(active.key), username: active.session?.username || '', model: defaultModel, provider: 'dashscope', providers: { dashscope: Boolean(active.key), group: relay.ready }, storage: active.session ? 'cloudbase-user-encrypted' : (active.key ? 'cloudbase-encrypted' : 'cloudbase'), cloudbaseAuth: cloudbaseAccessKey ? 'server-api-key' : 'runtime-temporary', cloudbaseStableAuth: Boolean(cloudbaseAccessKey) });
  }
  if (req.method === 'GET' && pathname === '/config/users') return listApiKeyUsers(req, res);
  if (req.method === 'POST' && pathname === '/config/key') return configureKey(req, res);
  if (req.method === 'POST' && pathname === '/config/session/health') return sessionHealth(req, res);
  if (req.method === 'POST' && pathname === '/community/summary') return generateCommunitySummary(req, res);
  if (req.method === 'POST' && pathname === '/vision/analyze') return analyze(req, res);
  if (pathname.startsWith('/project-data') || /^\/projects\/\d+\/data-/.test(pathname)) return handleProjectDataApi(req, res, url, pathname);
  if (pathname.startsWith('/field/')) return handleFieldCollectionApi(req, res, pathname);
  if (pathname.startsWith('/photos')) return handlePhotoApi(req, res, url, pathname);
  if (pathname.startsWith('/issues')) return handleOfficialIssueApi(req, res, url, pathname);
  if (pathname.startsWith('/report-templates')) return handleReportTemplateApi(req, res, pathname);
  if (pathname.startsWith('/reports')) return handleReportSnapshotApi(req, res, url, pathname);
  if (pathname === '/migrations/legacy') return handleLegacyMigrationApi(req, res, url, pathname);
  if (pathname.startsWith('/projects') || pathname.startsWith('/analysis-records')) return handleStorageApi(req, res, url, pathname);
  return writeJson(res, 404, { message: '接口不存在' });
});

server.listen(9000, '0.0.0.0', () => {
  console.log(`Smart Renew CloudBase API is running in ${envId}`);
});
