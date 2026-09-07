import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeJobId(value) {
  const id = String(value || '');
  if (!/^AJOB-[A-Za-z0-9_.-]{8,120}$/.test(id)) {
    const error = new Error('AI任务编号无效。');
    error.status = 400;
    error.code = 'INVALID_ANALYSIS_JOB_ID';
    throw error;
  }
  return id;
}

export class AnalysisJobRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async get(jobId) {
    await this.ensure();
    const id = safeJobId(jobId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async put(job) {
    await this.ensure();
    const id = safeJobId(job.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(job), 'utf8');
    await rename(temporary, target);
    return job;
  }

  async list(projectId = '') {
    await this.ensure();
    const names = await readdir(this.root);
    const jobs = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const job = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(job.projectId) !== String(projectId)) continue;
      jobs.push(job);
    }
    return jobs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  async findByClientRequest(projectId, clientRequestId) {
    if (!clientRequestId) return null;
    return (await this.list(projectId)).find((job) =>
      job.clientRequestId === clientRequestId && job.status !== 'canceled'
    ) || null;
  }
}
