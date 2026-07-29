function clean(value, maxLength = 4000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const severityLabels = { high: '高风险', medium: '中风险', low: '低风险' };

export function buildReportContentSnapshot(project, issues, analyses, options = {}) {
  const officialIssues = Array.isArray(issues) ? issues : [];
  const communities = (Array.isArray(project?.residentialInventory?.items)
    ? project.residentialInventory.items
    : [])
    .filter((community) => community.status !== 'deleted')
    .map((community) => ({
      id: String(community.id || community.sourceId || ''),
      name: clean(community.name, 160),
      address: clean(community.address, 300),
      buildingCount: (Array.isArray(community.buildings) ? community.buildings : [])
        .filter((building) => building.status !== 'deleted').length
    }));
  const issueRows = officialIssues.map((issue) => ({
    id: String(issue.id),
    title: clean(issue.title, 200),
    severity: ['high', 'medium', 'low'].includes(issue.severity) ? issue.severity : 'medium',
    categoryName: clean(issue.categoryName || issue.categoryCode || '未分类', 160),
    description: clean(issue.description || issue.desc, 2000),
    evidence: clean(issue.evidence, 2000),
    suggestion: clean(issue.suggestion, 2000),
    communityId: clean(issue.communityId, 120),
    buildingId: clean(issue.buildingId, 120),
    originalPhotoId: clean(issue.originalPhotoId, 120) || null,
    annotatedPhotoId: clean(issue.annotatedPhotoId, 120) || null,
    geometry: Array.isArray(issue?.geometry?.coordinates)
      ? issue.geometry.coordinates.slice(0, 2).map(Number)
      : null
  }));
  const riskOrder = { high: 0, medium: 1, low: 2 };
  issueRows.sort((left, right) =>
    riskOrder[left.severity] - riskOrder[right.severity]
    || left.title.localeCompare(right.title, 'zh-CN')
  );
  const analysisRows = (Array.isArray(analyses) ? analyses : []).map((analysis) => ({
    id: String(analysis.id),
    analysisType: clean(analysis.analysisType || '综合巡检分析', 160),
    status: clean(analysis.status, 40),
    imagesCount: Number(analysis.imagesCount) || 0,
    model: clean(analysis.model, 160),
    completedAt: analysis.completedAt || analysis.archivedAt || null
  }));
  const spatialRows = (Array.isArray(options.spatialAnalyses) ? options.spatialAnalyses : [])
    .map((run) => ({
      id: String(run.id),
      type: clean(run.type, 80),
      status: clean(run.status, 40),
      result: run.result || null
    }));
  return {
    project: {
      id: String(project.id),
      name: clean(project.name, 200),
      area: clean(project.area, 200),
      type: clean(project.type, 120),
      description: clean(project.description, 2000),
      communityCount: communities.length,
      buildingCount: communities.reduce((total, community) => total + community.buildingCount, 0)
    },
    communities,
    issues: issueRows,
    analyses: analysisRows,
    spatialAnalyses: spatialRows,
    annotatedPhotos: issueRows
      .filter((issue) => issue.annotatedPhotoId)
      .map((issue) => ({
        photoId: issue.annotatedPhotoId,
        sourcePhotoId: issue.originalPhotoId,
        issueId: issue.id,
        title: issue.title,
        severity: issue.severity
      })),
    sourceIds: {
      projectId: String(project.id),
      analysisIds: analysisRows.map((analysis) => analysis.id),
      officialIssueIds: issueRows.map((issue) => issue.id),
      spatialAnalysisIds: spatialRows.map((run) => run.id),
      reviewConclusionIds: (Array.isArray(options.reviewConclusions) ? options.reviewConclusions : [])
        .map((review) => String(review.id)),
      photoIds: (Array.isArray(options.photos) ? options.photos : []).map((photo) => String(photo.id))
    }
  };
}

export function buildReportSections(report) {
  const snapshot = report.contentSnapshot || {};
  return [
    { id: 'overview', title: '项目概况', kind: 'project', itemCount: 1 },
    { id: 'risk-summary', title: '风险统计', kind: 'metrics', itemCount: snapshot.issues?.length || 0 },
    { id: 'ai-issues', title: 'AI识别与人工复核问题', kind: 'issue-table', itemCount: snapshot.issues?.length || 0 },
    { id: 'communities', title: '社区与楼栋概况', kind: 'community-table', itemCount: snapshot.communities?.length || 0 },
    { id: 'spatial', title: '空间分析', kind: 'spatial', itemCount: snapshot.spatialAnalyses?.length || 0 },
    { id: 'assessment', title: '综合研判', kind: 'editorial', itemCount: 1 },
    { id: 'actions', title: '行动建议', kind: 'editorial', itemCount: 1 },
    { id: 'evidence', title: '标注照片画廊', kind: 'photo-gallery', itemCount: snapshot.annotatedPhotos?.length || 0 },
    { id: 'indicator-gap', title: '指标数据说明', kind: 'notice', itemCount: 0, status: report.indicatorSnapshot?.status || 'unavailable' },
    { id: 'source-index', title: '来源索引', kind: 'source-index', itemCount: Object.values(snapshot.sourceIds || {}).flat().length }
  ];
}

function issueTable(issues) {
  if (!issues.length) return '<p class="empty">本次人工复核结论为未发现正式问题。</p>';
  return `<table><thead><tr><th>等级</th><th>问题</th><th>分类</th><th>证据</th><th>建议</th></tr></thead><tbody>${
    issues.map((issue) => `<tr><td><span class="risk risk-${escapeHtml(issue.severity)}">${escapeHtml(severityLabels[issue.severity] || issue.severity)}</span></td><td><strong>${escapeHtml(issue.title)}</strong><small>${escapeHtml(issue.id)}</small></td><td>${escapeHtml(issue.categoryName)}</td><td>${escapeHtml(issue.evidence || issue.description || '未记录')}</td><td>${escapeHtml(issue.suggestion || '待制定')}</td></tr>`).join('')
  }</tbody></table>`;
}

function communityTable(communities) {
  if (!communities.length) return '<p class="empty">项目未记录社区台账。</p>';
  return `<table><thead><tr><th>社区</th><th>地址</th><th>楼栋数</th></tr></thead><tbody>${
    communities.map((community) => `<tr><td>${escapeHtml(community.name || community.id)}</td><td>${escapeHtml(community.address || '未记录')}</td><td>${community.buildingCount}</td></tr>`).join('')
  }</tbody></table>`;
}

function photoGallery(photos) {
  if (!photos.length) return '<p class="empty">本版本没有标注照片。</p>';
  return `<div class="gallery">${photos.map((photo) => `<figure><img src="/api/photos/${encodeURIComponent(photo.photoId)}/content" alt="${escapeHtml(photo.title)}"><figcaption>${escapeHtml(photo.title)} · ${escapeHtml(severityLabels[photo.severity] || photo.severity)}</figcaption></figure>`).join('')}</div>`;
}

export function renderReportHtml(report) {
  const snapshot = report.contentSnapshot || {};
  const project = snapshot.project || report.projectSnapshot || {};
  const issues = Array.isArray(snapshot.issues) ? snapshot.issues : [];
  const communities = Array.isArray(snapshot.communities) ? snapshot.communities : [];
  const photos = Array.isArray(snapshot.annotatedPhotos) ? snapshot.annotatedPhotos : [];
  const severity = report.dataSnapshot?.severity || {};
  const sources = snapshot.sourceIds || {};
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
<style>
*{box-sizing:border-box}body{font-family:"Microsoft YaHei",sans-serif;color:#17252b;max-width:1040px;margin:36px auto;line-height:1.65;padding:0 22px}
h1{border-bottom:3px solid #1593a3;padding-bottom:12px}h2{margin-top:34px;color:#126b78;border-bottom:1px solid #dbe5e7;padding-bottom:7px}
.meta,.source-index{color:#60747b}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metrics div{border:1px solid #c9d6d9;padding:12px}.notice{background:#fff7dc;border-left:4px solid #d9a820;padding:10px 14px}.empty{color:#60747b}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #d7e1e3;padding:8px;text-align:left;vertical-align:top}th{background:#edf5f6}td small{display:block;color:#73868c}
.risk{white-space:nowrap;font-weight:700}.risk-high{color:#b42318}.risk-medium{color:#b25e09}.risk-low{color:#18794e}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.gallery figure{margin:0;border:1px solid #d7e1e3}.gallery img{display:block;width:100%;height:auto}.gallery figcaption{padding:8px}
@media print{body{margin:14mm;max-width:none}.no-print{display:none}.gallery figure{break-inside:avoid}h2{break-after:avoid}table{font-size:10px}}
</style></head><body>
<button class="no-print" onclick="window.print()">打印 / 另存为PDF</button>
<h1>${escapeHtml(report.title)}</h1>
<p class="meta">版本 V${Number(report.version) || 1} · 修订 ${Number(report.reportRevision) || 1} · ${escapeHtml(report.generatedAt || '')}</p>
<h2>项目概况</h2><p><strong>${escapeHtml(project.name || '')}</strong> · ${escapeHtml(project.area || '区域未记录')} · ${Number(project.communityCount) || 0}个社区 · ${Number(project.buildingCount) || 0}栋楼</p><p>${escapeHtml(project.description || '项目说明未记录。')}</p>
<h2>风险统计</h2><div class="metrics"><div>正式问题<br><strong>${issues.length}</strong></div><div>高风险<br><strong>${Number(severity.high) || 0}</strong></div><div>中风险<br><strong>${Number(severity.medium) || 0}</strong></div><div>低风险<br><strong>${Number(severity.low) || 0}</strong></div></div>
<h2>AI识别与人工复核问题</h2>${issueTable(issues)}
<h2>社区与楼栋概况</h2>${communityTable(communities)}
<h2>空间分析</h2><p>已定位问题 ${Number(report.dataSnapshot?.locatedIssueCount) || 0}；已归档空间分析 ${snapshot.spatialAnalyses?.length || 0} 次。</p>
<h2>综合研判</h2><p>${escapeHtml(report.editorial?.executiveSummary || '尚未编辑综合研判。')}</p>
<h2>行动建议</h2><p>${escapeHtml(report.editorial?.recommendations || '尚未编辑行动建议。')}</p>
<h2>标注照片画廊</h2>${photoGallery(photos)}
<h2>指标数据说明</h2><p class="notice">${escapeHtml((report.notices || []).join(' '))}</p>
<h2>来源索引</h2><p class="source-index">项目 ${escapeHtml(sources.projectId || project.id || '')}；分析 ${(sources.analysisIds || []).map(escapeHtml).join('、') || '无'}；正式问题 ${(sources.officialIssueIds || []).map(escapeHtml).join('、') || '无'}；空间分析 ${(sources.spatialAnalysisIds || []).map(escapeHtml).join('、') || '无'}。</p>
</body></html>`;
}
