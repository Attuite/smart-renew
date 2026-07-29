import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUDBASE_COLLECTIONS,
  CloudBaseRepositoryProvider,
  cloudBaseProviderCapability,
  createCloudBaseProviders
} from '../../server/providers/cloudbase-provider.mjs';
import {
  CloudBaseStorageProvider,
  SmartRenewStorageProvider,
  assertStorageProvider
} from '../../server/providers/storage-provider.mjs';

function cloudBaseMock() {
  const records = new Map();
  const files = new Map();
  const app = {
    database() {
      return {
        collection(name) {
          const prefix = `${name}:`;
          return {
            doc(id) {
              return {
                async get() { return { data: records.get(`${prefix}${id}`) || null }; },
                async set({ data }) { records.set(`${prefix}${id}`, data); },
                async remove() { records.delete(`${prefix}${id}`); }
              };
            },
            where(query) {
              return {
                async get() {
                  return {
                    data: [...records.entries()]
                      .filter(([key, value]) => key.startsWith(prefix)
                        && Object.entries(query).every(([field, expected]) => value[field] === expected))
                      .map(([, value]) => value)
                  };
                }
              };
            },
            async get() {
              return {
                data: [...records.entries()]
                  .filter(([key]) => key.startsWith(prefix))
                  .map(([, value]) => value)
              };
            }
          };
        }
      };
    },
    async uploadFile({ cloudPath, fileContent }) {
      files.set(cloudPath, Buffer.from(fileContent));
      return { fileID: `cloud://${cloudPath}` };
    },
    async downloadFile({ fileID }) {
      return { fileContent: files.get(fileID.replace('cloud://', '')) };
    },
    async getTempFileURL({ fileList }) {
      return { fileList: [{ fileID: fileList[0], tempFileURL: `https://temp.example/${fileList[0]}` }] };
    }
  };
  return { app, records, files };
}

test('CloudBase repository adapter provides basic CRUD against configured collections', async () => {
  const { app } = cloudBaseMock();
  const provider = new CloudBaseRepositoryProvider(app);
  await provider.put('reports', { id: 'RPT-1', projectId: 'PRJ-1', title: '报告' });
  assert.equal((await provider.get('reports', 'RPT-1')).title, '报告');
  assert.equal((await provider.list('reports', { projectId: 'PRJ-1' })).length, 1);
  assert.equal((await provider.remove('reports', 'RPT-1')).removed, true);
  assert.equal(await provider.get('reports', 'RPT-1'), null);
});

test('local and CloudBase storage implementations satisfy the same contract', async () => {
  const local = assertStorageProvider(new SmartRenewStorageProvider({
    async uploadPhoto() { return { item: { id: 'PHOTO-1', storage: 'filesystem' } }; },
    async getPhotoContent() { return { bytes: Buffer.from('local'), contentType: 'text/plain' }; }
  }));
  assert.equal((await local.upload({})).id, 'PHOTO-1');
  assert.equal(await local.temporaryUrl({ id: 'PHOTO-1' }), '/api/photos/PHOTO-1/content');

  const { app } = cloudBaseMock();
  const cloud = assertStorageProvider(new CloudBaseStorageProvider(app));
  const uploaded = await cloud.upload({ path: 'projects/PRJ-1/report.html', bytes: Buffer.from('cloud') });
  assert.equal((await cloud.download(uploaded)).bytes.toString(), 'cloud');
  assert.match(await cloud.temporaryUrl(uploaded), /^https:\/\/temp\.example\//);
});

test('CloudBase provider remains optional and never claims production verification', () => {
  const capability = cloudBaseProviderCapability({});
  assert.equal(capability.selected, 'local');
  assert.equal(capability.cloudbase.configured, false);
  assert.equal(capability.cloudbase.productionVerified, false);
  assert.equal(Object.keys(CLOUDBASE_COLLECTIONS).length, 10);

  const { app } = cloudBaseMock();
  const providers = createCloudBaseProviders({ init: () => app }, { TCB_ENV: 'test-env' });
  assert.equal(providers.repositories.kind, 'cloudbase-database');
  assert.equal(providers.storage.kind, 'cloudbase-storage');
});
