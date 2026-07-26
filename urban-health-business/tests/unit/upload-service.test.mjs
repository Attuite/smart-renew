import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelUploadSession,
  createUploadSession,
  uploadSessionContent
} from '../../server/services/upload-service.mjs';

function memoryRepository() {
  const items = new Map();
  return {
    items,
    async get(id) { return items.get(id) || null; },
    async put(item) { items.set(item.id, item); return item; },
    async findByClientRequest(projectId, requestId) {
      return [...items.values()].find((item) =>
        item.projectId === projectId && item.clientRequestId === requestId && item.status !== 'canceled'
      ) || null;
    }
  };
}

const project = {
  id: '170000000000001',
  residentialInventory: {
    items: [{
      id: 'COMM-1',
      name: '幸福里',
      buildings: [{ id: 'BLD-1', name: '1号楼', status: 'active' }]
    }]
  }
};

test('upload session validates real project hierarchy and is idempotent by client request', async () => {
  const repository = memoryRepository();
  const client = { async getProject() { return project; } };
  const input = {
    projectId: project.id,
    communityId: 'COMM-1',
    buildingId: 'BLD-1',
    name: '现场照片.png',
    mimeType: 'image/png',
    size: 4,
    clientRequestId: 'client-file-1'
  };
  const first = await createUploadSession(client, repository, input, {
    id: 'UPL-fixed-session',
    now: '2026-07-26T00:00:00.000Z'
  });
  const second = await createUploadSession(client, repository, input);
  assert.equal(first.session.buildingName, '1号楼');
  assert.equal(second.duplicated, true);
  assert.equal(second.session.id, first.session.id);
});

test('raw upload content persists completion and hash', async () => {
  const repository = memoryRepository();
  const session = {
    id: 'UPL-fixed-content',
    projectId: project.id,
    communityId: 'COMM-1',
    buildingId: 'BLD-1',
    file: { name: '现场照片.png', mimeType: 'image/png', size: 4 },
    status: 'ready',
    attempts: 0
  };
  await repository.put(session);
  const client = {
    async request(pathname, options) {
      assert.equal(pathname, '/api/photos/upload');
      assert.ok(JSON.parse(options.body).dataUrl.startsWith('data:image/png;base64,'));
      return { item: { id: 'PHOTO-REAL', storage: 'server-filesystem' }, duplicated: false };
    }
  };
  const outcome = await uploadSessionContent(
    client,
    repository,
    session.id,
    Buffer.from([1, 2, 3, 4]),
    'image/png',
    { now: '2026-07-26T00:00:01.000Z' }
  );
  assert.equal(outcome.session.status, 'completed');
  assert.equal(outcome.session.photoId, 'PHOTO-REAL');
  assert.equal(outcome.session.contentHash.length, 64);
  assert.equal(outcome.session.attempts, 1);
});

test('failed storage attempt remains retryable and cancel is explicit', async () => {
  const repository = memoryRepository();
  await repository.put({
    id: 'UPL-fixed-failure',
    projectId: project.id,
    communityId: 'COMM-1',
    buildingId: '',
    file: { name: '现场照片.png', mimeType: 'image/png', size: 2 },
    status: 'ready',
    attempts: 0
  });
  const client = {
    async request() {
      const error = new Error('storage unavailable');
      error.code = 'UPSTREAM_UNAVAILABLE';
      error.status = 502;
      throw error;
    }
  };
  await assert.rejects(
    () => uploadSessionContent(
      client,
      repository,
      'UPL-fixed-failure',
      Buffer.from([1, 2]),
      'image/png'
    )
  );
  assert.equal((await repository.get('UPL-fixed-failure')).status, 'failed');
  assert.equal((await repository.get('UPL-fixed-failure')).attempts, 1);
  assert.equal((await repository.get('UPL-fixed-failure')).error.code, 'UPSTREAM_UNAVAILABLE');

  const canceled = await cancelUploadSession(repository, 'UPL-fixed-failure');
  assert.equal(canceled.status, 'canceled');
});
