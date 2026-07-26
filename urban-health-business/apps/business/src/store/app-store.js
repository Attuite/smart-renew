const initialState = {
  meta: null,
  gisConfig: null,
  projects: [],
  activeProjectId: '',
  activeProject: null,
  summary: null,
  workflow: null,
  selectedStageId: 'collection',
  communities: [],
  boundaryRevisions: [],
  collectionValidation: null,
  collectionValidationRuns: [],
  buildingsByCommunity: {},
  photos: [],
  sourceAssets: [],
  uploadSessions: [],
  analyses: [],
  analysisJobs: [],
  analysisJobCandidates: [],
  analysisLoading: false,
  analysisSubmitting: false,
  reviewLoading: false,
  reviewSessions: [],
  issues: [],
  spatialAnalyses: [],
  gisLoading: false,
  indicatorMeta: null,
  reports: [],
  reportComparison: null,
  reportLoading: false,
  collectionLoading: false,
  loading: false,
  error: null
};

export function createStore() {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    get() {
      return state;
    },

    set(patch) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener(state);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
