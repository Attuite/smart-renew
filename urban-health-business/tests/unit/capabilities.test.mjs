import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilities } from '../../server/services/workflow-service.mjs';

test('capabilities identify local filesystem without claiming object storage', async () => {
  const capabilities = await getCapabilities({
    baseUrl: 'http://127.0.0.1:4173',
    async health() { return { ready: false }; }
  });
  assert.equal(capabilities.storage.ready, true);
  assert.equal(capabilities.storage.mode, 'local-filesystem');
  assert.equal(capabilities.storage.objectStorageReady, false);
  assert.equal(capabilities.storage.objectStorageReason, 'object_storage_not_integrated');
  assert.equal(capabilities.database.mode, 'local-json-files');
  assert.equal(capabilities.database.managedDatabaseReady, false);
  assert.equal(capabilities.database.managedDatabaseReason, 'managed_database_not_integrated');
  assert.equal(capabilities.legacy.projectData.status, 'available');
  assert.equal(capabilities.legacy.fieldCollection.adapter, 'FieldAdapter');
  assert.equal(capabilities.legacy.reportSnapshots.status, 'degraded');
});
