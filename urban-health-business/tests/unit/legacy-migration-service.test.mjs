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

function memoryEntities(initial = []) {
  const items = [...initial];
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
    }
  };
}

test('legacy migration is explicit, audited and idempotent by client request', async () => {
  const repository = memoryRuns();
  const issueRepository = memoryEntities();
  const reportRepository = memoryEntities();
  const legacyIssue = {
    id: 'ISS-OLD-001',
    projectId: '1001',
    originalPhotoId: 'PHOTO-001',
    title: '旧问题',
    severity: 'high',
    problemCode: 'PRB-03-08',
    indicatorCode: 'IND-HOUSE-003'
  };
  const adapter = {
    async audit() { return { audit: { embeddedOriginals: 2 }, applied: false }; },
    async apply() { return { applied: true, migratedPhotos: 2 }; },
    async listIssues() { return [legacyIssue]; },
    async listReports() {
      return [{
        id: 'RPT-OLD-001',
        projectId: '1001',
        version: 1,
        title: '旧报告',
        sourceIds: { issueIds: [legacyIssue.id] },
        snapshot: {
          project: { id: '1001', name: '测试项目' },
          issues: { items: [legacyIssue], high: 1, medium: 0, low: 0 }
        }
      }];
    }
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
    completedAt: '2026-07-26T00:00:01.000Z',
    issueRepository,
    reportRepository
  });
  const second = await applyLegacyMigration(adapter, repository, '1001', {
    clientRequestId: 'migration-001',
    executedBy: '迁移员',
    confirmed: true
  });
  assert.equal(first.item.status, 'completed');
  assert.equal(first.item.result.migratedPhotos, 2);
  assert.equal(first.item.result.business.migratedIssues, 1);
  assert.equal(first.item.result.business.migratedReports, 1);
  assert.equal(issueRepository.items[0].indicatorCode, null);
  assert.equal(reportRepository.items[0].migration.readOnly, true);
  assert.equal(second.duplicated, true);

  const audit = await auditLegacyMigration(adapter, repository, '1001', {
    issueRepository,
    reportRepository
  });
  assert.equal(audit.upstream.audit.embeddedOriginals, 2);
  assert.equal(audit.runs.length, 1);
  assert.equal(audit.businessMigration.issues.alreadyMigrated, 1);
  assert.equal(audit.businessMigration.reports.alreadyMigrated, 1);
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
