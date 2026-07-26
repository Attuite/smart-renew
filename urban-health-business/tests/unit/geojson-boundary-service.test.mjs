import test from 'node:test';
import assert from 'node:assert/strict';
import {
  importBoundaryFromSourceAsset,
  parseGeoJsonBoundary
} from '../../server/services/geojson-boundary-service.mjs';

const polygon = [
  [108.94, 34.26],
  [108.96, 34.26],
  [108.96, 34.28],
  [108.94, 34.28],
  [108.94, 34.26]
];

test('GeoJSON FeatureCollection imports one unambiguous polygon', () => {
  const coordinates = parseGeoJsonBoundary(JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: '项目范围' },
      geometry: { type: 'Polygon', coordinates: [polygon] }
    }]
  }));
  assert.deepEqual(coordinates, polygon);
});

test('multiple GeoJSON polygons are rejected instead of selecting one silently', () => {
  assert.throws(
    () => parseGeoJsonBoundary(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [polygon] } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [polygon] } }
      ]
    })),
    (error) => error.code === 'GEOJSON_BOUNDARY_AMBIGUOUS'
  );
});

test('active GeoJSON asset updates boundary with source lineage', async () => {
  let savedProject = null;
  const asset = {
    id: 'ASSET-12345678',
    projectId: '1',
    category: 'gis',
    mimeType: 'application/geo+json',
    status: 'active',
    uploadStatus: 'completed',
    contentHash: 'abc123'
  };
  const repository = {
    async get() { return asset; },
    async readContent() {
      return Buffer.from(JSON.stringify({ type: 'Polygon', coordinates: [polygon] }));
    }
  };
  const client = {
    async getProject() { return { id: '1', revision: 3 }; },
    async putProject(project) {
      savedProject = project;
      return project;
    }
  };
  const project = await importBoundaryFromSourceAsset(client, repository, '1', {
    sourceAssetId: asset.id,
    updatedBy: 'GIS资料员',
    expectedRevision: 3
  });
  assert.equal(project.scopeBoundarySource, 'source-asset-geojson');
  assert.equal(project.scopeBoundarySourceAssetId, asset.id);
  assert.equal(project.scopeBoundarySourceAssetContentHash, 'abc123');
  assert.equal(savedProject.revision, 4);
});

test('inactive GeoJSON asset cannot update project boundary', async () => {
  const repository = {
    async get() {
      return {
        id: 'ASSET-12345678',
        projectId: '1',
        category: 'gis',
        mimeType: 'application/geo+json',
        status: 'inactive',
        uploadStatus: 'completed'
      };
    }
  };
  await assert.rejects(
    importBoundaryFromSourceAsset({}, repository, '1', {
      sourceAssetId: 'ASSET-12345678',
      updatedBy: 'GIS资料员'
    }),
    (error) => error.code === 'SOURCE_ASSET_NOT_ACTIVE'
  );
});
