import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMapSnapshot,
  markMapSnapshotStaleness,
  renderMapSnapshotSvg
} from '../../server/services/map-snapshot-service.mjs';
import { ProviderMapSnapshotRepository } from '../../server/repositories/map-snapshot-repository.mjs';

function realMapView() {
  return {
    project: { id: '1', name: '真实项目', revision: 3 },
    viewport: { targetCrs: 'GCJ02' },
    boundary: {
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [108.95, 34.27],
          [108.96, 34.27],
          [108.96, 34.28],
          [108.95, 34.27]
        ]]
      }
    },
    issues: {
      items: [{
        id: 'ISS-REAL-001',
        geometry: { type: 'Point', coordinates: [108.955, 34.275] },
        properties: { title: '真实问题', severity: 'high' }
      }]
    },
    photos: { items: [] },
    routes: { items: [] },
    stops: { items: [] },
    spatialAnalyses: {
      items: [{
        id: 'SPRUN-REAL-001',
        status: 'completed',
        parameters: { center: [108.954, 34.274], radiusMeters: 650 },
        result: {
          distances: [{
            issueId: 'ISS-REAL-001',
            coordinates: [108.955, 34.275],
            distanceMeters: 144.2
          }]
        }
      }]
    },
    sourceRevisions: {
      projectRevision: 3,
      issueRevisions: [{ id: 'ISS-REAL-001', geometryRevision: 2 }]
    }
  };
}

test('map snapshot SVG is deterministic and contains only supplied real records', () => {
  const first = renderMapSnapshotSvg(realMapView(), { mapStyle: 'dark' });
  const second = renderMapSnapshotSvg(realMapView(), { mapStyle: 'dark' });
  assert.equal(first.content, second.content);
  assert.match(first.content, /真实项目/);
  assert.match(first.content, /真实问题/);
  assert.match(first.content, /650米/);
  assert.match(first.content, /144\.2米/);
  assert.doesNotMatch(first.content, /MAP-\d|42个问题|xian-city-map/);
});

test('map snapshot persists queued-to-generated lifecycle and content hash', async () => {
  const records = [];
  let content = '';
  const snapshot = await createMapSnapshot({
    reportRepository: { async get() { return null; } },
    mapViewDependencies: {},
    mapSnapshotRepository: {
      async put(value) {
        records.push(structuredClone(value));
        return value;
      },
      async writeContent(id, value) {
        content = value;
        return `${id}.svg`;
      }
    }
  }, '1', {
    purpose: 'audit',
    createdBy: '审计人员'
  }, {
    id: 'MAPSNAP-fixed-real-001',
    now: '2026-07-30T04:00:00Z',
    mapView: realMapView()
  }).catch((error) => {
    // createMapSnapshot normally reads the map view service. The service-level
    // dependency below is replaced in the report-backed test path.
    throw error;
  });
  assert.equal(snapshot.status, 'generated');
  assert.equal(records[0].status, 'queued');
  assert.equal(records.at(-1).status, 'generated');
  assert.equal(snapshot.contentHash.length, 64);
  assert.match(content, /^<svg/);
});

test('report-backed map snapshot uses frozen report geometry', async () => {
  const records = [];
  const report = {
    id: 'RPT-BIZ-1-0001',
    projectId: '1',
    title: '冻结报告',
    reportRevision: 1,
    contentSnapshot: {
      project: {
        name: '报告生成时项目',
        boundaryGeometry: realMapView().boundary.geometry,
        boundaryCrs: 'WGS84',
        projectRevision: 3
      },
      issues: [{
        id: 'ISS-REAL-001',
        title: '冻结问题',
        severity: 'high',
        geometry: [108.955, 34.275]
      }],
      spatialAnalyses: []
    },
    dataSnapshot: {
      issueRevisions: [{ id: 'ISS-REAL-001', geometryRevision: 2 }]
    }
  };
  let rendered = '';
  const snapshot = await createMapSnapshot({
    reportRepository: { async get() { return report; } },
    mapViewDependencies: null,
    mapSnapshotRepository: {
      async put(value) { records.push(value); return value; },
      async writeContent(_id, value) { rendered = value; return 'snapshot.svg'; }
    }
  }, '1', {
    reportId: report.id,
    purpose: 'report',
    createdBy: '报告人员'
  }, {
    id: 'MAPSNAP-fixed-real-002',
    now: '2026-07-30T04:00:00Z'
  });
  assert.equal(snapshot.reportId, report.id);
  assert.equal(snapshot.sourceRevisions.reportRevision, 1);
  assert.match(rendered, /冻结问题/);
  assert.equal(records.at(-1).status, 'generated');
});

test('unfrozen map snapshot becomes stale while report snapshot stays frozen', () => {
  const snapshots = [{
    id: 'MAPSNAP-fixed-real-001',
    reportId: null,
    status: 'generated',
    sourceRevisions: {
      projectRevision: 3,
      issueRevisions: [{ id: 'ISS-1', geometryRevision: 1 }],
      photoRevisions: [],
      routeRevisions: []
    }
  }, {
    id: 'MAPSNAP-fixed-real-002',
    reportId: 'RPT-BIZ-1-0001',
    status: 'generated',
    sourceRevisions: { projectRevision: 3 }
  }];
  const current = {
    sourceRevisions: {
      projectRevision: 4,
      issueRevisions: [{ id: 'ISS-1', geometryRevision: 2 }],
      photoRevisions: [],
      routeRevisions: []
    }
  };
  const marked = markMapSnapshotStaleness(snapshots, current);
  assert.equal(marked[0].status, 'stale');
  assert.ok(marked[0].staleReasons.includes('ISSUE_GEOMETRY_CHANGED'));
  assert.equal(marked[1].status, 'generated');
});

test('map snapshot provider adapter stores metadata and SVG through formal providers', async () => {
  const records = new Map();
  const objects = new Map();
  const repository = new ProviderMapSnapshotRepository({
    async put(_entity, value) { records.set(value.id, value); return value; },
    async get(_entity, id) { return records.get(id) || null; },
    async list() { return [...records.values()]; }
  }, {
    async upload(input) {
      objects.set(input.path, input.bytes);
      return { id: input.path, path: input.path };
    },
    async download(reference) {
      return { bytes: objects.get(reference.id), contentType: 'image/svg+xml' };
    }
  });
  const objectKey = await repository.writeContent(
    'MAPSNAP-fixed-real-003',
    '<svg>provider</svg>'
  );
  await repository.put({
    id: 'MAPSNAP-fixed-real-003',
    projectId: '1',
    objectKey,
    createdAt: '2026-07-30T06:00:00Z'
  });
  assert.equal(await repository.readContent('MAPSNAP-fixed-real-003'), '<svg>provider</svg>');
  assert.equal((await repository.list('1')).length, 1);
});
