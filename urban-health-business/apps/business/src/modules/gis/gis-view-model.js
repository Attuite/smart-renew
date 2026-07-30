const DEFAULT_LAYERS = Object.freeze({
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

export function serializeGisLayerSelection(visibleLayers = {}) {
  return Object.keys(DEFAULT_LAYERS)
    .filter((layer) => visibleLayers[layer] !== false)
    .join(',');
}

export function parseGisLayerSelection(value) {
  if (!String(value || '').trim()) return null;
  const selected = new Set(String(value).split(',').filter((layer) => layer in DEFAULT_LAYERS));
  return Object.fromEntries(Object.keys(DEFAULT_LAYERS).map((layer) => [layer, selected.has(layer)]));
}

export function createGisViewState(input = {}) {
  return {
    mapReady: false,
    mapStyle: input.mapStyle || 'dark',
    visibleLayers: { ...DEFAULT_LAYERS, ...(input.visibleLayers || {}) },
    filters: {
      issueRisk: 'all',
      issueType: 'all',
      issueStatus: 'active',
      bindingStatus: 'all',
      staleStatus: 'all',
      search: '',
      ...(input.filters || {})
    },
    selectedIssueId: input.selectedIssueId || '',
    selectedPhotoId: input.selectedPhotoId || '',
    selectedPoiId: input.selectedPoiId || '',
    selectedRouteId: input.selectedRouteId || '',
    selectedSpatialRunId: input.selectedSpatialRunId || '',
    mobilePane: input.mobilePane || 'list',
    geometryDraft: null,
    circleDraft: null,
    viewport: null,
    loadingByLayer: {},
    errorByLayer: {},
    truncatedByLayer: {}
  };
}

export function mapViewQueryFromState(state, options = {}) {
  const query = new URLSearchParams();
  const filters = state?.filters || {};
  if (filters.issueRisk && filters.issueRisk !== 'all') query.set('issueRisk', filters.issueRisk);
  if (filters.issueType && filters.issueType !== 'all') query.set('issueType', filters.issueType);
  if (filters.issueStatus && filters.issueStatus !== 'all') {
    query.set('issueStatus', filters.issueStatus);
  }
  if (filters.bindingStatus && filters.bindingStatus !== 'all') {
    query.set('bindingStatus', filters.bindingStatus);
  }
  if (filters.staleStatus && filters.staleStatus !== 'all') {
    query.set('staleStatus', filters.staleStatus);
  }
  if (String(filters.search || '').trim()) query.set('search', String(filters.search).trim());
  if (state?.selectedSpatialRunId) query.set('spatialRunId', state.selectedSpatialRunId);
  query.set('includePhotos', String(
    state?.visibleLayers?.photos !== false || state?.visibleLayers?.manualPhotos !== false
  ));
  query.set('includeRoutes', String(
    state?.visibleLayers?.routes !== false || state?.visibleLayers?.stops !== false
  ));
  if (Array.isArray(options.bounds) && options.bounds.length === 4) {
    query.set('bounds', options.bounds.join(','));
  }
  if (options.limit) query.set('limit', String(options.limit));
  return query;
}

export function gisUrlState(search, fallback = {}) {
  const query = search instanceof URLSearchParams ? search : new URLSearchParams(search || '');
  const visibleLayers = parseGisLayerSelection(query.get('layers'))
    || fallback.visibleLayers;
  return {
    selectedIssueId: query.get('issue') || fallback.selectedIssueId || '',
    selectedRouteId: query.get('route') || fallback.selectedRouteId || '',
    selectedSpatialRunId: query.get('run') || fallback.selectedSpatialRunId || '',
    mapStyle: query.get('mapStyle') || fallback.mapStyle || 'dark',
    ...(visibleLayers ? { visibleLayers } : {})
  };
}
