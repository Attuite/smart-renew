import assert from 'node:assert/strict';
import test from 'node:test';
import { createSmartRenewAdapters } from '../../server/adapters/smart-renew/index.mjs';

class RecordingClient {
  constructor() {
    this.calls = [];
  }

  async request(pathname, options = {}) {
    this.calls.push({ pathname, options });
    if (pathname === '/api/field/projects') return { items: [{ id: '1' }] };
    if (pathname.includes('/communities/') && pathname.endsWith('/buildings')) {
      return { items: [{ id: 'BLD-1' }] };
    }
    if (pathname.endsWith('/communities')) return { items: [{ id: 'COM-1' }] };
    if (pathname === '/api/field/collection-tasks' && options.method === 'POST') {
      return { item: { id: 'FIELD-1' } };
    }
    if (pathname === '/api/field/collection-tasks/FIELD-1') {
      return { item: { id: 'FIELD-1' } };
    }
    if (pathname.startsWith('/api/project-data?')) {
      return { items: [{ id: 'DATA-1' }], stats: { total: 1 }, storage: 'local' };
    }
    if (pathname === '/api/project-data/import') return { imported: 1 };
    if (pathname.endsWith('/data-export')) return { records: [{ id: 'DATA-1' }] };
    if (pathname.startsWith('/api/migrations/legacy?')) return { applied: false };
    if (pathname === '/api/migrations/legacy') return { applied: true };
    if (pathname.startsWith('/api/issues?')) return { items: [{ id: 'ISS-1' }] };
    if (pathname.startsWith('/api/reports?')) return { items: [{ id: 'RPT-1' }] };
    if (pathname === '/api/reports/RPT-1') return { item: { id: 'RPT-1' } };
    return {};
  }
}

test('smart-renew adapters preserve the original field and project-data contracts', async () => {
  const client = new RecordingClient();
  const adapters = createSmartRenewAdapters(client);

  assert.deepEqual(await adapters.field.listProjects(), [{ id: '1' }]);
  assert.deepEqual(await adapters.field.listCommunities('1'), [{ id: 'COM-1' }]);
  assert.deepEqual(await adapters.field.listBuildings('1', 'COM-1'), [{ id: 'BLD-1' }]);
  assert.equal((await adapters.field.createTask({ projectId: '1' })).task.id, 'FIELD-1');
  assert.equal((await adapters.field.getTask('FIELD-1')).id, 'FIELD-1');

  const listed = await adapters.projectData.list('1', { type: 'photo', q: '入口' });
  assert.equal(listed.items[0].id, 'DATA-1');
  assert.equal(listed.stats.total, 1);
  assert.ok(client.calls.some((call) =>
    call.pathname === '/api/project-data?projectId=1&type=photo&q=%E5%85%A5%E5%8F%A3'
  ));
  assert.equal((await adapters.projectData.importRecords('1', [{ id: 'DATA-1' }])).imported, 1);
  assert.equal((await adapters.projectData.export('1')).records[0].id, 'DATA-1');
});

test('legacy migration requires explicit confirmation and report snapshots stay read-only', async () => {
  const client = new RecordingClient();
  const adapters = createSmartRenewAdapters(client);

  await assert.rejects(
    () => adapters.legacyMigration.apply('1'),
    (error) => error.code === 'LEGACY_MIGRATION_CONFIRMATION_REQUIRED'
  );
  assert.equal((await adapters.legacyMigration.audit('1')).applied, false);
  assert.equal((await adapters.legacyMigration.apply('1', { confirmed: true })).applied, true);
  assert.deepEqual(await adapters.legacyMigration.listIssues('1'), [{ id: 'ISS-1' }]);
  assert.deepEqual(await adapters.legacyMigration.listReports('1'), [{ id: 'RPT-1' }]);
  assert.deepEqual(await adapters.reportSnapshots.list('1'), [{ id: 'RPT-1' }]);
  assert.equal((await adapters.reportSnapshots.get('RPT-1')).id, 'RPT-1');
  assert.equal(typeof adapters.reportSnapshots.generate, 'undefined');
});
