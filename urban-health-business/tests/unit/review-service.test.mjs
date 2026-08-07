import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReviewDecisions, finalizeReview } from '../../server/services/review-service.mjs';

const record = {
  id: '170000000000004',
  projectId: '170000000000001',
  status: 'reviewing',
  result: {
    summary: '真实模型结果',
    issues: [
      { id: 'CAND-1', reviewStatus: 'pending', title: '问题1' },
      { id: 'CAND-2', reviewStatus: 'pending', title: '问题2' }
    ]
  }
};

test('all candidates may be excluded and produce a valid zero-issue archive', () => {
  const outcome = applyReviewDecisions(record, {
    reviewerName: '复核员',
    decisions: [
      { candidateId: 'CAND-1', status: 'excluded' },
      { candidateId: 'CAND-2', status: 'excluded' }
    ]
  }, { now: '2026-07-26T00:00:00.000Z' });

  assert.equal(outcome.accepted.length, 0);
  assert.equal(outcome.archivedRecord.status, 'archived');
  assert.deepEqual(outcome.archivedRecord.result.issues, []);
});

test('pending candidates block finalization', () => {
  assert.throws(
    () => applyReviewDecisions(record, {
      reviewerName: '复核员',
      decisions: [{ candidateId: 'CAND-1', status: 'accepted' }]
    }),
    (error) => error.code === 'REVIEW_INCOMPLETE'
  );
});

test('accepted candidate field corrections are whitelisted and marked modified', () => {
  const outcome = applyReviewDecisions(record, {
    reviewerName: '复核员',
    decisions: [
      {
        candidateId: 'CAND-1',
        status: 'accepted',
        changes: { title: '人工修正标题', severity: 'high', id: 'MUST-NOT-CHANGE' }
      },
      { candidateId: 'CAND-2', status: 'excluded' }
    ]
  });

  assert.equal(outcome.accepted[0].id, 'CAND-1');
  assert.equal(outcome.accepted[0].title, '人工修正标题');
  assert.equal(outcome.accepted[0].severity, 'high');
  assert.equal(outcome.accepted[0].reviewStatus, 'modified');
});

test('bbox correction must stay normalized with a positive rectangle', () => {
  assert.throws(
    () => applyReviewDecisions(record, {
      reviewerName: '复核员',
      decisions: [{
        candidateId: 'CAND-1',
        status: 'accepted',
        changes: { bbox: [500, 100, 200, 800] }
      }, {
        candidateId: 'CAND-2',
        status: 'excluded'
      }]
    }),
    (error) => error.code === 'INVALID_BBOX'
  );
});

test('zero accepted candidates do not call the legacy issue finalizer', async () => {
  let finalizerCalled = false;
  let saved = null;
  const client = {
    async getAnalysis() { return record; },
    async putAnalysis(value) { saved = value; }
  };
  const issueRepository = {
    async createFromCandidates() { finalizerCalled = true; return []; }
  };
  const outcome = await finalizeReview(client, issueRepository, record.id, {
    reviewerName: '复核员',
    decisions: [
      { candidateId: 'CAND-1', status: 'excluded' },
      { candidateId: 'CAND-2', status: 'excluded' }
    ]
  });

  assert.equal(finalizerCalled, false);
  assert.equal(saved.status, 'archived');
  assert.equal(outcome.acceptedCount, 0);
  assert.equal(outcome.excludedCount, 2);
});

test('review finalization synchronizes independent candidates without losing job linkage', async () => {
  const synchronized = [];
  const client = {
    async getAnalysis() { return record; },
    async putAnalysis() {}
  };
  const issueRepository = {
    async createFromCandidates() { return []; }
  };
  const candidateRepository = {
    async list() {
      return [
        { id: 'CAND-1', jobId: 'AJOB-001', analysisId: record.id, reviewStatus: 'pending' },
        { id: 'CAND-2', jobId: 'AJOB-001', analysisId: record.id, reviewStatus: 'pending' }
      ];
    },
    async putMany(items) {
      synchronized.push(...items);
    }
  };
  await finalizeReview(client, issueRepository, record.id, {
    reviewerName: '复核员',
    decisions: [
      { candidateId: 'CAND-1', status: 'accepted' },
      { candidateId: 'CAND-2', status: 'excluded' }
    ]
  }, {}, candidateRepository);

  assert.deepEqual(synchronized.map((item) => item.reviewStatus), ['accepted', 'excluded']);
  assert.equal(synchronized[0].jobId, 'AJOB-001');
  assert.equal(synchronized[0].candidateRevision, 2);
  assert.equal(synchronized[0].auditTrail[0].action, 'candidate_archived');
});

test('repeated archived review finalization is idempotent', async () => {
  let putCalled = false;
  const archived = {
    ...record,
    status: 'archived',
    officialIssueIds: ['ISS-CAND-1'],
    reviewIssues: [
      { id: 'CAND-1', reviewStatus: 'accepted' },
      { id: 'CAND-2', reviewStatus: 'excluded' }
    ]
  };
  const outcome = await finalizeReview({
    async getAnalysis() { return archived; },
    async putAnalysis() { putCalled = true; }
  }, {
    async get(issueId) { return { id: issueId }; }
  }, archived.id, {});

  assert.equal(outcome.duplicated, true);
  assert.equal(outcome.acceptedCount, 1);
  assert.equal(outcome.officialIssues[0].id, 'ISS-CAND-1');
  assert.equal(putCalled, false);
});

test('accepted bbox candidate requires a completed annotated upload before archive', async () => {
  const bboxRecord = {
    ...record,
    photoIds: ['PHOTO-SOURCE'],
    result: {
      ...record.result,
      issues: [{
        id: 'CAND-1',
        photoId: 'PHOTO-SOURCE',
        imageIndex: 1,
        bbox: [100, 100, 400, 400],
        reviewStatus: 'pending',
        title: '外墙问题'
      }]
    }
  };
  let saved = false;
  await assert.rejects(
    () => finalizeReview({
      async getAnalysis() { return bboxRecord; },
      async putAnalysis() { saved = true; }
    }, {
      async createFromCandidates() { return []; }
    }, bboxRecord.id, {
      reviewerName: '复核员',
      decisions: [{ candidateId: 'CAND-1', status: 'accepted' }]
    }, {
      uploadSessionRepository: { async get() { return null; } }
    }),
    (error) => error.code === 'ANNOTATED_EVIDENCE_INCOMPLETE'
  );
  assert.equal(saved, false);
});

test('completed annotated upload is attached to archived analysis and official issue candidate', async () => {
  const bboxRecord = {
    ...record,
    photoIds: ['PHOTO-SOURCE'],
    result: {
      ...record.result,
      issues: [{
        id: 'CAND-1',
        photoId: 'PHOTO-SOURCE',
        imageIndex: 1,
        bbox: [100, 100, 400, 400],
        reviewStatus: 'pending',
        title: '外墙问题'
      }]
    }
  };
  let saved = null;
  let officialCandidate = null;
  const outcome = await finalizeReview({
    async getAnalysis() { return bboxRecord; },
    async putAnalysis(value) { saved = value; }
  }, {
    async createFromCandidates(candidates) {
      [officialCandidate] = candidates;
      return [{ id: 'ISS-CAND-1' }];
    }
  }, bboxRecord.id, {
    reviewerName: '复核员',
    decisions: [{ candidateId: 'CAND-1', status: 'accepted' }],
    annotatedPhotos: [{
      sourcePhotoId: 'PHOTO-SOURCE',
      annotatedPhotoId: 'PHOTO-ANNOTATED',
      uploadSessionId: 'UPL-annotation-session'
    }]
  }, {
    uploadSessionRepository: {
      async get() {
        return {
          id: 'UPL-annotation-session',
          status: 'completed',
          kind: 'annotated',
          projectId: bboxRecord.projectId,
          photoId: 'PHOTO-ANNOTATED',
          derivation: {
            analysisId: bboxRecord.id,
            sourcePhotoId: 'PHOTO-SOURCE',
            candidateIds: ['CAND-1']
          }
        };
      }
    }
  });

  assert.equal(officialCandidate.annotatedPhotoId, 'PHOTO-ANNOTATED');
  assert.deepEqual(saved.annotatedPhotoIds, ['PHOTO-ANNOTATED']);
  assert.equal(saved.annotationEvidence[0].uploadSessionId, 'UPL-annotation-session');
  assert.equal(outcome.acceptedCount, 1);
});

test('stale analysis blocks final archive before official issue creation', async () => {
  let officialIssueCreated = false;
  let analysisSaved = false;
  await assert.rejects(
    () => finalizeReview({
      async getAnalysis() { return record; },
      async putAnalysis() { analysisSaved = true; }
    }, {
      async createFromCandidates() { officialIssueCreated = true; return []; }
    }, record.id, {
      reviewerName: '复核员',
      decisions: [
        { candidateId: 'CAND-1', status: 'accepted' },
        { candidateId: 'CAND-2', status: 'excluded' }
      ]
    }, {
      async assertAnalysisFresh() {
        throw Object.assign(new Error('stale'), { code: 'AI_ANALYSIS_STALE' });
      }
    }),
    (error) => error.code === 'AI_ANALYSIS_STALE'
  );
  assert.equal(officialIssueCreated, false);
  assert.equal(analysisSaved, false);
});
