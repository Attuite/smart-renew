function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export async function createFieldTask(adapter, referenceRepository, projectId, input, options = {}) {
  const result = await adapter.createTask({
    ...input,
    projectId: String(projectId)
  });
  const task = result.task;
  const now = options.now || new Date().toISOString();
  await referenceRepository.put({
    id: String(task.id),
    projectId: String(projectId),
    clientTaskId: clean(task.clientTaskId || input?.clientTaskId, 80),
    createdAt: task.createdAt || now,
    referencedAt: now,
    source: 'smart-renew'
  });
  return {
    item: task,
    duplicated: Boolean(result.duplicated),
    storage: result.storage || null
  };
}

export async function listFieldTasks(adapter, referenceRepository, projectId) {
  const references = await referenceRepository.list(projectId);
  const results = await Promise.all(references.map(async (reference) => {
    try {
      return { item: await adapter.getTask(reference.id), error: null };
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
