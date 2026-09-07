import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  SqliteRepositoryProvider,
  sqliteProviderCapability
} from '../../server/providers/sqlite-provider.mjs';
import {
  S3StorageProvider,
  s3StorageCapability
} from '../../server/providers/s3-storage-provider.mjs';
import { FilesystemObjectStorageProvider } from '../../server/providers/storage-provider.mjs';
import {
  ProviderBoundaryRevisionRepository,
  ProviderSurveyRouteRepository
} from '../../server/repositories/provider-gis-repositories.mjs';
import { ProviderOfficialIssueRepository } from '../../server/repositories/official-issue-repository.mjs';

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
        status: 'draft',
        geometry: {
          type: 'LineString',
          coordinates: [[108.945, 34.265], [108.955, 34.275]]
        }
      });
      throw new Error('rollback');
    }),
    /rollback/
  );
  assert.equal(await routes.get('ROUTE-PROVIDER-ROLLBACK'), null);
  assert.equal((await routes.listInBounds(
    '1',
    [108.94, 34.26, 108.96, 34.28],
    { status: 'draft' }
  )).length, 0);

  const boundaries = new ProviderBoundaryRevisionRepository(provider);
  await boundaries.putFromProject({
    id: '1',
    revision: 3,
    scopeBoundary: [[108.94, 34.26], [108.96, 34.26], [108.96, 34.28]],
    scopeBoundaryCrs: 'GCJ02',
    boundaryUpdatedBy: '数据库验收'
  });
  assert.equal((await boundaries.list('1'))[0].projectRevision, 3);

  await routes.put({
    id: 'ROUTE-PROVIDER-IN-BOUNDS',
    projectId: '1',
    status: 'confirmed',
    name: '视口内路线',
    geometry: {
      type: 'LineString',
      coordinates: [[108.945, 34.265], [108.955, 34.275]]
    },
    updatedAt: '2026-07-30T12:01:00Z'
  });
  await routes.put({
    id: 'ROUTE-PROVIDER-OUT-BOUNDS',
    projectId: '1',
    status: 'confirmed',
    name: '视口外路线',
    geometry: {
      type: 'LineString',
      coordinates: [[109.145, 35.265], [109.155, 35.275]]
    },
    updatedAt: '2026-07-30T12:02:00Z'
  });
  const spatialRoutes = await routes.listInBounds(
    '1',
    [108.94, 34.26, 108.96, 34.28],
    { status: 'confirmed' }
  );
  assert.deepEqual(spatialRoutes.map((route) => route.name), ['视口内路线']);
  const issues = new ProviderOfficialIssueRepository(provider);
  await issues.put({
    id: 'ISS-PROVIDER-IN-BOUNDS',
    projectId: '1',
    status: 'active',
    title: '视口内正式问题',
    geometry: { type: 'Point', coordinates: [108.95, 34.27] },
    issueRevision: 1,
    updatedAt: '2026-07-30T12:03:00Z'
  });
  await issues.put({
    id: 'ISS-PROVIDER-OUT-BOUNDS',
    projectId: '1',
    status: 'active',
    title: '视口外正式问题',
    geometry: { type: 'Point', coordinates: [109.15, 35.27] },
    issueRevision: 1,
    updatedAt: '2026-07-30T12:04:00Z'
  });
  assert.deepEqual(
    (await issues.listInBounds('1', [108.94, 34.26, 108.96, 34.28]))
      .map((issue) => issue.title),
    ['视口内正式问题']
  );
  const revisedIssue = await issues.updateGeometry('ISS-PROVIDER-IN-BOUNDS', {
    longitude: 108.951,
    latitude: 34.271,
    crs: 'GCJ02',
    confirmedBy: '数据库验收',
    expectedGeometryRevision: 0
  }, { now: '2026-07-30T12:05:00Z' });
  assert.equal(revisedIssue.geometryRevision, 1);
  assert.deepEqual((await issues.get(revisedIssue.id)).geometry.coordinates, [108.951, 34.271]);
  const plan = provider.explainSpatialQuery(
    'surveyRoutes',
    [108.94, 34.26, 108.96, 34.28],
    { projectId: '1' }
  );
  assert.ok(plan.some((detail) => /VIRTUAL TABLE INDEX/i.test(detail)), plan.join('\n'));
  assert.equal(sqliteProviderCapability(provider).spatialIndex.kind, 'sqlite-rtree');
  assert.ok(sqliteProviderCapability(provider).spatialIndex.indexedRecordCount >= 3);
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
