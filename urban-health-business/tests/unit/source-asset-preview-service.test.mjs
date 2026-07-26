import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv,
  previewSourceAsset
} from '../../server/services/source-asset-preview-service.mjs';

test('CSV preview handles quoted commas and reports truncation', () => {
  const preview = parseCsv('name,note\n一号楼,"临街,六层"\n二号楼,八层\n', 1);
  assert.deepEqual(preview.columns, ['name', 'note']);
  assert.equal(preview.rows[0].note, '临街,六层');
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.truncated, true);
});

test('GeoJSON preview reports structure without returning full coordinates', async () => {
  const asset = {
    id: 'ASSET-12345678',
    name: '图层.geojson',
    mimeType: 'application/geo+json',
    status: 'active',
    uploadStatus: 'completed',
    contentHash: 'abc',
    assetRevision: 1
  };
  const outcome = await previewSourceAsset({
    async get() { return asset; },
    async readContent() {
      return Buffer.from(JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: '范围', code: 'A' },
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]] }
        }]
      }));
    }
  }, asset.id);
  assert.equal(outcome.preview.featureCount, 1);
  assert.deepEqual(outcome.preview.geometryTypes, ['Polygon']);
  assert.deepEqual(outcome.preview.propertyKeys, ['name', 'code']);
  assert.equal(JSON.stringify(outcome).includes('coordinates'), false);
});
