import test from 'node:test';
import assert from 'node:assert/strict';
import { batchUpdatePhotoMetadata } from '../../server/services/photo-metadata-batch-service.mjs';

function context() {
  const metadata = new Map();
  const photos = [
    { id: 'PHOTO-1', projectId: '1001', communityId: 'COMM-1', name: '1.jpg' },
    { id: 'PHOTO-2', projectId: '1001', communityId: 'COMM-1', name: '2.jpg' }
  ];
  return {
    metadata,
    client: {
      async getProject() {
        return {
          id: '1001',
          residentialInventory: { items: [{ id: 'COMM-1', name: '测试小区', status: 'active' }] }
        };
      },
      async safeList() { return { items: photos }; }
    },
    repository: {
      async get(id) { return metadata.get(id) || null; },
      async put(item) { metadata.set(item.photoId, item); return item; }
    }
  };
}

test('photo batch metadata returns explicit per-item success and failure', async () => {
  const { client, repository, metadata } = context();
  const outcome = await batchUpdatePhotoMetadata(client, repository, '1001', {
    updatedBy: '批量治理员',
    items: [
      { photoId: 'PHOTO-1', longitude: 108.95, latitude: 34.27, expectedRevision: 0 },
      { photoId: 'PHOTO-MISSING', longitude: 108.96, latitude: 34.28, expectedRevision: 0 }
    ]
  });
  assert.equal(outcome.total, 2);
  assert.equal(outcome.succeeded, 1);
  assert.equal(outcome.failed, 1);
  assert.equal(outcome.results[1].error.code, 'PHOTO_NOT_FOUND');
  assert.equal(metadata.get('PHOTO-1').coordinateSource, 'batch-manual');
});

test('photo batch rejects duplicate IDs and missing operator before any write', async () => {
  const { client, repository, metadata } = context();
  await assert.rejects(
    () => batchUpdatePhotoMetadata(client, repository, '1001', {
      items: [{ photoId: 'PHOTO-1', longitude: 108.95, latitude: 34.27 }]
    }),
    (error) => error.code === 'PHOTO_BATCH_EDITOR_REQUIRED'
  );
  await assert.rejects(
    () => batchUpdatePhotoMetadata(client, repository, '1001', {
      updatedBy: '批量治理员',
      items: [
        { photoId: 'PHOTO-1', longitude: 108.95, latitude: 34.27 },
        { photoId: 'PHOTO-1', longitude: 108.96, latitude: 34.28 }
      ]
    }),
    (error) => error.code === 'PHOTO_BATCH_DUPLICATE_PHOTO'
  );
  assert.equal(metadata.size, 0);
});
