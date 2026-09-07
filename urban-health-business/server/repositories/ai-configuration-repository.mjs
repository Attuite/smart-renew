import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function userHash(userId) {
  return createHash('sha256').update(String(userId)).digest('hex');
}

function configError(message, status = 400, code = 'AI_CONFIG_INVALID') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export class AiConfigurationRepository {
  constructor(root) {
    this.root = root;
    this.masterKeyPath = path.join(root, '.master-key');
  }

  async ensureKey() {
    await mkdir(this.root, { recursive: true });
    try {
      const stored = await readFile(this.masterKeyPath, 'utf8');
      return Buffer.from(stored.trim(), 'base64');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const key = randomBytes(32);
      try {
        await writeFile(this.masterKeyPath, key.toString('base64'), { flag: 'wx', mode: 0o600 });
        return key;
      } catch (writeError) {
        if (writeError.code !== 'EEXIST') throw writeError;
        return Buffer.from((await readFile(this.masterKeyPath, 'utf8')).trim(), 'base64');
      }
    }
  }

  file(userId) {
    return path.join(this.root, `${userHash(userId)}.json`);
  }

  async get(userId) {
    await mkdir(this.root, { recursive: true });
    try {
      return JSON.parse(await readFile(this.file(userId), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async put(record) {
    await mkdir(this.root, { recursive: true });
    const target = this.file(record.userId);
    const temporary = `${target}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
    await rename(temporary, target);
    return record;
  }

  async setKey(userId, displayName, apiKey, options = {}) {
    const key = String(apiKey || '').trim().replace(/^DASHSCOPE_API_KEY\s*=\s*/, '');
    if (key.length < 10 || key.length > 512 || /\s/.test(key)) {
      throw configError('API Key 内容无效，请检查是否复制完整或包含空格。', 400, 'AI_KEY_INVALID');
    }
    const existing = await this.get(userId);
    const currentRevision = Math.max(0, Number(existing?.revision) || 0);
    if (options.expectedRevision !== undefined && Number(options.expectedRevision) !== currentRevision) {
      throw configError('AI配置已被其他操作修改，请刷新后重试。', 409, 'AI_CONFIG_REVISION_CONFLICT');
    }
    const masterKey = await this.ensureKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
    const now = options.now || new Date().toISOString();
    const record = {
      ...(existing || {}),
      userId: String(userId),
      displayName: String(displayName || userId).slice(0, 160),
      encryptedKey: {
        algorithm: 'aes-256-gcm',
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64')
      },
      keyLast4: key.slice(-4),
      preferences: existing?.preferences || {
        model: process.env.DASHSCOPE_MODEL || 'qwen3-vl-plus',
        timeoutMs: 120000,
        maxImagesPerBatch: 20
      },
      revision: currentRevision + 1,
      configuredAt: now,
      updatedAt: now,
      audit: [
        ...(existing?.audit || []),
        { action: existing?.encryptedKey ? 'key-replaced' : 'key-created', at: now }
      ],
      schemaVersion: '1.0.0'
    };
    return this.put(record);
  }

  async setPreferences(userId, displayName, preferences, options = {}) {
    const existing = await this.get(userId);
    const currentRevision = Math.max(0, Number(existing?.revision) || 0);
    if (options.expectedRevision !== undefined && Number(options.expectedRevision) !== currentRevision) {
      throw configError('AI配置已被其他操作修改，请刷新后重试。', 409, 'AI_CONFIG_REVISION_CONFLICT');
    }
    const now = options.now || new Date().toISOString();
    const record = {
      ...(existing || {}),
      userId: String(userId),
      displayName: String(displayName || userId).slice(0, 160),
      preferences,
      revision: currentRevision + 1,
      updatedAt: now,
      audit: [...(existing?.audit || []), { action: 'preferences-updated', at: now }],
      schemaVersion: '1.0.0'
    };
    return this.put(record);
  }

  async resolveKey(userId) {
    const record = await this.get(userId);
    if (!record?.encryptedKey) return '';
    const masterKey = await this.ensureKey();
    const encrypted = record.encryptedKey;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      masterKey,
      Buffer.from(encrypted.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
  }

  async list() {
    await mkdir(this.root, { recursive: true });
    const names = await readdir(this.root);
    const records = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      records.push(JSON.parse(await readFile(path.join(this.root, name), 'utf8')));
    }
    return records;
  }
}
