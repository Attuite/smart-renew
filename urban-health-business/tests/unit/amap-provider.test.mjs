import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AmapWebServiceProvider,
  amapCapabilitySnapshot,
  publicAmapConfig
} from '../../server/services/amap-provider.mjs';

test('amap runtime capability reports missing configuration without inventing readiness', () => {
  const capability = amapCapabilitySnapshot({});
  const publicConfig = publicAmapConfig({});
  assert.equal(capability.mapReady, false);
  assert.equal(capability.poiReady, false);
  assert.equal(publicConfig.coordinateSystem, 'GCJ-02');
  assert.equal('webServiceKey' in publicConfig, false);
});

test('amap public config only exposes browser credentials intended for the JS SDK', () => {
  const config = publicAmapConfig({
    AMAP_JS_KEY: 'browser-key',
    AMAP_JS_SECURITY_CODE: 'browser-security-code',
    AMAP_WEB_SERVICE_KEY: 'server-only-key'
  });
  assert.equal(config.browser.ready, true);
  assert.equal(config.browser.key, 'browser-key');
  assert.equal(config.browser.securityCode, 'browser-security-code');
  assert.equal(JSON.stringify(config).includes('server-only-key'), false);
});

test('amap provider normalizes geocoding and POI responses as GCJ-02', async () => {
  const requested = [];
  const provider = new AmapWebServiceProvider({
    key: 'server-key',
    async fetch(url) {
      requested.push(new URL(url));
      const isGeocode = String(url).includes('/geocode/');
      return {
        ok: true,
        async json() {
          return isGeocode
            ? {
                status: '1',
                geocodes: [{
                  formatted_address: '陕西省西安市测试路1号',
                  location: '108.9500,34.2700',
                  adcode: '610100'
                }]
              }
            : {
                status: '1',
                count: '1',
                pois: [{
                  id: 'POI-1',
                  name: '测试花园',
                  location: '108.9510,34.2700',
                  distance: '92'
                }]
              };
        }
      };
    }
  });

  const geocode = await provider.geocode({ address: '测试路1号', city: '西安' });
  const pois = await provider.searchAround({
    center: [108.95, 34.27],
    radiusMeters: 1000,
    keywords: '小区'
  });

  assert.deepEqual(geocode.items[0].coordinates, [108.95, 34.27]);
  assert.equal(geocode.items[0].crs, 'GCJ02');
  assert.equal(pois.coordinateSystem, 'GCJ-02');
  assert.equal(pois.items[0].id, 'POI-1');
  assert.equal(requested[0].searchParams.get('key'), 'server-key');
  assert.equal(requested[1].searchParams.get('location'), '108.95,34.27');
});

test('amap provider refuses requests when the server-side key is missing', async () => {
  const provider = new AmapWebServiceProvider({ env: {}, fetch: async () => null });
  await assert.rejects(
    () => provider.geocode({ address: '测试地址' }),
    (error) => error.code === 'AMAP_WEB_SERVICE_NOT_CONFIGURED' && error.status === 503
  );
});

test('amap provider distinguishes quota errors without exposing credentials', async () => {
  const provider = new AmapWebServiceProvider({
    key: 'server-secret-key',
    fetch: async () => ({
      ok: true,
      async json() {
        return { status: '0', info: 'DAILY_QUERY_OVER_LIMIT', infocode: '10003' };
      }
    })
  });
  await assert.rejects(
    () => provider.searchAround({
      center: [108.95, 34.27],
      radiusMeters: 1000,
      keywords: '社区服务'
    }),
    (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.code, 'AMAP_QUOTA_EXCEEDED');
      assert.equal(error.retryable, true);
      assert.equal(JSON.stringify(error).includes('server-secret-key'), false);
      return true;
    }
  );
});
