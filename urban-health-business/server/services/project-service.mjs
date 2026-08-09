import { normalizeCrs } from '../../packages/api-contracts/spatial.mjs';
import {
  boundaryGeometryStats,
  legacyBoundaryProjection,
  validateBoundaryGeometry
} from './spatial-geometry-service.mjs';

const PROJECT_TYPES = new Set([
  'residential',
  'community',
  'block',
  'district',
  'other'
]);

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function validationError(message, details = {}) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'PROJECT_VALIDATION_FAILED';
  error.details = details;
  return error;
}

function optionalNonNegativeInteger(value, field) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw validationError(`${field}必须是非负整数。`, { field });
  }
  return number;
}

function samePoint(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) + 1e-12
    && b[0] >= Math.min(a[0], c[0]) - 1e-12
    && b[1] <= Math.max(a[1], c[1]) + 1e-12
    && b[1] >= Math.min(a[1], c[1]) - 1e-12;
}

function segmentsIntersect(a1, a2, b1, b2) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

function assertSimplePolygon(points) {
  const length = points.length;
  for (let left = 0; left < length; left += 1) {
    const leftNext = (left + 1) % length;
    for (let right = left + 1; right < length; right += 1) {
      const rightNext = (right + 1) % length;
      const adjacent = left === right
        || leftNext === right
        || rightNext === left;
      if (adjacent) continue;
      if (segmentsIntersect(points[left], points[leftNext], points[right], points[rightNext])) {
        throw validationError('项目边界存在自相交线段。', { field: 'coordinates' });
      }
    }
  }
}

export function normalizeBoundary(input) {
  if (input?.geometry) {
    const geometry = validateBoundaryGeometry(input.geometry, { maxPoints: 50000 });
    const stats = boundaryGeometryStats(geometry);
    if (stats.areaSqKm < 0.000001) {
      throw validationError('项目边界面积为0或过小，请检查坐标顺序。', { field: 'geometry' });
    }
    return {
      coordinates: legacyBoundaryProjection(geometry),
      geometry,
      crs: normalizeCrs(input?.crs || 'WGS84'),
      areaSqKm: stats.areaSqKm,
      center: stats.center,
      bounds: stats.bounds,
      polygonCount: stats.polygonCount,
      holeCount: stats.holeCount,
      source: cleanText(input?.source, 80) || 'manual-geometry-entry'
    };
  }
  const source = Array.isArray(input?.coordinates) ? input.coordinates : [];
  if (source.length < 3) {
    throw validationError('项目边界至少需要3个坐标点。', { field: 'coordinates' });
  }
  if (source.length > 5000) {
    throw validationError('项目边界坐标点不能超过5000个。', { field: 'coordinates' });
  }
  const points = source.map((point, index) => {
    if (!Array.isArray(point) || point.length < 2) {
      throw validationError(`第${index + 1}个边界点格式无效。`, { field: 'coordinates', index });
    }
    const longitude = Number(point[0]);
    const latitude = Number(point[1]);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw validationError(`第${index + 1}个边界点经度无效。`, { field: 'coordinates', index });
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw validationError(`第${index + 1}个边界点纬度无效。`, { field: 'coordinates', index });
    }
    return [longitude, latitude];
  });
  if (points.length > 3 && samePoint(points[0], points.at(-1))) points.pop();
  const distinct = new Set(points.map((point) => `${point[0]},${point[1]}`));
  if (distinct.size < 3) {
    throw validationError('项目边界至少需要3个不同坐标点。', { field: 'coordinates' });
  }
  assertSimplePolygon(points);

  const radians = Math.PI / 180;
  const earthRadius = 6_378_137;
  let areaAccumulator = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    areaAccumulator += (next[0] - current[0]) * radians
      * (2 + Math.sin(current[1] * radians) + Math.sin(next[1] * radians));
  }
  const areaSqKm = Math.abs(areaAccumulator * earthRadius * earthRadius / 2) / 1_000_000;
  if (areaSqKm < 0.000001) {
    throw validationError('项目边界面积为0或过小，请检查坐标顺序。', { field: 'coordinates' });
  }
  const center = [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length
  ];
  const crs = cleanText(input?.crs, 20) || 'WGS84';
  if (!['WGS84', 'GCJ02'].includes(crs)) {
    throw validationError('当前只接受WGS84或GCJ02坐标系。', { field: 'crs' });
  }
  return {
    coordinates: points,
    geometry: {
      type: 'Polygon',
      coordinates: [[...points, [...points[0]]]]
    },
    crs,
    areaSqKm,
    center,
    source: cleanText(input?.source, 80) || 'manual-coordinate-entry'
  };
}

export function buildNewProject(input, options = {}) {
  const name = cleanText(input?.name, 120);
  if (!name) {
    throw validationError('项目名称不能为空。', { field: 'name' });
  }

  const now = options.now || new Date().toISOString();
  const generatedId = options.id
    ?? String((options.nowMs ?? Date.now()) * 100 + (options.randomPart ?? Math.floor(Math.random() * 100)));
  if (!/^\d+$/.test(String(generatedId))) {
    throw validationError('项目编号必须兼容现有smart-renew数字编号。', { field: 'id' });
  }

  const requestedType = cleanText(input?.type, 32) || 'residential';
  const type = PROJECT_TYPES.has(requestedType) ? requestedType : 'other';
  const area = cleanText(input?.area, 160);
  const scope = cleanText(input?.scope, 500);
  const desc = cleanText(input?.description ?? input?.desc, 2000);

  return {
    id: String(generatedId),
    name,
    area,
    type,
    scope,
    desc,
    description: desc,
    createdAt: now,
    updatedAt: now,
    status: 'created',
    revision: 1,
    analysisIds: [],
    communityStatus: 'pending',
    reportStatus: 'pending',
    scopeBoundary: [],
    scopeAreaSqKm: 0,
    scopeCenter: null,
    residentialInventory: {
      items: [],
      deletedItems: [],
      identifiedAt: null,
      updatedAt: now,
      dataSource: null
    }
  };
}

export async function createProject(client, input, options = {}) {
  const project = buildNewProject(input, options);
  return client.putProject(project);
}

export function reviseProjectMetadata(project, input, options = {}) {
  if (!project?.id) {
    const error = new Error('项目不存在。');
    error.status = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  const currentRevision = Math.max(0, Number(project.revision) || 0);
  if (input?.expectedRevision !== undefined && Number(input.expectedRevision) !== currentRevision) {
    const error = new Error('项目已被其他操作修改，请刷新后重试。');
    error.status = 409;
    error.code = 'PROJECT_REVISION_CONFLICT';
    throw error;
  }
  const name = input?.name === undefined ? project.name : cleanText(input.name, 120);
  if (!name) throw validationError('项目名称不能为空。', { field: 'name' });
  const requestedType = input?.type === undefined ? project.type : cleanText(input.type, 32);
  const type = PROJECT_TYPES.has(requestedType) ? requestedType : 'other';
  const now = options.now || new Date().toISOString();
  return {
    ...project,
    name,
    area: input?.area === undefined ? project.area : cleanText(input.area, 160),
    type,
    scope: input?.scope === undefined ? project.scope : cleanText(input.scope, 500),
    desc: input?.description === undefined && input?.desc === undefined
      ? project.desc
      : cleanText(input.description ?? input.desc, 2000),
    description: input?.description === undefined && input?.desc === undefined
      ? project.description
      : cleanText(input.description ?? input.desc, 2000),
    revision: currentRevision + 1,
    updatedAt: now
  };
}

export async function updateProjectMetadata(client, projectId, input, options = {}) {
  const current = await client.getProject(projectId);
  const project = reviseProjectMetadata(current, input, options);
  await client.putProject(project);
  return project;
}

export function appendCommunity(project, input, options = {}) {
  if (!project?.id) {
    const error = new Error('项目不存在。');
    error.status = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  const name = cleanText(input?.name, 160);
  if (!name) {
    throw validationError('小区名称不能为空。', { field: 'name' });
  }

  const now = options.now || new Date().toISOString();
  const suffix = options.idSuffix
    ?? `${options.nowMs ?? Date.now()}-${options.randomPart ?? Math.floor(Math.random() * 1000)}`;
  const inventory = project.residentialInventory && typeof project.residentialInventory === 'object'
    ? project.residentialInventory
    : {};
  const items = Array.isArray(inventory.items) ? [...inventory.items] : [];
  const community = {
    id: `COMM-${project.id}-${suffix}`,
    name,
    address: cleanText(input?.address, 300),
    status: 'active',
    source: 'manual',
    communityRevision: 1,
    buildingCount: null,
    householdCount: null,
    buildings: [],
    createdAt: now,
    updatedAt: now
  };
  items.push(community);

  const updated = {
    ...project,
    updatedAt: now,
    revision: Math.max(0, Number(project.revision) || 0) + 1,
    residentialInventory: {
      ...inventory,
      items,
      deletedItems: Array.isArray(inventory.deletedItems) ? inventory.deletedItems : [],
      identifiedAt: inventory.identifiedAt || now,
      updatedAt: now,
      dataSource: inventory.dataSource || '人工录入'
    }
  };
  return { project: updated, community };
}

export function appendDiscoveredCommunity(project, candidate, options = {}) {
  const point = Array.isArray(candidate?.coordinates)
    ? candidate.coordinates.slice(0, 2).map(Number)
    : [];
  if (
    point.length !== 2
    || !Number.isFinite(point[0])
    || !Number.isFinite(point[1])
  ) {
    throw validationError('住宅候选缺少有效坐标。', { field: 'coordinates' });
  }
  const outcome = appendCommunity(project, {
    name: candidate?.name,
    address: candidate?.address
  }, options);
  const community = {
    ...outcome.community,
    source: 'amap-residential-discovery',
    coordinates: point,
    crs: cleanText(candidate?.crs, 20) || 'GCJ02',
    discovery: {
      runId: cleanText(options.discoveryRunId, 180),
      provider: 'amap',
      providerId: cleanText(candidate?.providerId, 160) || null,
      normalizedId: cleanText(candidate?.normalizedId, 160),
      originalName: cleanText(candidate?.name, 200),
      originalAddress: cleanText(candidate?.address, 300),
      sourceProviderIds: Array.isArray(candidate?.sourceProviderIds)
        ? candidate.sourceProviderIds.map((item) => cleanText(item, 160)).filter(Boolean)
        : [],
      boundaryRevision: Math.max(0, Number(project?.revision) || 0),
      boundaryUpdatedAt: project?.boundaryUpdatedAt || null,
      confirmedBy: cleanText(options.confirmedBy, 120),
      confirmedAt: options.now || new Date().toISOString()
    }
  };
  outcome.project.residentialInventory.items = outcome.project.residentialInventory.items
    .map((item) => item.id === outcome.community.id ? community : item);
  outcome.project.residentialInventory.dataSource = '高德住宅识别＋人工确认';
  outcome.community = community;
  return outcome;
}

export async function addCommunity(client, projectId, input, options = {}) {
  const current = await client.getProject(projectId);
  const { project, community } = appendCommunity(current, input, options);
  await client.putProject(project);
  return community;
}

export function listCommunityInventory(project) {
  const items = Array.isArray(project?.residentialInventory?.items)
    ? project.residentialInventory.items
    : [];
  return items.map((community) => {
    const buildings = Array.isArray(community.buildings) ? community.buildings : [];
    return {
      ...community,
      projectId: String(project.id),
      status: community.status === 'deleted' ? 'inactive' : 'active',
      communityRevision: Math.max(1, Number(community.communityRevision) || 1),
      buildingDetailCount: buildings.filter((building) => building.status !== 'deleted').length
    };
  });
}

export function reviseCommunity(project, communityId, input, options = {}) {
  const inventory = project?.residentialInventory;
  const items = Array.isArray(inventory?.items) ? inventory.items : [];
  const sourceCommunity = items.find((item) => String(item.id || item.sourceId) === String(communityId));
  if (!sourceCommunity) {
    const error = new Error('小区不存在。');
    error.status = 404;
    error.code = 'COMMUNITY_NOT_FOUND';
    throw error;
  }
  const currentRevision = Math.max(1, Number(sourceCommunity.communityRevision) || 1);
  if (input?.expectedRevision !== undefined && Number(input.expectedRevision) !== currentRevision) {
    const error = new Error('小区已被其他操作修改，请刷新后重试。');
    error.status = 409;
    error.code = 'COMMUNITY_REVISION_CONFLICT';
    throw error;
  }
  const requestedStatus = cleanText(input?.status, 20);
  if (requestedStatus && !['active', 'inactive'].includes(requestedStatus)) {
    throw validationError('小区状态必须为active或inactive。', { field: 'status' });
  }
  const name = input?.name === undefined ? sourceCommunity.name : cleanText(input.name, 160);
  if (!name) throw validationError('小区名称不能为空。', { field: 'name' });
  const now = options.now || new Date().toISOString();
  const updatedBy = cleanText(input?.updatedBy, 120);
  const beforeStatus = sourceCommunity.status === 'deleted' ? 'inactive' : 'active';
  const afterStatus = requestedStatus || beforeStatus;
  const community = {
    ...sourceCommunity,
    name,
    address: input?.address === undefined ? sourceCommunity.address : cleanText(input.address, 300),
    status: requestedStatus
      ? requestedStatus === 'inactive' ? 'deleted' : 'active'
      : sourceCommunity.status,
    communityRevision: currentRevision + 1,
    governanceAudit: updatedBy
      ? [
          ...(Array.isArray(sourceCommunity.governanceAudit) ? sourceCommunity.governanceAudit : []),
          {
            revision: currentRevision + 1,
            action: beforeStatus !== afterStatus
              ? afterStatus === 'active' ? 'restore' : 'deactivate'
              : 'update',
            before: {
              name: sourceCommunity.name,
              address: sourceCommunity.address,
              status: beforeStatus
            },
            after: {
              name,
              address: input?.address === undefined ? sourceCommunity.address : cleanText(input.address, 300),
              status: afterStatus
            },
            updatedBy,
            at: now
          }
        ]
      : sourceCommunity.governanceAudit,
    updatedAt: now
  };
  return {
    project: {
      ...project,
      residentialInventory: {
        ...inventory,
        items: items.map((item) => item === sourceCommunity ? community : item),
        updatedAt: now
      },
      revision: Math.max(0, Number(project.revision) || 0) + 1,
      updatedAt: now
    },
    community: {
      ...community,
      status: community.status === 'deleted' ? 'inactive' : 'active'
    }
  };
}

export async function updateCommunity(client, projectId, communityId, input, options = {}) {
  const current = await client.getProject(projectId);
  const outcome = reviseCommunity(current, communityId, input, options);
  await client.putProject(outcome.project);
  return outcome.community;
}

export function applyProjectBoundary(project, input, options = {}) {
  if (!project?.id) {
    const error = new Error('项目不存在。');
    error.status = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  const currentRevision = Math.max(0, Number(project.revision) || 0);
  if (input?.expectedRevision !== undefined && Number(input.expectedRevision) !== currentRevision) {
    const error = new Error('项目已被其他操作更新，请刷新后重试。');
    error.status = 409;
    error.code = 'PROJECT_REVISION_CONFLICT';
    error.details = { expectedRevision: Number(input.expectedRevision), currentRevision };
    throw error;
  }
  const updatedBy = cleanText(input?.updatedBy, 120);
  if (!updatedBy) {
    throw validationError('请填写项目边界更新人员。', { field: 'updatedBy' });
  }
  const boundary = normalizeBoundary(input);
  const now = options.now || new Date().toISOString();
  return {
    ...project,
    scopeBoundary: boundary.coordinates,
    scopeBoundaryGeometry: boundary.geometry,
    scopeBoundaryCrs: boundary.crs,
    scopeBoundarySource: boundary.source,
    scopeBoundarySourceAssetId: cleanText(input?.sourceAssetId, 180) || null,
    scopeBoundarySourceAssetContentHash: cleanText(input?.sourceAssetContentHash, 128) || null,
    scopeAreaSqKm: boundary.areaSqKm,
    scopeCenter: boundary.center,
    scopeBounds: boundary.bounds || null,
    scopePolygonCount: boundary.polygonCount || 1,
    scopeHoleCount: boundary.holeCount || 0,
    boundaryUpdatedAt: now,
    boundaryUpdatedBy: updatedBy,
    revision: currentRevision + 1,
    updatedAt: now
  };
}

export async function updateProjectBoundary(client, projectId, input, options = {}) {
  const current = await client.getProject(projectId);
  const project = applyProjectBoundary(current, input, options);
  await client.putProject(project);
  return project;
}

function activeCommunity(project, communityId) {
  const items = Array.isArray(project?.residentialInventory?.items)
    ? project.residentialInventory.items
    : [];
  return items.find((item) =>
    item?.status !== 'deleted' && String(item.id || item.sourceId || '') === String(communityId)
  );
}

export function appendBuilding(project, communityId, input, options = {}) {
  const sourceCommunity = activeCommunity(project, communityId);
  if (!sourceCommunity) {
    const error = new Error('小区不存在或已删除。');
    error.status = 404;
    error.code = 'COMMUNITY_NOT_FOUND';
    throw error;
  }
  const community = { ...sourceCommunity };
  const name = cleanText(input?.name, 160);
  if (!name) throw validationError('楼栋名称不能为空。', { field: 'name' });
  const now = options.now || new Date().toISOString();
  const suffix = options.idSuffix
    ?? `${options.nowMs ?? Date.now()}-${options.randomPart ?? Math.floor(Math.random() * 1000)}`;
  const building = {
    id: `BLD-${project.id}-${suffix}`,
    communityId: String(communityId),
    name,
    address: cleanText(input?.address, 300),
    householdCount: optionalNonNegativeInteger(input?.householdCount, 'householdCount'),
    unitCount: optionalNonNegativeInteger(input?.unitCount, 'unitCount'),
    floorCount: optionalNonNegativeInteger(input?.floorCount, 'floorCount'),
    status: 'active',
    source: 'manual',
    buildingRevision: 1,
    createdAt: now,
    updatedAt: now
  };
  const buildings = Array.isArray(community.buildings) ? [...community.buildings] : [];
  buildings.push(building);
  community.buildings = buildings;
  community.buildingCount = buildings.filter((item) => item?.status !== 'deleted').length;
  const activeBuildings = buildings.filter((item) => item?.status !== 'deleted');
  community.householdCount = activeBuildings.every((item) => Number.isInteger(item.householdCount))
    ? activeBuildings.reduce((sum, item) => sum + item.householdCount, 0)
    : null;
  community.updatedAt = now;

  const inventory = project.residentialInventory;
  const updated = {
    ...project,
    residentialInventory: {
      ...inventory,
      items: inventory.items.map((item) => item === sourceCommunity ? community : item),
      updatedAt: now
    },
    revision: Math.max(0, Number(project.revision) || 0) + 1,
    updatedAt: now
  };
  return { project: updated, building };
}

export async function addBuilding(client, projectId, communityId, input, options = {}) {
  const current = await client.getProject(projectId);
  const { project, building } = appendBuilding(current, communityId, input, options);
  await client.putProject(project);
  return building;
}

export function listBuildingInventory(project, communityId) {
  const community = activeCommunity(project, communityId);
  if (!community) return null;
  return (Array.isArray(community.buildings) ? community.buildings : []).map((building) => ({
    ...building,
    projectId: String(project.id),
    communityId: String(communityId),
    status: building.status === 'deleted' ? 'inactive' : 'active',
    buildingRevision: Math.max(1, Number(building.buildingRevision) || 1)
  }));
}

export function reviseBuilding(project, communityId, buildingId, input, options = {}) {
  const sourceCommunity = activeCommunity(project, communityId);
  if (!sourceCommunity) {
    const error = new Error('小区不存在或已删除。');
    error.status = 404;
    error.code = 'COMMUNITY_NOT_FOUND';
    throw error;
  }
  const buildings = Array.isArray(sourceCommunity.buildings) ? sourceCommunity.buildings : [];
  const sourceBuilding = buildings.find((item) => String(item.id) === String(buildingId));
  if (!sourceBuilding) {
    const error = new Error('楼栋不存在。');
    error.status = 404;
    error.code = 'BUILDING_NOT_FOUND';
    throw error;
  }
  const currentRevision = Math.max(1, Number(sourceBuilding.buildingRevision) || 1);
  if (input?.expectedRevision !== undefined && Number(input.expectedRevision) !== currentRevision) {
    const error = new Error('楼栋已被其他操作修改，请刷新后重试。');
    error.status = 409;
    error.code = 'BUILDING_REVISION_CONFLICT';
    throw error;
  }
  const requestedStatus = cleanText(input?.status, 20);
  if (requestedStatus && !['active', 'inactive'].includes(requestedStatus)) {
    throw validationError('楼栋状态必须为active或inactive。', { field: 'status' });
  }
  const name = input?.name === undefined ? sourceBuilding.name : cleanText(input.name, 160);
  if (!name) throw validationError('楼栋名称不能为空。', { field: 'name' });
  const now = options.now || new Date().toISOString();
  const building = {
    ...sourceBuilding,
    name,
    address: input?.address === undefined ? sourceBuilding.address : cleanText(input.address, 300),
    householdCount: input?.householdCount === undefined
      ? sourceBuilding.householdCount
      : optionalNonNegativeInteger(input.householdCount, 'householdCount'),
    unitCount: input?.unitCount === undefined
      ? sourceBuilding.unitCount
      : optionalNonNegativeInteger(input.unitCount, 'unitCount'),
    floorCount: input?.floorCount === undefined
      ? sourceBuilding.floorCount
      : optionalNonNegativeInteger(input.floorCount, 'floorCount'),
    status: requestedStatus
      ? requestedStatus === 'inactive' ? 'deleted' : 'active'
      : sourceBuilding.status,
    buildingRevision: currentRevision + 1,
    updatedAt: now
  };
  const nextBuildings = buildings.map((item) => item === sourceBuilding ? building : item);
  const activeBuildings = nextBuildings.filter((item) => item.status !== 'deleted');
  const community = {
    ...sourceCommunity,
    buildings: nextBuildings,
    buildingCount: activeBuildings.length,
    householdCount: activeBuildings.every((item) => Number.isInteger(item.householdCount))
      ? activeBuildings.reduce((sum, item) => sum + item.householdCount, 0)
      : null,
    updatedAt: now
  };
  const inventory = project.residentialInventory;
  return {
    project: {
      ...project,
      residentialInventory: {
        ...inventory,
        items: inventory.items.map((item) => item === sourceCommunity ? community : item),
        updatedAt: now
      },
      revision: Math.max(0, Number(project.revision) || 0) + 1,
      updatedAt: now
    },
    building: {
      ...building,
      status: building.status === 'deleted' ? 'inactive' : 'active'
    }
  };
}

export async function updateBuilding(client, projectId, communityId, buildingId, input, options = {}) {
  const current = await client.getProject(projectId);
  const outcome = reviseBuilding(current, communityId, buildingId, input, options);
  await client.putProject(outcome.project);
  return outcome.building;
}

function cloneRecord(value) {
  return JSON.parse(JSON.stringify(value));
}

function activeCommunityItems(project) {
  return (Array.isArray(project?.residentialInventory?.items)
    ? project.residentialInventory.items
    : []).filter((item) => item?.status !== 'deleted');
}

function requireReferenceSafety(input, referenceSummary, action) {
  if (input?.referenceStrategy !== 'block-if-referenced') {
    const error = validationError(
      `${action}必须明确使用block-if-referenced引用策略。`,
      { field: 'referenceStrategy', supported: ['block-if-referenced'] }
    );
    error.code = 'COMMUNITY_REFERENCE_STRATEGY_REQUIRED';
    throw error;
  }
  if (Number(referenceSummary?.total) > 0) {
    const error = new Error(`${action}会影响已有下游引用，当前操作已阻断。`);
    error.status = 409;
    error.code = 'COMMUNITY_REFERENCES_EXIST';
    error.details = referenceSummary;
    throw error;
  }
}

function normalizedCommunitySnapshot(community, now) {
  const snapshot = cloneRecord(community);
  delete snapshot.members;
  delete snapshot.merge;
  snapshot.status = 'active';
  snapshot.updatedAt = now;
  return snapshot;
}

function mergedCommunityName(communities) {
  const bases = communities.map((community) => String(community?.name || '')
    .replace(/[（(]?[A-Da-dＡ-Ｄａ-ｄ]区[）)]?$/, '')
    .replace(/(东区|西区|南区|北区|一期|二期|三期)$/, '')
    .trim()).filter(Boolean);
  if (!bases.length) return '合并住宅小区';
  return bases.every((name) => name === bases[0]) ? bases[0] : `${bases[0]}（合并）`;
}

export function mergeCommunityInventory(project, input = {}, options = {}) {
  if (!project?.id) {
    const error = new Error('项目不存在。');
    error.status = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  const currentProjectRevision = Math.max(0, Number(project.revision) || 0);
  if (
    input.expectedProjectRevision !== undefined
    && Number(input.expectedProjectRevision) !== currentProjectRevision
  ) {
    const error = new Error('项目已被其他操作修改，请刷新后重试。');
    error.status = 409;
    error.code = 'PROJECT_REVISION_CONFLICT';
    throw error;
  }
  const communityIds = [...new Set(
    (Array.isArray(input.communityIds) ? input.communityIds : []).map(String).filter(Boolean)
  )];
  if (communityIds.length < 2 || communityIds.length > 50) {
    throw validationError('小区合并必须选择2到50个使用中小区。', { field: 'communityIds' });
  }
  const inventory = project.residentialInventory || {};
  const items = Array.isArray(inventory.items) ? inventory.items : [];
  const selected = communityIds.map((communityId) =>
    items.find((item) => item?.status !== 'deleted' && String(item.id || item.sourceId) === communityId)
  );
  if (selected.some((item) => !item)) {
    const error = new Error('待合并小区不存在或已停用。');
    error.status = 404;
    error.code = 'COMMUNITY_NOT_FOUND';
    throw error;
  }
  const expectedRevisions = input.expectedRevisions || {};
  for (const community of selected) {
    const expected = expectedRevisions[String(community.id || community.sourceId)];
    if (
      expected !== undefined
      && Number(expected) !== Math.max(1, Number(community.communityRevision) || 1)
    ) {
      const error = new Error('待合并小区已被其他操作修改，请刷新后重试。');
      error.status = 409;
      error.code = 'COMMUNITY_REVISION_CONFLICT';
      throw error;
    }
  }
  requireReferenceSafety(input, options.referenceSummary, '小区合并');
  const targetId = String(input.targetCommunityId || communityIds[0]);
  const target = selected.find((item) => String(item.id || item.sourceId) === targetId);
  if (!target) throw validationError('合并后的主小区必须来自已选小区。', { field: 'targetCommunityId' });
  const mergedBy = cleanText(input.mergedBy, 120);
  if (!mergedBy) throw validationError('请填写小区合并人员。', { field: 'mergedBy' });
  const now = options.now || new Date().toISOString();
  const zones = input.zones && typeof input.zones === 'object' ? input.zones : {};
  const members = selected.flatMap((community) => {
    const originals = Array.isArray(community.members) && community.members.length
      ? community.members
      : [community];
    return originals.map((item) => ({
      ...normalizedCommunitySnapshot(item, now),
      zone: cleanText(zones[String(item.id || item.sourceId)], 80) || item.zone || '未指定'
    }));
  });
  const buildings = selected.flatMap((community) =>
    (Array.isArray(community.buildings) ? community.buildings : [])
      .map((building) => ({ ...cloneRecord(building), communityId: targetId }))
  );
  const buildingIds = buildings.map((building) => String(building.id));
  if (new Set(buildingIds).size !== buildingIds.length) {
    const error = new Error('待合并小区存在重复楼栋编号。');
    error.status = 409;
    error.code = 'COMMUNITY_MERGE_BUILDING_ID_CONFLICT';
    throw error;
  }
  const activeBuildings = buildings.filter((item) => item.status !== 'deleted');
  const mergeRevision = {
    id: `CMERGE-${project.id}-${options.idSuffix || Date.now()}`,
    projectId: String(project.id),
    targetCommunityId: targetId,
    sourceCommunityIds: communityIds,
    memberSnapshots: members,
    mergedBy,
    mergedAt: now,
    projectRevisionBefore: currentProjectRevision,
    referenceStrategy: input.referenceStrategy,
    schemaVersion: '1.0.0'
  };
  const merged = {
    ...target,
    id: targetId,
    name: cleanText(input.name, 160) || mergedCommunityName(selected),
    address: input.address === undefined ? target.address : cleanText(input.address, 300),
    status: 'active',
    source: 'community-merge',
    members,
    buildings,
    buildingCount: activeBuildings.length,
    householdCount: activeBuildings.every((item) => Number.isInteger(item.householdCount))
      ? activeBuildings.reduce((sum, item) => sum + item.householdCount, 0)
      : null,
    communityRevision: Math.max(1, Number(target.communityRevision) || 1) + 1,
    merge: {
      revisionId: mergeRevision.id,
      sourceCommunityIds: communityIds,
      mergedBy,
      mergedAt: now
    },
    updatedAt: now
  };
  const selectedSet = new Set(communityIds);
  const firstIndex = Math.min(...communityIds.map((communityId) =>
    items.findIndex((item) => String(item.id || item.sourceId) === communityId)
  ));
  const nextItems = [];
  for (let index = 0; index < items.length; index += 1) {
    if (index === firstIndex) nextItems.push(merged);
    const id = String(items[index].id || items[index].sourceId);
    if (!selectedSet.has(id)) nextItems.push(items[index]);
  }
  const updatedProject = {
    ...project,
    residentialInventory: {
      ...inventory,
      items: nextItems,
      mergeRevisions: [...(Array.isArray(inventory.mergeRevisions) ? inventory.mergeRevisions : []), mergeRevision],
      updatedAt: now,
      dataSource: inventory.dataSource || '人工治理'
    },
    revision: currentProjectRevision + 1,
    updatedAt: now
  };
  mergeRevision.projectRevisionAfter = updatedProject.revision;
  return { project: updatedProject, community: merged, revision: mergeRevision };
}

export function splitCommunityInventory(project, communityId, input = {}, options = {}) {
  const inventory = project?.residentialInventory || {};
  const items = Array.isArray(inventory.items) ? inventory.items : [];
  const index = items.findIndex((item) => String(item.id || item.sourceId) === String(communityId));
  const source = items[index];
  if (!source) {
    const error = new Error('小区不存在。');
    error.status = 404;
    error.code = 'COMMUNITY_NOT_FOUND';
    throw error;
  }
  if (!Array.isArray(source.members) || source.members.length < 2 || !source.merge) {
    const error = new Error('当前小区不是可拆分的合并小区。');
    error.status = 409;
    error.code = 'COMMUNITY_NOT_MERGED';
    throw error;
  }
  const currentRevision = Math.max(1, Number(source.communityRevision) || 1);
  if (input.expectedRevision !== undefined && Number(input.expectedRevision) !== currentRevision) {
    const error = new Error('小区已被其他操作修改，请刷新后重试。');
    error.status = 409;
    error.code = 'COMMUNITY_REVISION_CONFLICT';
    throw error;
  }
  requireReferenceSafety(input, options.referenceSummary, '小区拆分');
  const splitBy = cleanText(input.splitBy, 120);
  if (!splitBy) throw validationError('请填写小区拆分人员。', { field: 'splitBy' });
  const currentBuildingIds = (source.buildings || []).map((item) => String(item.id)).sort();
  const snapshotBuildingIds = source.members.flatMap((member) => member.buildings || [])
    .map((item) => String(item.id)).sort();
  if (JSON.stringify(currentBuildingIds) !== JSON.stringify(snapshotBuildingIds)) {
    const error = new Error('合并后楼栋集合已变化，拆分前需要先完成楼栋引用整理。');
    error.status = 409;
    error.code = 'COMMUNITY_SPLIT_BUILDINGS_CHANGED';
    throw error;
  }
  const now = options.now || new Date().toISOString();
  const restored = source.members.map((member) => ({
    ...cloneRecord(member),
    status: 'active',
    communityRevision: Math.max(1, Number(member.communityRevision) || 1) + 1,
    restoredFromMergeId: source.merge.revisionId,
    restoredAt: now,
    restoredBy: splitBy,
    updatedAt: now
  }));
  const splitRevision = {
    id: `CSPLIT-${project.id}-${options.idSuffix || Date.now()}`,
    projectId: String(project.id),
    sourceCommunityId: String(communityId),
    restoredCommunityIds: restored.map((item) => String(item.id || item.sourceId)),
    mergeRevisionId: source.merge.revisionId,
    splitBy,
    splitAt: now,
    referenceStrategy: input.referenceStrategy,
    schemaVersion: '1.0.0'
  };
  const nextItems = [...items];
  nextItems.splice(index, 1, ...restored);
  const updatedProject = {
    ...project,
    residentialInventory: {
      ...inventory,
      items: nextItems,
      mergeRevisions: [...(Array.isArray(inventory.mergeRevisions) ? inventory.mergeRevisions : []), splitRevision],
      updatedAt: now
    },
    revision: Math.max(0, Number(project.revision) || 0) + 1,
    updatedAt: now
  };
  return { project: updatedProject, communities: restored, revision: splitRevision };
}

export async function mergeCommunities(client, projectId, input = {}, options = {}) {
  const project = await client.getProject(projectId);
  const outcome = mergeCommunityInventory(project, input, options);
  await client.putProject(outcome.project);
  return outcome;
}

export async function splitCommunity(client, projectId, communityId, input = {}, options = {}) {
  const project = await client.getProject(projectId);
  const outcome = splitCommunityInventory(project, communityId, input, options);
  await client.putProject(outcome.project);
  return outcome;
}
