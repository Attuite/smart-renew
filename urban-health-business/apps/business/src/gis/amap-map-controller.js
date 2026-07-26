let sdkPromise = null;

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
    this.boundaryPolygon = null;
    this.issueMarkers = [];
    this.mouseTool = null;
    this.map = new AMap.Map(container, {
      resizeEnable: true,
      mapStyle: 'amap://styles/light',
      zoom: 14
    });
    this.map.addControl(new AMap.Scale());
    this.map.addControl(new AMap.ToolBar({ position: { top: '10px', right: '10px' } }));
    this.map.on('click', (event) => {
      const point = lngLatPair(event?.lnglat);
      if (point) this.onPointSelected(point);
    });
    this.setBoundary(options.boundary || []);
    this.setIssues(options.issues || []);
  }

  setBoundary(boundary) {
    const points = (Array.isArray(boundary) ? boundary : []).map(validPoint).filter(Boolean);
    if (this.boundaryPolygon) {
      this.map.remove(this.boundaryPolygon);
      this.boundaryPolygon = null;
    }
    if (points.length < 3) return;
    this.boundaryPolygon = new this.AMap.Polygon({
      path: points,
      strokeColor: '#0f766e',
      strokeWeight: 3,
      fillColor: '#14b8a6',
      fillOpacity: 0.12
    });
    this.map.add(this.boundaryPolygon);
    this.map.setFitView([this.boundaryPolygon], false, [45, 45, 45, 45], 16);
  }

  setIssues(issues) {
    if (this.issueMarkers.length) this.map.remove(this.issueMarkers);
    this.issueMarkers = (Array.isArray(issues) ? issues : [])
      .map((issue) => {
        const point = validPoint(issue?.geometry?.coordinates);
        if (!point) return null;
        return new this.AMap.Marker({
          position: point,
          title: String(issue.title || issue.id || '问题点').slice(0, 80)
        });
      })
      .filter(Boolean);
    if (this.issueMarkers.length) this.map.add(this.issueMarkers);
  }

  setCenter(point, zoom = 16) {
    const target = validPoint(point);
    if (!target) return;
    this.map.setZoomAndCenter(zoom, target);
  }

  startBoundaryDraw() {
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
        this.onBoundaryChanged(points);
      }
    };
    this.mouseTool.on('draw', this.drawHandler);
  }

  clearBoundaryDraft() {
    if (this.mouseTool) this.mouseTool.close(true);
    this.setBoundary([]);
  }

  resize() {
    this.map.resize();
  }

  destroy() {
    if (this.mouseTool) {
      if (this.drawHandler) this.mouseTool.off('draw', this.drawHandler);
      this.mouseTool.close(true);
    }
    this.map.destroy();
    this.boundaryPolygon = null;
    this.issueMarkers = [];
  }
}
