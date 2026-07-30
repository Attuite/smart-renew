import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendBuilding,
  appendCommunity,
  applyProjectBoundary,
  buildNewProject,
  createProject,
  listBuildingInventory,
  listCommunityInventory,
  normalizeBoundary,
  reviseBuilding,
  reviseCommunity,
  reviseProjectMetadata
} from '../../server/services/project-service.mjs';

test('new business project contains no demo boundary or result data', () => {
  const project = buildNewProject({
    name: '幸福路片区城市体检',
    area: '新城区',
    type: 'district',
    description: '真实业务项目'
  }, {
    id: '170000000000001',
    now: '2026-07-26T00:00:00.000Z'
  });

  assert.equal(project.id, '170000000000001');
  assert.equal(project.name, '幸福路片区城市体检');
  assert.deepEqual(project.scopeBoundary, []);
  assert.deepEqual(project.analysisIds, []);
  assert.deepEqual(project.residentialInventory.items, []);
  assert.equal(project.residentialInventory.dataSource, null);
  assert.equal('issues' in project, false);
  assert.equal('confidence' in project, false);
});

test('project name is required', () => {
  assert.throws(
    () => buildNewProject({ name: '   ' }, { id: '1' }),
    (error) => error.code === 'PROJECT_VALIDATION_FAILED' && error.details.field === 'name'
  );
});

test('project profile revision preserves boundary and business collections', () => {
  const original = {
    id: '170000000000001',
    name: '原项目',
    revision: 4,
    scopeBoundary: [[108.94, 34.26], [108.95, 34.26], [108.95, 34.27]],
    residentialInventory: { items: [{ id: 'COMM-1' }] }
  };
  const revised = reviseProjectMetadata(original, {
    name: '修正项目',
    area: '修正区域',
    expectedRevision: 4
  });
  assert.equal(revised.revision, 5);
  assert.equal(revised.name, '修正项目');
  assert.equal(revised.scopeBoundary, original.scopeBoundary);
  assert.equal(revised.residentialInventory, original.residentialInventory);
});

test('createProject persists through the smart-renew adapter', async () => {
  let saved = null;
  const client = {
    async putProject(project) {
      saved = project;
      return project;
    }
  };

  const project = await createProject(client, { name: '真实项目' }, {
    id: '170000000000002',
    now: '2026-07-26T00:00:00.000Z'
  });

  assert.equal(saved.id, '170000000000002');
  assert.equal(project.status, 'created');
});

test('manual community is appended without inventing buildings or coordinates', () => {
  const { project, community } = appendCommunity({
    id: '170000000000001',
    revision: 1,
    residentialInventory: { items: [], deletedItems: [] }
  }, {
    name: '幸福里小区',
    address: '幸福路1号'
  }, {
    idSuffix: 'fixed',
    now: '2026-07-26T00:00:00.000Z'
  });

  assert.equal(community.id, 'COMM-170000000000001-fixed');
  assert.deepEqual(community.buildings, []);
  assert.equal('coordinates' in community, false);
  assert.equal(project.revision, 2);
  assert.equal(project.residentialInventory.items.length, 1);
  assert.equal(project.residentialInventory.dataSource, '人工录入');
});

test('real project boundary is validated and produces calculated area and center', () => {
  const boundary = normalizeBoundary({
    coordinates: [
      [108.94, 34.26],
      [108.96, 34.26],
      [108.96, 34.28],
      [108.94, 34.28],
      [108.94, 34.26]
    ],
    crs: 'WGS84'
  });
  assert.equal(boundary.coordinates.length, 4);
  assert.ok(boundary.areaSqKm > 4 && boundary.areaSqKm < 5);
  assert.ok(Math.abs(boundary.center[0] - 108.95) < 1e-10);
  assert.ok(Math.abs(boundary.center[1] - 34.27) < 1e-10);

  const project = applyProjectBoundary({ id: '1', revision: 3 }, {
    coordinates: boundary.coordinates,
    crs: 'WGS84',
    expectedRevision: 3,
    updatedBy: 'GIS人员'
  }, { now: '2026-07-26T00:00:00.000Z' });
  assert.equal(project.revision, 4);
  assert.equal(project.scopeBoundarySource, 'manual-coordinate-entry');
  assert.equal(project.scopeBoundaryGeometry.type, 'Polygon');
});

test('project boundary accepts MultiPolygon and holes while preserving a legacy projection', () => {
  const project = applyProjectBoundary({ id: '1', revision: 3 }, {
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [[
          [108.94, 34.26],
          [108.98, 34.26],
          [108.98, 34.30],
          [108.94, 34.30],
          [108.94, 34.26]
        ], [
          [108.95, 34.27],
          [108.96, 34.27],
          [108.96, 34.28],
          [108.95, 34.28],
          [108.95, 34.27]
        ]],
        [[
          [109.04, 34.26],
          [109.05, 34.26],
          [109.05, 34.27],
          [109.04, 34.27],
          [109.04, 34.26]
        ]]
      ]
    },
    crs: 'WGS84',
    expectedRevision: 3,
    updatedBy: 'GIS人员'
  });
  assert.equal(project.scopeBoundaryGeometry.type, 'MultiPolygon');
  assert.equal(project.scopePolygonCount, 2);
  assert.equal(project.scopeHoleCount, 1);
  assert.equal(project.scopeBoundary.length, 4);
});

test('self-intersecting project boundary is rejected', () => {
  assert.throws(
    () => normalizeBoundary({
      coordinates: [
        [108.94, 34.26],
        [108.96, 34.28],
        [108.96, 34.26],
        [108.94, 34.28]
      ]
    }),
    (error) => error.code === 'PROJECT_VALIDATION_FAILED'
  );
});

test('project boundary cannot be changed without an accountable editor', () => {
  assert.throws(
    () => applyProjectBoundary({ id: '1', revision: 3 }, {
      coordinates: [[108.94, 34.26], [108.96, 34.26], [108.96, 34.28]],
      expectedRevision: 3
    }),
    (error) => error.code === 'PROJECT_VALIDATION_FAILED' && error.details.field === 'updatedBy'
  );
});

test('building is appended to the selected real community', () => {
  const project = {
    id: '170000000000001',
    revision: 2,
    residentialInventory: {
      items: [{ id: 'COMM-1', name: '幸福里', buildings: [] }],
      deletedItems: []
    }
  };
  const result = appendBuilding(project, 'COMM-1', {
    name: '1号楼',
    householdCount: 96,
    unitCount: 3,
    floorCount: 8
  }, {
    idSuffix: 'fixed',
    now: '2026-07-26T00:00:00.000Z'
  });
  assert.equal(result.building.name, '1号楼');
  assert.equal(result.project.residentialInventory.items[0].buildingCount, 1);
  assert.equal(result.project.residentialInventory.items[0].householdCount, 96);
  assert.equal(result.project.revision, 3);
});

test('building edits, soft deactivation and recovery preserve the same identity', () => {
  const project = {
    id: '170000000000001',
    revision: 3,
    residentialInventory: {
      items: [{
        id: 'COMM-1',
        buildings: [{
          id: 'BLD-1',
          name: '原楼栋',
          status: 'active',
          buildingRevision: 1,
          householdCount: 20
        }]
      }]
    }
  };
  const deactivated = reviseBuilding(project, 'COMM-1', 'BLD-1', {
    name: '修正楼栋',
    status: 'inactive',
    expectedRevision: 1
  }, { now: '2026-07-26T01:00:00.000Z' });
  assert.equal(deactivated.building.id, 'BLD-1');
  assert.equal(deactivated.building.status, 'inactive');
  assert.equal(deactivated.project.residentialInventory.items[0].buildingCount, 0);

  const inventory = listBuildingInventory(deactivated.project, 'COMM-1');
  assert.equal(inventory[0].status, 'inactive');
  const recovered = reviseBuilding(deactivated.project, 'COMM-1', 'BLD-1', {
    status: 'active',
    expectedRevision: 2
  });
  assert.equal(recovered.building.status, 'active');
  assert.equal(recovered.project.residentialInventory.items[0].buildingCount, 1);
});

test('community edits and soft recovery preserve nested buildings', () => {
  const project = {
    id: '170000000000001',
    revision: 2,
    residentialInventory: {
      items: [{
        id: 'COMM-1',
        name: '原小区',
        status: 'active',
        communityRevision: 1,
        buildings: [{ id: 'BLD-1', name: '1号楼', status: 'active' }]
      }]
    }
  };
  const inactive = reviseCommunity(project, 'COMM-1', {
    name: '修正小区',
    status: 'inactive',
    expectedRevision: 1
  });
  assert.equal(inactive.community.id, 'COMM-1');
  assert.equal(inactive.community.status, 'inactive');
  assert.equal(inactive.project.residentialInventory.items[0].buildings[0].id, 'BLD-1');
  assert.equal(listCommunityInventory(inactive.project)[0].buildingDetailCount, 1);

  const recovered = reviseCommunity(inactive.project, 'COMM-1', {
    status: 'active',
    expectedRevision: 2
  });
  assert.equal(recovered.community.status, 'active');
});
