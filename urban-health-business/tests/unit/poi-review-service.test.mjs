import test from 'node:test';
import assert from 'node:assert/strict';
import {
  batchReviewPois,
  reviewPoi
} from '../../server/services/poi-review-service.mjs';
import { poiStableId } from '../../server/services/poi-analysis-service.mjs';

test('POI review preserves provider data and appends accountable revision audit', async () => {
  const source = {
    providerId: 'AMAP-REAL-001',
    name: '真实社区服务中心',
    coordinates: [108.95, 34.27],
    providerRaw: { id: 'AMAP-REAL-001', tel: 'hidden-from-widget' }
  };
  let stored;
  const repository = {
    async get() {
      return {
        id: 'SPRUN-real-poi-001',
        projectId: '1',
        type: 'poi-search',
        status: 'completed',
        result: { items: [source] }
      };
    },
    async put(run) {
      stored = run;
      return run;
    }
  };
  const normalizedId = poiStableId(source);
  const item = await reviewPoi(repository, 'SPRUN-real-poi-001', normalizedId, {
    reviewStatus: 'confirmed',
    reviewedBy: 'GIS审核员',
    reviewNote: '现场核实',
    expectedRevision: 0
  }, { now: '2026-07-30T00:00:00.000Z' });
  assert.equal(item.reviewStatus, 'confirmed');
  assert.equal(item.reviewRevision, 1);
  assert.deepEqual(item.providerRaw, source.providerRaw);
  assert.equal(stored.poiReviewAudit.length, 1);
  assert.equal(stored.result.confirmedItemCount, 1);
});

test('stale POI run cannot receive a new formal review', async () => {
  await assert.rejects(
    () => reviewPoi({
      async get() {
        return { id: 'SPRUN-stale-poi-001', type: 'poi-search', status: 'stale' };
      }
    }, 'SPRUN-stale-poi-001', 'POI-any', {
      reviewStatus: 'confirmed',
      reviewedBy: 'GIS审核员'
    }),
    (error) => error.code === 'POI_ANALYSIS_STALE'
  );
});

test('POI batch review validates every revision before one atomic persistence', async () => {
  let stored;
  const run = {
    id: 'SPRUN-REAL-001',
    type: 'poi-search',
    status: 'completed',
    result: {
      items: [
        { id: 'A', name: '设施A', coordinates: [108.95, 34.27], reviewRevision: 0 },
        { id: 'B', name: '设施B', coordinates: [108.951, 34.271], reviewRevision: 0 }
      ]
    }
  };
  const repository = {
    async get() { return run; },
    async put(value) { stored = value; return value; }
  };
  const hydratedIds = (await import('../../server/services/poi-review-service.mjs'))
    .hydratePoiReviewRun(run).result.items.map((item) => item.normalizedId);
  const items = await batchReviewPois(repository, run.id, {
    reviewedBy: 'POI审核员',
    items: hydratedIds.map((normalizedId) => ({
      normalizedId,
      reviewStatus: 'confirmed',
      expectedRevision: 0
    }))
  }, { now: '2026-07-30T05:00:00Z' });
  assert.equal(items.length, 2);
  assert.equal(stored.result.confirmedItemCount, 2);
  assert.equal(stored.poiReviewAudit.length, 2);
  assert.ok(stored.poiReviewAudit.every((item) => item.batch === true));
});
