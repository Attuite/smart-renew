import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeFieldTask,
  createFieldTask,
  createFieldTaskUpload,
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
    async get(id) {
      return items.find((item) => item.id === id) || null;
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

test('field task uploads reuse persistent upload sessions and complete only after every photo', async () => {
  const references = memoryReferences();
  const sessions = new Map();
  const uploadRepository = {
    async get(id) { return sessions.get(id) || null; },
    async put(item) { sessions.set(item.id, item); return item; },
    async list(projectId) {
      return [...sessions.values()].filter((item) => item.projectId === String(projectId));
    },
    async findByClientRequest(projectId, requestId) {
      return [...sessions.values()].find((item) =>
        item.projectId === String(projectId) && item.clientRequestId === requestId
      ) || null;
    }
  };
  const task = {
    id: 'field-task-1001-survey-002',
    projectId: '1001',
    clientTaskId: 'survey-002',
    communityId: 'COMM-1',
    communityName: '幸福里',
    buildingId: 'BLD-1',
    buildingName: '1号楼',
    problemCode: 'PRB-001',
    collectorId: '采集员',
    photoCount: 1,
    status: 'pending-upload'
  };
  let completedInput = null;
  const adapter = {
    async getTask() { return task; },
    async completeTask(id, input) {
      completedInput = input;
      return { ...task, id, status: 'completed', uploadedPhotoCount: input.uploadedPhotoCount };
    }
  };
  await references.put({
    id: task.id,
    projectId: task.projectId,
    revision: 1,
    audit: [],
    source: 'smart-renew'
  });
  const project = {
    id: '1001',
    residentialInventory: {
      items: [{
        id: 'COMM-1',
        name: '幸福里',
        buildings: [{ id: 'BLD-1', name: '1号楼', status: 'active' }]
      }]
    }
  };
  const created = await createFieldTaskUpload(
    { async getProject() { return project; } },
    adapter,
    references,
    uploadRepository,
    project.id,
    task.id,
    {
      name: '外业照片.jpg',
      mimeType: 'image/jpeg',
      size: 4,
      clientRequestId: 'field-upload-1',
      problemCode: 'PRB-001',
      createdBy: '采集员'
    },
    { id: 'UPL-field-task-0001', now: '2026-08-09T01:00:00.000Z' }
  );
  assert.equal(created.session.fieldTaskId, task.id);
  await assert.rejects(
    () => completeFieldTask(
      adapter,
      references,
      uploadRepository,
      project.id,
      task.id,
      { completedBy: '采集员' }
    ),
    (error) => error.code === 'FIELD_TASK_PHOTOS_INCOMPLETE'
  );
  await uploadRepository.put({
    ...created.session,
    status: 'completed',
    photoId: 'PHOTO-1'
  });
  const completed = await completeFieldTask(
    adapter,
    references,
    uploadRepository,
    project.id,
    task.id,
    { completedBy: '采集员' },
    { now: '2026-08-09T02:00:00.000Z' }
  );
  assert.equal(completed.status, 'completed');
  assert.equal(completed.uploadedPhotoCount, 1);
  assert.equal(completedInput.uploadedPhotoCount, 1);
  assert.deepEqual((await references.get(task.id)).photoIds, ['PHOTO-1']);
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
