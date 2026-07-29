import test from 'node:test';
import assert from 'node:assert/strict';
import {
  annotationPlan,
  bboxPercentStyle,
  normalizeBbox
} from '../../apps/business/src/review/annotation.js';

test('bbox coordinates are clamped and rendered as percentages', () => {
  assert.deepEqual(normalizeBbox([-20, 100, 1200, 700]), [0, 100, 999, 700]);
  assert.equal(
    bboxPercentStyle([100, 200, 600, 800]),
    'left:10.01%;top:20.02%;width:50.05%;height:60.06%'
  );
  assert.equal(bboxPercentStyle(null), '');
});

test('annotation plan maps normalized coordinates to canvas pixels', () => {
  const plan = annotationPlan([{
    id: 'CAND-1',
    bbox: [100, 200, 600, 800],
    severity: 'high',
    categoryName: '外墙风险'
  }, {
    id: 'CAND-NO-BOX',
    bbox: null
  }], 999, 999);

  assert.equal(plan.length, 1);
  assert.equal(plan[0].candidateId, 'CAND-1');
  assert.equal(plan[0].x, 100);
  assert.equal(plan[0].y, 200);
  assert.ok(Math.abs(plan[0].width - 500) < 1e-9);
  assert.equal(plan[0].height, 600);
  assert.equal(plan[0].color, '#dc2626');
  assert.equal(plan[0].label, '外墙风险');
});
