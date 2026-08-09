import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUDBASE_COLLECTIONS,
  BUSINESS_PROVIDER_COLLECTION_SPECS,
  CloudBaseRepositoryProvider,
  cloudBaseProviderCapability,
  cloudBaseRuntimeCapability,
  createCloudBaseProviders
} from '../../server/providers/cloudbase-provider.mjs';
import { createCloudBaseJsonRepository } from '../../server/repositories/cloudbase-repository-adapter.mjs';
import {
  CloudBaseStorageProvider,
  SmartRenewStorageProvider,
  assertStorageProvider
} from '../../server/providers/storage-provider.mjs';
import { checkCloudBaseHealth } from '../../server/services/provider-migration-service.mjs';

function cloudBaseMock() {
  const records = new Map();
  const files = new Map();
  function collection(name) {
    const prefix = `${name}:`;
    function queryView(query = {}, offset = 0, pageLimit = null) {
      return {
        where(nextQuery) { return queryView(nextQuery, offset, pageLimit); },
        skip(nextOffset) { return queryView(query, Number(nextOffset) || 0, pageLimit); },
        limit(nextLimit) { return queryView(query, offset, Math.max(0, Number(nextLimit) || 0)); },
        async get() {
          const matched = [...records.entries()]
            .filter(([key, value]) => key.startsWith(prefix)
              && Object.entries(query).every(([field, expected]) => value[field] === expected))
            .map(([, value]) => value);
          const defaultLimit = pageLimit == null ? 100 : pageLimit;
          return { data: matched.slice(offset, offset + defaultLimit) };
        }
      };
    }
    return {
      ...queryView(),
      doc(id) {
        return {
          async get() { return { data: records.get(`${prefix}${id}`) || null }; },
          async set({ data }) { records.set(`${prefix}${id}`, data); },
          async remove() { records.delete(`${prefix}${id}`); }
        };
      }
    };
  }
  const database = {
    collection,
    async runTransaction(update) {
      return { result: await update({ collection }) };
    }
  };
  const app = {
    database() {
      return database;
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
  assert.deepEqual(
    Object.keys(CLOUDBASE_COLLECTIONS).sort(),
    [
      'analyses',
      'boundaryRevisions',
      'businessAiConfigurations',
      'businessAnalysisCandidates',
      'businessAnalysisJobs',
      'businessBoundaryRevisions',
      'businessCollectionValidations',
      'businessCoordinateTransforms',
      'businessFieldTaskReferences',
      'businessMapSnapshots',
      'businessMigrationRuns',
      'businessOfficialIssues',
      'businessPhotoMetadata',
      'businessPhotoRouteBindings',
      'businessProviderMigrationRuns',
      'businessReports',
      'businessResidentialDiscoveryRuns',
      'businessReviewSessions',
      'businessSourceAssetImports',
      'businessSourceAssets',
      'businessSpatialAnalyses',
      'businessSurveyRoutes',
      'businessSurveyStops',
      'businessUploadSessions',
      'coordinateTransforms',
      'fieldTasks',
      'mapSnapshots',
      'officialIssues',
      'photoRouteBindings',
      'photos',
      'projectData',
      'projects',
      'reports',
      'reviewSessions',
      'sourceAssets',
      'spatialAnalyses',
      'surveyRoutes',
      'surveyStops',
      'uploadSessions'
    ].sort()
  );

  const { app } = cloudBaseMock();
  const providers = createCloudBaseProviders({ init: () => app }, { TCB_ENV: 'test-env' });
  assert.equal(providers.repositories.kind, 'cloudbase-database');
  assert.equal(providers.storage.kind, 'cloudbase-storage');
});

test('CloudBase business collection contract exposes schema, unique key and inactive-record semantics', async () => {
  assert.ok(BUSINESS_PROVIDER_COLLECTION_SPECS.length >= 20);
  assert.ok(BUSINESS_PROVIDER_COLLECTION_SPECS.every((spec) => spec.schemaVersion === '1.0.0' && spec.uniqueKey === 'id'));
  assert.equal(cloudBaseRuntimeCapability(null, {}).cloudbase.productionVerified, false);

  const { app } = cloudBaseMock();
  const provider = new CloudBaseRepositoryProvider(app);
  const repository = createCloudBaseJsonRepository(provider, 'businessSourceAssets', { excludeInactive: true });
  await repository.put({ id: 'ASSET-A', projectId: 'PRJ-1', status: 'inactive', updatedAt: '2026-08-02' });
  await repository.put({ id: 'ASSET-B', projectId: 'PRJ-1', status: 'active', updatedAt: '2026-08-01' });
  assert.deepEqual((await repository.list('PRJ-1')).map((item) => item.id), ['ASSET-B']);
  assert.deepEqual((await repository.list('PRJ-1', true)).map((item) => item.id), ['ASSET-A', 'ASSET-B']);
});

test('CloudBase health requires both database and object storage probes', async () => {
  const { app } = cloudBaseMock();
  const configured = createCloudBaseProviders(
    { init: () => app },
    { TCB_ENV: 'test-env', CLOUDBASE_HEALTH_OBJECT: 'health/ready.txt' }
  );
  const healthy = await checkCloudBaseHealth(configured);
  assert.equal(healthy.ready, true);
  assert.equal(healthy.database.ready, true);
  assert.equal(healthy.storage.ready, true);
  const storageUnconfigured = createCloudBaseProviders({ init: () => app }, { TCB_ENV: 'test-env' });
  const degraded = await checkCloudBaseHealth(storageUnconfigured);
  assert.equal(degraded.ready, false);
  assert.equal(degraded.storage.reason, 'cloudbase_storage_health_object_not_configured');
  assert.equal(degraded.productionVerified, false);
});

test('CloudBase list reads beyond one hundred records and applies offset/limit controls', async () => {
  const { app } = cloudBaseMock();
  const provider = new CloudBaseRepositoryProvider(app);
  for (let index = 0; index < 250; index += 1) {
    await provider.put('businessReports', {
      id: `RPT-${String(index).padStart(3, '0')}`,
      projectId: index % 2 ? 'PRJ-B' : 'PRJ-A',
      version: index,
      status: 'generated'
    });
  }
  assert.equal((await provider.list('businessReports')).length, 250);
  const page = await provider.list('businessReports', { offset: 100, limit: 50 });
  assert.equal(page.length, 50);
  assert.equal(page[0].id, 'RPT-100');
  assert.equal(page.at(-1).id, 'RPT-149');
  assert.equal((await provider.list('businessReports', { projectId: 'PRJ-A' })).length, 125);
  assert.equal((await provider.list('businessReports', { projectId: 'PRJ-A', offset: 100, limit: 50 })).length, 25);
});

test('CloudBase adapter applies numeric pagination once after global sorting', async () => {
  const { app } = cloudBaseMock();
  const provider = new CloudBaseRepositoryProvider(app);
  const repository = createCloudBaseJsonRepository(provider, 'businessReports', { sortField: 'updatedAt' });
  for (let index = 0; index < 250; index += 1) {
    await repository.put({
      id: `RPT-${String(index).padStart(3, '0')}`,
      projectId: 'PRJ-A',
      updatedAt: String(index).padStart(3, '0')
    });
  }
  const page = await repository.list('PRJ-A', { offset: 100, limit: 50 });
  assert.equal(page.length, 50);
  assert.equal(page[0].id, 'RPT-149');
  assert.equal(page.at(-1).id, 'RPT-100');
});

test('CloudBase migration lease is acquired and renewed atomically through the shared repository', async () => {
  const { app } = cloudBaseMock();
  const provider = new CloudBaseRepositoryProvider(app);
  const repository = createCloudBaseJsonRepository(provider, 'businessProviderMigrationRuns');
  await repository.put({ id: 'MIGRUN-LEASE-0001', status: 'planned', migrated: [], failures: [] });
  const first = await repository.acquireMigrationLease('MIGRUN-LEASE-0001', {
    token: 'token-a',
    owner: 'instance-a',
    now: '2026-08-10T00:00:00.000Z',
    expiresAt: '2026-08-10T00:02:00.000Z'
  });
  assert.equal(first.acquired, true);
  const competing = await repository.acquireMigrationLease('MIGRUN-LEASE-0001', {
    token: 'token-b',
    owner: 'instance-b',
    now: '2026-08-10T00:01:00.000Z',
    expiresAt: '2026-08-10T00:03:00.000Z'
  });
  assert.equal(competing.acquired, false);
  assert.equal(competing.reason, 'active_lease');
  const wrongOwner = await repository.saveMigrationRunWithLease(first.run, {
    token: 'token-b',
    now: '2026-08-10T00:01:00.000Z',
    expiresAt: '2026-08-10T00:03:00.000Z'
  });
  assert.equal(wrongOwner.saved, false);
  assert.equal(wrongOwner.reason, 'lease_lost');
  const released = await repository.saveMigrationRunWithLease({ ...first.run, status: 'completed' }, {
    token: 'token-a',
    now: '2026-08-10T00:01:00.000Z',
    expiresAt: '2026-08-10T00:03:00.000Z',
    release: true
  });
  assert.equal(released.saved, true);
  assert.equal(released.run.migrationLease.releasedAt, '2026-08-10T00:01:00.000Z');
});
