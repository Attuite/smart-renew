import { randomUUID } from 'node:crypto';
import { runAnalysis } from './analysis-service.mjs';

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
  if (photoIds.length > 20) throw jobError('单个AI任务最多20张照片。', 400, 'PHOTO_LIMIT_EXCEEDED');
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
  const job = {
    id: options.id || `AJOB-${randomUUID()}`,
    clientRequestId,
    parentJobId: clean(input?.parentJobId, 140) || null,
    projectId: String(project.id),
    projectRevision: Number(project.revision) || 0,
    photoIds,
    photoSnapshot: photoIds.map((id) => {
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
    }),
    analysisType: clean(input?.analysisType, 80) || '综合巡检分析',
    description: clean(input?.description, 1000),
    status: 'queued',
    progress: {
      completed: 0,
      total: photoIds.length,
      percent: 0
    },
    analysisId: null,
    candidateCount: 0,
    error: null,
    recoveryCount: 0,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    schemaVersion: '1.0.0'
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
    clientRequestId: options.clientRequestId || `retry:${parent.id}:${options.nowMs ?? Date.now()}`
  }, options);
}

export class AnalysisJobRunner {
  constructor(options) {
    this.client = options.client;
    this.jobRepository = options.jobRepository;
    this.candidateRepository = options.candidateRepository;
    this.executeAnalysis = options.executeAnalysis || runAnalysis;
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
    try {
      const analysis = await this.executeAnalysis(
        this.client,
        running.projectId,
        {
          photoIds: running.photoIds,
          analysisType: running.analysisType,
          description: running.description
        }
      );
      const candidates = (analysis.result?.issues || []).map((candidate) => ({
        ...candidate,
        jobId: running.id,
        projectId: running.projectId,
        analysisId: String(analysis.id),
        source: 'ai',
        candidateRevision: 1,
        auditTrail: [],
        schemaVersion: '1.0.0'
      }));
      await this.candidateRepository.putMany(candidates);
      const completedAt = new Date().toISOString();
      await this.jobRepository.put({
        ...running,
        status: 'completed',
        progress: {
          completed: running.photoIds.length,
          total: running.photoIds.length,
          percent: 100
        },
        analysisId: String(analysis.id),
        candidateCount: candidates.length,
        completedAt,
        updatedAt: completedAt
      });
    } catch (error) {
      const failedAt = new Date().toISOString();
      await this.jobRepository.put({
        ...running,
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
      const queued = {
        ...job,
        status: 'queued',
        recoveryCount: Number(job.recoveryCount || 0) + 1,
        updatedAt: new Date().toISOString()
      };
      await this.jobRepository.put(queued);
      this.enqueue(queued.id);
    }
  }
}
