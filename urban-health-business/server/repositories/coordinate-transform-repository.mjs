import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeId(value) {
  const id = String(value || '');
  if (!/^CRSTRANS-[A-Za-z0-9_.-]{8,140}$/.test(id)) {
    const error = new Error('坐标转换记录编号无效。');
    error.status = 400;
    error.code = 'INVALID_COORDINATE_TRANSFORM_ID';
    throw error;
  }
  return id;
}

export class CoordinateTransformRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(record) {
    await this.ensure();
    const id = safeId(record?.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(record), 'utf8');
    await rename(temporary, target);
    return record;
  }

  async get(id) {
    await this.ensure();
    const safe = safeId(id);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${safe}.json`), 'utf8'));
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
      const record = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(record.projectId) !== String(projectId)) continue;
      items.push(record);
    }
    return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
}
