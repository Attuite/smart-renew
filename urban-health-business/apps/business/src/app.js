import { api } from './api/client.js';
import { AmapMapController } from './gis/amap-map-controller.js';
import {
  createGisViewState,
  gisUrlState,
  mapViewQueryFromState,
  serializeGisLayerSelection
} from './modules/gis/gis-view-model.js';
import { filterOfficialIssues } from './modules/gis/gis-filters.js';
import {
  applyGisLayerVisibility,
  buildGisLayerLegend
} from './modules/gis/gis-layer-control.js';
import { findSelectedOrFirst } from './modules/gis/gis-selection.js';
import {
  renderMapSnapshotCards,
  shouldPollMapSnapshots
} from './modules/gis/gis-snapshot-view.js';
import {
  hasPointGeometry,
  haversineMeters,
  parseIssueGeometryBatch,
  pointInsideSimplePolygon
} from './modules/gis/gis-geometry.js';
import {
  bboxPercentStyle,
  createAnnotatedImageFile,
  normalizeBbox
} from './review/annotation.js';
import { createStore } from './store/app-store.js';
import { stageCatalog, statusLabels } from './workflow/stages.js';

const store = createStore();
function loadGisDisplayPreference() {
  try {
    const value = JSON.parse(
      localStorage.getItem('urban-health-business:gis-display-preference') || 'null'
    );
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
const pendingUploadFiles = new Map();
let pendingSourceAssetRequestId = crypto.randomUUID();
let analysisPollTimer = null;
let mapSnapshotPollTimer = null;
let reviewRiskFilter = 'all';
let boundaryMapController = null;
let boundaryMapProjectSignature = '';
let boundaryMapInitializing = false;
let gisMapController = null;
let gisMapProjectSignature = '';
let gisMapInitializing = false;
let gisViewportTimer = null;
let gisViewportRequest = 0;
let gisFilterTimer = null;
let gisViewState = createGisViewState(
  gisUrlState(location.search, loadGisDisplayPreference())
);
const elements = {
  projectSelect: document.querySelector('#projectSelect'),
  serviceStrip: document.querySelector('#serviceStrip'),
  stageRail: document.querySelector('#stageRail'),
  stageGrid: document.querySelector('#stageGrid'),
  projectTitle: document.querySelector('#projectTitle'),
  projectDescription: document.querySelector('#projectDescription'),
  workflowSummary: document.querySelector('#workflowSummary'),
  workflowTimestamp: document.querySelector('#workflowTimestamp'),
  metricGrid: document.querySelector('#metricGrid'),
  errorBanner: document.querySelector('#errorBanner'),
  errorMessage: document.querySelector('#errorMessage'),
  dismissErrorButton: document.querySelector('#dismissErrorButton'),
  refreshButton: document.querySelector('#refreshButton'),
  outcomeCenterButton: document.querySelector('#outcomeCenterButton'),
  settingsButton: document.querySelector('#settingsButton'),
  createProjectButton: document.querySelector('#createProjectButton'),
  projectDialog: document.querySelector('#projectDialog'),
  projectForm: document.querySelector('#projectForm'),
  projectNameInput: document.querySelector('#projectNameInput'),
  projectFormError: document.querySelector('#projectFormError'),
  closeProjectDialogButton: document.querySelector('#closeProjectDialogButton'),
  cancelProjectButton: document.querySelector('#cancelProjectButton'),
  submitProjectButton: document.querySelector('#submitProjectButton'),
  loadingLayer: document.querySelector('#loadingLayer'),
  detailKicker: document.querySelector('#detailKicker'),
  detailTitle: document.querySelector('#detailTitle'),
  detailDescription: document.querySelector('#detailDescription'),
  detailStatus: document.querySelector('#detailStatus'),
  detailInputs: document.querySelector('#detailInputs'),
  detailOutputs: document.querySelector('#detailOutputs'),
  detailMessages: document.querySelector('#detailMessages'),
  stageActionButton: document.querySelector('#stageActionButton'),
  stageActionHint: document.querySelector('#stageActionHint'),
  overviewView: document.querySelector('#overviewView'),
  outcomeWorkspace: document.querySelector('#outcomeWorkspace'),
  backFromOutcomeButton: document.querySelector('#backFromOutcomeButton'),
  outcomeStatStrip: document.querySelector('#outcomeStatStrip'),
  outcomeProjectList: document.querySelector('#outcomeProjectList'),
  outcomeRecordList: document.querySelector('#outcomeRecordList'),
  settingsWorkspace: document.querySelector('#settingsWorkspace'),
  backFromSettingsButton: document.querySelector('#backFromSettingsButton'),
  settingsProviderPanel: document.querySelector('#settingsProviderPanel'),
  settingsExternalPanel: document.querySelector('#settingsExternalPanel'),
  settingsMetaPanel: document.querySelector('#settingsMetaPanel'),
  collectionWorkspace: document.querySelector('#collectionWorkspace'),
  backToOverviewButton: document.querySelector('#backToOverviewButton'),
  projectExportLink: document.querySelector('#projectExportLink'),
  communityCount: document.querySelector('#communityCount'),
  photoCount: document.querySelector('#photoCount'),
  sourceAssetCount: document.querySelector('#sourceAssetCount'),
  boundaryStatus: document.querySelector('#boundaryStatus'),
  collectionValidationScore: document.querySelector('#collectionValidationScore'),
  collectionValidationChecks: document.querySelector('#collectionValidationChecks'),
  collectionValidationForm: document.querySelector('#collectionValidationForm'),
  runCollectionValidationButton: document.querySelector('#runCollectionValidationButton'),
  collectionValidationFormError: document.querySelector('#collectionValidationFormError'),
  collectionValidationHistory: document.querySelector('#collectionValidationHistory'),
  projectMetadataForm: document.querySelector('#projectMetadataForm'),
  saveProjectMetadataButton: document.querySelector('#saveProjectMetadataButton'),
  projectMetadataFormError: document.querySelector('#projectMetadataFormError'),
  boundaryForm: document.querySelector('#boundaryForm'),
  boundaryCoordinatesInput: document.querySelector('#boundaryCoordinatesInput'),
  boundarySummary: document.querySelector('#boundarySummary'),
  boundaryRevisionList: document.querySelector('#boundaryRevisionList'),
  boundaryFormError: document.querySelector('#boundaryFormError'),
  saveBoundaryButton: document.querySelector('#saveBoundaryButton'),
  boundaryGeocodeForm: document.querySelector('#boundaryGeocodeForm'),
  locateBoundaryAddressButton: document.querySelector('#locateBoundaryAddressButton'),
  drawBoundaryButton: document.querySelector('#drawBoundaryButton'),
  editBoundaryButton: document.querySelector('#editBoundaryButton'),
  undoBoundaryButton: document.querySelector('#undoBoundaryButton'),
  redoBoundaryButton: document.querySelector('#redoBoundaryButton'),
  finishBoundaryEditButton: document.querySelector('#finishBoundaryEditButton'),
  clearBoundaryDraftButton: document.querySelector('#clearBoundaryDraftButton'),
  boundaryMapStatus: document.querySelector('#boundaryMapStatus'),
  boundaryMapCanvas: document.querySelector('#boundaryMapCanvas'),
  boundaryMapError: document.querySelector('#boundaryMapError'),
  residentialDiscoveryForm: document.querySelector('#residentialDiscoveryForm'),
  runResidentialDiscoveryButton: document.querySelector('#runResidentialDiscoveryButton'),
  residentialDiscoveryRuns: document.querySelector('#residentialDiscoveryRuns'),
  residentialConfirmForm: document.querySelector('#residentialConfirmForm'),
  confirmResidentialCandidatesButton: document.querySelector('#confirmResidentialCandidatesButton'),
  residentialDiscoveryFormError: document.querySelector('#residentialDiscoveryFormError'),
  communityList: document.querySelector('#communityList'),
  communityGovernanceBy: document.querySelector('#communityGovernanceBy'),
  mergeCommunitiesButton: document.querySelector('#mergeCommunitiesButton'),
  communityForm: document.querySelector('#communityForm'),
  saveCommunityButton: document.querySelector('#saveCommunityButton'),
  cancelCommunityEditButton: document.querySelector('#cancelCommunityEditButton'),
  buildingCommunitySelect: document.querySelector('#buildingCommunitySelect'),
  buildingList: document.querySelector('#buildingList'),
  buildingForm: document.querySelector('#buildingForm'),
  saveBuildingButton: document.querySelector('#saveBuildingButton'),
  cancelBuildingEditButton: document.querySelector('#cancelBuildingEditButton'),
  uploadCommunitySelect: document.querySelector('#uploadCommunitySelect'),
  uploadBuildingSelect: document.querySelector('#uploadBuildingSelect'),
  photoUploadForm: document.querySelector('#photoUploadForm'),
  photoFileInput: document.querySelector('#photoFileInput'),
  uploadSelection: document.querySelector('#uploadSelection'),
  uploadPhotosButton: document.querySelector('#uploadPhotosButton'),
  photoUploadError: document.querySelector('#photoUploadError'),
  uploadSessionList: document.querySelector('#uploadSessionList'),
  photoGrid: document.querySelector('#photoGrid'),
  photoMetadataForm: document.querySelector('#photoMetadataForm'),
  photoMetadataSelect: document.querySelector('#photoMetadataSelect'),
  photoMetadataCommunitySelect: document.querySelector('#photoMetadataCommunitySelect'),
  photoMetadataBuildingSelect: document.querySelector('#photoMetadataBuildingSelect'),
  savePhotoMetadataButton: document.querySelector('#savePhotoMetadataButton'),
  photoMetadataFormError: document.querySelector('#photoMetadataFormError'),
  photoBatchForm: document.querySelector('#photoBatchForm'),
  applyPhotoBatchButton: document.querySelector('#applyPhotoBatchButton'),
  photoBatchResult: document.querySelector('#photoBatchResult'),
  refreshCollectionButton: document.querySelector('#refreshCollectionButton'),
  sourceAssetForm: document.querySelector('#sourceAssetForm'),
  sourceAssetCommunitySelect: document.querySelector('#sourceAssetCommunitySelect'),
  sourceAssetFileInput: document.querySelector('#sourceAssetFileInput'),
  sourceAssetSelection: document.querySelector('#sourceAssetSelection'),
  uploadSourceAssetButton: document.querySelector('#uploadSourceAssetButton'),
  sourceAssetFormError: document.querySelector('#sourceAssetFormError'),
  sourceAssetGovernanceBy: document.querySelector('#sourceAssetGovernanceBy'),
  sourceAssetList: document.querySelector('#sourceAssetList'),
  sourceAssetPreview: document.querySelector('#sourceAssetPreview'),
  fieldTaskForm: document.querySelector('#fieldTaskForm'),
  fieldTaskCommunitySelect: document.querySelector('#fieldTaskCommunitySelect'),
  fieldTaskBuildingSelect: document.querySelector('#fieldTaskBuildingSelect'),
  fieldTaskProblemSelect: document.querySelector('#fieldTaskProblemSelect'),
  fieldTaskOperationBy: document.querySelector('#fieldTaskOperationBy'),
  createFieldTaskButton: document.querySelector('#createFieldTaskButton'),
  fieldTaskFormError: document.querySelector('#fieldTaskFormError'),
  fieldTaskList: document.querySelector('#fieldTaskList'),
  rebuildProjectDataButton: document.querySelector('#rebuildProjectDataButton'),
  exportProjectDataSqliteButton: document.querySelector('#exportProjectDataSqliteButton'),
  analysisWorkspace: document.querySelector('#analysisWorkspace'),
  backFromAnalysisButton: document.querySelector('#backFromAnalysisButton'),
  analyzablePhotoCount: document.querySelector('#analyzablePhotoCount'),
  analysisCount: document.querySelector('#analysisCount'),
  candidateCount: document.querySelector('#candidateCount'),
  aiCapabilityBanner: document.querySelector('#aiCapabilityBanner'),
  aiCapabilityTitle: document.querySelector('#aiCapabilityTitle'),
  aiCapabilityMessage: document.querySelector('#aiCapabilityMessage'),
  aiConfigForm: document.querySelector('#aiConfigForm'),
  aiConfigStatus: document.querySelector('#aiConfigStatus'),
  saveAiConfigButton: document.querySelector('#saveAiConfigButton'),
  checkAiConfigButton: document.querySelector('#checkAiConfigButton'),
  aiConfigFormError: document.querySelector('#aiConfigFormError'),
  analysisForm: document.querySelector('#analysisForm'),
  analysisPhotoPicker: document.querySelector('#analysisPhotoPicker'),
  startAnalysisButton: document.querySelector('#startAnalysisButton'),
  analysisFormError: document.querySelector('#analysisFormError'),
  analysisResultSummary: document.querySelector('#analysisResultSummary'),
  candidateList: document.querySelector('#candidateList'),
  analysisHistoryList: document.querySelector('#analysisHistoryList'),
  refreshAnalysisButton: document.querySelector('#refreshAnalysisButton'),
  reviewWorkspace: document.querySelector('#reviewWorkspace'),
  backFromReviewButton: document.querySelector('#backFromReviewButton'),
  pendingReviewCount: document.querySelector('#pendingReviewCount'),
  acceptedReviewCount: document.querySelector('#acceptedReviewCount'),
  excludedReviewCount: document.querySelector('#excludedReviewCount'),
  reviewForm: document.querySelector('#reviewForm'),
  reviewBatchTitle: document.querySelector('#reviewBatchTitle'),
  reviewRiskFilter: document.querySelector('#reviewRiskFilter'),
  reviewFilterSummary: document.querySelector('#reviewFilterSummary'),
  acceptVisibleCandidatesButton: document.querySelector('#acceptVisibleCandidatesButton'),
  reviewCandidateList: document.querySelector('#reviewCandidateList'),
  finalizeReviewButton: document.querySelector('#finalizeReviewButton'),
  reviewFormError: document.querySelector('#reviewFormError'),
  manualIssueForm: document.querySelector('#manualIssueForm'),
  manualIssuePhotoSelect: document.querySelector('#manualIssuePhotoSelect'),
  createManualIssueButton: document.querySelector('#createManualIssueButton'),
  manualIssueFormError: document.querySelector('#manualIssueFormError'),
  manualReviewSummary: document.querySelector('#manualReviewSummary'),
  manualReviewForm: document.querySelector('#manualReviewForm'),
  finalizeManualReviewButton: document.querySelector('#finalizeManualReviewButton'),
  manualReviewFormError: document.querySelector('#manualReviewFormError'),
  gisWorkspace: document.querySelector('#gisWorkspace'),
  backFromGisButton: document.querySelector('#backFromGisButton'),
  gisIssueCount: document.querySelector('#gisIssueCount'),
  locatedIssueCount: document.querySelector('#locatedIssueCount'),
  unlocatedIssueCount: document.querySelector('#unlocatedIssueCount'),
  gisIssueList: document.querySelector('#gisIssueList'),
  gisIssueSearch: document.querySelector('#gisIssueSearch'),
  gisRiskFilter: document.querySelector('#gisRiskFilter'),
  gisTypeFilter: document.querySelector('#gisTypeFilter'),
  gisStatusFilter: document.querySelector('#gisStatusFilter'),
  gisBindingFilter: document.querySelector('#gisBindingFilter'),
  gisStaleFilter: document.querySelector('#gisStaleFilter'),
  gisVisibleCount: document.querySelector('#gisVisibleCount'),
  gisLayout: document.querySelector('#gisLayout'),
  gisShowListButton: document.querySelector('#gisShowListButton'),
  gisShowMapButton: document.querySelector('#gisShowMapButton'),
  gisMapStyle: document.querySelector('#gisMapStyle'),
  gisPointTarget: document.querySelector('#gisPointTarget'),
  gisFitVisibleButton: document.querySelector('#gisFitVisibleButton'),
  gisFullscreenButton: document.querySelector('#gisFullscreenButton'),
  gisMeasureDistanceButton: document.querySelector('#gisMeasureDistanceButton'),
  gisMeasureAreaButton: document.querySelector('#gisMeasureAreaButton'),
  gisClearMeasureButton: document.querySelector('#gisClearMeasureButton'),
  gisTransformOperator: document.querySelector('#gisTransformOperator'),
  gisPrepareDisplayButton: document.querySelector('#gisPrepareDisplayButton'),
  gisLayerControl: document.querySelector('#gisLayerControl'),
  gisMapLegend: document.querySelector('#gisMapLegend'),
  geometryForm: document.querySelector('#geometryForm'),
  geometryIssueSelect: document.querySelector('#geometryIssueSelect'),
  geometryComparison: document.querySelector('#geometryComparison'),
  cancelGeometryDraftButton: document.querySelector('#cancelGeometryDraftButton'),
  saveGeometryButton: document.querySelector('#saveGeometryButton'),
  geometryFormError: document.querySelector('#geometryFormError'),
  geometryBatchForm: document.querySelector('#geometryBatchForm'),
  geometryBatchSubmitButton: document.querySelector('#geometryBatchSubmitButton'),
  geometryBatchFormError: document.querySelector('#geometryBatchFormError'),
  photoGeometryForm: document.querySelector('#photoGeometryForm'),
  photoGeometrySelect: document.querySelector('#photoGeometrySelect'),
  photoGeometryComparison: document.querySelector('#photoGeometryComparison'),
  cancelPhotoGeometryDraftButton: document.querySelector('#cancelPhotoGeometryDraftButton'),
  savePhotoGeometryButton: document.querySelector('#savePhotoGeometryButton'),
  photoGeometryFormError: document.querySelector('#photoGeometryFormError'),
  issueEditForm: document.querySelector('#issueEditForm'),
  issueEditSelect: document.querySelector('#issueEditSelect'),
  issueBindingStatusSelect: document.querySelector('#issueBindingStatusSelect'),
  issueProblemCodeSelect: document.querySelector('#issueProblemCodeSelect'),
  issueRemediationSelect: document.querySelector('#issueRemediationSelect'),
  updateIssueButton: document.querySelector('#updateIssueButton'),
  issueEditFormError: document.querySelector('#issueEditFormError'),
  spatialPreview: document.querySelector('#spatialPreview'),
  gisMapStatus: document.querySelector('#gisMapStatus'),
  gisMapCanvas: document.querySelector('#gisMapCanvas'),
  gisMapError: document.querySelector('#gisMapError'),
  geometryAuditList: document.querySelector('#geometryAuditList'),
  spatialAnalysisForm: document.querySelector('#spatialAnalysisForm'),
  runSpatialAnalysisButton: document.querySelector('#runSpatialAnalysisButton'),
  spatialAnalysisFormError: document.querySelector('#spatialAnalysisFormError'),
  spatialAnalysisHistory: document.querySelector('#spatialAnalysisHistory'),
  poiAnalysisForm: document.querySelector('#poiAnalysisForm'),
  poiCategorySelect: document.querySelector('#poiCategorySelect'),
  runPoiAnalysisButton: document.querySelector('#runPoiAnalysisButton'),
  poiAnalysisFormError: document.querySelector('#poiAnalysisFormError'),
  poiAnalysisHistory: document.querySelector('#poiAnalysisHistory'),
  surveyRouteCount: document.querySelector('#surveyRouteCount'),
  surveyRouteForm: document.querySelector('#surveyRouteForm'),
  surveyRouteAssetSelect: document.querySelector('#surveyRouteAssetSelect'),
  createSurveyRouteButton: document.querySelector('#createSurveyRouteButton'),
  surveyRouteFormError: document.querySelector('#surveyRouteFormError'),
  surveyRouteSelect: document.querySelector('#surveyRouteSelect'),
  surveyRouteOperator: document.querySelector('#surveyRouteOperator'),
  cleanSurveyRouteButton: document.querySelector('#cleanSurveyRouteButton'),
  detectSurveyStopsButton: document.querySelector('#detectSurveyStopsButton'),
  suggestPhotoBindingsButton: document.querySelector('#suggestPhotoBindingsButton'),
  confirmSurveyRouteButton: document.querySelector('#confirmSurveyRouteButton'),
  surveyRouteActionError: document.querySelector('#surveyRouteActionError'),
  surveyRouteDetail: document.querySelector('#surveyRouteDetail'),
  surveyStopList: document.querySelector('#surveyStopList'),
  photoRouteBindingList: document.querySelector('#photoRouteBindingList'),
  mapSnapshotForm: document.querySelector('#mapSnapshotForm'),
  mapSnapshotReportSelect: document.querySelector('#mapSnapshotReportSelect'),
  createMapSnapshotButton: document.querySelector('#createMapSnapshotButton'),
  mapSnapshotFormError: document.querySelector('#mapSnapshotFormError'),
  mapSnapshotList: document.querySelector('#mapSnapshotList'),
  indicatorWorkspace: document.querySelector('#indicatorWorkspace'),
  backFromIndicatorButton: document.querySelector('#backFromIndicatorButton'),
  indicatorIssueCount: document.querySelector('#indicatorIssueCount'),
  indicatorLocatedCount: document.querySelector('#indicatorLocatedCount'),
  indicatorContractStatus: document.querySelector('#indicatorContractStatus'),
  standardIndicatorCount: document.querySelector('#standardIndicatorCount'),
  standardRemediationCount: document.querySelector('#standardRemediationCount'),
  standardLibrarySummary: document.querySelector('#standardLibrarySummary'),
  standardIndicatorList: document.querySelector('#standardIndicatorList'),
  standardRemediationList: document.querySelector('#standardRemediationList'),
  reportWorkspace: document.querySelector('#reportWorkspace'),
  backFromReportButton: document.querySelector('#backFromReportButton'),
  reportVersionCount: document.querySelector('#reportVersionCount'),
  reportIssueCount: document.querySelector('#reportIssueCount'),
  reportForm: document.querySelector('#reportForm'),
  createReportButton: document.querySelector('#createReportButton'),
  reportFormError: document.querySelector('#reportFormError'),
  reportPreview: document.querySelector('#reportPreview'),
  reportHistoryList: document.querySelector('#reportHistoryList'),
  reportComparisonForm: document.querySelector('#reportComparisonForm'),
  baseReportSelect: document.querySelector('#baseReportSelect'),
  targetReportSelect: document.querySelector('#targetReportSelect'),
  compareReportsButton: document.querySelector('#compareReportsButton'),
  reportComparisonFormError: document.querySelector('#reportComparisonFormError'),
  reportComparisonResult: document.querySelector('#reportComparisonResult'),
  reportEditForm: document.querySelector('#reportEditForm'),
  updateReportButton: document.querySelector('#updateReportButton'),
  reportEditFormError: document.querySelector('#reportEditFormError'),
  reportJsonLink: document.querySelector('#reportJsonLink'),
  reportPrintLink: document.querySelector('#reportPrintLink')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setError(error) {
  store.set({ error: error ? { message: error.message, code: error.code || 'REQUEST_FAILED' } : null });
}

function stageFromState(state, stageId) {
  const live = state.workflow?.stages?.find((item) => item.id === stageId);
  const catalog = stageCatalog.find((item) => item.id === stageId);
  return live ? { ...catalog, ...live } : { ...catalog, status: 'not_started', progress: { percent: 0, completed: 0, total: 0 } };
}

function renderProjectSelect(state) {
  const previous = elements.projectSelect.value;
  elements.projectSelect.replaceChildren();
  if (!state.projects.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = state.error ? '项目加载失败' : '暂无真实项目';
    elements.projectSelect.append(option);
    elements.projectSelect.disabled = true;
    return;
  }

  elements.projectSelect.disabled = false;
  for (const project of state.projects) {
    const option = document.createElement('option');
    option.value = String(project.id);
    option.textContent = project.name || project.title || `项目 ${project.id}`;
    elements.projectSelect.append(option);
  }
  const selected = state.activeProjectId || previous || String(state.projects[0].id);
  elements.projectSelect.value = selected;
}

function serviceLabel(name) {
  return {
    database: '本地数据仓储',
    storage: '本地文件存储',
    ai: '视觉AI',
    gis: 'GIS',
    indicator: '指标引擎',
    report: '报告服务'
  }[name] || name;
}

function renderServices(state) {
  const services = state.meta?.services || {};
  elements.serviceStrip.innerHTML = Object.entries(services)
    .map(([name, service]) => {
      const ready = service?.ready === true;
      return `<span class="service-pill ${ready ? 'is-ready' : 'is-unavailable'}" title="${escapeHtml(service?.reason || 'ready')}"><i></i>${escapeHtml(serviceLabel(name))}</span>`;
    })
    .join('');
}

function renderStageRail(state) {
  elements.stageRail.innerHTML = stageCatalog.map((catalog) => {
    const stage = stageFromState(state, catalog.id);
    const selected = stage.id === state.selectedStageId;
    const status = statusLabels[stage.status] || stage.status;
    return `<button type="button" class="stage-rail-item status-${escapeHtml(stage.status)} ${selected ? 'is-current' : ''}" data-stage-id="${escapeHtml(stage.id)}">
      <b>${stage.number}</b>
      <span><strong>${escapeHtml(stage.title)}</strong><small>${escapeHtml(status)}</small></span>
      <i></i>
    </button>`;
  }).join('');
}

function renderStageGrid(state) {
  elements.stageGrid.innerHTML = stageCatalog.map((catalog) => {
    const stage = stageFromState(state, catalog.id);
    const percent = stage.progress?.percent;
    const status = statusLabels[stage.status] || stage.status;
    const width = typeof percent === 'number' ? `${percent}%` : '0%';
    return `<button type="button" class="stage-card status-${escapeHtml(stage.status)}" data-stage-id="${escapeHtml(stage.id)}">
      <header><span>${stage.number}</span><i>${escapeHtml(status)}</i></header>
      <strong>${escapeHtml(stage.title)}</strong>
      <p>${escapeHtml(stage.description)}</p>
      <footer>
        <div><i style="width:${width}"></i></div>
        <small>${typeof percent === 'number' ? `${percent}%` : '能力待接入'}</small>
      </footer>
    </button>`;
  }).join('');
}

function renderMetrics(state) {
  const counts = state.summary?.counts || {};
  const values = [
    [counts.photos, '现场照片', '真实入库'],
    [counts.analyses, 'AI分析', '运行记录'],
    [counts.officialIssues, '正式问题', '人工确认'],
    [counts.reports, '报告版本', '数据快照']
  ];
  elements.metricGrid.innerHTML = values.map(([value, label, note]) =>
    `<article><span>${label}</span><strong>${Number.isFinite(Number(value)) ? Number(value) : '—'}</strong><small>${note}</small></article>`
  ).join('');
}

function renderWorkflowSummary(state) {
  const overall = state.workflow?.overall;
  const values = [
    [overall?.completedCount, '已完成', '/ 6'],
    [overall?.blockedCount, '阻塞', '阶段'],
    [overall?.unavailableCount, '待接入', '模块']
  ];
  elements.workflowSummary.innerHTML = values.map(([value, label, suffix]) =>
    `<article><span>${label}</span><strong>${Number.isFinite(Number(value)) ? Number(value) : '—'}</strong><small>${suffix}</small></article>`
  ).join('');
  elements.workflowTimestamp.textContent = state.workflow?.computedAt
    ? `状态计算于 ${new Date(state.workflow.computedAt).toLocaleString()}`
    : '等待项目工作流';
}

function detailRows(items, emptyText) {
  if (!items?.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return items.map((item) => `<p><span>${escapeHtml(item.type || item.code || '数据')}</span><strong>${escapeHtml(item.count ?? item.message ?? '—')}</strong></p>`).join('');
}

function renderDetail(state) {
  const stage = stageFromState(state, state.selectedStageId);
  elements.detailKicker.textContent = `${stage.number} / ${stage.kicker}`;
  elements.detailTitle.textContent = stage.title;
  elements.detailDescription.textContent = stage.description;
  elements.detailStatus.textContent = statusLabels[stage.status] || stage.status;
  elements.detailStatus.dataset.status = stage.status;
  elements.detailInputs.innerHTML = detailRows(stage.inputs, '当前没有输入数据');
  elements.detailOutputs.innerHTML = detailRows(stage.outputs, '当前没有业务输出');

  const messages = [...(stage.blockers || []), ...(stage.warnings || [])];
  if (stage.status === 'unavailable' && stage.capability?.reason) {
    messages.unshift({ code: 'MODULE_UNAVAILABLE', message: `模块待接入：${stage.capability.reason}` });
  }
  elements.detailMessages.innerHTML = detailRows(messages, '暂无阻塞或警告');

  const primaryAction = stage.actions?.[0];
  elements.stageActionButton.disabled = !primaryAction?.enabled;
  elements.stageActionButton.textContent = primaryAction?.label || '进入阶段工作台';
  elements.stageActionButton.dataset.href = primaryAction?.href || '';
  elements.stageActionHint.textContent = stage.status === 'unavailable'
    ? '接口和数据模型已预留，等待外部能力接入'
    : '阶段详情来自真实后端工作流';
}

function renderProject(state) {
  const project = state.activeProject;
  elements.projectTitle.textContent = project?.name || project?.title || '请选择项目';
  elements.projectDescription.textContent = project
    ? project.description || project.desc || project.address || '当前项目已连接smart-renew真实数据。'
    : 'Business模式只读取真实项目和真实业务数据。';
}

function isCollectionWorkspace(state) {
  const query = new URLSearchParams(location.search);
  return state.selectedStageId === 'collection' && query.get('view') === 'workspace' && Boolean(state.activeProjectId);
}

function normalizedCrs(value) {
  return String(value || '').toUpperCase().replaceAll('-', '');
}

function setProviderStatus(element, message, status = '') {
  element.textContent = message;
  element.className = `provider-status${status ? ` status-${status}` : ''}`;
}

function resetMapControllers() {
  boundaryMapController?.destroy();
  gisMapController?.destroy();
  boundaryMapController = null;
  gisMapController = null;
  boundaryMapProjectSignature = '';
  gisMapProjectSignature = '';
  boundaryMapInitializing = false;
  gisMapInitializing = false;
  if (gisViewportTimer) clearTimeout(gisViewportTimer);
  gisViewportTimer = null;
  if (gisFilterTimer) clearTimeout(gisFilterTimer);
  gisFilterTimer = null;
  gisViewportRequest += 1;
}

function scheduleGisViewportLoad(bounds, zoom) {
  if (!Array.isArray(bounds) || bounds.length !== 4) return;
  gisViewState.viewport = { bounds, zoom };
  if (gisViewportTimer) clearTimeout(gisViewportTimer);
  const requestSequence = ++gisViewportRequest;
  const projectId = String(store.get().activeProjectId || '');
  gisViewportTimer = setTimeout(async () => {
    try {
      const query = mapViewQueryFromState(gisViewState, { bounds, limit: 2000 });
      query.set('zoom', String(zoom || ''));
      const mapView = await api.projectMapView(projectId, query);
      if (
        requestSequence !== gisViewportRequest
        || String(store.get().activeProjectId) !== projectId
      ) return;
      store.set({ mapView });
    } catch (error) {
      if (requestSequence === gisViewportRequest) {
        gisViewState.errorByLayer = { ...gisViewState.errorByLayer, viewport: error.message };
        setProviderStatus(
          elements.gisMapStatus,
          `视口数据加载失败：${error.message}`,
          'warning'
        );
      }
    }
  }, 350);
}

async function syncBoundaryMap(state) {
  if (!isCollectionWorkspace(state)) return;
  const config = state.gisConfig;
  const browserReady = Boolean(config?.browser?.ready);
  elements.boundaryMapCanvas.hidden = !browserReady;
  elements.drawBoundaryButton.disabled = !browserReady || state.collectionLoading;
  elements.editBoundaryButton.disabled = !browserReady
    || state.collectionLoading
    || normalizedCrs(state.activeProject?.scopeBoundaryCrs) !== 'GCJ02'
    || !state.activeProject?.scopeBoundary?.length;
  elements.undoBoundaryButton.disabled = !browserReady || state.collectionLoading;
  elements.redoBoundaryButton.disabled = !browserReady || state.collectionLoading;
  elements.finishBoundaryEditButton.disabled = !browserReady || state.collectionLoading;
  elements.clearBoundaryDraftButton.disabled = !browserReady || state.collectionLoading;
  elements.locateBoundaryAddressButton.disabled = !config?.geocoding?.ready || state.collectionLoading;
  if (!browserReady) {
    setProviderStatus(
      elements.boundaryMapStatus,
      '高德浏览器地图未配置；仍可通过经纬度或GeoJSON录入真实边界，不会生成默认边界。',
      'warning'
    );
    return;
  }

  const project = state.activeProject;
  const boundaryCrs = normalizedCrs(project?.scopeBoundaryCrs);
  const canOverlay = !project?.scopeBoundary?.length || boundaryCrs === 'GCJ02';
  const signature = `${state.activeProjectId}:${Number(project?.revision) || 0}:${boundaryCrs}`;
  if (boundaryMapController) {
    if (signature !== boundaryMapProjectSignature) {
      boundaryMapController.setBoundary(canOverlay ? project?.scopeBoundary : []);
      boundaryMapProjectSignature = signature;
    }
    boundaryMapController.resize();
    setProviderStatus(
      elements.boundaryMapStatus,
      canOverlay
        ? '高德地图已连接，绘制结果将以GCJ-02草稿回填，保存仍由Business后端校验。'
        : '当前边界为WGS84且尚无匹配的GCJ-02显示转换记录；暂不叠加到底图。',
      canOverlay ? 'ready' : 'warning'
    );
    return;
  }
  if (boundaryMapInitializing) return;
  boundaryMapInitializing = true;
  const expectedProjectId = String(state.activeProjectId);
  setProviderStatus(elements.boundaryMapStatus, '正在加载高德地图。');
  try {
    const controller = await AmapMapController.create(
      elements.boundaryMapCanvas,
      config.browser,
      {
        boundary: canOverlay ? project?.scopeBoundary : [],
        onBoundaryChanged(points) {
          elements.boundaryCoordinatesInput.value = points
            .map((point) => `${point[0]},${point[1]}`)
            .join('\n');
          elements.boundaryCoordinatesInput.dataset.revision = 'map-draft';
          elements.boundaryForm.elements.crs.value = 'GCJ02';
          setProviderStatus(
            elements.boundaryMapStatus,
            `已绘制 ${points.length} 个边界点并回填为GCJ-02草稿；请填写更新人员后保存。`,
            'ready'
          );
        }
      }
    );
    if (String(store.get().activeProjectId) !== expectedProjectId || !isCollectionWorkspace(store.get())) {
      controller.destroy();
      return;
    }
    boundaryMapController = controller;
    boundaryMapProjectSignature = signature;
    setProviderStatus(
      elements.boundaryMapStatus,
      canOverlay
        ? '高德地图已连接，绘制结果将以GCJ-02草稿回填，保存仍由Business后端校验。'
        : '当前边界为WGS84且尚无匹配的GCJ-02显示转换记录；暂不叠加到底图。',
      canOverlay ? 'ready' : 'warning'
    );
  } catch (error) {
    elements.boundaryMapCanvas.hidden = true;
    elements.boundaryMapError.textContent = error.message;
    elements.boundaryMapError.hidden = false;
    setProviderStatus(elements.boundaryMapStatus, '高德地图加载失败，未生成任何边界。', 'warning');
  } finally {
    boundaryMapInitializing = false;
  }
}

async function syncGisMap(state) {
  if (!isGisWorkspace(state)) return;
  const project = state.activeProject;
  const browserReady = Boolean(state.gisConfig?.browser?.ready);
  const mapView = state.mapView;
  const gcjProject = mapView
    ? Boolean(mapView.coordinateCompatibility?.onlineMapOverlayReady)
    : normalizedCrs(project?.scopeBoundaryCrs) === 'GCJ02';
  const hasBoundary = Boolean(mapView?.boundary)
    || (Array.isArray(project?.scopeBoundary) && project.scopeBoundary.length >= 3);
  const usable = browserReady && gcjProject && hasBoundary;
  elements.gisMapCanvas.hidden = !usable;
  if (!usable) {
    const message = !browserReady
      ? '高德浏览器地图未配置；下方继续显示真实经纬度矢量预览。'
      : !hasBoundary
        ? '项目尚无真实边界，地图不会创建默认范围。'
        : '项目边界尚无匹配的GCJ-02显示转换记录；暂不叠加到高德底图。';
    setProviderStatus(elements.gisMapStatus, message, 'warning');
    return;
  }
  const filteredIssues = filterGisIssues(state.issues);
  const filteredIssueIds = new Set(filteredIssues.map((issue) => String(issue.id)));
  const visibleMapView = mapView ? {
    ...mapView,
    issues: {
      ...mapView.issues,
      items: (mapView.issues?.items || []).filter((item) => filteredIssueIds.has(String(item.id)))
    }
  } : null;
  const signature = `${state.activeProjectId}:${Number(project.revision) || 0}:${state.issues
    .map((issue) => `${issue.id}:${Number(issue.geometryRevision) || 0}`)
    .join('|')}:${mapView?.photos?.total || 0}:${mapView?.routes?.total || 0}:${mapView?.spatialAnalyses?.items?.[0]?.id || ''}:${[
      gisViewState.filters.search,
      gisViewState.filters.issueRisk,
      gisViewState.filters.issueType,
      gisViewState.filters.issueStatus,
      gisViewState.filters.bindingStatus,
      gisViewState.filters.staleStatus
    ].join(':')}`;
  const viewportSignature = (mapView?.viewport?.requestedBounds || []).join(',');
  const completeSignature = `${signature}:${viewportSignature}`;
  if (gisMapController) {
    if (completeSignature !== gisMapProjectSignature) {
      if (visibleMapView) gisMapController.setMapView(visibleMapView);
      else {
        gisMapController.setBoundary(project.scopeBoundaryGeometry || project.scopeBoundary);
        gisMapController.setIssues(filteredIssues);
      }
      gisMapController.setSelectedIssue(gisViewState.selectedIssueId);
      for (const [layer, visible] of Object.entries(gisViewState.visibleLayers)) {
        gisMapController.setLayerVisibility(layer, visible);
      }
      gisMapProjectSignature = completeSignature;
    }
    gisMapController.resize();
    setProviderStatus(elements.gisMapStatus, '高德地图已连接；点击边界内位置可回填当前问题的GCJ-02坐标。', 'ready');
    return;
  }
  if (gisMapInitializing) return;
  gisMapInitializing = true;
  const expectedProjectId = String(state.activeProjectId);
  setProviderStatus(elements.gisMapStatus, '正在加载高德地图。');
  try {
    const controller = await AmapMapController.create(
      elements.gisMapCanvas,
      state.gisConfig.browser,
      {
        mapView: visibleMapView,
        boundary: project.scopeBoundaryGeometry || project.scopeBoundary,
        issues: state.issues,
        mapStyle: gisViewState.mapStyle,
        onIssueSelected(issueId) {
          const issue = store.get().issues.find((item) => String(item.id) === String(issueId));
          if (!issue) return;
          elements.geometryIssueSelect.value = issueId;
          elements.issueEditSelect.value = issueId;
          populateIssueEditForm(issue);
          renderGeometryAudit(issue);
          elements.geometryIssueSelect.dispatchEvent(new Event('change'));
        },
        onIssueGeometryDraft(issueId, point) {
          const issue = store.get().issues.find((item) => String(item.id) === String(issueId));
          if (!issue) return;
          elements.geometryIssueSelect.value = issueId;
          showIssueGeometryDraft(issue, point, 'GCJ02');
          setProviderStatus(
            elements.gisMapStatus,
            `已拖拽形成 ${point[0].toFixed(6)}, ${point[1].toFixed(6)} 草稿；服务端校验成功后才会保存。`,
            'ready'
          );
        },
        onPhotoSelected(photoId) {
          const photo = store.get().photos.find((item) => String(item.id) === String(photoId));
          if (!photo) return;
          gisViewState.selectedPhotoId = photoId;
          elements.photoGeometrySelect.value = photoId;
          populatePhotoGeometryForm(photo);
        },
        onPhotoGeometryDraft(photoId, point) {
          const photo = store.get().photos.find((item) => String(item.id) === String(photoId));
          if (!photo) return;
          gisViewState.selectedPhotoId = photoId;
          elements.photoGeometrySelect.value = photoId;
          populatePhotoGeometryForm(photo);
          showPhotoGeometryDraft(photo, point, 'GCJ02');
        },
        onPointSelected(point) {
          if (elements.gisPointTarget.value === 'photo') {
            if (!elements.photoGeometrySelect.value) return;
            elements.photoGeometryForm.elements.longitude.value = point[0];
            elements.photoGeometryForm.elements.latitude.value = point[1];
            elements.photoGeometryForm.elements.coordinateCrs.value = 'GCJ02';
            const photo = store.get().photos.find((item) =>
              String(item.id) === String(elements.photoGeometrySelect.value)
            );
            populatePhotoGeometryForm(photo);
            showPhotoGeometryDraft(photo, point, 'GCJ02');
            return;
          }
          if (!elements.geometryIssueSelect.value) return;
          const boundary = store.get().activeProject?.scopeBoundary || [];
          elements.geometryFormError.hidden = true;
          if (!pointInsideBoundary(point, boundary)) {
            elements.geometryFormError.textContent = '点击位置在项目边界之外，请点击边界面内部。';
            elements.geometryFormError.hidden = false;
            return;
          }
          const issue = store.get().issues.find((item) =>
            String(item.id) === String(elements.geometryIssueSelect.value)
          );
          showIssueGeometryDraft(issue, point, 'GCJ02');
          setProviderStatus(
            elements.gisMapStatus,
            `已回填 ${point[0].toFixed(6)}, ${point[1].toFixed(6)}；保存前请核对问题和确认人员。`,
            'ready'
          );
        },
        onViewportChanged(bounds, zoom) {
          scheduleGisViewportLoad(bounds, zoom);
        }
      }
    );
    if (String(store.get().activeProjectId) !== expectedProjectId || !isGisWorkspace(store.get())) {
      controller.destroy();
      return;
    }
    gisMapController = controller;
    gisMapController.setSelectedIssue(gisViewState.selectedIssueId);
    for (const [layer, visible] of Object.entries(gisViewState.visibleLayers)) {
      gisMapController.setLayerVisibility(layer, visible);
    }
    gisMapProjectSignature = completeSignature;
    setProviderStatus(elements.gisMapStatus, '高德地图已连接；点击边界内位置可回填当前问题的GCJ-02坐标。', 'ready');
  } catch (error) {
    elements.gisMapCanvas.hidden = true;
    elements.gisMapError.textContent = error.message;
    elements.gisMapError.hidden = false;
    setProviderStatus(elements.gisMapStatus, '高德地图加载失败；下方矢量预览仍可使用。', 'warning');
  } finally {
    gisMapInitializing = false;
  }
}

function renderCollection(state) {
  const visible = isCollectionWorkspace(state);
  elements.collectionWorkspace.hidden = !visible;
  if (!visible) return;

  const activeCommunities = state.communities.filter((community) => community.status !== 'inactive');
  elements.projectExportLink.href = `/api/projects/${encodeURIComponent(state.activeProjectId)}/export`;
  elements.communityCount.textContent = activeCommunities.length;
  elements.photoCount.textContent = state.photos.filter((photo) => photo.governanceStatus !== 'inactive').length;
  elements.sourceAssetCount.textContent = state.sourceAssets.filter((asset) => asset.status !== 'inactive' && asset.uploadStatus === 'completed').length;
  const boundary = state.activeProject?.scopeBoundary;
  const projectRevision = String(Number(state.activeProject?.revision) || 0);
  if (
    state.activeProject
    && elements.projectMetadataForm.dataset.projectRevision !== projectRevision
    && !elements.projectMetadataForm.contains(document.activeElement)
  ) {
    elements.projectMetadataForm.dataset.projectRevision = projectRevision;
    elements.projectMetadataForm.elements.name.value = state.activeProject.name || '';
    elements.projectMetadataForm.elements.area.value = state.activeProject.area || '';
    elements.projectMetadataForm.elements.type.value = state.activeProject.type || 'other';
    elements.projectMetadataForm.elements.scope.value = state.activeProject.scope || '';
    elements.projectMetadataForm.elements.description.value = state.activeProject.description || state.activeProject.desc || '';
  }
  elements.boundaryStatus.textContent = Array.isArray(boundary) && boundary.length >= 3 ? '已设置' : '未设置';
  const validation = state.collectionValidation;
  elements.collectionValidationScore.textContent = validation
    ? `${validation.completenessPercent}% · ${validation.status === 'complete' ? '必需项通过' : '尚未完整'}`
    : '等待校验';
  elements.collectionValidationScore.dataset.status = validation?.status || 'pending';
  elements.collectionValidationChecks.innerHTML = validation?.checks?.length
    ? validation.checks.map((item) => `<article class="validation-check status-${escapeHtml(item.status)}">
        <i>${item.status === 'passed' ? '✓' : item.required ? '!' : '·'}</i>
        <div><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.message)}</span></div>
        <small>${item.required ? '必需' : '建议'}</small>
      </article>`).join('')
    : '<p class="workspace-empty">正在读取真实资料校验结果。</p>';
  elements.collectionValidationHistory.innerHTML = state.collectionValidationRuns.length
    ? state.collectionValidationRuns.slice(0, 5).map((run) => `<article>
        <strong>${Number(run.completenessPercent) || 0}% · ${run.status === 'complete' ? '完整' : '不完整'}</strong>
        <span>${escapeHtml(run.validatedBy || '未记录人员')}</span>
        <small>${run.createdAt ? new Date(run.createdAt).toLocaleString() : '时间未记录'}</small>
      </article>`).join('')
    : '<p class="workspace-empty">尚无人工归档的完整度校验快照。</p>';
  elements.runCollectionValidationButton.disabled = state.collectionLoading;
  if (Array.isArray(boundary) && boundary.length >= 3) {
    elements.boundarySummary.innerHTML = `<strong>边界已保存</strong>
      <span>${boundary.length} 个点 · ${escapeHtml(state.activeProject.scopeBoundaryCrs || 'WGS84')} · ${Number(state.activeProject.scopeAreaSqKm || 0).toFixed(3)} km²</span>
      <small>修订 ${Number(state.activeProject.revision) || 0}${state.activeProject.boundaryUpdatedBy ? ` · ${escapeHtml(state.activeProject.boundaryUpdatedBy)}` : ''}${state.activeProject.scopeBoundarySourceAssetId ? ` · 来源 ${escapeHtml(state.activeProject.scopeBoundarySourceAssetId)}` : ''}</small>`;
    const boundaryRevision = String(state.activeProject.revision || 0);
    if (document.activeElement !== elements.boundaryCoordinatesInput
      && elements.boundaryCoordinatesInput.dataset.revision !== boundaryRevision) {
      elements.boundaryCoordinatesInput.value = boundary.map((point) => `${point[0]},${point[1]}`).join('\n');
      elements.boundaryCoordinatesInput.dataset.revision = boundaryRevision;
    }
  } else {
    elements.boundarySummary.innerHTML = '<strong>尚未设置项目边界</strong><span>可录入真实经纬度多边形；不会使用Demo固定项目范围。</span>';
  }
  elements.boundaryRevisionList.innerHTML = state.boundaryRevisions.length
    ? state.boundaryRevisions.map((revision) => `<article>
        <strong>项目修订 ${Number(revision.projectRevision) || 0}</strong>
        <span>${revision.coordinates?.length || 0}点 · ${Number(revision.areaSqKm || 0).toFixed(3)} km² · ${escapeHtml(revision.crs || 'WGS84')}</span>
        <small>${revision.createdAt ? new Date(revision.createdAt).toLocaleString() : '时间未记录'}${revision.updatedBy ? ` · ${escapeHtml(revision.updatedBy)}` : ''}</small>
        <button type="button" data-boundary-replay="${Number(revision.projectRevision) || 0}">只读回放</button>
      </article>`).join('')
    : '<p class="workspace-empty">尚无Business边界修订快照；首次保存后开始记录。</p>';
  void syncBoundaryMap(state);

  const discoveryRuns = state.residentialDiscoveryRuns || [];
  const latestDiscoveryRun = discoveryRuns[0] || null;
  if (latestDiscoveryRun) {
    elements.residentialConfirmForm.dataset.runId = latestDiscoveryRun.id;
    elements.residentialConfirmForm.dataset.runRevision = String(Number(latestDiscoveryRun.revision) || 1);
  } else {
    elements.residentialConfirmForm.dataset.runId = '';
    elements.residentialConfirmForm.dataset.runRevision = '';
  }
  elements.residentialDiscoveryRuns.innerHTML = latestDiscoveryRun
    ? `<article class="residential-discovery-run status-${escapeHtml(latestDiscoveryRun.status || 'completed')}">
        <header><div><strong>${latestDiscoveryRun.status === 'stale' ? '识别快照已过期' : '最新住宅识别快照'}</strong><span>${escapeHtml(latestDiscoveryRun.id)}</span></div><small>${latestDiscoveryRun.createdAt ? new Date(latestDiscoveryRun.createdAt).toLocaleString() : '时间未记录'} · ${escapeHtml(latestDiscoveryRun.createdBy || '人员未记录')}</small></header>
        <div class="residential-candidate-list">${latestDiscoveryRun.candidates?.length
          ? latestDiscoveryRun.candidates.map((candidate) => `<label class="residential-candidate status-${escapeHtml(candidate.decisionStatus || 'pending')}">
              <input type="checkbox" data-residential-candidate="${escapeHtml(candidate.normalizedId)}" ${candidate.decisionStatus === 'confirmed' || latestDiscoveryRun.status === 'stale' ? 'disabled' : ''}>
              <span><strong>${escapeHtml(candidate.name || '未命名住宅')}</strong><small>${escapeHtml(candidate.address || '地址未返回')} · ${Number(candidate.distanceMeters) || 0}m</small></span>
              <i>${candidate.decisionStatus === 'confirmed' ? `已入台账 ${escapeHtml(candidate.linkedCommunityId || '')}` : '待确认'}</i>
            </label>`).join('')
          : '<p class="workspace-empty">本次边界检索没有符合清洗规则的住宅候选。</p>'}</div>
      </article>
      ${discoveryRuns.length > 1 ? `<p class="residential-run-history">历史快照 ${discoveryRuns.length - 1} 次；边界变化后的旧快照只读保留。</p>` : ''}`
    : '<p class="workspace-empty">尚未执行住宅识别。请先保存 GCJ-02 项目边界并配置高德 Web Service Key。</p>';
  elements.confirmResidentialCandidatesButton.disabled = !latestDiscoveryRun
    || latestDiscoveryRun.status === 'stale'
    || !latestDiscoveryRun.candidates?.some((item) => item.decisionStatus !== 'confirmed');
  elements.runResidentialDiscoveryButton.disabled = state.collectionLoading;

  elements.communityList.innerHTML = state.communities.length
    ? state.communities.map((community) => `<article>
        <input class="community-governance-select" type="checkbox" data-community-governance-select="${escapeHtml(community.id)}" ${community.status === 'inactive' ? 'disabled' : ''} aria-label="选择 ${escapeHtml(community.name)}">
        <div><strong>${escapeHtml(community.name)}</strong><span>${escapeHtml(community.address || '未填写地址')}</span></div>
        <small>${Number(community.buildingDetailCount) || 0} 栋 · ${community.status === 'inactive' ? '已停用' : community.members?.length ? `已合并 ${community.members.length} 项` : community.source === 'amap-residential-discovery' ? '住宅识别确认' : '使用中'}</small>
        <span class="community-row-actions">
          <button type="button" data-edit-community="${escapeHtml(community.id)}">编辑</button>
          ${community.members?.length > 1 ? `<button type="button" data-split-community="${escapeHtml(community.id)}">拆分</button>` : ''}
          <button type="button" data-toggle-community="${escapeHtml(community.id)}" data-next-status="${community.status === 'inactive' ? 'active' : 'inactive'}">${community.status === 'inactive' ? '恢复' : '停用'}</button>
        </span>
      </article>`).join('')
    : '<p class="workspace-empty">尚无小区。照片上传要求关联真实小区，请先在下方建立空间层级。</p>';

  const previousBuildingCommunity = elements.buildingCommunitySelect.value;
  const previousUploadCommunity = elements.uploadCommunitySelect.value;
  elements.uploadCommunitySelect.replaceChildren();
  elements.buildingCommunitySelect.replaceChildren();
  if (!activeCommunities.length) {
    for (const select of [elements.uploadCommunitySelect, elements.buildingCommunitySelect]) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '请先新增小区';
      select.append(option);
      select.disabled = true;
    }
    elements.buildingForm.querySelector('button').disabled = true;
    elements.uploadPhotosButton.disabled = true;
  } else {
    elements.uploadCommunitySelect.disabled = false;
    elements.buildingCommunitySelect.disabled = false;
    elements.buildingForm.querySelector('button').disabled = state.collectionLoading;
    elements.uploadPhotosButton.disabled = state.collectionLoading;
    for (const community of activeCommunities) {
      for (const select of [elements.uploadCommunitySelect, elements.buildingCommunitySelect]) {
        const option = document.createElement('option');
        option.value = community.id;
        option.textContent = community.name;
        select.append(option);
      }
    }
    if (activeCommunities.some((item) => item.id === previousUploadCommunity)) {
      elements.uploadCommunitySelect.value = previousUploadCommunity;
    }
    if (activeCommunities.some((item) => item.id === previousBuildingCommunity)) {
      elements.buildingCommunitySelect.value = previousBuildingCommunity;
    }
  }

  const previousAssetCommunity = elements.sourceAssetCommunitySelect.value;
  elements.sourceAssetCommunitySelect.innerHTML = '<option value="">项目级资料</option>' + activeCommunities
    .map((community) => `<option value="${escapeHtml(community.id)}">${escapeHtml(community.name)}</option>`)
    .join('');
  if (activeCommunities.some((item) => String(item.id) === previousAssetCommunity)) {
    elements.sourceAssetCommunitySelect.value = previousAssetCommunity;
  }
  elements.sourceAssetList.innerHTML = state.sourceAssets.length
    ? state.sourceAssets.map((asset) => `<article>
        <div>
          <strong>${escapeHtml(asset.name || asset.id)}</strong>
          <span>${escapeHtml(asset.category || 'other')} · ${escapeHtml(asset.communityName || '项目级')} · ${formatFileSize(asset.size)}</span>
          <small>${asset.uploadStatus === 'completed' ? `SHA-256 ${escapeHtml(String(asset.contentHash || '').slice(0, 16))}…` : asset.uploadStatus === 'duplicate' ? `重复内容 · 已引用 ${escapeHtml(asset.duplicateOf || '现有资料')}` : asset.uploadStatus === 'failed' ? `上传失败：${escapeHtml(asset.error?.message || '请在上方重新选择同一文件后提交')}` : '等待文件内容'} · 修订 ${Number(asset.assetRevision) || 1}</small>
        </div>
        <i class="run-status status-${escapeHtml(asset.status || 'ready')}">${asset.uploadStatus === 'duplicate' ? '重复引用' : asset.status === 'inactive' ? '已停用' : asset.uploadStatus === 'completed' ? '使用中' : '待上传'}</i>
        <span class="source-asset-actions">
           ${asset.uploadStatus === 'completed' ? `<a class="secondary-button compact-button" href="/api/assets/${encodeURIComponent(asset.id)}/content" target="_blank" rel="noopener">下载</a>` : ''}
           ${asset.status === 'active' && asset.uploadStatus === 'completed' && ['text/csv', 'application/json', 'application/geo+json'].includes(asset.mimeType) ? `<button class="secondary-button compact-button" type="button" data-preview-source-asset="${escapeHtml(asset.id)}">结构预览</button>` : ''}
           ${asset.status === 'active' && asset.uploadStatus === 'completed' && ['application/vnd.sqlite3', 'application/x-sqlite3'].includes(asset.mimeType) ? `<button class="secondary-button compact-button" type="button" data-import-project-data="${escapeHtml(asset.id)}">导入ProjectData</button>` : ''}
           ${asset.status === 'active' && asset.uploadStatus === 'completed' && asset.category === 'gis' && ['application/json', 'application/geo+json'].includes(asset.mimeType) ? `<button class="secondary-button compact-button" type="button" data-import-boundary="${escapeHtml(asset.id)}">导入为边界</button>` : ''}
          ${asset.uploadStatus === 'completed' ? `<button class="secondary-button compact-button" type="button" data-toggle-source-asset="${escapeHtml(asset.id)}" data-next-status="${asset.status === 'inactive' ? 'active' : 'inactive'}">${asset.status === 'inactive' ? '恢复' : '停用'}</button>` : ''}
        </span>
      </article>`).join('')
    : '<p class="workspace-empty">尚无调查表、GIS或文档资料。</p>';

  const previousFieldCommunityId = elements.fieldTaskCommunitySelect.value;
  const activeFieldCommunities = state.communities.filter((community) => community.status !== 'inactive');
  elements.fieldTaskCommunitySelect.innerHTML = activeFieldCommunities
    .map((community) => `<option value="${escapeHtml(community.id)}">${escapeHtml(community.name)}</option>`)
    .join('');
  if (activeFieldCommunities.some((community) => String(community.id) === previousFieldCommunityId)) {
    elements.fieldTaskCommunitySelect.value = previousFieldCommunityId;
  }
  renderFieldTaskBuildingOptions(state);
  const previousProblemCode = elements.fieldTaskProblemSelect.value;
  elements.fieldTaskProblemSelect.innerHTML = '<option value="">一般采集任务</option>'
    + state.fieldProblemTypes.map((problem) => `<option value="${escapeHtml(problem.code)}">${escapeHtml(problem.code)} · ${escapeHtml(problem.name)}</option>`).join('');
  if (state.fieldProblemTypes.some((problem) => problem.code === previousProblemCode)) {
    elements.fieldTaskProblemSelect.value = previousProblemCode;
  }
  elements.createFieldTaskButton.disabled = state.collectionLoading || !activeFieldCommunities.length;
  elements.fieldTaskList.innerHTML = state.fieldTasks.length
    ? state.fieldTasks.map((task) => `<article class="field-task-row">
        <div class="field-task-summary"><strong>${escapeHtml(task.clientTaskId || task.id)}</strong><span>${escapeHtml(task.problemCode ? `${task.problemCode} · ${task.problemName}` : task.description || '一般采集任务')}</span><small>${escapeHtml(task.communityName || task.communityId || '未关联小区')}${task.buildingName || task.buildingId ? ` · ${escapeHtml(task.buildingName || task.buildingId)}` : ''} · ${escapeHtml(task.collectorId || task.collector || '采集人员未记录')}</small></div>
        <div class="field-task-progress"><strong>${Number(task.uploadedPhotoCount) || 0} / ${Number(task.expectedPhotoCount ?? task.photoCount) || 0}</strong><span>照片完成进度</span>${task.failedUploads?.length ? `<small>${task.failedUploads.length} 项失败可重试</small>` : ''}</div>
        <div class="field-task-actions">
          <label><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-field-task-files="${escapeHtml(task.id)}"><span>选择照片</span></label>
          <button type="button" data-upload-field-task="${escapeHtml(task.id)}" ${task.status === 'completed' ? 'disabled' : ''}>上传</button>
          <button type="button" data-complete-field-task="${escapeHtml(task.id)}" ${task.status === 'completed' ? 'disabled' : ''}>完成</button>
          ${task.failedUploads?.length ? `<button type="button" data-retry-field-task="${escapeHtml(task.id)}">重试失败项</button>` : ''}
        </div>
        <i class="run-status status-${escapeHtml(task.status || 'created')}">${escapeHtml(task.status || 'created')}</i>
      </article>`).join('')
    : '<p class="workspace-empty">尚无外业采集任务。</p>';
  if (state.fieldTaskErrors.length) {
    elements.fieldTaskList.insertAdjacentHTML(
      'beforeend',
      `<p class="form-error">有${state.fieldTaskErrors.length}个任务暂时无法从上游读取，引用记录已保留。</p>`
    );
  }

  const buildingCommunityId = elements.buildingCommunitySelect.value;
  const buildings = state.buildingsByCommunity[buildingCommunityId] || [];
  elements.buildingList.innerHTML = buildings.length
    ? buildings.map((building) => `<article>
        <div><strong>${escapeHtml(building.name)}</strong><span>${escapeHtml(building.address || '未填写地址')}</span></div>
        <small>${building.householdCount == null ? '户数待补录' : `${building.householdCount} 户`} · ${building.floorCount == null ? '层数待补录' : `${building.floorCount} 层`} · ${building.status === 'inactive' ? '已停用' : '使用中'}</small>
        <span class="building-row-actions">
          <button type="button" data-edit-building="${escapeHtml(building.id)}">编辑</button>
          <button type="button" data-toggle-building="${escapeHtml(building.id)}" data-next-status="${building.status === 'inactive' ? 'active' : 'inactive'}">${building.status === 'inactive' ? '恢复' : '停用'}</button>
        </span>
      </article>`).join('')
    : '<p class="workspace-empty">当前小区尚无楼栋台账。</p>';
  renderUploadBuildingOptions(state);
  renderUploadSessions(state);

  elements.photoGrid.innerHTML = state.photos.length
    ? state.photos.map((photo) => `<article class="photo-card">
        <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name || '现场照片')}" loading="lazy">
        <div>
          <strong>${escapeHtml(photo.name || photo.id)}</strong>
          <span>${escapeHtml(photo.communityName || '未关联小区')}${photo.buildingName ? ` · ${escapeHtml(photo.buildingName)}` : ''}</span>
          <small>${photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleString() : '时间未记录'} · ${formatFileSize(photo.size)} · ${photo.coordinateSource === 'exif' ? 'EXIF定位 · ' : ''}${photo.governanceStatus === 'inactive' ? '已停用' : '使用中'}</small>
        </div>
      </article>`).join('')
    : '<p class="workspace-empty">当前项目尚无已归档照片。这里不会显示Demo示例照片。</p>';
  renderPhotoMetadataForm(state);
}

function photoCapturedLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function populatePhotoMetadataForm(state, photo) {
  const form = elements.photoMetadataForm;
  form.dataset.metadataRevision = String(Number(photo?.metadataRevision) || 0);
  form.elements.displayName.value = photo?.name || '';
  form.elements.longitude.value = photo?.coordinates?.[0] ?? '';
  form.elements.latitude.value = photo?.coordinates?.[1] ?? '';
  form.elements.capturedAt.value = photoCapturedLocal(photo?.capturedAt);
  form.elements.status.value = photo?.governanceStatus || 'active';
  form.elements.notes.value = photo?.governanceNotes || '';
  form.elements.updatedBy.value = '';
  const activeCommunities = state.communities.filter((community) => community.status !== 'inactive');
  elements.photoMetadataCommunitySelect.innerHTML = activeCommunities
    .map((community) => `<option value="${escapeHtml(community.id)}">${escapeHtml(community.name)}</option>`)
    .join('');
  if (activeCommunities.some((community) => String(community.id) === String(photo?.communityId))) {
    elements.photoMetadataCommunitySelect.value = photo.communityId;
  }
  renderPhotoMetadataBuildingOptions(state, photo?.buildingId);
}

function renderPhotoMetadataBuildingOptions(state, selectedBuildingId = '') {
  const communityId = elements.photoMetadataCommunitySelect.value;
  const buildings = (state.buildingsByCommunity[communityId] || [])
    .filter((building) => building.status !== 'inactive');
  elements.photoMetadataBuildingSelect.innerHTML = '<option value="">不关联楼栋</option>' + buildings
    .map((building) => `<option value="${escapeHtml(building.id)}">${escapeHtml(building.name)}</option>`)
    .join('');
  if (buildings.some((building) => String(building.id) === String(selectedBuildingId))) {
    elements.photoMetadataBuildingSelect.value = selectedBuildingId;
  }
}

function renderPhotoMetadataForm(state) {
  const previousPhotoId = elements.photoMetadataSelect.value;
  elements.photoMetadataSelect.innerHTML = state.photos
    .map((photo) => `<option value="${escapeHtml(photo.id)}">${escapeHtml(photo.name || photo.id)}${photo.governanceStatus === 'inactive' ? '（已停用）' : ''}</option>`)
    .join('');
  if (state.photos.some((photo) => String(photo.id) === previousPhotoId)) {
    elements.photoMetadataSelect.value = previousPhotoId;
  }
  const photo = state.photos.find((item) => String(item.id) === elements.photoMetadataSelect.value) || state.photos[0];
  elements.photoMetadataSelect.disabled = !photo;
  elements.savePhotoMetadataButton.disabled = !photo || state.collectionLoading;
  if (
    elements.photoMetadataForm.dataset.loadedPhotoId !== String(photo?.id || '')
    || elements.photoMetadataForm.dataset.metadataRevision !== String(Number(photo?.metadataRevision) || 0)
  ) {
    elements.photoMetadataForm.dataset.loadedPhotoId = String(photo?.id || '');
    populatePhotoMetadataForm(state, photo);
  }
}

function renderUploadSessions(state) {
  const statusLabels = {
    ready: '等待上传',
    uploading: '正在上传',
    completed: '已完成',
    failed: '上传失败',
    canceled: '已取消'
  };
  const sessions = state.uploadSessions.slice(0, 12);
  elements.uploadSessionList.innerHTML = sessions.length
    ? sessions.map((session) => {
        const retryable = session.status === 'failed' && pendingUploadFiles.has(session.id);
        const cancelable = ['ready', 'failed'].includes(session.status);
        return `<article class="upload-session status-${escapeHtml(session.status)}">
          <div>
            <strong>${escapeHtml(session.file?.name || session.id)}</strong>
            <span>${escapeHtml(session.communityName || '未关联小区')}${session.buildingName ? ` · ${escapeHtml(session.buildingName)}` : ''} · ${formatFileSize(session.file?.size)}</span>
          </div>
          <div class="upload-session-state">
            <i>${escapeHtml(statusLabels[session.status] || session.status)}</i>
            <small>尝试 ${Number(session.attempts) || 0} 次</small>
            ${session.exifApplyStatus === 'applied' ? `<small>EXIF已应用${session.exif?.coordinates ? ' · GPS' : ''}${session.exif?.capturedAt ? ' · 拍摄时间' : ''}</small>` : session.exifApplyStatus === 'failed' ? '<small>EXIF已提取，治理信息应用失败</small>' : ''}
          </div>
          <div class="upload-session-actions">
            ${retryable ? `<button type="button" data-retry-upload="${escapeHtml(session.id)}">重试</button>` : ''}
            ${cancelable ? `<button type="button" data-cancel-upload="${escapeHtml(session.id)}">取消</button>` : ''}
          </div>
          ${session.error?.message ? `<p>${escapeHtml(session.error.message)}</p>` : ''}
        </article>`;
      }).join('')
    : '<p class="workspace-empty">尚无上传会话。选择文件后会先建立可恢复会话，再写入照片存储。</p>';
}

function renderUploadBuildingOptions(state) {
  const previous = elements.uploadBuildingSelect.value;
  const communityId = elements.uploadCommunitySelect.value;
  const buildings = (state.buildingsByCommunity[communityId] || [])
    .filter((building) => building.status !== 'inactive');
  elements.uploadBuildingSelect.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '不绑定具体楼栋';
  elements.uploadBuildingSelect.append(empty);
  for (const building of buildings) {
    const option = document.createElement('option');
    option.value = building.id;
    option.textContent = building.name;
    elements.uploadBuildingSelect.append(option);
  }
  if (buildings.some((item) => item.id === previous)) elements.uploadBuildingSelect.value = previous;
  elements.uploadBuildingSelect.disabled = !communityId;
}

function renderFieldTaskBuildingOptions(state) {
  const previous = elements.fieldTaskBuildingSelect.value;
  const communityId = elements.fieldTaskCommunitySelect.value;
  const buildings = (state.buildingsByCommunity[communityId] || [])
    .filter((building) => building.status !== 'inactive');
  elements.fieldTaskBuildingSelect.innerHTML = '<option value="">小区级任务</option>' + buildings
    .map((building) => `<option value="${escapeHtml(building.id)}">${escapeHtml(building.name)}</option>`)
    .join('');
  if (buildings.some((building) => String(building.id) === previous)) {
    elements.fieldTaskBuildingSelect.value = previous;
  }
  elements.fieldTaskBuildingSelect.disabled = !communityId;
}

function isAnalysisWorkspace(state) {
  const query = new URLSearchParams(location.search);
  return state.selectedStageId === 'ai-analysis' && query.get('view') === 'workspace' && Boolean(state.activeProjectId);
}

function candidatesFromAnalysis(analysis) {
  if (Array.isArray(analysis?.reviewIssues)) return analysis.reviewIssues;
  if (Array.isArray(analysis?.result?.issues)) return analysis.result.issues;
  return [];
}

function candidateStats(candidates) {
  const items = Array.isArray(candidates) ? candidates : [];
  const confidence = items
    .filter((item) => item.confidence !== null && item.confidence !== undefined && item.confidence !== '')
    .map((item) => Number(item.confidence))
    .filter(Number.isFinite);
  return {
    total: items.length,
    high: items.filter((item) => item.severity === 'high').length,
    medium: items.filter((item) => item.severity === 'medium').length,
    low: items.filter((item) => item.severity === 'low').length,
    average: confidence.length ? confidence.reduce((sum, value) => sum + value, 0) / confidence.length : null
  };
}

function analysisJobStatusLabel(status) {
  return {
    queued: '排队中',
    running: '识别中',
    completed: '已完成',
    stale: '证据已变化',
    failed: '失败',
    canceled: '已取消'
  }[status] || status || '未知';
}

function latestCompletedAnalysisJob(jobs) {
  return (Array.isArray(jobs) ? jobs : []).find((job) => job.status === 'completed') || null;
}

function renderAnalysis(state) {
  const visible = isAnalysisWorkspace(state);
  elements.analysisWorkspace.hidden = !visible;
  if (!visible) return;

  const ai = state.meta?.services?.ai || {};
  const ready = state.aiConfig?.ready === true || ai.ready === true;
  const latestLegacyAnalysis = [...state.analyses].sort((a, b) =>
    String(b.completedAt || b.createdAt || b.timestamp || '').localeCompare(String(a.completedAt || a.createdAt || a.timestamp || ''))
  )[0];
  const latestJob = state.analysisJobs[0] || null;
  const latestCompletedJob = latestCompletedAnalysisJob(state.analysisJobs);
  const matchingLegacyAnalysis = latestCompletedJob?.analysisId
    ? state.analyses.find((analysis) => String(analysis.id) === String(latestCompletedJob.analysisId))
    : null;
  const latest = latestJob || latestLegacyAnalysis;
  const candidates = latestCompletedJob
    ? state.analysisJobCandidates
    : candidatesFromAnalysis(matchingLegacyAnalysis || latestLegacyAnalysis);
  const stats = candidateStats(candidates);
  const activeJob = state.analysisJobs.find((job) => ['queued', 'running'].includes(job.status));
  elements.analyzablePhotoCount.textContent = state.photos.length;
  elements.analysisCount.textContent = state.analysisJobs.length || state.analyses.length;
  elements.candidateCount.textContent = stats.total;
  elements.aiCapabilityBanner.className = `capability-banner ${ready ? 'is-ready' : 'is-unavailable'}`;
  elements.aiCapabilityTitle.textContent = ready ? '视觉AI可用' : '视觉AI尚未配置';
  elements.aiCapabilityMessage.textContent = ready
    ? `当前模型：${state.aiConfig?.preferences?.model || ai.model || '由后端配置'}`
    : `原因：${ai.reason || 'ai_unavailable'}。不会显示或生成Demo候选结果。`;
  const configRevision = String(Number(state.aiConfig?.revision) || 0);
  elements.aiConfigStatus.textContent = state.aiConfig?.ready
    ? `已配置 ${state.aiConfig.keyHint || ''}`
    : '当前用户尚未配置Key';
  if (
    elements.aiConfigForm.dataset.revision !== configRevision
    && !elements.aiConfigForm.contains(document.activeElement)
  ) {
    elements.aiConfigForm.dataset.revision = configRevision;
    elements.aiConfigForm.elements.apiKey.value = '';
    elements.aiConfigForm.elements.model.value = state.aiConfig?.preferences?.model || 'qwen3-vl-plus';
    elements.aiConfigForm.elements.timeoutMs.value = state.aiConfig?.preferences?.timeoutMs || 120000;
    elements.aiConfigForm.elements.maxImagesPerBatch.value = state.aiConfig?.preferences?.maxImagesPerBatch || 20;
  }

  elements.analysisPhotoPicker.innerHTML = state.photos.length
    ? state.photos.map((photo) => `<label class="analysis-photo-option">
        <input type="checkbox" name="photoIds" value="${escapeHtml(photo.id)}">
        <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name || '现场照片')}">
        <span>${escapeHtml(photo.name || photo.id)}</span>
      </label>`).join('')
    : '<p class="workspace-empty">当前项目没有可分析照片，请先回到阶段01上传真实现场照片。</p>';

  elements.startAnalysisButton.disabled = !ready || !state.photos.length || state.analysisSubmitting || Boolean(activeJob);
  elements.startAnalysisButton.textContent = state.analysisSubmitting
    ? '正在创建任务…'
    : activeJob
      ? `${analysisJobStatusLabel(activeJob.status)} ${Number(activeJob.progress?.percent) || 0}%`
      : '创建AI分析任务';

  elements.analysisResultSummary.innerHTML = latest
    ? `<article><span>运行状态</span><strong>${escapeHtml(analysisJobStatusLabel(latest.status))}</strong></article>
       <article><span>高 / 中 / 低</span><strong>${stats.high} / ${stats.medium} / ${stats.low}</strong></article>
       <article><span>平均置信度</span><strong>${stats.average == null ? '无有效值' : `${(stats.average * 100).toFixed(1)}%`}</strong></article>`
    : '<p class="workspace-empty">尚无真实AI分析记录。</p>';

  elements.candidateList.innerHTML = candidates.length
    ? candidates.map((candidate) => `<article>
        <header><span class="risk-${escapeHtml(candidate.severity)}">${escapeHtml(candidate.severity || 'unknown')}</span><small>${candidate.confidence == null ? '置信度未返回' : `${(Number(candidate.confidence) * 100).toFixed(1)}%`}</small></header>
        <strong>${escapeHtml(candidate.title || '未命名候选问题')}</strong>
        <p>${escapeHtml(candidate.evidence || candidate.desc || '模型未返回证据说明')}</p>
        <footer>${escapeHtml(candidate.categoryName || candidate.categoryCode || '未分类')} · ${escapeHtml(candidate.photoId || `第${candidate.imageIndex || 1}张照片`)}</footer>
      </article>`).join('')
    : '<p class="workspace-empty">最近分析没有候选问题，或尚未完成分析。</p>';

  elements.analysisHistoryList.innerHTML = state.analysisJobs.length
    ? state.analysisJobs.map((job) => {
        const time = job.completedAt || job.startedAt || job.createdAt;
        const actions = job.status === 'failed'
          ? `<button class="secondary-button compact-button" type="button" data-analysis-job-action="retry" data-analysis-job-id="${escapeHtml(job.id)}">重试</button>
             <button class="secondary-button compact-button" type="button" data-analysis-job-action="cancel" data-analysis-job-id="${escapeHtml(job.id)}">取消</button>`
          : job.status === 'queued'
            ? `<button class="secondary-button compact-button" type="button" data-analysis-job-action="cancel" data-analysis-job-id="${escapeHtml(job.id)}">取消</button>`
            : '';
        return `<article class="history-row">
          <div><strong>${escapeHtml(job.analysisType || '综合巡检分析')}</strong><span>${time ? new Date(time).toLocaleString() : '时间未记录'}</span></div>
          <span>${job.photoIds?.length || 0} 张照片 · ${Number(job.batchCount) || 1} 批 · ${Number(job.progress?.percent) || 0}%</span>
          <span>${Number(job.candidateCount) || 0} 个候选${Number(job.duplicateCandidateCount) ? ` · 合并${Number(job.duplicateCandidateCount)}项重复` : ''}</span>
          <i class="run-status status-${escapeHtml(job.status || 'unknown')}">${escapeHtml(analysisJobStatusLabel(job.status))}</i>
          <span class="history-actions">${actions}</span>
        </article>`;
      }).join('')
    : state.analyses.length
      ? [...state.analyses].reverse().map((analysis) => {
          const count = candidatesFromAnalysis(analysis).length;
          const time = analysis.completedAt || analysis.createdAt || analysis.timestamp;
          return `<article class="history-row">
            <div><strong>${escapeHtml(analysis.analysisType || '综合巡检分析')}</strong><span>${time ? new Date(time).toLocaleString() : '时间未记录'}</span></div>
            <span>${Number(analysis.imagesCount) || 0} 张照片</span>
            <span>${count} 个候选</span>
            <i class="run-status status-${escapeHtml(analysis.status || 'unknown')}">${escapeHtml(analysis.status || 'unknown')}</i>
          </article>`;
        }).join('')
      : '<p class="workspace-empty">没有已持久化的分析任务。</p>';
}

function isReviewWorkspace(state) {
  const query = new URLSearchParams(location.search);
  return state.selectedStageId === 'human-review' && query.get('view') === 'workspace' && Boolean(state.activeProjectId);
}

function activeReviewAnalysis(analyses) {
  const sorted = [...analyses].sort((a, b) =>
    String(b.completedAt || b.archivedAt || b.createdAt || '').localeCompare(String(a.completedAt || a.archivedAt || a.createdAt || ''))
  );
  return sorted.find((item) => item.status === 'reviewing') || sorted.find((item) => item.status === 'archived') || null;
}

function reviewBboxHtml(candidate) {
  const style = bboxPercentStyle(candidate?.bbox);
  if (!style) return '';
  const confidence = candidate.confidence == null
    ? ''
    : ` · ${(Number(candidate.confidence) * 100).toFixed(0)}%`;
  return `<span class="review-bbox risk-${escapeHtml(candidate.severity || 'medium')}" style="${style}"><span>${escapeHtml(candidate.categoryName || candidate.title || '问题')}${confidence}</span></span>`;
}

function renderReview(state) {
  const visible = isReviewWorkspace(state);
  elements.reviewWorkspace.hidden = !visible;
  if (!visible) return;

  const analysis = activeReviewAnalysis(state.analyses);
  const candidates = candidatesFromAnalysis(analysis);
  const pending = candidates.filter((item) => !item.reviewStatus || item.reviewStatus === 'pending').length;
  const accepted = candidates.filter((item) => ['accepted', 'modified'].includes(item.reviewStatus)).length;
  const excluded = candidates.filter((item) => ['excluded', 'rejected'].includes(item.reviewStatus)).length;
  const archived = analysis?.status === 'archived';
  const visibleCandidates = reviewRiskFilter === 'all'
    ? candidates
    : candidates.filter((candidate) => candidate.severity === reviewRiskFilter);
  elements.pendingReviewCount.textContent = pending;
  elements.acceptedReviewCount.textContent = accepted;
  elements.excludedReviewCount.textContent = excluded;
  elements.reviewBatchTitle.textContent = analysis
    ? `${analysis.analysisType || '综合巡检分析'} · ${analysis.id}`
    : '没有可复核分析';
  elements.reviewRiskFilter.value = reviewRiskFilter;
  elements.reviewRiskFilter.disabled = !analysis;
  elements.reviewFilterSummary.textContent = reviewRiskFilter === 'all'
    ? `显示全部 ${candidates.length} 个候选`
    : `当前显示 ${visibleCandidates.length} 个${{ high: '高', medium: '中', low: '低' }[reviewRiskFilter]}风险候选`;
  elements.acceptVisibleCandidatesButton.disabled = !analysis
    || archived
    || state.reviewLoading
    || !visibleCandidates.some((candidate) => !candidate.reviewStatus || candidate.reviewStatus === 'pending');

  elements.reviewCandidateList.innerHTML = !analysis
    ? '<p class="workspace-empty">请先在阶段02完成一次真实AI分析。</p>'
    : visibleCandidates.length
      ? visibleCandidates.map((candidate, index) => {
          const photo = state.photos.find((item) => String(item.id) === String(candidate.photoId));
          const current = candidate.reviewStatus === 'rejected' ? 'excluded' : candidate.reviewStatus || 'pending';
          const imageIndex = Math.max(1, Math.trunc(Number(candidate.imageIndex) || 1));
          const imageMeta = analysis.imageMeta?.[imageIndex - 1] || {};
          const imageWidth = Number(photo?.width || imageMeta.width);
          const imageHeight = Number(photo?.height || imageMeta.height);
          const mediaStyle = imageWidth > 0 && imageHeight > 0
            ? ` style="aspect-ratio:${imageWidth}/${imageHeight}"`
            : '';
          return `<article class="review-card">
            <div class="review-media"${mediaStyle}>${photo?.url ? `<img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name || '证据照片')}">${reviewBboxHtml(candidate)}` : '<span>无照片预览</span>'}</div>
            <div class="review-content">
              <header><span class="risk-${escapeHtml(candidate.severity)}">${escapeHtml(candidate.severity || 'unknown')}</span><small>${candidate.confidence == null ? '置信度未返回' : `${(Number(candidate.confidence) * 100).toFixed(1)}%`}</small></header>
              <strong>${escapeHtml(candidate.title || `候选问题 ${index + 1}`)}</strong>
              <p>${escapeHtml(candidate.evidence || candidate.desc || '模型未返回证据说明')}</p>
              <small>${escapeHtml(candidate.categoryName || candidate.categoryCode || '未分类')}</small>
              ${archived ? '' : `<div class="candidate-edit-grid">
                <label class="form-field"><span>修正标题</span><input name="candidateTitle:${escapeHtml(candidate.id)}" maxlength="120" value="${escapeHtml(candidate.title || '')}"></label>
                <label class="form-field"><span>修正等级</span><select name="candidateSeverity:${escapeHtml(candidate.id)}">
                  <option value="high" ${candidate.severity === 'high' ? 'selected' : ''}>高</option>
                  <option value="medium" ${candidate.severity === 'medium' ? 'selected' : ''}>中</option>
                  <option value="low" ${candidate.severity === 'low' ? 'selected' : ''}>低</option>
                </select></label>
                <label class="form-field candidate-edit-wide"><span>修正描述</span><textarea name="candidateDesc:${escapeHtml(candidate.id)}" maxlength="2000" rows="2">${escapeHtml(candidate.desc || '')}</textarea></label>
                <label class="form-field candidate-edit-wide"><span>修正证据</span><textarea name="candidateEvidence:${escapeHtml(candidate.id)}" maxlength="2000" rows="2">${escapeHtml(candidate.evidence || '')}</textarea></label>
              </div>`}
            </div>
            <div class="review-decision">
              <span>人工结论</span>
              <select name="decision:${escapeHtml(candidate.id)}" ${archived ? 'disabled' : ''}>
                <option value="pending" ${current === 'pending' ? 'selected' : ''}>待复核</option>
                <option value="accepted" ${current === 'accepted' || current === 'modified' ? 'selected' : ''}>接受为正式问题</option>
                <option value="excluded" ${current === 'excluded' ? 'selected' : ''}>排除候选</option>
              </select>
              <small>修订 ${Number(candidate.candidateRevision) || 1}${candidate.updatedBy ? ` · ${escapeHtml(candidate.updatedBy)}` : ''}</small>
              ${archived ? '' : `<button class="secondary-button compact-button" type="button" data-save-candidate="${escapeHtml(candidate.id)}" data-analysis-id="${escapeHtml(analysis.id)}">保存当前候选</button>`}
            </div>
          </article>`;
        }).join('')
      : candidates.length
        ? '<p class="workspace-empty">当前风险筛选下没有候选问题。</p>'
        : '<p class="workspace-empty">本次真实分析返回0个候选问题，可由复核人员直接归档零问题结论。</p>';

  elements.finalizeReviewButton.disabled = !analysis || archived || state.reviewLoading;
  elements.finalizeReviewButton.textContent = archived ? '本批次已归档' : state.reviewLoading ? '正在归档…' : '完成复核并归档';

  elements.manualIssuePhotoSelect.innerHTML = '<option value="">不关联照片</option>' + state.photos
    .map((photo) => `<option value="${escapeHtml(photo.id)}">${escapeHtml(photo.name || photo.id)}</option>`)
    .join('');
  const latestManualReview = state.reviewSessions[0] || null;
  elements.manualReviewSummary.innerHTML = latestManualReview
    ? `<div class="review-zero-note"><strong>最近已归档</strong><span>${new Date(latestManualReview.archivedAt).toLocaleString()} · ${escapeHtml(latestManualReview.reviewerName)} · ${latestManualReview.issueCount}个正式问题</span></div>`
    : `<p class="workspace-empty">尚未归档人工复核结论。当前已持久化${state.issues.length}个正式问题。</p>`;
}

function isGisWorkspace(state) {
  const query = new URLSearchParams(location.search);
  return state.selectedStageId === 'gis-and-issues' && query.get('view') === 'workspace' && Boolean(state.activeProjectId);
}

const hasIssueGeometry = hasPointGeometry;
const pointInsideBoundary = pointInsideSimplePolygon;

function renderSpatialSvg(project, issues, mapView, visibleLayers = {}) {
  const validPoint = (point) => Array.isArray(point)
    && Number.isFinite(Number(point[0]))
    && Number.isFinite(Number(point[1]))
    ? point.slice(0, 2).map(Number)
    : null;
  const sourceBoundary = mapView?.boundary?.geometry || project?.scopeBoundaryGeometry;
  const boundaryPolygons = sourceBoundary?.type === 'MultiPolygon'
    ? sourceBoundary.coordinates
    : sourceBoundary?.type === 'Polygon'
      ? [sourceBoundary.coordinates]
      : Array.isArray(project?.scopeBoundary)
        ? [[project.scopeBoundary]]
        : [];
  const boundaryRings = visibleLayers.boundary === false ? [] : boundaryPolygons.flatMap((polygon) =>
    (Array.isArray(polygon) ? polygon : [])
      .map((ring) => (Array.isArray(ring) ? ring : []).map(validPoint).filter(Boolean))
      .filter((ring) => ring.length >= 3)
  );
  const historyBoundaryRings = visibleLayers.boundaryHistory === false
    ? []
    : (mapView?.boundaryHistory?.items || []).flatMap((feature) => {
        const polygons = feature.geometry?.type === 'MultiPolygon'
          ? feature.geometry.coordinates
          : feature.geometry?.type === 'Polygon'
            ? [feature.geometry.coordinates]
            : [];
        return polygons.flatMap((polygon) =>
          (Array.isArray(polygon) ? polygon : [])
            .map((ring) => (Array.isArray(ring) ? ring : []).map(validPoint).filter(Boolean))
            .filter((ring) => ring.length >= 3)
        );
      });
  const boundary = boundaryRings[0] || [];
  const issuePoints = issues
    .filter(hasIssueGeometry)
    .filter((issue) => {
      const pending = issue.spatialBinding?.status === 'pending'
        || issue.bindingStatus === 'pending';
      return pending
        ? visibleLayers.pendingIssues !== false
        : visibleLayers.issues !== false;
    })
    .map((issue) => ({ issue, point: issue.geometry.coordinates.slice(0, 2).map(Number) }));
  const photoPoints = (mapView?.photos?.items || [])
    .filter((item) => {
      const source = String(item.properties?.coordinateSource || '').toLowerCase();
      const manual = source.includes('manual') || source.includes('batch');
      return manual
        ? visibleLayers.manualPhotos !== false
        : visibleLayers.photos !== false;
    })
    .map((item) => ({ item, point: validPoint(item.geometry?.coordinates) }))
    .filter((item) => item.point);
  const stopPoints = (mapView?.stops?.items || [])
    .filter(() => visibleLayers.stops !== false)
    .map((item) => ({ item, point: validPoint(item.geometry?.coordinates) }))
    .filter((item) => item.point);
  const routeLines = (mapView?.routes?.items || [])
    .filter(() => visibleLayers.routes !== false)
    .flatMap((item) => {
      const segments = item.geometry?.type === 'LineString'
        ? [item.geometry.coordinates]
        : item.geometry?.type === 'MultiLineString'
          ? item.geometry.coordinates
          : [];
      return segments.map((segment) => ({
        item,
        points: segment.map(validPoint).filter(Boolean)
      }));
    })
    .filter((item) => item.points.length >= 2);
  const selectedRun = mapView?.spatialAnalyses?.items?.[0];
  const fallbackPoiItems = selectedRun?.result?.accepted || selectedRun?.result?.items || [];
  const poiPoints = fallbackPoiItems
    .filter((item) => visibleLayers.poi !== false && item.reviewStatus !== 'excluded')
    .map((item) => ({ item, point: validPoint(item.coordinates || item.geometry?.coordinates) }))
    .filter((item) => item.point);
  const excludedPoiPoints = fallbackPoiItems
    .filter((item) => visibleLayers.excludedPoi !== false && item.reviewStatus === 'excluded')
    .map((item) => ({ item, point: validPoint(item.coordinates || item.geometry?.coordinates) }))
    .filter((item) => item.point);
  const allPoints = [
    ...boundaryRings.flat(),
    ...historyBoundaryRings.flat(),
    ...issuePoints.map((item) => item.point),
    ...photoPoints.map((item) => item.point),
    ...stopPoints.map((item) => item.point),
    ...routeLines.flatMap((item) => item.points),
    ...poiPoints.map((item) => item.point),
    ...excludedPoiPoints.map((item) => item.point)
  ];
  if (!allPoints.length) {
    return '<p class="workspace-empty">尚无可绘制的真实边界或空间对象。</p>';
  }
  const longitudes = allPoints.map((point) => point[0]);
  const latitudes = allPoints.map((point) => point[1]);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lonSpan = Math.max(maxLon - minLon, 0.001);
  const latSpan = Math.max(maxLat - minLat, 0.001);
  const projectPoint = ([longitude, latitude]) => [
    30 + ((longitude - minLon) / lonSpan) * 540,
    270 - ((latitude - minLat) / latSpan) * 240
  ];
  const polygons = boundaryRings.map((ring) =>
    `<polygon points="${ring.map((point) => projectPoint(point).join(',')).join(' ')}" />`
  ).join('');
  const historicalPolygons = historyBoundaryRings.map((ring) =>
    `<polygon points="${ring.map((point) => projectPoint(point).join(',')).join(' ')}" />`
  ).join('');
  const markers = issuePoints.map(({ issue, point }, index) => {
    const [x, y] = projectPoint(point);
    return `<g><circle cx="${x}" cy="${y}" r="6" /><text x="${x + 9}" y="${y + 3}">${index + 1}. ${escapeHtml(issue.title || issue.id)}</text></g>`;
  }).join('');
  const photoMarkers = photoPoints.map(({ item, point }) => {
    const [x, y] = projectPoint(point);
    return `<circle class="spatial-photo" cx="${x}" cy="${y}" r="4"><title>${escapeHtml(item.properties?.name || item.id)}</title></circle>`;
  }).join('');
  const stopMarkers = stopPoints.map(({ item, point }) => {
    const [x, y] = projectPoint(point);
    return `<rect class="spatial-stop" x="${x - 4}" y="${y - 4}" width="8" height="8"><title>${escapeHtml(item.id)}</title></rect>`;
  }).join('');
  const poiMarkers = poiPoints.map(({ item, point }) => {
    const [x, y] = projectPoint(point);
    return `<path class="spatial-poi" d="M${x} ${y - 5}L${x + 5} ${y + 4}H${x - 5}Z"><title>${escapeHtml(item.name || item.normalizedId)}</title></path>`;
  }).join('');
  const excludedPoiMarkers = excludedPoiPoints.map(({ item, point }) => {
    const [x, y] = projectPoint(point);
    return `<path class="spatial-poi-excluded" d="M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x + 4} ${y - 4}L${x - 4} ${y + 4}"><title>${escapeHtml(item.name || item.normalizedId)}（已排除）</title></path>`;
  }).join('');
  const routes = routeLines.map(({ item, points }) =>
    `<polyline class="spatial-route" points="${points.map((point) => projectPoint(point).join(',')).join(' ')}"><title>${escapeHtml(item.properties?.name || item.id)}</title></polyline>`
  ).join('');
  const center = validPoint(selectedRun?.parameters?.center);
  const radiusMeters = Number(selectedRun?.parameters?.radiusMeters);
  const analysisCircle = visibleLayers.analysisRange !== false
    && center && Number.isFinite(radiusMeters)
    ? (() => {
        const [x, y] = projectPoint(center);
        const latitudeRadians = center[1] * Math.PI / 180;
        const longitudeDegrees = radiusMeters / (111320 * Math.max(Math.cos(latitudeRadians), 0.1));
        const pixelRadius = Math.max(3, longitudeDegrees / lonSpan * 540);
        return `<circle class="spatial-analysis-range" cx="${x}" cy="${y}" r="${pixelRadius}"><title>${radiusMeters}米分析范围</title></circle><text class="spatial-analysis-label" x="${x}" y="${Math.max(12, y - pixelRadius - 4)}" text-anchor="middle">${Math.round(radiusMeters)}米</text>`;
      })()
    : '';
  const distanceLines = visibleLayers.distanceLines !== false && center
    ? (selectedRun?.result?.distances || []).map((item) => {
        const end = validPoint(item.coordinates);
        if (!end) return '';
        const [startX, startY] = projectPoint(center);
        const [endX, endY] = projectPoint(end);
        const distance = Number(item.distanceMeters);
        return `<g><line class="spatial-distance-line" x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" />${Number.isFinite(distance) ? `<text class="spatial-distance-label" x="${(startX + endX) / 2}" y="${(startY + endY) / 2 - 3}" text-anchor="middle">${distance.toFixed(1)}米</text>` : ''}</g>`;
      }).join('')
    : '';
  return `<svg viewBox="0 0 600 300" role="img" aria-label="真实项目边界和正式问题经纬度预览"
    data-spatial-clickable="${boundary.length >= 3}" data-min-lon="${minLon}" data-max-lon="${maxLon}" data-min-lat="${minLat}" data-max-lat="${maxLat}">
    <g class="spatial-grid"><path d="M30 30V270H570 M30 90H570 M30 150H570 M30 210H570 M165 30V270 M300 30V270 M435 30V270 M570 30V270" /></g>
    <g class="spatial-boundary">${polygons}</g>
    <g class="spatial-boundary-history">${historicalPolygons}</g>
    <g>${analysisCircle}${distanceLines}${routes}</g>
    <g class="spatial-markers">${markers}</g>
    <g>${photoMarkers}${stopMarkers}${poiMarkers}${excludedPoiMarkers}</g>
    <g class="spatial-fallback-legend"><text x="350" y="20">● 问题　● 照片　◆ 停留　△ POI　× 排除　━ 路线</text></g>
    <text class="spatial-extent" x="30" y="292">${minLon.toFixed(5)}, ${minLat.toFixed(5)} → ${maxLon.toFixed(5)}, ${maxLat.toFixed(5)}</text>
    <text class="spatial-extent" x="570" y="292" text-anchor="end">矢量相对预览，不代表在线底图定位</text>
  </svg>`;
}

function populateIssueEditForm(issue) {
  const form = elements.issueEditForm;
  if (!issue) {
    form.dataset.issueRevision = '';
    for (const field of ['title', 'categoryName', 'description', 'evidence', 'suggestion', 'updatedBy']) {
      form.elements[field].value = '';
    }
    elements.issueBindingStatusSelect.value = 'unbound';
    renderIssueProblemOptions('');
    return;
  }
  form.dataset.issueRevision = String(Number(issue.issueRevision) || 1);
  form.elements.title.value = issue.title || '';
  form.elements.severity.value = issue.severity || 'medium';
  form.elements.categoryName.value = issue.categoryName || '';
  form.elements.description.value = issue.description || '';
  form.elements.evidence.value = issue.evidence || '';
  form.elements.suggestion.value = issue.suggestion || '';
  form.elements.updatedBy.value = '';
  elements.issueBindingStatusSelect.value = issue.bindingStatus || 'unbound';
  renderIssueProblemOptions(issue.problemCode || '');
  loadIssueRemediationOptions(issue.problemCode || '', issue.remediationSnapshot?.id || '');
}

function renderIssueProblemOptions(selectedCode = '') {
  const records = store.get().standardProblemTypes || [];
  elements.issueProblemCodeSelect.innerHTML = '<option value="">未绑定问题类型</option>' + records
    .filter((record) => record.status !== 'inactive')
    .map((record) => {
      const code = record.code || record.sourceId;
      const name = record.title || record.payload?.['名称'] || code;
      const dimension = record.payload?.['维度'] || '';
      const category = record.payload?.['问题大类'] || '';
      return `<option value="${escapeHtml(code)}" ${String(code) === String(selectedCode) ? 'selected' : ''}>${escapeHtml(code)} · ${escapeHtml(name)}${dimension ? ` · ${escapeHtml(dimension)}` : ''}${category ? ` · ${escapeHtml(category)}` : ''}</option>`;
    }).join('');
  const disabled = ['unbound', 'not-applicable'].includes(elements.issueBindingStatusSelect.value);
  elements.issueProblemCodeSelect.disabled = disabled;
}

async function loadIssueRemediationOptions(problemCode, selectedId = '') {
  elements.issueRemediationSelect.innerHTML = '<option value="">按问题类型选择</option>';
  elements.issueRemediationSelect.disabled = !problemCode
    || ['unbound', 'not-applicable'].includes(elements.issueBindingStatusSelect.value);
  if (!problemCode) return;
  try {
    const items = await api.standardProblemRemediations(problemCode);
    if (String(elements.issueProblemCodeSelect.value) !== String(problemCode)) return;
    elements.issueRemediationSelect.innerHTML = '<option value="">不引用整改建议</option>' + items
      .map((item) => `<option value="${escapeHtml(item.id)}" ${String(item.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(item.text || item.id)} · ${escapeHtml(item.responsibleUnit || '责任单位未记录')}</option>`)
      .join('');
  } catch (error) {
    elements.issueEditFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.issueEditFormError.hidden = false;
  }
}

function renderGeometryAudit(issue) {
  const audits = Array.isArray(issue?.geometryAudit) ? [...issue.geometryAudit].reverse() : [];
  elements.geometryAuditList.innerHTML = audits.length
    ? `<strong>点位修订记录</strong>${audits.map((audit) => {
        const before = audit.before?.coordinates;
        const after = audit.after?.coordinates;
        return `<article>
          <span>修订 ${Number(audit.revision) || 1}</span>
          <b>${before ? `${escapeHtml(before.join(', '))} → ` : '首次定位 → '}${escapeHtml(after?.join(', ') || '坐标缺失')}</b>
          <small>${escapeHtml(audit.crs || 'WGS84')} · ${escapeHtml(audit.confirmedBy || '人员未记录')}${audit.at ? ` · ${new Date(audit.at).toLocaleString()}` : ''}</small>
        </article>`;
      }).join('')}`
    : '<p class="workspace-empty">当前问题尚无点位修订记录。</p>';
}

function filterGisIssues(issues) {
  return filterOfficialIssues(issues, gisViewState.filters);
}

function populateIssueGeometryForm(issue) {
  const coordinates = hasIssueGeometry(issue) ? issue.geometry.coordinates : null;
  elements.geometryForm.dataset.issueId = String(issue?.id || '');
  elements.geometryForm.dataset.geometryRevision = String(Number(issue?.geometryRevision) || 0);
  if (coordinates) {
    elements.geometryForm.elements.longitude.value = coordinates[0];
    elements.geometryForm.elements.latitude.value = coordinates[1];
    elements.geometryForm.elements.crs.value = issue.spatialBinding?.crs
      || issue.geometryCrs
      || store.get().activeProject?.scopeBoundaryCrs
      || 'WGS84';
  } else {
    elements.geometryForm.elements.longitude.value = '';
    elements.geometryForm.elements.latitude.value = '';
    elements.geometryForm.elements.crs.value = store.get().activeProject?.scopeBoundaryCrs || 'WGS84';
  }
  elements.geometryComparison.textContent = coordinates
    ? `保存前：${coordinates[0]}, ${coordinates[1]} · 修订 ${Number(issue.geometryRevision) || 0}`
    : `保存前：未定位 · 修订 ${Number(issue?.geometryRevision) || 0}`;
  elements.cancelGeometryDraftButton.disabled = true;
}

function showIssueGeometryDraft(issue, point, crs = 'GCJ02') {
  const before = hasIssueGeometry(issue) ? issue.geometry.coordinates : null;
  const movedMeters = before ? haversineMeters(before, point) : null;
  gisViewState.geometryDraft = {
    kind: 'issue',
    id: String(issue?.id || ''),
    before,
    after: point,
    crs
  };
  elements.geometryForm.elements.longitude.value = point[0];
  elements.geometryForm.elements.latitude.value = point[1];
  elements.geometryForm.elements.crs.value = crs;
  elements.geometryComparison.textContent = `${before ? `保存前：${before[0]}, ${before[1]}` : '保存前：未定位'} → 草稿：${Number(point[0]).toFixed(6)}, ${Number(point[1]).toFixed(6)}（${crs}）${movedMeters == null ? '' : ` · 移动 ${Math.round(movedMeters * 10) / 10}m`}`;
  elements.cancelGeometryDraftButton.disabled = false;
}

function populatePhotoGeometryForm(photo) {
  if (!photo) {
    elements.photoGeometryForm.elements.longitude.value = '';
    elements.photoGeometryForm.elements.latitude.value = '';
    elements.photoGeometryComparison.textContent = '当前项目没有可治理的现场照片。';
    elements.cancelPhotoGeometryDraftButton.disabled = true;
    return;
  }
  const coordinates = Array.isArray(photo.coordinates) ? photo.coordinates : null;
  elements.photoGeometryForm.dataset.photoId = String(photo.id);
  elements.photoGeometryForm.dataset.metadataRevision = String(Number(photo.metadataRevision) || 0);
  elements.photoGeometryForm.elements.longitude.value = coordinates?.[0] ?? '';
  elements.photoGeometryForm.elements.latitude.value = coordinates?.[1] ?? '';
  elements.photoGeometryForm.elements.coordinateCrs.value = photo.coordinateCrs
    || store.get().activeProject?.scopeBoundaryCrs
    || 'WGS84';
  elements.photoGeometryComparison.textContent = coordinates
    ? `保存前：${coordinates[0]}, ${coordinates[1]} · 来源 ${photo.coordinateSource || '未记录'} · 修订 ${Number(photo.metadataRevision) || 0}`
    : `保存前：未定位 · 修订 ${Number(photo.metadataRevision) || 0}`;
  elements.cancelPhotoGeometryDraftButton.disabled = true;
}

function showPhotoGeometryDraft(photo, point, crs = 'GCJ02') {
  const before = Array.isArray(photo?.coordinates) ? photo.coordinates : null;
  gisViewState.geometryDraft = {
    kind: 'photo',
    id: String(photo?.id || ''),
    before,
    after: point,
    crs
  };
  elements.photoGeometryForm.elements.longitude.value = point[0];
  elements.photoGeometryForm.elements.latitude.value = point[1];
  elements.photoGeometryForm.elements.coordinateCrs.value = crs;
  elements.photoGeometryComparison.textContent = `${before ? `保存前：${before[0]}, ${before[1]}` : '保存前：未定位'} → 草稿：${Number(point[0]).toFixed(6)}, ${Number(point[1]).toFixed(6)}（${crs}）`;
  elements.cancelPhotoGeometryDraftButton.disabled = false;
}

function renderGis(state) {
  const visible = isGisWorkspace(state);
  elements.gisWorkspace.hidden = !visible;
  if (!visible) return;

  const located = state.issues.filter(hasIssueGeometry);
  const filteredIssues = filterGisIssues(state.issues);
  const editableIssues = state.issues.filter((issue) =>
    ['manual', 'ai-reviewed'].includes(issue.source)
    || Number(issue.issueRevision) >= 1
  );
  elements.gisIssueCount.textContent = state.issues.length;
  elements.locatedIssueCount.textContent = located.length;
  elements.unlocatedIssueCount.textContent = state.issues.length - located.length;
  const mapItems = state.mapView || {};
  const locatedFilteredIssues = filteredIssues.filter(hasPointGeometry);
  const issueFeatureById = new Map(
    (mapItems.issues?.items || []).map((feature) => [String(feature.id), feature])
  );
  const visibleIssueFeatures = locatedFilteredIssues
    .map((issue) => issueFeatureById.get(String(issue.id)))
    .filter(Boolean);
  const legend = buildGisLayerLegend(mapItems, visibleIssueFeatures, gisViewState.visibleLayers);
  elements.gisVisibleCount.textContent = `${legend.objectCount}（问题 ${legend.issueCount}）`;
  elements.gisMapLegend.innerHTML = legend.items.length
    ? legend.items.map(([layer, label, count]) =>
        `<span class="legend-${escapeHtml(layer)}"><i></i>${escapeHtml(label)} <b>${count}</b></span>`
      ).join('')
    : '<span>当前未启用业务图层</span>';
  elements.gisLayout.dataset.mobilePane = gisViewState.mobilePane;
  elements.gisShowListButton.setAttribute(
    'aria-pressed',
    String(gisViewState.mobilePane === 'list')
  );
  elements.gisShowMapButton.setAttribute(
    'aria-pressed',
    String(gisViewState.mobilePane === 'map')
  );
  elements.gisIssueSearch.value = gisViewState.filters.search;
  elements.gisRiskFilter.value = gisViewState.filters.issueRisk;
  elements.gisStatusFilter.value = gisViewState.filters.issueStatus;
  elements.gisBindingFilter.value = gisViewState.filters.bindingStatus;
  elements.gisStaleFilter.value = gisViewState.filters.staleStatus;
  const currentType = gisViewState.filters.issueType;
  const types = [...new Map(state.issues
    .map((issue) => [issue.categoryCode || issue.categoryName, issue.categoryName || issue.categoryCode])
    .filter(([value]) => value)
  )];
  elements.gisTypeFilter.innerHTML = '<option value="all">全部类型</option>' + types
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join('');
  elements.gisTypeFilter.value = types.some(([value]) => String(value) === String(currentType))
    ? currentType
    : 'all';
  gisViewState.filters.issueType = elements.gisTypeFilter.value;
  elements.gisMapStyle.value = gisViewState.mapStyle;
  const pendingDisplayCount = Number(
    state.mapView?.coordinateCompatibility?.pendingDisplayFeatureCount
  ) || 0;
  elements.gisPrepareDisplayButton.disabled = state.gisLoading || pendingDisplayCount === 0;
  elements.gisPrepareDisplayButton.textContent = pendingDisplayCount
    ? `准备高德显示坐标（${pendingDisplayCount}）`
    : '显示坐标已就绪';
  for (const checkbox of elements.gisLayerControl.querySelectorAll('[data-gis-layer]')) {
    checkbox.checked = gisViewState.visibleLayers[checkbox.dataset.gisLayer] !== false;
  }
  elements.spatialPreview.innerHTML = renderSpatialSvg(
    state.activeProject,
    filteredIssues,
    state.mapView,
    gisViewState.visibleLayers
  );
  elements.gisIssueList.innerHTML = filteredIssues.length
    ? filteredIssues.map((issue) => {
        const geometry = hasIssueGeometry(issue) ? issue.geometry.coordinates : null;
        return `<button type="button" class="ledger-row gis-ledger-button${String(issue.id) === gisViewState.selectedIssueId ? ' is-selected' : ''}" data-gis-issue-id="${escapeHtml(issue.id)}">
          <div><strong>${escapeHtml(issue.title || '未命名正式问题')}</strong><span>${escapeHtml(issue.categoryName || issue.categoryCode || '未分类')}</span></div>
          <span class="risk-${escapeHtml(issue.severity)}">${escapeHtml(issue.severity || 'unknown')}</span>
          <small>${geometry ? `${geometry[0]}, ${geometry[1]} · 定位修订 ${Number(issue.geometryRevision) || 1}` : '待定位'}</small>
        </button>`;
      }).join('')
    : state.issues.length
      ? '<p class="workspace-empty">当前筛选条件下没有正式问题。</p>'
      : '<p class="workspace-empty">本项目当前有0个正式问题。若复核结论为零问题，这是合法业务结果，不会生成固定问题点。</p>';

  const previousGeometryIssueId = elements.geometryIssueSelect.value;
  elements.geometryIssueSelect.replaceChildren();
  if (!editableIssues.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '没有可在Business中修订的正式问题';
    elements.geometryIssueSelect.append(option);
    elements.geometryIssueSelect.disabled = true;
    elements.saveGeometryButton.disabled = true;
  } else {
    elements.geometryIssueSelect.disabled = false;
    elements.saveGeometryButton.disabled = state.gisLoading;
    for (const issue of editableIssues) {
      const option = document.createElement('option');
      option.value = issue.id;
      option.textContent = `${issue.title || issue.id}${hasIssueGeometry(issue) ? '（已定位，可修正）' : ''}`;
      elements.geometryIssueSelect.append(option);
    }
    if (editableIssues.some((issue) => String(issue.id) === previousGeometryIssueId)) {
      elements.geometryIssueSelect.value = previousGeometryIssueId;
    }
  }
  const selectedGeometryIssue = editableIssues
    .find((issue) => String(issue.id) === elements.geometryIssueSelect.value)
    || editableIssues[0];
  if (
    gisViewState.geometryDraft?.kind !== 'issue'
    && (
      elements.geometryForm.dataset.issueId !== String(selectedGeometryIssue?.id || '')
      || elements.geometryForm.dataset.geometryRevision
        !== String(Number(selectedGeometryIssue?.geometryRevision) || 0)
    )
  ) populateIssueGeometryForm(selectedGeometryIssue);
  renderGeometryAudit(selectedGeometryIssue);
  const previousPhotoId = elements.photoGeometrySelect.value || gisViewState.selectedPhotoId;
  elements.photoGeometrySelect.innerHTML = state.photos.length
    ? state.photos.map((photo) =>
        `<option value="${escapeHtml(photo.id)}">${escapeHtml(photo.name || photo.id)}${Array.isArray(photo.coordinates) ? '（已定位）' : '（待定位）'}</option>`
      ).join('')
    : '<option value="">当前项目没有现场照片</option>';
  if (state.photos.some((photo) => String(photo.id) === String(previousPhotoId))) {
    elements.photoGeometrySelect.value = previousPhotoId;
  }
  const selectedPhoto = state.photos.find((photo) =>
    String(photo.id) === String(elements.photoGeometrySelect.value)
  ) || state.photos[0];
  elements.photoGeometrySelect.disabled = !selectedPhoto;
  elements.savePhotoGeometryButton.disabled = !selectedPhoto || state.gisLoading;
  if (
    String(elements.photoGeometryForm.dataset.photoId || '') !== String(selectedPhoto?.id || '')
    || String(elements.photoGeometryForm.dataset.metadataRevision || '')
      !== String(Number(selectedPhoto?.metadataRevision) || 0)
  ) populatePhotoGeometryForm(selectedPhoto);
  const previousEditIssueId = elements.issueEditSelect.value;
  elements.issueEditSelect.replaceChildren();
  for (const issue of editableIssues) {
    const option = document.createElement('option');
    option.value = issue.id;
    option.textContent = issue.title || issue.id;
    elements.issueEditSelect.append(option);
  }
  if (editableIssues.some((issue) => String(issue.id) === previousEditIssueId)) {
    elements.issueEditSelect.value = previousEditIssueId;
  }
  elements.issueEditSelect.disabled = !editableIssues.length;
  elements.updateIssueButton.disabled = !editableIssues.length || state.gisLoading;
  const selectedEditIssue = editableIssues.find((issue) => String(issue.id) === elements.issueEditSelect.value) || editableIssues[0];
  const selectedRevision = selectedEditIssue ? String(Number(selectedEditIssue.issueRevision) || 1) : '';
  if (
    elements.issueEditForm.dataset.loadedIssueId !== String(selectedEditIssue?.id || '')
    || elements.issueEditForm.dataset.issueRevision !== selectedRevision
  ) {
    elements.issueEditForm.dataset.loadedIssueId = String(selectedEditIssue?.id || '');
    populateIssueEditForm(selectedEditIssue);
  }
  const issueRadiusRuns = state.spatialAnalyses.filter((run) => run.type !== 'poi-search');
  const poiRuns = state.spatialAnalyses.filter((run) => run.type === 'poi-search');
  elements.spatialAnalysisHistory.innerHTML = issueRadiusRuns.length
    ? issueRadiusRuns.map((run) => `<article class="history-row spatial-history-row${String(run.id) === String(gisViewState.selectedSpatialRunId) ? ' is-selected' : ''}">
        <div><strong>${Number(run.parameters?.radiusMeters) || 0}米半径</strong><span>${run.completedAt ? new Date(run.completedAt).toLocaleString() : '时间未记录'}</span></div>
        <span>中心 ${escapeHtml(run.parameters?.center?.join(', ') || '未记录')}</span>
        <span>命中 ${Number(run.result?.matchedIssueCount) || 0} / 已定位 ${Number(run.sourceSnapshot?.locatedIssueCount) || 0}</span>
        <i class="run-status status-${escapeHtml(run.status || 'completed')}">${run.status === 'stale' ? '已过期' : '已完成'}</i>
        <button type="button" data-spatial-run="${escapeHtml(run.id)}">在地图回放</button>
        ${run.staleReasons?.length ? `<small>${escapeHtml(run.staleReasons.join('、'))}</small>` : ''}
      </article>`).join('')
    : '<p class="workspace-empty">尚未运行空间分析。系统不会自动生成固定500/800/1000米结果。</p>';
  const hasProjectBoundary = Array.isArray(state.activeProject?.scopeBoundary)
    && state.activeProject.scopeBoundary.length >= 3;
  elements.runSpatialAnalysisButton.disabled = !hasProjectBoundary || state.gisLoading;
  elements.runSpatialAnalysisButton.title = hasProjectBoundary
    ? ''
    : '请先在阶段01录入真实项目边界';

  const previousCategory = elements.poiCategorySelect.value;
  const categories = Array.isArray(state.gisConfig?.poiCategories)
    ? state.gisConfig.poiCategories
    : [];
  elements.poiCategorySelect.replaceChildren();
  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category.value;
    option.textContent = category.label;
    elements.poiCategorySelect.append(option);
  }
  if (categories.some((category) => category.value === previousCategory)) {
    elements.poiCategorySelect.value = previousCategory;
  }
  const poiReady = Boolean(state.gisConfig?.poi?.ready);
  const gcjProject = normalizedCrs(state.activeProject?.scopeBoundaryCrs) === 'GCJ02';
  elements.runPoiAnalysisButton.disabled = !poiReady || !hasProjectBoundary || !gcjProject || state.gisLoading;
  elements.runPoiAnalysisButton.title = !poiReady
    ? '请在服务端配置AMAP_WEB_SERVICE_KEY'
    : !gcjProject
      ? '高德POI使用GCJ-02；当前边界需先转换或重新绘制为GCJ-02'
      : !hasProjectBoundary
        ? '请先录入真实项目边界'
        : '';
  elements.poiAnalysisHistory.innerHTML = poiRuns.length
    ? poiRuns.map((run) => `<article>
        <header>
          <strong>${escapeHtml(run.parameters?.categoryLabel || run.parameters?.category || 'POI检索')}</strong>
          <span>${Number(run.parameters?.radiusMeters) || 0}米 · ${escapeHtml(run.providerSnapshot?.provider || '未知Provider')}</span>
          <button type="button" data-poi-map="${escapeHtml(run.id)}">地图显示</button>
        </header>
        <p>原始 ${Number(run.cleaning?.rawCount) || 0} 条 → 清洗合并 ${Number(run.result?.itemCount) || 0} 条 · 规则 ${escapeHtml(run.cleaning?.ruleVersion || '未记录')}${run.parameters?.boundaryOnly ? ' · 已按项目边界裁剪' : ''}${run.status === 'stale' ? ` · 已过期：${escapeHtml((run.staleReasons || []).join('、'))}` : ''}</p>
        ${(run.result?.items || []).some((item) => (item.reviewStatus || 'pending') === 'pending') ? `<div class="poi-batch-actions">
          <button type="button" data-poi-batch="confirmed" data-poi-run="${escapeHtml(run.id)}">批量确认待审核项</button>
          <button type="button" data-poi-batch="excluded" data-poi-run="${escapeHtml(run.id)}">批量排除待审核项</button>
        </div>` : ''}
        <div class="poi-result-chips">${(run.result?.items || []).slice(0, 24).map((item) =>
          `<article class="poi-review-item status-${escapeHtml(item.reviewStatus || 'pending')}">
            <div><strong>${escapeHtml(item.name)}</strong><span>${Math.round(Number(item.distanceMeters) || 0)}m · ${escapeHtml(item.reviewStatus || 'pending')}</span></div>
            <span class="poi-review-actions">
              <button type="button" data-poi-review="confirmed" data-poi-run="${escapeHtml(run.id)}" data-poi-id="${escapeHtml(item.normalizedId)}" data-poi-revision="${Number(item.reviewRevision) || 0}">确认</button>
              <button type="button" data-poi-review="excluded" data-poi-run="${escapeHtml(run.id)}" data-poi-id="${escapeHtml(item.normalizedId)}" data-poi-revision="${Number(item.reviewRevision) || 0}">排除</button>
            </span>
          </article>`
        ).join('') || '<span>本次未发现符合清洗规则的POI</span>'}</div>
        <small>${run.completedAt ? new Date(run.completedAt).toLocaleString() : '时间未记录'} · ${escapeHtml(run.createdBy || '人员未记录')}</small>
      </article>`).join('')
    : `<p class="workspace-empty">${poiReady
      ? '尚未运行POI检索。结果会保存原始POI、查询参数和清洗快照，不会转成指标得分。'
      : '高德Web服务未配置；当前不会生成示例POI。'}</p>`;

  elements.surveyRouteCount.textContent = `${state.surveyRoutes.length} 条路线`;
  const previousRouteAssetId = elements.surveyRouteAssetSelect.value;
  const routeAssets = state.sourceAssets.filter((asset) =>
    asset.status === 'active'
    && asset.uploadStatus === 'completed'
    && /\.(gpx|geojson|json|csv)$/i.test(asset.name || '')
  );
  elements.surveyRouteAssetSelect.innerHTML = '<option value="">手工录入采样点</option>'
    + routeAssets.map((asset) =>
      `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}</option>`
    ).join('');
  if (routeAssets.some((asset) => String(asset.id) === String(previousRouteAssetId))) {
    elements.surveyRouteAssetSelect.value = previousRouteAssetId;
  }
  const { selected: selectedRoute } = findSelectedOrFirst(
    state.surveyRoutes,
    gisViewState.selectedRouteId
  );
  if (selectedRoute && String(selectedRoute.id) !== String(gisViewState.selectedRouteId)) {
    gisViewState.selectedRouteId = String(selectedRoute.id);
  }
  const previousRouteId = elements.surveyRouteSelect.value;
  elements.surveyRouteSelect.innerHTML = state.surveyRoutes.length
    ? state.surveyRoutes.map((route) =>
        `<option value="${escapeHtml(route.id)}">${escapeHtml(route.name)} · ${escapeHtml(route.status)}</option>`
      ).join('')
    : '<option value="">尚无路线</option>';
  const routeSelection = state.surveyRoutes.some((route) =>
    String(route.id) === String(gisViewState.selectedRouteId)
  )
    ? gisViewState.selectedRouteId
    : previousRouteId;
  elements.surveyRouteSelect.value = routeSelection || '';
  const routeActionsDisabled = !selectedRoute || state.gisLoading;
  elements.cleanSurveyRouteButton.disabled = routeActionsDisabled;
  elements.detectSurveyStopsButton.disabled = routeActionsDisabled;
  elements.suggestPhotoBindingsButton.disabled = routeActionsDisabled;
  elements.confirmSurveyRouteButton.disabled = routeActionsDisabled
    || selectedRoute?.status === 'confirmed';
  elements.surveyRouteDetail.innerHTML = selectedRoute
    ? `<article class="route-detail-card">
        <strong>${escapeHtml(selectedRoute.name)}</strong>
        <span>${selectedRoute.geometry?.coordinates?.length || 0} 个轨迹点 · ${escapeHtml(selectedRoute.crs)} · 修订 ${Number(selectedRoute.routeRevision) || 1}</span>
        <span>${selectedRoute.cleaning
          ? `已清洗：保留 ${Number(selectedRoute.cleaning.acceptedPointCount) || 0}，移除 ${Number(selectedRoute.cleaning.removedPointCount) || 0} · ${escapeHtml(selectedRoute.cleaning.ruleVersion)}`
          : '尚未执行路线清洗'}</span>
      </article>`
    : '<p class="workspace-empty">录入真实轨迹采样点后，可进行清洗、停留检测和照片关联。</p>';
  elements.surveyStopList.innerHTML = state.surveyStops.length
    ? `<h3>停留节点</h3>${state.surveyStops.map((stop) =>
        `<article class="route-review-row status-${escapeHtml(stop.status)}">
          <div><strong>${Math.round(Number(stop.durationSeconds) || 0)} 秒停留</strong><span>${escapeHtml(stop.arrivedAt || '时间未记录')} · ${escapeHtml(stop.status)}</span></div>
          ${stop.status === 'candidate' ? `<span>
            <button type="button" data-stop-review="confirmed" data-stop-id="${escapeHtml(stop.id)}" data-stop-revision="${Number(stop.revision) || 1}">确认</button>
            <button type="button" data-stop-review="rejected" data-stop-id="${escapeHtml(stop.id)}" data-stop-revision="${Number(stop.revision) || 1}">排除</button>
          </span>` : ''}
        </article>`
      ).join('')}`
    : '<p class="workspace-empty">当前路线尚无停留节点。</p>';
  elements.photoRouteBindingList.innerHTML = state.photoRouteBindings.length
    ? `<h3>照片路线关联 · 已关联 ${new Set(state.photoRouteBindings.map((binding) => String(binding.photoId))).size} / 当前照片 ${state.photos.length}</h3>${state.photoRouteBindings.map((binding) =>
        `<article class="route-review-row status-${escapeHtml(binding.status)}">
          <div><strong>照片 ${escapeHtml(binding.photoId)}</strong><span>${Math.round(Number(binding.distanceMeters) || 0)}m · 时间差 ${binding.timeDifferenceSeconds == null ? '未知' : `${binding.timeDifferenceSeconds}s`} · ${escapeHtml(binding.status)}${binding.staleReasons?.length ? ` · ${escapeHtml(binding.staleReasons.join('、'))}` : ''}</span></div>
          ${binding.status === 'suggested' ? `<span>
            <button type="button" data-binding-review="confirmed" data-binding-id="${escapeHtml(binding.id)}" data-binding-revision="${Number(binding.revision) || 1}">确认</button>
            <button type="button" data-binding-review="rejected" data-binding-id="${escapeHtml(binding.id)}" data-binding-revision="${Number(binding.revision) || 1}">排除</button>
          </span>` : ''}
        </article>`
      ).join('')}`
    : '<p class="workspace-empty">尚无照片路线关联建议。</p>';

  const previousSnapshotReport = elements.mapSnapshotReportSelect.value;
  elements.mapSnapshotReportSelect.innerHTML = '<option value="">使用当前地图数据</option>'
    + state.reports.map((report) =>
      `<option value="${escapeHtml(report.id)}">V${Number(report.version) || 1} · ${escapeHtml(report.title)}</option>`
    ).join('');
  if (state.reports.some((report) => String(report.id) === String(previousSnapshotReport))) {
    elements.mapSnapshotReportSelect.value = previousSnapshotReport;
  }
  elements.createMapSnapshotButton.disabled = state.gisLoading || !hasProjectBoundary;
  elements.mapSnapshotList.innerHTML = renderMapSnapshotCards(
    state.mapSnapshots,
    state.activeProject?.name || ''
  );
  void syncGisMap(state);
}

function isIndicatorWorkspace(state) {
  const query = new URLSearchParams(location.search);
  return state.selectedStageId === 'indicators' && query.get('view') === 'workspace' && Boolean(state.activeProjectId);
}

function renderIndicator(state) {
  const visible = isIndicatorWorkspace(state);
  elements.indicatorWorkspace.hidden = !visible;
  if (!visible) return;
  elements.indicatorIssueCount.textContent = state.issues.length;
  elements.indicatorLocatedCount.textContent = state.issues.filter(hasIssueGeometry).length;
  elements.indicatorContractStatus.textContent = state.indicatorMeta?.reason || 'indicator_engine_not_integrated';
  const summary = state.standardLibrary?.summary;
  elements.standardIndicatorCount.textContent = summary?.sourceTables?.indicator || 0;
  elements.standardRemediationCount.textContent = summary?.sourceTables?.remediation || 0;
  elements.standardLibrarySummary.textContent = summary
    ? `${summary.name} · ${summary.recordCount} 条记录 · Schema ${summary.schemaVersion}`
    : '标准库不可用。';
  elements.standardIndicatorList.innerHTML = state.standardIndicators.length
    ? state.standardIndicators.map((record) => `<article class="standard-record">
        <span>${escapeHtml(record.code || record.sourceId)}</span>
        <strong>${escapeHtml(record.title)}</strong>
        <small>${escapeHtml(record.payload?.['维度'] || '未分维度')} · ${escapeHtml(record.payload?.['单位'] || '无单位')} · ${record.payload?.['是否核心'] ? '核心指标' : '一般指标'}</small>
      </article>`).join('')
    : '<p class="workspace-empty">没有可展示的标准指标。</p>';
  elements.standardRemediationList.innerHTML = state.standardRemediations.length
    ? state.standardRemediations.map((record) => `<article class="standard-record">
        <span>${escapeHtml(record.payload?.['问题编码'] || record.sourceId)}</span>
        <strong>${escapeHtml(record.payload?.['整治建议'] || '未提供整改建议')}</strong>
        <small>${escapeHtml(record.payload?.['建议类型'] || '未分类')} · ${escapeHtml(record.payload?.['责任单位'] || '责任单位未指定')}</small>
      </article>`).join('')
    : '<p class="workspace-empty">没有可展示的整改建议。</p>';
}

function isReportWorkspace(state) {
  const query = new URLSearchParams(location.search);
  return state.selectedStageId === 'reports' && query.get('view') === 'workspace' && Boolean(state.activeProjectId);
}

function renderReports(state) {
  const visible = isReportWorkspace(state);
  elements.reportWorkspace.hidden = !visible;
  if (!visible) return;
  const sorted = [...state.reports].sort((a, b) => Number(b.version) - Number(a.version));
  const latest = sorted[0];
  elements.reportVersionCount.textContent = state.reports.length;
  elements.reportIssueCount.textContent = state.issues.length;
  const reportStage = stageFromState(state, 'reports');
  elements.createReportButton.disabled = state.reportLoading || !['ready', 'completed'].includes(reportStage.status);
  elements.createReportButton.textContent = state.reportLoading ? '正在生成…' : '生成新版本';
  elements.reportPreview.innerHTML = latest
    ? `<article class="report-snapshot">
        <span>VERSION ${Number(latest.version) || 1} · REV ${Number(latest.reportRevision) || 1}</span>
        <h3>${escapeHtml(latest.title || '未命名报告')}</h3>
        <p>${latest.generatedAt ? new Date(latest.generatedAt).toLocaleString() : '生成时间未记录'} · ${escapeHtml(latest.generatedBy || '操作人员未记录')}</p>
        <div>
          <strong>${Number(latest.dataSnapshot?.officialIssueCount) || 0}<small>正式问题</small></strong>
          <strong>${Number(latest.dataSnapshot?.locatedIssueCount) || 0}<small>已定位</small></strong>
          <strong>${Number(latest.contentSnapshot?.annotatedPhotos?.length) || 0}<small>标注照片</small></strong>
        </div>
        <section class="report-section-index">
          ${(latest.sections || []).map((section) => `<span>${escapeHtml(section.title)} <b>${Number(section.itemCount) || 0}</b></span>`).join('')}
        </section>
        <p class="report-source-summary">来源：${Number(latest.contentSnapshot?.sourceIds?.analysisIds?.length) || 0}次分析 · ${Number(latest.contentSnapshot?.sourceIds?.officialIssueIds?.length) || 0}个正式问题 · ${Number(latest.contentSnapshot?.sourceIds?.spatialAnalysisIds?.length) || 0}次空间分析</p>
      </article>`
    : '<p class="workspace-empty">尚无报告版本。完成阶段03复核后可生成真实数据快照。</p>';
  elements.reportEditForm.hidden = !latest;
  if (latest && elements.reportEditForm.dataset.reportId !== latest.id) {
    elements.reportEditForm.dataset.reportId = latest.id;
    elements.reportEditForm.dataset.reportRevision = String(Number(latest.reportRevision) || 1);
    elements.reportEditForm.elements.title.value = latest.title || '';
    elements.reportEditForm.elements.executiveSummary.value = latest.editorial?.executiveSummary || '';
    elements.reportEditForm.elements.recommendations.value = latest.editorial?.recommendations || '';
    elements.reportEditForm.elements.notes.value = latest.editorial?.notes || '';
    elements.reportEditForm.elements.updatedBy.value = '';
    elements.reportJsonLink.href = `/api/reports/${encodeURIComponent(latest.id)}/json`;
    elements.reportPrintLink.href = `/api/reports/${encodeURIComponent(latest.id)}/print`;
  }
  elements.reportHistoryList.innerHTML = sorted.length
    ? sorted.map((report) => `<article class="history-row">
        <div><strong>V${Number(report.version) || 1} · ${escapeHtml(report.title || '未命名报告')}</strong><span>${report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '时间未记录'}</span></div>
        <span>${Number(report.dataSnapshot?.officialIssueCount) || 0} 个问题</span>
        <span>指标未接入</span>
        <i class="run-status status-${escapeHtml(report.status || 'generated')}">${report.status === 'stale' ? '结果已过期' : '已生成'}</i>
        ${report.status === 'stale' ? `<small>原因：${escapeHtml((report.staleReasons || []).join('、') || '引用数据已变化')}</small>` : ''}
      </article>`).join('')
    : '<p class="workspace-empty">没有已归档的报告快照。</p>';

  const previousBaseId = elements.baseReportSelect.value;
  const previousTargetId = elements.targetReportSelect.value;
  const versionOptions = sorted.map((report) =>
    `<option value="${escapeHtml(report.id)}">V${Number(report.version) || 0} · ${escapeHtml(report.title || report.id)}</option>`
  ).join('');
  elements.baseReportSelect.innerHTML = versionOptions;
  elements.targetReportSelect.innerHTML = versionOptions;
  if (sorted.some((report) => String(report.id) === previousBaseId)) {
    elements.baseReportSelect.value = previousBaseId;
  } else if (sorted.length) {
    elements.baseReportSelect.value = sorted[sorted.length - 1].id;
  }
  if (sorted.some((report) => String(report.id) === previousTargetId)) {
    elements.targetReportSelect.value = previousTargetId;
  } else if (sorted.length) {
    elements.targetReportSelect.value = sorted[0].id;
  }
  const canCompare = sorted.length >= 2;
  elements.baseReportSelect.disabled = !canCompare;
  elements.targetReportSelect.disabled = !canCompare;
  elements.compareReportsButton.disabled = !canCompare || state.reportLoading;

  const comparison = state.reportComparison;
  const diffValue = (value) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
    return escapeHtml(text.length > 260 ? `${text.slice(0, 257)}...` : text);
  };
  if (!comparison) {
    elements.reportComparisonResult.innerHTML = `<p class="workspace-empty">${
      canCompare ? '选择两个报告版本查看内容、指标口径和证据引用差异。' : '至少生成两个报告版本后才能比较。'
    }</p>`;
  } else {
    const fieldChanges = [...comparison.contentChanges, ...comparison.metricChanges];
    const photoChangeIds = [
      ...(comparison.photoChanges?.addedIds || []).map((id) => `新增 ${id}`),
      ...(comparison.photoChanges?.removedIds || []).map((id) => `移除 ${id}`),
      ...(comparison.photoChanges?.changed || []).map((item) => `修订 ${item.id}`)
    ];
    elements.reportComparisonResult.innerHTML = `
      <div class="comparison-summary">
        <article><span>总差异</span><strong>${Number(comparison.summary?.totalChanges) || 0}</strong></article>
        <article><span>内容</span><strong>${Number(comparison.summary?.contentChangeCount) || 0}</strong></article>
        <article><span>数据口径</span><strong>${Number(comparison.summary?.metricChangeCount) || 0}</strong></article>
        <article><span>照片证据</span><strong>${Number(comparison.summary?.photoChangeCount) || 0}</strong></article>
      </div>
      <div class="comparison-version-line">
        <span>V${Number(comparison.base?.version) || 0} ${escapeHtml(comparison.base?.title || '')}</span>
        <b>→</b>
        <span>V${Number(comparison.target?.version) || 0} ${escapeHtml(comparison.target?.title || '')}</span>
      </div>
      <div class="comparison-diff-list">
        ${fieldChanges.length ? fieldChanges.map((item) => `<article>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${diffValue(item.before)}</span>
          <b>→</b>
          <span>${diffValue(item.after)}</span>
        </article>`).join('') : '<p class="workspace-empty">内容和统计口径没有变化。</p>'}
        ${photoChangeIds.length ? `<article><strong>照片证据</strong><span>${escapeHtml(photoChangeIds.join('；'))}</span></article>` : ''}
        ${(comparison.issueChanges?.addedIds?.length || comparison.issueChanges?.removedIds?.length)
          ? `<article><strong>正式问题集合</strong><span>新增 ${escapeHtml((comparison.issueChanges.addedIds || []).join('、') || '无')}；移除 ${escapeHtml((comparison.issueChanges.removedIds || []).join('、') || '无')}</span></article>`
          : ''}
      </div>`;
  }
}

function formatFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '大小未知';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sourceAssetMime(file) {
  const extension = String(file?.name || '').split('.').pop().toLowerCase();
  return {
    pdf: 'application/pdf',
    json: 'application/json',
    geojson: 'application/geo+json',
    csv: 'text/csv',
    db: 'application/vnd.sqlite3',
    sqlite: 'application/vnd.sqlite3',
    sqlite3: 'application/vnd.sqlite3',
    txt: 'text/plain',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    zip: 'application/zip'
  }[extension] || file?.type || 'application/octet-stream';
}

function saveDownloadedFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function parsePhotoBatchCsv(value, photos) {
  const photoMap = new Map(photos.map((photo) => [String(photo.id), photo]));
  const lines = String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines[0] && /^(photoId|照片ID)\s*,/i.test(lines[0])) lines.shift();
  if (!lines.length || lines.length > 200) throw new Error('CSV清单必须包含1到200行数据。');
  const ids = new Set();
  return lines.map((line, index) => {
    const columns = line.split(',').map((item) => item.trim());
    if (columns.length < 3 || columns.length > 4) {
      throw new Error(`第${index + 1}行必须为照片ID,经度,纬度,拍摄时间（可空）。`);
    }
    const [photoId, longitudeText, latitudeText, capturedAt = ''] = columns;
    const photo = photoMap.get(photoId);
    if (!photo) throw new Error(`第${index + 1}行照片 ${photoId || '（空）'} 不在当前项目。`);
    if (ids.has(photoId)) throw new Error(`第${index + 1}行重复出现照片 ${photoId}。`);
    ids.add(photoId);
    const longitude = Number(longitudeText);
    const latitude = Number(latitudeText);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`第${index + 1}行经度无效。`);
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error(`第${index + 1}行纬度无效。`);
    }
    if (capturedAt && Number.isNaN(new Date(capturedAt).getTime())) {
      throw new Error(`第${index + 1}行拍摄时间无效。`);
    }
    return {
      photoId,
      longitude,
      latitude,
      ...(capturedAt ? { capturedAt } : {}),
      expectedRevision: Number(photo.metadataRevision) || 0
    };
  });
}

function renderSourceAssetPreview(outcome) {
  const preview = outcome?.preview || {};
  const columns = Array.isArray(preview.columns) ? preview.columns.slice(0, 8) : [];
  const rows = Array.isArray(preview.rows) ? preview.rows : [];
  let body = '';
  if (String(preview.kind || '').startsWith('geojson-feature')) {
    body = `<div class="preview-summary">
      <span>要素 ${Number(preview.featureCount) || 0}</span>
      <span>几何 ${escapeHtml((preview.geometryTypes || []).join('、') || '无')}</span>
      <span>属性 ${escapeHtml((preview.propertyKeys || []).join('、') || '无')}</span>
    </div>`;
  } else if (columns.length) {
    body = `<div class="source-preview-table"><table>
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(typeof row[column] === 'object' ? JSON.stringify(row[column]) : row[column] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div><small>总行数 ${Number(preview.totalRows) || 0}${preview.truncated ? ' · 当前仅显示前20行' : ''}</small>`;
  } else {
    body = `<div class="preview-summary"><span>结构 ${escapeHtml(preview.kind || 'unknown')}</span><span>字段 ${escapeHtml((preview.keys || []).join('、') || '无')}</span></div>`;
  }
  elements.sourceAssetPreview.innerHTML = `<strong>${escapeHtml(outcome?.asset?.name || outcome?.asset?.id || '资料结构预览')}</strong>${body}`;
}

function renderError(state) {
  elements.errorBanner.hidden = !state.error;
  if (state.error) elements.errorMessage.textContent = `${state.error.message}（${state.error.code}）`;
}

function render(state) {
  const globalView = isOutcomeWorkspace() || isSettingsWorkspace();
  elements.overviewView.hidden = globalView || isCollectionWorkspace(state)
    || isAnalysisWorkspace(state)
    || isReviewWorkspace(state)
    || isGisWorkspace(state)
    || isIndicatorWorkspace(state)
    || isReportWorkspace(state);
  renderProjectSelect(state);
  renderServices(state);
  renderStageRail(state);
  renderStageGrid(state);
  renderProject(state);
  renderMetrics(state);
  renderWorkflowSummary(state);
  renderDetail(state);
  renderCollection(state);
  renderAnalysis(state);
  renderReview(state);
  renderGis(state);
  renderIndicator(state);
  renderReports(state);
  renderOutcomeCenter(state);
  renderSettings(state);
  renderError(state);
  elements.loadingLayer.hidden = !state.loading;
}

async function loadProject(projectId) {
  if (!projectId) {
    store.set({ activeProjectId: '', activeProject: null, summary: null, workflow: null });
    return;
  }
  if (String(store.get().activeProjectId) !== String(projectId)) {
    resetMapControllers();
    if (analysisPollTimer) clearTimeout(analysisPollTimer);
    analysisPollTimer = null;
    if (mapSnapshotPollTimer) clearTimeout(mapSnapshotPollTimer);
    mapSnapshotPollTimer = null;
    store.set({
      photos: [],
      sourceAssets: [],
      fieldTasks: [],
      fieldTaskErrors: [],
      boundaryRevisions: [],
      uploadSessions: [],
      analyses: [],
      analysisJobs: [],
      analysisJobCandidates: [],
      issues: [],
      standardProblemTypes: [],
      spatialAnalyses: [],
      reviewSessions: [],
      reports: []
    });
  }
  store.set({ loading: true, activeProjectId: String(projectId), error: null });
  try {
    const [project, summary, workflow] = await Promise.all([
      api.project(projectId),
      api.summary(projectId),
      api.workflow(projectId)
    ]);
    const requestedStageValue = new URLSearchParams(location.search).get('stage');
    const requestedStage = requestedStageValue === 'gis'
      ? 'gis-and-issues'
      : requestedStageValue;
    store.set({
      activeProject: project,
      summary,
      workflow,
      selectedStageId: stageCatalog.some((item) => item.id === requestedStage) ? requestedStage : workflow?.overall?.currentStage || 'collection'
    });
    if (new URLSearchParams(location.search).get('view') === 'workspace') {
      if (store.get().selectedStageId === 'collection') await loadCollection(projectId);
      if (store.get().selectedStageId === 'ai-analysis') await loadAnalysis(projectId);
      if (store.get().selectedStageId === 'human-review') await loadReview(projectId);
      if (store.get().selectedStageId === 'gis-and-issues') await loadGis(projectId);
      if (store.get().selectedStageId === 'indicators') await loadIndicator(projectId);
      if (store.get().selectedStageId === 'reports') await loadReports(projectId);
    }
  } catch (error) {
    setError(error);
    store.set({ activeProject: null, summary: null, workflow: null });
  } finally {
    store.set({ loading: false });
  }
}

function isOutcomeWorkspace() {
  return new URLSearchParams(location.search).get('view') === 'outcomes';
}

function isSettingsWorkspace() {
  return new URLSearchParams(location.search).get('view') === 'settings';
}

function renderOutcomeCenter(state) {
  const visible = isOutcomeWorkspace();
  elements.outcomeWorkspace.hidden = !visible;
  if (!visible) return;
  const summary = state.outcomeSummary || {};
  const cards = [
    [summary.projectCount, '项目', '可见范围'],
    [summary.issueCount, '正式问题', `高风险 ${summary.highRiskIssueCount || 0}`],
    [summary.staleReportCount, '过期报告', '需重新生成'],
    [summary.unboundIssueCount, '未绑定问题', '可选标准关联'],
    [summary.incompleteCollectionProjectCount, '资料不完整', `建议项 warning ${summary.collectionWarningProjectCount || 0}`]
  ];
  elements.outcomeStatStrip.innerHTML = cards.map(([value, title, note]) => `<article><span>${title}</span><strong>${Number(value) || 0}</strong><small>${escapeHtml(note)}</small></article>`).join('');
  const projects = state.outcomeProjects || [];
  elements.outcomeProjectList.innerHTML = projects.length
    ? `<div class="outcome-table">${projects.map((item) => `<button type="button" class="outcome-row" data-outcome-project="${escapeHtml(item.projectId)}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.area || '区域未记录')} · ${escapeHtml(item.overall?.currentStage || 'collection')}</small></span><span>问题 ${Number(item.counts?.officialIssues) || 0} · 报告 ${Number(item.counts?.reports) || 0}</span><i>${escapeHtml(item.overall?.status || 'unknown')}</i></button>`).join('')}</div>`
    : '<p class="workspace-empty">当前可见范围没有项目记录。</p>';
  const issues = state.outcomeIssues || [];
  const reports = state.outcomeReports || [];
  elements.outcomeRecordList.innerHTML = `<div class="outcome-record-summary"><strong>问题 ${issues.length}</strong><strong>报告 ${reports.length}</strong></div>${issues.slice(0, 8).map((issue) => `<article class="outcome-record"><span class="risk-${escapeHtml(issue.severity || 'medium')}">${escapeHtml(issue.severity || 'unknown')}</span><strong>${escapeHtml(issue.title || issue.id)}</strong><small>${escapeHtml(issue.projectId || '')} · ${escapeHtml(issue.bindingStatus || 'unbound')}</small></article>`).join('')}${!issues.length && !reports.length ? '<p class="workspace-empty">暂无问题或报告索引。</p>' : ''}`;
}

function renderSettings(state) {
  const visible = isSettingsWorkspace();
  elements.settingsWorkspace.hidden = !visible;
  if (!visible) return;
  const providers = state.settingsProviders || {};
  const cloudbase = providers.cloudbase || {};
  elements.settingsProviderPanel.innerHTML = `<div class="settings-list"><p><strong>Repository</strong><span>${escapeHtml(providers.runtime?.repositoryMode || 'unknown')}</span></p><p><strong>对象存储</strong><span>${escapeHtml(providers.runtime?.mapSnapshotStorageMode || 'unknown')}</span></p><p><strong>CloudBase</strong><span>${cloudbase.ready ? '可用' : escapeHtml(cloudbase.reason || '未验证')}</span></p><p><strong>生产验证</strong><span>始终为 false，需完成独立验收</span></p></div>`;
  const external = state.settingsExternalServices || {};
  elements.settingsExternalPanel.innerHTML = `<div class="settings-list"><p><strong>上游</strong><span>${external.upstream?.ready ? '可用' : escapeHtml(external.upstream?.error?.code || '不可用')}</span></p><p><strong>AI</strong><span>${external.ai?.ready ? '可用' : escapeHtml(external.ai?.reason || '未配置')}</span></p><p><strong>GIS</strong><span>${external.gis?.ready ? '可用' : escapeHtml(external.gis?.reason || '未配置')}</span></p></div>`;
  const meta = state.settingsMeta || {};
  elements.settingsMetaPanel.innerHTML = `<div class="settings-list"><p><strong>标准库</strong><span>${escapeHtml(meta.standardLibrary?.name || '未加载')}</span></p><p><strong>版本</strong><span>${escapeHtml(meta.standardLibrary?.schemaVersion || 'unknown')}</span></p><p><strong>记录数</strong><span>${Number(meta.standardLibrary?.recordCount) || 0}</span></p><p><strong>RBAC</strong><span>${meta.security?.enforced ? '已启用' : '本地关闭认证'}</span></p></div>`;
}

async function loadOutcomeCenter() {
  try {
    const [summary, projects, issues, reports] = await Promise.all([
      api.outcomeSummary(), api.outcomeProjects({ limit: 200 }), api.outcomeIssues({ limit: 100 }), api.outcomeReports({ limit: 100 })
    ]);
    store.set({ outcomeSummary: summary, outcomeProjects: projects.items || [], outcomeIssues: issues.items || [], outcomeReports: reports.items || [] });
  } catch (error) { setError(error); }
}

async function loadSettings() {
  try {
    const [settingsMeta, settingsProviders, settingsExternalServices] = await Promise.all([
      api.settingsMeta(), api.settingsProviders(), api.settingsExternalServices()
    ]);
    store.set({ settingsMeta, settingsProviders, settingsExternalServices });
  } catch (error) { setError(error); }
}

async function loadIndicator(projectId = store.get().activeProjectId) {
  if (!projectId) return;
  try {
    const [indicatorMeta, issues, standardLibrary, indicatorResult, remediationResult] = await Promise.all([
      api.indicatorMeta(),
      api.issues(projectId),
      api.standardLibrary(),
      api.standardIndicators(),
      api.standardRemediations()
    ]);
    store.set({
      indicatorMeta,
      issues,
      standardLibrary,
      standardIndicators: indicatorResult.items || [],
      standardRemediations: remediationResult.items || []
    });
  } catch (error) {
    setError(error);
  }
}

async function loadReports(projectId = store.get().activeProjectId) {
  if (!projectId) return;
  store.set({ reportLoading: true });
  try {
    const [reports, issues] = await Promise.all([
      api.reports(projectId),
      api.issues(projectId)
    ]);
    store.set({ reports, issues, reportComparison: null });
  } catch (error) {
    setError(error);
  } finally {
    store.set({ reportLoading: false });
  }
}

function scheduleMapSnapshotPoll() {
  if (mapSnapshotPollTimer) clearTimeout(mapSnapshotPollTimer);
  mapSnapshotPollTimer = null;
  const state = store.get();
  if (!isGisWorkspace(state)) return;
  if (!shouldPollMapSnapshots(state.mapSnapshots)) return;
  mapSnapshotPollTimer = setTimeout(
    () => loadGis(state.activeProjectId, { quiet: true }),
    1000
  );
}

async function loadGis(projectId = store.get().activeProjectId, options = {}) {
  if (!projectId) return;
  if (!options.quiet) store.set({ gisLoading: true });
  try {
    const [
      issues,
      spatialAnalyses,
      mapView,
      surveyRoutes,
      sourceAssets,
      mapSnapshots,
      reports,
      photos,
      standardProblemTypes
    ] = await Promise.all([
      api.issues(projectId),
      api.spatialAnalyses(projectId),
      api.projectMapView(projectId, mapViewQueryFromState(gisViewState, { limit: 2000 })),
      api.surveyRoutes(projectId),
      api.sourceAssets(projectId, false),
      api.mapSnapshots(projectId),
      api.reports(projectId),
      api.photos(projectId, true),
      api.standardProblemTypes()
    ]);
    const routeSelection = findSelectedOrFirst(surveyRoutes, gisViewState.selectedRouteId);
    const selectedRoute = routeSelection.selected;
    gisViewState.selectedRouteId = routeSelection.selectedId;
    const [surveyStops, photoRouteBindings] = selectedRoute
      ? await Promise.all([
          api.surveyStops(selectedRoute.id),
          api.photoRouteBindings(selectedRoute.id)
        ])
      : [[], []];
    if (String(store.get().activeProjectId) !== String(projectId)) return;
    store.set({
      issues,
      spatialAnalyses,
      mapView,
      surveyRoutes,
      surveyStops,
      photoRouteBindings,
      sourceAssets,
      mapSnapshots,
      reports,
      photos,
      standardProblemTypes
    });
  } catch (error) {
    setError(error);
  } finally {
    if (!options.quiet) store.set({ gisLoading: false });
    scheduleMapSnapshotPoll();
  }
}

async function loadReview(projectId = store.get().activeProjectId) {
  if (!projectId) return;
  store.set({ reviewLoading: true });
  try {
    const [photos, analyses, issues, reviewSessions] = await Promise.all([
      api.photos(projectId, true),
      api.analyses(projectId),
      api.issues(projectId),
      api.manualReviews(projectId)
    ]);
    store.set({ photos, analyses, issues, reviewSessions });
  } catch (error) {
    setError(error);
  } finally {
    store.set({ reviewLoading: false });
  }
}

function scheduleAnalysisPoll() {
  if (analysisPollTimer) clearTimeout(analysisPollTimer);
  analysisPollTimer = null;
  const state = store.get();
  if (!isAnalysisWorkspace(state)) return;
  if (!state.analysisJobs.some((job) => ['queued', 'running'].includes(job.status))) return;
  analysisPollTimer = setTimeout(() => loadAnalysis(state.activeProjectId, { quiet: true }), 1500);
}

async function loadAnalysis(projectId = store.get().activeProjectId, options = {}) {
  if (!projectId) return;
  if (!options.quiet) store.set({ analysisLoading: true });
  try {
    const [photos, analyses, analysisJobs, aiConfig] = await Promise.all([
      api.photos(projectId),
      api.analyses(projectId),
      api.analysisJobs(projectId),
      api.aiConfig()
    ]);
    const latestCompletedJob = latestCompletedAnalysisJob(analysisJobs);
    const analysisJobCandidates = latestCompletedJob
      ? await api.analysisJobCandidates(latestCompletedJob.id)
      : [];
    if (String(store.get().activeProjectId) !== String(projectId)) return;
    store.set({ photos, analyses, analysisJobs, analysisJobCandidates, aiConfig });
  } catch (error) {
    setError(error);
  } finally {
    if (!options.quiet) store.set({ analysisLoading: false });
    scheduleAnalysisPoll();
  }
}

async function loadCollection(projectId = store.get().activeProjectId) {
  if (!projectId) return;
  store.set({ collectionLoading: true });
  try {
    const [
      communities,
      residentialDiscoveryRuns,
      fieldProblemTypes,
      photos,
      uploadSessions,
      boundaryRevisions,
      collectionValidation,
      collectionValidationRuns,
      sourceAssets,
      fieldTaskResult
    ] = await Promise.all([
      api.communities(projectId),
      api.residentialDiscoveryRuns(projectId),
      api.fieldProblemTypes(projectId),
      api.photos(projectId, true),
      api.uploadSessions(projectId),
      api.boundaryRevisions(projectId),
      api.collectionValidation(projectId),
      api.collectionValidationRuns(projectId),
      api.sourceAssets(projectId, true),
      api.fieldTasks(projectId)
    ]);
    const buildingEntries = await Promise.all(communities
      .filter((community) => community.status !== 'inactive')
      .map(async (community) => [
      community.id,
      await api.buildings(projectId, community.id)
    ]));
    store.set({
      communities,
      residentialDiscoveryRuns,
      fieldProblemTypes,
      photos,
      uploadSessions,
      boundaryRevisions,
      collectionValidation,
      collectionValidationRuns,
      sourceAssets,
      fieldTasks: fieldTaskResult.items || [],
      fieldTaskErrors: fieldTaskResult.errors || [],
      buildingsByCommunity: Object.fromEntries(buildingEntries)
    });
  } catch (error) {
    setError(error);
  } finally {
    store.set({ collectionLoading: false });
  }
}

function parseBoundaryCoordinates(value) {
  const source = String(value || '').trim();
  if (!source) return [];
  if (source.startsWith('[')) {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) throw new Error('边界JSON必须是坐标数组。');
    return parsed;
  }
  return source.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(/[\s,，]+/).filter(Boolean);
      if (parts.length < 2) throw new Error(`第${index + 1}行缺少经纬度。`);
      return [Number(parts[0]), Number(parts[1])];
    });
}

async function boot() {
  store.set({ loading: true, error: null });
  try {
    const [meta, gisConfig, projects] = await Promise.all([
      api.meta(),
      api.gisConfig(),
      api.projects()
    ]);
    if (!new URLSearchParams(location.search).has('mapStyle')) {
      gisViewState.mapStyle = gisConfig?.policy?.defaultMapStyle || gisViewState.mapStyle;
    }
    store.set({ meta, gisConfig, projects });
    const projectQuery = new URLSearchParams(location.search);
    const queryProject = projectQuery.get('project') || projectQuery.get('projectId');
    const activeProjectId = projects.some((item) => String(item.id) === queryProject)
      ? queryProject
      : projects[0]?.id;
    if (activeProjectId != null) {
      const url = new URL(location.href);
      url.searchParams.set('project', activeProjectId);
      url.searchParams.set('projectId', activeProjectId);
      history.replaceState(null, '', url);
      await loadProject(String(activeProjectId));
    }
    if (projectQuery.get('view') === 'outcomes') await loadOutcomeCenter();
    if (projectQuery.get('view') === 'settings') await loadSettings();
  } catch (error) {
    setError(error);
  } finally {
    store.set({ loading: false });
  }
}

function openProjectDialog() {
  elements.projectForm.reset();
  elements.projectFormError.hidden = true;
  elements.projectFormError.textContent = '';
  elements.projectDialog.showModal();
  requestAnimationFrame(() => elements.projectNameInput.focus());
}

function closeProjectDialog() {
  if (elements.projectDialog.open) elements.projectDialog.close();
}

function upsertUploadSession(session) {
  const current = store.get().uploadSessions.filter((item) => item.id !== session.id);
  store.set({ uploadSessions: [session, ...current] });
}

async function uploadFileWithSession(file) {
  const state = store.get();
  const communityId = elements.uploadCommunitySelect.value;
  const buildingId = elements.uploadBuildingSelect.value;
  const clientRequestId = [
    state.activeProjectId,
    communityId,
    buildingId,
    file.name,
    file.size,
    file.lastModified
  ].join(':').slice(0, 160);
  const created = await api.createUploadSession({
    projectId: state.activeProjectId,
    communityId,
    buildingId,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    clientRequestId
  });
  pendingUploadFiles.set(created.session.id, file);
  upsertUploadSession(created.session);
  try {
    const uploaded = await api.uploadSessionContent(created.session.id, file);
    upsertUploadSession(uploaded.session);
    return uploaded.session;
  } catch (error) {
    const sessions = await api.uploadSessions(state.activeProjectId).catch(() => store.get().uploadSessions);
    store.set({ uploadSessions: sessions });
    throw error;
  }
}

async function submitProject(event) {
  event.preventDefault();
  elements.projectFormError.hidden = true;
  elements.submitProjectButton.disabled = true;
  elements.submitProjectButton.textContent = '正在建立…';
  try {
    const form = new FormData(elements.projectForm);
    const project = await api.createProject({
      name: form.get('name'),
      area: form.get('area'),
      type: form.get('type'),
      scope: form.get('scope'),
      description: form.get('description')
    });
    closeProjectDialog();
    const projects = await api.projects();
    store.set({ projects, activeProjectId: String(project.id), error: null });
    const url = new URL(location.href);
    url.searchParams.set('projectId', project.id);
    url.searchParams.set('project', project.id);
    url.searchParams.set('stage', 'collection');
    history.replaceState(null, '', url);
    await loadProject(project.id);
  } catch (error) {
    elements.projectFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.projectFormError.hidden = false;
  } finally {
    elements.submitProjectButton.disabled = false;
    elements.submitProjectButton.textContent = '建立项目';
  }
}

elements.projectSelect.addEventListener('change', () => {
  const projectId = elements.projectSelect.value;
  const url = new URL(location.href);
  if (projectId) {
    url.searchParams.set('projectId', projectId);
    url.searchParams.set('project', projectId);
  } else {
    url.searchParams.delete('projectId');
    url.searchParams.delete('project');
  }
  history.replaceState(null, '', url);
  loadProject(projectId);
});

elements.refreshButton.addEventListener('click', boot);
elements.createProjectButton.addEventListener('click', openProjectDialog);
elements.closeProjectDialogButton.addEventListener('click', closeProjectDialog);
elements.cancelProjectButton.addEventListener('click', closeProjectDialog);
elements.projectForm.addEventListener('submit', submitProject);
elements.projectDialog.addEventListener('click', (event) => {
  if (event.target === elements.projectDialog) closeProjectDialog();
});

elements.backToOverviewButton.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  render(store.get());
});

elements.backFromAnalysisButton.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  render(store.get());
});

elements.backFromReviewButton.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  render(store.get());
});

elements.backFromGisButton.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  render(store.get());
});

elements.backFromIndicatorButton.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  render(store.get());
});

elements.backFromReportButton.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  render(store.get());
});

elements.refreshCollectionButton.addEventListener('click', () => loadCollection());

elements.collectionValidationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = store.get();
  if (!state.activeProjectId) return;
  elements.collectionValidationFormError.hidden = true;
  store.set({ collectionLoading: true });
  try {
    const form = new FormData(elements.collectionValidationForm);
    await api.validateCollection(state.activeProjectId, {
      validatedBy: form.get('validatedBy')
    });
    const [summary, workflow] = await Promise.all([
      api.summary(state.activeProjectId),
      api.workflow(state.activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadCollection();
  } catch (error) {
    elements.collectionValidationFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.collectionValidationFormError.hidden = false;
  } finally {
    store.set({ collectionLoading: false });
  }
});
elements.photoMetadataSelect.addEventListener('change', () => {
  const state = store.get();
  const photo = state.photos.find((item) => String(item.id) === elements.photoMetadataSelect.value);
  elements.photoMetadataForm.dataset.loadedPhotoId = String(photo?.id || '');
  populatePhotoMetadataForm(state, photo);
});
elements.photoMetadataCommunitySelect.addEventListener('change', () => {
  renderPhotoMetadataBuildingOptions(store.get());
});

elements.photoMetadataForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.photoMetadataForm);
  const photoId = form.get('photoId');
  if (!photoId) return;
  elements.photoMetadataFormError.hidden = true;
  elements.savePhotoMetadataButton.disabled = true;
  const capturedAt = form.get('capturedAt');
  const longitude = form.get('longitude');
  const latitude = form.get('latitude');
  try {
    await api.updatePhotoMetadata(store.get().activeProjectId, photoId, {
      displayName: form.get('displayName'),
      communityId: form.get('communityId'),
      buildingId: form.get('buildingId'),
      longitude,
      latitude,
      clearCoordinates: !longitude && !latitude,
      capturedAt: capturedAt ? new Date(capturedAt).toISOString() : null,
      status: form.get('status'),
      notes: form.get('notes'),
      updatedBy: form.get('updatedBy'),
      expectedRevision: Number(elements.photoMetadataForm.dataset.metadataRevision)
    });
    elements.photoMetadataForm.dataset.loadedPhotoId = '';
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadCollection();
  } catch (error) {
    elements.photoMetadataFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.photoMetadataFormError.hidden = false;
  } finally {
    elements.savePhotoMetadataButton.disabled = false;
  }
});

elements.photoBatchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = store.get();
  const form = new FormData(elements.photoBatchForm);
  elements.photoBatchResult.hidden = true;
  elements.applyPhotoBatchButton.disabled = true;
  store.set({ collectionLoading: true });
  let items = [];
  try {
    items = parsePhotoBatchCsv(form.get('csv'), state.photos);
    const outcome = await api.batchUpdatePhotoMetadata(state.activeProjectId, {
      items,
      updatedBy: form.get('updatedBy')
    });
    const [summary, workflow] = await Promise.all([
      api.summary(state.activeProjectId),
      api.workflow(state.activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadCollection();
    if (outcome.failed) {
      const failedIds = new Set(outcome.results
        .filter((item) => item.status === 'failed')
        .map((item) => String(item.photoId)));
      elements.photoBatchForm.elements.csv.value = items
        .filter((item) => failedIds.has(String(item.photoId)))
        .map((item) => [
          item.photoId,
          item.longitude,
          item.latitude,
          item.capturedAt || ''
        ].join(','))
        .join('\n');
      const failedSummary = outcome.results
        .filter((item) => item.status === 'failed')
        .map((item) => `${item.photoId}: ${item.error?.message || item.error?.code || '失败'}`)
        .join('；');
      elements.photoBatchResult.textContent = `成功 ${outcome.succeeded}/${outcome.total}；失败项已保留在清单中。${failedSummary}`;
    } else {
      elements.photoBatchForm.reset();
      elements.photoBatchResult.textContent = `已批量保存 ${outcome.succeeded} 张照片的治理信息。`;
    }
    elements.photoBatchResult.hidden = false;
  } catch (error) {
    elements.photoBatchResult.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.photoBatchResult.hidden = false;
  } finally {
    elements.applyPhotoBatchButton.disabled = false;
    store.set({ collectionLoading: false });
  }
});

elements.refreshAnalysisButton.addEventListener('click', () => loadAnalysis());
elements.uploadCommunitySelect.addEventListener('change', () => renderUploadBuildingOptions(store.get()));
elements.buildingCommunitySelect.addEventListener('change', () => renderCollection(store.get()));

elements.projectMetadataForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.projectMetadataForm);
  elements.projectMetadataFormError.hidden = true;
  elements.saveProjectMetadataButton.disabled = true;
  try {
    const project = await api.updateProject(store.get().activeProjectId, {
      name: form.get('name'),
      area: form.get('area'),
      type: form.get('type'),
      scope: form.get('scope'),
      description: form.get('description'),
      expectedRevision: Number(elements.projectMetadataForm.dataset.projectRevision)
    });
    elements.projectMetadataForm.dataset.projectRevision = '';
    const [projects, summary, workflow] = await Promise.all([
      api.projects(),
      api.summary(project.id),
      api.workflow(project.id)
    ]);
    store.set({ activeProject: project, projects, summary, workflow });
  } catch (error) {
    elements.projectMetadataFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.projectMetadataFormError.hidden = false;
  } finally {
    elements.saveProjectMetadataButton.disabled = false;
  }
});

elements.boundaryGeocodeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = store.get();
  const form = new FormData(elements.boundaryGeocodeForm);
  elements.boundaryMapError.hidden = true;
  elements.locateBoundaryAddressButton.disabled = true;
  try {
    const result = await api.geocode(state.activeProjectId, {
      city: form.get('city'),
      address: form.get('address')
    });
    const match = result.items?.[0];
    if (!match) {
      throw new Error('高德未返回可用的地址坐标，请补充城市或详细门牌。');
    }
    boundaryMapController?.setCenter(match.coordinates);
    setProviderStatus(
      elements.boundaryMapStatus,
      `已定位：${match.formattedAddress || form.get('address')}（${match.coordinates.join(', ')}，GCJ-02）；该点仅用于定位地图，不会自动生成项目边界。`,
      'ready'
    );
  } catch (error) {
    elements.boundaryMapError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.boundaryMapError.hidden = false;
  } finally {
    elements.locateBoundaryAddressButton.disabled = !store.get().gisConfig?.geocoding?.ready;
  }
});

elements.drawBoundaryButton.addEventListener('click', () => {
  elements.boundaryMapError.hidden = true;
  if (!boundaryMapController) {
    elements.boundaryMapError.textContent = '地图尚未加载完成。';
    elements.boundaryMapError.hidden = false;
    return;
  }
  boundaryMapController.startBoundaryDraw();
  setProviderStatus(elements.boundaryMapStatus, '请在地图上逐点绘制真实项目范围，双击结束。', 'ready');
});

elements.editBoundaryButton.addEventListener('click', () => {
  elements.boundaryMapError.hidden = true;
  if (!boundaryMapController?.startBoundaryEdit()) {
    elements.boundaryMapError.textContent = '当前边界不可编辑；请确认地图已加载且边界为GCJ-02。';
    elements.boundaryMapError.hidden = false;
    return;
  }
  setProviderStatus(
    elements.boundaryMapStatus,
    '边界节点编辑已开启；拖动、增加或删除节点会更新草稿，可撤销或重做，保存前仍由服务端校验。',
    'ready'
  );
});

elements.undoBoundaryButton.addEventListener('click', () => {
  if (!boundaryMapController?.undoBoundaryEdit()) {
    setProviderStatus(elements.boundaryMapStatus, '当前没有可撤销的边界节点操作。', 'warning');
  }
});

elements.redoBoundaryButton.addEventListener('click', () => {
  if (!boundaryMapController?.redoBoundaryEdit()) {
    setProviderStatus(elements.boundaryMapStatus, '当前没有可重做的边界节点操作。', 'warning');
  }
});

elements.finishBoundaryEditButton.addEventListener('click', () => {
  if (boundaryMapController?.finishBoundaryEdit()) {
    setProviderStatus(
      elements.boundaryMapStatus,
      '边界节点编辑已结束，当前草稿已回填；填写更新人员后保存新边界版本。',
      'ready'
    );
  }
});

elements.boundaryRevisionList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-boundary-replay]');
  if (!button) return;
  const revision = store.get().boundaryRevisions.find((item) =>
    Number(item.projectRevision) === Number(button.dataset.boundaryReplay)
  );
  if (!revision) return;
  if (normalizedCrs(revision.crs) !== 'GCJ02') {
    setProviderStatus(
      elements.boundaryMapStatus,
      `历史修订 ${revision.projectRevision} 为${revision.crs || '未知坐标系'}，不叠加到GCJ-02底图；原始记录保持只读。`,
      'warning'
    );
    return;
  }
  boundaryMapController?.setBoundary(revision.geometry || revision.coordinates || []);
  setProviderStatus(
    elements.boundaryMapStatus,
    `正在只读回放边界修订 ${revision.projectRevision}；不会覆盖当前表单或正式边界。`,
    'ready'
  );
});

elements.clearBoundaryDraftButton.addEventListener('click', () => {
  const project = store.get().activeProject;
  const saved = Array.isArray(project?.scopeBoundary) ? project.scopeBoundary : [];
  elements.boundaryCoordinatesInput.value = saved
    .map((point) => `${point[0]},${point[1]}`)
    .join('\n');
  elements.boundaryForm.elements.crs.value = project?.scopeBoundaryCrs || 'WGS84';
  elements.boundaryCoordinatesInput.dataset.revision = String(Number(project?.revision) || 0);
  boundaryMapController?.setBoundary(
    normalizedCrs(project?.scopeBoundaryCrs) === 'GCJ02' ? saved : []
  );
  setProviderStatus(
    elements.boundaryMapStatus,
    saved.length
      ? '绘制草稿已清除，已恢复当前保存边界。'
      : '绘制草稿已清除；项目仍未设置边界。',
    saved.length ? 'ready' : 'warning'
  );
});

elements.boundaryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.boundaryForm);
  elements.boundaryFormError.hidden = true;
  store.set({ collectionLoading: true });
  try {
    const project = await api.updateBoundary(store.get().activeProjectId, {
      coordinates: parseBoundaryCoordinates(form.get('coordinates')),
      crs: form.get('crs'),
      updatedBy: form.get('updatedBy'),
      expectedRevision: store.get().activeProject.revision || 0
    });
    const [summary, workflow] = await Promise.all([
      api.summary(project.id),
      api.workflow(project.id)
    ]);
    store.set({ activeProject: project, summary, workflow });
  } catch (error) {
    elements.boundaryFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.boundaryFormError.hidden = false;
  } finally {
    store.set({ collectionLoading: false });
  }
});

elements.residentialDiscoveryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.residentialDiscoveryForm);
  const radius = String(form.get('radiusMeters') || '').trim();
  elements.residentialDiscoveryFormError.hidden = true;
  store.set({ collectionLoading: true });
  try {
    await api.createResidentialDiscoveryRun(store.get().activeProjectId, {
      createdBy: form.get('createdBy'),
      ...(radius ? { radiusMeters: Number(radius) } : {})
    });
    await loadCollection();
  } catch (error) {
    elements.residentialDiscoveryFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.residentialDiscoveryFormError.hidden = false;
  } finally {
    store.set({ collectionLoading: false });
  }
});

elements.residentialConfirmForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.residentialConfirmForm);
  const candidateIds = [...document.querySelectorAll('[data-residential-candidate]:checked')]
    .map((input) => input.dataset.residentialCandidate);
  elements.residentialDiscoveryFormError.hidden = true;
  if (!candidateIds.length) {
    elements.residentialDiscoveryFormError.textContent = '请至少勾选一个待确认住宅候选。';
    elements.residentialDiscoveryFormError.hidden = false;
    return;
  }
  store.set({ collectionLoading: true });
  try {
    await api.confirmResidentialDiscoveryRun(
      store.get().activeProjectId,
      elements.residentialConfirmForm.dataset.runId,
      {
        candidateIds,
        confirmedBy: form.get('confirmedBy'),
        clientRequestId: crypto.randomUUID(),
        expectedRevision: Number(elements.residentialConfirmForm.dataset.runRevision) || 1
      }
    );
    const project = await api.project(store.get().activeProjectId);
    store.set({ activeProject: project });
    await loadCollection();
  } catch (error) {
    elements.residentialDiscoveryFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.residentialDiscoveryFormError.hidden = false;
  } finally {
    store.set({ collectionLoading: false });
  }
});

elements.mergeCommunitiesButton.addEventListener('click', async () => {
  const state = store.get();
  const communityIds = [...document.querySelectorAll('[data-community-governance-select]:checked')]
    .map((input) => input.dataset.communityGovernanceSelect);
  const mergedBy = elements.communityGovernanceBy.value.trim();
  if (communityIds.length < 2) {
    setError(Object.assign(new Error('请至少选择两个使用中小区。'), { code: 'COMMUNITY_SELECTION_REQUIRED' }));
    return;
  }
  if (!mergedBy) {
    setError(Object.assign(new Error('请填写小区合并人员。'), { code: 'COMMUNITY_ACTOR_REQUIRED' }));
    return;
  }
  elements.mergeCommunitiesButton.disabled = true;
  store.set({ collectionLoading: true });
  try {
    const selected = state.communities.filter((item) => communityIds.includes(String(item.id)));
    await api.mergeCommunities(state.activeProjectId, {
      communityIds,
      targetCommunityId: communityIds[0],
      expectedProjectRevision: Number(state.activeProject?.revision) || 0,
      expectedRevisions: Object.fromEntries(selected.map((item) => [
        item.id,
        Number(item.communityRevision) || 1
      ])),
      referenceStrategy: 'block-if-referenced',
      mergedBy
    });
    const project = await api.project(state.activeProjectId);
    store.set({ activeProject: project });
    await loadCollection();
  } catch (error) {
    setError(error);
  } finally {
    elements.mergeCommunitiesButton.disabled = false;
    store.set({ collectionLoading: false });
  }
});

elements.communityForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.communityForm);
  store.set({ collectionLoading: true });
  try {
    const input = { name: form.get('name'), address: form.get('address') };
    const editingId = elements.communityForm.dataset.editingId;
    if (editingId) {
      await api.updateCommunity(store.get().activeProjectId, editingId, {
        ...input,
        expectedRevision: Number(elements.communityForm.dataset.communityRevision)
      });
    } else {
      await api.addCommunity(store.get().activeProjectId, input);
    }
    elements.communityForm.reset();
    elements.communityForm.dataset.editingId = '';
    elements.communityForm.dataset.communityRevision = '';
    elements.saveCommunityButton.textContent = '保存小区';
    elements.cancelCommunityEditButton.hidden = true;
    const project = await api.project(store.get().activeProjectId);
    store.set({ activeProject: project });
    await loadCollection();
  } catch (error) {
    setError(error);
  } finally {
    store.set({ collectionLoading: false });
  }
});

elements.cancelCommunityEditButton.addEventListener('click', () => {
  elements.communityForm.reset();
  elements.communityForm.dataset.editingId = '';
  elements.communityForm.dataset.communityRevision = '';
  elements.saveCommunityButton.textContent = '保存小区';
  elements.cancelCommunityEditButton.hidden = true;
});

elements.buildingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.buildingForm);
  const communityId = elements.buildingCommunitySelect.value;
  store.set({ collectionLoading: true });
  try {
    const input = {
      name: form.get('name'),
      householdCount: form.get('householdCount'),
      unitCount: form.get('unitCount'),
      floorCount: form.get('floorCount')
    };
    const editingId = elements.buildingForm.dataset.editingId;
    if (editingId) {
      await api.updateBuilding(store.get().activeProjectId, communityId, editingId, {
        ...input,
        expectedRevision: Number(elements.buildingForm.dataset.buildingRevision)
      });
    } else {
      await api.addBuilding(store.get().activeProjectId, communityId, input);
    }
    elements.buildingForm.reset();
    elements.buildingForm.dataset.editingId = '';
    elements.buildingForm.dataset.buildingRevision = '';
    elements.saveBuildingButton.textContent = '保存楼栋';
    elements.cancelBuildingEditButton.hidden = true;
    const project = await api.project(store.get().activeProjectId);
    store.set({ activeProject: project });
    await loadCollection();
  } catch (error) {
    setError(error);
  } finally {
    store.set({ collectionLoading: false });
  }
});

elements.cancelBuildingEditButton.addEventListener('click', () => {
  elements.buildingForm.reset();
  elements.buildingForm.dataset.editingId = '';
  elements.buildingForm.dataset.buildingRevision = '';
  elements.saveBuildingButton.textContent = '保存楼栋';
  elements.cancelBuildingEditButton.hidden = true;
});

elements.photoFileInput.addEventListener('change', () => {
  const files = [...elements.photoFileInput.files];
  elements.uploadSelection.textContent = files.length
    ? `${files.length} 个文件 · ${files.map((file) => file.name).join('、')}`
    : '尚未选择文件';
});

elements.sourceAssetFileInput.addEventListener('change', () => {
  const file = elements.sourceAssetFileInput.files[0];
  pendingSourceAssetRequestId = crypto.randomUUID();
  elements.sourceAssetSelection.textContent = file
    ? `${file.name} · ${formatFileSize(file.size)}`
    : '尚未选择文件';
});

elements.sourceAssetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = elements.sourceAssetFileInput.files[0];
  elements.sourceAssetFormError.hidden = true;
  if (!file) {
    elements.sourceAssetFormError.textContent = '请先选择资料文件。';
    elements.sourceAssetFormError.hidden = false;
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    elements.sourceAssetFormError.textContent = `${file.name} 超过20MB。`;
    elements.sourceAssetFormError.hidden = false;
    return;
  }
  const state = store.get();
  if (!state.activeProjectId) return;
  const form = new FormData(elements.sourceAssetForm);
  elements.uploadSourceAssetButton.disabled = true;
  store.set({ collectionLoading: true });
  try {
    const mimeType = sourceAssetMime(file);
    const category = String(form.get('category') || 'other');
    const communityId = String(form.get('communityId') || '');
    const recoverableAsset = state.sourceAssets.find((item) =>
      !['completed', 'duplicate'].includes(item.uploadStatus)
      && item.name === file.name
      && Number(item.size) === file.size
      && item.mimeType === mimeType
      && item.category === category
      && String(item.communityId || '') === communityId
    );
    const asset = recoverableAsset || await api.createSourceAsset(state.activeProjectId, {
      name: file.name,
      mimeType,
      size: file.size,
      category,
      communityId,
      notes: form.get('notes'),
      createdBy: form.get('createdBy'),
      clientRequestId: pendingSourceAssetRequestId
    });
    const uploadedAsset = await api.uploadSourceAssetContent(asset.id, file, mimeType);
    elements.sourceAssetForm.reset();
    elements.sourceAssetSelection.textContent = '尚未选择文件';
    pendingSourceAssetRequestId = crypto.randomUUID();
    const [summary, workflow] = await Promise.all([
      api.summary(state.activeProjectId),
      api.workflow(state.activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadCollection();
    if (uploadedAsset.uploadStatus === 'duplicate') {
      elements.sourceAssetFormError.textContent = `文件内容已存在，系统未重复保存二进制；重复记录引用 ${uploadedAsset.duplicateOf}。`;
      elements.sourceAssetFormError.hidden = false;
    }
  } catch (error) {
    elements.sourceAssetFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.sourceAssetFormError.hidden = false;
  } finally {
    elements.uploadSourceAssetButton.disabled = false;
    store.set({ collectionLoading: false });
  }
});

elements.fieldTaskCommunitySelect.addEventListener('change', () => {
  renderFieldTaskBuildingOptions(store.get());
});

elements.fieldTaskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = store.get();
  const form = new FormData(elements.fieldTaskForm);
  elements.fieldTaskFormError.hidden = true;
  elements.createFieldTaskButton.disabled = true;
  try {
    await api.createFieldTask(state.activeProjectId, {
      clientTaskId: form.get('clientTaskId'),
      communityId: form.get('communityId'),
      buildingId: form.get('buildingId'),
      problemCode: form.get('problemCode'),
      photoCount: Number(form.get('photoCount')) || 0,
      buildingCount: form.get('buildingCount'),
      householdCount: form.get('householdCount'),
      capturedAt: form.get('capturedAt'),
      location: form.get('location'),
      description: form.get('description'),
      collectorId: form.get('collectorId')
    });
    elements.fieldTaskForm.reset();
    await loadCollection();
  } catch (error) {
    elements.fieldTaskFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.fieldTaskFormError.hidden = false;
  } finally {
    elements.createFieldTaskButton.disabled = false;
  }
});

elements.photoUploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const files = [...elements.photoFileInput.files];
  elements.photoUploadError.hidden = true;
  if (!files.length) {
    elements.photoUploadError.textContent = '请先选择照片。';
    elements.photoUploadError.hidden = false;
    return;
  }
  const oversized = files.find((file) => file.size > 12 * 1024 * 1024);
  if (oversized) {
    elements.photoUploadError.textContent = `${oversized.name} 超过12MB。`;
    elements.photoUploadError.hidden = false;
    return;
  }

  store.set({ collectionLoading: true });
  elements.uploadPhotosButton.disabled = true;
  const failures = [];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      elements.uploadPhotosButton.textContent = `正在上传 ${index + 1}/${files.length}`;
      try {
        await uploadFileWithSession(file);
      } catch (error) {
        failures.push({ file, error });
      }
    }
    elements.photoUploadForm.reset();
    elements.uploadSelection.textContent = '尚未选择文件';
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadCollection();
    if (failures.length) {
      elements.photoUploadError.textContent = `${failures.length}个文件上传失败，失败会话已保留，可重新选择同一文件后重试。`;
      elements.photoUploadError.hidden = false;
    }
  } catch (error) {
    elements.photoUploadError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.photoUploadError.hidden = false;
  } finally {
    store.set({ collectionLoading: false });
    elements.uploadPhotosButton.disabled = false;
    elements.uploadPhotosButton.textContent = '上传并归档';
  }
});

elements.aiConfigForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.aiConfigForm);
  const apiKey = String(form.get('apiKey') || '').trim();
  elements.aiConfigFormError.hidden = true;
  elements.saveAiConfigButton.disabled = true;
  try {
    let revision = Number(elements.aiConfigForm.dataset.revision) || 0;
    if (apiKey) {
      const configured = await api.setAiKey({ apiKey, expectedRevision: revision });
      revision = configured.revision;
    }
    await api.updateAiPreferences({
      model: form.get('model'),
      timeoutMs: Number(form.get('timeoutMs')),
      maxImagesPerBatch: Number(form.get('maxImagesPerBatch')),
      expectedRevision: revision
    });
    await loadAnalysis();
  } catch (error) {
    elements.aiConfigFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.aiConfigFormError.hidden = false;
  } finally {
    elements.saveAiConfigButton.disabled = false;
  }
});

elements.checkAiConfigButton.addEventListener('click', async () => {
  elements.aiConfigFormError.hidden = true;
  elements.checkAiConfigButton.disabled = true;
  try {
    const result = await api.checkAiConfig();
    elements.aiConfigStatus.textContent = `健康检查通过 · ${result.model}`;
  } catch (error) {
    elements.aiConfigFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.aiConfigFormError.hidden = false;
  } finally {
    elements.checkAiConfigButton.disabled = false;
  }
});

elements.analysisForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.analysisForm);
  const photoIds = form.getAll('photoIds');
  elements.analysisFormError.hidden = true;
  if (!photoIds.length) {
    elements.analysisFormError.textContent = '请至少选择一张真实照片。';
    elements.analysisFormError.hidden = false;
    return;
  }
  store.set({ analysisSubmitting: true });
  try {
    await api.createAnalysisJob(store.get().activeProjectId, {
      photoIds,
      analysisType: form.get('analysisType'),
      description: form.get('description'),
      clientRequestId: crypto.randomUUID()
    });
    await loadAnalysis();
  } catch (error) {
    elements.analysisFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.analysisFormError.hidden = false;
  } finally {
    store.set({ analysisSubmitting: false });
  }
});

elements.analysisHistoryList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-analysis-job-action]');
  if (!button) return;
  const jobId = button.dataset.analysisJobId;
  button.disabled = true;
  elements.analysisFormError.hidden = true;
  try {
    if (button.dataset.analysisJobAction === 'retry') await api.retryAnalysisJob(jobId);
    if (button.dataset.analysisJobAction === 'cancel') await api.cancelAnalysisJob(jobId);
    await loadAnalysis();
  } catch (error) {
    elements.analysisFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.analysisFormError.hidden = false;
    button.disabled = false;
  }
});

function buildReviewDecisions(form, candidates) {
  return candidates.map((candidate) => {
    const changes = {};
    const edited = {
      title: form.get(`candidateTitle:${candidate.id}`),
      severity: form.get(`candidateSeverity:${candidate.id}`),
      desc: form.get(`candidateDesc:${candidate.id}`),
      evidence: form.get(`candidateEvidence:${candidate.id}`)
    };
    for (const [field, value] of Object.entries(edited)) {
      if (value !== null && String(value) !== String(candidate[field] ?? '')) changes[field] = value;
    }
    return {
      candidateId: candidate.id,
      status: form.get(`decision:${candidate.id}`) || candidate.reviewStatus || 'pending',
      ...(Object.keys(changes).length ? { changes } : {})
    };
  });
}

function candidatesAfterDecisions(candidates, decisions) {
  const byId = new Map(decisions.map((decision) => [String(decision.candidateId), decision]));
  return candidates.map((candidate) => {
    const decision = byId.get(String(candidate.id));
    const status = decision?.status === 'rejected' ? 'excluded' : decision?.status || 'pending';
    return { ...candidate, ...(decision?.changes || {}), reviewStatus: status };
  });
}

function sourcePhotoIdForReviewCandidate(candidate, analysis) {
  const imageIndex = Math.max(1, Math.trunc(Number(candidate?.imageIndex) || 1));
  return String(candidate?.photoId || analysis?.photoIds?.[imageIndex - 1] || '');
}

async function annotationRequestId(analysis, sourcePhotoId, candidates) {
  const signature = [
    analysis.id,
    sourcePhotoId,
    ...candidates.map((candidate) => `${candidate.id}:${Number(candidate.candidateRevision) || 1}`)
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature));
  const hash = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `review-annotation:${hash}`;
}

async function archiveReviewAnnotations(state, analysis, reviewedCandidates, reviewerName) {
  const accepted = reviewedCandidates.filter((candidate) =>
    ['accepted', 'modified'].includes(candidate.reviewStatus) && normalizeBbox(candidate.bbox)
  );
  const grouped = new Map();
  for (const candidate of accepted) {
    const sourcePhotoId = sourcePhotoIdForReviewCandidate(candidate, analysis);
    if (!sourcePhotoId) continue;
    if (!grouped.has(sourcePhotoId)) grouped.set(sourcePhotoId, []);
    grouped.get(sourcePhotoId).push(candidate);
  }

  const annotatedPhotos = [];
  for (const [sourcePhotoId, candidates] of grouped) {
    const photo = state.photos.find((item) => String(item.id) === sourcePhotoId);
    if (!photo) throw new Error(`找不到原始照片 ${sourcePhotoId}，无法生成标注图。`);
    const file = await createAnnotatedImageFile(photo, candidates);
    const imageIndex = Math.max(1, Math.trunc(Number(candidates[0].imageIndex) || 1));
    const created = await api.createUploadSession({
      projectId: state.activeProjectId,
      communityId: photo.communityId || candidates[0].communityId || analysis.communityId,
      buildingId: photo.buildingId || candidates[0].buildingId || analysis.buildingId || '',
      name: file.name,
      mimeType: file.type,
      size: file.size,
      lastModified: file.lastModified,
      clientRequestId: await annotationRequestId(analysis, sourcePhotoId, candidates),
      kind: 'annotated',
      analysisId: analysis.id,
      sourcePhotoId,
      candidateIds: candidates.map((candidate) => candidate.id),
      imageIndex,
      createdBy: reviewerName
    });
    const uploaded = await api.uploadSessionContent(created.session.id, file);
    annotatedPhotos.push({
      sourcePhotoId,
      annotatedPhotoId: uploaded.session.photoId,
      uploadSessionId: uploaded.session.id,
      candidateIds: candidates.map((candidate) => candidate.id)
    });
  }
  return annotatedPhotos;
}

elements.reviewRiskFilter.addEventListener('change', () => {
  reviewRiskFilter = elements.reviewRiskFilter.value;
  renderReview(store.get());
});

elements.acceptVisibleCandidatesButton.addEventListener('click', async () => {
  const state = store.get();
  const analysis = activeReviewAnalysis(state.analyses);
  if (!analysis || analysis.status === 'archived') return;
  const reviewerName = new FormData(elements.reviewForm).get('reviewerName')?.trim();
  elements.reviewFormError.hidden = true;
  if (!reviewerName) {
    elements.reviewFormError.textContent = '批量接受前，请先填写复核人员。';
    elements.reviewFormError.hidden = false;
    elements.reviewForm.elements.reviewerName.focus();
    return;
  }
  const candidates = candidatesFromAnalysis(analysis).filter((candidate) =>
    (reviewRiskFilter === 'all' || candidate.severity === reviewRiskFilter)
    && (!candidate.reviewStatus || candidate.reviewStatus === 'pending')
  );
  if (!candidates.length) return;

  store.set({ reviewLoading: true });
  try {
    for (const candidate of candidates) {
      await api.updateAnalysisCandidate(candidate.id, {
        analysisId: analysis.id,
        projectId: state.activeProjectId,
        reviewStatus: 'accepted',
        changes: {},
        updatedBy: reviewerName,
        expectedRevision: Number(candidate.candidateRevision) || 1
      });
    }
    await loadReview();
  } catch (error) {
    elements.reviewFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.reviewFormError.hidden = false;
  } finally {
    store.set({ reviewLoading: false });
  }
});

elements.reviewForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = store.get();
  const analysis = activeReviewAnalysis(state.analyses);
  if (!analysis || analysis.status === 'archived') return;
  const form = new FormData(elements.reviewForm);
  const candidates = candidatesFromAnalysis(analysis);
  const decisions = buildReviewDecisions(form, candidates);
  const reviewedCandidates = candidatesAfterDecisions(candidates, decisions);
  const pendingCandidates = reviewedCandidates.filter((candidate) => candidate.reviewStatus === 'pending');
  elements.reviewFormError.hidden = true;
  if (pendingCandidates.length) {
    elements.reviewFormError.textContent = `仍有${pendingCandidates.length}个候选问题待复核。`;
    elements.reviewFormError.hidden = false;
    return;
  }
  elements.finalizeReviewButton.disabled = true;
  elements.finalizeReviewButton.textContent = '正在生成标注图并归档…';
  elements.acceptVisibleCandidatesButton.disabled = true;
  try {
    const annotatedPhotos = await archiveReviewAnnotations(
      state,
      analysis,
      reviewedCandidates,
      form.get('reviewerName')
    );
    await api.finalizeReview(analysis.id, {
      reviewerName: form.get('reviewerName'),
      decisions,
      annotatedPhotos
    });
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadReview();
  } catch (error) {
    elements.reviewFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.reviewFormError.hidden = false;
  } finally {
    const current = activeReviewAnalysis(store.get().analyses);
    const archived = current?.status === 'archived';
    const hasVisiblePending = candidatesFromAnalysis(current).some((candidate) =>
      (reviewRiskFilter === 'all' || candidate.severity === reviewRiskFilter)
      && (!candidate.reviewStatus || candidate.reviewStatus === 'pending')
    );
    elements.finalizeReviewButton.disabled = !current || archived;
    elements.finalizeReviewButton.textContent = archived ? '本批次已归档' : '完成复核并归档';
    elements.acceptVisibleCandidatesButton.disabled = !current || archived || !hasVisiblePending;
  }
});

elements.manualIssueForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.manualIssueForm);
  elements.manualIssueFormError.hidden = true;
  elements.createManualIssueButton.disabled = true;
  try {
    await api.createManualIssue(store.get().activeProjectId, {
      title: form.get('title'),
      severity: form.get('severity'),
      categoryName: form.get('categoryName'),
      originalPhotoId: form.get('originalPhotoId'),
      description: form.get('description'),
      evidence: form.get('evidence'),
      suggestion: form.get('suggestion'),
      recordedBy: form.get('recordedBy')
    });
    elements.manualIssueForm.reset();
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadReview();
  } catch (error) {
    elements.manualIssueFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.manualIssueFormError.hidden = false;
  } finally {
    elements.createManualIssueButton.disabled = false;
  }
});

elements.manualReviewForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.manualReviewForm);
  elements.manualReviewFormError.hidden = true;
  elements.finalizeManualReviewButton.disabled = true;
  try {
    await api.finalizeManualReview(store.get().activeProjectId, {
      reviewerName: form.get('reviewerName'),
      notes: form.get('notes'),
      zeroIssueConfirmed: form.get('zeroIssueConfirmed') === 'on',
      clientRequestId: crypto.randomUUID()
    });
    elements.manualReviewForm.reset();
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadReview();
  } catch (error) {
    elements.manualReviewFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.manualReviewFormError.hidden = false;
  } finally {
    elements.finalizeManualReviewButton.disabled = false;
  }
});

function persistGisDisplayState() {
  const query = new URLSearchParams(location.search);
  if (gisViewState.selectedIssueId) query.set('issue', gisViewState.selectedIssueId);
  else query.delete('issue');
  if (gisViewState.selectedSpatialRunId) query.set('run', gisViewState.selectedSpatialRunId);
  else query.delete('run');
  if (gisViewState.selectedRouteId) query.set('route', gisViewState.selectedRouteId);
  else query.delete('route');
  query.set('mapStyle', gisViewState.mapStyle);
  query.set('layers', serializeGisLayerSelection(gisViewState.visibleLayers));
  try {
    localStorage.setItem('urban-health-business:gis-display-preference', JSON.stringify({
      mapStyle: gisViewState.mapStyle,
      visibleLayers: gisViewState.visibleLayers
    }));
  } catch {
    // 浏览器禁用本地存储时，URL仍是页面偏好的可恢复来源。
  }
  history.replaceState(null, '', `${location.pathname}?${query}${location.hash}`);
}

function applyGisFiltersFromControls() {
  gisViewState.filters = {
    ...gisViewState.filters,
    search: elements.gisIssueSearch.value,
    issueRisk: elements.gisRiskFilter.value,
    issueType: elements.gisTypeFilter.value,
    issueStatus: elements.gisStatusFilter.value,
    bindingStatus: elements.gisBindingFilter.value,
    staleStatus: elements.gisStaleFilter.value
  };
  renderGis(store.get());
  syncGisMap(store.get());
  if (gisFilterTimer) clearTimeout(gisFilterTimer);
  const projectId = String(store.get().activeProjectId || '');
  gisFilterTimer = setTimeout(async () => {
    try {
      const mapView = await api.projectMapView(
        projectId,
        mapViewQueryFromState(gisViewState, {
          bounds: gisViewState.viewport?.bounds,
          limit: 2000
        })
      );
      if (String(store.get().activeProjectId || '') === projectId) store.set({ mapView });
    } catch (error) {
      setProviderStatus(elements.gisMapStatus, `筛选地图数据失败：${error.message}`, 'warning');
    }
  }, 250);
}

elements.gisIssueSearch.addEventListener('input', applyGisFiltersFromControls);
elements.gisRiskFilter.addEventListener('change', applyGisFiltersFromControls);
elements.gisTypeFilter.addEventListener('change', applyGisFiltersFromControls);
elements.gisStatusFilter.addEventListener('change', applyGisFiltersFromControls);
elements.gisBindingFilter.addEventListener('change', applyGisFiltersFromControls);
elements.gisStaleFilter.addEventListener('change', applyGisFiltersFromControls);

elements.gisIssueList.addEventListener('click', (event) => {
  const row = event.target.closest('[data-gis-issue-id]');
  if (!row) return;
  const issueId = row.dataset.gisIssueId;
  const issue = store.get().issues.find((item) => String(item.id) === String(issueId));
  if (!issue) return;
  gisViewState.selectedIssueId = issueId;
  elements.geometryIssueSelect.value = issueId;
  elements.issueEditSelect.value = issueId;
  populateIssueEditForm(issue);
  renderGeometryAudit(issue);
  elements.geometryIssueSelect.dispatchEvent(new Event('change'));
  gisMapController?.setSelectedIssue(issueId);
  persistGisDisplayState();
  renderGis(store.get());
});

elements.gisMapStyle.addEventListener('change', () => {
  gisViewState.mapStyle = elements.gisMapStyle.value;
  gisMapController?.setMapStyle(gisViewState.mapStyle);
  persistGisDisplayState();
});

elements.gisLayerControl.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('[data-gis-layer]');
  if (!checkbox) return;
  const layer = checkbox.dataset.gisLayer;
  gisViewState.visibleLayers = {
    ...gisViewState.visibleLayers,
    [layer]: checkbox.checked
  };
  gisMapController?.setLayerVisibility(layer, checkbox.checked);
  persistGisDisplayState();
  renderGis(store.get());
  if (['photos', 'manualPhotos', 'routes', 'stops', 'boundaryHistory'].includes(layer)
    && checkbox.checked) {
    try {
      const mapView = await api.projectMapView(
        store.get().activeProjectId,
        mapViewQueryFromState(gisViewState, { limit: 2000 })
      );
      store.set({ mapView });
    } catch (error) {
      setError(error);
    }
  }
});

elements.gisShowListButton.addEventListener('click', () => {
  gisViewState.mobilePane = 'list';
  renderGis(store.get());
});

elements.gisShowMapButton.addEventListener('click', () => {
  gisViewState.mobilePane = 'map';
  renderGis(store.get());
  setTimeout(() => gisMapController?.resize(), 0);
});

elements.gisFitVisibleButton.addEventListener('click', () => {
  gisMapController?.fitVisible();
});

elements.gisFullscreenButton.addEventListener('click', async () => {
  const stage = elements.gisMapCanvas.closest('.provider-map-stage');
  if (!stage) return;
  if (document.fullscreenElement) await document.exitFullscreen();
  else await stage.requestFullscreen();
  setTimeout(() => gisMapController?.resize(), 0);
});

elements.gisMeasureDistanceButton.addEventListener('click', () => {
  if (!gisMapController?.startDistanceMeasure()) {
    setProviderStatus(elements.gisMapStatus, '当前地图运行时不支持距离测量。', 'warning');
  }
});

elements.gisMeasureAreaButton.addEventListener('click', () => {
  if (!gisMapController?.startAreaMeasure()) {
    setProviderStatus(elements.gisMapStatus, '当前地图运行时不支持面积测量。', 'warning');
  }
});

elements.gisClearMeasureButton.addEventListener('click', () => {
  gisMapController?.clearMeasurements();
});

elements.gisPrepareDisplayButton.addEventListener('click', async () => {
  const transformedBy = elements.gisTransformOperator.value.trim();
  elements.gisMapError.hidden = true;
  if (!transformedBy) {
    elements.gisMapError.textContent = '请填写坐标转换操作人员。';
    elements.gisMapError.hidden = false;
    return;
  }
  elements.gisPrepareDisplayButton.disabled = true;
  try {
    const outcome = await api.ensureProjectDisplayTransforms(store.get().activeProjectId, {
      transformedBy,
      limit: 500
    });
    setProviderStatus(
      elements.gisMapStatus,
      `已生成 ${outcome.createdCount} 条可追溯显示坐标记录${outcome.pendingInCurrentWindow ? `，当前窗口仍有 ${outcome.pendingInCurrentWindow} 条待处理` : ''}。`,
      'ready'
    );
    await loadGis();
  } catch (error) {
    elements.gisMapError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.gisMapError.hidden = false;
  } finally {
    elements.gisPrepareDisplayButton.disabled = false;
  }
});

elements.geometryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.geometryForm);
  const issue = store.get().issues.find((item) => String(item.id) === String(form.get('issueId')));
  elements.geometryFormError.hidden = true;
  store.set({ gisLoading: true });
  try {
    await api.updateIssueGeometry(form.get('issueId'), {
      longitude: form.get('longitude'),
      latitude: form.get('latitude'),
      crs: form.get('crs'),
      confirmedBy: form.get('confirmedBy'),
      expectedGeometryRevision: Number(issue?.geometryRevision) || 0
    });
    gisViewState.geometryDraft = null;
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadGis();
  } catch (error) {
    elements.geometryFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.geometryFormError.hidden = false;
    gisViewState.geometryDraft = null;
    populateIssueGeometryForm(issue);
    restoreGeometryMapFromServer();
  } finally {
    store.set({ gisLoading: false });
  }
});

elements.geometryBatchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.geometryBatchForm);
  elements.geometryBatchFormError.hidden = true;
  elements.geometryBatchSubmitButton.disabled = true;
  try {
    const items = parseIssueGeometryBatch(
      form.get('rows'),
      store.get().issues,
      store.get().activeProject?.scopeBoundaryCrs || 'WGS84'
    );
    const outcome = await api.batchConfirmIssueGeometry(store.get().activeProjectId, {
      confirmedBy: form.get('confirmedBy'),
      items
    });
    const failed = (outcome.results || []).filter((item) => item.status === 'failed');
    await loadGis();
    if (failed.length) {
      elements.geometryBatchFormError.textContent = `批量处理完成，但有${failed.length}项失败：${failed
        .slice(0, 3)
        .map((item) => `${item.issueId} ${item.error?.message || ''}`)
        .join('；')}`;
      elements.geometryBatchFormError.hidden = false;
    } else {
      elements.geometryBatchForm.reset();
    }
  } catch (error) {
    elements.geometryBatchFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.geometryBatchFormError.hidden = false;
  } finally {
    elements.geometryBatchSubmitButton.disabled = false;
  }
});

elements.geometryIssueSelect.addEventListener('change', () => {
  const issue = store.get().issues
    .find((item) => String(item.id) === elements.geometryIssueSelect.value);
  gisViewState.geometryDraft = null;
  populateIssueGeometryForm(issue);
  gisViewState.selectedIssueId = issue?.id || '';
  gisMapController?.setSelectedIssue(gisViewState.selectedIssueId);
  persistGisDisplayState();
  renderGeometryAudit(issue);
});

elements.gisPointTarget.addEventListener('change', () => {
  if (elements.gisPointTarget.value !== 'photo') return;
  gisViewState.visibleLayers = { ...gisViewState.visibleLayers, photos: true };
  const checkbox = elements.gisLayerControl.querySelector('[data-gis-layer="photos"]');
  if (checkbox) checkbox.checked = true;
  gisMapController?.setLayerVisibility('photos', true);
  persistGisDisplayState();
});

elements.photoGeometrySelect.addEventListener('change', () => {
  const photo = store.get().photos.find((item) =>
    String(item.id) === String(elements.photoGeometrySelect.value)
  );
  gisViewState.selectedPhotoId = photo?.id || '';
  gisViewState.geometryDraft = null;
  populatePhotoGeometryForm(photo);
});

function restoreGeometryMapFromServer() {
  if (!gisMapController || !store.get().mapView) return;
  gisMapController.setMapView(store.get().mapView);
  gisMapController.setSelectedIssue(gisViewState.selectedIssueId);
  applyGisLayerVisibility(gisMapController, gisViewState.visibleLayers);
}

elements.cancelGeometryDraftButton.addEventListener('click', () => {
  const issue = store.get().issues.find((item) =>
    String(item.id) === String(elements.geometryIssueSelect.value)
  );
  gisViewState.geometryDraft = null;
  populateIssueGeometryForm(issue);
  restoreGeometryMapFromServer();
});

elements.cancelPhotoGeometryDraftButton.addEventListener('click', () => {
  const photo = store.get().photos.find((item) =>
    String(item.id) === String(elements.photoGeometrySelect.value)
  );
  gisViewState.geometryDraft = null;
  populatePhotoGeometryForm(photo);
  restoreGeometryMapFromServer();
});

elements.photoGeometryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.photoGeometryForm);
  const photo = store.get().photos.find((item) => String(item.id) === String(form.get('photoId')));
  if (!photo) return;
  elements.photoGeometryFormError.hidden = true;
  elements.savePhotoGeometryButton.disabled = true;
  try {
    await api.updatePhotoGeometry(store.get().activeProjectId, photo.id, {
      longitude: form.get('longitude'),
      latitude: form.get('latitude'),
      coordinateCrs: form.get('coordinateCrs'),
      updatedBy: form.get('updatedBy'),
      expectedRevision: Number(photo.metadataRevision) || 0
    });
    gisViewState.geometryDraft = null;
    await loadGis();
  } catch (error) {
    elements.photoGeometryFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.photoGeometryFormError.hidden = false;
    gisViewState.geometryDraft = null;
    populatePhotoGeometryForm(photo);
    restoreGeometryMapFromServer();
  } finally {
    elements.savePhotoGeometryButton.disabled = false;
  }
});

elements.spatialPreview.addEventListener('click', (event) => {
  const svg = event.target.closest('svg[data-spatial-clickable="true"]');
  if (!svg || elements.geometryIssueSelect.disabled || !elements.geometryIssueSelect.value) return;
  const bounds = svg.getBoundingClientRect();
  const viewX = ((event.clientX - bounds.left) / bounds.width) * 600;
  const viewY = ((event.clientY - bounds.top) / bounds.height) * 300;
  if (viewX < 30 || viewX > 570 || viewY < 30 || viewY > 270) return;
  const minLon = Number(svg.dataset.minLon);
  const maxLon = Number(svg.dataset.maxLon);
  const minLat = Number(svg.dataset.minLat);
  const maxLat = Number(svg.dataset.maxLat);
  const point = [
    minLon + ((viewX - 30) / 540) * Math.max(maxLon - minLon, 0.001),
    minLat + ((270 - viewY) / 240) * Math.max(maxLat - minLat, 0.001)
  ];
  const boundary = Array.isArray(store.get().activeProject?.scopeBoundary)
    ? store.get().activeProject.scopeBoundary
    : [];
  elements.geometryFormError.hidden = true;
  if (!pointInsideBoundary(point, boundary)) {
    elements.geometryFormError.textContent = '点击位置在项目边界之外，请点击边界面内部。';
    elements.geometryFormError.hidden = false;
    return;
  }
  const issue = store.get().issues.find((item) =>
    String(item.id) === String(elements.geometryIssueSelect.value)
  );
  showIssueGeometryDraft(
    issue,
    [Number(point[0].toFixed(7)), Number(point[1].toFixed(7))],
    store.get().activeProject?.scopeBoundaryCrs || 'WGS84'
  );
});

elements.issueEditSelect.addEventListener('change', () => {
  const issue = store.get().issues.find((item) => String(item.id) === elements.issueEditSelect.value);
  elements.issueEditForm.dataset.loadedIssueId = String(issue?.id || '');
  populateIssueEditForm(issue);
});

elements.issueBindingStatusSelect.addEventListener('change', () => {
  renderIssueProblemOptions(elements.issueProblemCodeSelect.value);
  loadIssueRemediationOptions(elements.issueProblemCodeSelect.value, elements.issueRemediationSelect.value);
});

elements.issueProblemCodeSelect.addEventListener('change', () => {
  if (elements.issueProblemCodeSelect.value && elements.issueBindingStatusSelect.value === 'unbound') {
    elements.issueBindingStatusSelect.value = 'suggested';
  }
  renderIssueProblemOptions(elements.issueProblemCodeSelect.value);
  loadIssueRemediationOptions(elements.issueProblemCodeSelect.value);
});

elements.issueEditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.issueEditForm);
  const issueId = form.get('issueId');
  if (!issueId) return;
  elements.issueEditFormError.hidden = true;
  elements.updateIssueButton.disabled = true;
  try {
    const currentIssue = store.get().issues.find((item) => String(item.id) === String(issueId));
    const updatedIssue = await api.updateIssue(issueId, {
      title: form.get('title'),
      severity: form.get('severity'),
      categoryName: form.get('categoryName'),
      description: form.get('description'),
      evidence: form.get('evidence'),
      suggestion: form.get('suggestion'),
      updatedBy: form.get('updatedBy'),
      expectedRevision: Number(elements.issueEditForm.dataset.issueRevision)
    });
    const bindingStatus = form.get('bindingStatus') || 'unbound';
    const problemCode = form.get('problemCode') || '';
    const remediationId = form.get('remediationId') || '';
    const bindingChanged = bindingStatus !== (currentIssue?.bindingStatus || 'unbound')
      || problemCode !== (currentIssue?.problemCode || '')
      || remediationId !== (currentIssue?.remediationSnapshot?.id || '');
    if (bindingChanged) {
      await api.updateIssueStandardBinding(issueId, {
        bindingStatus,
        problemCode,
        remediationId,
        updatedBy: form.get('updatedBy'),
        expectedRevision: Number(updatedIssue.issueRevision) || Number(elements.issueEditForm.dataset.issueRevision),
        source: 'manual'
      });
    }
    elements.issueEditForm.dataset.loadedIssueId = '';
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadGis();
  } catch (error) {
    elements.issueEditFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.issueEditFormError.hidden = false;
  } finally {
    elements.updateIssueButton.disabled = false;
  }
});

elements.spatialAnalysisForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.spatialAnalysisForm);
  elements.spatialAnalysisFormError.hidden = true;
  elements.runSpatialAnalysisButton.disabled = true;
  try {
    await api.createSpatialAnalysis(store.get().activeProjectId, {
      radiusMeters: form.get('radiusMeters'),
      createdBy: form.get('createdBy')
    });
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadGis();
  } catch (error) {
    elements.spatialAnalysisFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.spatialAnalysisFormError.hidden = false;
  } finally {
    elements.runSpatialAnalysisButton.disabled = false;
  }
});

elements.spatialAnalysisHistory.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-spatial-run]');
  if (!button) return;
  gisViewState.selectedSpatialRunId = button.dataset.spatialRun;
  gisViewState.visibleLayers = {
    ...gisViewState.visibleLayers,
    analysisRange: true,
    distanceLines: true
  };
  persistGisDisplayState();
  await loadGis();
});

elements.poiAnalysisForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = store.get();
  const form = new FormData(elements.poiAnalysisForm);
  elements.poiAnalysisFormError.hidden = true;
  store.set({ gisLoading: true });
  try {
    await api.runPoiAnalysis(state.activeProjectId, {
      category: form.get('category'),
      radiusMeters: form.get('radiusMeters'),
      keywords: form.get('keywords'),
      createdBy: form.get('createdBy'),
      maxPages: 3
    });
    const [summary, workflow] = await Promise.all([
      api.summary(state.activeProjectId),
      api.workflow(state.activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadGis();
  } catch (error) {
    elements.poiAnalysisFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.poiAnalysisFormError.hidden = false;
  } finally {
    store.set({ gisLoading: false });
  }
});

elements.poiAnalysisHistory.addEventListener('click', async (event) => {
  const mapButton = event.target.closest('[data-poi-map]');
  if (mapButton) {
    gisViewState.selectedSpatialRunId = mapButton.dataset.poiMap;
    gisViewState.visibleLayers = {
      ...gisViewState.visibleLayers,
      poi: true,
      analysisRange: true
    };
    persistGisDisplayState();
    await loadGis();
    return;
  }
  const batchButton = event.target.closest('[data-poi-batch]');
  const button = event.target.closest('[data-poi-review]');
  if (!button && !batchButton) return;
  const actionButton = button || batchButton;
  const reviewedBy = new FormData(elements.poiAnalysisForm).get('createdBy')?.trim();
  elements.poiAnalysisFormError.hidden = true;
  if (!reviewedBy) {
    elements.poiAnalysisFormError.textContent = '审核POI前，请先在上方填写操作人员。';
    elements.poiAnalysisFormError.hidden = false;
    elements.poiAnalysisForm.elements.createdBy.focus();
    return;
  }
  actionButton.disabled = true;
  try {
    if (batchButton) {
      const run = store.get().spatialAnalyses.find((item) =>
        String(item.id) === String(batchButton.dataset.poiRun)
      );
      const items = (run?.result?.items || [])
        .filter((item) => (item.reviewStatus || 'pending') === 'pending')
        .map((item) => ({
          normalizedId: item.normalizedId,
          reviewStatus: batchButton.dataset.poiBatch,
          expectedRevision: Number(item.reviewRevision) || 0
        }));
      await api.batchReviewPois(batchButton.dataset.poiRun, { items, reviewedBy });
    } else {
      await api.reviewPoi(button.dataset.poiRun, button.dataset.poiId, {
        reviewStatus: button.dataset.poiReview,
        reviewedBy,
        expectedRevision: Number(button.dataset.poiRevision) || 0
      });
    }
    await loadGis();
  } catch (error) {
    elements.poiAnalysisFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.poiAnalysisFormError.hidden = false;
    actionButton.disabled = false;
  }
});

function parseSurveyRouteSamples(value) {
  const rows = String(value || '').split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (rows.length < 2) throw new Error('踏勘路线至少需要2个真实采样点。');
  return rows.map((row, index) => {
    const parts = row.split(/[,，]/).map((part) => part.trim());
    const longitude = Number(parts[0]);
    const latitude = Number(parts[1]);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`第${index + 1}行经度无效。`);
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error(`第${index + 1}行纬度无效。`);
    }
    const capturedAt = parts[2] || null;
    if (capturedAt && !Number.isFinite(Date.parse(capturedAt))) {
      throw new Error(`第${index + 1}行采集时间无效。`);
    }
    const accuracyMeters = parts[3] === '' || parts[3] == null
      ? null
      : Number(parts[3]);
    if (accuracyMeters != null && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0)) {
      throw new Error(`第${index + 1}行定位精度无效。`);
    }
    return {
      coordinates: [longitude, latitude],
      capturedAt,
      accuracyMeters
    };
  });
}

function requireSurveyRouteOperator() {
  const operator = elements.surveyRouteOperator.value.trim();
  if (!operator) {
    const error = new Error('请填写路线操作人员。');
    error.code = 'SURVEY_ROUTE_OPERATOR_REQUIRED';
    throw error;
  }
  return operator;
}

elements.surveyRouteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.surveyRouteForm);
  elements.surveyRouteFormError.hidden = true;
  elements.createSurveyRouteButton.disabled = true;
  try {
    const sourceAssetId = String(form.get('sourceAssetId') || '');
    const samples = sourceAssetId ? null : parseSurveyRouteSamples(form.get('samples'));
    const route = await api.createSurveyRoute(store.get().activeProjectId, {
      name: form.get('name'),
      crs: form.get('crs'),
      ...(sourceAssetId
        ? { sourceAssetId }
        : {
            samples,
            geometry: {
              type: 'LineString',
              coordinates: samples.map((sample) => sample.coordinates)
            },
            source: { kind: 'manual' }
          }),
      createdBy: form.get('createdBy')
    });
    gisViewState.selectedRouteId = route.id;
    elements.surveyRouteForm.reset();
    persistGisDisplayState();
    await loadGis();
  } catch (error) {
    elements.surveyRouteFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.surveyRouteFormError.hidden = false;
  } finally {
    elements.createSurveyRouteButton.disabled = false;
  }
});

elements.surveyRouteAssetSelect.addEventListener('change', () => {
  const importing = Boolean(elements.surveyRouteAssetSelect.value);
  elements.surveyRouteForm.elements.samples.required = !importing;
  elements.surveyRouteForm.elements.samples.disabled = importing;
});

elements.surveyRouteSelect.addEventListener('change', async () => {
  gisViewState.selectedRouteId = elements.surveyRouteSelect.value;
  persistGisDisplayState();
  if (!gisViewState.selectedRouteId) {
    store.set({ surveyStops: [], photoRouteBindings: [] });
    return;
  }
  try {
    const [surveyStops, photoRouteBindings] = await Promise.all([
      api.surveyStops(gisViewState.selectedRouteId),
      api.photoRouteBindings(gisViewState.selectedRouteId)
    ]);
    store.set({ surveyStops, photoRouteBindings });
  } catch (error) {
    setError(error);
  }
});

async function runSurveyRouteAction(action) {
  elements.surveyRouteActionError.hidden = true;
  const route = store.get().surveyRoutes.find((item) =>
    String(item.id) === String(gisViewState.selectedRouteId)
  );
  if (!route) return;
  try {
    await action(route, requireSurveyRouteOperator());
    await loadGis();
  } catch (error) {
    elements.surveyRouteActionError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.surveyRouteActionError.hidden = false;
  }
}

elements.cleanSurveyRouteButton.addEventListener('click', () =>
  runSurveyRouteAction((route, operator) => api.cleanSurveyRoute(route.id, {
    cleanedBy: operator,
    expectedRevision: Number(route.routeRevision) || 1
  }))
);

elements.detectSurveyStopsButton.addEventListener('click', () =>
  runSurveyRouteAction((route, operator) => api.detectSurveyStops(route.id, {
    detectedBy: operator,
    radiusMeters: 25,
    minimumDurationSeconds: 120
  }))
);

elements.suggestPhotoBindingsButton.addEventListener('click', () =>
  runSurveyRouteAction((route, operator) => api.suggestPhotoRouteBindings(route.id, {
    suggestedBy: operator,
    maximumDistanceMeters: 100,
    maximumTimeDifferenceSeconds: 1800
  }))
);

elements.confirmSurveyRouteButton.addEventListener('click', () =>
  runSurveyRouteAction((route, operator) => api.updateSurveyRoute(route.id, {
    status: 'confirmed',
    updatedBy: operator,
    expectedRevision: Number(route.routeRevision) || 1
  }))
);

elements.surveyStopList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-stop-review]');
  if (!button) return;
  elements.surveyRouteActionError.hidden = true;
  try {
    await api.reviewSurveyStop(button.dataset.stopId, {
      status: button.dataset.stopReview,
      confirmedBy: requireSurveyRouteOperator(),
      expectedRevision: Number(button.dataset.stopRevision) || 1
    });
    await loadGis();
  } catch (error) {
    elements.surveyRouteActionError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.surveyRouteActionError.hidden = false;
  }
});

elements.photoRouteBindingList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-binding-review]');
  if (!button) return;
  elements.surveyRouteActionError.hidden = true;
  try {
    await api.reviewPhotoRouteBinding(button.dataset.bindingId, {
      status: button.dataset.bindingReview,
      confirmedBy: requireSurveyRouteOperator(),
      expectedRevision: Number(button.dataset.bindingRevision) || 1
    });
    await loadGis();
  } catch (error) {
    elements.surveyRouteActionError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.surveyRouteActionError.hidden = false;
  }
});

elements.mapSnapshotForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.mapSnapshotForm);
  elements.mapSnapshotFormError.hidden = true;
  elements.createMapSnapshotButton.disabled = true;
  try {
    await api.createMapSnapshot(store.get().activeProjectId, {
      purpose: form.get('purpose'),
      reportId: form.get('reportId') || null,
      mapStyle: form.get('mapStyle'),
      layers: { ...gisViewState.visibleLayers },
      createdBy: form.get('createdBy')
    });
    await loadGis();
  } catch (error) {
    elements.mapSnapshotFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.mapSnapshotFormError.hidden = false;
  } finally {
    elements.createMapSnapshotButton.disabled = false;
  }
});

elements.mapSnapshotList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-map-snapshot-retry]');
  if (!button) return;
  const createdBy = elements.mapSnapshotForm.elements.createdBy.value.trim();
  elements.mapSnapshotFormError.hidden = true;
  if (!createdBy) {
    elements.mapSnapshotFormError.textContent = '重试地图快照前请填写生成人员。';
    elements.mapSnapshotFormError.hidden = false;
    return;
  }
  button.disabled = true;
  try {
    await api.retryMapSnapshot(button.dataset.mapSnapshotRetry, { createdBy });
    await loadGis();
  } catch (error) {
    elements.mapSnapshotFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.mapSnapshotFormError.hidden = false;
    button.disabled = false;
  }
});

elements.reportForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.reportForm);
  elements.reportFormError.hidden = true;
  store.set({ reportLoading: true });
  try {
    await api.createReport(store.get().activeProjectId, {
      title: form.get('title'),
      executiveSummary: form.get('executiveSummary'),
      recommendations: form.get('recommendations'),
      generatedBy: form.get('generatedBy')
    });
    elements.reportForm.reset();
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadReports();
  } catch (error) {
    elements.reportFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.reportFormError.hidden = false;
  } finally {
    store.set({ reportLoading: false });
  }
});

elements.reportEditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.reportEditForm);
  const reportId = elements.reportEditForm.dataset.reportId;
  if (!reportId) return;
  elements.reportEditFormError.hidden = true;
  elements.updateReportButton.disabled = true;
  try {
    await api.updateReport(reportId, {
      title: form.get('title'),
      executiveSummary: form.get('executiveSummary'),
      recommendations: form.get('recommendations'),
      notes: form.get('notes'),
      updatedBy: form.get('updatedBy'),
      expectedRevision: Number(elements.reportEditForm.dataset.reportRevision)
    });
    elements.reportEditForm.dataset.reportId = '';
    await loadReports();
  } catch (error) {
    elements.reportEditFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.reportEditFormError.hidden = false;
  } finally {
    elements.updateReportButton.disabled = false;
  }
});

elements.reportComparisonForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const state = store.get();
  if (!state.activeProjectId) return;
  const baseReportId = elements.baseReportSelect.value;
  const targetReportId = elements.targetReportSelect.value;
  elements.reportComparisonFormError.hidden = true;
  if (!baseReportId || !targetReportId || baseReportId === targetReportId) {
    elements.reportComparisonFormError.textContent = '请选择两个不同的报告版本。';
    elements.reportComparisonFormError.hidden = false;
    return;
  }
  elements.compareReportsButton.disabled = true;
  try {
    const reportComparison = await api.compareReports(
      state.activeProjectId,
      baseReportId,
      targetReportId
    );
    store.set({ reportComparison });
  } catch (error) {
    elements.reportComparisonFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.reportComparisonFormError.hidden = false;
  } finally {
    elements.compareReportsButton.disabled = false;
  }
});
elements.dismissErrorButton.addEventListener('click', () => setError(null));

elements.rebuildProjectDataButton.addEventListener('click', async () => {
  const state = store.get();
  if (!state.activeProjectId) return;
  elements.rebuildProjectDataButton.disabled = true;
  elements.sourceAssetFormError.hidden = true;
  try {
    const outcome = await api.rebuildProjectData(state.activeProjectId);
    elements.sourceAssetPreview.innerHTML = `
      <strong>ProjectData索引已同步</strong>
      <p class="form-note">当前共 ${Number(outcome?.stats?.total) || 0} 条记录；原生业务对象与已导入资料的引用索引已重建。</p>
    `;
  } catch (error) {
    elements.sourceAssetFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.sourceAssetFormError.hidden = false;
  } finally {
    elements.rebuildProjectDataButton.disabled = false;
  }
});

elements.exportProjectDataSqliteButton.addEventListener('click', async () => {
  const state = store.get();
  if (!state.activeProjectId) return;
  elements.exportProjectDataSqliteButton.disabled = true;
  elements.sourceAssetFormError.hidden = true;
  try {
    const file = await api.downloadProjectDataSqlite(state.activeProjectId);
    saveDownloadedFile(file.blob, file.filename);
  } catch (error) {
    elements.sourceAssetFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.sourceAssetFormError.hidden = false;
  } finally {
    elements.exportProjectDataSqliteButton.disabled = false;
  }
});

document.addEventListener('click', async (event) => {
  const uploadFieldTaskButton = event.target.closest('[data-upload-field-task]');
  if (uploadFieldTaskButton) {
    const state = store.get();
    const taskId = uploadFieldTaskButton.dataset.uploadFieldTask;
    const fileInput = [...document.querySelectorAll('[data-field-task-files]')]
      .find((input) => input.dataset.fieldTaskFiles === taskId);
    const files = [...(fileInput?.files || [])];
    const createdBy = elements.fieldTaskOperationBy.value.trim();
    if (!createdBy || !files.length) {
      elements.fieldTaskFormError.textContent = !createdBy
        ? '上传任务照片前，请填写操作人员。'
        : '请为当前任务选择至少一张照片。';
      elements.fieldTaskFormError.hidden = false;
      return;
    }
    const task = state.fieldTasks.find((item) => String(item.id) === taskId);
    uploadFieldTaskButton.disabled = true;
    elements.fieldTaskFormError.hidden = true;
    try {
      for (const file of files) {
        const created = await api.createFieldTaskUpload(state.activeProjectId, taskId, {
          name: file.name,
          mimeType: file.type,
          size: file.size,
          lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
          clientRequestId: `${taskId}:${file.name}:${file.size}:${file.lastModified}`,
          problemCode: task?.problemCode || '',
          createdBy
        });
        await api.uploadSessionContent(created.session.id, file);
      }
      await loadCollection();
    } catch (error) {
      elements.fieldTaskFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
      elements.fieldTaskFormError.hidden = false;
    } finally {
      uploadFieldTaskButton.disabled = false;
    }
    return;
  }

  const completeFieldTaskButton = event.target.closest('[data-complete-field-task]');
  if (completeFieldTaskButton) {
    const state = store.get();
    const completedBy = elements.fieldTaskOperationBy.value.trim();
    if (!completedBy) {
      elements.fieldTaskFormError.textContent = '完成任务前，请填写操作人员。';
      elements.fieldTaskFormError.hidden = false;
      return;
    }
    completeFieldTaskButton.disabled = true;
    elements.fieldTaskFormError.hidden = true;
    try {
      await api.completeFieldTask(
        state.activeProjectId,
        completeFieldTaskButton.dataset.completeFieldTask,
        { completedBy }
      );
      await loadCollection();
    } catch (error) {
      elements.fieldTaskFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
      elements.fieldTaskFormError.hidden = false;
      completeFieldTaskButton.disabled = false;
    }
    return;
  }

  const retryFieldTaskButton = event.target.closest('[data-retry-field-task]');
  if (retryFieldTaskButton) {
    const state = store.get();
    const taskId = retryFieldTaskButton.dataset.retryFieldTask;
    const retriedBy = elements.fieldTaskOperationBy.value.trim();
    const fileInput = [...document.querySelectorAll('[data-field-task-files]')]
      .find((input) => input.dataset.fieldTaskFiles === taskId);
    const files = [...(fileInput?.files || [])];
    if (!retriedBy) {
      elements.fieldTaskFormError.textContent = '重试任务前，请填写操作人员。';
      elements.fieldTaskFormError.hidden = false;
      return;
    }
    retryFieldTaskButton.disabled = true;
    elements.fieldTaskFormError.hidden = true;
    try {
      const outcome = await api.retryFieldTask(state.activeProjectId, taskId, { retriedBy });
      for (const session of outcome.retryableSessions || []) {
        const file = files.find((item) => item.name === session.file?.name && item.size === session.file?.size);
        if (!file) {
          throw Object.assign(new Error(`请重新选择失败文件：${session.file?.name || session.id}`), {
            code: 'FIELD_TASK_RETRY_FILE_REQUIRED'
          });
        }
        await api.uploadSessionContent(session.id, file);
      }
      await loadCollection();
    } catch (error) {
      elements.fieldTaskFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
      elements.fieldTaskFormError.hidden = false;
      retryFieldTaskButton.disabled = false;
    }
    return;
  }

  const previewSourceAssetButton = event.target.closest('[data-preview-source-asset]');
  if (previewSourceAssetButton) {
    previewSourceAssetButton.disabled = true;
    elements.sourceAssetFormError.hidden = true;
    try {
      renderSourceAssetPreview(
        await api.sourceAssetPreview(previewSourceAssetButton.dataset.previewSourceAsset)
      );
    } catch (error) {
      elements.sourceAssetFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
      elements.sourceAssetFormError.hidden = false;
    } finally {
      previewSourceAssetButton.disabled = false;
    }
    return;
  }

  const importProjectDataButton = event.target.closest('[data-import-project-data]');
  if (importProjectDataButton) {
    const state = store.get();
    const importedBy = elements.sourceAssetGovernanceBy.value.trim();
    elements.sourceAssetFormError.hidden = true;
    if (!importedBy) {
      elements.sourceAssetFormError.textContent = '导入SQLite前，请填写资料治理人员。';
      elements.sourceAssetFormError.hidden = false;
      elements.sourceAssetGovernanceBy.focus();
      return;
    }
    importProjectDataButton.disabled = true;
    store.set({ collectionLoading: true });
    try {
      const outcome = await api.importProjectDataSqlite(state.activeProjectId, {
        assetId: importProjectDataButton.dataset.importProjectData,
        importedBy,
        mode: 'append',
        clientRequestId: crypto.randomUUID()
      });
      const run = outcome.run;
      elements.sourceAssetPreview.innerHTML = `
        <strong>${escapeHtml(run.assetName || run.assetId)} · SQLite导入完成</strong>
        <p class="form-note">导入 ${Number(run.importedCount) || 0} 条记录；识别表：${escapeHtml((run.recognizedTables || []).join('、') || '无')}。来源哈希与资料修订已写入导入审计。</p>
      `;
    } catch (error) {
      elements.sourceAssetFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
      elements.sourceAssetFormError.hidden = false;
      importProjectDataButton.disabled = false;
    } finally {
      store.set({ collectionLoading: false });
    }
    return;
  }

  const importBoundaryButton = event.target.closest('[data-import-boundary]');
  if (importBoundaryButton) {
    const state = store.get();
    const updatedBy = elements.sourceAssetGovernanceBy.value.trim();
    elements.sourceAssetFormError.hidden = true;
    if (!updatedBy) {
      elements.sourceAssetFormError.textContent = '导入项目边界前，请填写资料治理人员。';
      elements.sourceAssetFormError.hidden = false;
      elements.sourceAssetGovernanceBy.focus();
      return;
    }
    importBoundaryButton.disabled = true;
    store.set({ collectionLoading: true });
    try {
      const project = await api.importBoundary(state.activeProjectId, {
        sourceAssetId: importBoundaryButton.dataset.importBoundary,
        crs: 'WGS84',
        updatedBy,
        expectedRevision: Number(state.activeProject?.revision) || 0
      });
      elements.boundaryCoordinatesInput.dataset.revision = '';
      const [summary, workflow] = await Promise.all([
        api.summary(state.activeProjectId),
        api.workflow(state.activeProjectId)
      ]);
      store.set({ activeProject: project, summary, workflow });
      await loadCollection();
    } catch (error) {
      elements.sourceAssetFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
      elements.sourceAssetFormError.hidden = false;
      importBoundaryButton.disabled = false;
    } finally {
      store.set({ collectionLoading: false });
    }
    return;
  }

  const toggleSourceAssetButton = event.target.closest('[data-toggle-source-asset]');
  if (toggleSourceAssetButton) {
    const state = store.get();
    const asset = state.sourceAssets
      .find((item) => String(item.id) === toggleSourceAssetButton.dataset.toggleSourceAsset);
    if (!asset) return;
    const updatedBy = elements.sourceAssetGovernanceBy.value.trim();
    elements.sourceAssetFormError.hidden = true;
    if (!updatedBy) {
      elements.sourceAssetFormError.textContent = '停用或恢复资料前，请填写资料治理人员。';
      elements.sourceAssetFormError.hidden = false;
      elements.sourceAssetGovernanceBy.focus();
      return;
    }
    toggleSourceAssetButton.disabled = true;
    store.set({ collectionLoading: true });
    try {
      await api.updateSourceAsset(state.activeProjectId, asset.id, {
        status: toggleSourceAssetButton.dataset.nextStatus,
        updatedBy,
        expectedRevision: Number(asset.assetRevision) || 1
      });
      const [summary, workflow] = await Promise.all([
        api.summary(state.activeProjectId),
        api.workflow(state.activeProjectId)
      ]);
      store.set({ summary, workflow });
      await loadCollection();
    } catch (error) {
      elements.sourceAssetFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
      elements.sourceAssetFormError.hidden = false;
      toggleSourceAssetButton.disabled = false;
    } finally {
      store.set({ collectionLoading: false });
    }
    return;
  }

  const saveCandidateButton = event.target.closest('[data-save-candidate]');
  if (saveCandidateButton) {
    const state = store.get();
    const analysis = activeReviewAnalysis(state.analyses);
    if (!analysis || analysis.status === 'archived') return;
    const candidate = candidatesFromAnalysis(analysis)
      .find((item) => String(item.id) === saveCandidateButton.dataset.saveCandidate);
    if (!candidate) return;
    const form = new FormData(elements.reviewForm);
    const changes = {};
    const edited = {
      title: form.get(`candidateTitle:${candidate.id}`),
      severity: form.get(`candidateSeverity:${candidate.id}`),
      desc: form.get(`candidateDesc:${candidate.id}`),
      evidence: form.get(`candidateEvidence:${candidate.id}`)
    };
    for (const [field, value] of Object.entries(edited)) {
      if (value !== null && String(value) !== String(candidate[field] ?? '')) changes[field] = value;
    }
    elements.reviewFormError.hidden = true;
    saveCandidateButton.disabled = true;
    try {
      await api.updateAnalysisCandidate(candidate.id, {
        analysisId: analysis.id,
        projectId: state.activeProjectId,
        reviewStatus: form.get(`decision:${candidate.id}`),
        changes,
        updatedBy: form.get('reviewerName'),
        expectedRevision: Number(candidate.candidateRevision) || 1
      });
      const [summary, workflow] = await Promise.all([
        api.summary(state.activeProjectId),
        api.workflow(state.activeProjectId)
      ]);
      store.set({ summary, workflow });
      await loadReview();
    } catch (error) {
      elements.reviewFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
      elements.reviewFormError.hidden = false;
      saveCandidateButton.disabled = false;
    }
    return;
  }

  const editCommunityButton = event.target.closest('[data-edit-community]');
  if (editCommunityButton) {
    const community = store.get().communities
      .find((item) => String(item.id) === editCommunityButton.dataset.editCommunity);
    if (!community) return;
    elements.communityForm.dataset.editingId = community.id;
    elements.communityForm.dataset.communityRevision = String(Number(community.communityRevision) || 1);
    elements.communityForm.elements.name.value = community.name || '';
    elements.communityForm.elements.address.value = community.address || '';
    elements.saveCommunityButton.textContent = '保存小区修订';
    elements.cancelCommunityEditButton.hidden = false;
    elements.communityForm.elements.name.focus();
    return;
  }

  const toggleCommunityButton = event.target.closest('[data-toggle-community]');
  if (toggleCommunityButton) {
    const state = store.get();
    const community = state.communities
      .find((item) => String(item.id) === toggleCommunityButton.dataset.toggleCommunity);
    if (!community) return;
    const updatedBy = elements.communityGovernanceBy.value.trim();
    if (!updatedBy) {
      setError(Object.assign(new Error('请填写小区停用或恢复人员。'), { code: 'COMMUNITY_ACTOR_REQUIRED' }));
      return;
    }
    toggleCommunityButton.disabled = true;
    store.set({ collectionLoading: true });
    try {
      if (toggleCommunityButton.dataset.nextStatus === 'active') {
        await api.restoreCommunity(state.activeProjectId, community.id, {
          restoredBy: updatedBy,
          expectedRevision: Number(community.communityRevision) || 1
        });
      } else {
        await api.updateCommunity(state.activeProjectId, community.id, {
          status: 'inactive',
          updatedBy,
          expectedRevision: Number(community.communityRevision) || 1
        });
      }
      const project = await api.project(state.activeProjectId);
      store.set({ activeProject: project });
      await loadCollection();
    } catch (error) {
      setError(error);
      toggleCommunityButton.disabled = false;
    } finally {
      store.set({ collectionLoading: false });
    }
    return;
  }

  const splitCommunityButton = event.target.closest('[data-split-community]');
  if (splitCommunityButton) {
    const state = store.get();
    const community = state.communities
      .find((item) => String(item.id) === splitCommunityButton.dataset.splitCommunity);
    if (!community) return;
    const splitBy = elements.communityGovernanceBy.value.trim();
    if (!splitBy) {
      setError(Object.assign(new Error('请填写小区拆分人员。'), { code: 'COMMUNITY_ACTOR_REQUIRED' }));
      return;
    }
    splitCommunityButton.disabled = true;
    store.set({ collectionLoading: true });
    try {
      await api.splitCommunity(state.activeProjectId, community.id, {
        expectedRevision: Number(community.communityRevision) || 1,
        referenceStrategy: 'block-if-referenced',
        splitBy
      });
      const project = await api.project(state.activeProjectId);
      store.set({ activeProject: project });
      await loadCollection();
    } catch (error) {
      setError(error);
      splitCommunityButton.disabled = false;
    } finally {
      store.set({ collectionLoading: false });
    }
    return;
  }

  const editBuildingButton = event.target.closest('[data-edit-building]');
  if (editBuildingButton) {
    const communityId = elements.buildingCommunitySelect.value;
    const building = (store.get().buildingsByCommunity[communityId] || [])
      .find((item) => String(item.id) === editBuildingButton.dataset.editBuilding);
    if (!building) return;
    elements.buildingForm.dataset.editingId = building.id;
    elements.buildingForm.dataset.buildingRevision = String(Number(building.buildingRevision) || 1);
    elements.buildingForm.elements.name.value = building.name || '';
    elements.buildingForm.elements.householdCount.value = building.householdCount ?? '';
    elements.buildingForm.elements.unitCount.value = building.unitCount ?? '';
    elements.buildingForm.elements.floorCount.value = building.floorCount ?? '';
    elements.saveBuildingButton.textContent = '保存楼栋修订';
    elements.cancelBuildingEditButton.hidden = false;
    elements.buildingForm.elements.name.focus();
    return;
  }

  const toggleBuildingButton = event.target.closest('[data-toggle-building]');
  if (toggleBuildingButton) {
    const state = store.get();
    const communityId = elements.buildingCommunitySelect.value;
    const building = (state.buildingsByCommunity[communityId] || [])
      .find((item) => String(item.id) === toggleBuildingButton.dataset.toggleBuilding);
    if (!building) return;
    toggleBuildingButton.disabled = true;
    store.set({ collectionLoading: true });
    try {
      await api.updateBuilding(
        state.activeProjectId,
        communityId,
        building.id,
        {
          status: toggleBuildingButton.dataset.nextStatus,
          expectedRevision: Number(building.buildingRevision) || 1
        }
      );
      const project = await api.project(state.activeProjectId);
      store.set({ activeProject: project });
      await loadCollection();
    } catch (error) {
      setError(error);
      toggleBuildingButton.disabled = false;
    } finally {
      store.set({ collectionLoading: false });
    }
    return;
  }

  const retryButton = event.target.closest('[data-retry-upload]');
  if (retryButton) {
    const sessionId = retryButton.dataset.retryUpload;
    const file = pendingUploadFiles.get(sessionId);
    if (!file) return;
    store.set({ collectionLoading: true });
    try {
      const outcome = await api.uploadSessionContent(sessionId, file);
      upsertUploadSession(outcome.session);
      await loadCollection();
    } catch (error) {
      setError(error);
      await loadCollection();
    } finally {
      store.set({ collectionLoading: false });
    }
    return;
  }

  const cancelButton = event.target.closest('[data-cancel-upload]');
  if (cancelButton) {
    store.set({ collectionLoading: true });
    try {
      const outcome = await api.cancelUploadSession(cancelButton.dataset.cancelUpload);
      upsertUploadSession(outcome.item || outcome);
    } catch (error) {
      setError(error);
    } finally {
      store.set({ collectionLoading: false });
    }
    return;
  }

  const stageButton = event.target.closest('[data-stage-id]');
  if (stageButton) {
    const stageId = stageButton.dataset.stageId;
    const url = new URL(location.href);
    url.searchParams.set('stage', stageId);
    url.searchParams.delete('view');
    history.replaceState(null, '', url);
    store.set({ selectedStageId: stageId });
  }
});

elements.stageActionButton.addEventListener('click', () => {
  const href = elements.stageActionButton.dataset.href;
  if (!href) return;
  const url = new URL(href, location.origin);
  url.searchParams.set('projectId', store.get().activeProjectId);
  history.replaceState(null, '', `${url.pathname}${url.search}`);
  store.set({ selectedStageId: new URLSearchParams(url.search).get('stage') || store.get().selectedStageId });
  const stage = new URLSearchParams(url.search).get('stage');
  if (stage === 'collection') loadCollection();
  if (stage === 'ai-analysis') loadAnalysis();
  if (stage === 'human-review') loadReview();
  if (stage === 'gis-and-issues') loadGis();
  if (stage === 'indicators') loadIndicator();
  if (stage === 'reports') loadReports();
});

function navigateGlobalView(view) {
  const url = new URL(location.href);
  url.searchParams.set('view', view);
  url.searchParams.delete('stage');
  history.replaceState(null, '', url);
  if (view === 'outcomes') loadOutcomeCenter();
  if (view === 'settings') loadSettings();
  store.set({ selectedStageId: store.get().selectedStageId });
}

elements.outcomeCenterButton.addEventListener('click', () => navigateGlobalView('outcomes'));
elements.settingsButton.addEventListener('click', () => navigateGlobalView('settings'));
elements.backFromOutcomeButton.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  store.set({ selectedStageId: store.get().selectedStageId });
});
elements.backFromSettingsButton.addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.delete('view');
  history.replaceState(null, '', url);
  store.set({ selectedStageId: store.get().selectedStageId });
});

elements.outcomeProjectList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-outcome-project]');
  if (!button) return;
  const url = new URL(location.href);
  url.searchParams.delete('view');
  url.searchParams.set('project', button.dataset.outcomeProject);
  url.searchParams.set('projectId', button.dataset.outcomeProject);
  history.replaceState(null, '', url);
  loadProject(button.dataset.outcomeProject);
});

store.subscribe(render);
render(store.get());
boot();
