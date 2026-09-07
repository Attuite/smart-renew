import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safeAssetId(value) {
  const id = String(value || '');
  if (!/^ASSET-[A-Za-z0-9_.-]{8,160}$/.test(id)) {
    const error = new Error('资料资产编号无效。');
    error.status = 400;
    error.code = 'INVALID_SOURCE_ASSET_ID';
    throw error;
  }
  return id;
}

export class SourceAssetRepository {
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

  async get(assetId) {
    await this.ensure();
    const id = safeAssetId(assetId);
    try {
      return JSON.parse(await readFile(path.join(this.metadataRoot, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async put(asset) {
    await this.ensure();
    const id = safeAssetId(asset.id);
    const target = path.join(this.metadataRoot, `${id}.json`);
    const temporary = path.join(this.metadataRoot, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(asset), 'utf8');
    await rename(temporary, target);
    return asset;
  }

  async list(projectId = '', includeInactive = false) {
    await this.ensure();
    const names = await readdir(this.metadataRoot);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const asset = JSON.parse(await readFile(path.join(this.metadataRoot, name), 'utf8'));
      if (projectId && String(asset.projectId) !== String(projectId)) continue;
      if (!includeInactive && asset.status === 'inactive') continue;
      items.push(asset);
    }
    return items.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  }

  async findByClientRequest(projectId, clientRequestId) {
    if (!clientRequestId) return null;
    const items = await this.list(projectId, true);
    return items.find((item) => item.clientRequestId === clientRequestId) || null;
  }

  async writeContent(assetId, content) {
    await this.ensure();
    const id = safeAssetId(assetId);
    const target = path.join(this.contentRoot, `${id}.bin`);
    const temporary = path.join(this.contentRoot, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, content);
    await rename(temporary, target);
    return target;
  }

  async readContent(assetId) {
    await this.ensure();
    const id = safeAssetId(assetId);
    try {
      return await readFile(path.join(this.contentRoot, `${id}.bin`));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
}
