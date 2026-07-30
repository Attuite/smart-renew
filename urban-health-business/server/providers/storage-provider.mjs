import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function providerError(message, code = 'PROVIDER_CONTRACT_INVALID') {
  const error = new Error(message);
  error.code = code;
  error.status = 500;
  return error;
}

export function assertStorageProvider(provider) {
  for (const method of ['upload', 'download', 'temporaryUrl']) {
    if (typeof provider?.[method] !== 'function') {
      throw providerError(`StorageProvider缺少${method}方法。`);
    }
  }
  return provider;
}

function safeObjectPath(root, objectPath) {
  const normalized = String(objectPath || '').replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('../') || normalized.includes('/..')) {
    throw providerError('对象存储路径无效。', 'OBJECT_PATH_INVALID');
  }
  const target = path.resolve(root, normalized);
  const resolvedRoot = path.resolve(root);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw providerError('对象存储路径超出根目录。', 'OBJECT_PATH_OUTSIDE_ROOT');
  }
  return target;
}

export class FilesystemObjectStorageProvider {
  constructor(root) {
    this.root = path.resolve(root);
    this.kind = 'filesystem-object-storage';
  }

  async upload(input) {
    const target = safeObjectPath(this.root, input.path);
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${Date.now()}.tmp`;
    const bytes = Buffer.from(input.bytes || []);
    await writeFile(temporary, bytes);
    await rename(temporary, target);
    return {
      id: String(input.path),
      path: String(input.path),
      fileId: String(input.path),
      storage: this.kind,
      size: bytes.length
    };
  }

  async download(reference) {
    const objectPath = reference.path || reference.fileId || reference.id;
    return {
      bytes: await readFile(safeObjectPath(this.root, objectPath)),
      contentType: reference.contentType || 'application/octet-stream'
    };
  }

  async temporaryUrl(reference) {
    const id = String(reference.snapshotId || reference.id || '').replace(/\.svg$/, '');
    return `/api/map-snapshots/${encodeURIComponent(id)}/content`;
  }
}

export class SmartRenewStorageProvider {
  constructor(client, options = {}) {
    this.client = client;
    this.basePath = options.basePath || '/api/photos';
    this.kind = 'smart-renew-local';
  }

  async upload(input) {
    const payload = await this.client.uploadPhoto(input);
    const item = payload?.item || payload;
    return {
      id: String(item.id),
      path: item.cloudPath || null,
      storage: item.storage || 'server-filesystem',
      item
    };
  }

  async download(reference) {
    return this.client.getPhotoContent(reference.id);
  }

  async temporaryUrl(reference) {
    return `${this.basePath}/${encodeURIComponent(reference.id)}/content`;
  }
}

export class CloudBaseStorageProvider {
  constructor(app) {
    if (!app) throw providerError('CloudBase应用实例未提供。', 'CLOUDBASE_APP_REQUIRED');
    this.app = app;
    this.kind = 'cloudbase-storage';
  }

  async upload(input) {
    const result = await this.app.uploadFile({
      cloudPath: input.path,
      fileContent: input.bytes
    });
    return {
      id: result.fileID || input.path,
      path: input.path,
      storage: this.kind,
      fileId: result.fileID || null
    };
  }

  async download(reference) {
    const result = await this.app.downloadFile({
      fileID: reference.fileId || reference.id || reference.path
    });
    return {
      bytes: Buffer.from(result.fileContent),
      contentType: reference.contentType || 'application/octet-stream'
    };
  }

  async temporaryUrl(reference) {
    const fileID = reference.fileId || reference.id || reference.path;
    const result = await this.app.getTempFileURL({ fileList: [fileID] });
    const item = result.fileList?.[0];
    if (!item?.tempFileURL) {
      throw providerError('CloudBase未返回临时下载地址。', 'CLOUDBASE_TEMP_URL_UNAVAILABLE');
    }
    return item.tempFileURL;
  }
}
