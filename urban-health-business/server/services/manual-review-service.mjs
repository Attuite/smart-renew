import { randomUUID } from 'node:crypto';

function clean(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function manualError(message, status = 400, code = 'MANUAL_REVIEW_VALIDATION_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function createManualIssue(client, issueRepository, projectId, input, options = {}) {
  const project = await client.getProject(projectId);
  const title = clean(input?.title, 120);
  const description = clean(input?.description, 2000);
  const evidence = clean(input?.evidence, 2000);
  const recordedBy = clean(input?.recordedBy, 120);
  if (!title) throw manualError('请填写问题标题。', 400, 'ISSUE_TITLE_REQUIRED');
  if (!description && !evidence) throw manualError('请填写问题描述或现场证据。', 400, 'ISSUE_EVIDENCE_REQUIRED');
  if (!recordedBy) throw manualError('请填写补录人员。', 400, 'ISSUE_RECORDER_REQUIRED');

  const originalPhotoId = clean(input?.originalPhotoId, 120);
  if (originalPhotoId) {
    const photos = await client.listPhotos({ projectId: project.id });
    if (!photos.items.some((photo) => String(photo.id) === originalPhotoId)) {
      throw manualError('所选照片不属于当前项目或已不存在。', 400, 'PHOTO_NOT_FOUND');
    }
    if (options.photoMetadataRepository) {
      const metadata = await options.photoMetadataRepository.get(originalPhotoId);
      if (metadata?.status === 'inactive') {
        throw manualError('所选照片已在资料治理中停用。', 409, 'PHOTO_INACTIVE');
      }
    }
  }
  const severity = clean(input?.severity, 20).toLowerCase();
  if (!['high', 'medium', 'low'].includes(severity)) {
    throw manualError('风险等级必须为high、medium或low。', 400, 'INVALID_SEVERITY');
  }
  const now = options.now || new Date().toISOString();
  const issue = {
    id: options.id || `ISS-MAN-${randomUUID()}`,
    projectId: String(project.id),
    analysisId: null,
    candidateId: null,
    source: 'manual',
    originalPhotoId: originalPhotoId || null,
    communityId: clean(input?.communityId, 120) || null,
    buildingId: clean(input?.buildingId, 120) || null,
    categoryCode: clean(input?.categoryCode, 50) || 'OTHER',
    categoryName: clean(input?.categoryName, 120) || '人工补录',
    title,
    description,
    evidence,
    severity,
    confidence: null,
    location: clean(input?.location, 500),
    bbox: null,
    suggestion: clean(input?.suggestion, 2000),
    problemCode: null,
    problemName: null,
    remediationSnapshot: null,
    bindingStatus: 'unbound',
    bindingAudit: [],
    geometry: null,
    spatialBinding: null,
    indicatorCode: null,
    indicatorBindingStatus: 'not_integrated',
    reviewStatus: 'manual',
    reviewerName: recordedBy,
    reviewedAt: now,
    status: 'active',
    issueRevision: 1,
    auditTrail: [{
      revision: 1,
      action: 'manual_create',
      actor: recordedBy,
      at: now
    }],
    createdAt: now,
    updatedAt: now,
    schemaVersion: '1.0.0'
  };
  return issueRepository.put(issue);
}

export async function finalizeManualReview(
  client,
  issueRepository,
  sessionRepository,
  projectId,
  input,
  options = {}
) {
  const project = await client.getProject(projectId);
  const reviewerName = clean(input?.reviewerName, 120);
  if (!reviewerName) throw manualError('请填写复核人员。', 400, 'REVIEWER_REQUIRED');
  const clientRequestId = clean(input?.clientRequestId, 160);
  const existing = await sessionRepository.findByClientRequest(String(project.id), clientRequestId);
  if (existing) return { session: existing, duplicated: true };

  const [businessIssues, legacyIssues] = await Promise.all([
    issueRepository.list(project.id),
    client.listIssues({ projectId: project.id })
  ]);
  const mergedIssues = new Map();
  for (const issue of legacyIssues.items) mergedIssues.set(String(issue.id), issue);
  for (const issue of businessIssues) mergedIssues.set(String(issue.id), issue);
  const issues = [...mergedIssues.values()];
  if (!issues.length && input?.zeroIssueConfirmed !== true) {
    throw manualError('当前没有正式问题；如确认零问题，请勾选零问题结论。', 409, 'ZERO_ISSUE_CONFIRMATION_REQUIRED');
  }
  const now = options.now || new Date().toISOString();
  const session = {
    id: options.id || `REV-MAN-${randomUUID()}`,
    clientRequestId,
    projectId: String(project.id),
    projectRevision: Number(project.revision) || 0,
    source: 'manual',
    status: 'archived',
    reviewerName,
    notes: clean(input?.notes, 2000),
    zeroIssueConfirmed: issues.length === 0,
    issueCount: issues.length,
    issueIds: issues.map((issue) => issue.id),
    archivedAt: now,
    schemaVersion: '1.0.0'
  };
  await sessionRepository.put(session);
  return { session, duplicated: false };
}
