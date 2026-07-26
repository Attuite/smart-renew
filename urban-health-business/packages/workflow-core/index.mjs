import { STAGES, WORKFLOW_STATUS } from '../api-contracts/constants.mjs';

const ACTIVE_TASK_STATUSES = new Set(['queued', 'running', 'processing', 'finalizing', 'generating']);
const SUCCESS_TASK_STATUSES = new Set(['completed', 'archived', 'generated', 'ready', 'reviewed', 'reviewing']);
const FAILED_TASK_STATUSES = new Set(['failed']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function statusOf(item) {
  return String(item?.status || '').toLowerCase();
}

function countWhere(items, predicate) {
  return asArray(items).reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function percentage(completed, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

function stageBase(stage, status, completed, total, unit = '项') {
  return {
    ...stage,
    status,
    progress: {
      percent: status === WORKFLOW_STATUS.UNAVAILABLE ? null : percentage(completed, total),
      completed,
      total,
      unit
    },
    inputs: [],
    outputs: [],
    blockers: [],
    warnings: [],
    staleReasons: [],
    capability: {
      ready: true,
      reason: null
    },
    actions: [],
    latestRun: null,
    updatedAt: null
  };
}

function unavailable(stage, reason, completed = 0, total = 0) {
  const result = stageBase(stage, WORKFLOW_STATUS.UNAVAILABLE, completed, total);
  result.capability = { ready: false, reason };
  return result;
}

function candidateItems(analyses) {
  const candidates = [];
  for (const analysis of asArray(analyses)) {
    const embedded = asArray(analysis?.candidates);
    const reviewed = asArray(analysis?.reviewIssues);
    const legacy = asArray(analysis?.result?.issues);
    const source = embedded.length ? embedded : reviewed.length ? reviewed : legacy;
    for (const item of source) candidates.push({ ...item, analysisId: item.analysisId || analysis.id });
  }
  return candidates;
}

function hasGeometry(issue) {
  const geometry = issue?.geometry || issue?.spatialBinding?.geometry;
  if (geometry?.coordinates && Array.isArray(geometry.coordinates)) return true;
  const location = issue?.location;
  if (Array.isArray(location?.coordinates) && location.coordinates.length >= 2) return true;
  const lng = issue?.lng ?? issue?.longitude ?? location?.lng ?? location?.longitude;
  const lat = issue?.lat ?? issue?.latitude ?? location?.lat ?? location?.latitude;
  return Number.isFinite(Number(lng)) && Number.isFinite(Number(lat));
}

function action(stageId, label) {
  return {
    id: `open-${stageId}`,
    label,
    enabled: true,
    href: `/business/?stage=${encodeURIComponent(stageId)}&view=workspace`
  };
}

export function buildWorkflow(input = {}) {
  const project = input.project || null;
  const photos = asArray(input.photos);
  const assets = asArray(input.assets);
  const fieldRecords = asArray(input.fieldRecords);
  const uploadSessions = asArray(input.uploadSessions);
  const analyses = asArray(input.analyses);
  const reviewConclusions = asArray(input.reviewConclusions);
  const officialIssues = asArray(input.officialIssues);
  const spatialAnalyses = asArray(input.spatialAnalyses);
  const indicatorRuns = asArray(input.indicatorRuns);
  const reports = asArray(input.reports);
  const capabilities = input.capabilities || {};
  const collectionValidation = input.collectionValidation || null;

  const stageMap = Object.fromEntries(STAGES.map((stage) => [stage.id, stage]));
  const inputTotal = photos.length + assets.length + fieldRecords.length;
  const uploadActive =
    countWhere([...photos, ...assets], (item) => ACTIVE_TASK_STATUSES.has(statusOf(item))) +
    countWhere(uploadSessions, (item) => ['ready', 'uploading', 'queued', 'processing'].includes(statusOf(item)));
  const uploadFailed = countWhere([...photos, ...assets, ...uploadSessions], (item) => FAILED_TASK_STATUSES.has(statusOf(item)));

  let collectionStatus = WORKFLOW_STATUS.NOT_STARTED;
  if (project) {
    if (collectionValidation) {
      collectionStatus = collectionValidation.status === 'complete'
        ? WORKFLOW_STATUS.COMPLETED
        : collectionValidation.passedRequired > 0
          ? WORKFLOW_STATUS.IN_PROGRESS
          : WORKFLOW_STATUS.READY;
    } else {
      collectionStatus = inputTotal ? WORKFLOW_STATUS.COMPLETED : WORKFLOW_STATUS.READY;
    }
  }
  if (uploadActive) collectionStatus = WORKFLOW_STATUS.IN_PROGRESS;
  if (uploadFailed && !inputTotal) collectionStatus = WORKFLOW_STATUS.FAILED;

  const collection = stageBase(
    stageMap.collection,
    collectionStatus,
    collectionValidation?.passedRequired ?? inputTotal,
    collectionValidation?.requiredCount ?? Math.max(inputTotal, 1),
    collectionValidation ? '项必需校验' : '项'
  );
  collection.inputs = [
    { type: 'photo', count: photos.length, ready: photos.length > 0 },
    { type: 'asset', count: assets.length, ready: assets.length > 0 },
    { type: 'field-record', count: fieldRecords.length, ready: fieldRecords.length > 0 },
    { type: 'upload-session', count: uploadSessions.length, ready: uploadActive === 0 }
  ];
  collection.outputs = [{ type: 'governed-input', count: inputTotal }];
  if (collectionValidation) {
    collection.outputs.push({
      type: 'collection-validation',
      count: collectionValidation.passedRequired,
      total: collectionValidation.requiredCount
    });
    for (const item of collectionValidation.checks || []) {
      if (item.status === 'failed') {
        collection.warnings.push({
          code: item.code,
          message: item.message,
          details: item.details || {}
        });
      } else if (item.status === 'warning') {
        collection.warnings.push({
          code: item.code,
          message: item.message,
          details: item.details || {}
        });
      }
    }
  }
  collection.actions = [action('collection', inputTotal ? '管理项目资料' : '上传项目资料')];
  if (!project) collection.blockers.push({ code: 'PROJECT_REQUIRED', message: '请先选择项目。', sourceStage: null, resolvable: true });

  const activeAnalyses = analyses.filter((item) => ACTIVE_TASK_STATUSES.has(statusOf(item)));
  const successfulAnalyses = analyses.filter((item) => SUCCESS_TASK_STATUSES.has(statusOf(item)));
  const failedAnalyses = analyses.filter((item) => FAILED_TASK_STATUSES.has(statusOf(item)));
  const staleAnalyses = analyses.filter((item) => statusOf(item) === 'stale');
  let aiStatus;
  if (activeAnalyses.length) aiStatus = WORKFLOW_STATUS.IN_PROGRESS;
  else if (staleAnalyses.length) aiStatus = WORKFLOW_STATUS.STALE;
  else if (capabilities.ai?.ready === false && !successfulAnalyses.length) aiStatus = WORKFLOW_STATUS.UNAVAILABLE;
  else if (!photos.length) aiStatus = WORKFLOW_STATUS.BLOCKED;
  else if (successfulAnalyses.length) aiStatus = WORKFLOW_STATUS.COMPLETED;
  else if (failedAnalyses.length) aiStatus = WORKFLOW_STATUS.FAILED;
  else aiStatus = WORKFLOW_STATUS.READY;

  const ai = aiStatus === WORKFLOW_STATUS.UNAVAILABLE
    ? unavailable(stageMap['ai-analysis'], capabilities.ai?.reason || 'ai_unavailable', 0, photos.length)
    : stageBase(stageMap['ai-analysis'], aiStatus, successfulAnalyses.length, Math.max(analyses.length, 1), '次');
  ai.inputs = [{ type: 'photo', count: photos.length, ready: photos.length > 0 }];
  ai.outputs = [{ type: 'analysis', count: analyses.length }];
  ai.actions = [action('ai-analysis', activeAnalyses.length ? '查看分析进度' : '进入AI识别')];
  ai.latestRun = analyses.at(-1) || null;
  if (staleAnalyses.length) {
    ai.staleReasons = staleAnalyses.flatMap((item) => item.staleReasons || ['PHOTO_EVIDENCE_CHANGED']);
    ai.warnings.push({
      code: 'AI_ANALYSIS_STALE',
      message: 'AI分析引用的照片证据已变化，请重新创建分析任务。',
      details: { analysisIds: staleAnalyses.map((item) => item.id) }
    });
  }
  if (capabilities.ai?.ready === false && successfulAnalyses.length) {
    ai.capability = { ready: false, reason: capabilities.ai?.reason || 'ai_unavailable' };
    ai.warnings.push({
      code: 'AI_CURRENTLY_UNAVAILABLE',
      message: '历史分析结果仍有效，但当前无法创建新的AI分析。',
      details: {}
    });
  }
  if (capabilities.ai?.ready === false && staleAnalyses.length) {
    ai.capability = { ready: false, reason: capabilities.ai?.reason || 'ai_unavailable' };
    ai.warnings.push({
      code: 'AI_STALE_REANALYSIS_UNAVAILABLE',
      message: '照片证据已变化，但当前AI能力不可用，暂时无法重新分析。',
      details: {}
    });
  }
  if (!photos.length && ai.status !== WORKFLOW_STATUS.UNAVAILABLE) {
    ai.blockers.push({ code: 'ANALYZABLE_PHOTO_REQUIRED', message: '没有可分析照片。', sourceStage: 'collection', resolvable: true });
  }

  const candidates = candidateItems(analyses);
  const pendingCandidates = candidates.filter((item) => !item.reviewStatus || item.reviewStatus === 'pending');
  const reviewedCandidates = candidates.length - pendingCandidates.length;
  const archivedAnalyses = analyses.filter((item) => ['archived', 'reviewed'].includes(statusOf(item)));
  const archivedManualReviews = reviewConclusions.filter((item) => ['archived', 'completed'].includes(statusOf(item)));
  let reviewStatus = WORKFLOW_STATUS.NOT_STARTED;
  if (activeAnalyses.length) reviewStatus = WORKFLOW_STATUS.BLOCKED;
  else if (candidates.length && pendingCandidates.length === candidates.length) reviewStatus = WORKFLOW_STATUS.READY;
  else if (pendingCandidates.length) reviewStatus = WORKFLOW_STATUS.IN_PROGRESS;
  else if (successfulAnalyses.length || archivedAnalyses.length || archivedManualReviews.length) reviewStatus = WORKFLOW_STATUS.COMPLETED;
  else if (project && capabilities.ai?.ready === false) reviewStatus = WORKFLOW_STATUS.READY;
  if (staleAnalyses.length && !archivedManualReviews.length && !officialIssues.length) {
    reviewStatus = WORKFLOW_STATUS.BLOCKED;
  }

  const review = stageBase(stageMap['human-review'], reviewStatus, reviewedCandidates, candidates.length, '项');
  review.inputs = [
    { type: 'analysis-candidate', count: candidates.length, ready: candidates.length > 0 || successfulAnalyses.length > 0 },
    { type: 'manual-review', count: reviewConclusions.length, ready: archivedManualReviews.length > 0 }
  ];
  review.outputs = [{ type: 'official-issue', count: officialIssues.length }];
  review.actions = [action(
    'human-review',
    pendingCandidates.length
      ? '继续人工复核'
      : reviewStatus === WORKFLOW_STATUS.READY
        ? '进入人工补录与复核'
        : '查看复核结果'
  )];
  if (activeAnalyses.length) {
    review.blockers.push({ code: 'AI_ANALYSIS_INCOMPLETE', message: 'AI分析尚未完成。', sourceStage: 'ai-analysis', resolvable: true });
  }
  if (staleAnalyses.length && reviewStatus === WORKFLOW_STATUS.BLOCKED) {
    review.blockers.push({
      code: 'AI_ANALYSIS_STALE',
      message: '照片证据已变化，需要重新分析后再复核候选问题。',
      sourceStage: 'ai-analysis',
      resolvable: true
    });
  }

  const boundIssues = officialIssues.filter(hasGeometry);
  const staleSpatialAnalyses = spatialAnalyses.filter((item) => statusOf(item) === 'stale');
  let gisStatus;
  if (capabilities.gis?.ready === false) gisStatus = WORKFLOW_STATUS.UNAVAILABLE;
  else if (!officialIssues.length && reviewStatus === WORKFLOW_STATUS.COMPLETED) gisStatus = WORKFLOW_STATUS.COMPLETED;
  else if (!officialIssues.length) gisStatus = WORKFLOW_STATUS.NOT_STARTED;
  else if (staleSpatialAnalyses.length) gisStatus = WORKFLOW_STATUS.STALE;
  else if (boundIssues.length === officialIssues.length) gisStatus = WORKFLOW_STATUS.COMPLETED;
  else if (boundIssues.length) gisStatus = WORKFLOW_STATUS.IN_PROGRESS;
  else gisStatus = WORKFLOW_STATUS.READY;

  const gis = gisStatus === WORKFLOW_STATUS.UNAVAILABLE
    ? unavailable(stageMap['gis-and-issues'], capabilities.gis?.reason || 'gis_unavailable', boundIssues.length, officialIssues.length)
    : stageBase(stageMap['gis-and-issues'], gisStatus, boundIssues.length, officialIssues.length, '项');
  gis.inputs = [{ type: 'official-issue', count: officialIssues.length, ready: reviewStatus === WORKFLOW_STATUS.COMPLETED }];
  gis.outputs = [
    { type: 'spatial-binding', count: boundIssues.length },
    { type: 'spatial-analysis', count: spatialAnalyses.length }
  ];
  gis.actions = [action('gis-and-issues', officialIssues.length ? '进入GIS工作台' : '查看无问题结论')];
  if (staleSpatialAnalyses.length) {
    gis.staleReasons = staleSpatialAnalyses.flatMap((item) => item.staleReasons || ['SPATIAL_INPUT_CHANGED']);
    gis.warnings.push({
      code: 'SPATIAL_ANALYSIS_STALE',
      message: '空间分析输入已变化，请使用真实参数重新运行。',
      details: { runIds: staleSpatialAnalyses.map((item) => item.id) }
    });
  }

  let indicators;
  if (capabilities.indicator?.ready !== true) {
    indicators = unavailable(
      stageMap.indicators,
      capabilities.indicator?.reason || 'indicator_engine_not_integrated',
      0,
      Number(input.standardIndicatorCount || 61)
    );
  } else {
    const activeRuns = indicatorRuns.filter((item) => ACTIVE_TASK_STATUSES.has(statusOf(item)));
    const successfulRuns = indicatorRuns.filter((item) => SUCCESS_TASK_STATUSES.has(statusOf(item)));
    const failedRuns = indicatorRuns.filter((item) => FAILED_TASK_STATUSES.has(statusOf(item)));
    let indicatorStatus = WORKFLOW_STATUS.READY;
    if (activeRuns.length) indicatorStatus = WORKFLOW_STATUS.IN_PROGRESS;
    else if (successfulRuns.length) indicatorStatus = WORKFLOW_STATUS.COMPLETED;
    else if (failedRuns.length) indicatorStatus = WORKFLOW_STATUS.FAILED;
    indicators = stageBase(stageMap.indicators, indicatorStatus, successfulRuns.length, Math.max(indicatorRuns.length, 1), '次');
    indicators.latestRun = indicatorRuns.at(-1) || null;
  }
  indicators.inputs = [
    { type: 'official-issue', count: officialIssues.length, ready: reviewStatus === WORKFLOW_STATUS.COMPLETED },
    { type: 'spatial-analysis', count: spatialAnalyses.length, ready: gisStatus === WORKFLOW_STATUS.COMPLETED }
  ];
  indicators.outputs = [{ type: 'indicator-run', count: indicatorRuns.length }];
  indicators.actions = [action('indicators', indicators.status === WORKFLOW_STATUS.UNAVAILABLE ? '查看指标接入状态' : '进入指标核算')];

  const activeReports = reports.filter((item) => ACTIVE_TASK_STATUSES.has(statusOf(item)));
  const successfulReports = reports.filter((item) => SUCCESS_TASK_STATUSES.has(statusOf(item)));
  const staleReports = reports.filter((item) => statusOf(item) === 'stale');
  const latestReport = reports.reduce((latest, item) => {
    if (!latest) return item;
    const itemVersion = Number(item?.version) || 0;
    const latestVersion = Number(latest?.version) || 0;
    if (itemVersion !== latestVersion) return itemVersion > latestVersion ? item : latest;
    const itemTime = String(item?.generatedAt || item?.updatedAt || '');
    const latestTime = String(latest?.generatedAt || latest?.updatedAt || '');
    return itemTime > latestTime ? item : latest;
  }, null);
  let reportStatus;
  if (capabilities.report?.ready === false) reportStatus = WORKFLOW_STATUS.UNAVAILABLE;
  else if (activeReports.length) reportStatus = WORKFLOW_STATUS.IN_PROGRESS;
  else if (statusOf(latestReport) === 'stale') reportStatus = WORKFLOW_STATUS.STALE;
  else if (latestReport && SUCCESS_TASK_STATUSES.has(statusOf(latestReport))) reportStatus = WORKFLOW_STATUS.COMPLETED;
  else if (latestReport && FAILED_TASK_STATUSES.has(statusOf(latestReport))) reportStatus = WORKFLOW_STATUS.FAILED;
  else if (reviewStatus === WORKFLOW_STATUS.COMPLETED) reportStatus = WORKFLOW_STATUS.READY;
  else reportStatus = WORKFLOW_STATUS.NOT_STARTED;

  const report = reportStatus === WORKFLOW_STATUS.UNAVAILABLE
    ? unavailable(stageMap.reports, capabilities.report?.reason || 'report_unavailable', 0, reports.length)
    : stageBase(stageMap.reports, reportStatus, successfulReports.length, Math.max(reports.length, 1), '份');
  report.inputs = [
    { type: 'official-issue', count: officialIssues.length, ready: reviewStatus === WORKFLOW_STATUS.COMPLETED },
    { type: 'spatial-analysis', count: spatialAnalyses.length, ready: gisStatus === WORKFLOW_STATUS.COMPLETED },
    { type: 'indicator-run', count: indicatorRuns.length, ready: indicators.status === WORKFLOW_STATUS.COMPLETED }
  ];
  report.outputs = [{ type: 'report', count: reports.length }];
  report.actions = [action('reports', reports.length ? '查看报告' : '创建报告草稿')];
  if (indicators.status === WORKFLOW_STATUS.UNAVAILABLE) {
    report.warnings.push({
      code: 'INDICATOR_ENGINE_UNAVAILABLE',
      message: '指标引擎尚未接入，只能生成明确标记数据不完整的草稿。',
      details: {}
    });
  }
  if (staleReports.length) {
    report.staleReasons = staleReports.flatMap((item) => item.staleReasons || ['REPORT_INPUT_CHANGED']);
    report.warnings.push({
      code: 'REPORT_STALE',
      message: '报告引用的数据已变化，请生成新版本。',
      details: { reportIds: staleReports.map((item) => item.id) }
    });
  }

  const stages = [collection, ai, review, gis, indicators, report];
  const current =
    stages.find((item) => item.status === WORKFLOW_STATUS.IN_PROGRESS) ||
    stages.find((item) => item.status === WORKFLOW_STATUS.BLOCKED) ||
    stages.find((item) => item.status === WORKFLOW_STATUS.STALE) ||
    stages.find((item) => item.status === WORKFLOW_STATUS.READY) ||
    stages.at(-1);

  return {
    projectId: String(project?.id || input.projectId || ''),
    computedAt: new Date().toISOString(),
    projectRevision: Number(project?.revision || 0),
    overall: {
      currentStage: current?.id || 'collection',
      completedCount: countWhere(stages, (item) => item.status === WORKFLOW_STATUS.COMPLETED),
      blockedCount: countWhere(stages, (item) => item.status === WORKFLOW_STATUS.BLOCKED),
      unavailableCount: countWhere(stages, (item) => item.status === WORKFLOW_STATUS.UNAVAILABLE),
      hasStaleResults: stages.some((item) => item.status === WORKFLOW_STATUS.STALE)
    },
    stages
  };
}
