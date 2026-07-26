import { randomUUID } from 'node:crypto';

function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function migrationError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function auditLegacyMigration(adapter, repository, projectId) {
  const [upstream, runs] = await Promise.all([
    adapter.audit(projectId),
    repository.list(projectId)
  ]);
  return {
    projectId: String(projectId),
    upstream,
    runs,
    source: 'smart-renew',
    executionAudit: 'business'
  };
}

export async function applyLegacyMigration(adapter, repository, projectId, input, options = {}) {
  const clientRequestId = clean(input?.clientRequestId, 160);
  const executedBy = clean(input?.executedBy || input?.reviewerName, 120);
  if (!clientRequestId) {
    throw migrationError('请提供迁移请求编号。', 400, 'MIGRATION_CLIENT_REQUEST_ID_REQUIRED');
  }
  if (!executedBy) {
    throw migrationError('请记录迁移执行人员。', 400, 'MIGRATION_EXECUTOR_REQUIRED');
  }
  if (input?.confirmed !== true) {
    throw migrationError('旧数据迁移必须显式确认。', 400, 'LEGACY_MIGRATION_CONFIRMATION_REQUIRED');
  }
  const existing = await repository.findByClientRequest(String(projectId), clientRequestId);
  if (existing) return { item: existing, duplicated: true };

  const startedAt = options.now || new Date().toISOString();
  const base = {
    id: options.id || `MIGRUN-${randomUUID()}`,
    projectId: String(projectId),
    clientRequestId,
    executedBy,
    status: 'running',
    source: 'smart-renew',
    startedAt,
    completedAt: null,
    result: null,
    error: null,
    schemaVersion: '1.0.0'
  };
  await repository.put(base);
  try {
    const result = await adapter.apply(projectId, {
      confirmed: true,
      reviewerName: executedBy
    });
    const completed = {
      ...base,
      status: 'completed',
      completedAt: options.completedAt || new Date().toISOString(),
      result
    };
    await repository.put(completed);
    return { item: completed, duplicated: false };
  } catch (error) {
    const failed = {
      ...base,
      status: 'failed',
      completedAt: options.completedAt || new Date().toISOString(),
      error: {
        code: error.code || 'LEGACY_MIGRATION_FAILED',
        message: error.message
      }
    };
    await repository.put(failed);
    throw error;
  }
}
