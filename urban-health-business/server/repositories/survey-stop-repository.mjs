import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeId(value) {
  const id = String(value || '');
  if (!/^STOP-[A-Za-z0-9_.-]{8,140}$/.test(id)) {
    const error = new Error('停留节点编号无效。');
    error.status = 400;
    error.code = 'INVALID_SURVEY_STOP_ID';
    throw error;
  }
  return id;
}

export class SurveyStopRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(stop) {
    await this.ensure();
    const id = safeId(stop?.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(stop), 'utf8');
    await rename(temporary, target);
    return stop;
  }

  async get(stopId) {
    await this.ensure();
    const id = safeId(stopId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(projectId = '', routeId = '', options = {}) {
    await this.ensure();
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const stop = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(stop.projectId) !== String(projectId)) continue;
      if (routeId && String(stop.routeId) !== String(routeId)) continue;
      if (options.status && String(stop.status) !== String(options.status)) continue;
      items.push(stop);
    }
    const offset = Math.max(0, Number(options.offset) || 0);
    const limit = Math.max(1, Math.min(10000, Number(options.limit) || 5000));
    return items.sort((a, b) => String(a.arrivedAt || '').localeCompare(String(b.arrivedAt || '')))
      .slice(offset, offset + limit);
  }
}
