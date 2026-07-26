import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindIssueGeometry,
  pointInPolygon
} from '../../server/services/spatial-binding-service.mjs';

const boundary = [
  [108.94, 34.26],
  [108.96, 34.26],
  [108.96, 34.28],
  [108.94, 34.28]
];

test('point-in-polygon includes interior and boundary points', () => {
  assert.equal(pointInPolygon([108.95, 34.27], boundary), true);
  assert.equal(pointInPolygon([108.94, 34.27], boundary), true);
  assert.equal(pointInPolygon([109, 34.27], boundary), false);
});

test('issue geometry binding requires the real project boundary and matching CRS', async () => {
  let saved = null;
  const repository = {
    async get() { return { id: 'ISS-1', projectId: '1001' }; },
    async updateGeometry(issueId, input) {
      saved = { issueId, input };
      return saved;
    }
  };
  const client = {
    async getProject() {
      return { id: '1001', scopeBoundary: boundary, scopeBoundaryCrs: 'WGS84' };
    }
  };
  const result = await bindIssueGeometry(client, repository, 'ISS-1', {
    longitude: 108.95,
    latitude: 34.27,
    crs: 'WGS84',
    confirmedBy: 'GIS人员'
  });
  assert.equal(result.issueId, 'ISS-1');
  assert.deepEqual(saved.input.longitude, 108.95);

  await assert.rejects(
    () => bindIssueGeometry(client, repository, 'ISS-1', {
      longitude: 108.95,
      latitude: 34.27,
      crs: 'GCJ02',
      confirmedBy: 'GIS人员'
    }),
    (error) => error.code === 'SPATIAL_CRS_MISMATCH'
  );
});

test('issue point outside project boundary is rejected before persistence', async () => {
  let writes = 0;
  const repository = {
    async get() { return { id: 'ISS-1', projectId: '1001' }; },
    async updateGeometry() { writes += 1; }
  };
  await assert.rejects(
    () => bindIssueGeometry({
      async getProject() {
        return { id: '1001', scopeBoundary: boundary, scopeBoundaryCrs: 'WGS84' };
      }
    }, repository, 'ISS-1', {
      longitude: 109,
      latitude: 34.27,
      crs: 'WGS84',
      confirmedBy: 'GIS人员'
    }),
    (error) => error.code === 'ISSUE_OUTSIDE_PROJECT_BOUNDARY'
  );
  assert.equal(writes, 0);
});
