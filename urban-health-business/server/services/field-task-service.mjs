import { createUploadSession } from './upload-service.mjs';

function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function taskError(message, status = 400, code = 'FIELD_TASK_INVALID', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

async function getReference(repository, taskId) {
  if (typeof repository.get === 'function') return repository.get(taskId);
  const items = await repository.list('');
  return items.find((item) => item.id === String(taskId)) || null;
}

export function hydrateFieldTask(task, reference = null, sessions = []) {
  const related = (Array.isArray(sessions) ? sessions : [])
    .filter((session) => String(session.fieldTaskId || '') === String(task.id));
  const completedSessions = related.filter((session) => session.status === 'completed');
  const failedSessions = related.filter((session) => session.status === 'failed');
  const activeUploads = related.filter((session) => ['ready', 'uploading'].includes(session.status));
  const expectedPhotoCount = Math.max(0, Number(task.photoCount) || 0);
  let status = task.status || reference?.status || 'pending-upload';
  if (task.status !== 'completed') {
    if (failedSessions.length && completedSessions.length) status = 'partially-uploaded';
    else if (failedSessions.length) status = 'failed';
    else if (activeUploads.length) status = 'uploading';
    else if (completedSessions.length < expectedPhotoCount) {
      status = completedSessions.length ? 'partially-uploaded' : 'pending-upload';
    }
  }
  return {
    ...task,
    status,
    expectedPhotoCount,
    uploadedPhotoCount: completedSessions.length,
    uploadSessionIds: related.map((session) => session.id),
    photoIds: completedSessions.map((session) => session.photoId).filter(Boolean),
    failedUploads: failedSessions.map((session) => ({
      sessionId: session.id,
      fileName: session.file?.name || '',
      code: session.error?.code || 'UPLOAD_FAILED',
      message: session.error?.message || '照片上传失败',
      attempts: Number(session.attempts) || 0
    })),
    taskRevision: Math.max(1, Number(reference?.revision) || 1),
    taskAudit: Array.isArray(reference?.audit) ? reference.audit : [],
    source: 'smart-renew'
  };
}

export async function createFieldTask(adapter, referenceRepository, projectId, input, options = {}) {
  const result = await adapter.createTask({
    ...input,
    projectId: String(projectId)
  });
  const task = result.task;
  const now = options.now || new Date().toISOString();
  const existing = await getReference(referenceRepository, task.id);
  await referenceRepository.put({
    ...(existing || {}),
    id: String(task.id),
    projectId: String(projectId),
    clientTaskId: clean(task.clientTaskId || input?.clientTaskId, 80),
    status: task.status || 'pending-upload',
    expectedPhotoCount: Math.max(0, Number(task.photoCount) || 0),
    uploadSessionIds: existing?.uploadSessionIds || [],
    photoIds: existing?.photoIds || [],
    revision: Math.max(1, Number(existing?.revision) || 1),
    audit: existing?.audit || [{ action: 'created', by: clean(task.collectorId, 120), at: now }],
    createdAt: task.createdAt || existing?.createdAt || now,
    referencedAt: now,
    updatedAt: now,
    source: 'smart-renew',
    schemaVersion: '2.0.0'
  });
  return {
    item: hydrateFieldTask(task, existing, []),
    duplicated: Boolean(result.duplicated),
    storage: result.storage || null
  };
}

export async function listFieldTasks(
  adapter,
  referenceRepository,
  projectId,
  options = {}
) {
  const [references, sessions] = await Promise.all([
    referenceRepository.list(projectId),
    options.uploadSessionRepository
      ? options.uploadSessionRepository.list(projectId)
      : Promise.resolve([])
  ]);
  const results = await Promise.all(references.map(async (reference) => {
    try {
      const task = await adapter.getTask(reference.id);
      return { item: hydrateFieldTask(task, reference, sessions), error: null };
    } catch (error) {
      return {
        item: null,
        error: {
          taskId: reference.id,
          code: error.code || 'FIELD_TASK_UNAVAILABLE',
          message: error.message
        }
      };
    }
  }));
  return {
    items: results.filter((result) => result.item).map((result) => result.item),
    errors: results.filter((result) => result.error).map((result) => result.error),
    source: 'smart-renew',
    referenceCount: references.length
  };
}

export async function getFieldTask(
  adapter,
  referenceRepository,
  uploadSessionRepository,
  projectId,
  taskId
) {
  const [task, reference, sessions] = await Promise.all([
    adapter.getTask(taskId),
    getReference(referenceRepository, taskId),
    uploadSessionRepository.list(projectId)
  ]);
  if (String(task?.projectId) !== String(projectId)) {
    throw taskError('外业任务不属于当前项目。', 404, 'FIELD_TASK_NOT_FOUND');
  }
  return hydrateFieldTask(task, reference, sessions);
}

export async function createFieldTaskUpload(
  client,
  adapter,
  referenceRepository,
  uploadSessionRepository,
  projectId,
  taskId,
  input,
  options = {}
) {
  const task = await adapter.getTask(taskId);
  if (String(task?.projectId) !== String(projectId)) {
    throw taskError('外业任务不属于当前项目。', 404, 'FIELD_TASK_NOT_FOUND');
  }
  if (task.status === 'completed') {
    throw taskError('已完成外业任务不能继续追加照片。', 409, 'FIELD_TASK_COMPLETED');
  }
  const requestedProblemCode = clean(input?.problemCode, 40);
  if (requestedProblemCode && requestedProblemCode !== clean(task.problemCode, 40)) {
    throw taskError('上传照片的问题编码与外业任务不一致。', 409, 'FIELD_TASK_PROBLEM_MISMATCH');
  }
  const outcome = await createUploadSession(client, uploadSessionRepository, {
    ...input,
    projectId: String(projectId),
    communityId: task.communityId,
    buildingId: task.buildingId,
    fieldTaskId: String(task.id),
    kind: 'original'
  }, options);
  const now = options.now || new Date().toISOString();
  const reference = await getReference(referenceRepository, task.id) || {
    id: String(task.id),
    projectId: String(projectId),
    clientTaskId: task.clientTaskId,
    revision: 0,
    audit: [],
    createdAt: task.createdAt || now,
    source: 'smart-renew'
  };
  const uploadSessionIds = [...new Set([
    ...(reference.uploadSessionIds || []),
    outcome.session.id
  ])];
  await referenceRepository.put({
    ...reference,
    status: 'uploading',
    uploadSessionIds,
    revision: Math.max(0, Number(reference.revision) || 0) + 1,
    updatedAt: now,
    audit: [
      ...(reference.audit || []),
      {
        action: outcome.duplicated ? 'upload-session-reused' : 'upload-session-created',
        sessionId: outcome.session.id,
        by: clean(input?.createdBy || task.collectorId, 120),
        at: now
      }
    ],
    schemaVersion: '2.0.0'
  });
  return outcome;
}

export async function completeFieldTask(
  adapter,
  referenceRepository,
  uploadSessionRepository,
  projectId,
  taskId,
  input = {},
  options = {}
) {
  const [task, reference, sessions] = await Promise.all([
    adapter.getTask(taskId),
    getReference(referenceRepository, taskId),
    uploadSessionRepository.list(projectId)
  ]);
  if (String(task?.projectId) !== String(projectId)) {
    throw taskError('外业任务不属于当前项目。', 404, 'FIELD_TASK_NOT_FOUND');
  }
  const actor = clean(input.completedBy, 120);
  if (!actor) throw taskError('请填写外业任务完成人员。', 400, 'FIELD_TASK_COMPLETER_REQUIRED');
  const related = sessions.filter((session) => String(session.fieldTaskId || '') === String(task.id));
  const completedSessions = related.filter((session) => session.status === 'completed');
  const expected = Math.max(0, Number(task.photoCount) || 0);
  if (completedSessions.length < expected) {
    throw taskError('仍有照片未上传完成。', 409, 'FIELD_TASK_PHOTOS_INCOMPLETE', {
      expectedPhotoCount: expected,
      uploadedPhotoCount: completedSessions.length,
      failedSessionIds: related.filter((session) => session.status === 'failed').map((session) => session.id)
    });
  }
  const completed = await adapter.completeTask(task.id, {
    uploadedPhotoCount: completedSessions.length,
    completedBy: actor
  });
  const now = options.now || new Date().toISOString();
  const updatedReference = {
    ...(reference || { id: task.id, projectId: String(projectId), createdAt: task.createdAt || now }),
    status: 'completed',
    uploadSessionIds: related.map((session) => session.id),
    photoIds: completedSessions.map((session) => session.photoId).filter(Boolean),
    revision: Math.max(0, Number(reference?.revision) || 0) + 1,
    completedAt: completed.completedAt || now,
    completedBy: actor,
    updatedAt: now,
    audit: [
      ...(reference?.audit || []),
      { action: 'completed', by: actor, photoCount: completedSessions.length, at: now }
    ],
    source: 'smart-renew',
    schemaVersion: '2.0.0'
  };
  await referenceRepository.put(updatedReference);
  return hydrateFieldTask(completed, updatedReference, related);
}

export async function retryFieldTaskUploads(
  adapter,
  referenceRepository,
  uploadSessionRepository,
  projectId,
  taskId,
  input = {},
  options = {}
) {
  const task = await adapter.getTask(taskId);
  if (String(task?.projectId) !== String(projectId)) {
    throw taskError('外业任务不属于当前项目。', 404, 'FIELD_TASK_NOT_FOUND');
  }
  if (task.status === 'completed') {
    throw taskError('已完成外业任务不需要重试。', 409, 'FIELD_TASK_COMPLETED');
  }
  const retriedBy = clean(input.retriedBy, 120);
  if (!retriedBy) throw taskError('请填写外业任务重试人员。', 400, 'FIELD_TASK_RETRY_ACTOR_REQUIRED');
  const [reference, sessions] = await Promise.all([
    getReference(referenceRepository, taskId),
    uploadSessionRepository.list(projectId)
  ]);
  const failed = sessions.filter((session) =>
    String(session.fieldTaskId || '') === String(task.id) && session.status === 'failed'
  );
  if (!failed.length) {
    throw taskError('当前任务没有可重试的失败照片。', 409, 'FIELD_TASK_RETRY_NOT_AVAILABLE');
  }
  const now = options.now || new Date().toISOString();
  const updatedReference = {
    ...reference,
    status: 'failed',
    revision: Math.max(0, Number(reference?.revision) || 0) + 1,
    updatedAt: now,
    audit: [
      ...(reference?.audit || []),
      { action: 'retry-requested', by: retriedBy, sessionIds: failed.map((item) => item.id), at: now }
    ],
    schemaVersion: '2.0.0'
  };
  await referenceRepository.put(updatedReference);
  return {
    item: hydrateFieldTask(task, updatedReference, sessions),
    retryableSessions: failed.map((session) => ({
      id: session.id,
      file: session.file,
      attempts: session.attempts,
      error: session.error
    }))
  };
}
