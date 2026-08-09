import { mergePrimaryReadModel } from '../adapters/smart-renew/read-model-policy.mjs';
import { getProjectSummary, getProjectWorkflow } from './workflow-service.mjs';

function boundedNumber(value, fallback, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, parsed)) : fallback;
}

function projectName(project) {
  return String(project?.name || project?.title || project?.id || '未命名项目');
}

async function projectOutcome(client, projectId, dependencies) {
  const [summary, workflow, project, businessIssues, legacyIssues] = await Promise.all([
    getProjectSummary(client, projectId, dependencies.issueRepository, dependencies.reportRepository,
      dependencies.analysisJobRepository, dependencies.uploadSessionRepository,
      dependencies.reviewSessionRepository, dependencies.spatialAnalysisRepository,
      dependencies.photoMetadataRepository, dependencies.sourceAssetRepository),
    getProjectWorkflow(client, projectId, dependencies.issueRepository, dependencies.reportRepository,
      dependencies.analysisJobRepository, dependencies.uploadSessionRepository,
      dependencies.reviewSessionRepository, dependencies.spatialAnalysisRepository,
      dependencies.photoMetadataRepository, dependencies.sourceAssetRepository),
    client.getProject(projectId),
    dependencies.issueRepository.list(projectId),
    client.listIssues({ projectId })
  ]);
  const counts = summary.counts || {};
  const reports = Array.isArray(workflow.reports) ? workflow.reports : [];
  const issues = mergePrimaryReadModel('officialIssue', {
    businessItems: businessIssues,
    legacyItems: legacyIssues.items
  });
  const unboundIssues = issues.filter((issue) =>
    !['confirmed', 'suggested'].includes(issue.bindingStatus)
    && !issue.problemCode
  ).length;
  return {
    projectId: String(projectId),
    name: projectName(project),
    area: project.area || '',
    type: project.type || '',
    revision: Number(project.revision) || 0,
    overall: workflow.overall || null,
    stages: workflow.stages || [],
    counts: {
      ...counts,
      locatedIssues: issues.filter((issue) => Array.isArray(issue.geometry?.coordinates)).length,
      unboundIssues,
      highRiskIssues: issues.filter((issue) => issue.severity === 'high').length,
      mediumRiskIssues: issues.filter((issue) => issue.severity === 'medium').length,
      lowRiskIssues: issues.filter((issue) => issue.severity === 'low').length,
      staleReports: reports.filter((report) => report.status === 'stale').length,
      latestReport: reports[0] ? {
        id: reports[0].id,
        version: reports[0].version,
        status: reports[0].status,
        title: reports[0].title
      } : null,
      issueIds: issues.map((issue) => String(issue.id))
    },
    collectionValidation: summary.collectionValidation || null,
    capabilities: summary.capabilities || null,
    updatedAt: project.updatedAt || project.boundaryUpdatedAt || null
  };
}

function projectScope(options = {}) {
  const scoped = Array.isArray(options.projectIds);
  const allowed = new Set((options.projectIds || []).map(String));
  return { scoped, allowed };
}

async function outcomeItemsForProjects(client, dependencies, projects, options = {}) {
  const batchSize = Math.max(1, Math.min(20, Number(options.batchSize) || 8));
  const items = [];
  for (let index = 0; index < projects.length; index += batchSize) {
    const batch = projects.slice(index, index + batchSize);
    items.push(...await Promise.all(batch.map((project) => projectOutcome(
      client,
      String(project.id),
      dependencies
    ))));
  }
  return items;
}

function visibleProjects(source, options = {}) {
  const scope = projectScope(options);
  return (source.items || source || [])
    .filter((project) => !scope.scoped || scope.allowed.has(String(project.id)))
    .sort((a, b) => projectName(a).localeCompare(projectName(b), 'zh-CN'));
}

export async function buildOutcomeProjects(client, dependencies, options = {}) {
  const source = await client.listProjects();
  const projects = visibleProjects(source, options);
  const offset = boundedNumber(options.offset, 0, 100000);
  const limit = boundedNumber(options.limit, 50, 200);
  const page = projects.slice(offset, offset + limit);
  const items = await outcomeItemsForProjects(client, dependencies, page, options);
  return {
    items,
    total: projects.length,
    offset,
    limit,
    projectsTotal: projects.length,
    projectsLimit: limit,
    projectsTruncated: offset + items.length < projects.length,
    source: 'business-live-project-workflows'
  };
}

export async function buildOutcomeSummary(client, dependencies, options = {}) {
  const source = await client.listProjects();
  const allProjects = visibleProjects(source, options);
  const items = await outcomeItemsForProjects(client, dependencies, allProjects, options);
  const detailLimit = boundedNumber(options.detailLimit, 200, 200);
  const summary = {
    projectCount: allProjects.length,
    projectsTotal: allProjects.length,
    projectsLimit: detailLimit,
    projectsTruncated: allProjects.length > detailLimit,
    stageStatus: {},
    issueCount: 0,
    highRiskIssueCount: 0,
    mediumRiskIssueCount: 0,
    lowRiskIssueCount: 0,
    unboundIssueCount: 0,
    archivedAnalysisCount: 0,
    locatedIssueCount: 0,
    activeSpatialAnalysisCount: 0,
    staleReportCount: 0,
    reportProjectCount: 0,
    noReportProjectCount: 0,
    collectionAnomalyProjectCount: 0,
    incompleteCollectionProjectCount: 0,
    collectionWarningProjectCount: 0,
    projects: items.slice(0, detailLimit)
  };
  for (const item of items) {
    summary.issueCount += Number(item.counts.officialIssues) || 0;
    summary.highRiskIssueCount += Number(item.counts.highRiskIssues) || 0;
    summary.mediumRiskIssueCount += Number(item.counts.mediumRiskIssues) || 0;
    summary.lowRiskIssueCount += Number(item.counts.lowRiskIssues) || 0;
    summary.unboundIssueCount += Number(item.counts.unboundIssues) || 0;
    summary.locatedIssueCount += Number(item.counts.locatedIssues) || 0;
    summary.archivedAnalysisCount += Number(item.counts.analyses) || 0;
    summary.activeSpatialAnalysisCount += Number(item.counts.spatialAnalyses) || 0;
    summary.staleReportCount += Number(item.counts.staleReports) || 0;
    if (item.counts.reports) summary.reportProjectCount += 1;
    else summary.noReportProjectCount += 1;
    const collectionIncomplete = item.collectionValidation?.status === 'incomplete';
    const collectionWarning = Number(item.collectionValidation?.warningCount) > 0;
    if (collectionIncomplete) summary.incompleteCollectionProjectCount += 1;
    if (collectionWarning) summary.collectionWarningProjectCount += 1;
    if (collectionIncomplete || collectionWarning) summary.collectionAnomalyProjectCount += 1;
    const stage = item.overall?.currentStage || 'collection';
    summary.stageStatus[stage] = (summary.stageStatus[stage] || 0) + 1;
  }
  return { ...summary, generatedAt: new Date().toISOString(), source: 'business-live-project-workflows' };
}

export async function buildOutcomeIssues(client, dependencies, options = {}) {
  const projects = await client.listProjects();
  const selected = visibleProjects(projects, options).map((project) => String(project.id));
  const items = [];
  for (const projectId of selected) {
    const [business, legacy] = await Promise.all([
      dependencies.issueRepository.list(projectId),
      client.listIssues({ projectId })
    ]);
    items.push(...mergePrimaryReadModel('officialIssue', {
      businessItems: business,
      legacyItems: legacy.items
    }).map((issue) => ({ ...issue, projectId: String(issue.projectId || projectId) })));
  }
  const offset = boundedNumber(options.offset, 0, 100000);
  const limit = boundedNumber(options.limit, 100, 500);
  return { items: items.slice(offset, offset + limit), total: items.length, offset, limit };
}

export async function buildOutcomeReports(client, dependencies, options = {}) {
  const projects = await client.listProjects();
  const scope = projectScope(options);
  const items = [];
  for (const project of (projects.items || projects || [])) {
    const projectId = String(project.id);
    if (scope.scoped && !scope.allowed.has(projectId)) continue;
    const [business, legacy] = await Promise.all([
      dependencies.reportRepository.list(projectId),
      client.listReports({ projectId })
    ]);
    items.push(...mergePrimaryReadModel('report', {
      businessItems: business,
      legacyItems: legacy.items
    }).map((report) => ({
      id: report.id,
      projectId,
      projectName: projectName(project),
      version: report.version,
      title: report.title,
      status: report.status,
      generatedAt: report.generatedAt,
      migration: report.migration || null
    })));
  }
  items.sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));
  const offset = boundedNumber(options.offset, 0, 100000);
  const limit = boundedNumber(options.limit, 100, 500);
  return { items: items.slice(offset, offset + limit), total: items.length, offset, limit };
}
