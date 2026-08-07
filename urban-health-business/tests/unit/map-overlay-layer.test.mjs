import test from 'node:test';
import assert from 'node:assert/strict';
import { MapOverlayLayer } from '../../apps/business/src/gis/map-overlay-layer.js';

test('map overlay layer owns data, visibility, selection, clear and destroy lifecycle', () => {
  const map = {
    added: [],
    removed: [],
    add(items) { this.added.push(...items); },
    remove(items) { this.removed.push(...items); }
  };
  const overlays = [{ id: 'A' }, { id: 'B' }];
  const layer = new MapOverlayLayer({ name: 'issues', map, visible: true });

  assert.equal(layer.setData(overlays), true);
  assert.deepEqual(layer.overlays, overlays);
  assert.equal(map.added.length, 2);
  assert.equal(layer.setSelected('A'), true);
  assert.equal(layer.selectedId, 'A');

  layer.setVisible(false);
  layer.setVisible(false);
  assert.equal(map.removed.length, 2);
  layer.setVisible(true);
  layer.setVisible(true);
  assert.equal(map.added.length, 4);

  layer.clear();
  assert.equal(layer.overlays.length, 0);
  assert.equal(map.removed.length, 4);
  layer.destroy();
  assert.equal(layer.destroyed, true);
  assert.equal(layer.setData(overlays), false);
});

test('map overlay layer switches clustered data without leaking the previous cluster', () => {
  const map = {};
  const clusterMaps = [];
  const clusters = [];
  const createCluster = (initialMap, overlays) => {
    const cluster = {
      overlays,
      setMap(value) { clusterMaps.push(value); }
    };
    clusters.push({ initialMap, cluster });
    return cluster;
  };
  const layer = new MapOverlayLayer({
    name: 'photos',
    map,
    clusterThreshold: 2,
    createCluster
  });

  layer.setData([{ id: 1 }, { id: 2 }]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].initialMap, map);
  layer.setData([{ id: 3 }, { id: 4 }]);
  assert.equal(clusterMaps[0], null);
  assert.equal(clusters.length, 2);
  layer.destroy();
  assert.equal(clusterMaps.at(-1), null);
});
