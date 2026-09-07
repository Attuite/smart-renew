import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SpatialAnalysisRepository } from '../../server/repositories/spatial-analysis-repository.mjs';
import { MapSnapshotRepository } from '../../server/repositories/map-snapshot-repository.mjs';
import { buildProjectMapView } from '../../server/services/map-view-service.mjs';
import { createMapSnapshot } from '../../server/services/map-snapshot-service.mjs';

const project = {
  id: '170000000000099',
  name: 'GIS容量项目',
  revision: 3,
  scopeBoundaryCrs: 'GCJ02',
  scopeBoundary: [
    [108.94, 34.26],
    [108.97, 34.26],
    [108.97, 34.29],
    [108.94, 34.29]
  ]
};

function capacityMapView() {
  return buildProjectMapView({
    project,
    issues: [{
      id: 'ISS-CAPACITY-MAP-SNAPSHOT',
      title: '容量快照真实问题',
      severity: 'high',
      status: 'active',
      geometry: { type: 'Point', coordinates: [108.95, 34.27] },
      geometryCrs: 'GCJ02',
      geometryRevision: 1,
      issueRevision: 1
    }],
    photos: [],
    routes: [],
    stops: [],
    spatialAnalyses: []
  }, { limit: 5000 });
}

async function temporaryRoot(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())));
  return root;
}

test('100 persisted spatial runs remain selectable through the bounded map read model', async () => {
  const root = await temporaryRoot('urban-health-spatial-capacity-');
  try {
    const repository = new SpatialAnalysisRepository(path.join(root, 'runs'));
    const runs = Array.from({ length: 100 }, (_, index) => ({
      id: `SPRUN-CAPACITY-${String(index + 1).padStart(4, '0')}`,
      projectId: project.id,
      type: 'issue-radius',
      status: 'completed',
      parameters: {
        center: [108.95, 34.27],
        radiusMeters: 100 + index
      },
      result: {
        items: [],
        distances: []
      },
      completedAt: new Date(Date.UTC(2026, 6, 30, 0, 0, index)).toISOString()
    }));
    await Promise.all(runs.map((run) => repository.put(run)));

    const persisted = await repository.list(project.id);
    assert.equal(persisted.length, 100);
    assert.equal(persisted[0].id, 'SPRUN-CAPACITY-0100');
    assert.equal(persisted.at(-1).id, 'SPRUN-CAPACITY-0001');

    const view = buildProjectMapView({ project, spatialAnalyses: persisted }, { limit: 5000 });
    assert.equal(view.spatialAnalyses.total, 100);
    assert.equal(view.spatialAnalyses.items.length, 100);
    assert.equal(view.spatialAnalyses.truncated, false);
    assert.ok(view.spatialAnalyses.items.every((run) => run.result.items.length === 0));

    const selected = buildProjectMapView({ project, spatialAnalyses: persisted }, {
      spatialRunId: 'SPRUN-CAPACITY-0042',
      limit: 5000
    });
    assert.equal(selected.spatialAnalyses.total, 1);
    assert.equal(selected.spatialAnalyses.items[0].id, 'SPRUN-CAPACITY-0042');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('50 map snapshots persist metadata and SVG content with bounded pagination', async () => {
  const root = await temporaryRoot('urban-health-map-snapshot-capacity-');
  try {
    const repository = new MapSnapshotRepository(
      path.join(root, 'metadata'),
      path.join(root, 'content')
    );
    const dependencies = {
      reportRepository: { async get() { return null; } },
      mapViewDependencies: {},
      mapSnapshotRepository: repository
    };
    const view = capacityMapView();
    const snapshots = [];
    for (let index = 0; index < 50; index += 1) {
      snapshots.push(await createMapSnapshot(dependencies, project.id, {
        purpose: 'audit',
        mapStyle: index % 2 === 0 ? 'dark' : 'light',
        createdBy: '容量测试人员'
      }, {
        id: `MAPSNAP-capacity-${String(index + 1).padStart(4, '0')}`,
        now: new Date(Date.UTC(2026, 6, 30, 1, 0, index)).toISOString(),
        mapView: view
      }));
    }

    assert.equal(snapshots.length, 50);
    assert.ok(snapshots.every((snapshot) => snapshot.status === 'generated'));
    assert.ok(snapshots.every((snapshot) => snapshot.contentHash.length === 64));

    const firstPage = await repository.list(project.id, '', { limit: 25 });
    const secondPage = await repository.list(project.id, '', { limit: 25, offset: 25 });
    assert.equal(firstPage.length, 25);
    assert.equal(secondPage.length, 25);
    assert.equal(new Set([...firstPage, ...secondPage].map((item) => item.id)).size, 50);
    assert.equal(firstPage[0].id, 'MAPSNAP-capacity-0050');
    assert.equal(secondPage.at(-1).id, 'MAPSNAP-capacity-0001');

    const contents = await Promise.all(snapshots.map((snapshot) => repository.readContent(snapshot.id)));
    assert.ok(contents.every((content) => content?.startsWith('<svg')));
    assert.ok(contents.every((content) => content.includes('GIS容量项目')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
