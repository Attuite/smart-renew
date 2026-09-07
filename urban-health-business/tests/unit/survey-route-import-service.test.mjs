import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importSurveyRouteFromSourceAsset,
  parseSurveyRouteAsset
} from '../../server/services/survey-route-import-service.mjs';

test('GPX SourceAsset parser preserves coordinates and capture times', () => {
  const parsed = parseSurveyRouteAsset({
    name: 'field-track.gpx',
    mimeType: 'text/plain'
  }, Buffer.from(`<?xml version="1.0"?><gpx><trk><name>上午路线</name><trkseg>
    <trkpt lat="34.2700" lon="108.9500"><time>2026-07-30T01:00:00Z</time></trkpt>
    <trkpt lat="34.2710" lon="108.9510"><time>2026-07-30T01:01:00Z</time></trkpt>
  </trkseg></trk></gpx>`));
  assert.equal(parsed.sourceKind, 'gpx');
  assert.deepEqual(parsed.geometry.coordinates[1], [108.951, 34.271]);
  assert.equal(parsed.samples[0].capturedAt, '2026-07-30T01:00:00Z');
});

test('GeoJSON and CSV SourceAssets produce LineString samples', () => {
  const geojson = parseSurveyRouteAsset({
    name: 'route.geojson',
    mimeType: 'application/geo+json'
  }, Buffer.from(JSON.stringify({
    type: 'Feature',
    properties: { name: 'GeoJSON路线', coordinateTimes: ['t1', 't2'] },
    geometry: {
      type: 'LineString',
      coordinates: [[108.95, 34.27], [108.951, 34.271]]
    }
  })));
  assert.equal(geojson.suggestedName, 'GeoJSON路线');
  assert.equal(geojson.samples.length, 2);

  const csv = parseSurveyRouteAsset({
    name: 'route.csv',
    mimeType: 'text/csv'
  }, Buffer.from('经度,纬度,采集时间,精度\n108.95,34.27,2026-07-30T01:00:00Z,5\n108.951,34.271,2026-07-30T01:01:00Z,8'));
  assert.equal(csv.samples[1].accuracyMeters, 8);
});

test('SourceAsset route import requires an active completed asset and stores lineage', async () => {
  let stored;
  const item = await importSurveyRouteFromSourceAsset(
    { async getProject() { return { id: '1' }; } },
    {
      async get() {
        return {
          id: 'ASSET-fixed-real-001',
          projectId: '1',
          name: 'route.csv',
          mimeType: 'text/csv',
          status: 'active',
          uploadStatus: 'completed',
          contentHash: 'hash-real'
        };
      },
      async readContent() {
        return Buffer.from('lon,lat\n108.95,34.27\n108.951,34.271');
      }
    },
    { async put(value) { stored = value; return value; } },
    '1',
    {
      sourceAssetId: 'ASSET-fixed-real-001',
      createdBy: 'GIS人员',
      crs: 'WGS84'
    },
    { id: 'ROUTE-fixed-real-001', now: '2026-07-30T03:00:00Z' }
  );
  assert.equal(item.source.assetId, 'ASSET-fixed-real-001');
  assert.equal(stored.source.contentHash, 'hash-real');
});
