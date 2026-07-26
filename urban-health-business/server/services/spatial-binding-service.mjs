function bindingError(message, status = 400, code = 'SPATIAL_BINDING_INVALID') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function numericPoint(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const point = value.slice(0, 2).map(Number);
  return point.every(Number.isFinite) ? point : null;
}

function pointOnSegment(point, start, end) {
  const cross = (point[1] - start[1]) * (end[0] - start[0])
    - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > 1e-10) return false;
  return point[0] >= Math.min(start[0], end[0]) - 1e-10
    && point[0] <= Math.max(start[0], end[0]) + 1e-10
    && point[1] >= Math.min(start[1], end[1]) - 1e-10
    && point[1] <= Math.max(start[1], end[1]) + 1e-10;
}

export function pointInPolygon(point, polygon) {
  const target = numericPoint(point);
  const vertices = (Array.isArray(polygon) ? polygon : []).map(numericPoint).filter(Boolean);
  if (!target || vertices.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const start = vertices[previous];
    const end = vertices[index];
    if (pointOnSegment(target, start, end)) return true;
    const intersects = (end[1] > target[1]) !== (start[1] > target[1])
      && target[0] < ((start[0] - end[0]) * (target[1] - end[1])) / (start[1] - end[1]) + end[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

export async function bindIssueGeometry(client, repository, issueId, input) {
  const issue = await repository.get(issueId);
  if (!issue) {
    throw bindingError('正式问题不存在或不是Business正式问题。', 404, 'OFFICIAL_ISSUE_NOT_FOUND');
  }
  const project = await client.getProject(issue.projectId);
  const boundary = Array.isArray(project?.scopeBoundary)
    ? project.scopeBoundary.map(numericPoint).filter(Boolean)
    : [];
  if (boundary.length < 3) {
    throw bindingError('项目尚无有效边界，不能确认问题点归属。', 409, 'PROJECT_BOUNDARY_REQUIRED');
  }
  const point = [Number(input?.longitude), Number(input?.latitude)];
  if (!Number.isFinite(point[0]) || point[0] < -180 || point[0] > 180) {
    throw bindingError('经度必须在-180到180之间。', 400, 'INVALID_LONGITUDE');
  }
  if (!Number.isFinite(point[1]) || point[1] < -90 || point[1] > 90) {
    throw bindingError('纬度必须在-90到90之间。', 400, 'INVALID_LATITUDE');
  }
  const projectCrs = String(project.scopeBoundaryCrs || 'WGS84').toUpperCase();
  const requestedCrs = String(input?.crs || 'WGS84').toUpperCase();
  if (requestedCrs !== projectCrs) {
    throw bindingError(
      `问题坐标系${requestedCrs}与项目边界坐标系${projectCrs}不一致。`,
      409,
      'SPATIAL_CRS_MISMATCH'
    );
  }
  if (!pointInPolygon(point, boundary)) {
    throw bindingError('问题坐标位于项目边界之外，请核对位置或先修订项目边界。', 422, 'ISSUE_OUTSIDE_PROJECT_BOUNDARY');
  }
  return repository.updateGeometry(issueId, {
    ...input,
    longitude: point[0],
    latitude: point[1],
    crs: requestedCrs
  });
}
