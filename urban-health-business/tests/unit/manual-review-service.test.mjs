import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualIssue, finalizeManualReview } from '../../server/services/manual-review-service.mjs';

function fakeClient() {
  return {
    async getProject() {
      return { id: '170000000000001', revision: 4 };
    },
    async listPhotos() { return { items: [{ id: 'PHOTO-001' }] }; },
    async listIssues() { return { items: [] }; }
  };
}

test('manual issue enables evidence-based review without an AI analysis', async () => {
  let stored = null;
  const issue = await createManualIssue(fakeClient(), {
    async put(value) {
      stored = value;
      return value;
    }
  }, '170000000000001', {
    title: '单元门损坏',
    description: '闭门器脱落',
    severity: 'medium',
    originalPhotoId: 'PHOTO-001',
    recordedBy: '巡检员'
  }, {
    id: 'ISS-MAN-fixed-issue',
    now: '2026-07-26T00:00:00.000Z'
  });

  assert.equal(issue.source, 'manual');
  assert.equal(issue.analysisId, null);
  assert.equal(issue.issueRevision, 1);
  assert.equal(stored.auditTrail[0].action, 'manual_create');
});

test('zero-issue manual conclusion requires explicit confirmation and is idempotent', async () => {
  const sessions = [];
  const sessionRepository = {
    async findByClientRequest(_projectId, clientRequestId) {
      return sessions.find((item) => item.clientRequestId === clientRequestId) || null;
    },
    async put(value) {
      sessions.push(value);
      return value;
    }
  };
  const input = {
    reviewerName: '复核员',
    zeroIssueConfirmed: true,
    clientRequestId: 'manual-review-001'
  };
  const first = await finalizeManualReview(fakeClient(), { async list() { return []; } }, sessionRepository, '170000000000001', input, {
    id: 'REV-MAN-fixed-review',
    now: '2026-07-26T00:00:00.000Z'
  });
  const second = await finalizeManualReview(fakeClient(), { async list() { return []; } }, sessionRepository, '170000000000001', input);

  assert.equal(first.session.issueCount, 0);
  assert.equal(first.session.zeroIssueConfirmed, true);
  assert.equal(second.duplicated, true);
  assert.equal(second.session.id, first.session.id);
});

test('zero-issue manual conclusion cannot be implied', async () => {
  await assert.rejects(
    () => finalizeManualReview(
      fakeClient(),
      { async list() { return []; } },
      { async findByClientRequest() { return null; } },
      '170000000000001',
      { reviewerName: '复核员', zeroIssueConfirmed: false }
    ),
    (error) => error.code === 'ZERO_ISSUE_CONFIRMATION_REQUIRED'
  );
});
