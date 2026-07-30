const AMAP_GEOCODE_URL = 'https://restapi.amap.com/v3/geocode/geo';
const AMAP_PLACE_AROUND_URL = 'https://restapi.amap.com/v3/place/around';

function providerError(message, status = 502, code = 'AMAP_PROVIDER_FAILED', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  error.retryable = Boolean(details.retryable);
  return error;
}

function amapFailure(payload) {
  const upstreamCode = clean(payload?.infocode, 40);
  const upstreamInfo = clean(payload?.info, 200);
  const quota = ['10003', '10004', '10021', '10044'].includes(upstreamCode);
  const credential = ['10001', '10002', '10007', '10008', '10009', '10010'].includes(upstreamCode);
  const retryable = quota || ['10016', '10017', '10019', '10020'].includes(upstreamCode);
  return providerError(
    `高德Web服务调用失败：${upstreamInfo || '未知错误'}`,
    quota ? 429 : credential ? 503 : 502,
    quota ? 'AMAP_QUOTA_EXCEEDED'
      : credential ? 'AMAP_CREDENTIAL_ERROR'
        : 'AMAP_API_ERROR',
    {
      upstreamCode,
      upstreamInfo,
      retryable
    }
  );
}

function clean(value, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength);
}

function finitePoint(value) {
  const point = Array.isArray(value)
    ? value.map(Number)
    : String(value || '').split(',').map(Number);
  if (
    point.length < 2
    || !Number.isFinite(point[0])
    || !Number.isFinite(point[1])
    || point[0] < -180
    || point[0] > 180
    || point[1] < -90
    || point[1] > 90
  ) return null;
  return point.slice(0, 2);
}

export function amapRuntimeConfig(env = process.env) {
  const jsKey = clean(env.AMAP_JS_KEY, 200);
  const jsSecurityCode = clean(env.AMAP_JS_SECURITY_CODE, 300);
  const webServiceKey = clean(env.AMAP_WEB_SERVICE_KEY, 300);
  return {
    provider: 'amap',
    coordinateSystem: 'GCJ-02',
    browser: {
      ready: Boolean(jsKey && jsSecurityCode),
      reason: jsKey && jsSecurityCode ? null : 'amap_browser_credentials_not_configured',
      key: jsKey || null,
      securityCode: jsSecurityCode || null,
      version: '2.0',
      plugins: [
        'AMap.Scale',
        'AMap.ToolBar',
        'AMap.MouseTool',
        'AMap.MarkerCluster',
        'AMap.PolyEditor'
      ]
    },
    geocoding: {
      ready: Boolean(webServiceKey),
      reason: webServiceKey ? null : 'amap_web_service_key_not_configured'
    },
    poi: {
      ready: Boolean(webServiceKey),
      reason: webServiceKey ? null : 'amap_web_service_key_not_configured'
    },
    webServiceKey
  };
}

export function publicAmapConfig(env = process.env) {
  const config = amapRuntimeConfig(env);
  const requestedStyle = clean(env.GIS_DEFAULT_MAP_STYLE, 40);
  const defaultMapStyle = ['light', 'dark', 'satellite-road'].includes(requestedStyle)
    ? requestedStyle
    : 'dark';
  return {
    provider: config.provider,
    coordinateSystem: config.coordinateSystem,
    browser: config.browser,
    geocoding: config.geocoding,
    poi: config.poi,
    policy: {
      defaultMapStyle,
      coordinateProvider: clean(env.GIS_COORDINATE_PROVIDER, 80)
        || 'gcj02-standard-formula',
      maxViewFeatures: Math.max(
        100,
        Math.min(5000, Number(env.GIS_MAX_VIEW_FEATURES) || 5000)
      ),
      maxRoutePoints: Math.max(
        1000,
        Math.min(100000, Number(env.GIS_MAX_ROUTE_POINTS) || 100000)
      ),
      mapSnapshotProvider: clean(env.GIS_MAP_SNAPSHOT_PROVIDER, 80) || 'svg',
      mapSnapshotStoragePrefix: clean(env.GIS_MAP_SNAPSHOT_STORAGE_PREFIX, 200)
        || 'map-snapshots/'
    }
  };
}

export function amapCapabilitySnapshot(env = process.env) {
  const config = amapRuntimeConfig(env);
  return {
    ready: true,
    reason: null,
    provider: config.browser.ready ? 'amap' : 'manual-coordinate',
    coordinateSystem: config.coordinateSystem,
    mapReady: config.browser.ready,
    mapReason: config.browser.reason,
    geocodingReady: config.geocoding.ready,
    geocodingReason: config.geocoding.reason,
    poiReady: config.poi.ready,
    poiReason: config.poi.reason
  };
}

export class AmapWebServiceProvider {
  constructor(options = {}) {
    const config = amapRuntimeConfig(options.env);
    this.key = clean(options.key || config.webServiceKey, 300);
    this.fetch = options.fetch || globalThis.fetch;
    this.timeoutMs = Number(options.timeoutMs) || 12000;
  }

  assertReady() {
    if (!this.key) {
      throw providerError(
        '高德Web服务Key尚未配置。',
        503,
        'AMAP_WEB_SERVICE_NOT_CONFIGURED'
      );
    }
    if (typeof this.fetch !== 'function') {
      throw providerError('当前运行时不支持高德Web服务请求。', 500, 'FETCH_NOT_AVAILABLE');
    }
  }

  async request(endpoint, parameters) {
    this.assertReady();
    const query = new URLSearchParams({
      key: this.key,
      output: 'JSON',
      ...Object.fromEntries(
        Object.entries(parameters).filter(([, value]) => value !== undefined && value !== null && value !== '')
      )
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetch(`${endpoint}?${query}`, {
        headers: { accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) {
        throw providerError(
          `高德Web服务返回HTTP ${response.status}。`,
          502,
          'AMAP_HTTP_ERROR',
          { upstreamStatus: response.status }
        );
      }
      const payload = await response.json();
      if (String(payload?.status) !== '1') {
        throw amapFailure(payload);
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw providerError('高德Web服务响应超时。', 504, 'AMAP_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async geocode(input = {}) {
    const address = clean(input.address, 300);
    if (!address) {
      throw providerError('请输入需要定位的真实地址。', 400, 'GEOCODE_ADDRESS_REQUIRED');
    }
    const payload = await this.request(AMAP_GEOCODE_URL, {
      address,
      city: clean(input.city, 100)
    });
    const items = (Array.isArray(payload.geocodes) ? payload.geocodes : [])
      .map((item) => {
        const coordinates = finitePoint(item?.location);
        return coordinates ? {
          formattedAddress: clean(item.formatted_address, 300),
          province: clean(item.province, 100),
          city: clean(item.city, 100),
          district: clean(item.district, 100),
          township: clean(item.township, 100),
          adcode: clean(item.adcode, 20),
          coordinates,
          crs: 'GCJ02'
        } : null;
      })
      .filter(Boolean);
    return {
      provider: 'amap',
      coordinateSystem: 'GCJ-02',
      count: items.length,
      items
    };
  }

  async searchAround(input = {}) {
    const center = finitePoint(input.center);
    if (!center) {
      throw providerError('POI检索中心坐标无效。', 400, 'POI_CENTER_INVALID');
    }
    const radius = Math.round(Number(input.radiusMeters));
    if (!Number.isFinite(radius) || radius < 50 || radius > 10000) {
      throw providerError('POI检索半径必须在50到10000米之间。', 400, 'POI_RADIUS_INVALID');
    }
    const page = Math.max(1, Math.min(100, Math.round(Number(input.page) || 1)));
    const pageSize = Math.max(1, Math.min(50, Math.round(Number(input.pageSize) || 50)));
    const payload = await this.request(AMAP_PLACE_AROUND_URL, {
      location: `${center[0]},${center[1]}`,
      keywords: clean(input.keywords, 200),
      types: clean(input.types, 200),
      radius,
      sortrule: 'distance',
      offset: pageSize,
      page,
      extensions: 'all'
    });
    return {
      provider: 'amap',
      coordinateSystem: 'GCJ-02',
      count: Number(payload.count) || 0,
      page,
      pageSize,
      items: Array.isArray(payload.pois) ? payload.pois : []
    };
  }
}

export { finitePoint };
