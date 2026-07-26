import test from 'node:test';
import assert from 'node:assert/strict';
import { OfficialIssueRepository } from '../../server/repositories/official-issue-repository.mjs';

test('manual geometry validates coordinate ranges before any write', async () => {
  const repository = new OfficialIssueRepository('unused');
  repository.get = async () => ({ id: 'ISS-REAL-001', geometryRevision: 0 });
  repository.put = async (issue) => issue;

  await assert.rejects(
    () => repository.updateGeometry('ISS-REAL-001', {
      longitude: 181,
      latitude: 34,
      confirmedBy: 'GIS人员'
    }),
    (error) => error.code === 'INVALID_LONGITUDE'
  );

  const issue = await repository.updateGeometry('ISS-REAL-001', {
    longitude: 108.95,
    latitude: 34.27,
    confirmedBy: 'GIS人员'
  }, { now: '2026-07-26T00:00:00.000Z' });

  assert.deepEqual(issue.geometry, {
    type: 'Point',
    coordinates: [108.95, 34.27]
  });
  assert.equal(issue.spatialBinding.source, 'manual');
  assert.equal(issue.geometryRevision, 1);
  assert.equal(issue.geometryAudit.length, 1);
  assert.equal(issue.geometryAudit[0].before, null);
  assert.deepEqual(issue.geometryAudit[0].after.coordinates, [108.95, 34.27]);

  await assert.rejects(
    () => repository.updateGeometry('ISS-REAL-001', {
      longitude: 108.951,
      latitude: 34.271,
      confirmedBy: 'GIS人员',
      expectedGeometryRevision: 1
    }),
    (error) => error.code === 'GEOMETRY_REVISION_CONFLICT'
  );
});
