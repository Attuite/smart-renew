import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coordinateTransformCapability,
  createCoordinateTransform,
  ensureProjectDisplayTransforms,
  gcj02ToWgs84,
  transformGeometry,
  wgs84ToGcj02
} from '../../server/services/coordinate-transform-service.mjs';

test('WGS84 and GCJ02 conversion is deterministic and round trips within meter-scale tolerance', () => {
  const wgs84 = [108.95, 34.27];
  const gcj02 = wgs84ToGcj02(wgs84);
  assert.notDeepEqual(gcj02, wgs84);
  const restored = gcj02ToWgs84(gcj02);
  assert.ok(Math.abs(restored[0] - wgs84[0]) < 1e-6);
  assert.ok(Math.abs(restored[1] - wgs84[1]) < 1e-6);
});

test('geometry conversion preserves structure and polygon closure', () => {
  const geometry = transformGeometry({
    type: 'Polygon',
    coordinates: [[
      [108.94, 34.26],
      [108.96, 34.26],
      [108.96, 34.28],
      [108.94, 34.28]
    ]]
  }, 'WGS84', 'GCJ02');
  assert.equal(geometry.type, 'Polygon');
  assert.deepEqual(geometry.coordinates[0][0], geometry.coordinates[0].at(-1));
});

test('coordinate transform record preserves the original geometry and source lineage', async () => {
  let stored;
  const repository = {
    async put(record) {
      stored = record;
      return record;
    }
  };
  const record = await createCoordinateTransform(repository, {
    projectId: '170000000000001',
    sourceObject: { kind: 'project-boundary', id: '170000000000001', revision: 5 },
    sourceCrs: 'WGS84',
    targetCrs: 'GCJ02',
    geometry: { type: 'Point', coordinates: [108.95, 34.27] },
    transformedBy: 'GIS人员'
  }, {
    id: 'CRSTRANS-fixed-real-001',
    now: '2026-07-30T00:00:00.000Z'
  });
  assert.deepEqual(record.sourceGeometry.coordinates, [108.95, 34.27]);
  assert.notDeepEqual(record.transformedGeometry.coordinates, record.sourceGeometry.coordinates);
  assert.equal(record.sourceObject.revision, 5);
  assert.equal(stored.methodVersion, '1.0.0');
});

test('coordinate transform capability names supported pairs without claiming unknown CRS', () => {
  const capability = coordinateTransformCapability();
  assert.equal(capability.ready, true);
  assert.deepEqual(capability.supportedPairs, [
    ['WGS84', 'GCJ02'],
    ['GCJ02', 'WGS84']
  ]);
});

test('project display preparation creates audited transforms only for pending WGS84 features', async () => {
  const stored = [];
  const dependencies = {
    client: {
      async getProject() {
        return {
          id: '1',
          name: '真实项目',
          revision: 2,
          scopeBoundaryCrs: 'WGS84',
          scopeBoundary: [
            [108.94, 34.26],
            [108.96, 34.26],
            [108.96, 34.28],
            [108.94, 34.28]
          ]
        };
      },
      async listIssues() { return { items: [] }; },
      async listPhotos() { return { items: [] }; }
    },
    issueRepository: { async list() { return []; } },
    photoMetadataRepository: { async list() { return []; } },
    uploadSessionRepository: { async list() { return []; } },
    spatialAnalysisRepository: { async list() { return []; } },
    surveyRouteRepository: { async list() { return []; } },
    surveyStopRepository: { async list() { return []; } },
    coordinateTransformRepository: {
      async list() { return []; },
      async put(value) { stored.push(value); return value; }
    }
  };
  const outcome = await ensureProjectDisplayTransforms(dependencies, '1', {
    transformedBy: 'GIS管理员'
  }, {
    id: 'CRSTRANS-fixed-real-001',
    now: '2026-07-30T06:00:00Z'
  });
  assert.equal(outcome.createdCount, 1);
  assert.equal(stored[0].sourceObject.kind, 'project-boundary');
  assert.equal(stored[0].transformedBy, 'GIS管理员');
});
