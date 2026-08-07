import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeCandidateId(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,159}$/.test(id)) {
    const error = new Error('AI候选编号无效。');
    error.status = 400;
    error.code = 'INVALID_ANALYSIS_CANDIDATE_ID';
    throw error;
  }
  return id;
}

export class AnalysisCandidateRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(candidate) {
    await this.ensure();
    const id = safeCandidateId(candidate.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(candidate), 'utf8');
    await rename(temporary, target);
    return candidate;
  }

  async get(candidateId) {
    await this.ensure();
    const id = safeCandidateId(candidateId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async putMany(candidates) {
    for (const candidate of candidates) await this.put(candidate);
    return candidates;
  }

  async list(filters = {}) {
    await this.ensure();
    const names = await readdir(this.root);
    const candidates = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const candidate = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (filters.projectId && String(candidate.projectId) !== String(filters.projectId)) continue;
      if (filters.jobId && String(candidate.jobId) !== String(filters.jobId)) continue;
      if (filters.analysisId && String(candidate.analysisId) !== String(filters.analysisId)) continue;
      candidates.push(candidate);
    }
    return candidates.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  }
}
