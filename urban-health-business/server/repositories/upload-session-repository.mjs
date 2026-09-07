import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeSessionId(value) {
  const id = String(value || '');
  if (!/^UPL-[A-Za-z0-9_.-]{8,120}$/.test(id)) {
    const error = new Error('上传会话编号无效。');
    error.status = 400;
    error.code = 'INVALID_UPLOAD_SESSION_ID';
    throw error;
  }
  return id;
}

export class UploadSessionRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async get(sessionId) {
    await this.ensure();
    const id = safeSessionId(sessionId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async put(session) {
    await this.ensure();
    const id = safeSessionId(session.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(session), 'utf8');
    await rename(temporary, target);
    return session;
  }

  async list(projectId = '') {
    await this.ensure();
    const names = await readdir(this.root);
    const sessions = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const session = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(session.projectId) !== String(projectId)) continue;
      sessions.push(session);
    }
    return sessions.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }

  async findByClientRequest(projectId, clientRequestId) {
    if (!clientRequestId) return null;
    return (await this.list(projectId)).find((session) =>
      session.clientRequestId === clientRequestId && session.status !== 'canceled'
    ) || null;
  }
}
