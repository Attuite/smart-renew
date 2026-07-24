const TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,79}$/;

function text(value, maxLength = 200) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function nonNegativeInteger(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function activeCommunities(project) {
  const items = project?.residentialInventory?.items;
  return Array.isArray(items) ? items.filter((item) => item?.status !== 'deleted') : [];
}

export function communityId(item, index) {
  return text(item?.id || item?.sourceId || `community-${index + 1}`, 120);
}

export function findCommunity(project, requestedId) {
  const id = text(requestedId, 120);
  return activeCommunities(project)
    .map((item, index) => ({ item, id: communityId(item, index) }))
    .find((entry) => entry.id === id) || null;
}

export function listFieldCommunities(project) {
  return activeCommunities(project).map((item, index) => {
    const buildings = Array.isArray(item.buildings)
      ? item.buildings.filter((building) => building?.status !== 'deleted')
      : [];
    return {
      id: communityId(item, index),
      projectId: String(project.id),
      name: text(item.name || '未命名小区'),
      address: text(item.address, 300),
      buildingCount: nonNegativeInteger(item.buildingCount),
      householdCount: nonNegativeInteger(item.householdCount),
      buildingDetailCount: buildings.length
    };
  });
}

export function listFieldBuildings(project, requestedCommunityId) {
  const community = findCommunity(project, requestedCommunityId);
  if (!community) return null;
  const buildings = Array.isArray(community.item.buildings)
    ? community.item.buildings.filter((building) => building?.status !== 'deleted')
    : [];
  return buildings.map((building, index) => ({
    id: text(building.id || `building-${index + 1}`, 120),
    projectId: String(project.id),
    communityId: community.id,
    name: text(building.name || `${index + 1}号楼`),
    householdCount: nonNegativeInteger(building.householdCount),
    unitCount: nonNegativeInteger(building.unitCount),
    floorCount: nonNegativeInteger(building.floorCount),
    address: text(building.address || community.item.address, 300)
  }));
}

export function fieldProjectSummary(project) {
  return {
    id: String(project.id),
    name: text(project.name || '未命名项目'),
    area: text(project.area, 200),
    status: text(project.status || 'created', 40),
    communityCount: activeCommunities(project).length,
    updatedAt: project.updatedAt || project.createdAt || null
  };
}

export function makeCollectionTaskId(projectId, clientTaskId) {
  return `field-task-${String(projectId)}-${clientTaskId}`;
}

export function normalizeCollectionTask(input, project, existing = null) {
  const clientTaskId = text(input?.clientTaskId, 80);
  if (!TASK_ID_PATTERN.test(clientTaskId)) throw new Error('现场任务编号无效');
  if (String(input?.projectId || '') !== String(project.id)) throw new Error('项目编号不一致');

  const community = findCommunity(project, input.communityId);
  if (!community) throw new Error('所选小区不存在或已删除');
  const buildings = listFieldBuildings(project, community.id) || [];
  const requestedBuildingId = text(input.buildingId, 120);
  const building = requestedBuildingId
    ? buildings.find((item) => item.id === requestedBuildingId)
    : null;
  if (requestedBuildingId && !building) throw new Error('所选楼栋不属于该小区或已删除');

  const now = new Date().toISOString();
  const id = makeCollectionTaskId(project.id, clientTaskId);
  return {
    id,
    clientTaskId,
    projectId: String(project.id),
    communityId: community.id,
    communityName: text(community.item.name || '未命名小区'),
    buildingId: building?.id || '',
    buildingName: building?.name || '',
    status: existing?.status || 'pending-upload',
    syncStatus: existing?.syncStatus || 'accepted',
    buildingCount: nonNegativeInteger(input.buildingCount),
    householdCount: nonNegativeInteger(input.householdCount),
    location: text(input.location, 300),
    description: text(input.description, 1000),
    photoCount: nonNegativeInteger(input.photoCount) || 0,
    collectorId: text(input.collectorId, 120),
    capturedAt: input.capturedAt || existing?.capturedAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    schemaVersion: '1.0.0'
  };
}
