import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeId(value) {
  const id = String(value || '');
  if (!/^ROUTE-[A-Za-z0-9_.-]{8,140}$/.test(id)) {
    const error = new Error('踏勘路线编号无效。');
    error.status = 400;
    error.code = 'INVALID_SURVEY_ROUTE_ID';
    throw error;
  }
  return id;
}

export class SurveyRouteRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(route) {
    await this.ensure();
    const id = safeId(route?.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(route), 'utf8');
    await rename(temporary, target);
    return route;
  }

  async get(routeId) {
    await this.ensure();
    const id = safeId(routeId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(projectId = '', options = {}) {
    await this.ensure();
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const route = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(route.projectId) !== String(projectId)) continue;
      if (options.status && String(route.status) !== String(options.status)) continue;
      items.push(route);
    }
    const offset = Math.max(0, Number(options.offset) || 0);
    const limit = Math.max(1, Math.min(1000, Number(options.limit) || 500));
    return items.sort((a, b) => String(b.updatedAt || b.createdAt || '')
      .localeCompare(String(a.updatedAt || a.createdAt || '')))
      .slice(offset, offset + limit);
  }
}
