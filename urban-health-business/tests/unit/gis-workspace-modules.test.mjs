import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGisLayerVisibility,
  buildGisLayerLegend
} from '../../apps/business/src/modules/gis/gis-layer-control.js';
import { findSelectedOrFirst } from '../../apps/business/src/modules/gis/gis-selection.js';
import {
  renderMapSnapshotCards,
  shouldPollMapSnapshots
} from '../../apps/business/src/modules/gis/gis-snapshot-view.js';

test('GIS layer-control module calculates only visible real map objects', () => {
  const legend = buildGisLayerLegend({
    boundary: { id: 'B-1' },
    photos: { items: [
      { properties: { coordinateSource: 'legacy' } },
      { properties: { coordinateSource: 'manual' } }
    ] },
    routes: { items: [{ id: 'R-1' }] },
    spatialAnalyses: { items: [{ result: { items: [
      { reviewStatus: 'confirmed' },
      { reviewStatus: 'excluded' }
    ] } }] }
  }, [
    { properties: { bindingStatus: 'confirmed' } },
    { properties: { bindingStatus: 'pending' } }
  ], { routes: false });

  assert.equal(legend.items.some(([layer]) => layer === 'routes'), false);
  assert.equal(legend.items.find(([layer]) => layer === 'issues')[2], 1);
  assert.equal(legend.items.find(([layer]) => layer === 'pendingIssues')[2], 1);
  assert.equal(legend.items.find(([layer]) => layer === 'manualPhotos')[2], 1);
  assert.equal(legend.items.find(([layer]) => layer === 'excludedPoi')[2], 1);
});

test('GIS layer-control applies lifecycle visibility through the controller contract', () => {
  const calls = [];
  const count = applyGisLayerVisibility({
    setLayerVisibility(layer, visible) {
      calls.push([layer, visible]);
      return layer !== 'unknown';
    }
  }, { issues: true, photos: false, unknown: true });
  assert.equal(count, 2);
  assert.deepEqual(calls, [
    ['issues', true],
    ['photos', false],
    ['unknown', true]
  ]);
});

test('GIS selection and snapshot modules preserve explicit state without fake content', () => {
  const selection = findSelectedOrFirst([{ id: 'R-1' }, { id: 'R-2' }], 'R-2');
  assert.equal(selection.selected.id, 'R-2');
  assert.equal(findSelectedOrFirst([], 'missing').selected, null);
  assert.equal(shouldPollMapSnapshots([{ status: 'queued' }]), true);
  assert.equal(shouldPollMapSnapshots([{ status: 'generated' }]), false);
  const html = renderMapSnapshotCards([{
    id: 'SNAP-1',
    status: 'queued',
    purpose: '<正式报告>',
    mapStyle: 'dark'
  }], '真实项目');
  assert.match(html, /已入队/);
  assert.match(html, /等待后台生成/);
  assert.equal(html.includes('<正式报告>'), false);
  assert.equal(html.includes('<img'), false);
});
