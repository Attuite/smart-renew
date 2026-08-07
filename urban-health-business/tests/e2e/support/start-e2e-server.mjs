import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const businessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const repositoryRoot = path.resolve(businessRoot, '..');
const businessPort = Number(process.env.E2E_BUSINESS_PORT || 4282);
const legacyPort = Number(process.env.E2E_LEGACY_PORT || 4273);
const businessBase = `http://127.0.0.1:${businessPort}`;
const legacyBase = `http://127.0.0.1:${legacyPort}`;
const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'urban-health-e2e-'));
const children = [];
let stopping = false;

function start(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: ['ignore', 'ignore', 'inherit']
  });
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service startup is asynchronous.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function jsonRequest(pathname, options = {}) {
  const response = await fetch(`${businessBase}${pathname}`, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname}: ${payload?.error?.message || response.status}`);
  }
  return payload?.ok === true ? payload.data : payload;
}

async function createProject(name, description) {
  const outcome = await jsonRequest('/api/projects', {
    method: 'POST',
    body: { name, area: 'E2E测试区', type: 'residential', description }
  });
  return outcome.item || outcome;
}

async function setBoundary(projectId) {
  const outcome = await jsonRequest(`/api/projects/${projectId}/boundary`, {
    method: 'PATCH',
    body: {
      coordinates: [
        [108.9400, 34.2600],
        [108.9700, 34.2600],
        [108.9700, 34.2900],
        [108.9400, 34.2900]
      ],
      crs: 'WGS84',
      source: 'e2e-fixture',
      updatedBy: 'E2E Seeder',
      expectedRevision: 1
    }
  });
  return outcome.item || outcome;
}

async function createIssue(projectId, input, index, located = true) {
  const outcome = await jsonRequest(`/api/projects/${projectId}/issues`, {
    method: 'POST',
    body: {
      title: input.title,
      severity: input.severity,
      categoryCode: input.categoryCode,
      categoryName: input.categoryName,
      description: `${input.title}的E2E真实业务描述`,
      evidence: `E2E现场证据 ${index + 1}`,
      suggestion: '按业务流程复核并治理',
      recordedBy: 'E2E Seeder'
    }
  });
  const issue = outcome.item || outcome;
  if (!located) return issue;
  const column = index % 10;
  const row = Math.floor(index / 10) % 10;
  const geometryOutcome = await jsonRequest(`/api/issues/${encodeURIComponent(issue.id)}/geometry`, {
    method: 'PATCH',
    body: {
      longitude: 108.943 + column * 0.0024,
      latitude: 34.263 + row * 0.0024,
      crs: 'WGS84',
      accuracy: 'e2e-fixture',
      confirmedBy: 'E2E Seeder',
      expectedGeometryRevision: 0
    }
  });
  return geometryOutcome.item || geometryOutcome;
}

async function seed() {
  await createProject('E2E 空项目', '用于验证真实空状态，不注入任何边界或问题。');

  const small = await createProject('E2E 小样本项目', '用于验证筛选、图层、URL恢复和响应式交互。');
  await setBoundary(small.id);
  const smallIssues = [
    { title: '消防通道堆物', severity: 'high', categoryCode: 'FIRE', categoryName: '消防安全' },
    { title: '楼道照明损坏', severity: 'medium', categoryCode: 'LIGHT', categoryName: '公共照明' },
    { title: '绿化带裸露', severity: 'low', categoryCode: 'GREEN', categoryName: '环境品质' }
  ];
  for (const [index, issue] of smallIssues.entries()) {
    await createIssue(small.id, issue, index, index < 2);
  }

  const dense = await createProject('E2E 密集项目', '用于验证密集点位的有界渲染和视觉基线。');
  await setBoundary(dense.id);
  const categories = [
    ['FIRE', '消防安全'],
    ['LIGHT', '公共照明'],
    ['GREEN', '环境品质']
  ];
  for (let index = 0; index < 60; index += 1) {
    const [categoryCode, categoryName] = categories[index % categories.length];
    await createIssue(dense.id, {
      title: `密集点位 ${String(index + 1).padStart(2, '0')}`,
      severity: ['high', 'medium', 'low'][index % 3],
      categoryCode,
      categoryName
    }, index, true);
  }
}

async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  const resolved = path.resolve(dataRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    await rm(resolved, { recursive: true, force: true });
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => void stop(0));
process.on('SIGTERM', () => void stop(0));

try {
  start(process.execPath, ['server.mjs'], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(legacyPort),
      SMART_RENEW_DATA_DIR: path.join(dataRoot, 'legacy'),
      DASHSCOPE_API_KEY: ''
    }
  });
  await waitFor(`${legacyBase}/api/health`);

  start(process.execPath, ['server/index.mjs'], {
    cwd: businessRoot,
    env: {
      ...process.env,
      URBAN_HEALTH_HOST: '127.0.0.1',
      URBAN_HEALTH_PORT: String(businessPort),
      URBAN_HEALTH_DATA_DIR: path.join(dataRoot, 'business'),
      URBAN_HEALTH_PROVIDER: 'sqlite',
      URBAN_HEALTH_SQLITE_PATH: path.join(dataRoot, 'business', 'business-records.sqlite'),
      URBAN_HEALTH_AUTH_MODE: 'disabled',
      SMART_RENEW_API_BASE: legacyBase,
      AMAP_JS_KEY: '',
      AMAP_JS_SECURITY_CODE: '',
      AMAP_WEB_SERVICE_KEY: ''
    }
  });
  await waitFor(`${businessBase}/api/ready`);
  await seed();
  process.stdout.write(`E2E fixtures ready at ${businessBase}\n`);
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  await stop(1);
}

await new Promise(() => {});
