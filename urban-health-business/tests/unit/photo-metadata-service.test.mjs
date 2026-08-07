import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePhotoMetadata, updatePhotoMetadata } from '../../server/services/photo-metadata-service.mjs';

function fakeClient() {
  return {
    async getProject() {
      return {
        id: '170000000000001',
        residentialInventory: {
          items: [{
            id: 'COMM-1',
            name: '真实小区',
            status: 'active',
            buildings: [{ id: 'BLD-1', name: '1号楼', status: 'active' }]
          }]
        }
      };
    },
    async listPhotos() {
      return { items: [{ id: 'PHOTO-1', name: '原照片', communityId: 'COMM-1' }] };
    }
  };
}

test('photo governance corrects hierarchy and coordinates without changing the legacy photo', async () => {
  let stored = null;
  const metadata = await updatePhotoMetadata(fakeClient(), {
    async get() { return null; },
    async put(value) { stored = value; return value; }
  }, '170000000000001', 'PHOTO-1', {
    displayName: '修正后的现场照片',
    communityId: 'COMM-1',
    buildingId: 'BLD-1',
    longitude: 108.95,
    latitude: 34.27,
    updatedBy: '资料管理员',
    expectedRevision: 0
  }, { now: '2026-07-26T00:00:00.000Z' });

  assert.equal(metadata.metadataRevision, 1);
  assert.equal(metadata.buildingName, '1号楼');
  assert.deepEqual(metadata.coordinates, [108.95, 34.27]);
  assert.equal(stored.photoId, 'PHOTO-1');
});

test('inactive photo is hidden by default but remains recoverable in governance view', () => {
  const legacy = [{ id: 'PHOTO-1', name: '原照片' }];
  const overlays = [{
    photoId: 'PHOTO-1',
    displayName: '误传照片',
    status: 'inactive',
    metadataRevision: 2
  }];
  assert.equal(mergePhotoMetadata(legacy, overlays).length, 0);
  const governed = mergePhotoMetadata(legacy, overlays, true);
  assert.equal(governed.length, 1);
  assert.equal(governed[0].name, '误传照片');
  assert.equal(governed[0].governanceStatus, 'inactive');
});
