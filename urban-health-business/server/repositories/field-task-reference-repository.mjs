import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeTaskId(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,159}$/.test(id)) {
    const error = new Error('外业任务编号无效。');
    error.status = 400;
    error.code = 'INVALID_FIELD_TASK_ID';
    throw error;
  }
  return id;
}

export class FieldTaskReferenceRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(reference) {
    await this.ensure();
    const id = safeTaskId(reference?.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(reference), 'utf8');
    await rename(temporary, target);
    return reference;
  }

  async get(taskId) {
    await this.ensure();
    const id = safeTaskId(taskId);
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
      const reference = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(reference.projectId) !== String(projectId)) continue;
      items.push(reference);
    }
    return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
}
