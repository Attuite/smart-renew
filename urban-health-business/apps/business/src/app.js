import { api } from './api/client.js';
import { createStore } from './store/app-store.js';
import { stageCatalog, statusLabels } from './workflow/stages.js';

const store = createStore();
const pendingUploadFiles = new Map();
let pendingSourceAssetRequestId = crypto.randomUUID();
let analysisPollTimer = null;
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
  communityList: document.querySelector('#communityList'),
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
  geometryForm: document.querySelector('#geometryForm'),
  geometryIssueSelect: document.querySelector('#geometryIssueSelect'),
  saveGeometryButton: document.querySelector('#saveGeometryButton'),
  geometryFormError: document.querySelector('#geometryFormError'),
  issueEditForm: document.querySelector('#issueEditForm'),
  issueEditSelect: document.querySelector('#issueEditSelect'),
  updateIssueButton: document.querySelector('#updateIssueButton'),
  issueEditFormError: document.querySelector('#issueEditFormError'),
  spatialPreview: document.querySelector('#spatialPreview'),
  geometryAuditList: document.querySelector('#geometryAuditList'),
  spatialAnalysisForm: document.querySelector('#spatialAnalysisForm'),
  runSpatialAnalysisButton: document.querySelector('#runSpatialAnalysisButton'),
  spatialAnalysisFormError: document.querySelector('#spatialAnalysisFormError'),
  spatialAnalysisHistory: document.querySelector('#spatialAnalysisHistory'),
  indicatorWorkspace: document.querySelector('#indicatorWorkspace'),
  backFromIndicatorButton: document.querySelector('#backFromIndicatorButton'),
  indicatorIssueCount: document.querySelector('#indicatorIssueCount'),
  indicatorLocatedCount: document.querySelector('#indicatorLocatedCount'),
  indicatorContractStatus: document.querySelector('#indicatorContractStatus'),
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
      </article>`).join('')
    : '<p class="workspace-empty">尚无Business边界修订快照；首次保存后开始记录。</p>';

  elements.communityList.innerHTML = state.communities.length
    ? state.communities.map((community) => `<article>
        <div><strong>${escapeHtml(community.name)}</strong><span>${escapeHtml(community.address || '未填写地址')}</span></div>
        <small>${Number(community.buildingDetailCount) || 0} 栋 · ${community.status === 'inactive' ? '已停用' : '使用中'}</small>
        <span class="community-row-actions">
          <button type="button" data-edit-community="${escapeHtml(community.id)}">编辑</button>
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
  const ready = ai.ready === true;
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
    ? `当前模型：${ai.model || '由后端配置'}`
    : `原因：${ai.reason || 'ai_unavailable'}。不会显示或生成Demo候选结果。`;

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
          <span>${job.photoIds?.length || 0} 张照片 · ${Number(job.progress?.percent) || 0}%</span>
          <span>${Number(job.candidateCount) || 0} 个候选</span>
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
  elements.pendingReviewCount.textContent = pending;
  elements.acceptedReviewCount.textContent = accepted;
  elements.excludedReviewCount.textContent = excluded;
  elements.reviewBatchTitle.textContent = analysis
    ? `${analysis.analysisType || '综合巡检分析'} · ${analysis.id}`
    : '没有可复核分析';

  elements.reviewCandidateList.innerHTML = !analysis
    ? '<p class="workspace-empty">请先在阶段02完成一次真实AI分析。</p>'
    : candidates.length
      ? candidates.map((candidate, index) => {
          const photo = state.photos.find((item) => String(item.id) === String(candidate.photoId));
          const current = candidate.reviewStatus === 'rejected' ? 'excluded' : candidate.reviewStatus || 'pending';
          return `<article class="review-card">
            <div class="review-media">${photo?.url ? `<img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name || '证据照片')}">` : '<span>无照片预览</span>'}</div>
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

function hasIssueGeometry(issue) {
  return issue?.geometry?.type === 'Point'
    && Array.isArray(issue.geometry.coordinates)
    && issue.geometry.coordinates.length >= 2;
}

function pointInsideBoundary(point, polygon) {
  if (!Array.isArray(point) || !Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[previous].map(Number);
    const end = polygon[index].map(Number);
    const cross = (point[1] - start[1]) * (end[0] - start[0])
      - (point[0] - start[0]) * (end[1] - start[1]);
    const onSegment = Math.abs(cross) < 1e-10
      && point[0] >= Math.min(start[0], end[0]) - 1e-10
      && point[0] <= Math.max(start[0], end[0]) + 1e-10
      && point[1] >= Math.min(start[1], end[1]) - 1e-10
      && point[1] <= Math.max(start[1], end[1]) + 1e-10;
    if (onSegment) return true;
    const intersects = (end[1] > point[1]) !== (start[1] > point[1])
      && point[0] < ((start[0] - end[0]) * (point[1] - end[1])) / (start[1] - end[1]) + end[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function renderSpatialSvg(project, issues) {
  const boundary = Array.isArray(project?.scopeBoundary)
    ? project.scopeBoundary
        .map((point) => Array.isArray(point) ? point.slice(0, 2).map(Number) : null)
        .filter((point) => point && point.every(Number.isFinite))
    : [];
  const issuePoints = issues
    .filter(hasIssueGeometry)
    .map((issue) => ({ issue, point: issue.geometry.coordinates.slice(0, 2).map(Number) }));
  const allPoints = [...boundary, ...issuePoints.map((item) => item.point)];
  if (!allPoints.length) {
    return '<p class="workspace-empty">尚无可绘制的真实边界或问题坐标。</p>';
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
  const polygon = boundary.length
    ? `<polygon points="${boundary.map((point) => projectPoint(point).join(',')).join(' ')}" />`
    : '';
  const markers = issuePoints.map(({ issue, point }, index) => {
    const [x, y] = projectPoint(point);
    return `<g><circle cx="${x}" cy="${y}" r="6" /><text x="${x + 9}" y="${y + 3}">${index + 1}. ${escapeHtml(issue.title || issue.id)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 600 300" role="img" aria-label="真实项目边界和正式问题经纬度预览"
    data-spatial-clickable="${boundary.length >= 3}" data-min-lon="${minLon}" data-max-lon="${maxLon}" data-min-lat="${minLat}" data-max-lat="${maxLat}">
    <g class="spatial-grid"><path d="M30 30V270H570 M30 90H570 M30 150H570 M30 210H570 M165 30V270 M300 30V270 M435 30V270 M570 30V270" /></g>
    <g class="spatial-boundary">${polygon}</g>
    <g class="spatial-markers">${markers}</g>
    <text class="spatial-extent" x="30" y="292">${minLon.toFixed(5)}, ${minLat.toFixed(5)} → ${maxLon.toFixed(5)}, ${maxLat.toFixed(5)}</text>
  </svg>`;
}

function populateIssueEditForm(issue) {
  const form = elements.issueEditForm;
  if (!issue) {
    form.dataset.issueRevision = '';
    for (const field of ['title', 'categoryName', 'description', 'evidence', 'suggestion', 'updatedBy']) {
      form.elements[field].value = '';
    }
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

function renderGis(state) {
  const visible = isGisWorkspace(state);
  elements.gisWorkspace.hidden = !visible;
  if (!visible) return;

  const located = state.issues.filter(hasIssueGeometry);
  const editableIssues = state.issues.filter((issue) =>
    ['manual', 'ai-reviewed'].includes(issue.source)
    || Number(issue.issueRevision) >= 1
  );
  elements.gisIssueCount.textContent = state.issues.length;
  elements.locatedIssueCount.textContent = located.length;
  elements.unlocatedIssueCount.textContent = state.issues.length - located.length;
  elements.spatialPreview.innerHTML = renderSpatialSvg(state.activeProject, state.issues);
  elements.gisIssueList.innerHTML = state.issues.length
    ? state.issues.map((issue) => {
        const geometry = hasIssueGeometry(issue) ? issue.geometry.coordinates : null;
        return `<article class="ledger-row">
          <div><strong>${escapeHtml(issue.title || '未命名正式问题')}</strong><span>${escapeHtml(issue.categoryName || issue.categoryCode || '未分类')}</span></div>
          <span class="risk-${escapeHtml(issue.severity)}">${escapeHtml(issue.severity || 'unknown')}</span>
          <small>${geometry ? `${geometry[0]}, ${geometry[1]} · 定位修订 ${Number(issue.geometryRevision) || 1}` : '待定位'}</small>
        </article>`;
      }).join('')
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
  renderGeometryAudit(selectedGeometryIssue);
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
  elements.spatialAnalysisHistory.innerHTML = state.spatialAnalyses.length
    ? state.spatialAnalyses.map((run) => `<article class="history-row spatial-history-row">
        <div><strong>${Number(run.parameters?.radiusMeters) || 0}米半径</strong><span>${run.completedAt ? new Date(run.completedAt).toLocaleString() : '时间未记录'}</span></div>
        <span>中心 ${escapeHtml(run.parameters?.center?.join(', ') || '未记录')}</span>
        <span>命中 ${Number(run.result?.matchedIssueCount) || 0} / 已定位 ${Number(run.sourceSnapshot?.locatedIssueCount) || 0}</span>
        <i class="run-status status-completed">已完成</i>
      </article>`).join('')
    : '<p class="workspace-empty">尚未运行空间分析。系统不会自动生成固定500/800/1000米结果。</p>';
  const hasProjectBoundary = Array.isArray(state.activeProject?.scopeBoundary)
    && state.activeProject.scopeBoundary.length >= 3;
  elements.runSpatialAnalysisButton.disabled = !hasProjectBoundary || state.gisLoading;
  elements.runSpatialAnalysisButton.title = hasProjectBoundary
    ? ''
    : '请先在阶段01录入真实项目边界';
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
          <strong>—<small>指标得分</small></strong>
        </div>
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
  elements.overviewView.hidden = isCollectionWorkspace(state)
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
  renderError(state);
  elements.loadingLayer.hidden = !state.loading;
}

async function loadProject(projectId) {
  if (!projectId) {
    store.set({ activeProjectId: '', activeProject: null, summary: null, workflow: null });
    return;
  }
  if (String(store.get().activeProjectId) !== String(projectId)) {
    if (analysisPollTimer) clearTimeout(analysisPollTimer);
    analysisPollTimer = null;
    store.set({
      photos: [],
      sourceAssets: [],
      boundaryRevisions: [],
      uploadSessions: [],
      analyses: [],
      analysisJobs: [],
      analysisJobCandidates: [],
      issues: [],
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
    const requestedStage = new URLSearchParams(location.search).get('stage');
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

async function loadIndicator(projectId = store.get().activeProjectId) {
  if (!projectId) return;
  try {
    const [indicatorMeta, issues] = await Promise.all([
      api.indicatorMeta(),
      api.issues(projectId)
    ]);
    store.set({ indicatorMeta, issues });
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

async function loadGis(projectId = store.get().activeProjectId) {
  if (!projectId) return;
  store.set({ gisLoading: true });
  try {
    const [issues, spatialAnalyses] = await Promise.all([
      api.issues(projectId),
      api.spatialAnalyses(projectId)
    ]);
    store.set({ issues, spatialAnalyses });
  } catch (error) {
    setError(error);
  } finally {
    store.set({ gisLoading: false });
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
    const [photos, analyses, analysisJobs] = await Promise.all([
      api.photos(projectId),
      api.analyses(projectId),
      api.analysisJobs(projectId)
    ]);
    const latestCompletedJob = latestCompletedAnalysisJob(analysisJobs);
    const analysisJobCandidates = latestCompletedJob
      ? await api.analysisJobCandidates(latestCompletedJob.id)
      : [];
    if (String(store.get().activeProjectId) !== String(projectId)) return;
    store.set({ photos, analyses, analysisJobs, analysisJobCandidates });
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
      photos,
      uploadSessions,
      boundaryRevisions,
      collectionValidation,
      collectionValidationRuns,
      sourceAssets
    ] = await Promise.all([
      api.communities(projectId),
      api.photos(projectId, true),
      api.uploadSessions(projectId),
      api.boundaryRevisions(projectId),
      api.collectionValidation(projectId),
      api.collectionValidationRuns(projectId),
      api.sourceAssets(projectId, true)
    ]);
    const buildingEntries = await Promise.all(communities
      .filter((community) => community.status !== 'inactive')
      .map(async (community) => [
      community.id,
      await api.buildings(projectId, community.id)
    ]));
    store.set({
      communities,
      photos,
      uploadSessions,
      boundaryRevisions,
      collectionValidation,
      collectionValidationRuns,
      sourceAssets,
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
    const [meta, projects] = await Promise.all([api.meta(), api.projects()]);
    store.set({ meta, projects });
    const queryProject = new URLSearchParams(location.search).get('projectId');
    const activeProjectId = projects.some((item) => String(item.id) === queryProject)
      ? queryProject
      : projects[0]?.id;
    if (activeProjectId != null) await loadProject(String(activeProjectId));
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
  if (projectId) url.searchParams.set('projectId', projectId);
  else url.searchParams.delete('projectId');
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

elements.reviewForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const analysis = activeReviewAnalysis(store.get().analyses);
  if (!analysis || analysis.status === 'archived') return;
  const form = new FormData(elements.reviewForm);
  const candidates = candidatesFromAnalysis(analysis);
  const decisions = candidates.map((candidate) => {
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
      status: form.get(`decision:${candidate.id}`),
      ...(Object.keys(changes).length ? { changes } : {})
    };
  });
  elements.reviewFormError.hidden = true;
  store.set({ reviewLoading: true });
  try {
    await api.finalizeReview(analysis.id, {
      reviewerName: form.get('reviewerName'),
      decisions
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
    store.set({ reviewLoading: false });
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
    const [summary, workflow] = await Promise.all([
      api.summary(store.get().activeProjectId),
      api.workflow(store.get().activeProjectId)
    ]);
    store.set({ summary, workflow });
    await loadGis();
  } catch (error) {
    elements.geometryFormError.textContent = `${error.message}${error.code ? `（${error.code}）` : ''}`;
    elements.geometryFormError.hidden = false;
  } finally {
    store.set({ gisLoading: false });
  }
});

elements.geometryIssueSelect.addEventListener('change', () => {
  const issue = store.get().issues
    .find((item) => String(item.id) === elements.geometryIssueSelect.value);
  if (hasIssueGeometry(issue)) {
    elements.geometryForm.elements.longitude.value = issue.geometry.coordinates[0];
    elements.geometryForm.elements.latitude.value = issue.geometry.coordinates[1];
    elements.geometryForm.elements.crs.value = issue.spatialBinding?.crs
      || store.get().activeProject?.scopeBoundaryCrs
      || 'WGS84';
  } else {
    elements.geometryForm.elements.longitude.value = '';
    elements.geometryForm.elements.latitude.value = '';
    elements.geometryForm.elements.crs.value = store.get().activeProject?.scopeBoundaryCrs || 'WGS84';
  }
  renderGeometryAudit(issue);
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
  elements.geometryForm.elements.longitude.value = point[0].toFixed(7);
  elements.geometryForm.elements.latitude.value = point[1].toFixed(7);
  elements.geometryForm.elements.crs.value = store.get().activeProject?.scopeBoundaryCrs || 'WGS84';
});

elements.issueEditSelect.addEventListener('change', () => {
  const issue = store.get().issues.find((item) => String(item.id) === elements.issueEditSelect.value);
  elements.issueEditForm.dataset.loadedIssueId = String(issue?.id || '');
  populateIssueEditForm(issue);
});

elements.issueEditForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(elements.issueEditForm);
  const issueId = form.get('issueId');
  if (!issueId) return;
  elements.issueEditFormError.hidden = true;
  elements.updateIssueButton.disabled = true;
  try {
    await api.updateIssue(issueId, {
      title: form.get('title'),
      severity: form.get('severity'),
      categoryName: form.get('categoryName'),
      description: form.get('description'),
      evidence: form.get('evidence'),
      suggestion: form.get('suggestion'),
      updatedBy: form.get('updatedBy'),
      expectedRevision: Number(elements.issueEditForm.dataset.issueRevision)
    });
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
    toggleCommunityButton.disabled = true;
    store.set({ collectionLoading: true });
    try {
      await api.updateCommunity(state.activeProjectId, community.id, {
        status: toggleCommunityButton.dataset.nextStatus,
        expectedRevision: Number(community.communityRevision) || 1
      });
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

store.subscribe(render);
render(store.get());
boot();
