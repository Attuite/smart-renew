import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeRunId(value) {
  const id = String(value || '');
  if (!/^MIGRUN-[A-Za-z0-9_.-]{8,160}$/.test(id)) {
    const error = new Error('迁移运行编号无效。');
    error.status = 400;
    error.code = 'INVALID_MIGRATION_RUN_ID';
    throw error;
  }
  return id;
}

export class LegacyMigrationRunRepository {
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

  async list(projectId = '') {
    await this.ensure();
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const run = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(run.projectId) !== String(projectId)) continue;
      items.push(run);
    }
    return items.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
  }

  async findByClientRequest(projectId, clientRequestId) {
    if (!clientRequestId) return null;
    return (await this.list(projectId)).find((item) =>
      item.clientRequestId === clientRequestId
    ) || null;
  }
}
