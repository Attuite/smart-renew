import test from 'node:test';
import assert from 'node:assert/strict';
import {
  markAnalysisStaleness,
  markReportStaleness,
  markSpatialStaleness,
  sourceEvidencePhotos,
  sourceUploadSessions
} from '../../server/services/workflow-service.mjs';

test('annotated derivatives do not become new source evidence or block collection uploads', () => {
  const sessions = [{
    id: 'UPL-ORIGINAL',
    kind: 'original',
    status: 'completed',
    photoId: 'PHOTO-1'
  }, {
    id: 'UPL-ANNOTATED',
    kind: 'annotated',
    status: 'completed',
    photoId: 'PHOTO-ANNOTATED'
  }];
  assert.deepEqual(
    sourceEvidencePhotos([
      { id: 'PHOTO-1' },
      { id: 'PHOTO-ANNOTATED' },
      { id: 'PHOTO-LEGACY' }
    ], sessions).map((photo) => photo.id),
    ['PHOTO-1', 'PHOTO-LEGACY']
  );
  assert.deepEqual(sourceUploadSessions(sessions).map((session) => session.id), ['UPL-ORIGINAL']);
});

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

test('POI runs depend on project boundary but not on the official issue set', () => {
  const current = markSpatialStaleness(
    [{
      id: 'SPRUN-POI',
      type: 'poi-search',
      status: 'completed',
      sourceSnapshot: { boundaryUpdatedAt: '2026-07-26T00:00:00.000Z' }
    }],
    { boundaryUpdatedAt: '2026-07-26T00:00:00.000Z' },
    [{ id: 'ISSUE-NEW' }]
  );
  assert.equal(current[0].status, 'completed');

  const changed = markSpatialStaleness(
    current,
    { boundaryUpdatedAt: '2026-07-26T01:00:00.000Z' },
    [{ id: 'ISSUE-NEW' }]
  );
  assert.equal(changed[0].status, 'stale');
  assert.deepEqual(changed[0].staleReasons, ['PROJECT_BOUNDARY_CHANGED']);
});
