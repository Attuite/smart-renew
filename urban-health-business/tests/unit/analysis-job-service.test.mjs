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

test('runner splits more than twenty photos, merges metadata and deduplicates candidates', async () => {
  const repository = jobRepository();
  const photoIds = Array.from({ length: 45 }, (_, index) => `PHOTO-${index + 1}`);
  const persistedAnalyses = [];
  const manyPhotoClient = {
    async getProject() { return { id: '170000000000001', revision: 5 }; },
    async listPhotos() { return { items: photoIds.map((id) => ({ id, contentHash: `hash-${id}` })) }; },
    async health() { return { ready: true, model: 'mock-vl' }; },
    async putAnalysis(analysis) { persistedAnalyses.push(analysis); return analysis; }
  };
  const created = await createAnalysisJob(
    manyPhotoClient,
    repository,
    '170000000000001',
    {
      photoIds,
      analysisType: '综合巡检分析',
      clientRequestId: 'multi-batch-request'
    },
    {
      id: 'AJOB-multi-batch',
      now: '2026-07-27T00:00:00.000Z'
    }
  );
  assert.equal(created.job.batchCount, 3);
  assert.deepEqual(created.job.batches.map((batch) => batch.photoIds.length), [20, 20, 5]);

  const storedCandidates = [];
  const calls = [];
  const runner = new AnalysisJobRunner({
    client: manyPhotoClient,
    jobRepository: repository,
    candidateRepository: {
      async putMany(items) { storedCandidates.push(...items); }
    },
    async executeAnalysis(_client, _projectId, input, options) {
      calls.push({ input, options });
      const batchNumber = calls.length;
      const issues = batchNumber === 1
        ? [
            {
              id: 'CAND-9101-0001',
              photoId: 'PHOTO-1',
              imageIndex: 1,
              categoryCode: 'FACADE',
              title: '外墙裂缝问题',
              bbox: [100, 100, 400, 400],
              confidence: 0.72
            },
            {
              id: 'CAND-9101-0002',
              photoId: 'PHOTO-1',
              imageIndex: 1,
              categoryCode: 'FACADE',
              title: '外墙裂缝隐患',
              bbox: [120, 120, 420, 420],
              confidence: 0.9
            }
          ]
        : [{
            id: `CAND-910${batchNumber}-0001`,
            photoId: input.photoIds[0],
            imageIndex: 1,
            categoryCode: batchNumber === 2 ? 'ROAD_ACCESS' : 'PUBLIC_FACILITY',
            title: batchNumber === 2 ? '道路破损' : '设施损坏',
            bbox: [200, 200, 500, 500],
            confidence: 0.8
          }];
      return {
        id: String(9100 + batchNumber),
        projectId: '170000000000001',
        analysisType: input.analysisType,
        photoIds: input.photoIds,
        imagesCount: input.photoIds.length,
        status: 'reviewing',
        model: 'mock-vl',
        modelRequestId: `REQ-${batchNumber}`,
        usage: { input_tokens: batchNumber * 10, output_tokens: batchNumber },
        promptVersion: 'prompt-v1',
        result: { summary: `第${batchNumber}批`, issues }
      };
    }
  });

  await runner.run('AJOB-multi-batch');
  const completed = await repository.get('AJOB-multi-batch');
  assert.equal(completed.status, 'completed');
  assert.deepEqual(calls.map((call) => call.input.photoIds.length), [20, 20, 5]);
  assert.deepEqual(calls.map((call) => call.options.batchIndex), [1, 2, 3]);
  assert.ok(completed.batches.every((batch) => batch.status === 'completed'));
  assert.deepEqual(completed.analysisIds, ['9101', '9102', '9103']);
  assert.equal(completed.rawCandidateCount, 4);
  assert.equal(completed.candidateCount, 3);
  assert.equal(completed.duplicateCandidateCount, 1);
  assert.deepEqual(completed.requestIds, ['REQ-1', 'REQ-2', 'REQ-3']);
  assert.deepEqual(completed.usage, { input_tokens: 60, output_tokens: 6 });
  assert.equal(storedCandidates.length, 3);
  assert.equal(storedCandidates[0].analysisId, '9101');
  assert.equal(storedCandidates[0].mergedCount, 2);

  const aggregate = persistedAnalyses.find((analysis) =>
    String(analysis.id) === '9101' && analysis.status === 'reviewing'
  );
  assert.equal(aggregate.photoIds.length, 45);
  assert.equal(aggregate.reviewIssues.length, 3);
  assert.equal(
    persistedAnalyses.filter((analysis) => analysis.status === 'merged').length,
    2
  );
});

test('a failed batch fails the whole job and does not expose partial candidates', async () => {
  const repository = jobRepository();
  const photoIds = Array.from({ length: 25 }, (_, index) => `PHOTO-${index + 1}`);
  const persistedAnalyses = [];
  const manyPhotoClient = {
    async getProject() { return { id: '170000000000001', revision: 5 }; },
    async listPhotos() { return { items: photoIds.map((id) => ({ id })) }; },
    async health() { return { ready: true, model: 'mock-vl' }; },
    async putAnalysis(analysis) { persistedAnalyses.push(analysis); return analysis; }
  };
  await createAnalysisJob(
    manyPhotoClient,
    repository,
    '170000000000001',
    {
      photoIds,
      analysisType: '综合巡检分析',
      clientRequestId: 'failed-multi-batch-request'
    },
    { id: 'AJOB-failed-multi-batch' }
  );
  const storedCandidates = [];
  let calls = 0;
  const runner = new AnalysisJobRunner({
    client: manyPhotoClient,
    jobRepository: repository,
    candidateRepository: {
      async putMany(items) { storedCandidates.push(...items); }
    },
    async executeAnalysis(_client, _projectId, input) {
      calls += 1;
      if (calls === 2) {
        const error = new Error('第二批模型调用失败');
        error.code = 'UPSTREAM_AI_FAILED';
        throw error;
      }
      return {
        id: '9201',
        projectId: '170000000000001',
        photoIds: input.photoIds,
        status: 'reviewing',
        result: {
          summary: '部分结果',
          issues: [{
            id: 'CAND-9201-0001',
            photoId: 'PHOTO-1',
            imageIndex: 1,
            categoryCode: 'FACADE',
            title: '外墙裂缝'
          }]
        }
      };
    }
  });

  await runner.run('AJOB-failed-multi-batch');
  const failed = await repository.get('AJOB-failed-multi-batch');
  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.batches.map((batch) => batch.status), ['completed', 'failed']);
  assert.equal(failed.error.code, 'UPSTREAM_AI_FAILED');
  assert.equal(storedCandidates.length, 0);
  assert.equal(
    persistedAnalyses.some((analysis) =>
      analysis.id === '9201' && analysis.status === 'failed' && analysis.partialResult === true
    ),
    true
  );
});

test('runner resumes a multi-batch job without rerunning completed batches', async () => {
  const repository = jobRepository();
  const photoIds = Array.from({ length: 25 }, (_, index) => `PHOTO-${index + 1}`);
  await repository.put({
    id: 'AJOB-resume-multi-batch',
    projectId: '170000000000001',
    photoIds,
    photoSnapshot: photoIds.map((id) => ({ id })),
    analysisType: '综合巡检分析',
    description: '',
    status: 'queued',
    progress: { completed: 20, total: 25, percent: 80 },
    batches: [
      {
        id: 'BATCH-001',
        batchIndex: 1,
        offset: 0,
        photoIds: photoIds.slice(0, 20),
        status: 'completed',
        analysisId: '9301',
        candidateCount: 1
      },
      {
        id: 'BATCH-002',
        batchIndex: 2,
        offset: 20,
        photoIds: photoIds.slice(20),
        status: 'queued',
        analysisId: null,
        candidateCount: 0
      }
    ]
  });
  const persistedAnalyses = [];
  const resumeClient = {
    async getAnalysis(id) {
      assert.equal(String(id), '9301');
      return {
        id: '9301',
        projectId: '170000000000001',
        photoIds: photoIds.slice(0, 20),
        status: 'reviewing',
        model: 'mock-vl',
        modelRequestId: 'REQ-1',
        promptVersion: 'prompt-v1',
        result: {
          summary: '已完成批次',
          issues: [{
            id: 'CAND-9301-0001',
            photoId: 'PHOTO-1',
            imageIndex: 1,
            categoryCode: 'FACADE',
            title: '外墙裂缝'
          }]
        }
      };
    },
    async putAnalysis(analysis) { persistedAnalyses.push(analysis); return analysis; }
  };
  const calls = [];
  const storedCandidates = [];
  const runner = new AnalysisJobRunner({
    client: resumeClient,
    jobRepository: repository,
    candidateRepository: {
      async putMany(items) { storedCandidates.push(...items); }
    },
    async executeAnalysis(_client, _projectId, input, options) {
      calls.push({ input, options });
      return {
        id: '9302',
        projectId: '170000000000001',
        photoIds: input.photoIds,
        status: 'reviewing',
        model: 'mock-vl',
        modelRequestId: 'REQ-2',
        promptVersion: 'prompt-v1',
        result: {
          summary: '恢复后批次',
          issues: [{
            id: 'CAND-9302-0001',
            photoId: 'PHOTO-21',
            imageIndex: 1,
            categoryCode: 'ROAD_ACCESS',
            title: '道路破损'
          }]
        }
      };
    }
  });

  await runner.run('AJOB-resume-multi-batch');
  const completed = await repository.get('AJOB-resume-multi-batch');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.batchIndex, 2);
  assert.equal(completed.status, 'completed');
  assert.deepEqual(completed.analysisIds, ['9301', '9302']);
  assert.equal(storedCandidates.length, 2);
  assert.equal(
    persistedAnalyses.some((analysis) => analysis.id === '9302' && analysis.status === 'merged'),
    true
  );
});
