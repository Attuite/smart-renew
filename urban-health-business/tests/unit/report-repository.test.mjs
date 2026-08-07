import test from 'node:test';
import assert from 'node:assert/strict';
import { ReportRepository, buildReportDraft } from '../../server/repositories/report-repository.mjs';

test('report draft supports zero issues and never invents indicator scores', () => {
  const report = buildReportDraft(
    { id: '170000000000001', name: '真实项目', scopeBoundary: [] },
    [],
    [{ id: '170000000000004', status: 'archived' }],
    [],
    { generatedBy: '报告人员' },
    { now: '2026-07-26T00:00:00.000Z' }
  );

  assert.equal(report.dataSnapshot.officialIssueCount, 0);
  assert.equal(report.indicatorSnapshot.status, 'unavailable');
  assert.equal(report.indicatorSnapshot.score, null);
  assert.deepEqual(report.indicatorSnapshot.results, []);
  assert.equal(report.projectSnapshot.boundaryStatus, 'missing');
});

test('report draft snapshots manual review and spatial analysis references', () => {
  const report = buildReportDraft(
    { id: '170000000000001', name: '真实项目' },
    [],
    [],
    [],
    { generatedBy: '报告人员' },
    {
      now: '2026-07-26T00:00:00.000Z',
      reviewConclusions: [{ id: 'REV-MAN-001' }],
      spatialAnalyses: [{ id: 'SPRUN-001' }],
      photos: [{
        id: 'PHOTO-001',
        contentHash: 'sha256:test',
        metadataRevision: 3,
        governanceStatus: 'active'
      }]
    }
  );
  assert.deepEqual(report.dataSnapshot.reviewConclusionIds, ['REV-MAN-001']);
  assert.deepEqual(report.dataSnapshot.spatialAnalysisIds, ['SPRUN-001']);
  assert.deepEqual(report.dataSnapshot.photoRevisions, [{
    id: 'PHOTO-001',
    contentHash: 'sha256:test',
    metadataRevision: 3,
    governanceStatus: 'active'
  }]);
});

test('report edit uses optimistic revision and appends audit history', async () => {
  const repository = new ReportRepository('unused');
  repository.get = async () => ({
    id: 'RPT-BIZ-170000000000001-0001',
    title: '原报告',
    reportRevision: 1,
    editorial: {},
    auditTrail: []
  });
  repository.put = async (report) => report;

  const report = await repository.update('RPT-BIZ-170000000000001-0001', {
    title: '修订报告',
    executiveSummary: '真实摘要',
    updatedBy: '报告编辑',
    expectedRevision: 1
  }, { now: '2026-07-26T01:00:00.000Z' });
  assert.equal(report.reportRevision, 2);
  assert.equal(report.editorial.executiveSummary, '真实摘要');
  assert.equal(report.auditTrail[0].actor, '报告编辑');
});

test('migrated legacy report remains an immutable historical snapshot', async () => {
  const repository = new ReportRepository('unused');
  repository.get = async () => ({
    id: 'RPT-BIZ-LEGACY-fixed',
    title: '迁移报告',
    reportRevision: 1,
    migration: {
      source: 'smart-renew',
      sourceId: 'RPT-OLD-001',
      readOnly: true
    }
  });
  await assert.rejects(
    () => repository.update('RPT-BIZ-LEGACY-fixed', {
      title: '不允许修改',
      updatedBy: '编辑员',
      expectedRevision: 1
    }),
    (error) => error.code === 'MIGRATED_REPORT_READ_ONLY' && error.status === 409
  );
});
