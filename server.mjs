import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  buildNativeProjectIndex,
  normalizeProjectDataRecord,
  projectDataStats
} from './functions/api/project-data-core.js';
import {
  fieldProjectSummary,
  listFieldBuildings,
  listFieldCommunities,
  normalizeCollectionTask
} from './functions/api/field-collection-core.js';
import {
  decodePhotoDataUrl,
  filterPhotoRecords,
  normalizePhotoUpload
} from './functions/api/photo-storage-core.js';
import {
  filterOfficialIssues,
  normalizeOfficialIssue
} from './functions/api/official-issue-core.js';
import { housingProblemCatalogResponse } from './functions/api/housing-problem-catalog.js';
import {
  buildReportSnapshot
} from './functions/api/report-snapshot-core.js';
import {
  auditLegacyData,
  inferLegacyProblemCode
} from './functions/api/legacy-migration-core.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const storageRoot = path.resolve(process.env.SMART_RENEW_DATA_DIR || path.join(root, '.smart-renew-data'));
const projectStorage = path.join(storageRoot, 'projects');
const analysisStorage = path.join(storageRoot, 'analysis-records');
const projectDataStorage = path.join(storageRoot, 'project-data');
const fieldTaskStorage = path.join(storageRoot, 'field-collection-tasks');
const photoRecordStorage = path.join(storageRoot, 'photo-records');
const photoFileStorage = path.join(storageRoot, 'photo-files');
const officialIssueStorage = path.join(storageRoot, 'official-issues');
const reportSnapshotStorage = path.join(storageRoot, 'report-snapshots');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const appUsername = process.env.APP_USERNAME || 'admin';
const appPassword = process.env.APP_PASSWORD || '';
let apiKey = process.env.DASHSCOPE_API_KEY || '';
const baseUrl = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const defaultModel = process.env.DASHSCOPE_MODEL || 'qwen3-vl-plus';
const groupVisionApiKey = process.env.GROUP_VISION_API_KEY || '';
const groupVisionBaseUrl = (process.env.GROUP_VISION_BASE_URL || '').replace(/\/$/, '');
const groupVisionModel = process.env.GROUP_VISION_MODEL || 'qwen3-vl-plus';
const allowedModels = new Set([
  'qwen3-vl-plus',
  'qwen3-vl-flash',
  'qwen-vl-plus',
  'qwen-vl-max',
  'qwen2.5-vl-72b-instruct'
]);

function normalizeVisionProvider(value) {
  return String(value || 'dashscope').toLowerCase() === 'group' ? 'group' : 'dashscope';
}

function unwrapVisionResponse(payload) {
  if (payload && !payload.choices && payload.data) {
    if (payload.code && payload.code !== '00000') throw new Error(payload.message || `集团视觉模型接口错误: ${payload.code}`);
    return payload.data;
  }
  return payload || {};
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf'
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'null', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' });
  res.end(JSON.stringify(body));
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorize(req, res, url) {
  if (!appPassword || url.pathname === '/api/health') return true;
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
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function analyze(req, res) {
  try {
    const body = await readJson(req);
    const provider = normalizeVisionProvider(body.provider);
    const activeApiKey = provider === 'group' ? groupVisionApiKey : apiKey;
    const upstreamBaseUrl = provider === 'group' ? groupVisionBaseUrl : baseUrl;
    if (!activeApiKey || !upstreamBaseUrl) return json(res, 503, { message: provider === 'group' ? '服务端尚未配置集团视觉模型' : '服务端尚未配置 DASHSCOPE_API_KEY' });
    const images = Array.isArray(body.images) ? body.images : [];
    if (!images.length || images.length > 20) return json(res, 400, { message: '单批图片数量必须为 1-20 张' });
    if (images.some((item) => typeof item !== 'string' || !item.startsWith('data:image/'))) return json(res, 400, { message: '图片格式无效' });
    const requestedModel = String(body.model || defaultModel);
    const model = provider === 'group' ? groupVisionModel : (allowedModels.has(requestedModel) ? requestedModel : defaultModel);
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
    if (!upstream.ok) return json(res, upstream.status, { message: rawData.message || rawData.code || `模型请求失败: HTTP ${upstream.status}` });
    const data = unwrapVisionResponse(rawData);
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) return json(res, 502, { message: '模型没有返回可解析内容' });
    return json(res, 200, { content: answer, requestId: data.request_id || data.id || '', model: data.model || model, provider, usage: data.usage || null });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return json(res, 413, { message: '本次图片数据过大，请减少图片数量' });
    if (error.name === 'AbortError') return json(res, 504, { message: '模型响应超时，请稍后重试' });
    return json(res, 500, { message: error.message || '服务端分析失败' });
  }
}

async function configureKey(req, res) {
  try {
    const body = await readJson(req, 16 * 1024);
    if (body.clear === true) {
      apiKey = '';
      return json(res, 200, { ready: false, model: defaultModel, storage: 'process-memory' });
    }
    let nextKey = String(body.apiKey || '').trim();
    if (/^DASHSCOPE_API_KEY\s*=/.test(nextKey)) nextKey = nextKey.replace(/^DASHSCOPE_API_KEY\s*=\s*/, '').trim();
    if ((nextKey.startsWith('"') && nextKey.endsWith('"')) || (nextKey.startsWith("'") && nextKey.endsWith("'"))) nextKey = nextKey.slice(1, -1).trim();
    if (nextKey.length < 10 || nextKey.length > 512 || /\s/.test(nextKey)) return json(res, 400, { message: 'API Key 内容无效，请检查是否复制完整或包含空格' });
    apiKey = nextKey;
    return json(res, 200, { ready: true, model: defaultModel, storage: 'process-memory' });
  } catch (error) {
    return json(res, 400, { message: error.message || '密钥配置失败' });
  }
}

async function ensureStorage() {
  await fs.mkdir(projectStorage, { recursive: true });
  await fs.mkdir(analysisStorage, { recursive: true });
  await fs.mkdir(projectDataStorage, { recursive: true });
  await fs.mkdir(fieldTaskStorage, { recursive: true });
  await fs.mkdir(photoRecordStorage, { recursive: true });
  await fs.mkdir(photoFileStorage, { recursive: true });
  await fs.mkdir(officialIssueStorage, { recursive: true });
  await fs.mkdir(reportSnapshotStorage, { recursive: true });
}

function safeId(value) {
  const id = String(value || '');
  return /^\d+$/.test(id) ? id : '';
}

function safeDataId(value) {
  const id = String(value || '');
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{2,159}$/.test(id) ? id : '';
}

async function readStoredJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeStoredJson(filePath, value) {
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value), 'utf8');
  await fs.rename(tempPath, filePath);
}

async function listStoredJson(directory) {
  await ensureStorage();
  const names = await fs.readdir(directory);
  const rows = [];
  for (const name of names.filter((item) => item.endsWith('.json'))) {
    const value = await readStoredJson(path.join(directory, name));
    if (value) rows.push(value);
  }
  return rows;
}

async function listLocalProjectData(projectId) {
  return (await listStoredJson(projectDataStorage))
    .filter((item) => String(item.projectId) === String(projectId));
}

async function saveLocalProjectData(record) {
  const id = safeDataId(record.id);
  if (!id) throw new Error('索引数据编号无效');
  await writeStoredJson(path.join(projectDataStorage, `${id}.json`), record);
  return record;
}

async function rebuildLocalProjectIndex(projectId) {
  const project = await readStoredJson(path.join(projectStorage, `${projectId}.json`));
  if (!project) throw new Error('项目不存在');
  const analyses = (await listStoredJson(analysisStorage))
    .filter((item) => String(item.projectId) === String(projectId));
  const existing = await listLocalProjectData(projectId);
  const nativeItems = existing.filter((item) => item.source === 'smart-renew');
  await Promise.all(nativeItems.map((item) => fs.unlink(path.join(projectDataStorage, `${item.id}.json`)).catch(() => null)));
  const records = buildNativeProjectIndex(project, analyses);
  for (const record of records) await saveLocalProjectData(record);
  return { records, stats: projectDataStats(existing.filter((item) => item.source !== 'smart-renew').concat(records)) };
}

async function handleProjectDataApi(req, res, url) {
  try {
    await ensureStorage();
    const pathname = url.pathname;
    const recordMatch = pathname.match(/^\/api\/project-data\/([A-Za-z0-9][A-Za-z0-9_.-]{2,159})$/);
    const rebuildMatch = pathname.match(/^\/api\/projects\/(\d+)\/data-index\/rebuild$/);
    const statsMatch = pathname.match(/^\/api\/projects\/(\d+)\/data-index\/stats$/);
    const exportMatch = pathname.match(/^\/api\/projects\/(\d+)\/data-export$/);
    if (req.method === 'GET' && pathname === '/api/project-data') {
      const projectId = safeId(url.searchParams.get('projectId'));
      if (!projectId) return json(res, 400, { message: '项目 ID 无效' });
      let items = await listLocalProjectData(projectId);
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
      return json(res, 200, { items, stats: projectDataStats(items), storage: 'server' });
    }
    if (req.method === 'GET' && recordMatch) {
      const item = await readStoredJson(path.join(projectDataStorage, `${recordMatch[1]}.json`));
      return item ? json(res, 200, item) : json(res, 404, { message: '索引数据不存在' });
    }
    if (req.method === 'PUT' && recordMatch) {
      const body = await readJson(req);
      const id = safeDataId(body.id);
      const projectId = safeId(body.projectId);
      if (!id || id !== recordMatch[1] || !projectId) return json(res, 400, { message: '索引数据编号无效' });
      return json(res, 200, await saveLocalProjectData(normalizeProjectDataRecord(body, projectId)));
    }
    if (req.method === 'DELETE' && recordMatch) {
      await fs.unlink(path.join(projectDataStorage, `${recordMatch[1]}.json`)).catch(() => null);
      return json(res, 200, { deleted: true, id: recordMatch[1] });
    }
    if (req.method === 'POST' && pathname === '/api/project-data/import') {
      const body = await readJson(req);
      const projectId = safeId(body.projectId);
      const inputs = Array.isArray(body.records) ? body.records : [];
      if (!projectId || !inputs.length) return json(res, 400, { message: '请选择项目并提供需要导入的数据' });
      if (inputs.length > 3000) return json(res, 400, { message: '单次最多导入 3000 条数据' });
      if (body.mode === 'replace') {
        const imported = (await listLocalProjectData(projectId)).filter((item) => item.source !== 'smart-renew');
        await Promise.all(imported.map((item) => fs.unlink(path.join(projectDataStorage, `${item.id}.json`)).catch(() => null)));
      }
      const records = inputs.map((item) => normalizeProjectDataRecord(item, projectId));
      for (const record of records) await saveLocalProjectData(record);
      return json(res, 200, { imported: records.length, stats: projectDataStats(await listLocalProjectData(projectId)) });
    }
    if (req.method === 'POST' && rebuildMatch) {
      const result = await rebuildLocalProjectIndex(rebuildMatch[1]);
      return json(res, 200, { rebuilt: result.records.length, stats: result.stats });
    }
    if (req.method === 'GET' && statsMatch) return json(res, 200, projectDataStats(await listLocalProjectData(statsMatch[1])));
    if (req.method === 'GET' && exportMatch) {
      const project = await readStoredJson(path.join(projectStorage, `${exportMatch[1]}.json`));
      if (!project) return json(res, 404, { message: '项目不存在' });
      return json(res, 200, {
        format: 'smart-renew-project-data',
        schemaVersion: '2.0.0',
        exportedAt: new Date().toISOString(),
        project: { id: String(project.id), name: project.name || '', area: project.area || '' },
        records: await listLocalProjectData(exportMatch[1])
      });
    }
    return json(res, 404, { message: '项目数据索引接口不存在' });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return json(res, 413, { message: '导入数据过大，请拆分后重试' });
    return json(res, 500, { message: error.message || '项目数据索引操作失败' });
  }
}

async function handleStorageApi(req, res, url) {
  try {
    await ensureStorage();
    const projectMatch = url.pathname.match(/^\/api\/projects\/(\d+)$/);
    const recordMatch = url.pathname.match(/^\/api\/analysis-records\/(\d+)$/);
    if (req.method === 'GET' && url.pathname === '/api/projects') {
      return json(res, 200, { items: await listStoredJson(projectStorage), storage: 'server' });
    }
    if (req.method === 'GET' && projectMatch) {
      const item = await readStoredJson(path.join(projectStorage, `${projectMatch[1]}.json`));
      return item ? json(res, 200, item) : json(res, 404, { message: '项目不存在' });
    }
    if (req.method === 'PUT' && projectMatch) {
      const body = await readJson(req);
      const id = safeId(body.id);
      if (!id || id !== projectMatch[1]) return json(res, 400, { message: '项目 ID 无效' });
      await writeStoredJson(path.join(projectStorage, `${id}.json`), body);
      return json(res, 200, body);
    }
    if (req.method === 'GET' && url.pathname === '/api/analysis-records') {
      let items = await listStoredJson(analysisStorage);
      const projectId = safeId(url.searchParams.get('projectId'));
      if (projectId) items = items.filter((item) => String(item.projectId) === projectId);
      return json(res, 200, { items, storage: 'server' });
    }
    if (req.method === 'GET' && recordMatch) {
      const item = await readStoredJson(path.join(analysisStorage, `${recordMatch[1]}.json`));
      return item ? json(res, 200, item) : json(res, 404, { message: '分析记录不存在' });
    }
    if (req.method === 'PUT' && recordMatch) {
      const body = await readJson(req);
      const id = safeId(body.id);
      if (!id || id !== recordMatch[1]) return json(res, 400, { message: '分析记录 ID 无效' });
      await writeStoredJson(path.join(analysisStorage, `${id}.json`), body);
      return json(res, 200, body);
    }
    if (req.method === 'DELETE' && url.pathname === '/api/analysis-records') {
      const names = await fs.readdir(analysisStorage);
      await Promise.all(names.filter((name) => name.endsWith('.json')).map((name) => fs.unlink(path.join(analysisStorage, name))));
      return json(res, 200, { deleted: true });
    }
    return json(res, 404, { message: '数据接口不存在' });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return json(res, 413, { message: '保存数据过大，请减少单次上传图片数量' });
    return json(res, 500, { message: error.message || '服务端数据存储失败' });
  }
}

async function handleFieldCollectionApi(req, res, url) {
  try {
    await ensureStorage();
    const projectCommunitiesMatch = url.pathname.match(/^\/api\/field\/projects\/(\d+)\/communities$/);
    const communityBuildingsMatch = url.pathname.match(/^\/api\/field\/projects\/(\d+)\/communities\/([A-Za-z0-9_.-]+)\/buildings$/);
    const taskMatch = url.pathname.match(/^\/api\/field\/collection-tasks\/([A-Za-z0-9_.-]+)$/);
    const taskCompleteMatch = url.pathname.match(/^\/api\/field\/collection-tasks\/([A-Za-z0-9_.-]+)\/complete$/);
    if (req.method === 'GET' && url.pathname === '/api/field/problem-types') {
      return json(res, 200, { items: housingProblemCatalogResponse(), schemaVersion: '1.0.0' });
    }
    if (req.method === 'GET' && url.pathname === '/api/field/projects') {
      const projects = (await listStoredJson(projectStorage)).map(fieldProjectSummary);
      return json(res, 200, { items: projects, storage: 'server' });
    }
    if (req.method === 'GET' && projectCommunitiesMatch) {
      const project = await readStoredJson(path.join(projectStorage, `${projectCommunitiesMatch[1]}.json`));
      if (!project) return json(res, 404, { message: '项目不存在' });
      return json(res, 200, { items: listFieldCommunities(project), storage: 'server' });
    }
    if (req.method === 'GET' && communityBuildingsMatch) {
      const project = await readStoredJson(path.join(projectStorage, `${communityBuildingsMatch[1]}.json`));
      if (!project) return json(res, 404, { message: '项目不存在' });
      const items = listFieldBuildings(project, communityBuildingsMatch[2]);
      return items ? json(res, 200, { items, storage: 'server' }) : json(res, 404, { message: '小区不存在' });
    }
    if (req.method === 'POST' && url.pathname === '/api/field/collection-tasks') {
      const body = await readJson(req, 256 * 1024);
      const projectId = safeId(body.projectId);
      if (!projectId) return json(res, 400, { message: '项目编号无效' });
      const project = await readStoredJson(path.join(projectStorage, `${projectId}.json`));
      if (!project) return json(res, 404, { message: '项目不存在' });
      const candidate = normalizeCollectionTask(body, project);
      const existing = await readStoredJson(path.join(fieldTaskStorage, `${candidate.id}.json`));
      if (existing) return json(res, 200, { item: existing, duplicated: true, storage: 'server' });
      await writeStoredJson(path.join(fieldTaskStorage, `${candidate.id}.json`), candidate);
      return json(res, 201, { item: candidate, duplicated: false, storage: 'server' });
    }
    if (req.method === 'GET' && taskMatch) {
      const task = await readStoredJson(path.join(fieldTaskStorage, `${taskMatch[1]}.json`));
      return task ? json(res, 200, { item: task, storage: 'server' }) : json(res, 404, { message: '现场任务不存在' });
    }
    if (req.method === 'POST' && taskCompleteMatch) {
      const taskPath = path.join(fieldTaskStorage, `${taskCompleteMatch[1]}.json`);
      const task = await readStoredJson(taskPath);
      if (!task) return json(res, 404, { message: '现场任务不存在' });
      const body = await readJson(req, 64 * 1024);
      const uploadedPhotoCount = Math.max(0, Number(body.uploadedPhotoCount) || 0);
      if (uploadedPhotoCount < Number(task.photoCount || 0)) {
        return json(res, 400, { message: '仍有照片未上传完成' });
      }
      const completed = {
        ...task,
        status: 'completed',
        syncStatus: 'completed',
        uploadedPhotoCount,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await writeStoredJson(taskPath, completed);
      return json(res, 200, { item: completed, storage: 'server' });
    }
    return json(res, 404, { message: '现场采集接口不存在' });
  } catch (error) {
    return json(res, 400, { message: error.message || '现场采集数据无效' });
  }
}

async function handlePhotoApi(req, res, url) {
  try {
    await ensureStorage();
    const recordMatch = url.pathname.match(/^\/api\/photos\/([A-Za-z0-9_.-]+)$/);
    const contentMatch = url.pathname.match(/^\/api\/photos\/([A-Za-z0-9_.-]+)\/content$/);
    if (req.method === 'GET' && url.pathname === '/api/photos') {
      const items = filterPhotoRecords(await listStoredJson(photoRecordStorage), url.searchParams)
        .map((item) => ({ ...item, url: `/api/photos/${item.id}/content` }));
      return json(res, 200, { items, storage: 'server-filesystem' });
    }
    if (req.method === 'POST' && url.pathname === '/api/photos/upload') {
      const body = await readJson(req, 18 * 1024 * 1024);
      const projectId = safeId(body.projectId);
      if (!projectId) return json(res, 400, { message: '项目编号无效' });
      const project = await readStoredJson(path.join(projectStorage, `${projectId}.json`));
      if (!project) return json(res, 404, { message: '项目不存在' });
      if (body.taskId) {
        const task = await readStoredJson(path.join(fieldTaskStorage, `${String(body.taskId)}.json`));
        if (!task) return json(res, 404, { message: '现场采集任务不存在' });
        if (
          String(task.projectId) !== String(body.projectId) ||
          String(task.communityId) !== String(body.communityId) ||
          String(task.buildingId) !== String(body.buildingId) ||
          String(task.problemCode) !== String(body.problemCode)
        ) {
          return json(res, 400, { message: '照片信息与现场采集任务不一致' });
        }
        body.householdCount = task.householdCount;
        body.collectorId = task.collectorId;
      }
      const decoded = decodePhotoDataUrl(body.dataUrl);
      const record = normalizePhotoUpload(body, project, decoded);
      const existing = await readStoredJson(path.join(photoRecordStorage, `${record.id}.json`));
      if (existing) return json(res, 200, { item: { ...existing, url: `/api/photos/${existing.id}/content` }, duplicated: true });
      const relativePath = record.cloudPath.replace(/^projects\/[^/]+\/photos\//, '');
      const filePath = path.resolve(photoFileStorage, projectId, relativePath);
      const allowedRoot = path.resolve(photoFileStorage, projectId) + path.sep;
      if (!filePath.startsWith(allowedRoot)) throw new Error('照片存储路径无效');
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, decoded.buffer);
      record.storage = 'server-filesystem';
      record.filePath = path.relative(photoFileStorage, filePath).split(path.sep).join('/');
      await writeStoredJson(path.join(photoRecordStorage, `${record.id}.json`), record);
      return json(res, 201, { item: { ...record, url: `/api/photos/${record.id}/content` }, duplicated: false });
    }
    if (req.method === 'GET' && contentMatch) {
      const record = await readStoredJson(path.join(photoRecordStorage, `${contentMatch[1]}.json`));
      if (!record) return json(res, 404, { message: '照片不存在' });
      const filePath = path.resolve(photoFileStorage, record.filePath || '');
      if (!filePath.startsWith(path.resolve(photoFileStorage) + path.sep)) return json(res, 403, { message: '照片路径无效' });
      const data = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': record.mimeType || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': 'null' });
      return res.end(data);
    }
    if (req.method === 'GET' && recordMatch) {
      const record = await readStoredJson(path.join(photoRecordStorage, `${recordMatch[1]}.json`));
      return record ? json(res, 200, { item: { ...record, url: `/api/photos/${record.id}/content` } }) : json(res, 404, { message: '照片不存在' });
    }
    return json(res, 404, { message: '照片档案接口不存在' });
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') return json(res, 413, { message: '照片数据过大' });
    return json(res, 400, { message: error.message || '照片归档失败' });
  }
}

async function handleOfficialIssueApi(req, res, url) {
  try {
    await ensureStorage();
    if (req.method === 'GET' && url.pathname === '/api/issues') {
      return json(res, 200, { items: filterOfficialIssues(await listStoredJson(officialIssueStorage), url.searchParams), storage: 'server' });
    }
    if (req.method === 'POST' && url.pathname === '/api/issues/finalize') {
      const body = await readJson(req, 2 * 1024 * 1024);
      const analysisId = safeId(body.analysisId);
      if (!analysisId) return json(res, 400, { message: '分析批次编号无效' });
      const analysis = await readStoredJson(path.join(analysisStorage, `${analysisId}.json`));
      if (!analysis) return json(res, 404, { message: '分析批次不存在' });
      const issues = Array.isArray(body.issues) ? body.issues : [];
      if (!issues.length) return json(res, 400, { message: '没有可写入的正式问题' });
      const records = issues.map((issue) => normalizeOfficialIssue(issue, analysis, body.reviewerName));
      for (const record of records) await writeStoredJson(path.join(officialIssueStorage, `${record.id}.json`), record);
      return json(res, 200, { items: records, finalized: records.length, storage: 'server' });
    }
    return json(res, 404, { message: '正式问题接口不存在' });
  } catch (error) {
    return json(res, 400, { message: error.message || '正式问题写入失败' });
  }
}

async function handleReportSnapshotApi(req, res, url) {
  try {
    await ensureStorage();
    const reportMatch = url.pathname.match(/^\/api\/reports\/(RPT-[A-Za-z0-9_.-]+)$/);
    if (req.method === 'GET' && url.pathname === '/api/reports') {
      const projectId = safeId(url.searchParams.get('projectId'));
      let items = await listStoredJson(reportSnapshotStorage);
      if (projectId) items = items.filter((item) => String(item.projectId) === projectId);
      items.sort((a, b) => Number(b.version) - Number(a.version));
      return json(res, 200, { items, storage: 'server' });
    }
    if (req.method === 'GET' && reportMatch) {
      const item = await readStoredJson(path.join(reportSnapshotStorage, `${reportMatch[1]}.json`));
      return item ? json(res, 200, { item, storage: 'server' }) : json(res, 404, { message: '报告版本不存在' });
    }
    if (req.method === 'POST' && url.pathname === '/api/reports/generate') {
      const body = await readJson(req, 256 * 1024);
      const projectId = safeId(body.projectId);
      if (!projectId) return json(res, 400, { message: '项目编号无效' });
      const project = await readStoredJson(path.join(projectStorage, `${projectId}.json`));
      if (!project) return json(res, 404, { message: '项目不存在' });
      const issues = filterOfficialIssues(await listStoredJson(officialIssueStorage), new URLSearchParams({ projectId }));
      if (!issues.length) return json(res, 400, { message: '项目尚无人工确认的正式问题' });
      const photos = filterPhotoRecords(await listStoredJson(photoRecordStorage), new URLSearchParams({ projectId }));
      const analyses = (await listStoredJson(analysisStorage)).filter((item) => String(item.projectId) === projectId);
      const existing = (await listStoredJson(reportSnapshotStorage)).filter((item) => String(item.projectId) === projectId);
      const report = buildReportSnapshot({ project, issues, photos, analyses, existing, generatedBy: body.generatedBy });
      await writeStoredJson(path.join(reportSnapshotStorage, `${report.id}.json`), report);
      return json(res, 201, { item: report, storage: 'server' });
    }
    return json(res, 404, { message: '报告版本接口不存在' });
  } catch (error) {
    return json(res, 400, { message: error.message || '报告版本生成失败' });
  }
}

async function storeMigratedLocalPhoto(project, analysis, dataUrl, meta, imageIndex, variant) {
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
  const existing = await readStoredJson(path.join(photoRecordStorage, `${record.id}.json`));
  if (existing) return existing;
  const relativePath = record.cloudPath.replace(/^projects\/[^/]+\/photos\//, '');
  const filePath = path.resolve(photoFileStorage, String(project.id), relativePath);
  const allowedRoot = path.resolve(photoFileStorage, String(project.id)) + path.sep;
  if (!filePath.startsWith(allowedRoot)) throw new Error('迁移照片路径无效');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, decoded.buffer);
  record.storage = 'server-filesystem';
  record.filePath = path.relative(photoFileStorage, filePath).split(path.sep).join('/');
  await writeStoredJson(path.join(photoRecordStorage, `${record.id}.json`), record);
  return record;
}

async function handleLegacyMigrationApi(req, res, url) {
  try {
    await ensureStorage();
    const body = req.method === 'POST' ? await readJson(req, 64 * 1024) : {};
    const projectId = safeId(body.projectId || url.searchParams.get('projectId'));
    if (!projectId) return json(res, 400, { message: '项目编号无效' });
    const project = await readStoredJson(path.join(projectStorage, `${projectId}.json`));
    if (!project) return json(res, 404, { message: '项目不存在' });
    const analyses = await listStoredJson(analysisStorage);
    const photos = await listStoredJson(photoRecordStorage);
    const issues = await listStoredJson(officialIssueStorage);
    const before = auditLegacyData(projectId, analyses, photos, issues);
    if (req.method === 'GET' || body.apply !== true) return json(res, 200, { audit: before, applied: false });
    let migratedPhotos = 0;
    let migratedIssues = 0;
    for (const analysis of analyses.filter((item) => String(item.projectId) === projectId)) {
      const meta = Array.isArray(analysis.imageMeta) ? analysis.imageMeta : [];
      if (Array.isArray(analysis.imagesBase64) && analysis.imagesBase64.length) {
        analysis.photoIds = [];
        for (let index = 0; index < analysis.imagesBase64.length; index += 1) {
          const photo = await storeMigratedLocalPhoto(project, analysis, analysis.imagesBase64[index], meta[index] || {}, index + 1, 'original');
          analysis.photoIds.push(photo.id);
          meta[index] = { ...(meta[index] || {}), photoId: photo.id, communityId: photo.communityId, buildingId: photo.buildingId, storage: photo.storage, fileId: photo.fileId, cloudPath: photo.cloudPath };
          migratedPhotos += 1;
        }
        delete analysis.imagesBase64;
      }
      if (Array.isArray(analysis.annotatedImages) && analysis.annotatedImages.length) {
        analysis.annotatedPhotoIds = [];
        for (let index = 0; index < analysis.annotatedImages.length; index += 1) {
          const photo = await storeMigratedLocalPhoto(project, analysis, analysis.annotatedImages[index], meta[index] || {}, index + 1, 'annotated');
          analysis.annotatedPhotoIds.push(photo.id);
          migratedPhotos += 1;
        }
        delete analysis.annotatedImages;
      }
      analysis.imageMeta = meta;
      await writeStoredJson(path.join(analysisStorage, `${analysis.id}.json`), analysis);
      if (analysis.status === 'archived' && Array.isArray(analysis.result?.issues)) {
        for (const candidate of analysis.result.issues) {
          const official = normalizeOfficialIssue({
            ...candidate,
            problemCode: inferLegacyProblemCode(candidate),
            reviewStatus: candidate.reviewStatus === 'modified' ? 'modified' : 'accepted'
          }, analysis, analysis.reviewerName || body.reviewerName || '历史数据迁移');
          await writeStoredJson(path.join(officialIssueStorage, `${official.id}.json`), official);
          migratedIssues += 1;
        }
      }
    }
    await rebuildLocalProjectIndex(projectId);
    const after = auditLegacyData(projectId, await listStoredJson(analysisStorage), await listStoredJson(photoRecordStorage), await listStoredJson(officialIssueStorage));
    return json(res, 200, { applied: true, migratedPhotos, migratedIssues, before, after });
  } catch (error) {
    return json(res, 400, { message: error.message || '旧数据迁移失败' });
  }
}

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (requested !== 'index.html' && !requested.startsWith('assets/')) return json(res, 404, { message: '文件不存在' });
  const filePath = path.resolve(root, requested);
  if ((!filePath.startsWith(root + path.sep) && filePath !== path.join(root, 'index.html')) || filePath.startsWith(storageRoot + path.sep)) return json(res, 403, { message: '禁止访问' });
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'SAMEORIGIN'
    });
    res.end(data);
  } catch {
    json(res, 404, { message: '文件不存在' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': 'null', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' });
    return res.end();
  }
  if (!authorize(req, res, url)) return;
  if (req.method === 'GET' && req.url.startsWith('/api/health')) return json(res, 200, { ready: Boolean(apiKey), model: defaultModel, providers: { dashscope: Boolean(apiKey), group: Boolean(groupVisionApiKey && groupVisionBaseUrl) } });
  if (req.method === 'POST' && req.url.startsWith('/api/config/session/health')) {
    const body = await readJson(req).catch(() => ({}));
    const provider = normalizeVisionProvider(body.provider);
    return json(res, 200, { ready: provider === 'group' ? Boolean(groupVisionApiKey && groupVisionBaseUrl) : Boolean(apiKey), provider, model: provider === 'group' ? groupVisionModel : defaultModel, storage: 'server-environment' });
  }
  if (req.method === 'POST' && req.url.startsWith('/api/config/key')) return configureKey(req, res);
  if (req.method === 'POST' && req.url.startsWith('/api/vision/analyze')) return analyze(req, res);
  if (url.pathname.startsWith('/api/project-data') || /^\/api\/projects\/\d+\/data-/.test(url.pathname)) return handleProjectDataApi(req, res, url);
  if (url.pathname.startsWith('/api/field/')) return handleFieldCollectionApi(req, res, url);
  if (url.pathname.startsWith('/api/photos')) return handlePhotoApi(req, res, url);
  if (url.pathname.startsWith('/api/issues')) return handleOfficialIssueApi(req, res, url);
  if (url.pathname.startsWith('/api/reports')) return handleReportSnapshotApi(req, res, url);
  if (url.pathname === '/api/migrations/legacy') return handleLegacyMigrationApi(req, res, url);
  if (url.pathname.startsWith('/api/projects') || url.pathname.startsWith('/api/analysis-records')) return handleStorageApi(req, res, url);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  json(res, 405, { message: '不支持的请求方法' });
});

server.listen(port, host, () => {
  console.log(`Smart Renew: http://${host}:${port}`);
  console.log(apiKey ? 'DashScope proxy: ready' : 'DashScope proxy: DASHSCOPE_API_KEY is not configured');
  console.log(appPassword ? `Access control: enabled for ${appUsername}` : 'Access control: disabled (local development)');
});
