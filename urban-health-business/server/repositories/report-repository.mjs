import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

function clean(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function safeReportId(value) {
  const id = String(value || '');
  if (!/^RPT-BIZ-[A-Za-z0-9_.-]+$/.test(id)) {
    const error = new Error('报告编号无效。');
    error.status = 400;
    error.code = 'INVALID_REPORT_ID';
    throw error;
  }
  return id;
}

export function buildReportDraft(project, issues, analyses, existing, input, options = {}) {
  const projectId = String(project.id);
  const reports = Array.isArray(existing) ? existing : [];
  const version = reports.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  const now = options.now || new Date().toISOString();
  const officialIssues = Array.isArray(issues) ? issues : [];
  const analysisRuns = Array.isArray(analyses) ? analyses : [];
  const reviewConclusions = Array.isArray(options.reviewConclusions) ? options.reviewConclusions : [];
  const spatialAnalyses = Array.isArray(options.spatialAnalyses) ? options.spatialAnalyses : [];
  const photos = Array.isArray(options.photos) ? options.photos : [];
  const severity = {
    high: officialIssues.filter((item) => item.severity === 'high').length,
    medium: officialIssues.filter((item) => item.severity === 'medium').length,
    low: officialIssues.filter((item) => item.severity === 'low').length
  };
  return {
    id: `RPT-BIZ-${projectId}-${String(version).padStart(4, '0')}`,
    projectId,
    version,
    title: clean(input?.title, 200) || `${project.name || '未命名项目'}城市体检报告`,
    generatedBy: clean(input?.generatedBy, 120),
    status: 'generated',
    reportRevision: 1,
    editorial: {
      executiveSummary: clean(input?.executiveSummary, 4000),
      recommendations: clean(input?.recommendations, 4000),
      notes: clean(input?.notes, 4000)
    },
    auditTrail: [{
      revision: 1,
      action: 'report_created',
      actor: clean(input?.generatedBy, 120),
      at: now
    }],
    generatedAt: now,
    projectSnapshot: {
      id: projectId,
      name: project.name || '',
      area: project.area || '',
      type: project.type || '',
      revision: Number(project.revision) || 0,
      boundaryStatus: Array.isArray(project.scopeBoundary) && project.scopeBoundary.length >= 3
        ? 'available'
        : 'missing'
    },
    dataSnapshot: {
      officialIssueCount: officialIssues.length,
      severity,
      locatedIssueCount: officialIssues.filter((item) => Array.isArray(item?.geometry?.coordinates)).length,
      analysisRunCount: analysisRuns.length,
      manualReviewCount: reviewConclusions.length,
      spatialAnalysisCount: spatialAnalyses.length,
      issueIds: officialIssues.map((item) => item.id),
      issueRevisions: officialIssues.map((item) => ({
        id: String(item.id),
        issueRevision: Number(item.issueRevision) || 0,
        geometryRevision: Number(item.geometryRevision) || 0,
        updatedAt: item.updatedAt || null
      })),
      analysisIds: analysisRuns.map((item) => item.id),
      reviewConclusionIds: reviewConclusions.map((item) => item.id),
      spatialAnalysisIds: spatialAnalyses.map((item) => item.id),
      photoRevisions: photos.map((item) => ({
        id: String(item.id),
        contentHash: item.contentHash || null,
        metadataRevision: Number(item.metadataRevision) || 0,
        governanceStatus: item.governanceStatus || 'active'
      }))
    },
    indicatorSnapshot: {
      status: 'unavailable',
      reason: 'indicator_engine_not_integrated',
      results: [],
      score: null
    },
    notices: [
      '本报告快照仅使用生成时已持久化的真实业务数据。',
      '指标引擎尚未接入，本版本不包含指标值、权重、扣分或综合得分。'
    ],
    schemaVersion: '1.0.0'
  };
}

export class ReportRepository {
  constructor(root) {
    this.root = root;
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async list(projectId = '') {
    await this.ensure();
    const names = await readdir(this.root);
    const items = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const report = JSON.parse(await readFile(path.join(this.root, name), 'utf8'));
      if (projectId && String(report.projectId) !== String(projectId)) continue;
      items.push(report);
    }
    return items.sort((a, b) => Number(b.version) - Number(a.version));
  }

  async put(report) {
    await this.ensure();
    const id = safeReportId(report?.id);
    const target = path.join(this.root, `${id}.json`);
    const temporary = path.join(this.root, `${id}.${Date.now()}.tmp`);
    await writeFile(temporary, JSON.stringify(report), 'utf8');
    await rename(temporary, target);
    return report;
  }

  async get(reportId) {
    await this.ensure();
    const id = safeReportId(reportId);
    try {
      return JSON.parse(await readFile(path.join(this.root, `${id}.json`), 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async update(reportId, input, options = {}) {
    const report = await this.get(reportId);
    if (!report) {
      const error = new Error('Business报告不存在。');
      error.status = 404;
      error.code = 'REPORT_NOT_FOUND';
      throw error;
    }
    if (report.migration?.readOnly === true) {
      const error = new Error('迁移报告为只读历史快照，不能编辑。');
      error.status = 409;
      error.code = 'MIGRATED_REPORT_READ_ONLY';
      throw error;
    }
    const expectedRevision = Number(input?.expectedRevision);
    const currentRevision = Math.max(1, Number(report.reportRevision) || 1);
    if (Number.isFinite(expectedRevision) && expectedRevision !== currentRevision) {
      const error = new Error('报告已被其他修改覆盖，请刷新后重试。');
      error.status = 409;
      error.code = 'REPORT_REVISION_CONFLICT';
      throw error;
    }
    const updatedBy = clean(input?.updatedBy, 120);
    if (!updatedBy) {
      const error = new Error('请填写报告修改人员。');
      error.status = 400;
      error.code = 'REPORT_EDITOR_REQUIRED';
      throw error;
    }
    const title = input?.title == null ? report.title : clean(input.title, 200);
    if (!title) {
      const error = new Error('报告标题不能为空。');
      error.status = 400;
      error.code = 'REPORT_TITLE_REQUIRED';
      throw error;
    }
    const now = options.now || new Date().toISOString();
    const nextRevision = currentRevision + 1;
    const updated = {
      ...report,
      title,
      editorial: {
        executiveSummary: input?.executiveSummary == null
          ? report.editorial?.executiveSummary || ''
          : clean(input.executiveSummary, 4000),
        recommendations: input?.recommendations == null
          ? report.editorial?.recommendations || ''
          : clean(input.recommendations, 4000),
        notes: input?.notes == null
          ? report.editorial?.notes || ''
          : clean(input.notes, 4000)
      },
      reportRevision: nextRevision,
      updatedAt: now,
      auditTrail: [
        ...(Array.isArray(report.auditTrail) ? report.auditTrail : []),
        {
          revision: nextRevision,
          action: 'report_edited',
          actor: updatedBy,
          at: now
        }
      ]
    };
    return this.put(updated);
  }

  async create(project, issues, analyses, input, options = {}) {
    if (!clean(input?.generatedBy, 120)) {
      const error = new Error('请填写报告生成人员。');
      error.status = 400;
      error.code = 'REPORT_AUTHOR_REQUIRED';
      throw error;
    }
    const report = buildReportDraft(
      project,
      issues,
      analyses,
      await this.list(project.id),
      input,
      options
    );
    return this.put(report);
  }
}
