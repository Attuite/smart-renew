import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSourceAsset,
  updateSourceAsset,
  uploadSourceAssetContent
} from '../../server/services/source-asset-service.mjs';

function repository() {
  const items = new Map();
  const contents = new Map();
  return {
    items,
    contents,
    async get(id) { return items.get(id) || null; },
    async put(item) { items.set(item.id, item); return item; },
    async list(projectId = '', includeInactive = false) {
      return [...items.values()].filter((item) =>
        (!projectId || item.projectId === projectId)
        && (includeInactive || item.status !== 'inactive')
      );
    },
    async findByClientRequest(projectId, requestId) {
      return [...items.values()].find((item) =>
        item.projectId === projectId && item.clientRequestId === requestId
      ) || null;
    },
    async writeContent(id, content) { contents.set(id, content); }
  };
}

const client = {
  async getProject() {
    return {
      id: '1001',
      residentialInventory: {
        items: [{ id: 'COMM-1', name: '测试小区', status: 'active' }]
      }
    };
  }
};

test('source asset creation validates hierarchy and is idempotent', async () => {
  const assets = repository();
  const input = {
    name: '范围.geojson',
    mimeType: 'application/geo+json',
    size: 3,
    category: 'gis',
    communityId: 'COMM-1',
    createdBy: '资料员',
    clientRequestId: 'asset-request-1'
  };
  const first = await createSourceAsset(client, assets, '1001', input, {
    id: 'ASSET-00000001',
    now: '2026-07-26T12:00:00.000Z'
  });
  const second = await createSourceAsset(client, assets, '1001', input);

  assert.equal(first.asset.status, 'ready');
  assert.equal(first.asset.communityName, '测试小区');
  assert.equal(second.duplicated, true);
  assert.equal(second.asset.id, first.asset.id);
});

test('source asset content persists exact size and sha256', async () => {
  const assets = repository();
  assets.items.set('ASSET-00000002', {
    id: 'ASSET-00000002',
    projectId: '1001',
    name: '调查.csv',
    mimeType: 'text/csv',
    size: 3,
    status: 'ready',
    uploadStatus: 'ready',
    assetRevision: 1
  });
  const completed = await uploadSourceAssetContent(
    assets,
    'ASSET-00000002',
    new Uint8Array([97, 98, 99]),
    'text/csv',
    { now: '2026-07-26T12:01:00.000Z' }
  );

  assert.equal(completed.status, 'active');
  assert.equal(completed.uploadStatus, 'completed');
  assert.equal(completed.contentHash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('source asset MIME failure is persisted and the same asset remains retryable', async () => {
  const assets = repository();
  assets.items.set('ASSET-00000004', {
    id: 'ASSET-00000004',
    projectId: '1001',
    name: '调查.csv',
    mimeType: 'text/csv',
    size: 3,
    status: 'ready',
    uploadStatus: 'ready',
    assetRevision: 1
  });
  await assert.rejects(
    () => uploadSourceAssetContent(
      assets,
      'ASSET-00000004',
      new Uint8Array([97, 98, 99]),
      'application/pdf'
    ),
    (error) => error.code === 'SOURCE_ASSET_MIME_MISMATCH'
  );
  assert.equal(assets.items.get('ASSET-00000004').uploadStatus, 'failed');
  const completed = await uploadSourceAssetContent(
    assets,
    'ASSET-00000004',
    new Uint8Array([97, 98, 99]),
    'text/csv'
  );
  assert.equal(completed.uploadStatus, 'completed');
  assert.equal(completed.id, 'ASSET-00000004');
});

test('completed source asset is immutable and duplicate content reuses existing evidence', async () => {
  const assets = repository();
  const contentHash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  assets.items.set('ASSET-00000005', {
    id: 'ASSET-00000005',
    projectId: '1001',
    name: '既有.csv',
    mimeType: 'text/csv',
    size: 3,
    status: 'active',
    uploadStatus: 'completed',
    contentHash,
    assetRevision: 1
  });
  assets.items.set('ASSET-00000006', {
    id: 'ASSET-00000006',
    projectId: '1001',
    name: '重复.csv',
    mimeType: 'text/csv',
    size: 3,
    status: 'ready',
    uploadStatus: 'ready',
    assetRevision: 1
  });
  const idempotent = await uploadSourceAssetContent(
    assets,
    'ASSET-00000005',
    new Uint8Array([97, 98, 99]),
    'text/csv'
  );
  assert.equal(idempotent.id, 'ASSET-00000005');

  await assert.rejects(
    () => uploadSourceAssetContent(
      assets,
      'ASSET-00000005',
      new Uint8Array([100, 101, 102]),
      'text/csv'
    ),
    (error) => error.code === 'SOURCE_ASSET_CONTENT_IMMUTABLE'
  );
  const duplicate = await uploadSourceAssetContent(
    assets,
    'ASSET-00000006',
    new Uint8Array([97, 98, 99]),
    'text/csv'
  );
  assert.equal(duplicate.uploadStatus, 'duplicate');
  assert.equal(duplicate.duplicateOf, 'ASSET-00000005');
  assert.equal(assets.contents.has('ASSET-00000006'), false);
});

test('source asset governance supports soft deactivation and revision conflict', async () => {
  const assets = repository();
  assets.items.set('ASSET-00000003', {
    id: 'ASSET-00000003',
    projectId: '1001',
    name: '资料.pdf',
    mimeType: 'application/pdf',
    size: 10,
    category: 'document',
    status: 'active',
    uploadStatus: 'completed',
    assetRevision: 1
  });
  const inactive = await updateSourceAsset(client, assets, '1001', 'ASSET-00000003', {
    status: 'inactive',
    updatedBy: '资料员',
    expectedRevision: 1
  });
  assert.equal(inactive.status, 'inactive');
  assert.equal(inactive.assetRevision, 2);
  await assert.rejects(
    () => updateSourceAsset(client, assets, '1001', 'ASSET-00000003', {
      status: 'active',
      updatedBy: '资料员',
      expectedRevision: 1
    }),
    (error) => error.code === 'SOURCE_ASSET_REVISION_CONFLICT'
  );
});
