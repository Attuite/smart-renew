import { MapOverlayLayer } from './map-overlay-layer.js';

let sdkPromise = null;

const MAP_STYLES = Object.freeze({
  light: 'amap://styles/light',
  dark: 'amap://styles/dark',
  'satellite-road': 'satellite-road'
});

const LAYER_VISIBILITY = Object.freeze({
  boundary: true,
  boundaryLabel: true,
  boundaryHistory: false,
  issues: true,
  pendingIssues: true,
  issueLabels: true,
  photos: false,
  manualPhotos: false,
  routes: false,
  stops: false,
  poi: false,
  excludedPoi: false,
  analysisRange: false,
  distanceLines: false
});

const CLUSTERABLE_LAYERS = new Set([
  'issues',
  'pendingIssues',
  'photos',
  'manualPhotos',
  'poi',
  'stops'
]);

function validPoint(value) {
  const point = Array.isArray(value) ? value.map(Number) : [];
  return point.length >= 2
    && Number.isFinite(point[0])
    && Number.isFinite(point[1])
    ? point.slice(0, 2)
    : null;
}

function lngLatPair(value) {
  if (Array.isArray(value)) return validPoint(value);
  if (value && typeof value.getLng === 'function' && typeof value.getLat === 'function') {
    return [Number(value.getLng()), Number(value.getLat())];
  }
  return validPoint([value?.lng, value?.lat]);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeCrs(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function closeRing(ring) {
  const points = (Array.isArray(ring) ? ring : []).map(validPoint).filter(Boolean);
  if (points.length >= 3 && (
    points[0][0] !== points.at(-1)[0] || points[0][1] !== points.at(-1)[1]
  )) points.push([...points[0]]);
  return points;
}

export function boundaryPathsFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    const ring = closeRing(value);
    return ring.length >= 4 ? [[ring]] : [];
  }
  if (value.type === 'Polygon') {
    const polygon = (Array.isArray(value.coordinates) ? value.coordinates : [])
      .map(closeRing)
      .filter((ring) => ring.length >= 4);
    return polygon.length ? [polygon] : [];
  }
  if (value.type === 'MultiPolygon') {
    return (Array.isArray(value.coordinates) ? value.coordinates : [])
      .map((polygon) => (Array.isArray(polygon) ? polygon : [])
        .map(closeRing)
        .filter((ring) => ring.length >= 4))
      .filter((polygon) => polygon.length);
  }
  return [];
}

function featurePoint(value) {
  return validPoint(value?.geometry?.coordinates || value?.coordinates);
}

function featureProperties(value) {
  return value?.properties && typeof value.properties === 'object' ? value.properties : value || {};
}

export function issueMarkerDescriptor(issue, selected = false) {
  const properties = featureProperties(issue);
  const severity = ['high', 'medium', 'low'].includes(properties.severity)
    ? properties.severity
    : 'unknown';
  const bindingStatus = properties.bindingStatus || 'located';
  const stale = Boolean(properties.stale || issue?.status === 'stale');
  const id = String(issue?.id || properties.id || '');
  const label = String(properties.shortCode || id).slice(-12);
  const classes = [
    'business-map-marker',
    `risk-${severity}`,
    `binding-${bindingStatus}`,
    selected ? 'is-selected' : '',
    stale ? 'is-stale' : ''
  ].filter(Boolean).join(' ');
  return {
    id,
    title: String(properties.title || id || '问题点').slice(0, 120),
    severity,
    bindingStatus,
    stale,
    label,
    className: classes,
    html: `<button type="button" class="${classes}" data-map-issue="${escapeHtml(id)}" aria-label="${escapeHtml(properties.title || id || '问题点')}"><i></i><b>${escapeHtml(label)}</b></button>`
  };
}

function genericMarkerHtml(kind, item, label) {
  const id = String(item?.id || '');
  const outside = Boolean(featureProperties(item).outsideBoundary);
  const classes = `business-map-marker marker-${kind}${outside ? ' is-outside-boundary' : ''}`;
  const accessibleLabel = `${label}${outside ? '，位于项目边界外' : ''}`;
  return `<button type="button" class="${classes}" data-map-${kind}="${escapeHtml(id)}" aria-label="${escapeHtml(accessibleLabel)}"><i></i></button>`;
}

function mapViewCollection(view, name) {
  return Array.isArray(view?.[name]?.items) ? view[name].items : [];
}

export function loadAmapSdk(config) {
  if (globalThis.AMap) return Promise.resolve(globalThis.AMap);
  if (sdkPromise) return sdkPromise;
  if (!config?.ready || !config?.key || !config?.securityCode) {
    return Promise.reject(new Error('高德浏览器地图凭据未配置。'));
  }
  globalThis._AMapSecurityConfig = { securityJsCode: config.securityCode };
  const plugins = Array.isArray(config.plugins) ? config.plugins.join(',') : '';
  const source = new URL('https://webapi.amap.com/maps');
  source.searchParams.set('v', config.version || '2.0');
  source.searchParams.set('key', config.key);
  if (plugins) source.searchParams.set('plugin', plugins);
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source.toString();
    script.async = true;
    script.addEventListener('load', () => {
      if (globalThis.AMap) resolve(globalThis.AMap);
      else reject(new Error('高德地图SDK加载后未提供AMap对象。'));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('高德地图SDK加载失败。')), { once: true });
    document.head.append(script);
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

export class AmapMapController {
  static async create(container, browserConfig, options = {}) {
    const AMap = await loadAmapSdk(browserConfig);
    return new AmapMapController(AMap, container, options);
  }

  constructor(AMap, container, options = {}) {
    this.AMap = AMap;
    this.container = container;
    this.onBoundaryChanged = options.onBoundaryChanged || (() => {});
    this.onPointSelected = options.onPointSelected || (() => {});
    this.onIssueSelected = options.onIssueSelected || (() => {});
    this.onIssueGeometryDraft = options.onIssueGeometryDraft || (() => {});
    this.onPhotoSelected = options.onPhotoSelected || (() => {});
    this.onPhotoGeometryDraft = options.onPhotoGeometryDraft || (() => {});
    this.onPoiSelected = options.onPoiSelected || (() => {});
    this.onRouteSelected = options.onRouteSelected || (() => {});
    this.onViewportChanged = options.onViewportChanged || (() => {});
    this.clusterThreshold = Math.max(50, Number(options.clusterThreshold) || 250);
    this.mapStyle = options.mapStyle || 'dark';
    this.selectedIssueId = '';
    this.mapView = null;
    this.layers = Object.fromEntries(Object.keys(LAYER_VISIBILITY).map((name) => [name, []]));
    this.visibility = { ...LAYER_VISIBILITY };
    this.mouseTool = null;
    this.boundaryEditor = null;
    this.boundaryEditHistory = [];
    this.boundaryEditIndex = -1;
    this.boundaryEditOriginal = null;
    this.clusters = {};
    this.infoWindow = typeof AMap.InfoWindow === 'function'
      ? new AMap.InfoWindow({ offset: typeof AMap.Pixel === 'function' ? new AMap.Pixel(0, -22) : undefined })
      : null;
    this.map = new AMap.Map(container, {
      resizeEnable: true,
      mapStyle: MAP_STYLES[this.mapStyle] === 'satellite-road'
        ? MAP_STYLES.dark
        : MAP_STYLES[this.mapStyle] || MAP_STYLES.dark,
      zoom: 14
    });
    this.layerControllers = Object.fromEntries(
      Object.entries(this.visibility).map(([name, visible]) => [
        name,
        new MapOverlayLayer({
          name,
          map: this.map,
          visible,
          clusterThreshold: this.clusterThreshold,
          createCluster: CLUSTERABLE_LAYERS.has(name)
            && typeof this.AMap.MarkerCluster === 'function'
            ? (map, overlays, clusterOptions) => new this.AMap.MarkerCluster(
                map,
                overlays,
                clusterOptions
              )
            : null,
          clusterOptions: {
            gridSize: 52,
            maxZoom: 18,
            renderClusterMarker(context) {
              const count = Number(context?.count) || 0;
              context?.marker?.setContent?.(
                `<button type="button" class="business-map-cluster" aria-label="${count}个聚合点"><strong>${count}</strong></button>`
              );
            }
          }
        })
      ])
    );
    if (typeof AMap.Scale === 'function') this.map.addControl(new AMap.Scale());
    if (typeof AMap.ToolBar === 'function') {
      this.map.addControl(new AMap.ToolBar({ position: { top: '10px', right: '10px' } }));
    }
    this.map.on('click', (event) => {
      const point = lngLatPair(event?.lnglat);
      if (point) this.onPointSelected(point);
    });
    for (const eventName of ['moveend', 'zoomend']) {
      this.map.on(eventName, () => {
        const bounds = this.map.getBounds?.();
        const southwest = lngLatPair(bounds?.getSouthWest?.());
        const northeast = lngLatPair(bounds?.getNorthEast?.());
        if (southwest && northeast) {
          this.onViewportChanged(
            [southwest[0], southwest[1], northeast[0], northeast[1]],
            Number(this.map.getZoom?.()) || null
          );
        }
      });
    }
    this.setMapStyle(this.mapStyle);
    if (options.mapView) this.setMapView(options.mapView);
    else {
      this.setBoundary(options.boundary || []);
      this.setIssues(options.issues || []);
    }
  }

  replaceLayer(name, overlays) {
    const layer = this.layerControllers[name];
    if (!layer) return false;
    layer.setData(overlays);
    this.layers[name] = layer.overlays;
    this.clusters[name] = layer.cluster;
    return true;
  }

  setLayerVisibility(name, visible) {
    const layer = this.layerControllers[name];
    if (!layer) return false;
    this.visibility[name] = Boolean(visible);
    return layer.setVisible(visible);
  }

  setMapStyle(style) {
    const requested = MAP_STYLES[style] ? style : 'dark';
    this.mapStyle = requested;
    if (requested === 'satellite-road' && this.AMap.TileLayer) {
      const overlays = [];
      if (typeof this.AMap.TileLayer.Satellite === 'function') {
        overlays.push(new this.AMap.TileLayer.Satellite());
      }
      if (typeof this.AMap.TileLayer.RoadNet === 'function') {
        overlays.push(new this.AMap.TileLayer.RoadNet());
      }
      if (overlays.length && typeof this.map.setLayers === 'function') this.map.setLayers(overlays);
      return;
    }
    if (typeof this.map.setMapStyle === 'function') {
      this.map.setMapStyle(MAP_STYLES[requested] || MAP_STYLES.dark);
    }
  }

  setBoundary(boundary) {
    this.closeBoundaryEditor();
    const polygons = boundaryPathsFrom(boundary);
    const overlays = polygons.map((paths) => new this.AMap.Polygon({
      path: paths,
      strokeColor: '#21d4fd',
      strokeWeight: 3,
      strokeOpacity: 0.95,
      fillColor: '#14b8a6',
      fillOpacity: 0.12,
      bubble: false
    }));
    this.replaceLayer('boundary', overlays);
    if (overlays.length && typeof this.map.setFitView === 'function') {
      this.map.setFitView(overlays, false, [45, 45, 45, 45], 16);
    }
  }

  setBoundaryLabel(feature) {
    if (typeof this.AMap.Text !== 'function') {
      this.replaceLayer('boundaryLabel', []);
      return;
    }
    const paths = boundaryPathsFrom(feature?.geometry);
    const points = paths.flatMap((polygon) => polygon[0] || []);
    if (!points.length) {
      this.replaceLayer('boundaryLabel', []);
      return;
    }
    const center = [
      points.reduce((sum, point) => sum + point[0], 0) / points.length,
      points.reduce((sum, point) => sum + point[1], 0) / points.length
    ];
    const properties = featureProperties(feature);
    const label = [
      properties.projectName || properties.name || '项目边界',
      feature.crs || '',
      `v${Number(feature.revision) || 0}`
    ].filter(Boolean).join(' · ');
    this.replaceLayer('boundaryLabel', [new this.AMap.Text({
      text: label,
      position: center,
      anchor: 'center',
      style: {
        color: '#a5f3fc',
        background: 'rgba(3, 17, 22, .82)',
        border: '1px solid rgba(40, 219, 230, .45)',
        padding: '4px 7px',
        fontSize: '10px'
      }
    })]);
  }

  setBoundaryHistory(revisions) {
    const overlays = (Array.isArray(revisions) ? revisions : [])
      .filter((feature) => normalizeCrs(feature?.crs || '') === 'GCJ02')
      .flatMap((feature) => boundaryPathsFrom(feature.geometry).map((paths) =>
        new this.AMap.Polygon({
          path: paths,
          strokeColor: '#c084fc',
          strokeWeight: 2,
          strokeOpacity: 0.78,
          strokeStyle: 'dashed',
          fillColor: '#a855f7',
          fillOpacity: 0.035,
          bubble: false,
          extData: {
            id: String(feature.id),
            kind: 'boundary-history',
            revision: Number(feature.revision) || 0
          }
        })
      ));
    this.replaceLayer('boundaryHistory', overlays);
  }

  createIssueMarker(issue) {
    const point = featurePoint(issue);
    if (!point) return null;
    const descriptor = issueMarkerDescriptor(issue, String(issue.id) === this.selectedIssueId);
    const marker = new this.AMap.Marker({
      position: point,
      title: descriptor.title,
      content: descriptor.html,
      offset: typeof this.AMap.Pixel === 'function' ? new this.AMap.Pixel(-16, -16) : undefined,
      draggable: true,
      extData: { id: descriptor.id, kind: 'official-issue' }
    });
    marker.on?.('click', () => {
      this.setSelectedIssue(descriptor.id);
      this.openInfoWindow(issue, marker, 'issue');
      this.onIssueSelected(descriptor.id, issue);
    });
    marker.on?.('dragend', (event) => {
      const coordinates = lngLatPair(event?.lnglat || marker.getPosition?.());
      if (coordinates) this.onIssueGeometryDraft(descriptor.id, coordinates, issue);
    });
    return marker;
  }

  setIssues(issues) {
    const items = (Array.isArray(issues) ? issues : [])
      .filter((item) => normalizeCrs(item?.crs || 'GCJ02') === 'GCJ02');
    this._issueData = items;
    const pending = items.filter((issue) =>
      featureProperties(issue).bindingStatus === 'pending'
    );
    const confirmed = items.filter((issue) =>
      featureProperties(issue).bindingStatus !== 'pending'
    );
    this.replaceLayer('issues', confirmed.map((issue) => this.createIssueMarker(issue)));
    this.replaceLayer('pendingIssues', pending.map((issue) => this.createIssueMarker(issue)));
    if (typeof this.AMap.Text !== 'function') {
      this.replaceLayer('issueLabels', []);
      return;
    }
    this.replaceLayer('issueLabels', items.map((issue) => {
      const point = featurePoint(issue);
      const properties = featureProperties(issue);
      return point ? new this.AMap.Text({
        text: String(properties.title || issue.id || '').slice(0, 30),
        position: point,
        offset: typeof this.AMap.Pixel === 'function' ? new this.AMap.Pixel(0, 18) : undefined,
        anchor: 'top-center',
        style: {
          color: '#e8f5f6',
          background: 'rgba(3, 17, 22, .75)',
          border: '0',
          padding: '2px 4px',
          fontSize: '9px'
        }
      }) : null;
    }));
  }

  setSelectedIssue(issueId) {
    this.selectedIssueId = String(issueId || '');
    this.layerControllers.issues.setSelected(this.selectedIssueId);
    this.layerControllers.pendingIssues.setSelected(this.selectedIssueId);
    if (this._issueData) this.setIssues(this._issueData);
    const selected = (this._issueData || []).find((item) => String(item.id) === this.selectedIssueId);
    const point = featurePoint(selected);
    if (point) this.setCenter(point, Math.max(16, Number(this.map.getZoom?.()) || 16));
  }

  createPointMarker(kind, item, callback) {
    const point = featurePoint(item);
    if (!point) return null;
    const properties = featureProperties(item);
    const label = properties.name || properties.title || item.id || kind;
    const isPhoto = kind === 'photo' || kind === 'photo-manual';
    const marker = new this.AMap.Marker({
      position: point,
      title: String(label).slice(0, 120),
      content: genericMarkerHtml(kind, item, label),
      offset: typeof this.AMap.Pixel === 'function' ? new this.AMap.Pixel(-12, -12) : undefined,
      extData: { id: String(item.id), kind },
      draggable: isPhoto
    });
    marker.on?.('click', () => {
      this.openInfoWindow(item, marker, isPhoto ? 'photo' : kind);
      callback(String(item.id), item);
    });
    if (isPhoto) {
      marker.on?.('dragend', (event) => {
        const coordinates = lngLatPair(event?.lnglat || marker.getPosition?.());
        if (coordinates) this.onPhotoGeometryDraft(String(item.id), coordinates, item);
      });
    }
    return marker;
  }

  openInfoWindow(item, marker, kind) {
    if (!this.infoWindow) return;
    const properties = featureProperties(item);
    const coordinates = featurePoint(item);
    const title = properties.title || properties.name || item.id || kind;
    const rows = [
      ['类型', properties.categoryName || properties.category || kind],
      ['状态', properties.status || properties.reviewStatus || properties.bindingStatus || 'active'],
      ['风险', properties.severity || '—'],
      ...(properties.outsideBoundary ? [['边界校验', '位于当前项目边界外']] : []),
      ...(kind === 'issue' ? [
        ['小区', properties.communityName || '未记录'],
        ['楼栋', properties.buildingName || '未记录'],
        ['来源', properties.source || '未记录'],
        ['证据摘要', properties.evidence || '未记录']
      ] : []),
      ...(kind === 'photo' ? [
        ['拍摄', properties.capturedAt || '未记录'],
        ['小区', properties.communityName || '未记录'],
        ['楼栋', properties.buildingName || '未记录'],
        ['来源', properties.coordinateSource || '未记录']
      ] : []),
      ...(kind === 'poi' || kind === 'poi-excluded' ? [
        ['地址', properties.address || item.address || '未记录'],
        ['距离', Number.isFinite(Number(properties.distanceMeters ?? item.distanceMeters))
          ? `${Number(properties.distanceMeters ?? item.distanceMeters).toFixed(1)} 米`
          : '未记录'],
        ['数据提供方', properties.provider || item.provider || '未记录'],
        ['查询时间', properties.queriedAt || item.queriedAt || '未记录'],
        ['复核', properties.reviewStatus || item.reviewStatus || '待复核']
      ] : []),
      ['坐标', coordinates ? `${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}` : '未记录'],
      ['修订', item.revision || properties.revision || '—']
    ];
    this.infoWindow.setContent?.(
      `<section class="business-map-info"><strong>${escapeHtml(title)}</strong>${kind === 'photo'
        ? `<img src="/api/photos/${encodeURIComponent(item.id)}/content" alt="${escapeHtml(title)}">`
        : ''}${rows
        .map(([label, value]) => `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`)
        .join('')}</section>`
    );
    this.infoWindow.open?.(this.map, marker.getPosition?.() || coordinates);
  }

  setPhotos(photos) {
    const items = (photos || [])
      .filter((item) => normalizeCrs(item?.crs || 'GCJ02') === 'GCJ02');
    const manual = items.filter((item) => {
      const source = String(featureProperties(item).coordinateSource || '').toLowerCase();
      return source.includes('manual') || source.includes('batch');
    });
    const original = items.filter((item) => !manual.includes(item));
    this.replaceLayer('photos', original
      .map((photo) =>
      this.createPointMarker('photo', photo, this.onPhotoSelected)
    ));
    this.replaceLayer('manualPhotos', manual.map((photo) =>
      this.createPointMarker('photo-manual', photo, this.onPhotoSelected)
    ));
  }

  setPoi(items) {
    this.replaceLayer('poi', (items || [])
      .filter((item) => normalizeCrs(item?.crs || 'GCJ02') === 'GCJ02')
      .map((poi) =>
      this.createPointMarker('poi', poi, this.onPoiSelected)
    ));
  }

  setExcludedPoi(items) {
    this.replaceLayer('excludedPoi', (items || [])
      .filter((item) => normalizeCrs(item?.crs || 'GCJ02') === 'GCJ02')
      .map((poi) =>
      this.createPointMarker('poi-excluded', poi, this.onPoiSelected)
    ));
  }

  setStops(stops) {
    this.replaceLayer('stops', (stops || [])
      .filter((item) => normalizeCrs(item?.crs || 'GCJ02') === 'GCJ02')
      .map((stop) =>
      this.createPointMarker('stop', stop, this.onRouteSelected)
    ));
  }

  setRoutes(routes) {
    const overlays = (routes || [])
      .filter((item) => normalizeCrs(item?.crs || 'GCJ02') === 'GCJ02')
      .flatMap((route) => {
      const segments = route?.geometry?.type === 'LineString'
        ? [route.geometry.coordinates]
        : route?.geometry?.type === 'MultiLineString'
          ? route.geometry.coordinates
          : [];
      const coordinates = segments
        .map((line) => line.map(validPoint).filter(Boolean))
        .filter((line) => line.length >= 2);
      if (!coordinates.length || typeof this.AMap.Polyline !== 'function') return [];
      const output = coordinates.map((path, segmentIndex) => {
        const line = new this.AMap.Polyline({
          path,
          strokeColor: route.properties?.outsideBoundary ? '#ef4444' : '#a78bfa',
          strokeWeight: 4,
          strokeOpacity: 0.9,
          showDir: true,
          extData: { id: String(route.id), kind: 'survey-route', segmentIndex }
        });
        line.on?.('click', () => this.onRouteSelected(String(route.id), route));
        return line;
      });
      if (typeof this.AMap.Marker === 'function') {
        for (const [kind, point, label] of [
          ['route-start', coordinates[0][0], '路线起点'],
          ['route-end', coordinates.at(-1).at(-1), '路线终点']
        ]) {
          const marker = new this.AMap.Marker({
            position: point,
            title: label,
            content: genericMarkerHtml(kind, route, `${route.properties?.name || route.id} ${label}`),
            offset: typeof this.AMap.Pixel === 'function' ? new this.AMap.Pixel(-9, -9) : undefined,
            extData: { id: String(route.id), kind }
          });
          marker.on?.('click', () => this.onRouteSelected(String(route.id), route));
          output.push(marker);
        }
        for (const anomaly of route.properties?.anomalies || []) {
          const point = validPoint(anomaly.coordinates);
          if (!point) continue;
          output.push(new this.AMap.Marker({
            position: point,
            title: `路线异常点：${anomaly.reason}`,
            content: genericMarkerHtml(
              'route-anomaly',
              { id: `${route.id}-${anomaly.index}` },
              `路线异常点 ${anomaly.reason}`
            ),
            offset: typeof this.AMap.Pixel === 'function' ? new this.AMap.Pixel(-8, -8) : undefined,
            extData: { id: String(route.id), kind: 'route-anomaly', reason: anomaly.reason }
          }));
        }
      }
      return output;
    });
    this.replaceLayer('routes', overlays);
  }

  setAnalysisRange(value) {
    const center = validPoint(value?.center || value?.parameters?.center);
    const radius = Number(value?.radiusMeters || value?.parameters?.radiusMeters);
    if (!center || !Number.isFinite(radius) || radius <= 0 || typeof this.AMap.Circle !== 'function') {
      this.replaceLayer('analysisRange', []);
      return;
    }
    const overlays = [new this.AMap.Circle({
      center,
      radius,
      strokeColor: '#f59e0b',
      strokeWeight: 2,
      strokeOpacity: 0.95,
      fillColor: '#f59e0b',
      fillOpacity: 0.14,
      extData: { kind: 'analysis-range' }
    })];
    if (typeof this.AMap.Text === 'function') {
      overlays.push(new this.AMap.Text({
        position: center,
        text: `${Math.round(radius)} 米分析范围`,
        anchor: 'bottom-center',
        offset: typeof this.AMap.Pixel === 'function' ? new this.AMap.Pixel(0, -8) : undefined,
        style: {
          color: '#fcd34d',
          background: 'rgba(17,24,39,.86)',
          border: '1px solid #f59e0b',
          padding: '2px 6px',
          borderRadius: '4px'
        },
        extData: { kind: 'analysis-range-label' }
      }));
    }
    this.replaceLayer('analysisRange', overlays);
  }

  setDistanceLines(lines) {
    if (typeof this.AMap.Polyline !== 'function') {
      this.replaceLayer('distanceLines', []);
      return;
    }
    const overlays = (lines || []).flatMap((line) => {
      const start = validPoint(line.start || line.from);
      const end = validPoint(line.end || line.to);
      if (!start || !end) return [];
      const output = [new this.AMap.Polyline({
        path: [start, end],
        strokeColor: '#fcd34d',
        strokeWeight: 2,
        strokeOpacity: 0.75,
        strokeStyle: 'dashed',
        extData: { id: String(line.id || ''), kind: 'distance-line' }
      })];
      const distanceMeters = Number(line.distanceMeters);
      if (Number.isFinite(distanceMeters) && typeof this.AMap.Text === 'function') {
        output.push(new this.AMap.Text({
          position: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
          text: `${distanceMeters.toFixed(1)} 米`,
          anchor: 'bottom-center',
          style: {
            color: '#fef3c7',
            background: 'rgba(17,24,39,.82)',
            border: '0',
            padding: '1px 4px'
          },
          extData: { id: String(line.id || ''), kind: 'distance-label' }
        }));
      }
      return output;
    });
    this.replaceLayer('distanceLines', overlays);
  }

  setMapView(view) {
    this.mapView = view || null;
    this.setBoundary(view?.boundary?.geometry || []);
    this.setBoundaryLabel(view?.boundary);
    this.setBoundaryHistory(mapViewCollection(view, 'boundaryHistory'));
    this.setIssues(mapViewCollection(view, 'issues'));
    this.setPhotos(mapViewCollection(view, 'photos'));
    this.setRoutes(mapViewCollection(view, 'routes'));
    this.setStops(mapViewCollection(view, 'stops'));
    const selectedRun = mapViewCollection(view, 'spatialAnalyses')[0];
    this.setAnalysisRange(selectedRun);
    const distances = selectedRun?.result?.distances || [];
    const center = validPoint(selectedRun?.parameters?.center);
    this.setDistanceLines(center ? distances.map((item) => ({
      id: item.issueId,
      start: center,
      end: item.coordinates,
      distanceMeters: item.distanceMeters
    })) : []);
    const poiItems = selectedRun?.result?.accepted || selectedRun?.result?.items || [];
    const poi = poiItems.filter((item) => item.reviewStatus !== 'excluded');
    const excludedPoi = poiItems.filter((item) => item.reviewStatus === 'excluded');
    this.setPoi(poi.map((item) => ({
      ...item,
      geometry: item.geometry || {
        type: 'Point',
        coordinates: item.coordinates
      }
    })));
    this.setExcludedPoi(excludedPoi.map((item) => ({
      ...item,
      geometry: item.geometry || {
        type: 'Point',
        coordinates: item.coordinates
      }
    })));
  }

  setCenter(point, zoom = 16) {
    const target = validPoint(point);
    if (!target) return;
    this.map.setZoomAndCenter(zoom, target);
  }

  fitVisible() {
    const overlays = Object.entries(this.layers)
      .filter(([name]) => this.visibility[name] !== false)
      .flatMap(([, items]) => items);
    if (overlays.length && typeof this.map.setFitView === 'function') {
      this.map.setFitView(overlays, false, [45, 45, 45, 45], 18);
    }
  }

  startDistanceMeasure() {
    if (typeof this.AMap.MouseTool !== 'function') return false;
    if (!this.mouseTool) this.mouseTool = new this.AMap.MouseTool(this.map);
    this.mouseTool.close?.(false);
    if (typeof this.mouseTool.rule !== 'function') return false;
    this.mouseTool.rule({
      startMarkerOptions: { icon: undefined },
      endMarkerOptions: { icon: undefined },
      lineOptions: {
        strokeColor: '#fcd34d',
        strokeWeight: 3,
        strokeStyle: 'dashed'
      }
    });
    return true;
  }

  startAreaMeasure() {
    if (typeof this.AMap.MouseTool !== 'function') return false;
    if (!this.mouseTool) this.mouseTool = new this.AMap.MouseTool(this.map);
    this.mouseTool.close?.(false);
    if (typeof this.mouseTool.measureArea !== 'function') return false;
    this.mouseTool.measureArea({
      strokeColor: '#22d3ee',
      strokeWeight: 3,
      fillColor: '#14b8a6',
      fillOpacity: 0.16
    });
    return true;
  }

  clearMeasurements() {
    this.mouseTool?.close?.(true);
    return Boolean(this.mouseTool);
  }

  startBoundaryDraw() {
    this.closeBoundaryEditor();
    if (!this.mouseTool) this.mouseTool = new this.AMap.MouseTool(this.map);
    this.mouseTool.close(true);
    if (this.drawHandler) this.mouseTool.off('draw', this.drawHandler);
    this.mouseTool.polygon({
      strokeColor: '#b45309',
      strokeWeight: 3,
      fillColor: '#f59e0b',
      fillOpacity: 0.14
    });
    this.drawHandler = (event) => {
      const path = event?.obj?.getPath?.() || [];
      const points = path.map(lngLatPair).filter(Boolean);
      this.mouseTool.close(true);
      if (points.length >= 3) {
        this.setBoundary(points);
        this.resetBoundaryEditHistory(points);
        this.onBoundaryChanged(points);
      }
    };
    this.mouseTool.on('draw', this.drawHandler);
  }

  clearBoundaryDraft() {
    if (this.mouseTool) this.mouseTool.close(true);
    this.closeBoundaryEditor();
    this.setBoundary([]);
  }

  boundaryOuterPath() {
    const polygon = this.layers.boundary?.[0];
    const rawPath = polygon?.getPath?.() || [];
    const outer = Array.isArray(rawPath?.[0]) && !lngLatPair(rawPath[0])
      ? rawPath[0]
      : rawPath;
    return outer.map(lngLatPair).filter(Boolean);
  }

  resetBoundaryEditHistory(points) {
    const path = (Array.isArray(points) ? points : []).map(validPoint).filter(Boolean);
    this.boundaryEditHistory = path.length ? [path] : [];
    this.boundaryEditIndex = path.length ? 0 : -1;
  }

  captureBoundaryEdit() {
    const points = this.boundaryOuterPath();
    if (points.length < 3) return;
    const previous = this.boundaryEditHistory[this.boundaryEditIndex] || [];
    if (JSON.stringify(previous) !== JSON.stringify(points)) {
      this.boundaryEditHistory = this.boundaryEditHistory.slice(0, this.boundaryEditIndex + 1);
      this.boundaryEditHistory.push(points);
      this.boundaryEditIndex = this.boundaryEditHistory.length - 1;
    }
    this.onBoundaryChanged(points);
  }

  startBoundaryEdit() {
    if (typeof this.AMap.PolyEditor !== 'function' || !this.layers.boundary?.length) return false;
    this.closeBoundaryEditor();
    const polygon = this.layers.boundary[0];
    const original = this.boundaryOuterPath();
    if (original.length < 3) return false;
    this.boundaryEditOriginal = original;
    this.resetBoundaryEditHistory(original);
    this.boundaryEditor = new this.AMap.PolyEditor(this.map, polygon);
    this.boundaryEditHandler = () => this.captureBoundaryEdit();
    for (const eventName of ['addnode', 'adjust', 'movenode', 'removenode', 'end']) {
      this.boundaryEditor.on?.(eventName, this.boundaryEditHandler);
    }
    this.boundaryEditor.open?.();
    return true;
  }

  applyBoundaryHistory(index) {
    const points = this.boundaryEditHistory[index];
    const polygon = this.layers.boundary?.[0];
    if (!points || !polygon?.setPath) return false;
    this.boundaryEditIndex = index;
    polygon.setPath(points);
    this.onBoundaryChanged(points);
    return true;
  }

  undoBoundaryEdit() {
    return this.boundaryEditIndex > 0
      ? this.applyBoundaryHistory(this.boundaryEditIndex - 1)
      : false;
  }

  redoBoundaryEdit() {
    return this.boundaryEditIndex >= 0
      && this.boundaryEditIndex < this.boundaryEditHistory.length - 1
      ? this.applyBoundaryHistory(this.boundaryEditIndex + 1)
      : false;
  }

  cancelBoundaryEdit() {
    const original = this.boundaryEditOriginal;
    this.closeBoundaryEditor();
    if (!original?.length) return false;
    this.setBoundary(original);
    this.onBoundaryChanged(original);
    return true;
  }

  finishBoundaryEdit() {
    if (!this.boundaryEditor) return false;
    this.captureBoundaryEdit();
    this.closeBoundaryEditor();
    return true;
  }

  closeBoundaryEditor() {
    if (!this.boundaryEditor) return;
    for (const eventName of ['addnode', 'adjust', 'movenode', 'removenode', 'end']) {
      this.boundaryEditor.off?.(eventName, this.boundaryEditHandler);
    }
    this.boundaryEditor.close?.();
    this.boundaryEditor = null;
    this.boundaryEditHandler = null;
  }

  resize() {
    this.map.resize();
  }

  destroy() {
    if (this.mouseTool) {
      if (this.drawHandler) this.mouseTool.off('draw', this.drawHandler);
      this.mouseTool.close(true);
    }
    this.closeBoundaryEditor();
    for (const layer of Object.values(this.layerControllers)) layer.destroy();
    this.infoWindow?.close?.();
    this.map.destroy();
    this.mapView = null;
    this._issueData = [];
    this.clusters = {};
    this.layerControllers = {};
    for (const name of Object.keys(this.layers)) this.layers[name] = [];
  }
}
