import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAnalysisResult,
  parseModelContent,
  summarizeCandidates
} from '../../server/services/analysis-service.mjs';

test('AI candidates are derived only from the returned JSON', () => {
  const parsed = parseModelContent('```json\n{"summary":"实测","issues":[{"severity":"high","categoryCode":"FIRE","title":"通道堆物","imageIndex":2,"bbox":[10,20,300,400],"confidence":0.86}]}\n```');
  const result = normalizeAnalysisResult(parsed, {
    analysisId: '170000000000003',
    photoIds: ['PHOTO-A', 'PHOTO-B'],
    now: '2026-07-26T00:00:00.000Z'
  });

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].photoId, 'PHOTO-B');
  assert.equal(result.issues[0].reviewStatus, 'pending');
  assert.deepEqual(result.issues[0].bbox, [10, 20, 300, 400]);
});

test('risk distribution and confidence are calculated from real candidates', () => {
  const summary = summarizeCandidates([
    { severity: 'high', confidence: 0.9 },
    { severity: 'medium', confidence: 0.7 },
    { severity: 'low', confidence: null }
  ]);

  assert.deepEqual(summary.risk, { high: 1, medium: 1, low: 1 });
  assert.equal(summary.total, 3);
  assert.equal(summary.averageConfidence, 0.8);
});

test('invalid model response cannot create fallback candidates', () => {
  assert.throws(
    () => parseModelContent('not json'),
    (error) => error.code === 'AI_RESPONSE_INVALID'
  );
});
