import test from 'node:test';
import assert from 'node:assert/strict';
import { OfficialIssueRepository, officialIssueFromCandidate } from '../../server/repositories/official-issue-repository.mjs';

test('business official issue does not require indicator mapping', () => {
  const issue = officialIssueFromCandidate({
    id: 'CAND-170000000000004-0001',
    photoId: 'PHOTO-REAL-001',
    imageIndex: 1,
    title: '现场可见问题',
    severity: 'medium',
    confidence: 0.74,
    annotatedPhotoId: 'PHOTO-ANNOTATED-001',
    annotationUploadSessionId: 'UPL-annotation-session',
    reviewStatus: 'accepted'
  }, {
    id: '170000000000004',
    projectId: '170000000000001',
    photoIds: ['PHOTO-REAL-001']
  }, '复核员', {
    now: '2026-07-26T00:00:00.000Z'
  });

  assert.equal(issue.indicatorCode, null);
  assert.equal(issue.indicatorBindingStatus, 'not_integrated');
  assert.equal(issue.originalPhotoId, 'PHOTO-REAL-001');
  assert.equal(issue.annotatedPhotoId, 'PHOTO-ANNOTATED-001');
  assert.equal(issue.annotationUploadSessionId, 'UPL-annotation-session');
  assert.equal(issue.reviewStatus, 'confirmed');
});

test('official issue details use optimistic revision and append an audit entry', async () => {
  const repository = new OfficialIssueRepository('unused');
  repository.get = async () => ({
    id: 'ISS-REAL-001',
    title: '原标题',
    severity: 'medium',
    issueRevision: 2,
    auditTrail: [{ revision: 1, action: 'manual_create' }]
  });
  repository.put = async (issue) => issue;

  await assert.rejects(
    () => repository.updateDetails('ISS-REAL-001', {
      title: '冲突修改',
      expectedRevision: 1,
      updatedBy: '复核员'
    }),
    (error) => error.code === 'ISSUE_REVISION_CONFLICT'
  );

  const updated = await repository.updateDetails('ISS-REAL-001', {
    title: '修正标题',
    severity: 'high',
    expectedRevision: 2,
    updatedBy: '复核员'
  }, { now: '2026-07-26T01:00:00.000Z' });
  assert.equal(updated.issueRevision, 3);
  assert.equal(updated.title, '修正标题');
  assert.equal(updated.auditTrail.at(-1).actor, '复核员');
});
