import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBusinessLegacyPlan,
  convertLegacyOfficialIssue,
  convertLegacyReport,
  legacyFingerprint,
  summarizeBusinessLegacyPlan
} from '../../server/services/legacy-business-conversion.mjs';

const legacyIssue = {
  id: 'ISS-OLD-001',
  projectId: '1001',
  analysisId: 'ANA-001',
  originalPhotoId: 'PHOTO-001',
  problemCode: 'PRB-03-08',
  indicatorCode: 'IND-HOUSE-003',
  title: '灭火器缺失',
  description: '楼道未配置灭火器',
  severity: 'high',
  reviewerName: '旧复核员',
  reviewedAt: '2025-01-01T00:00:00.000Z'
};

const legacyReport = {
  id: 'RPT-1001-V0001',
  projectId: '1001',
  version: 1,
  title: '旧版体检报告',
  generatedBy: '旧报告员',
  generatedAt: '2025-01-02T00:00:00.000Z',
  sourceIds: {
    issueIds: ['ISS-OLD-001'],
    analysisIds: ['ANA-001'],
    photoIds: ['PHOTO-001']
  },
  snapshot: {
    project: { id: '1001', name: '测试项目' },
    analyses: { total: 1 },
    issues: {
      total: 1,
      high: 1,
      medium: 0,
      low: 0,
      indicatorCounts: { 'IND-HOUSE-003': 1 },
      items: [legacyIssue]
    }
  }
};

test('legacy issue migration preserves provenance without reactivating indicator mappings', () => {
  const entry = {
    source: legacyIssue,
    sourceId: legacyIssue.id,
    fingerprint: legacyFingerprint(legacyIssue)
  };
  const issue = convertLegacyOfficialIssue(entry, '1001', '迁移员', {
    now: '2026-07-26T00:00:00.000Z'
  });
  assert.match(issue.id, /^ISS-LEGACY-/);
  assert.equal(issue.source, 'legacy-migrated');
  assert.equal(issue.indicatorCode, null);
  assert.equal(issue.indicatorBindingStatus, 'not_integrated');
  assert.equal(issue.legacyProblemCode, 'PRB-03-08');
  assert.equal(issue.legacyIndicatorCode, 'IND-HOUSE-003');
  assert.equal(issue.migration.sourceFingerprint, entry.fingerprint);
});

test('legacy reports become read-only Business versions and retain the original snapshot', () => {
  const entry = {
    source: legacyReport,
    sourceId: legacyReport.id,
    fingerprint: legacyFingerprint(legacyReport)
  };
  const report = convertLegacyReport(
    entry,
    '1001',
    3,
    new Map([['ISS-OLD-001', 'ISS-LEGACY-MAPPED']]),
    '迁移员',
    { now: '2026-07-26T00:00:00.000Z' }
  );
  assert.match(report.id, /^RPT-BIZ-LEGACY-/);
  assert.equal(report.version, 3);
  assert.equal(report.status, 'migrated_read_only');
  assert.equal(report.migration.readOnly, true);
  assert.equal(report.dataSnapshot.issueIds[0], 'ISS-LEGACY-MAPPED');
  assert.deepEqual(report.indicatorSnapshot.results, []);
  assert.equal(
    report.migration.originalSnapshot.snapshot.issues.indicatorCounts['IND-HOUSE-003'],
    1
  );
});

test('migration planning skips identical sources and exposes changed-source conflicts', () => {
  const fingerprint = legacyFingerprint(legacyIssue);
  const identical = {
    id: 'ISS-LEGACY-EXISTING',
    sourceLegacyId: legacyIssue.id,
    sourceLegacyFingerprint: fingerprint
  };
  const changed = {
    ...legacyIssue,
    title: '迁移后又被修改'
  };
  const skipped = buildBusinessLegacyPlan([legacyIssue], [], [identical], []);
  assert.equal(summarizeBusinessLegacyPlan(skipped).issues.alreadyMigrated, 1);
  const conflict = buildBusinessLegacyPlan([changed], [], [identical], []);
  assert.equal(conflict.hasConflicts, true);
  assert.equal(conflict.issues.conflicts[0].reason, 'legacy_source_changed_after_migration');
});
