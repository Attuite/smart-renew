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

test('standard binding derives fields, freezes remediation and supports explicit unbinding', async () => {
  const repository = new OfficialIssueRepository('unused');
  repository.get = async () => ({
    id: 'ISS-REAL-001',
    issueRevision: 2,
    problemCode: null,
    indicatorCode: null,
    bindingStatus: 'unbound',
    auditTrail: [],
    bindingAudit: []
  });
  repository.put = async (issue) => issue;

  const bound = await repository.updateStandardBinding('ISS-REAL-001', {
    bindingStatus: 'confirmed',
    updatedBy: '复核员',
    expectedRevision: 2,
    resolvedBinding: {
      standardLibraryVersion: '城市体检标准库@1.0.0@2026-07-24T00:00:00.000Z',
      problemType: { code: 'PRB-01-01', name: '混凝土结构构件裂缝' },
      indicator: { code: 'IND-HOUSE-001', name: '存在结构安全隐患的住宅数量' },
      remediation: {
        id: 'REM-PRB-01-01-1',
        problemCode: 'PRB-01-01',
        text: '专业鉴定并加固',
        type: 'urgent',
        responsibleUnit: '小区物业/房屋管理',
        standardLibraryVersion: '城市体检标准库@1.0.0@2026-07-24T00:00:00.000Z'
      }
    }
  }, { now: '2026-08-09T01:00:00.000Z' });
  assert.equal(bound.issueRevision, 3);
  assert.equal(bound.problemCode, 'PRB-01-01');
  assert.equal(bound.indicatorCode, 'IND-HOUSE-001');
  assert.equal(bound.bindingStatus, 'confirmed');
  assert.equal(bound.remediationSnapshot.text, '专业鉴定并加固');
  assert.equal(bound.bindingAudit.at(-1).action, 'binding_confirmed');
  assert.equal(bound.bindingAudit.at(-1).after.indicatorCode, 'IND-HOUSE-001');

  repository.get = async () => bound;
  const cleared = await repository.updateStandardBinding('ISS-REAL-001', {
    bindingStatus: 'unbound',
    updatedBy: '复核员',
    expectedRevision: 3
  });
  assert.equal(cleared.issueRevision, 4);
  assert.equal(cleared.problemCode, null);
  assert.equal(cleared.indicatorCode, null);
  assert.equal(cleared.remediationSnapshot, null);
  assert.equal(cleared.bindingAudit.at(-1).action, 'binding_cleared');
});
