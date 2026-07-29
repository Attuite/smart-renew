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
