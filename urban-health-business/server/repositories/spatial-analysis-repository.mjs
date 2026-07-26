import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeId(value) {
  const id = String(value || '');
  if (!/^SPRUN-[A-Za-z0-9_.-]{8,140}$/.test(id)) {
    const error = new Error('空间分析编号无效。');
    error.status = 400;
    error.code = 'INVALID_SPATIAL_ANALYSIS_ID';
    throw error;
  }
  return id;
}

export class SpatialAnalysisRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(run) {
    await this.ensure();
    const id = safeId(run.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(run), 'utf8');
    await rename(temporary, target);
    return run;
  }

  async list(projectId = '') {
    await this.ensure();
    const names = await readdir(this.root);
    const runs = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const run = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(run.projectId) !== String(projectId)) continue;
      runs.push(run);
    }
    return runs.sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
  }
}
