import test from 'node:test';
import assert from 'node:assert/strict';
import { updateAnalysisCandidate } from '../../server/services/analysis-candidate-service.mjs';

function repository() {
  const items = new Map();
  return {
    items,
    async get(id) { return items.get(id) || null; },
    async put(item) { items.set(item.id, item); return item; }
  };
}

function clientFixture(status = 'reviewing') {
  let saved = null;
  const analysis = {
    id: 'ANL-1',
    projectId: '1001',
    status,
    result: {
      issues: [{
        id: 'CAND-1',
        title: '原始标题',
        desc: '原始描述',
        severity: 'medium',
        reviewStatus: 'pending'
      }]
    }
  };
  return {
    analysis,
    get saved() { return saved; },
    async getAnalysis() { return analysis; },
    async putAnalysis(value) { saved = value; }
  };
}

test('candidate may be seeded from analysis and saved with revision audit', async () => {
  const candidateRepository = repository();
  const client = clientFixture();
  const candidate = await updateAnalysisCandidate(
    client,
    candidateRepository,
    'CAND-1',
    {
      analysisId: 'ANL-1',
      reviewStatus: 'accepted',
      changes: { title: '人工修正标题', severity: 'high' },
      updatedBy: '复核员',
      expectedRevision: 1
    },
    { now: '2026-07-26T12:00:00.000Z' }
  );

  assert.equal(candidate.reviewStatus, 'modified');
  assert.equal(candidate.candidateRevision, 2);
  assert.deepEqual(candidate.auditTrail[0].changedFields, ['title', 'severity']);
  assert.equal(client.saved.status, 'reviewing');
  assert.equal(client.saved.reviewIssues[0].title, '人工修正标题');
});

test('candidate optimistic revision conflict rejects stale editor state', async () => {
  const candidateRepository = repository();
  candidateRepository.items.set('CAND-1', {
    id: 'CAND-1',
    analysisId: 'ANL-1',
    projectId: '1001',
    candidateRevision: 3,
    reviewStatus: 'pending'
  });

  await assert.rejects(
    () => updateAnalysisCandidate(clientFixture(), candidateRepository, 'CAND-1', {
      analysisId: 'ANL-1',
      updatedBy: '复核员',
      expectedRevision: 2
    }),
    (error) => error.code === 'ANALYSIS_CANDIDATE_REVISION_CONFLICT'
  );
});

test('archived analysis candidates are immutable', async () => {
  await assert.rejects(
    () => updateAnalysisCandidate(clientFixture('archived'), repository(), 'CAND-1', {
      analysisId: 'ANL-1',
      updatedBy: '复核员',
      expectedRevision: 1
    }),
    (error) => error.code === 'ANALYSIS_ALREADY_ARCHIVED'
  );
});

test('stale analysis blocks individual and batch candidate review writes', async () => {
  let repositoryWritten = false;
  const staleError = Object.assign(new Error('stale'), { code: 'AI_ANALYSIS_STALE' });
  await assert.rejects(
    () => updateAnalysisCandidate(clientFixture(), {
      async get() { return null; },
      async put() { repositoryWritten = true; }
    }, 'CAND-1', {
      analysisId: 'ANL-1',
      reviewStatus: 'accepted',
      updatedBy: '复核员',
      expectedRevision: 1
    }, {
      async assertAnalysisFresh() { throw staleError; }
    }),
    (error) => error.code === 'AI_ANALYSIS_STALE'
  );
  assert.equal(repositoryWritten, false);
});
