import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeId(value) {
  const id = String(value || '');
  if (!/^MAPSNAP-[A-Za-z0-9_.-]{8,140}$/.test(id)) {
    const error = new Error('地图快照编号无效。');
    error.status = 400;
    error.code = 'INVALID_MAP_SNAPSHOT_ID';
    throw error;
  }
  return id;
}

export class MapSnapshotRepository {
  constructor(metadataRoot, contentRoot) {
    this.metadataRoot = metadataRoot;
    this.contentRoot = contentRoot;
  }

  async ensure() {
    await Promise.all([
      mkdir(this.metadataRoot, { recursive: true }),
      mkdir(this.contentRoot, { recursive: true })
    ]);
  }

  async put(snapshot) {
    await this.ensure();
    const id = safeId(snapshot?.id);
    const target = path.join(this.metadataRoot, `${id}.json`);
    const temporary = path.join(this.metadataRoot, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(snapshot), 'utf8');
    await rename(temporary, target);
    return snapshot;
  }

  async get(snapshotId) {
    await this.ensure();
    const id = safeId(snapshotId);
    try {
      return JSON.parse(await readFile(path.join(this.metadataRoot, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async list(projectId = '', reportId = '', options = {}) {
    await this.ensure();
    const names = await readdir(this.metadataRoot);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const snapshot = JSON.parse(await readFile(path.join(this.metadataRoot, name), 'utf8'));
      if (projectId && String(snapshot.projectId) !== String(projectId)) continue;
      if (reportId && String(snapshot.reportId) !== String(reportId)) continue;
      if (options.status && String(snapshot.status) !== String(options.status)) continue;
      items.push(snapshot);
    }
    const offset = Math.max(0, Number(options.offset) || 0);
    const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
    return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(offset, offset + limit);
  }

  async writeContent(snapshotId, content) {
    await this.ensure();
    const id = safeId(snapshotId);
    const target = path.join(this.contentRoot, `${id}.svg`);
    const temporary = path.join(this.contentRoot, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, target);
    return `${id}.svg`;
  }

  async readContent(snapshotId) {
    await this.ensure();
    const id = safeId(snapshotId);
    try {
      return await readFile(path.join(this.contentRoot, `${id}.svg`), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
}

export class ProviderMapSnapshotRepository {
  constructor(recordProvider, storageProvider, options = {}) {
    this.records = recordProvider;
    this.storage = storageProvider;
    this.entity = options.entity || 'mapSnapshots';
    this.prefix = String(options.prefix || 'map-snapshots/')
      .replace(/^\/+/, '')
      .replace(/\/?$/, '/');
  }

  async put(snapshot) {
    safeId(snapshot?.id);
    return this.records.put(this.entity, snapshot);
  }

  async get(snapshotId) {
    return this.records.get(this.entity, safeId(snapshotId));
  }

  async list(projectId = '', reportId = '', options = {}) {
    const query = {
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(reportId ? { reportId: String(reportId) } : {}),
      ...(options.status ? { status: String(options.status) } : {})
    };
    const items = await this.records.list(this.entity, query);
    const offset = Math.max(0, Number(options.offset) || 0);
    const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
    return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(offset, offset + limit);
  }

  async writeContent(snapshotId, content) {
    const id = safeId(snapshotId);
    const result = await this.storage.upload({
      path: `${this.prefix}${id}.svg`,
      bytes: Buffer.from(content, 'utf8'),
      contentType: 'image/svg+xml'
    });
    return result.fileId || result.id || result.path;
  }

  async readContent(snapshotId) {
    const snapshot = await this.get(snapshotId);
    if (!snapshot?.objectKey) return null;
    const result = await this.storage.download({
      id: snapshot.objectKey,
      fileId: snapshot.objectKey,
      path: snapshot.objectKey,
      contentType: 'image/svg+xml'
    });
    const bytes = Buffer.isBuffer(result) ? result : result?.bytes;
    return bytes ? Buffer.from(bytes).toString('utf8') : null;
  }
}
