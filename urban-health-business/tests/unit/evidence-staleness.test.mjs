import test from 'node:test';
import assert from 'node:assert/strict';
import {
  markAnalysisStaleness,
  markReportStaleness
} from '../../server/services/workflow-service.mjs';

test('photo metadata revision or deactivation makes dependent AI jobs stale', () => {
  const jobs = [{
    id: 'AJOB-1',
    status: 'completed',
    photoSnapshot: [{
      id: 'PHOTO-1',
      metadataRevision: 2,
      contentHash: 'hash-1'
    }]
  }];
  const changed = markAnalysisStaleness(jobs, [{
    id: 'PHOTO-1',
    metadataRevision: 3,
    contentHash: 'hash-1',
    governanceStatus: 'inactive'
  }]);

  assert.equal(changed[0].status, 'stale');
  assert.deepEqual(changed[0].staleReasons, ['PHOTO_INACTIVE', 'PHOTO_METADATA_CHANGED']);
});

test('photo set and metadata changes make report snapshots stale', () => {
  const reports = [{
    id: 'RPT-1',
    status: 'generated',
    projectSnapshot: { revision: 1 },
    dataSnapshot: {
      issueRevisions: [],
      spatialAnalysisIds: [],
      photoRevisions: [{ id: 'PHOTO-1', metadataRevision: 1, contentHash: 'hash-1' }]
    }
  }];
  const result = markReportStaleness(
    reports,
    { revision: 1 },
    [],
    [],
    [
      { id: 'PHOTO-1', metadataRevision: 2, contentHash: 'hash-1', governanceStatus: 'active' },
      { id: 'PHOTO-2', metadataRevision: 0, contentHash: 'hash-2', governanceStatus: 'active' }
    ]
  );

  assert.equal(result[0].status, 'stale');
  assert.deepEqual(result[0].staleReasons, ['PHOTO_SET_CHANGED', 'PHOTO_METADATA_CHANGED']);
});
