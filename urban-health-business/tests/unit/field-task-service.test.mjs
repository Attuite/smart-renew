import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFieldTask,
  listFieldTasks
} from '../../server/services/field-task-service.mjs';

function memoryReferences() {
  const items = [];
  return {
    items,
    async put(item) {
      const index = items.findIndex((candidate) => candidate.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push(item);
      return item;
    },
    async list(projectId) {
      return items.filter((item) => item.projectId === String(projectId));
    }
  };
}

test('field task service stores only a source reference and hydrates from smart-renew', async () => {
  const repository = memoryReferences();
  const tasks = new Map();
  const adapter = {
    async createTask(input) {
      const task = {
        id: `field-task-${input.projectId}-${input.clientTaskId}`,
        projectId: input.projectId,
        clientTaskId: input.clientTaskId,
        description: input.description
      };
      tasks.set(task.id, task);
      return { task, duplicated: false, storage: 'local-filesystem' };
    },
    async getTask(id) {
      return tasks.get(id);
    }
  };

  const created = await createFieldTask(adapter, repository, '1001', {
    clientTaskId: 'survey-001',
    description: '现场采集'
  }, { now: '2026-07-26T00:00:00.000Z' });
  assert.equal(created.item.description, '现场采集');
  assert.equal(repository.items[0].source, 'smart-renew');
  assert.equal(repository.items[0].description, undefined);

  const listed = await listFieldTasks(adapter, repository, '1001');
  assert.equal(listed.referenceCount, 1);
  assert.equal(listed.items[0].description, '现场采集');
  assert.deepEqual(listed.errors, []);
});

test('field task list reports unavailable upstream tasks without inventing content', async () => {
  const repository = memoryReferences();
  await repository.put({
    id: 'field-task-1001-missing',
    projectId: '1001',
    source: 'smart-renew'
  });
  const result = await listFieldTasks({
    async getTask() {
      const error = new Error('任务不存在');
      error.code = 'UPSTREAM_ERROR';
      throw error;
    }
  }, repository, '1001');
  assert.deepEqual(result.items, []);
  assert.equal(result.errors[0].taskId, 'field-task-1001-missing');
});
