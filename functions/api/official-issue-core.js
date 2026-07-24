const PROBLEM_CODE_PATTERN = /^PRB-(0[1-6])-\d{2}$/;
const INDICATOR_BY_GROUP = {
  '01': 'IND-HOUSE-001',
  '02': 'IND-HOUSE-002',
  '03': 'IND-HOUSE-003',
  '04': 'IND-HOUSE-004',
  '05': 'IND-HOUSE-005',
  '06': 'IND-HOUSE-006'
};

function clean(value, maxLength = 500) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

export function indicatorCodeForProblem(problemCode) {
  const match = PROBLEM_CODE_PATTERN.exec(clean(problemCode, 20));
  return match ? INDICATOR_BY_GROUP[match[1]] || '' : '';
}

export function normalizeOfficialIssue(issue, analysis, reviewerName) {
  const problemCode = clean(issue?.problemCode, 20);
  const indicatorCode = indicatorCodeForProblem(problemCode);
  if (!indicatorCode) throw new Error(`问题“${clean(issue?.title, 40) || issue?.id || ''}”尚未关联指标库编码`);
  const reviewStatus = issue?.reviewStatus === 'modified' ? 'modified' : 'confirmed';
  const imageIndex = Math.max(1, Number(issue?.imageIndex) || 1);
  const originalPhotoId = clean(analysis?.photoIds?.[imageIndex - 1], 120);
  const annotatedPhotoId = clean(analysis?.annotatedPhotoIds?.[imageIndex - 1], 120);
  if (!originalPhotoId) throw new Error('正式问题缺少原始照片编号');
  const now = new Date().toISOString();
  return {
    id: clean(issue?.id || `ISS-${analysis.id}-${imageIndex}`, 120),
    projectId: String(analysis.projectId),
    communityId: clean(issue?.communityId || analysis.communityId, 120),
    buildingId: clean(issue?.buildingId || analysis.buildingId, 120),
    analysisId: String(analysis.id),
    originalPhotoId,
    annotatedPhotoId,
    problemCode,
    indicatorCode,
    categoryCode: clean(issue?.categoryCode, 50),
    title: clean(issue?.title || '未命名问题', 120),
    description: clean(issue?.desc, 2000),
    evidence: clean(issue?.evidence, 2000),
    severity: ['high', 'medium', 'low'].includes(issue?.severity) ? issue.severity : 'medium',
    confidence: Math.max(0, Math.min(1, Number(issue?.confidence) || 0)),
    location: clean(issue?.location, 500),
    bbox: Array.isArray(issue?.bbox) ? issue.bbox.slice(0, 4) : null,
    suggestion: clean(issue?.suggestion, 2000),
    reviewStatus,
    reviewerName: clean(reviewerName, 120),
    reviewedAt: issue?.reviewedAt || now,
    status: 'active',
    createdAt: issue?.createdAt || now,
    updatedAt: now,
    schemaVersion: '1.0.0'
  };
}

export function filterOfficialIssues(items, searchParams) {
  const projectId = clean(searchParams.get('projectId'), 40);
  const communityId = clean(searchParams.get('communityId'), 120);
  const buildingId = clean(searchParams.get('buildingId'), 120);
  const indicatorCode = clean(searchParams.get('indicatorCode'), 50);
  let output = Array.isArray(items) ? items : [];
  if (projectId) output = output.filter((item) => String(item.projectId) === projectId);
  if (communityId) output = output.filter((item) => String(item.communityId) === communityId);
  if (buildingId) output = output.filter((item) => String(item.buildingId) === buildingId);
  if (indicatorCode) output = output.filter((item) => String(item.indicatorCode) === indicatorCode);
  return output.filter((item) => item.status !== 'deleted');
}
