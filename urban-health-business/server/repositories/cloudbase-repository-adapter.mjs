import { randomUUID } from 'node:crypto';
import { AiConfigurationRepository } from './ai-configuration-repository.mjs';

function sorted(items, field = 'updatedAt') {
  return [...items].sort((a, b) => String(b?.[field] || b?.createdAt || '').localeCompare(String(a?.[field] || a?.createdAt || '')));
}

function queryForProject(projectId, extra = {}) {
  return {
    ...(projectId ? { projectId: String(projectId) } : {}),
    ...extra
  };
}

export function createCloudBaseJsonRepository(provider, entity, options = {}) {
  const sortField = options.sortField || 'updatedAt';
  const adapter = {
    kind: 'cloudbase-business-repository',
    entity,
    async ensure() {},
    async get(id) {
      return provider.get(entity, String(id));
    },
    async put(record) {
      return provider.put(entity, record);
    },
    async acquireMigrationLease(id, input = {}) {
      if (typeof provider.atomicMutate !== 'function') {
        return { acquired: false, reason: 'atomic_mutation_unavailable' };
      }
      const now = String(input.now || new Date().toISOString());
      const nowMs = Date.parse(now);
      return provider.atomicMutate(entity, String(id), async (current) => {
        if (!current) return { result: { acquired: false, reason: 'not_found' } };
        if (!['planned', 'ready', 'failed', 'running'].includes(current.status)) {
          return { result: { acquired: false, reason: 'state_invalid', run: current } };
        }
        const expiresAt = Date.parse(current.migrationLease?.expiresAt || '');
        const active = current.status === 'running'
          && Number.isFinite(expiresAt)
          && expiresAt > nowMs;
        if (active) return { result: { acquired: false, reason: 'active_lease', run: current } };
        if (current.status === 'running' && input.recover !== true) {
          return { result: { acquired: false, reason: 'recovery_required', run: current } };
        }
        const updated = {
          ...current,
          status: 'running',
          lastHeartbeatAt: now,
          migrationLease: {
            token: String(input.token),
            owner: String(input.owner),
            acquiredAt: now,
            heartbeatAt: now,
            expiresAt: String(input.expiresAt),
            version: Math.max(0, Number(current.migrationLease?.version) || 0) + 1
          }
        };
        return { record: updated, result: { acquired: true, run: updated } };
      });
    },
    async saveMigrationRunWithLease(run, input = {}) {
      if (typeof provider.atomicMutate !== 'function') {
        return { saved: false, reason: 'atomic_mutation_unavailable' };
      }
      const now = String(input.now || new Date().toISOString());
      return provider.atomicMutate(entity, String(run.id), async (current) => {
        if (!current) return { result: { saved: false, reason: 'not_found' } };
        if (!current.migrationLease || current.migrationLease.token !== String(input.token)) {
          return { result: { saved: false, reason: 'lease_lost', run: current } };
        }
        const migrationLease = {
          ...current.migrationLease,
          heartbeatAt: now,
          expiresAt: input.release === true ? now : String(input.expiresAt)
        };
        if (input.release === true) migrationLease.releasedAt = now;
        const updated = {
          ...run,
          lastHeartbeatAt: now,
          migrationLease
        };
        return { record: updated, result: { saved: true, run: updated } };
      });
    },
    async list(projectId = '', second = '', third = {}) {
      const listOptions = typeof second === 'object' && second !== null ? second : third;
      const rawQuery = typeof projectId === 'object'
        ? projectId
        : options.query
          ? options.query(projectId, second, third)
          : (typeof second === 'object' ? second : {});
      const query = { ...rawQuery };
      delete query.includeInactive;
      delete query.offset;
      delete query.limit;
      const scopedQuery = typeof projectId === 'object' ? query : queryForProject(projectId, query);
      let items = await provider.list(entity, scopedQuery);
      if (typeof options.filter === 'function') items = items.filter(options.filter);
      const includeInactive = second === true || listOptions?.includeInactive === true;
      if (options.excludeInactive && !includeInactive) {
        items = items.filter((item) => item.status !== 'inactive');
      }
      if (typeof second === 'object' && !Array.isArray(second)) {
        const offset = Math.max(0, Number(second.offset) || 0);
        const limit = Math.max(1, Math.min(10000, Number(second.limit) || 10000));
        items = sorted(items, sortField).slice(offset, offset + limit);
      } else {
        items = sorted(items, sortField);
      }
      return items;
    },
    async findByClientRequest(projectId, clientRequestId) {
      if (!clientRequestId) return null;
      const items = await adapter.list(projectId, { includeInactive: true });
      return items.find((item) => item.clientRequestId === clientRequestId && item.status !== 'canceled') || null;
    },
    async putMany(records) {
      for (const record of records) await adapter.put(record);
      return records;
    },
    async writeContent(id, content) {
      if (!options.storage) throw new Error('CloudBase业务仓储未配置对象存储。');
      const result = await options.storage.upload({
        path: `${entity}/${String(id)}.bin`,
        bytes: Buffer.from(content),
        contentType: options.contentType || 'application/octet-stream'
      });
      return result.fileId || result.id || result.path;
    },
    async readContent(id) {
      if (!options.storage) return null;
      const reference = {
        id: `${entity}/${String(id)}.bin`,
        path: `${entity}/${String(id)}.bin`,
        fileId: `${entity}/${String(id)}.bin`,
        contentType: options.contentType || 'application/octet-stream'
      };
      try {
        const result = await options.storage.download(reference);
        return Buffer.isBuffer(result) ? result : result?.bytes || null;
      } catch (error) {
        if (['ENOENT', 'STORAGE_NOT_FOUND', 'CLOUDBASE_FILE_NOT_FOUND'].includes(error.code)) return null;
        throw error;
      }
    },
    async create(validation, validatedBy) {
      const now = validation.computedAt || new Date().toISOString();
      return adapter.put({
        ...validation,
        id: `COLVAL-${validation.projectId}-${Date.now()}-${randomUUID().slice(0, 8)}`,
        validatedBy: String(validatedBy || '').trim().slice(0, 120),
        createdAt: now,
        schemaVersion: '1.0.0'
      });
    }
  };
  return adapter;
}

export class CloudBaseAiConfigurationRepository extends AiConfigurationRepository {
  constructor(provider, root, entity = 'businessAiConfigurations') {
    super(root);
    this.provider = provider;
    this.entity = entity;
  }

  async get(userId) {
    const record = await this.provider.get(this.entity, String(userId));
    if (record?.id === String(userId)) delete record.id;
    return record;
  }

  async put(record) {
    return this.provider.put(this.entity, { ...record, id: String(record.userId) });
  }

  async list() {
    return this.provider.list(this.entity, {});
  }
}
