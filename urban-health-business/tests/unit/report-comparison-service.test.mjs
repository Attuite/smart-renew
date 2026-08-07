import test from 'node:test';
import assert from 'node:assert/strict';
import { compareReports } from '../../server/services/report-comparison-service.mjs';

function report(id, version, overrides = {}) {
  return {
    id,
    projectId: '1001',
    version,
    title: `报告V${version}`,
    editorial: {
      executiveSummary: version === 1 ? '原摘要' : '新摘要',
      recommendations: '',
      notes: ''
    },
    projectSnapshot: { revision: version },
    dataSnapshot: {
      officialIssueCount: version,
      locatedIssueCount: version,
      severity: { high: 0, medium: version, low: 0 },
      analysisRunCount: 0,
      manualReviewCount: 1,
      spatialAnalysisCount: 0,
      issueIds: version === 1 ? ['ISS-1'] : ['ISS-1', 'ISS-2'],
      spatialAnalysisIds: [],
      photoRevisions: [{
        id: 'PHOTO-1',
        metadataRevision: version,
        contentHash: 'hash-1',
        governanceStatus: 'active'
      }]
    },
    ...overrides
  };
}

test('report comparison exposes content, metric, issue and photo revision changes', () => {
  const comparison = compareReports(
    report('RPT-BIZ-1001-0001', 1),
    report('RPT-BIZ-1001-0002', 2)
  );

  assert.equal(comparison.summary.changed, true);
  assert.ok(comparison.summary.contentChangeCount > 0);
  assert.ok(comparison.summary.metricChangeCount > 0);
  assert.deepEqual(comparison.issueChanges.addedIds, ['ISS-2']);
  assert.equal(comparison.photoChanges.changed[0].id, 'PHOTO-1');
  assert.deepEqual(
    comparison.photoChanges.changed[0].reasons,
    ['METADATA_REVISION_CHANGED']
  );
});

test('report comparison rejects same version and cross-project inputs', () => {
  const base = report('RPT-BIZ-1001-0001', 1);
  assert.throws(
    () => compareReports(base, base),
    (error) => error.code === 'REPORT_COMPARE_SAME_VERSION'
  );
  assert.throws(
    () => compareReports(base, report('RPT-BIZ-2002-0001', 1, { projectId: '2002' })),
    (error) => error.code === 'REPORT_COMPARE_PROJECT_MISMATCH'
  );
});
