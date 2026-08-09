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
  residentialDiscoveryRuns: [],
  boundaryRevisions: [],
  collectionValidation: null,
  collectionValidationRuns: [],
  buildingsByCommunity: {},
  photos: [],
  sourceAssets: [],
  fieldTasks: [],
  fieldProblemTypes: [],
  fieldTaskErrors: [],
  uploadSessions: [],
  analyses: [],
  analysisJobs: [],
  aiConfig: null,
  analysisJobCandidates: [],
  analysisLoading: false,
  analysisSubmitting: false,
  reviewLoading: false,
  reviewSessions: [],
  issues: [],
  standardProblemTypes: [],
  mapView: null,
  spatialAnalyses: [],
  surveyRoutes: [],
  surveyStops: [],
  photoRouteBindings: [],
  mapSnapshots: [],
  gisLoading: false,
  indicatorMeta: null,
  standardLibrary: null,
  standardIndicators: [],
  standardRemediations: [],
  reports: [],
  outcomeSummary: null,
  outcomeProjects: [],
  outcomeIssues: [],
  outcomeReports: [],
  settingsMeta: null,
  settingsProviders: null,
  settingsExternalServices: null,
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
