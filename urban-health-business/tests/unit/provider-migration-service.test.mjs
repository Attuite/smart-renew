import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildProviderMigrationPlan,
  executeProviderMigration,
  rollbackProviderMigration
} from '../../server/services/provider-migration-service.mjs';
import { createCloudBaseJsonRepository } from '../../server/repositories/cloudbase-repository-adapter.mjs';

test('CloudBase migration plan is dry-run first, explicit, idempotent-safe and never production verified', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'urban-health-provider-migration-'));
  await mkdir(path.join(root, 'official-issues'));
  await writeFile(path.join(root, 'official-issues', 'ISS-1.json'), JSON.stringify({
    id: 'ISS-1', projectId: 'PRJ-1', status: 'active'
  }));

  const plan = await buildProviderMigrationPlan(root, { clientRequestId: 'MIG-CLIENT-1' }, { dryRun: true, now: '2026-08-09T00:00:00.000Z' });
  const officialIssues = plan.collections.find((item) => item.collection === 'businessOfficialIssues');
  assert.equal(plan.status, 'planned');
  assert.equal(officialIssues.sourceCount, 1);
  assert.equal(plan.productionVerified, false);
  assert.match(plan.safeguards.join('|'), /no-delete-before-explicit-rollback/);

  const records = new Map();
  const savedRuns = [];
  const provider = {
    async put(collection, record) { records.set(`${collection}:${record.id}`, record); },
    async get(collection, id) { return records.get(`${collection}:${id}`) || null; },
    async remove(collection, id) { records.delete(`${collection}:${id}`); }
  };
  const repository = {
    async put(run) { savedRuns.push(run); },
  };
  await assert.rejects(
    () => executeProviderMigration(plan, provider, repository, { confirmed: false }),
    (error) => error.code === 'PROVIDER_MIGRATION_CONFIRMATION_REQUIRED'
  );
  const completed = await executeProviderMigration(plan, provider, repository, { confirmed: true }, {
    now: '2026-08-09T00:01:00.000Z',
    allowInMemoryLease: true
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.migrated.length, 1);
  assert.equal(completed.productionVerified, false);
  assert.equal(records.has('businessOfficialIssues:ISS-1'), true);
  assert.ok(savedRuns.length >= 3);

  const rolledBack = await rollbackProviderMigration(completed, provider, repository, { confirmed: true }, { now: '2026-08-09T00:02:00.000Z' });
  assert.equal(rolledBack.status, 'rolled_back');
  assert.equal(rolledBack.productionVerified, false);
  assert.equal(records.size, 0);
  assert.equal(
    (await rollbackProviderMigration(rolledBack, provider, repository, { confirmed: true })).status,
    'rolled_back'
  );
  assert.equal(
    (await executeProviderMigration(completed, provider, repository, { confirmed: true })).status,
    'completed'
  );
});

test('migration fails safely on an existing target and rollback detects third-party changes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'urban-health-provider-conflict-'));
  await mkdir(path.join(root, 'official-issues'));
  await writeFile(path.join(root, 'official-issues', 'ISS-1.json'), JSON.stringify({
    id: 'ISS-1', projectId: 'PRJ-1', title: '源记录'
  }));
  const plan = await buildProviderMigrationPlan(root, {}, { now: '2026-08-09T00:00:00.000Z' });
  const records = new Map([['businessOfficialIssues:ISS-1', { id: 'ISS-1', projectId: 'PRJ-1', title: '目标已有记录' }]]);
  const provider = {
    async get(collection, id) { return records.get(`${collection}:${id}`) || null; },
    async put(collection, record) { records.set(`${collection}:${record.id}`, record); },
    async remove(collection, id) { records.delete(`${collection}:${id}`); }
  };
  const repository = { async put() {} };
  const conflictRun = await executeProviderMigration(plan, provider, repository, { confirmed: true }, {
    allowInMemoryLease: true
  });
  assert.equal(conflictRun.status, 'failed');
  assert.equal(conflictRun.migrated.length, 0);
  assert.equal(conflictRun.failures[0].code, 'PROVIDER_MIGRATION_TARGET_CONFLICT');
  assert.equal(records.get('businessOfficialIssues:ISS-1').title, '目标已有记录');

  const cleanRoot = await mkdtemp(path.join(os.tmpdir(), 'urban-health-provider-rollback-conflict-'));
  await mkdir(path.join(cleanRoot, 'official-issues'));
  await writeFile(path.join(cleanRoot, 'official-issues', 'ISS-2.json'), JSON.stringify({ id: 'ISS-2', projectId: 'PRJ-1', title: '可回滚记录' }));
  const cleanPlan = await buildProviderMigrationPlan(cleanRoot, {}, { now: '2026-08-09T00:00:00.000Z' });
  const cleanRecords = new Map();
  const cleanProvider = {
    async get(collection, id) { return cleanRecords.get(`${collection}:${id}`) || null; },
    async put(collection, record) { cleanRecords.set(`${collection}:${record.id}`, record); },
    async remove(collection, id) { cleanRecords.delete(`${collection}:${id}`); }
  };
  const cleanRun = await executeProviderMigration(cleanPlan, cleanProvider, repository, { confirmed: true }, {
    allowInMemoryLease: true
  });
  cleanRecords.get('businessOfficialIssues:ISS-2').title = '第三方已修改';
  const rollback = await rollbackProviderMigration(cleanRun, cleanProvider, repository, { confirmed: true });
  assert.equal(rollback.status, 'rollback_conflicted');
  assert.equal(rollback.rollback.conflicted, 1);
  assert.equal(cleanRecords.has('businessOfficialIssues:ISS-2'), true);
});

test('interrupted migration persists a checkpoint and resumes only with explicit recovery', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'urban-health-provider-resume-'));
  await mkdir(path.join(root, 'official-issues'));
  await writeFile(path.join(root, 'official-issues', 'ISS-1.json'), JSON.stringify({ id: 'ISS-1', projectId: 'PRJ-1' }));
  await writeFile(path.join(root, 'official-issues', 'ISS-2.json'), JSON.stringify({ id: 'ISS-2', projectId: 'PRJ-1' }));
  const plan = await buildProviderMigrationPlan(root, {}, { now: '2020-01-01T00:00:00.000Z' });
  const records = new Map();
  const provider = {
    async get(collection, id) { return records.get(`${collection}:${id}`) || null; },
    async put(collection, record) { records.set(`${collection}:${record.id}`, record); },
    async remove(collection, id) { records.delete(`${collection}:${id}`); }
  };
  const savedRuns = [];
  const repository = { async put(run) { savedRuns.push(structuredClone(run)); } };
  await assert.rejects(
    () => executeProviderMigration(plan, provider, repository, { confirmed: true }, {
      abortAfterRecords: 1,
      now: '2020-01-01T00:00:01.000Z',
      allowInMemoryLease: true
    }),
    (error) => error.code === 'PROVIDER_MIGRATION_INTERRUPTED'
  );
  const interrupted = savedRuns.at(-1);
  assert.equal(interrupted.status, 'running');
  assert.equal(interrupted.checkpoint.processedCount, 1);
  await assert.rejects(
    () => executeProviderMigration(interrupted, provider, repository, { confirmed: true }),
    (error) => error.code === 'PROVIDER_MIGRATION_IN_PROGRESS'
  );
  const resumed = await executeProviderMigration(
    interrupted,
    provider,
    repository,
    { confirmed: true, recover: true },
    { leaseMs: 1000, now: '2020-01-01T00:01:00.000Z', allowInMemoryLease: true }
  );
  assert.equal(resumed.status, 'completed');
  assert.equal(resumed.migrated.length, 2);
  assert.equal(records.size, 2);
});

test('migration execution requires and persists the repository lease token', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'urban-health-provider-persistent-lease-'));
  await mkdir(path.join(root, 'official-issues'));
  await writeFile(path.join(root, 'official-issues', 'ISS-LEASE.json'), JSON.stringify({
    id: 'ISS-LEASE', projectId: 'PRJ-1'
  }));
  const plan = await buildProviderMigrationPlan(root, {}, { now: '2026-08-10T00:00:00.000Z' });
  const records = new Map();
  const provider = {
    async get(collection, id) { return records.get(`${collection}:${id}`) || null; },
    async put(collection, record) { records.set(`${collection}:${record.id}`, structuredClone(record)); return record; },
    async remove(collection, id) { records.delete(`${collection}:${id}`); },
    async atomicMutate(collection, id, mutate) {
      const key = `${collection}:${id}`;
      const decision = await mutate(records.get(key) || null);
      if (decision?.record) records.set(key, structuredClone(decision.record));
      return decision?.result || null;
    }
  };
  const repository = createCloudBaseJsonRepository(provider, 'businessProviderMigrationRuns');
  await repository.put(plan);
  const completed = await executeProviderMigration(plan, provider, repository, { confirmed: true }, {
    now: '2026-08-10T00:01:00.000Z'
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.migrationLease.releasedAt, '2026-08-10T00:01:00.000Z');
  assert.equal(records.get('businessOfficialIssues:ISS-LEASE').migrationRunId, plan.id);
  assert.equal((await repository.get(plan.id)).status, 'completed');
});
