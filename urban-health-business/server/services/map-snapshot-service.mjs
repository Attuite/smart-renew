import { createHash, randomUUID } from 'node:crypto';
import { normalizeGeometry } from '../../packages/api-contracts/spatial.mjs';
import { getProjectMapView } from './map-view-service.mjs';

const MAP_STYLES = new Set(['light', 'dark', 'satellite-road']);
const PURPOSES = new Set(['report', 'export', 'audit']);

function snapshotError(message, status = 400, code = 'MAP_SNAPSHOT_INVALID') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function clean(value, maximum = 300) {
  return String(value || '').trim().slice(0, maximum);
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function featureItems(collection) {
  return Array.isArray(collection?.items) ? collection.items : [];
}

function flattenPositions(value, output = []) {
  if (!Array.isArray(value)) return output;
  if (
    value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]))
  ) {
    output.push([Number(value[0]), Number(value[1])]);
    return output;
  }
  for (const item of value) flattenPositions(item, output);
  return output;
}

function snapshotBounds(view) {
  const positions = [];
  if (view.boundary?.geometry) flattenPositions(view.boundary.geometry.coordinates, positions);
  for (const collection of [view.issues, view.photos, view.routes, view.stops]) {
    for (const feature of featureItems(collection)) {
      flattenPositions(feature.geometry?.coordinates, positions);
    }
  }
  const run = featureItems(view.spatialAnalyses)[0];
  if (Array.isArray(run?.parameters?.center)) {
    const center = run.parameters.center.map(Number);
    positions.push(center);
    const radiusMeters = Number(run.parameters.radiusMeters);
    if (center.every(Number.isFinite) && Number.isFinite(radiusMeters) && radiusMeters > 0) {
      const latitudeDelta = radiusMeters / 110540;
      const longitudeDelta = radiusMeters
        / (111320 * Math.max(Math.cos(center[1] * Math.PI / 180), 0.1));
      positions.push(
        [center[0] - longitudeDelta, center[1] - latitudeDelta],
        [center[0] + longitudeDelta, center[1] + latitudeDelta]
      );
    }
  }
  for (const item of [
    ...(run?.result?.items || run?.result?.accepted || []),
    ...(run?.result?.distances || [])
  ]) {
    const coordinates = item.geometry?.coordinates || item.coordinates;
    if (Array.isArray(coordinates)) positions.push(coordinates.map(Number));
  }
  if (!positions.length) return [0, 0, 1, 1];
  const longitude = positions.map((point) => point[0]);
  const latitude = positions.map((point) => point[1]);
  const minLon = Math.min(...longitude);
  const maxLon = Math.max(...longitude);
  const minLat = Math.min(...latitude);
  const maxLat = Math.max(...latitude);
  const lonPad = Math.max((maxLon - minLon) * 0.08, 0.0005);
  const latPad = Math.max((maxLat - minLat) * 0.08, 0.0005);
  return [minLon - lonPad, minLat - latPad, maxLon + lonPad, maxLat + latPad];
}

function projection(bounds, width, height, padding = 48) {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const lonSpan = Math.max(maxLon - minLon, 1e-9);
  const latSpan = Math.max(maxLat - minLat, 1e-9);
  return ([longitude, latitude]) => [
    padding + ((longitude - minLon) / lonSpan) * (width - padding * 2),
    height - padding - ((latitude - minLat) / latSpan) * (height - padding * 2)
  ];
}

function pathFromRing(ring, project) {
  return ring.map((point, index) => {
    const [x, y] = project(point);
    return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ') + ' Z';
}

function boundaryPath(geometry, project) {
  if (!geometry) return '';
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.flatMap((polygon) => polygon.map((ring) => pathFromRing(ring, project))).join(' ');
}

function linePath(geometry, project) {
  const lines = geometry?.type === 'MultiLineString'
    ? geometry.coordinates
    : [geometry?.coordinates || []];
  return lines.map((line) => line.map((point, index) => {
      const [x, y] = project(point);
      return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' '))
    .join(' ');
}

function marker(feature, project, style) {
  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return '';
  const [x, y] = project(coordinates);
  const severity = feature.properties?.severity;
  const color = severity === 'high' ? '#ef4444'
    : severity === 'medium' ? '#f59e0b'
      : severity === 'low' ? '#14b8a6'
        : style.color;
  return `<g><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${style.radius + 3}" fill="${style.glow}" /><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${style.radius}" fill="${color}" stroke="#ffffff" stroke-width="1.5"><title>${escapeXml(feature.properties?.title || feature.properties?.name || feature.id)}</title></circle></g>`;
}

export function renderMapSnapshotSvg(view, input = {}) {
  const width = Math.max(640, Math.min(2560, Number(input.width) || 1280));
  const height = Math.max(360, Math.min(1440, Number(input.height) || 720));
  const mapStyle = MAP_STYLES.has(input.mapStyle) ? input.mapStyle : 'dark';
  const layers = {
    boundary: true,
    issues: true,
    photos: true,
    routes: true,
    stops: true,
    poi: true,
    excludedPoi: false,
    analysisRange: true,
    distanceLines: true,
    ...(input.layers || {})
  };
  const bounds = Array.isArray(input.viewport?.bounds) && input.viewport.bounds.length === 4
    ? input.viewport.bounds.map(Number)
    : snapshotBounds(view);
  const project = projection(bounds, width, height);
  const run = featureItems(view.spatialAnalyses)[0];
  const dark = mapStyle !== 'light';
  const background = dark ? '#06151c' : '#eef4f5';
  const grid = dark ? '#12303a' : '#cfdee1';
  const text = dark ? '#d8f7f2' : '#17333c';
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(view.project?.name || '项目地图快照')}">`,
    `<rect width="${width}" height="${height}" fill="${background}"/>`,
    `<defs><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${grid}" stroke-width="1"/></pattern></defs>`,
    `<rect width="${width}" height="${height}" fill="url(#grid)" opacity="0.65"/>`
  ];
  if (layers.boundary && view.boundary?.geometry) {
    const geometry = normalizeGeometry(view.boundary.geometry, { closeRings: true });
    parts.push(`<path d="${boundaryPath(geometry, project)}" fill="#14b8a6" fill-opacity="0.13" fill-rule="evenodd" stroke="#22d3ee" stroke-width="3"/>`);
  }
  const analysisCenter = Array.isArray(run?.parameters?.center)
    ? run.parameters.center.map(Number)
    : null;
  const analysisRadius = Number(run?.parameters?.radiusMeters);
  if (
    layers.analysisRange
    && analysisCenter?.length >= 2
    && analysisCenter.every(Number.isFinite)
    && Number.isFinite(analysisRadius)
    && analysisRadius > 0
  ) {
    const [x, y] = project(analysisCenter);
    const longitudeMetersPerDegree = 111320
      * Math.max(Math.cos(analysisCenter[1] * Math.PI / 180), 0.1);
    const latitudeMetersPerDegree = 110540;
    const radiusX = analysisRadius / longitudeMetersPerDegree
      / Math.max(bounds[2] - bounds[0], 1e-9) * (width - 96);
    const radiusY = analysisRadius / latitudeMetersPerDegree
      / Math.max(bounds[3] - bounds[1], 1e-9) * (height - 96);
    const pixelRadius = Math.max(3, (radiusX + radiusY) / 2);
    parts.push(
      `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${pixelRadius.toFixed(2)}" fill="#f59e0b" fill-opacity="0.10" stroke="#f59e0b" stroke-width="2" stroke-dasharray="7 5"/>`,
      `<text x="${x.toFixed(2)}" y="${Math.max(16, y - pixelRadius - 6).toFixed(2)}" text-anchor="middle" fill="#fcd34d" font-family="system-ui,sans-serif" font-size="12">${analysisRadius.toFixed(0)}米${run.status === 'stale' ? ' · 已过期' : ''}</text>`
    );
  }
  if (layers.distanceLines && analysisCenter) {
    for (const item of run?.result?.distances || []) {
      if (!Array.isArray(item.coordinates)) continue;
      const [startX, startY] = project(analysisCenter);
      const [endX, endY] = project(item.coordinates);
      parts.push(
        `<line x1="${startX.toFixed(2)}" y1="${startY.toFixed(2)}" x2="${endX.toFixed(2)}" y2="${endY.toFixed(2)}" stroke="#fcd34d" stroke-width="1.5" stroke-dasharray="5 4"/>`,
        `<text x="${((startX + endX) / 2).toFixed(2)}" y="${((startY + endY) / 2 - 4).toFixed(2)}" text-anchor="middle" fill="#fef3c7" font-family="system-ui,sans-serif" font-size="10">${Number(item.distanceMeters).toFixed(1)}米</text>`
      );
    }
  }
  if (layers.routes) {
    for (const route of featureItems(view.routes)) {
      parts.push(`<path d="${linePath(route.geometry, project)}" fill="none" stroke="#a78bfa" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  }
  if (layers.issues) {
    for (const issue of featureItems(view.issues)) {
      parts.push(marker(issue, project, { color: '#22d3ee', radius: 7, glow: 'rgba(34,211,238,0.24)' }));
    }
  }
  if (layers.photos) {
    for (const photo of featureItems(view.photos)) {
      parts.push(marker(photo, project, { color: '#38bdf8', radius: 5, glow: 'rgba(56,189,248,0.2)' }));
    }
  }
  if (layers.stops) {
    for (const stop of featureItems(view.stops)) {
      parts.push(marker(stop, project, { color: '#facc15', radius: 6, glow: 'rgba(250,204,21,0.2)' }));
    }
  }
  const poiItems = run?.result?.items || run?.result?.accepted || [];
  if (layers.poi) {
    for (const item of poiItems.filter((poi) => poi.reviewStatus !== 'excluded')) {
      parts.push(marker({
        id: item.normalizedId || item.id,
        geometry: item.geometry || { type: 'Point', coordinates: item.coordinates },
        properties: { name: item.name }
      }, project, { color: '#fb7185', radius: 5, glow: 'rgba(251,113,133,0.2)' }));
    }
  }
  if (layers.excludedPoi) {
    for (const item of poiItems.filter((poi) => poi.reviewStatus === 'excluded')) {
      const coordinates = item.geometry?.coordinates || item.coordinates;
      if (!Array.isArray(coordinates)) continue;
      const [x, y] = project(coordinates);
      parts.push(`<path d="M${(x - 5).toFixed(2)} ${(y - 5).toFixed(2)}L${(x + 5).toFixed(2)} ${(y + 5).toFixed(2)}M${(x + 5).toFixed(2)} ${(y - 5).toFixed(2)}L${(x - 5).toFixed(2)} ${(y + 5).toFixed(2)}" fill="none" stroke="#ef4444" stroke-width="2"><title>${escapeXml(item.name || item.normalizedId || item.id)}</title></path>`);
    }
  }
  parts.push(
    `<rect x="24" y="22" width="${Math.min(480, width - 48)}" height="66" rx="4" fill="${background}" fill-opacity="0.88" stroke="${grid}"/>`,
    `<text x="42" y="50" fill="${text}" font-family="system-ui,sans-serif" font-size="18" font-weight="600">${escapeXml(view.project?.name || '项目地图')}</text>`,
    `<text x="42" y="72" fill="${text}" fill-opacity="0.65" font-family="system-ui,sans-serif" font-size="11">Business GIS · ${escapeXml(mapStyle)} · ${escapeXml(view.viewport?.targetCrs || 'GCJ02')}</text>`,
    `<g transform="translate(26 ${height - 38})"><circle cx="5" cy="0" r="5" fill="#ef4444"/><text x="14" y="4" fill="${text}" font-family="system-ui,sans-serif" font-size="10">高风险问题</text><circle cx="92" cy="0" r="4" fill="#38bdf8"/><text x="102" y="4" fill="${text}" font-family="system-ui,sans-serif" font-size="10">照片</text><path d="M145 0H173" stroke="#a78bfa" stroke-width="3"/><text x="180" y="4" fill="${text}" font-family="system-ui,sans-serif" font-size="10">路线</text><circle cx="230" cy="0" r="4" fill="#fb7185"/><text x="240" y="4" fill="${text}" font-family="system-ui,sans-serif" font-size="10">POI</text></g>`,
    `<text x="${width - 24}" y="${height - 18}" text-anchor="end" fill="${text}" fill-opacity="0.55" font-family="system-ui,sans-serif" font-size="10">确定性矢量快照 · 不替代法定测绘成果</text>`,
    '</svg>'
  );
  return { content: parts.join(''), bounds, width, height, mapStyle, layers };
}

function reportMapView(report) {
  const snapshot = report?.contentSnapshot;
  const geometry = snapshot?.project?.boundaryGeometry;
  return {
    project: {
      id: String(report.projectId),
      name: snapshot?.project?.name || report.title || '',
      revision: Number(snapshot?.project?.projectRevision) || 0
    },
    viewport: { targetCrs: snapshot?.project?.boundaryCrs || 'WGS84' },
    boundary: geometry ? {
      id: String(report.projectId),
      kind: 'project-boundary',
      geometry,
      crs: snapshot.project.boundaryCrs || 'WGS84',
      revision: Number(snapshot.project.projectRevision) || 0,
      properties: {}
    } : null,
    issues: {
      items: (snapshot?.issues || []).filter((issue) => Array.isArray(issue.geometry)).map((issue) => ({
        id: issue.id,
        kind: 'official-issue',
        geometry: { type: 'Point', coordinates: issue.geometry },
        crs: snapshot?.project?.boundaryCrs || 'WGS84',
        properties: {
          title: issue.title,
          severity: issue.severity,
          categoryName: issue.categoryName
        }
      }))
    },
    photos: { items: [] },
    routes: { items: [] },
    stops: { items: [] },
    spatialAnalyses: { items: snapshot?.spatialAnalyses || [] },
    sourceRevisions: {
      reportId: report.id,
      reportRevision: Number(report.reportRevision) || 1,
      projectRevision: Number(snapshot?.project?.projectRevision) || 0,
      issueRevisions: report.dataSnapshot?.issueRevisions || []
    }
  };
}

export function publicMapSnapshot(snapshot) {
  if (!snapshot) return snapshot;
  const { generationPayload: _generationPayload, ...publicRecord } = snapshot;
  return publicRecord;
}

export async function enqueueMapSnapshot(dependencies, projectId, input, options = {}) {
  const purpose = clean(input?.purpose, 30) || 'export';
  if (!PURPOSES.has(purpose)) {
    throw snapshotError('地图快照用途无效。', 400, 'MAP_SNAPSHOT_PURPOSE_INVALID');
  }
  const createdBy = clean(input?.createdBy, 120);
  if (!createdBy) {
    throw snapshotError('请填写地图快照生成人员。', 400, 'MAP_SNAPSHOT_CREATOR_REQUIRED');
  }
  let report = null;
  if (input?.reportId) {
    report = await dependencies.reportRepository.get(input.reportId);
    if (!report || String(report.projectId) !== String(projectId)) {
      throw snapshotError('报告不存在或不属于当前项目。', 404, 'MAP_SNAPSHOT_REPORT_NOT_FOUND');
    }
  }
  const view = options.mapView || (report
    ? reportMapView(report)
    : await getProjectMapView(dependencies.mapViewDependencies, projectId, {
        limit: Math.max(1, Math.min(5000, Number(input?.limit) || 5000))
      }));
  if (!view.boundary) {
    throw snapshotError('项目没有可用于地图快照的真实边界。', 409, 'MAP_SNAPSHOT_BOUNDARY_REQUIRED');
  }
  const id = options.id || `MAPSNAP-${randomUUID()}`;
  const now = options.now || new Date().toISOString();
  const generationInput = {
    mapStyle: MAP_STYLES.has(input?.mapStyle) ? input.mapStyle : 'dark',
    viewport: input?.viewport || null,
    layers: input?.layers || {},
    width: input?.width,
    height: input?.height
  };
  const queued = {
    id,
    projectId: String(projectId),
    reportId: report?.id || null,
    purpose,
    mapStyle: generationInput.mapStyle,
    viewport: input?.viewport || null,
    layers: input?.layers || {},
    sourceRevisions: view.sourceRevisions || {},
    objectKey: null,
    contentHash: null,
    contentType: 'image/svg+xml',
    status: 'queued',
    queuedAt: now,
    createdBy,
    createdAt: now,
    generatedAt: null,
    generationPayload: {
      input: generationInput,
      view
    },
    schemaVersion: '1.1.0'
  };
  await dependencies.mapSnapshotRepository.put(queued);
  return queued;
}

async function attachSnapshotToReport(dependencies, snapshot, generatedAt) {
  if (!snapshot.reportId || typeof dependencies.reportRepository?.put !== 'function') return;
  const report = await dependencies.reportRepository.get(snapshot.reportId);
  if (!report || String(report.projectId) !== String(snapshot.projectId)) {
    throw snapshotError('地图快照关联报告在后台生成期间已不存在。', 409, 'MAP_SNAPSHOT_REPORT_CHANGED');
  }
  const nextRevision = Number(report.reportRevision || 1) + 1;
  await dependencies.reportRepository.put({
    ...report,
    latestMapSnapshotId: snapshot.id,
    mapSnapshots: [
      ...(Array.isArray(report.mapSnapshots) ? report.mapSnapshots : [])
        .filter((item) => String(item.id) !== String(snapshot.id)),
      {
        id: snapshot.id,
        contentHash: snapshot.contentHash,
        mapStyle: snapshot.mapStyle,
        generatedAt,
        sourceReportRevision: Number(snapshot.sourceRevisions?.reportRevision) || 1
      }
    ],
    reportRevision: nextRevision,
    updatedAt: generatedAt,
    auditTrail: [
      ...(Array.isArray(report.auditTrail) ? report.auditTrail : []),
      {
        revision: nextRevision,
        action: 'map_snapshot_attached',
        actor: snapshot.createdBy,
        at: generatedAt,
        mapSnapshotId: snapshot.id
      }
    ]
  });
}

export async function processMapSnapshot(dependencies, snapshotId, options = {}) {
  const queued = options.snapshot
    || await dependencies.mapSnapshotRepository.get(snapshotId);
  if (!queued || !['queued', 'running'].includes(queued.status)) return queued;
  const payload = queued.generationPayload;
  if (!payload?.view || !payload?.input) {
    const error = snapshotError(
      '地图快照缺少持久化生成输入，无法从后台恢复。',
      409,
      'MAP_SNAPSHOT_PAYLOAD_MISSING'
    );
    await dependencies.mapSnapshotRepository.put({
      ...queued,
      status: 'failed',
      failure: { code: error.code, message: error.message },
      failedAt: options.now || new Date().toISOString()
    });
    throw error;
  }
  const startedAt = options.now || new Date().toISOString();
  const running = await dependencies.mapSnapshotRepository.put({
    ...queued,
    status: 'running',
    startedAt,
    failure: null,
    failedAt: null
  });
  try {
    const render = dependencies.renderMapSnapshot || renderMapSnapshotSvg;
    const rendered = await render(payload.view, payload.input);
    const contentHash = createHash('sha256').update(rendered.content).digest('hex');
    const objectKey = await dependencies.mapSnapshotRepository.writeContent(
      running.id,
      rendered.content
    );
    const generatedAt = options.now || new Date().toISOString();
    const generated = {
      ...running,
      mapStyle: rendered.mapStyle,
      viewport: {
        center: [
          (rendered.bounds[0] + rendered.bounds[2]) / 2,
          (rendered.bounds[1] + rendered.bounds[3]) / 2
        ],
        zoom: payload.input?.viewport?.zoom || null,
        bounds: rendered.bounds,
        width: rendered.width,
        height: rendered.height
      },
      layers: rendered.layers,
      objectKey,
      contentHash,
      status: 'generated',
      generatedAt,
      generationPayload: null,
      schemaVersion: '1.1.0'
    };
    await attachSnapshotToReport(dependencies, generated, generatedAt);
    return dependencies.mapSnapshotRepository.put(generated);
  } catch (error) {
    await dependencies.mapSnapshotRepository.put({
      ...running,
      status: 'failed',
      failure: {
        code: error.code || 'MAP_SNAPSHOT_GENERATION_FAILED',
        message: error.message
      },
      failedAt: options.now || new Date().toISOString()
    });
    throw error;
  }
}

export async function createMapSnapshot(dependencies, projectId, input, options = {}) {
  const queued = await enqueueMapSnapshot(dependencies, projectId, input, options);
  return processMapSnapshot(dependencies, queued.id, { ...options, snapshot: queued });
}

function revisionMap(items, field) {
  return new Map((Array.isArray(items) ? items : []).map((item) => [
    String(item.id),
    Number(item[field]) || 0
  ]));
}

export function markMapSnapshotStaleness(snapshots, currentView) {
  const current = currentView?.sourceRevisions || {};
  const currentIssues = revisionMap(current.issueRevisions, 'geometryRevision');
  const currentPhotos = revisionMap(current.photoRevisions, 'metadataRevision');
  const currentRoutes = revisionMap(current.routeRevisions, 'routeRevision');
  return (Array.isArray(snapshots) ? snapshots : []).map((snapshot) => {
    if (snapshot.reportId || snapshot.status !== 'generated') return snapshot;
    const source = snapshot.sourceRevisions || {};
    const reasons = [];
    if (Number(source.projectRevision || 0) !== Number(current.projectRevision || 0)) {
      reasons.push('PROJECT_BOUNDARY_OR_PROFILE_CHANGED');
    }
    for (const item of source.issueRevisions || []) {
      if (currentIssues.get(String(item.id)) !== Number(item.geometryRevision || 0)) {
        reasons.push('ISSUE_GEOMETRY_CHANGED');
        break;
      }
    }
    for (const item of source.photoRevisions || []) {
      if (currentPhotos.get(String(item.id)) !== Number(item.metadataRevision || 0)) {
        reasons.push('PHOTO_GEOMETRY_CHANGED');
        break;
      }
    }
    for (const item of source.routeRevisions || []) {
      if (currentRoutes.get(String(item.id)) !== Number(item.routeRevision || 0)) {
        reasons.push('SURVEY_ROUTE_CHANGED');
        break;
      }
    }
    return reasons.length ? {
      ...snapshot,
      status: 'stale',
      generatedStatus: snapshot.status,
      staleReasons: [...new Set(reasons)]
    } : {
      ...snapshot,
      staleReasons: []
    };
  });
}

export async function enqueueMapSnapshotRetry(dependencies, snapshotId, input, options = {}) {
  const snapshot = await dependencies.mapSnapshotRepository.get(snapshotId);
  if (!snapshot) {
    throw snapshotError('地图快照不存在。', 404, 'MAP_SNAPSHOT_NOT_FOUND');
  }
  if (snapshot.status !== 'failed') {
    throw snapshotError('只有生成失败的地图快照可以重试。', 409, 'MAP_SNAPSHOT_NOT_RETRYABLE');
  }
  const createdBy = clean(input?.createdBy, 120);
  if (!createdBy) {
    throw snapshotError('请填写地图快照生成人员。', 400, 'MAP_SNAPSHOT_CREATOR_REQUIRED');
  }
  if (snapshot.generationPayload?.view && snapshot.generationPayload?.input) {
    const queuedAt = options.now || new Date().toISOString();
    const queued = {
      ...snapshot,
      status: 'queued',
      queuedAt,
      startedAt: null,
      failedAt: null,
      failure: null,
      createdBy,
      retryCount: Number(snapshot.retryCount || 0) + 1,
      schemaVersion: '1.1.0'
    };
    await dependencies.mapSnapshotRepository.put(queued);
    return queued;
  }
  return enqueueMapSnapshot(dependencies, snapshot.projectId, {
    purpose: snapshot.purpose,
    reportId: snapshot.reportId,
    mapStyle: snapshot.mapStyle,
    viewport: snapshot.viewport,
    layers: snapshot.layers,
    createdBy: input?.createdBy
  }, {
    ...options,
    id: snapshot.id
  });
}

export async function retryMapSnapshot(dependencies, snapshotId, input, options = {}) {
  const queued = await enqueueMapSnapshotRetry(dependencies, snapshotId, input, options);
  return processMapSnapshot(dependencies, queued.id, { ...options, snapshot: queued });
}

export class MapSnapshotRunner {
  constructor(options) {
    this.dependencies = options.dependencies;
    this.concurrency = Math.max(1, Math.min(8, Number(options.concurrency) || 2));
    this.queue = [];
    this.queuedIds = new Set();
    this.active = new Set();
    this.lastErrors = new Map();
    this.scheduled = false;
  }

  enqueue(snapshotId) {
    const id = String(snapshotId || '');
    if (!id || this.queuedIds.has(id) || this.active.has(id)) return;
    this.queue.push(id);
    this.queuedIds.add(id);
    this.schedule();
  }

  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    setImmediate(() => {
      this.scheduled = false;
      this.drain();
    });
  }

  drain() {
    while (this.active.size < this.concurrency && this.queue.length) {
      const id = this.queue.shift();
      this.queuedIds.delete(id);
      this.active.add(id);
      processMapSnapshot(this.dependencies, id)
        .then(() => this.lastErrors.delete(id))
        .catch((error) => this.lastErrors.set(id, error))
        .finally(() => {
          this.active.delete(id);
          this.drain();
        });
    }
  }

  async pendingItems(status) {
    const items = [];
    const limit = 500;
    for (let offset = 0; ; offset += limit) {
      const page = await this.dependencies.mapSnapshotRepository.list(
        '',
        '',
        { status, offset, limit }
      );
      items.push(...page);
      if (page.length < limit) return items;
    }
  }

  async recover() {
    const [queuedItems, runningItems] = await Promise.all([
      this.pendingItems('queued'),
      this.pendingItems('running')
    ]);
    const items = new Map(
      [...queuedItems, ...runningItems].map((snapshot) => [String(snapshot.id), snapshot])
    );
    for (const snapshot of items.values()) {
      const queued = snapshot.status === 'running'
        ? {
            ...snapshot,
            status: 'queued',
            startedAt: null,
            recoveryCount: Number(snapshot.recoveryCount || 0) + 1,
            recoveredAt: new Date().toISOString()
          }
        : snapshot;
      if (queued !== snapshot) await this.dependencies.mapSnapshotRepository.put(queued);
      this.enqueue(queued.id);
    }
    return items.size;
  }

  async waitForIdle(timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    while (this.queue.length || this.active.size || this.scheduled) {
      if (Date.now() >= deadline) {
        throw snapshotError('等待地图快照后台任务超时。', 504, 'MAP_SNAPSHOT_RUNNER_TIMEOUT');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
