import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeId(value) {
  const id = String(value || '');
  if (!/^PRB-[A-Za-z0-9_.-]{8,140}$/.test(id)) {
    const error = new Error('照片路线关联编号无效。');
    error.status = 400;
    error.code = 'INVALID_PHOTO_ROUTE_BINDING_ID';
    throw error;
  }
  return id;
}

export class PhotoRouteBindingRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(binding) {
    await this.ensure();
    const id = safeId(binding?.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(binding), 'utf8');
    await rename(temporary, target);
    return binding;
  }

  async get(bindingId) {
    await this.ensure();
    const id = safeId(bindingId);
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
      const binding = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(binding.projectId) !== String(projectId)) continue;
      if (routeId && String(binding.routeId) !== String(routeId)) continue;
      if (options.status && String(binding.status) !== String(options.status)) continue;
      items.push(binding);
    }
    const offset = Math.max(0, Number(options.offset) || 0);
    const limit = Math.max(1, Math.min(10000, Number(options.limit) || 5000));
    return items.sort((a, b) => String(b.updatedAt || b.createdAt || '')
      .localeCompare(String(a.updatedAt || a.createdAt || '')))
      .slice(offset, offset + limit);
  }
}
