import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyLegacyMigration,
  auditLegacyMigration
} from '../../server/services/legacy-migration-service.mjs';

function memoryRuns() {
  const items = [];
  return {
    items,
    async put(item) {
      const index = items.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push(item);
      return item;
    },
    async list(projectId) {
      return items.filter((item) => item.projectId === String(projectId));
    },
    async findByClientRequest(projectId, clientRequestId) {
      return items.find((item) =>
        item.projectId === String(projectId) && item.clientRequestId === clientRequestId
      ) || null;
    }
  };
}

test('legacy migration is explicit, audited and idempotent by client request', async () => {
  const repository = memoryRuns();
  const adapter = {
    async audit() { return { audit: { embeddedOriginals: 2 }, applied: false }; },
    async apply() { return { applied: true, migratedPhotos: 2 }; }
  };

  await assert.rejects(
    () => applyLegacyMigration(adapter, repository, '1001', {
      clientRequestId: 'migration-001',
      executedBy: '迁移员'
    }),
    (error) => error.code === 'LEGACY_MIGRATION_CONFIRMATION_REQUIRED'
  );

  const first = await applyLegacyMigration(adapter, repository, '1001', {
    clientRequestId: 'migration-001',
    executedBy: '迁移员',
    confirmed: true
  }, {
    id: 'MIGRUN-fixed-migration',
    now: '2026-07-26T00:00:00.000Z',
    completedAt: '2026-07-26T00:00:01.000Z'
  });
  const second = await applyLegacyMigration(adapter, repository, '1001', {
    clientRequestId: 'migration-001',
    executedBy: '迁移员',
    confirmed: true
  });
  assert.equal(first.item.status, 'completed');
  assert.equal(first.item.result.migratedPhotos, 2);
  assert.equal(second.duplicated, true);

  const audit = await auditLegacyMigration(adapter, repository, '1001');
  assert.equal(audit.upstream.audit.embeddedOriginals, 2);
  assert.equal(audit.runs.length, 1);
});

test('failed legacy migration persists a failure audit', async () => {
  const repository = memoryRuns();
  const error = new Error('上游迁移失败');
  error.code = 'UPSTREAM_ERROR';
  await assert.rejects(
    () => applyLegacyMigration({
      async apply() { throw error; }
    }, repository, '1001', {
      clientRequestId: 'migration-failed',
      executedBy: '迁移员',
      confirmed: true
    }, {
      id: 'MIGRUN-failed-migration',
      now: '2026-07-26T00:00:00.000Z',
      completedAt: '2026-07-26T00:00:01.000Z'
    }),
    (caught) => caught.code === 'UPSTREAM_ERROR'
  );
  assert.equal(repository.items[0].status, 'failed');
  assert.equal(repository.items[0].error.code, 'UPSTREAM_ERROR');
});
