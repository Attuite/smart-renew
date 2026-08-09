import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { BUSINESS_PROVIDER_COLLECTION_SPECS, BUSINESS_PROVIDER_SCHEMA_VERSION } from '../providers/cloudbase-provider.mjs';

const SOURCE_DIRS = Object.freeze({
  businessOfficialIssues: 'official-issues',
  businessReports: 'reports',
  businessReviewSessions: 'review-sessions',
  businessAnalysisJobs: 'analysis-jobs',
  businessAnalysisCandidates: 'analysis-candidates',
  businessSpatialAnalyses: 'spatial-analyses',
  businessUploadSessions: 'upload-sessions',
  businessPhotoMetadata: 'photo-metadata',
  businessBoundaryRevisions: 'boundary-revisions',
  businessCollectionValidations: 'collection-validations',
  businessSourceAssets: 'source-assets',
  businessSourceAssetImports: 'source-asset-imports',
  businessFieldTaskReferences: 'field-task-references',
  businessMigrationRuns: 'legacy-migration-runs',
  businessResidentialDiscoveryRuns: 'residential-discovery-runs',
  businessAiConfigurations: 'ai-configurations',
  businessCoordinateTransforms: 'coordinate-transforms',
  businessSurveyRoutes: 'survey-routes',
  businessSurveyStops: 'survey-stops',
  businessPhotoRouteBindings: 'photo-route-bindings'
});

function migrationError(message, status = 400, code = 'PROVIDER_MIGRATION_INVALID') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function recordHash(record) {
  return createHash('sha256').update(canonical(record)).digest('hex');
}

function recordId(collection, record) {
  return String(collection === 'businessAiConfigurations' && !record.id
    ? record.userId
    : record.id || '');
}

function migratedKey(collection, id) {
  return `${collection}:${String(id)}`;
}

function nowIso(options = {}) {
  return options.now || new Date().toISOString();
}

function addUniqueMigrationItem(run, item) {
  const key = migratedKey(item.collection, item.id);
  const index = run.migrated.findIndex((current) => migratedKey(current.collection, current.id) === key);
  if (index >= 0) run.migrated[index] = item;
  else run.migrated.push(item);
}

function migrationLeaseDuration(options = {}) {
  return Math.max(1000, Number(options.leaseMs) || 120000);
}

function leaseExpiry(options = {}) {
  return new Date(Date.parse(nowIso(options)) + migrationLeaseDuration(options)).toISOString();
}

async function acquireMigrationLease(plan, repository, input = {}, options = {}) {
  const token = randomUUID();
  const owner = String(input.leaseOwner || process.env.HOSTNAME || `pid-${process.pid}`).slice(0, 160);
  if (typeof repository.acquireMigrationLease !== 'function') {
    if (options.allowInMemoryLease === true) return { persistent: false, token, owner, run: plan };
    throw migrationError(
      '迁移运行仓储不支持原子租约，已拒绝执行以避免多实例并发。',
      503,
      'PROVIDER_MIGRATION_LEASE_UNSUPPORTED'
    );
  }
  const acquired = await repository.acquireMigrationLease(plan.id, {
    token,
    owner,
    now: nowIso(options),
    expiresAt: leaseExpiry(options),
    recover: input.recover === true
  });
  if (!acquired?.acquired) {
    const code = acquired?.reason === 'state_invalid'
      ? 'PROVIDER_MIGRATION_STATE_INVALID'
      : acquired?.reason === 'not_found'
        ? 'PROVIDER_MIGRATION_NOT_FOUND'
        : acquired?.reason === 'atomic_mutation_unavailable'
          ? 'PROVIDER_MIGRATION_LEASE_UNSUPPORTED'
          : 'PROVIDER_MIGRATION_IN_PROGRESS';
    throw migrationError(
      code === 'PROVIDER_MIGRATION_IN_PROGRESS'
        ? '迁移运行已由其他实例持有，或需要管理员明确恢复。'
        : '无法原子获取迁移运行租约。',
      code === 'PROVIDER_MIGRATION_NOT_FOUND' ? 404 : code === 'PROVIDER_MIGRATION_LEASE_UNSUPPORTED' ? 503 : 409,
      code
    );
  }
  return { persistent: true, token, owner, run: acquired.run };
}

async function saveLeasedRun(run, repository, lease, options = {}, release = false) {
  if (!lease.persistent) return repository.put(run);
  const saved = await repository.saveMigrationRunWithLease(run, {
    token: lease.token,
    now: nowIso(options),
    expiresAt: leaseExpiry(options),
    release
  });
  if (!saved?.saved) {
    throw migrationError(
      '迁移运行租约已丢失，当前执行者已停止写入检查点。',
      409,
      'PROVIDER_MIGRATION_LEASE_LOST'
    );
  }
  Object.assign(run, saved.run);
  return run;
}

async function persistCheckpoint(run, repository, lease, collection, index, processedCount, options = {}) {
  run.checkpoint = {
    collection,
    index,
    processedCount,
    migratedCount: run.migrated.length,
    failureCount: run.failures.length
  };
  run.lastHeartbeatAt = nowIso(options);
  await saveLeasedRun(run, repository, lease, options);
}

async function readJsonRecords(directory) {
  try {
    const names = await readdir(directory);
    const records = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      records.push(JSON.parse(await readFile(path.join(directory, name), 'utf8')));
    }
    return records;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function buildProviderMigrationPlan(sourceRoot, input = {}, options = {}) {
  const root = path.resolve(sourceRoot);
  const collections = [];
  for (const spec of BUSINESS_PROVIDER_COLLECTION_SPECS) {
    const directoryName = SOURCE_DIRS[spec.collection];
    const records = directoryName ? await readJsonRecords(path.join(root, directoryName)) : [];
    collections.push({
      ...spec,
      sourceDirectory: directoryName ? path.join(root, directoryName) : null,
      sourceCount: records.length,
      targetCount: records.length,
      binaryMigration: ['businessSourceAssets', 'businessMapSnapshots'].includes(spec.collection)
        ? 'reference-only-until-explicit-storage-migration'
        : 'not-applicable'
    });
  }
  return {
    id: input.id || `MIGRUN-${Date.now()}-${randomUUID().slice(0, 8)}`,
    clientRequestId: String(input.clientRequestId || '').trim() || null,
    sourceProvider: input.sourceProvider || 'local',
    targetProvider: input.targetProvider || 'cloudbase',
    sourceRoot: root,
    schemaVersion: BUSINESS_PROVIDER_SCHEMA_VERSION,
    productionVerified: false,
    status: options.dryRun === false ? 'ready' : 'planned',
    createdAt: options.now || new Date().toISOString(),
    collections,
    safeguards: [
      'no-automatic-collection-rebuild',
      'no-delete-before-explicit-rollback',
      'binary-references-require-storage-audit',
      'productionVerified-remains-false'
    ]
  };
}

export async function executeProviderMigration(plan, provider, repository, input = {}, options = {}) {
  if (!plan || plan.targetProvider !== 'cloudbase') {
    throw migrationError('当前只支持把本地业务数据迁移到CloudBase。', 400, 'PROVIDER_MIGRATION_TARGET_INVALID');
  }
  if (plan.status === 'completed') return plan;
  if (plan.status === 'running') {
    const heartbeatAt = Date.parse(plan.lastHeartbeatAt || plan.executedAt || '');
    const leaseMs = Math.max(1000, Number(options.leaseMs) || 120000);
    const stale = !Number.isFinite(heartbeatAt) || Date.now() - heartbeatAt > leaseMs;
    if (!input.recover || !stale) {
      throw migrationError('迁移正在执行中，请等待当前运行结束或由管理员接管过期运行。', 409, 'PROVIDER_MIGRATION_IN_PROGRESS');
    }
  }
  if (plan.status === 'rolled_back') {
    throw migrationError('已回滚的迁移不能直接重复执行，请重新生成迁移计划。', 409, 'PROVIDER_MIGRATION_ALREADY_ROLLED_BACK');
  }
  if (input.confirmed !== true) {
    throw migrationError('执行迁移必须显式确认，未确认时只允许演练。', 409, 'PROVIDER_MIGRATION_CONFIRMATION_REQUIRED');
  }
  const activeRunKey = String(plan.id);
  if (!globalThis.__urbanHealthProviderMigrationRuns) globalThis.__urbanHealthProviderMigrationRuns = new Set();
  const activeRuns = globalThis.__urbanHealthProviderMigrationRuns;
  if (activeRuns.has(activeRunKey)) {
    throw migrationError('迁移正在执行中，请等待当前运行结束。', 409, 'PROVIDER_MIGRATION_IN_PROGRESS');
  }
  activeRuns.add(activeRunKey);
  let lease = null;
  let run = null;
  let processedCount = 0;
  try {
    lease = await acquireMigrationLease(plan, repository, input, options);
    const leasedPlan = lease.run;
    run = {
      ...leasedPlan,
      status: 'running',
      executedAt: leasedPlan.executedAt || nowIso(options),
      recoveredAt: plan.status === 'running' ? nowIso(options) : leasedPlan.recoveredAt || null,
      productionVerified: false,
      migrated: Array.isArray(leasedPlan.migrated) ? [...leasedPlan.migrated] : [],
      failures: [],
      previousFailures: Array.isArray(leasedPlan.failures) ? leasedPlan.failures : [],
      checkpoint: leasedPlan.checkpoint || null,
      lastHeartbeatAt: nowIso(options)
    };
    await saveLeasedRun(run, repository, lease, options);
    for (const spec of leasedPlan.collections) {
      const records = spec.sourceDirectory ? await readJsonRecords(spec.sourceDirectory) : [];
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const id = recordId(spec.collection, record);
        const sourceHash = recordHash(record);
        try {
          if (!id) {
            throw migrationError(`迁移记录${spec.collection}缺少id。`, 400, 'PROVIDER_MIGRATION_RECORD_ID_REQUIRED');
          }
          const existing = await provider.get(spec.collection, id);
          const existingKey = migratedKey(spec.collection, id);
          const previous = run.migrated.find((item) => migratedKey(item.collection, item.id) === existingKey);
          if (existing) {
            const sameRun = existing.migrationRunId === run.id
              && existing.migrationSourceHash === sourceHash;
            if (!sameRun) {
              run.failures.push({
                collection: spec.collection,
                id,
                kind: 'conflict',
                code: 'PROVIDER_MIGRATION_TARGET_CONFLICT',
                message: '目标库已有不同来源记录，迁移未覆盖。',
                sourceHash
              });
            } else {
              addUniqueMigrationItem(run, previous || {
                collection: spec.collection,
                id,
                action: 'created',
                sourceHash,
                writtenRecordHash: recordHash(existing)
              });
            }
          } else {
            const migratedRecord = {
              ...(spec.collection === 'businessAiConfigurations' && !record.id
                ? { ...record, id }
                : record),
              migrationRunId: run.id,
              migrationSourceHash: sourceHash
            };
            await provider.put(spec.collection, migratedRecord);
            addUniqueMigrationItem(run, {
              collection: spec.collection,
              id,
              action: 'created',
              sourceHash,
              writtenRecordHash: recordHash(migratedRecord)
            });
          }
        } catch (error) {
          if (error.code === 'PROVIDER_MIGRATION_TARGET_CONFLICT') {
            run.failures.push({ collection: spec.collection, id, kind: 'conflict', code: error.code, message: error.message, sourceHash });
          } else {
            run.failures.push({ collection: spec.collection, id, kind: 'failed', code: error.code || 'WRITE_FAILED', message: error.message, sourceHash });
          }
        }
        processedCount += 1;
        await persistCheckpoint(run, repository, lease, spec.collection, index, processedCount, options);
        if (options.abortAfterRecords && processedCount >= Number(options.abortAfterRecords)) {
          const error = migrationError('迁移在持久化检查点后被中断，等待恢复操作。', 503, 'PROVIDER_MIGRATION_INTERRUPTED');
          run.status = 'running';
          run.interruptedAt = nowIso(options);
          run.interruption = { processedCount, checkpoint: run.checkpoint };
          await saveLeasedRun(run, repository, lease, options, true);
          throw error;
        }
      }
    }
    run.status = run.failures.length ? 'failed' : 'completed';
    run.completedAt = nowIso(options);
    run.lastHeartbeatAt = run.completedAt;
    await saveLeasedRun(run, repository, lease, options, true);
    return run;
  } catch (error) {
    if (error.code === 'PROVIDER_MIGRATION_LEASE_LOST') throw error;
    if (run && error.code !== 'PROVIDER_MIGRATION_INTERRUPTED') {
      run.status = 'failed';
      run.failure = { code: error.code || 'PROVIDER_MIGRATION_FAILED', message: error.message };
      run.lastHeartbeatAt = nowIso(options);
    }
    if (run && error.code !== 'PROVIDER_MIGRATION_INTERRUPTED') {
      await saveLeasedRun(run, repository, lease, options, true);
    }
    throw error;
  } finally {
    activeRuns.delete(activeRunKey);
  }
}

export async function rollbackProviderMigration(run, provider, repository, input = {}, options = {}) {
  if (input.confirmed !== true) {
    throw migrationError('回滚迁移必须显式确认。', 409, 'PROVIDER_ROLLBACK_CONFIRMATION_REQUIRED');
  }
  if (['rolled_back', 'rollback_conflicted', 'rollback_failed'].includes(run?.status)) return run;
  if (!['completed', 'failed'].includes(run?.status)) {
    throw migrationError('只有已完成或失败的迁移可以回滚。', 409, 'PROVIDER_ROLLBACK_STATE_INVALID');
  }
  const result = {
    restored: 0,
    removed: 0,
    skipped: 0,
    conflicted: 0,
    failed: 0,
    items: []
  };
  for (const item of [...(run.migrated || [])].reverse()) {
    try {
      if (item.action !== 'created') {
        result.skipped += 1;
        result.items.push({ ...item, outcome: 'skipped' });
        continue;
      }
      const current = await provider.get(item.collection, item.id);
      if (!current) {
        result.skipped += 1;
        result.items.push({ ...item, outcome: 'skipped', reason: 'already_missing' });
        continue;
      }
      if (current.migrationRunId !== run.id || recordHash(current) !== item.writtenRecordHash) {
        result.conflicted += 1;
        result.items.push({ ...item, outcome: 'conflicted', reason: 'target_changed_after_migration' });
        continue;
      }
      await provider.remove(item.collection, item.id);
      result.removed += 1;
      result.items.push({ ...item, outcome: 'removed' });
    } catch (error) {
      result.failed += 1;
      result.items.push({ ...item, outcome: 'failed', code: error.code || 'ROLLBACK_FAILED', message: error.message });
    }
  }
  const updated = {
    ...run,
    status: result.conflicted || result.failed ? 'rollback_conflicted' : 'rolled_back',
    rolledBackAt: nowIso(options),
    productionVerified: false,
    rollback: result
  };
  await repository.put(updated);
  return updated;
}

export async function checkCloudBaseHealth(runtime) {
  if (!runtime?.repositories || !runtime?.storage) {
    return { ready: false, reason: 'cloudbase_runtime_not_initialized', productionVerified: false };
  }
  const probes = [];
  for (const spec of BUSINESS_PROVIDER_COLLECTION_SPECS.slice(0, 5)) {
    try {
      await runtime.repositories.list(spec.collection, { limit: 1 });
      probes.push({ collection: spec.collection, ready: true });
    } catch (error) {
      probes.push({ collection: spec.collection, ready: false, code: error.code || 'PROBE_FAILED', message: error.message });
    }
  }
  const ready = probes.every((item) => item.ready);
  const storage = typeof runtime.storage.probe === 'function'
    ? await runtime.storage.probe()
    : { ready: false, reason: 'cloudbase_storage_probe_not_supported' };
  return {
    ready: ready && storage.ready,
    database: { ready, probes },
    storage,
    probes,
    schemaVersion: BUSINESS_PROVIDER_SCHEMA_VERSION,
    productionVerified: false
  };
}

export { SOURCE_DIRS };
