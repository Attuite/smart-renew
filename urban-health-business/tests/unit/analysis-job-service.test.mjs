import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AnalysisJobRunner,
  cancelAnalysisJob,
  createAnalysisJob,
  retryAnalysisJob
} from '../../server/services/analysis-job-service.mjs';

function jobRepository() {
  const items = new Map();
  return {
    items,
    async get(id) { return items.get(id) || null; },
    async put(item) { items.set(item.id, item); return item; },
    async list(projectId = '') {
      return [...items.values()].filter((item) => !projectId || item.projectId === projectId);
    },
    async findByClientRequest(projectId, requestId) {
      return [...items.values()].find((item) =>
        item.projectId === projectId && item.clientRequestId === requestId
      ) || null;
    }
  };
}

const client = {
  async getProject() { return { id: '170000000000001', revision: 4 }; },
  async listPhotos() { return { items: [{ id: 'PHOTO-1' }, { id: 'PHOTO-2' }] }; },
  async health() { return { ready: true, model: 'mock-vl' }; }
};

test('analysis job creation is queued, persistent and idempotent', async () => {
  const repository = jobRepository();
  const input = {
    photoIds: ['PHOTO-1'],
    analysisType: '综合巡检分析',
    clientRequestId: 'analysis-request-1'
  };
  const first = await createAnalysisJob(client, repository, '170000000000001', input, {
    id: 'AJOB-fixed-job',
    now: '2026-07-26T00:00:00.000Z'
  });
  const second = await createAnalysisJob(client, repository, '170000000000001', input);
  assert.equal(first.job.status, 'queued');
  assert.equal(first.job.progress.total, 1);
  assert.equal(second.duplicated, true);
  assert.equal(second.job.id, first.job.id);
});

test('runner persists independent candidates and completes job', async () => {
  const repository = jobRepository();
  await repository.put({
    id: 'AJOB-runner-job',
    projectId: '170000000000001',
    photoIds: ['PHOTO-1', 'PHOTO-2'],
    analysisType: '综合巡检分析',
    description: '',
    status: 'queued',
    progress: { completed: 0, total: 2, percent: 0 }
  });
  const storedCandidates = [];
  const runner = new AnalysisJobRunner({
    client,
    jobRepository: repository,
    candidateRepository: {
      async putMany(items) { storedCandidates.push(...items); }
    },
    async executeAnalysis() {
      return {
        id: '777000002',
        result: {
          issues: [{ id: 'CAND-777000002-0001', photoId: 'PHOTO-1', reviewStatus: 'pending' }]
        }
      };
    }
  });
  await runner.run('AJOB-runner-job');
  const completed = await repository.get('AJOB-runner-job');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.progress.percent, 100);
  assert.equal(completed.candidateCount, 1);
  assert.equal(storedCandidates[0].jobId, 'AJOB-runner-job');
});

test('failed jobs may be retried and queued jobs may be canceled', async () => {
  const repository = jobRepository();
  await repository.put({
    id: 'AJOB-failed-job',
    projectId: '170000000000001',
    photoIds: ['PHOTO-1'],
    analysisType: '综合巡检分析',
    description: '',
    status: 'failed'
  });
  const retried = await retryAnalysisJob(client, repository, 'AJOB-failed-job', {
    id: 'AJOB-retry-job',
    clientRequestId: 'retry-fixed',
    now: '2026-07-26T00:00:00.000Z'
  });
  assert.equal(retried.job.parentJobId, 'AJOB-failed-job');
  assert.equal(retried.job.status, 'queued');
  const canceled = await cancelAnalysisJob(repository, 'AJOB-retry-job');
  assert.equal(canceled.status, 'canceled');
});

test('inactive governed photos cannot enter a new AI task', async () => {
  await assert.rejects(
    () => createAnalysisJob(client, jobRepository(), '170000000000001', {
      photoIds: ['PHOTO-1'],
      clientRequestId: 'inactive-photo-job'
    }, {
      photoMetadataRepository: {
        async list() { return [{ photoId: 'PHOTO-1', status: 'inactive' }]; }
      }
    }),
    (error) => error.code === 'PHOTO_INACTIVE'
  );
});

test('analysis job snapshots governed photo revision and binding', async () => {
  const outcome = await createAnalysisJob(client, jobRepository(), '170000000000001', {
    photoIds: ['PHOTO-1'],
    clientRequestId: 'governed-photo-snapshot'
  }, {
    id: 'AJOB-governed-snapshot',
    photoMetadataRepository: {
      async list() {
        return [{
          photoId: 'PHOTO-1',
          status: 'active',
          metadataRevision: 7,
          communityId: 'COMM-1',
          buildingId: 'BLD-1',
          coordinates: [108.95, 34.27]
        }];
      }
    }
  });

  assert.equal(outcome.job.photoSnapshot[0].metadataRevision, 7);
  assert.equal(outcome.job.photoSnapshot[0].communityId, 'COMM-1');
  assert.deepEqual(outcome.job.photoSnapshot[0].coordinates, [108.95, 34.27]);
});
