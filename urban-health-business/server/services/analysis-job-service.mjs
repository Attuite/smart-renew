import { randomUUID } from 'node:crypto';
import { runAnalysis, summarizeCandidates } from './analysis-service.mjs';
import {
  createAnalysisBatches,
  mergeAnalysisBatchResults
} from './analysis-batch-service.mjs';

const ACTIVE_JOB_STATUSES = new Set(['queued', 'running']);

function clean(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function jobError(message, status = 400, code = 'ANALYSIS_JOB_VALIDATION_FAILED', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

export async function createAnalysisJob(client, repository, projectId, input, options = {}) {
  const normalizedProjectId = clean(projectId, 40);
  if (!/^\d+$/.test(normalizedProjectId)) {
    throw jobError('项目编号无效。', 400, 'INVALID_PROJECT_ID');
  }
  const photoIds = [...new Set(
    (Array.isArray(input?.photoIds) ? input.photoIds : []).map((item) => clean(item, 120)).filter(Boolean)
  )];
  if (!photoIds.length) throw jobError('请至少选择一张真实照片。', 400, 'PHOTO_REQUIRED');
  const clientRequestId = clean(input?.clientRequestId, 160);
  const existing = await repository.findByClientRequest(normalizedProjectId, clientRequestId);
  if (existing) return { job: existing, duplicated: true };

  const [project, photos, health] = await Promise.all([
    client.getProject(normalizedProjectId),
    client.listPhotos({ projectId: normalizedProjectId }),
    client.health()
  ]);
  const photoMap = new Map(photos.items.map((photo) => [String(photo.id), photo]));
  if (photoIds.some((id) => !photoMap.has(id))) {
    throw jobError('所选照片不属于当前项目或已不存在。', 400, 'PHOTO_NOT_FOUND');
  }
  let photoMetadataMap = new Map();
  if (options.photoMetadataRepository) {
    const metadata = await options.photoMetadataRepository.list(normalizedProjectId);
    photoMetadataMap = new Map(metadata.map((item) => [String(item.photoId), item]));
    const inactive = new Set(metadata.filter((item) => item.status === 'inactive').map((item) => String(item.photoId)));
    if (photoIds.some((id) => inactive.has(id))) {
      throw jobError('所选照片已在Business资料治理中停用。', 409, 'PHOTO_INACTIVE');
    }
  }
  if (!health?.ready) throw jobError('视觉AI尚未配置。', 503, 'AI_NOT_CONFIGURED');

  const now = options.now || new Date().toISOString();
  const photoSnapshot = photoIds.map((id) => {
    const photo = photoMap.get(id);
    const metadata = photoMetadataMap.get(id);
    return {
      id,
      contentHash: photo.contentHash || null,
      uploadedAt: photo.uploadedAt || null,
      metadataRevision: Number(metadata?.metadataRevision) || 0,
      governanceStatus: metadata?.status || 'active',
      communityId: metadata?.communityId || photo.communityId || null,
      buildingId: metadata?.buildingId || photo.buildingId || null,
      coordinates: metadata?.coordinates || photo.coordinates || null
    };
  });
  const batches = createAnalysisBatches(photoIds, photoSnapshot).map((batch) => ({
    ...batch,
    status: 'queued',
    analysisId: null,
    candidateCount: 0,
    model: health.model || null,
    requestId: null,
    usage: null,
    promptVersion: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    error: null
  }));
  const job = {
    id: options.id || `AJOB-${randomUUID()}`,
    clientRequestId,
    parentJobId: clean(input?.parentJobId, 140) || null,
    projectId: String(project.id),
    projectRevision: Number(project.revision) || 0,
    photoIds,
    photoSnapshot,
    batches,
    batchSize: 20,
    batchCount: batches.length,
    analysisType: clean(input?.analysisType, 80) || '综合巡检分析',
    description: clean(input?.description, 1000),
    requestedBy: clean(input?.requestedBy, 160) || null,
    status: 'queued',
    progress: {
      completed: 0,
      total: photoIds.length,
      percent: 0
    },
    analysisId: null,
    analysisIds: [],
    candidateCount: 0,
    rawCandidateCount: 0,
    duplicateCandidateCount: 0,
    models: health.model ? [health.model] : [],
    requestIds: [],
    usage: null,
    promptVersions: [],
    error: null,
    recoveryCount: 0,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    schemaVersion: '1.1.0'
  };
  await repository.put(job);
  return { job, duplicated: false };
}

export async function cancelAnalysisJob(repository, jobId, options = {}) {
  const job = await repository.get(jobId);
  if (!job) throw jobError('AI任务不存在。', 404, 'ANALYSIS_JOB_NOT_FOUND');
  if (job.status === 'running') {
    throw jobError('当前版本暂不支持取消已运行的模型请求。', 409, 'RUNNING_JOB_CANCEL_UNSUPPORTED');
  }
  if (!['queued', 'failed'].includes(job.status)) {
    throw jobError('当前任务状态不能取消。', 409, 'ANALYSIS_JOB_NOT_CANCELABLE');
  }
  const canceled = {
    ...job,
    status: 'canceled',
    updatedAt: options.now || new Date().toISOString()
  };
  await repository.put(canceled);
  return canceled;
}

export async function retryAnalysisJob(client, repository, jobId, options = {}) {
  const parent = await repository.get(jobId);
  if (!parent) throw jobError('AI任务不存在。', 404, 'ANALYSIS_JOB_NOT_FOUND');
  if (parent.status !== 'failed') {
    throw jobError('只有失败任务可以重试。', 409, 'ANALYSIS_JOB_NOT_RETRYABLE');
  }
  return createAnalysisJob(client, repository, parent.projectId, {
    photoIds: parent.photoIds,
    analysisType: parent.analysisType,
    description: parent.description,
    parentJobId: parent.id,
    requestedBy: parent.requestedBy,
    clientRequestId: options.clientRequestId || `retry:${parent.id}:${options.nowMs ?? Date.now()}`
  }, options);
}

export class AnalysisJobRunner {
  constructor(options) {
    this.client = options.client;
    this.jobRepository = options.jobRepository;
    this.candidateRepository = options.candidateRepository;
    this.executeAnalysis = options.executeAnalysis || runAnalysis;
    this.resolveClient = options.resolveClient || (async () => this.client);
    this.active = new Set();
  }

  enqueue(jobId) {
    if (this.active.has(jobId)) return;
    this.active.add(jobId);
    setImmediate(() => {
      this.run(jobId).finally(() => this.active.delete(jobId));
    });
  }

  async run(jobId) {
    const job = await this.jobRepository.get(jobId);
    if (!job || job.status !== 'queued') return;
    const startedAt = new Date().toISOString();
    const running = {
      ...job,
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      error: null
    };
    await this.jobRepository.put(running);
    let current = running;
    const batchResults = [];
    const batches = Array.isArray(running.batches) && running.batches.length
      ? running.batches
      : createAnalysisBatches(running.photoIds, running.photoSnapshot).map((batch) => ({
          ...batch,
          status: 'queued'
        }));
    try {
      for (const batch of batches) {
        if (
          batch.status === 'completed'
          && batch.analysisId
          && typeof this.client.getAnalysis === 'function'
        ) {
          try {
            const analysis = await this.client.getAnalysis(batch.analysisId);
            batchResults.push({ batch: { ...batch }, analysis });
            continue;
          } catch {
            batch.status = 'queued';
            batch.analysisId = null;
            batch.completedAt = null;
          }
        }
        const batchStartedAt = new Date().toISOString();
        current = {
          ...current,
          batches: batches.map((item) => item.id === batch.id
            ? { ...item, status: 'running', startedAt: batchStartedAt, error: null }
            : item)
        };
        await this.jobRepository.put(current);
        try {
          const analysisClient = await this.resolveClient(running, this.client);
          const analysis = await this.executeAnalysis(
            analysisClient,
            running.projectId,
            {
              photoIds: batch.photoIds,
              analysisType: running.analysisType,
              description: running.description
            },
            {
              jobId: running.id,
              batchId: batch.id,
              batchIndex: batch.batchIndex,
              batchCount: batches.length
            }
          );
          const batchCompletedAt = new Date().toISOString();
          const batchIssues = Array.isArray(analysis.result?.issues) ? analysis.result.issues : [];
          Object.assign(batch, {
            status: 'completed',
            analysisId: String(analysis.id),
            candidateCount: batchIssues.length,
            model: analysis.model || null,
            requestId: analysis.modelRequestId || analysis.requestId || null,
            usage: analysis.usage || null,
            promptVersion: analysis.promptVersion || null,
            startedAt: batchStartedAt,
            completedAt: batchCompletedAt,
            failedAt: null,
            error: null
          });
          batchResults.push({ batch: { ...batch }, analysis });
          const completedPhotos = batchResults.reduce(
            (total, item) => total + item.batch.photoIds.length,
            0
          );
          current = {
            ...current,
            batches: batches.map((item) => ({ ...item })),
            progress: {
              completed: completedPhotos,
              total: running.photoIds.length,
              percent: Math.round((completedPhotos / running.photoIds.length) * 100)
            },
            updatedAt: batchCompletedAt
          };
          await this.jobRepository.put(current);
        } catch (error) {
          const batchFailedAt = new Date().toISOString();
          Object.assign(batch, {
            status: 'failed',
            failedAt: batchFailedAt,
            error: {
              code: error.code || 'ANALYSIS_BATCH_FAILED',
              message: error.message
            }
          });
          current = {
            ...current,
            batches: batches.map((item) => ({ ...item })),
            updatedAt: batchFailedAt
          };
          await this.jobRepository.put(current);
          throw error;
        }
      }

      const merged = mergeAnalysisBatchResults(batchResults);
      const primaryAnalysis = batchResults[0].analysis;
      const completedAt = new Date().toISOString();
      const mergedIssues = merged.result.issues.map((candidate) => ({
        ...candidate,
        jobId: running.id,
        projectId: running.projectId,
        analysisId: String(primaryAnalysis.id),
        source: 'ai',
        candidateRevision: 1,
        auditTrail: [],
        schemaVersion: '1.1.0'
      }));
      const aggregateAnalysis = {
        ...primaryAnalysis,
        photoIds: [...running.photoIds],
        imagesCount: running.photoIds.length,
        analysisJobId: running.id,
        batchCount: batches.length,
        batchRuns: merged.batches,
        status: 'reviewing',
        completedAt,
        result: {
          ...merged.result,
          issues: mergedIssues
        },
        reviewIssues: mergedIssues,
        summary: summarizeCandidates(mergedIssues),
        model: merged.models.length === 1 ? merged.models[0] : merged.models.join(', ') || null,
        models: merged.models,
        modelRequestId: merged.requestIds.join(', ') || null,
        requestIds: merged.requestIds,
        usage: merged.usage,
        promptVersion: merged.promptVersions.length === 1
          ? merged.promptVersions[0]
          : merged.promptVersions.join(', ') || null,
        promptVersions: merged.promptVersions,
        schemaVersion: '1.1.0'
      };
      if (typeof this.client.putAnalysis === 'function') {
        await this.client.putAnalysis(aggregateAnalysis);
        for (const entry of batchResults.slice(1)) {
          await this.client.putAnalysis({
            ...entry.analysis,
            status: 'merged',
            analysisJobId: running.id,
            mergedIntoAnalysisId: String(primaryAnalysis.id),
            updatedAt: completedAt
          });
        }
      }
      const candidates = mergedIssues;
      await this.candidateRepository.putMany(candidates);
      await this.jobRepository.put({
        ...current,
        status: 'completed',
        progress: {
          completed: running.photoIds.length,
          total: running.photoIds.length,
          percent: 100
        },
        batches: batches.map((item) => ({ ...item })),
        analysisId: String(primaryAnalysis.id),
        analysisIds: batchResults.map((item) => String(item.analysis.id)),
        candidateCount: candidates.length,
        rawCandidateCount: merged.result.rawIssueCount,
        duplicateCandidateCount: merged.result.duplicateIssueCount,
        models: merged.models,
        requestIds: merged.requestIds,
        usage: merged.usage,
        promptVersions: merged.promptVersions,
        completedAt,
        updatedAt: completedAt,
        schemaVersion: '1.1.0'
      });
    } catch (error) {
      const failedAt = new Date().toISOString();
      if (typeof this.client.putAnalysis === 'function') {
        for (const entry of batchResults) {
          await this.client.putAnalysis({
            ...entry.analysis,
            status: 'failed',
            analysisJobId: running.id,
            partialResult: true,
            failedAt,
            error: {
              code: 'PARENT_BATCH_FAILED',
              message: '所属多批AI任务未全部完成，部分结果不可进入人工复核。'
            }
          }).catch(() => {});
        }
      }
      await this.jobRepository.put({
        ...current,
        status: 'failed',
        error: {
          code: error.code || 'ANALYSIS_JOB_FAILED',
          message: error.message
        },
        failedAt,
        updatedAt: failedAt
      });
    }
  }

  async recover() {
    const jobs = await this.jobRepository.list();
    for (const job of jobs.filter((item) => ACTIVE_JOB_STATUSES.has(item.status))) {
      const batches = Array.isArray(job.batches)
        ? job.batches.map((batch) => ['running', 'failed'].includes(batch.status)
            ? {
                ...batch,
                status: 'queued',
                startedAt: null,
                failedAt: null,
                error: null
              }
            : batch)
        : job.batches;
      const completedPhotos = Array.isArray(batches)
        ? batches
            .filter((batch) => batch.status === 'completed')
            .reduce((total, batch) => total + (batch.photoIds?.length || 0), 0)
        : 0;
      const queued = {
        ...job,
        status: 'queued',
        batches,
        progress: {
          completed: completedPhotos,
          total: job.photoIds?.length || 0,
          percent: job.photoIds?.length
            ? Math.round((completedPhotos / job.photoIds.length) * 100)
            : 0
        },
        recoveryCount: Number(job.recoveryCount || 0) + 1,
        updatedAt: new Date().toISOString()
      };
      await this.jobRepository.put(queued);
      this.enqueue(queued.id);
    }
  }
}
