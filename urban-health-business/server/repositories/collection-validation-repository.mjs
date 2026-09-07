import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeProjectId(value) {
  const id = String(value || '');
  if (!/^\d+$/.test(id)) {
    const error = new Error('项目编号无效。');
    error.status = 400;
    error.code = 'INVALID_PROJECT_ID';
    throw error;
  }
  return id;
}

export class CollectionValidationRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async create(validation, validatedBy) {
    await this.ensure();
    const projectId = safeProjectId(validation?.projectId);
    const createdAt = validation.computedAt || new Date().toISOString();
    const item = {
      ...validation,
      id: `COLVAL-${projectId}-${Date.now()}-${randomUUID().slice(0, 8)}`,
      projectId,
      validatedBy: String(validatedBy || '').trim().slice(0, 120),
      createdAt,
      schemaVersion: '1.0.0'
    };
    const target = path.join(this.root, `${item.id}.json`);
    const temporary = path.join(this.root, `${item.id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(item), 'utf8');
    await rename(temporary, target);
    return item;
  }

  async list(projectId = '') {
    await this.ensure();
    const requested = projectId ? safeProjectId(projectId) : '';
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const validation = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (requested && String(validation.projectId) !== requested) continue;
      items.push(validation);
    }
    return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
}
