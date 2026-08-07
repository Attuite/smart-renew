import assert from 'node:assert/strict';
import test from 'node:test';
import { LegacyCapabilityRegistry } from '../../server/adapters/smart-renew/capabilities.mjs';
import { mergePrimaryReadModel } from '../../server/adapters/smart-renew/read-model-policy.mjs';
import {
  assertPrimarySource,
  sourceOfTruthFor,
  sourceOfTruthSnapshot
} from '../../server/adapters/smart-renew/source-of-truth.mjs';

test('legacy capability registry distinguishes available, degraded and unavailable states', () => {
  const registry = new LegacyCapabilityRegistry();
  const available = registry.snapshot({ upstreamReady: true });
  assert.equal(available.projectData.status, 'available');
  assert.equal(available.fieldCollection.mode, 'read-write');
  assert.equal(available.reportSnapshots.status, 'degraded');
  assert.equal(available.reportSnapshots.mode, 'read-only');
  assert.equal(available.officialIssues.sourceOfTruth, 'business');

  const unavailable = registry.snapshot({
    upstreamReady: false,
    upstreamError: { code: 'UPSTREAM_TIMEOUT' }
  });
  assert.equal(unavailable.projectData.status, 'unavailable');
  assert.equal(unavailable.projectData.reason, 'UPSTREAM_TIMEOUT');
});

test('source-of-truth registry rejects writes to a secondary source', () => {
  assert.equal(sourceOfTruthFor('report').primary, 'business');
  assert.equal(sourceOfTruthFor('project').primary, 'smart-renew');
  assert.equal(sourceOfTruthSnapshot().officialIssue.legacyRole, 'read-only-and-explicit-migration');
  assert.equal(assertPrimarySource('report', 'business').primary, 'business');
  assert.throws(
    () => assertPrimarySource('report', 'smart-renew'),
    (error) => error.code === 'SOURCE_OF_TRUTH_VIOLATION'
  );
});

test('business primary records override same-id legacy records without double counting', () => {
  const merged = mergePrimaryReadModel('officialIssue', {
    legacyItems: [
      { id: 'ISSUE-1', title: '旧标题' },
      { id: 'ISSUE-2', title: '仅旧记录' }
    ],
    businessItems: [
      { id: 'ISSUE-1', title: 'Business标题' }
    ]
  });
  assert.equal(merged.length, 2);
  assert.equal(merged.find((item) => item.id === 'ISSUE-1').title, 'Business标题');
});
