import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineMeters, runIssueRadiusAnalysis } from '../../server/services/spatial-analysis-service.mjs';

test('haversine distance uses real geographic coordinates', () => {
  const meters = haversineMeters([108.95, 34.27], [108.951, 34.27]);
  assert.ok(meters > 90 && meters < 95);
});

test('radius analysis uses user parameter and persists a reproducible source snapshot', async () => {
  let stored = null;
  const run = await runIssueRadiusAnalysis({
    async getProject() {
      return {
        id: '170000000000001',
        revision: 5,
        boundaryCenter: [108.95, 34.27]
      };
    },
    async listIssues() {
      return { items: [] };
    }
  }, {
    async list() {
      return [
        {
          id: 'ISS-NEAR',
          geometry: { type: 'Point', coordinates: [108.951, 34.27] },
          issueRevision: 2
        },
        {
          id: 'ISS-FAR',
          geometry: { type: 'Point', coordinates: [109, 34.27] },
          issueRevision: 1
        }
      ];
    }
  }, {
    async put(value) {
      stored = value;
      return value;
    }
  }, '170000000000001', {
    radiusMeters: 150,
    createdBy: 'GIS人员'
  }, {
    id: 'SPRUN-fixed-analysis',
    now: '2026-07-26T00:00:00.000Z'
  });

  assert.equal(run.parameters.radiusMeters, 150);
  assert.deepEqual(run.result.matchedIssueIds, ['ISS-NEAR']);
  assert.equal(run.sourceSnapshot.projectRevision, 5);
  assert.equal(stored.sourceSnapshot.locatedIssueCount, 2);
});

test('radius analysis never substitutes fixed demo radii', async () => {
  await assert.rejects(
    () => runIssueRadiusAnalysis({
      async getProject() { return { id: '170000000000001', boundaryCenter: [108.95, 34.27] }; },
      async listIssues() { return { items: [] }; }
    }, {
      async list() { return []; }
    }, {}, '170000000000001', {
      radiusMeters: 20
    }),
    (error) => error.code === 'INVALID_ANALYSIS_RADIUS'
  );
});

test('spatial analysis requires an accountable operator', async () => {
  await assert.rejects(
    () => runIssueRadiusAnalysis({
      async getProject() { return { id: '170000000000001', boundaryCenter: [108.95, 34.27] }; },
      async listIssues() { return { items: [] }; }
    }, {
      async list() { return []; }
    }, {}, '170000000000001', {
      radiusMeters: 500
    }),
    (error) => error.code === 'SPATIAL_ANALYSIS_CREATOR_REQUIRED'
  );
});
