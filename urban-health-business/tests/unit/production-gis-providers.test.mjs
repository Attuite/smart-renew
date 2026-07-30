import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SqliteRepositoryProvider } from '../../server/providers/sqlite-provider.mjs';
import {
  S3StorageProvider,
  s3StorageCapability
} from '../../server/providers/s3-storage-provider.mjs';
import { FilesystemObjectStorageProvider } from '../../server/providers/storage-provider.mjs';
import {
  ProviderBoundaryRevisionRepository,
  ProviderSurveyRouteRepository
} from '../../server/repositories/provider-gis-repositories.mjs';

test('SQLite GIS provider persists indexed records and rolls back transactions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'urban-health-sqlite-provider-'));
  const provider = new SqliteRepositoryProvider(path.join(root, 'gis.sqlite'));
  const routes = new ProviderSurveyRouteRepository(provider);
  await routes.put({
    id: 'ROUTE-PROVIDER-0001',
    projectId: '1',
    status: 'confirmed',
    name: '正式数据库路线',
    updatedAt: '2026-07-30T12:00:00Z'
  });
  assert.equal((await routes.list('1', { status: 'confirmed' }))[0].name, '正式数据库路线');

  await assert.rejects(
    provider.transaction(async (transaction) => {
      await transaction.put('surveyRoutes', {
        id: 'ROUTE-PROVIDER-ROLLBACK',
        projectId: '1',
        status: 'draft'
      });
      throw new Error('rollback');
    }),
    /rollback/
  );
  assert.equal(await routes.get('ROUTE-PROVIDER-ROLLBACK'), null);

  const boundaries = new ProviderBoundaryRevisionRepository(provider);
  await boundaries.putFromProject({
    id: '1',
    revision: 3,
    scopeBoundary: [[108.94, 34.26], [108.96, 34.26], [108.96, 34.28]],
    scopeBoundaryCrs: 'GCJ02',
    boundaryUpdatedBy: '数据库验收'
  });
  assert.equal((await boundaries.list('1'))[0].projectRevision, 3);
  provider.close();
});

test('filesystem object provider writes atomically inside its object root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'urban-health-object-provider-'));
  const storage = new FilesystemObjectStorageProvider(root);
  const uploaded = await storage.upload({
    path: 'map-snapshots/MAPSNAP-PROVIDER.svg',
    bytes: Buffer.from('<svg/>'),
    contentType: 'image/svg+xml'
  });
  assert.equal(uploaded.storage, 'filesystem-object-storage');
  assert.equal(
    await readFile(path.join(root, 'map-snapshots', 'MAPSNAP-PROVIDER.svg'), 'utf8'),
    '<svg/>'
  );
  await assert.rejects(
    storage.upload({ path: '../outside.svg', bytes: Buffer.from('x') }),
    (error) => error.code === 'OBJECT_PATH_INVALID'
  );
});

test('S3-compatible provider signs private uploads without exposing the secret', async () => {
  const requests = [];
  const storage = new S3StorageProvider({
    endpoint: 'https://objects.example.test',
    region: 'ap-east-1',
    bucket: 'urban-health',
    accessKeyId: 'ACCESS-ID',
    secretAccessKey: 'SUPER-SECRET',
    forcePathStyle: true
  }, {
    now: () => new Date('2026-07-30T12:00:00Z'),
    async fetchImpl(url, options) {
      requests.push({ url: String(url), options });
      return new Response('', { status: 200 });
    }
  });
  const uploaded = await storage.upload({
    path: 'map-snapshots/MAPSNAP-PROVIDER.svg',
    bytes: Buffer.from('<svg/>'),
    contentType: 'image/svg+xml'
  });
  assert.equal(uploaded.storage, 's3-compatible-storage');
  assert.match(requests[0].options.headers.authorization, /Credential=ACCESS-ID/);
  assert.equal(requests[0].options.headers.authorization.includes('SUPER-SECRET'), false);
  assert.equal(requests[0].url.includes('SUPER-SECRET'), false);
  assert.equal(
    s3StorageCapability({
      GIS_MAP_SNAPSHOT_PROVIDER: 's3',
      S3_ENDPOINT: 'https://objects.example.test',
      S3_REGION: 'ap-east-1',
      S3_BUCKET: 'urban-health',
      S3_ACCESS_KEY_ID: 'ACCESS-ID',
      S3_SECRET_ACCESS_KEY: 'SUPER-SECRET'
    }).configured,
    true
  );
});
