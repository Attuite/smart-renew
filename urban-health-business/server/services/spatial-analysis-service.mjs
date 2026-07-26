import { randomUUID } from 'node:crypto';

function spatialError(message, status = 400, code = 'SPATIAL_ANALYSIS_VALIDATION_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function haversineMeters(a, b) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(b[0] - a[0]);
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pointFrom(value) {
  const coordinates = Array.isArray(value) ? value.map(Number) : [];
  if (
    coordinates.length < 2
    || !Number.isFinite(coordinates[0])
    || !Number.isFinite(coordinates[1])
    || coordinates[0] < -180
    || coordinates[0] > 180
    || coordinates[1] < -90
    || coordinates[1] > 90
  ) return null;
  return coordinates.slice(0, 2);
}

function projectCenter(project) {
  const explicit = pointFrom(project?.scopeCenter) || pointFrom(project?.boundaryCenter);
  if (explicit) return explicit;
  const points = Array.isArray(project?.scopeBoundary)
    ? project.scopeBoundary.map(pointFrom).filter(Boolean)
    : [];
  if (!points.length) return null;
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length
  ];
}

export async function runIssueRadiusAnalysis(
  client,
  issueRepository,
  spatialRepository,
  projectId,
  input,
  options = {}
) {
  const [project, businessIssues, legacyIssues] = await Promise.all([
    client.getProject(projectId),
    issueRepository.list(projectId),
    client.safeList(`/api/issues?projectId=${encodeURIComponent(projectId)}`)
  ]);
  const merged = new Map();
  for (const issue of legacyIssues.items) merged.set(String(issue.id), issue);
  for (const issue of businessIssues) merged.set(String(issue.id), issue);
  const radiusMeters = Number(input?.radiusMeters);
  if (!Number.isFinite(radiusMeters) || radiusMeters < 50 || radiusMeters > 10000) {
    throw spatialError('分析半径必须在50到10000米之间。', 400, 'INVALID_ANALYSIS_RADIUS');
  }
  const center = pointFrom(input?.center) || projectCenter(project);
  if (!center) {
    throw spatialError('项目缺少有效边界中心，请先录入项目边界或显式提供分析中心。', 409, 'ANALYSIS_CENTER_REQUIRED');
  }
  const createdBy = String(input?.createdBy || '').trim().slice(0, 120);
  if (!createdBy) {
    throw spatialError('请填写空间分析操作人员。', 400, 'SPATIAL_ANALYSIS_CREATOR_REQUIRED');
  }
  const located = [...merged.values()]
    .map((issue) => {
      const point = pointFrom(issue?.geometry?.coordinates);
      return point ? {
        issueId: String(issue.id),
        coordinates: point,
        distanceMeters: Math.round(haversineMeters(center, point) * 10) / 10
      } : null;
    })
    .filter(Boolean);
  const matched = located.filter((item) => item.distanceMeters <= radiusMeters);
  const now = options.now || new Date().toISOString();
  const run = {
    id: options.id || `SPRUN-${randomUUID()}`,
    projectId: String(project.id),
    type: 'official-issue-radius',
    status: 'completed',
    parameters: {
      center,
      radiusMeters
    },
    sourceSnapshot: {
      projectRevision: Number(project.revision) || 0,
      boundaryUpdatedAt: project.boundaryUpdatedAt || null,
      officialIssueCount: merged.size,
      locatedIssueCount: located.length,
      issueRevisions: [...merged.values()].map((issue) => ({
        id: String(issue.id),
        issueRevision: Number(issue.issueRevision) || 0,
        geometryRevision: Number(issue.geometryRevision) || 0,
        updatedAt: issue.updatedAt || null
      }))
    },
    result: {
      matchedIssueCount: matched.length,
      matchedIssueIds: matched.map((item) => item.issueId),
      distances: located
    },
    createdBy,
    completedAt: now,
    schemaVersion: '1.0.0'
  };
  return spatialRepository.put(run);
}

export { haversineMeters };
