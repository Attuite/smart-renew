import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function safePhotoId(value) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,159}$/.test(id)) {
    const error = new Error('照片编号无效。');
    error.status = 400;
    error.code = 'INVALID_PHOTO_ID';
    throw error;
  }
  return id;
}

export class PhotoMetadataRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async get(photoId) {
    await this.ensure();
    const id = safePhotoId(photoId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async put(metadata) {
    await this.ensure();
    const id = safePhotoId(metadata.photoId);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(metadata), 'utf8');
    await rename(temporary, target);
    return metadata;
  }

  async list(projectId = '') {
    await this.ensure();
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const metadata = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(metadata.projectId) !== String(projectId)) continue;
      items.push(metadata);
    }
    return items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }
}
