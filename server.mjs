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

const root = path.dirname(fileURLToPath(import.meta.url));
const storageRoot = path.resolve(process.env.SMART_RENEW_DATA_DIR || path.join(root, '.smart-renew-data'));
const projectStorage = path.join(storageRoot, 'projects');
const analysisStorage = path.join(storageRoot, 'analysis-records');
const projectDataStorage = path.join(storageRoot, 'project-data');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const appUsername = process.env.APP_USERNAME || 'admin';
const appPassword = process.env.APP_PASSWORD || '';
let apiKey = process.env.DASHSCOPE_API_KEY || '';
const baseUrl = (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const defaultModel = process.env.DASHSCOPE_MODEL || 'qwen3-vl-plus';
const allowedModels = new Set([
  'qwen3-vl-plus',
  'qwen3-vl-flash',
  'qwen-vl-plus',
  'qwen-vl-max',
  'qwen2.5-vl-72b-instruct'
]);

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
  if (!apiKey) return json(res, 503, { message: '服务端尚未配置 DASHSCOPE_API_KEY' });
  try {
    const body = await readJson(req);
    const images = Array.isArray(body.images) ? body.images : [];
    if (!images.length || images.length > 20) return json(res, 400, { message: '单批图片数量必须为 1-20 张' });
    if (images.some((item) => typeof item !== 'string' || !item.startsWith('data:image/'))) return json(res, 400, { message: '图片格式无效' });
    const requestedModel = String(body.model || defaultModel);
    const model = allowedModels.has(requestedModel) ? requestedModel : defaultModel;
    const content = [{ type: 'text', text: String(body.prompt || '') }];
    for (const image of images) content.push({ type: 'image_url', image_url: { url: image } });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    let upstream;
    try {
      upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是一位专业的住区安全体检专家。只输出符合要求的 JSON。' },
            { role: 'user', content }
          ],
          max_tokens: Math.max(500, Math.min(8000, Number(body.maxTokens) || 3000)),
          temperature: Math.max(0, Math.min(1, Number(body.temperature) || 0.2)),
          top_p: Math.max(0.1, Math.min(1, Number(body.topP) || 0.9)),
          response_format: { type: 'json_object' }
        })
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json(res, upstream.status, { message: data.message || data.code || `模型请求失败: HTTP ${upstream.status}` });
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) return json(res, 502, { message: '模型没有返回可解析内容' });
    return json(res, 200, { content: answer, requestId: data.request_id || data.id || '', model: data.model || model, usage: data.usage || null });
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
  if (req.method === 'GET' && req.url.startsWith('/api/health')) return json(res, 200, { ready: Boolean(apiKey), model: defaultModel });
  if (req.method === 'POST' && req.url.startsWith('/api/config/key')) return configureKey(req, res);
  if (req.method === 'POST' && req.url.startsWith('/api/vision/analyze')) return analyze(req, res);
  if (url.pathname.startsWith('/api/project-data') || /^\/api\/projects\/\d+\/data-/.test(url.pathname)) return handleProjectDataApi(req, res, url);
  if (url.pathname.startsWith('/api/projects') || url.pathname.startsWith('/api/analysis-records')) return handleStorageApi(req, res, url);
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);
  json(res, 405, { message: '不支持的请求方法' });
});

server.listen(port, host, () => {
  console.log(`Smart Renew: http://${host}:${port}`);
  console.log(apiKey ? 'DashScope proxy: ready' : 'DashScope proxy: DASHSCOPE_API_KEY is not configured');
  console.log(appPassword ? `Access control: enabled for ${appUsername}` : 'Access control: disabled (local development)');
});
