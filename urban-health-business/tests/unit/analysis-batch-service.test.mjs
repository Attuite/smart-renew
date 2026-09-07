import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateAnalysisUsage,
  bboxIoU,
  createAnalysisBatches,
  deduplicateAnalysisCandidates,
  mergeAnalysisBatchResults,
  normalizeCandidateTitle
} from '../../server/services/analysis-batch-service.mjs';

test('analysis photos split into deterministic groups of twenty', () => {
  const photoIds = Array.from({ length: 45 }, (_, index) => `PHOTO-${index + 1}`);
  const photoSnapshot = photoIds.map((id) => ({ id, contentHash: `hash-${id}` }));
  const batches = createAnalysisBatches(photoIds, photoSnapshot);

  assert.deepEqual(batches.map((batch) => batch.photoIds.length), [20, 20, 5]);
  assert.deepEqual(batches.map((batch) => batch.id), ['BATCH-001', 'BATCH-002', 'BATCH-003']);
  assert.equal(batches[1].offset, 20);
  assert.equal(batches[2].photoSnapshot[4].id, 'PHOTO-45');
});

test('candidate title normalization and bbox IoU preserve original deduplication behavior', () => {
  assert.equal(normalizeCandidateTitle(' 外墙裂缝隐患。 '), '外墙裂缝');
  assert.ok(bboxIoU([100, 100, 400, 400], [120, 120, 420, 420]) > 0.7);
  assert.equal(bboxIoU(null, [100, 100, 400, 400]), 0);
});

test('same-photo same-category candidates merge by title or bbox without crossing evidence', () => {
  const candidates = [
    {
      id: 'CAND-A',
      photoId: 'PHOTO-1',
      categoryCode: 'FACADE',
      title: '外墙裂缝问题',
      bbox: [100, 100, 400, 400],
      confidence: 0.7,
      desc: '短描述',
      evidence: '短证据',
      sourceBatchId: 'BATCH-001',
      sourceAnalysisId: 'ANL-1'
    },
    {
      id: 'CAND-B',
      photoId: 'PHOTO-1',
      categoryCode: 'FACADE',
      title: '外墙裂缝隐患',
      bbox: [700, 700, 900, 900],
      confidence: 0.91,
      desc: '更完整的裂缝问题描述',
      evidence: '更完整的可见裂缝证据',
      sourceBatchId: 'BATCH-001',
      sourceAnalysisId: 'ANL-1'
    },
    {
      id: 'CAND-C',
      photoId: 'PHOTO-2',
      categoryCode: 'FACADE',
      title: '外墙裂缝隐患',
      bbox: [100, 100, 400, 400],
      confidence: 0.8,
      sourceBatchId: 'BATCH-002',
      sourceAnalysisId: 'ANL-2'
    },
    {
      id: 'CAND-D',
      photoId: 'PHOTO-1',
      categoryCode: 'STRUCTURE',
      title: '外墙裂缝隐患',
      bbox: [100, 100, 400, 400],
      confidence: 0.8,
      sourceBatchId: 'BATCH-002',
      sourceAnalysisId: 'ANL-2'
    }
  ];

  const merged = deduplicateAnalysisCandidates(candidates);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].confidence, 0.91);
  assert.equal(merged[0].mergedCount, 2);
  assert.equal(merged[0].desc, '更完整的裂缝问题描述');
  assert.deepEqual(merged[0].duplicateCandidateIds, ['CAND-B']);
});

test('batch results merge summaries, candidates and model metadata', () => {
  const outcome = mergeAnalysisBatchResults([
    {
      batch: { id: 'BATCH-001', batchIndex: 1, offset: 0, photoIds: ['PHOTO-1'] },
      analysis: {
        id: 'ANL-1',
        model: 'mock-vl',
        modelRequestId: 'REQ-1',
        usage: { input_tokens: 10, nested: { image_tokens: 4 } },
        promptVersion: 'prompt-v1',
        result: {
          summary: '第一批。',
          issues: [{
            id: 'CAND-1',
            photoId: 'PHOTO-1',
            imageIndex: 1,
            categoryCode: 'FACADE',
            title: '外墙裂缝问题',
            bbox: [100, 100, 400, 400]
          }]
        }
      }
    },
    {
      batch: { id: 'BATCH-002', batchIndex: 2, offset: 20, photoIds: ['PHOTO-21'] },
      analysis: {
        id: 'ANL-2',
        model: 'mock-vl',
        modelRequestId: 'REQ-2',
        usage: { input_tokens: 12, nested: { image_tokens: 5 } },
        promptVersion: 'prompt-v1',
        result: {
          summary: '第二批。',
          issues: [{
            id: 'CAND-2',
            photoId: 'PHOTO-21',
            imageIndex: 1,
            categoryCode: 'ROAD_ACCESS',
            title: '道路破损',
            bbox: [200, 200, 500, 500]
          }]
        }
      }
    }
  ]);

  assert.equal(outcome.result.summary, '第一批。 第二批。');
  assert.equal(outcome.result.issues[1].globalImageIndex, 21);
  assert.deepEqual(outcome.requestIds, ['REQ-1', 'REQ-2']);
  assert.deepEqual(outcome.models, ['mock-vl']);
  assert.deepEqual(outcome.promptVersions, ['prompt-v1']);
  assert.deepEqual(outcome.usage, {
    input_tokens: 22,
    nested: { image_tokens: 9 }
  });
  assert.deepEqual(aggregateAnalysisUsage([{ total: 3 }, { total: 4 }]), { total: 7 });
});
