import test from 'node:test';
import assert from 'node:assert/strict';
import { runPoiAnalysis } from '../../server/services/poi-analysis-service.mjs';

function clientWithProject(overrides = {}) {
  return {
    async getProject() {
      return {
        id: '170000000000001',
        revision: 7,
        scopeBoundaryCrs: 'GCJ02',
        scopeCenter: [108.95, 34.27],
        boundaryUpdatedAt: '2026-07-26T00:00:00.000Z',
        ...overrides
      };
    }
  };
}

test('POI analysis preserves raw provider rows and records deterministic cleaning provenance', async () => {
  let stored = null;
  const provider = {
    async searchAround({ keywords }) {
      if (keywords !== '小区') return { count: 0, items: [] };
      return {
        count: 4,
        items: [
          {
            id: 'POI-A',
            name: '幸福花园',
            address: '测试路1号',
            type: '住宅小区',
            location: '108.951,34.27',
            distance: '92'
          },
          {
            id: 'POI-A',
            name: '幸福花园',
            address: '测试路1号',
            type: '住宅小区',
            location: '108.951,34.27',
            distance: '92'
          },
          {
            id: 'POI-B',
            name: '幸福花园东门',
            address: '测试路1号',
            type: '住宅区出入口',
            location: '108.95101,34.27001',
            distance: '93'
          },
          {
            id: 'POI-C',
            name: '幸福花园售楼处',
            address: '测试路2号',
            type: '售楼处',
            location: '108.952,34.27',
            distance: '184'
          }
        ]
      };
    }
  };
  const run = await runPoiAnalysis(
    clientWithProject(),
    {
      async put(value) {
        stored = value;
        return value;
      }
    },
    provider,
    '170000000000001',
    {
      category: 'residential',
      keywords: '小区',
      radiusMeters: 1000,
      createdBy: 'GIS测试员'
    },
    {
      id: 'SPRUN-fixed-poi',
      now: '2026-07-26T01:00:00.000Z'
    }
  );

  assert.equal(run.type, 'poi-search');
  assert.equal(run.rawPois.length, 4);
  assert.equal(run.cleaning.rawCount, 4);
  assert.equal(run.cleaning.mergedCount, 1);
  assert.equal(run.cleaning.rejectedCount, 2);
  assert.equal(run.result.items[0].sourceCount, 2);
  assert.equal(run.providerSnapshot.coordinateSystem, 'GCJ-02');
  assert.equal(run.sourceSnapshot.projectRevision, 7);
  assert.equal(stored.createdBy, 'GIS测试员');
});

test('POI analysis blocks WGS84 and GCJ-02 mixing until coordinate conversion exists', async () => {
  await assert.rejects(
    () => runPoiAnalysis(
      clientWithProject({ scopeBoundaryCrs: 'WGS84' }),
      {},
      {},
      '170000000000001',
      { radiusMeters: 1000, createdBy: 'GIS测试员' }
    ),
    (error) => error.code === 'POI_PROJECT_CRS_MISMATCH' && error.status === 409
  );
});

test('residential POI search clips accepted results to the real project boundary', async () => {
  const run = await runPoiAnalysis(
    clientWithProject({
      scopeBoundary: [
        [108.949, 34.269],
        [108.952, 34.269],
        [108.952, 34.272],
        [108.949, 34.272]
      ]
    }),
    { async put(value) { return value; } },
    {
      async searchAround({ keywords }) {
        return keywords === '小区'
          ? {
              count: 2,
              items: [
                { id: 'IN', name: '边界内花园', location: '108.951,34.270', distance: '92' },
                { id: 'OUT', name: '边界外花园', location: '108.960,34.270', distance: '920' }
              ]
            }
          : { count: 0, items: [] };
      }
    },
    '170000000000001',
    {
      category: 'residential',
      keywords: '小区',
      radiusMeters: 1000,
      createdBy: 'GIS测试员'
    }
  );
  assert.equal(run.parameters.boundaryOnly, true);
  assert.deepEqual(run.result.items.map((item) => item.providerId), ['IN']);
  assert.equal(run.result.rejected[0].reason, 'OUTSIDE_PROJECT_BOUNDARY');
});
