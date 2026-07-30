import { createHash, createHmac } from 'node:crypto';

function storageError(message, code = 'S3_STORAGE_ERROR', status = 500, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

function encodedPath(value) {
  return String(value || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function signingKey(secret, date, region) {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

function normalizedEndpoint(value) {
  const endpoint = new URL(String(value || ''));
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw storageError('对象存储Endpoint必须使用HTTP或HTTPS。', 'S3_ENDPOINT_INVALID', 400);
  }
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, '');
  return endpoint;
}

export class S3StorageProvider {
  constructor(config, options = {}) {
    this.endpoint = normalizedEndpoint(config?.endpoint);
    this.region = String(config?.region || '').trim();
    this.bucket = String(config?.bucket || '').trim();
    this.accessKeyId = String(config?.accessKeyId || '').trim();
    this.secretAccessKey = String(config?.secretAccessKey || '').trim();
    this.forcePathStyle = config?.forcePathStyle !== false;
    this.fetch = options.fetchImpl || fetch;
    this.now = options.now || (() => new Date());
    this.kind = 's3-compatible-storage';
    if (!this.region || !this.bucket || !this.accessKeyId || !this.secretAccessKey) {
      throw storageError('对象存储缺少region、bucket或访问凭据。', 'S3_CONFIG_REQUIRED', 503);
    }
  }

  objectUrl(objectKey) {
    const key = encodedPath(objectKey);
    const url = new URL(this.endpoint);
    if (this.forcePathStyle) {
      url.pathname = `${url.pathname}/${encodeURIComponent(this.bucket)}/${key}`.replace(/\/+/g, '/');
    } else {
      url.hostname = `${this.bucket}.${url.hostname}`;
      url.pathname = `${url.pathname}/${key}`.replace(/\/+/g, '/');
    }
    return url;
  }

  signedRequest(method, objectKey, bytes = Buffer.alloc(0), contentType = 'application/octet-stream') {
    const url = this.objectUrl(objectKey);
    const now = this.now();
    const dateTime = amzDate(now);
    const date = dateTime.slice(0, 8);
    const payloadHash = sha256(bytes);
    const canonicalHeaders = [
      `content-type:${contentType}`,
      `host:${url.host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${dateTime}`
    ].join('\n') + '\n';
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    const scope = `${date}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateTime,
      scope,
      sha256(canonicalRequest)
    ].join('\n');
    const signature = hmac(signingKey(this.secretAccessKey, date, this.region), stringToSign, 'hex');
    return {
      url,
      headers: {
        authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'content-type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': dateTime
      }
    };
  }

  async request(method, reference, bytes = Buffer.alloc(0), contentType = 'application/octet-stream') {
    const objectKey = reference.path || reference.id || reference.fileId;
    if (!objectKey) throw storageError('对象存储引用缺少对象Key。', 'S3_OBJECT_KEY_REQUIRED', 400);
    const signed = this.signedRequest(method, objectKey, bytes, contentType);
    const response = await this.fetch(signed.url, {
      method,
      headers: signed.headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : bytes
    });
    if (!response.ok) {
      throw storageError(
        `对象存储请求失败（HTTP ${response.status}）。`,
        response.status === 404 ? 'S3_OBJECT_NOT_FOUND' : 'S3_REQUEST_FAILED',
        response.status === 404 ? 404 : 502,
        { httpStatus: response.status, retryable: response.status >= 500 || response.status === 429 }
      );
    }
    return response;
  }

  async upload(input) {
    const bytes = Buffer.from(input.bytes || []);
    const objectKey = String(input.path || '').replace(/^\/+/, '');
    await this.request('PUT', { path: objectKey }, bytes, input.contentType || 'application/octet-stream');
    return {
      id: objectKey,
      path: objectKey,
      fileId: objectKey,
      storage: this.kind,
      size: bytes.length,
      sha256: sha256(bytes)
    };
  }

  async download(reference) {
    const response = await this.request(
      'GET',
      reference,
      Buffer.alloc(0),
      reference.contentType || 'application/octet-stream'
    );
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || reference.contentType || 'application/octet-stream'
    };
  }

  async temporaryUrl(reference) {
    // Private snapshots are served through the authenticated BFF content endpoint.
    // This method intentionally does not expose a long-lived public bucket URL.
    const id = String(reference.snapshotId || reference.id || '').replace(/\.svg$/, '');
    return `/api/map-snapshots/${encodeURIComponent(id)}/content`;
  }
}

export function s3StorageCapability(env = process.env) {
  const configured = Boolean(
    env.S3_ENDPOINT
    && env.S3_REGION
    && env.S3_BUCKET
    && env.S3_ACCESS_KEY_ID
    && env.S3_SECRET_ACCESS_KEY
  );
  return {
    selected: String(env.GIS_MAP_SNAPSHOT_PROVIDER || 'filesystem').toLowerCase() === 's3',
    kind: 's3-compatible-storage',
    configured,
    bucket: configured ? String(env.S3_BUCKET) : null,
    region: configured ? String(env.S3_REGION) : null,
    credentialsExposed: false,
    productionVerified: false
  };
}

export function createS3StorageProvider(env = process.env, options = {}) {
  return new S3StorageProvider({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: String(env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false'
  }, options);
}
