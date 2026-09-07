import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ResidentialDiscoveryRepository } from '../../server/repositories/residential-discovery-repository.mjs';
import {
  confirmResidentialDiscoveryRun,
  createResidentialDiscoveryRun,
  findCommunityReferences,
  listResidentialDiscoveryRuns
} from '../../server/services/residential-discovery-service.mjs';
import {
  mergeCommunityInventory,
  splitCommunityInventory
} from '../../server/services/project-service.mjs';

function baseProject() {
  return {
    id: '170000000000001',
    name: '真实项目',
    revision: 3,
    scopeBoundary: [[108.94, 34.26], [108.96, 34.26], [108.96, 34.28], [108.94, 34.28]],
    scopeBoundaryCrs: 'GCJ02',
    scopeCenter: [108.95, 34.27],
    scopeAreaSqKm: 4,
    boundaryUpdatedAt: '2026-08-09T00:00:00.000Z',
    residentialInventory: { items: [], deletedItems: [] }
  };
}

function memoryRepository() {
  const records = new Map();
  return {
    async put(run) {
      records.set(run.id, structuredClone(run));
      return structuredClone(run);
    },
    async get(id) {
      return records.has(id) ? structuredClone(records.get(id)) : null;
    },
    async list(projectId) {
      return [...records.values()].filter((item) => item.projectId === String(projectId))
        .map((item) => structuredClone(item));
    }
  };
}

function provider() {
  return {
    async searchAround() {
      return {
        count: 1,
        items: [{
          id: 'AMAP-001',
          name: '幸福里小区',
          address: '幸福路1号',
          type: '商务住宅;住宅区;住宅小区',
          typecode: '120300',
          location: [108.95, 34.27],
          distance: 120
        }]
      };
    }
  };
}

test('residential discovery persists a pending snapshot without writing the project ledger', async () => {
  const project = baseProject();
  let projectWrites = 0;
  const client = {
    async getProject() { return structuredClone(project); },
    async putProject() { projectWrites += 1; }
  };
  const repository = memoryRepository();
  const run = await createResidentialDiscoveryRun(
    client,
    repository,
    provider(),
    project.id,
    { createdBy: '规划人员' },
    { id: 'RDRUN-fixed-0001', now: '2026-08-09T01:00:00.000Z' }
  );

  assert.equal(projectWrites, 0);
  assert.equal(run.status, 'completed');
  assert.equal(run.candidates.length, 1);
  assert.equal(run.candidates[0].decisionStatus, 'pending');
  assert.equal(project.residentialInventory.items.length, 0);
});

test('confirming discovery creates one formal community and retries idempotently', async () => {
  let project = baseProject();
  let projectWrites = 0;
  const client = {
    async getProject() { return structuredClone(project); },
    async putProject(next) { project = structuredClone(next); projectWrites += 1; return next; }
  };
  const repository = memoryRepository();
  const run = await createResidentialDiscoveryRun(
    client,
    repository,
    provider(),
    project.id,
    { createdBy: '规划人员' },
    { id: 'RDRUN-fixed-0002', now: '2026-08-09T01:00:00.000Z' }
  );
  const input = {
    projectId: project.id,
    candidateIds: [run.candidates[0].normalizedId],
    confirmedBy: '复核人员',
    clientRequestId: 'confirm-fixed-1',
    expectedRevision: 1
  };
  const first = await confirmResidentialDiscoveryRun(client, repository, run.id, input, {
    now: '2026-08-09T02:00:00.000Z',
    idSuffixes: { [run.candidates[0].normalizedId]: 'fixed' }
  });
  const second = await confirmResidentialDiscoveryRun(client, repository, run.id, input);

  assert.equal(first.communities.length, 1);
  assert.equal(first.communities[0].source, 'amap-residential-discovery');
  assert.equal(first.communities[0].discovery.providerId, 'AMAP-001');
  assert.equal(project.residentialInventory.items.length, 1);
  assert.equal(projectWrites, 1);
  assert.equal(second.duplicated, true);
  assert.equal(second.communities[0].id, first.communities[0].id);
});

test('a boundary change makes an old residential discovery run stale', async () => {
  const repository = memoryRepository();
  const project = baseProject();
  await repository.put({
    id: 'RDRUN-fixed-0003',
    projectId: project.id,
    status: 'completed',
    revision: 1,
    sourceSnapshot: { boundaryUpdatedAt: '2026-08-08T00:00:00.000Z' },
    createdAt: '2026-08-09T00:00:00.000Z'
  });
  const runs = await listResidentialDiscoveryRuns(
    { async getProject() { return project; } },
    repository,
    project.id
  );
  assert.equal(runs[0].status, 'stale');
  assert.equal(runs[0].stale, true);
});

test('community merge keeps the target identity and split restores original identities', () => {
  const project = {
    ...baseProject(),
    residentialInventory: {
      items: [
        { id: 'COMM-A', name: '幸福里A区', status: 'active', communityRevision: 2, buildings: [] },
        { id: 'COMM-B', name: '幸福里B区', status: 'active', communityRevision: 1, buildings: [] }
      ],
      deletedItems: []
    }
  };
  const merged = mergeCommunityInventory(project, {
    communityIds: ['COMM-A', 'COMM-B'],
    targetCommunityId: 'COMM-A',
    expectedProjectRevision: 3,
    expectedRevisions: { 'COMM-A': 2, 'COMM-B': 1 },
    referenceStrategy: 'block-if-referenced',
    mergedBy: '台账人员'
  }, {
    now: '2026-08-09T03:00:00.000Z',
    idSuffix: 'fixed',
    referenceSummary: { total: 0, counts: {}, findings: [] }
  });
  assert.equal(merged.community.id, 'COMM-A');
  assert.deepEqual(merged.community.members.map((item) => item.id), ['COMM-A', 'COMM-B']);
  assert.equal(merged.project.residentialInventory.items.length, 1);

  const split = splitCommunityInventory(merged.project, 'COMM-A', {
    expectedRevision: merged.community.communityRevision,
    referenceStrategy: 'block-if-referenced',
    splitBy: '台账人员'
  }, {
    now: '2026-08-09T04:00:00.000Z',
    idSuffix: 'fixed',
    referenceSummary: { total: 0, counts: {}, findings: [] }
  });
  assert.deepEqual(split.communities.map((item) => item.id), ['COMM-A', 'COMM-B']);
});

test('community governance blocks a merge when downstream records reference a selected community', () => {
  const project = {
    ...baseProject(),
    residentialInventory: {
      items: [
        { id: 'COMM-A', name: 'A', status: 'active', communityRevision: 1, buildings: [] },
        { id: 'COMM-B', name: 'B', status: 'active', communityRevision: 1, buildings: [] }
      ]
    }
  };
  const summary = findCommunityReferences(['COMM-A', 'COMM-B'], {
    photos: [{ id: 'PHOTO-1', communityId: 'COMM-B' }]
  });
  assert.equal(summary.total, 1);
  assert.throws(
    () => mergeCommunityInventory(project, {
      communityIds: ['COMM-A', 'COMM-B'],
      referenceStrategy: 'block-if-referenced',
      mergedBy: '台账人员'
    }, { referenceSummary: summary }),
    (error) => error.code === 'COMMUNITY_REFERENCES_EXIST' && error.status === 409
  );
});

test('residential discovery repository persists and lists snapshots', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'residential-discovery-'));
  try {
    const repository = new ResidentialDiscoveryRepository(root);
    await repository.put({
      id: 'RDRUN-persist-0001',
      projectId: '1',
      createdAt: '2026-08-09T00:00:00.000Z'
    });
    assert.equal((await repository.get('RDRUN-persist-0001')).projectId, '1');
    assert.equal((await repository.list('1')).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
