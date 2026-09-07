import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCollection } from '../../server/services/collection-validation-service.mjs';

function projectFixture() {
  return {
    id: '1001',
    name: '真实项目',
    revision: 3,
    scopeBoundary: [[108.94, 34.26], [108.96, 34.26], [108.96, 34.28]],
    residentialInventory: {
      items: [{
        id: 'COMM-1',
        name: '测试小区',
        status: 'active',
        buildings: [{ id: 'BLD-1', name: '1号楼', status: 'active' }]
      }]
    }
  };
}

test('complete collection passes every required rule without demo counts', () => {
  const result = assessCollection({
    project: projectFixture(),
    photos: [{
      id: 'PHOTO-1',
      communityId: 'COMM-1',
      buildingId: 'BLD-1',
      coordinates: [108.95, 34.27],
      governanceStatus: 'active'
    }],
    uploadSessions: [{ id: 'UPL-1', status: 'completed' }],
    fieldRecords: [{ id: 'FIELD-1' }]
  }, { computedAt: '2026-07-26T10:00:00.000Z' });

  assert.equal(result.status, 'complete');
  assert.equal(result.completenessPercent, 100);
  assert.equal(result.passedRequired, result.requiredCount);
  assert.equal(JSON.stringify(result).includes('42'), false);
});

test('missing boundary and invalid photo binding are explicit required failures', () => {
  const project = projectFixture();
  project.scopeBoundary = [];
  const result = assessCollection({
    project,
    photos: [{
      id: 'PHOTO-BAD',
      communityId: 'COMM-MISSING',
      governanceStatus: 'active'
    }],
    uploadSessions: [{ id: 'UPL-ACTIVE', status: 'uploading' }]
  });
  const checks = Object.fromEntries(result.checks.map((item) => [item.code, item]));

  assert.equal(result.status, 'incomplete');
  assert.equal(checks.PROJECT_BOUNDARY_REQUIRED.status, 'failed');
  assert.equal(checks.PHOTO_BINDINGS_VALID.status, 'failed');
  assert.equal(checks.UPLOAD_QUEUE_SETTLED.status, 'failed');
  assert.deepEqual(checks.PHOTO_BINDINGS_VALID.details.invalidPhotoIds, ['PHOTO-BAD']);
});

test('inactive photos do not satisfy the active evidence requirement', () => {
  const result = assessCollection({
    project: projectFixture(),
    photos: [{
      id: 'PHOTO-INACTIVE',
      communityId: 'COMM-1',
      governanceStatus: 'inactive'
    }]
  });
  const photoCheck = result.checks.find((item) => item.code === 'ACTIVE_PHOTO_REQUIRED');

  assert.equal(photoCheck.status, 'failed');
  assert.equal(photoCheck.details.count, 0);
});
