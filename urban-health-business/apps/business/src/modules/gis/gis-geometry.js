export function hasPointGeometry(item) {
  return item?.geometry?.type === 'Point'
    && Array.isArray(item.geometry.coordinates)
    && item.geometry.coordinates.length >= 2;
}

export function pointInsideSimplePolygon(point, polygon) {
  if (!Array.isArray(point) || !Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[previous].map(Number);
    const end = polygon[index].map(Number);
    const cross = (point[1] - start[1]) * (end[0] - start[0])
      - (point[0] - start[0]) * (end[1] - start[1]);
    const onSegment = Math.abs(cross) < 1e-10
      && point[0] >= Math.min(start[0], end[0]) - 1e-10
      && point[0] <= Math.max(start[0], end[0]) + 1e-10
      && point[1] >= Math.min(start[1], end[1]) - 1e-10
      && point[1] <= Math.max(start[1], end[1]) + 1e-10;
    if (onSegment) return true;
    const intersects = (end[1] > point[1]) !== (start[1] > point[1])
      && point[0] < ((start[0] - end[0]) * (point[1] - end[1]))
        / (start[1] - end[1]) + end[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

export function haversineMeters(start, end) {
  if (!Array.isArray(start) || !Array.isArray(end)) return null;
  const radians = (degrees) => Number(degrees) * Math.PI / 180;
  const latitude1 = radians(start[1]);
  const latitude2 = radians(end[1]);
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = radians(end[0] - start[0]);
  const h = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function parseIssueGeometryBatch(text, issues, defaultCrs = 'WGS84') {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 200) {
    throw new Error('批量点位必须包含1到200行。');
  }
  const issueById = new Map(
    (Array.isArray(issues) ? issues : []).map((issue) => [String(issue.id), issue])
  );
  return lines.map((line, index) => {
    const [issueId, longitudeText, latitudeText, crsText] = line.split(',')
      .map((value) => value.trim());
    const issue = issueById.get(issueId);
    if (!issue) throw new Error(`第${index + 1}行问题ID不属于当前项目：${issueId || '空'}`);
    const longitude = Number(longitudeText);
    const latitude = Number(latitudeText);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`第${index + 1}行经度无效。`);
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error(`第${index + 1}行纬度无效。`);
    }
    const crs = String(crsText || defaultCrs).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!['WGS84', 'GCJ02'].includes(crs)) {
      throw new Error(`第${index + 1}行坐标系必须为WGS84或GCJ02。`);
    }
    return {
      issueId,
      longitude,
      latitude,
      crs,
      bindingSource: 'batch-import',
      expectedGeometryRevision: Number(issue.geometryRevision) || 0
    };
  });
}
