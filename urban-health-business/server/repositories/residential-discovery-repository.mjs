import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeRunId(value) {
  const id = String(value || '');
  if (!/^RDRUN-[A-Za-z0-9_.-]{8,140}$/.test(id)) {
    const error = new Error('住宅识别运行编号无效。');
    error.status = 400;
    error.code = 'INVALID_RESIDENTIAL_DISCOVERY_RUN_ID';
    throw error;
  }
  return id;
}

export class ResidentialDiscoveryRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(run) {
    await this.ensure();
    const id = safeRunId(run?.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(run), 'utf8');
    await rename(temporary, target);
    return run;
  }

  async get(runId) {
    await this.ensure();
    const id = safeRunId(runId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(projectId = '') {
    await this.ensure();
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const run = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(run.projectId) !== String(projectId)) continue;
      items.push(run);
    }
    return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
}
