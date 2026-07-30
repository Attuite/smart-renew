import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AmapMapController,
  boundaryPathsFrom,
  issueMarkerDescriptor
} from '../../apps/business/src/gis/amap-map-controller.js';

class Overlay {
  constructor(options) {
    this.options = options;
    this.handlers = {};
  }
  on(name, handler) {
    this.handlers[name] = handler;
  }
  getPosition() {
    return this.options.position;
  }
}

class FakeMap {
  constructor() {
    this.added = [];
    this.removed = [];
    this.handlers = {};
    this.zoom = 14;
  }
  add(value) {
    this.added.push(...(Array.isArray(value) ? value : [value]));
  }
  remove(value) {
    this.removed.push(...(Array.isArray(value) ? value : [value]));
  }
  addControl() {}
  on(name, handler) { this.handlers[name] = handler; }
  setMapStyle(value) { this.style = value; }
  setLayers(value) { this.baseLayers = value; }
  setFitView(value) { this.fit = value; }
  setZoomAndCenter(zoom, center) { this.zoom = zoom; this.center = center; }
  getZoom() { return this.zoom; }
  resize() {}
  destroy() { this.destroyed = true; }
}

function fakeAmap() {
  class MouseTool {
    close(clear) { this.clear = clear; }
    rule(options) { this.ruleOptions = options; }
    measureArea(options) { this.areaOptions = options; }
    off() {}
  }
  return {
    Map: FakeMap,
    Marker: Overlay,
    Text: Overlay,
    Polygon: Overlay,
    Polyline: Overlay,
    Circle: Overlay,
    MouseTool,
    Pixel: class Pixel {},
    Scale: class Scale {},
    ToolBar: class ToolBar {},
    TileLayer: {
      Satellite: class Satellite {},
      RoadNet: class RoadNet {}
    }
  };
}

test('AMap boundary paths preserve polygon holes and multiple polygons', () => {
  const paths = boundaryPathsFrom({
    type: 'MultiPolygon',
    coordinates: [
      [[
        [108.94, 34.26],
        [108.98, 34.26],
        [108.98, 34.30],
        [108.94, 34.30]
      ], [
        [108.95, 34.27],
        [108.96, 34.27],
        [108.96, 34.28]
      ]],
      [[
        [109.04, 34.26],
        [109.05, 34.26],
        [109.05, 34.27]
      ]]
    ]
  });
  assert.equal(paths.length, 2);
  assert.equal(paths[0].length, 2);
  assert.deepEqual(paths[0][0][0], paths[0][0].at(-1));
});

test('issue marker descriptor exposes risk, selected and escaped real content', () => {
  const descriptor = issueMarkerDescriptor({
    id: 'ISS-REAL-001',
    properties: {
      title: '<真实问题>',
      severity: 'high',
      bindingStatus: 'pending',
      stale: true
    }
  }, true);
  assert.match(descriptor.className, /risk-high/);
  assert.match(descriptor.className, /is-selected/);
  assert.match(descriptor.className, /is-stale/);
  assert.equal(descriptor.html.includes('<真实问题>'), false);
});

test('layered AMap controller renders and toggles real map-view layers', () => {
  const controller = new AmapMapController(fakeAmap(), {}, { mapStyle: 'dark' });
  controller.setMapView({
    boundary: {
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [108.94, 34.26],
          [108.98, 34.26],
          [108.98, 34.30],
          [108.94, 34.30],
          [108.94, 34.26]
        ]]
      }
    },
    boundaryHistory: {
      items: [{
        id: 'BNDREV-REAL-001',
        crs: 'GCJ02',
        revision: 1,
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [108.941, 34.261],
            [108.979, 34.261],
            [108.979, 34.299],
            [108.941, 34.261]
          ]]
        }
      }]
    },
    issues: {
      items: [{
        id: 'ISS-REAL-001',
        geometry: { type: 'Point', coordinates: [108.95, 34.27] },
        properties: { severity: 'high', title: '真实问题' }
      }, {
        id: 'ISS-PENDING-001',
        geometry: { type: 'Point', coordinates: [108.951, 34.271] },
        properties: {
          severity: 'medium',
          title: '待确认问题',
          bindingStatus: 'pending'
        }
      }]
    },
    photos: {
      items: [{
        id: 'PHOTO-REAL-001',
        geometry: { type: 'Point', coordinates: [108.951, 34.271] },
        properties: { name: '真实照片' }
      }, {
        id: 'PHOTO-MANUAL-001',
        geometry: { type: 'Point', coordinates: [108.952, 34.272] },
        properties: { name: '人工照片', coordinateSource: 'manual' }
      }]
    },
    routes: {
      items: [{
        id: 'ROUTE-REAL-001',
        crs: 'GCJ02',
        geometry: {
          type: 'LineString',
          coordinates: [[108.95, 34.27], [108.952, 34.272]]
        },
        properties: {
          name: '真实路线',
          anomalies: [{
            index: 1,
            reason: 'IMPLAUSIBLE_SPEED',
            coordinates: [108.951, 34.271]
          }]
        }
      }]
    },
    stops: { items: [] },
    spatialAnalyses: {
      items: [{
        parameters: { center: [108.95, 34.27], radiusMeters: 500 },
        result: {
          distances: [{
            issueId: 'ISS-REAL-001',
            coordinates: [108.951, 34.271],
            distanceMeters: 144.2
          }]
        }
      }]
    }
  });
  assert.equal(controller.layers.boundary.length, 1);
  assert.equal(controller.layers.boundaryLabel.length, 1);
  assert.equal(controller.layers.boundaryHistory.length, 1);
  assert.equal(controller.layers.issues.length, 1);
  assert.equal(controller.layers.pendingIssues.length, 1);
  assert.equal(controller.layers.issueLabels.length, 2);
  assert.equal(controller.layers.photos.length, 1);
  assert.equal(controller.layers.manualPhotos.length, 1);
  assert.equal(controller.layers.routes.length, 4);
  assert.equal(controller.layers.analysisRange.length, 2);
  assert.equal(controller.layers.distanceLines.length, 2);
  assert.equal(controller.startDistanceMeasure(), true);
  assert.ok(controller.mouseTool.ruleOptions);
  assert.equal(controller.startAreaMeasure(), true);
  assert.ok(controller.mouseTool.areaOptions);
  assert.equal(controller.clearMeasurements(), true);
  assert.equal(controller.mouseTool.clear, true);
  controller.setLayerVisibility('photos', true);
  assert.equal(controller.visibility.photos, true);
  controller.setSelectedIssue('ISS-REAL-001');
  assert.equal(controller.selectedIssueId, 'ISS-REAL-001');
  controller.setMapStyle('satellite-road');
  assert.equal(controller.map.baseLayers.length, 2);
  controller.destroy();
  assert.equal(controller.map.destroyed, true);
});
