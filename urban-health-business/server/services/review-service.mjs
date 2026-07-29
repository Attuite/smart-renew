function clean(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function reviewError(message, status = 400, code = 'REVIEW_VALIDATION_FAILED', details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function candidatesFrom(record) {
  if (Array.isArray(record?.reviewIssues)) return record.reviewIssues;
  if (Array.isArray(record?.result?.issues)) return record.result.issues;
  return [];
}

function sourcePhotoIdFor(candidate, record) {
  const imageIndex = Math.max(1, Math.trunc(Number(candidate?.imageIndex) || 1));
  return clean(candidate?.photoId || record?.photoIds?.[imageIndex - 1], 120);
}

function hasValidBbox(candidate) {
  return Array.isArray(candidate?.bbox)
    && candidate.bbox.length === 4
    && candidate.bbox.map(Number).every(Number.isFinite);
}

async function attachAnnotationEvidence(record, outcome, input, uploadSessionRepository) {
  const requiringAnnotation = outcome.accepted.filter((candidate) =>
    hasValidBbox(candidate) && sourcePhotoIdFor(candidate, record)
  );
  if (!requiringAnnotation.length) return { reviewed: outcome.reviewed, accepted: outcome.accepted, evidence: [] };
  if (!uploadSessionRepository) {
    throw reviewError('标注图归档服务不可用，当前复核尚未归档。', 503, 'ANNOTATION_ARCHIVE_UNAVAILABLE');
  }

  const submitted = Array.isArray(input?.annotatedPhotos) ? input.annotatedPhotos : [];
  const bySourcePhotoId = new Map(
    submitted.map((item) => [clean(item?.sourcePhotoId, 120), item])
  );
  const grouped = new Map();
  for (const candidate of requiringAnnotation) {
    const sourcePhotoId = sourcePhotoIdFor(candidate, record);
    if (!grouped.has(sourcePhotoId)) grouped.set(sourcePhotoId, []);
    grouped.get(sourcePhotoId).push(candidate);
  }

  const evidence = [];
  for (const [sourcePhotoId, candidates] of grouped) {
    const submittedItem = bySourcePhotoId.get(sourcePhotoId);
    const sessionId = clean(submittedItem?.uploadSessionId, 160);
    const annotatedPhotoId = clean(submittedItem?.annotatedPhotoId, 120);
    const session = sessionId ? await uploadSessionRepository.get(sessionId) : null;
    const expectedCandidateIds = candidates.map((candidate) => String(candidate.id));
    const archivedCandidateIds = new Set(
      (Array.isArray(session?.derivation?.candidateIds) ? session.derivation.candidateIds : []).map(String)
    );
    const valid = session?.status === 'completed'
      && session?.kind === 'annotated'
      && String(session.projectId) === String(record.projectId)
      && String(session.derivation?.analysisId) === String(record.id)
      && String(session.derivation?.sourcePhotoId) === sourcePhotoId
      && String(session.photoId) === annotatedPhotoId
      && expectedCandidateIds.every((candidateId) => archivedCandidateIds.has(candidateId));
    if (!valid) {
      throw reviewError(
        `原始照片${sourcePhotoId}的标注图尚未成功归档，可重试后再完成复核。`,
        409,
        'ANNOTATED_EVIDENCE_INCOMPLETE',
        { sourcePhotoId, candidateIds: expectedCandidateIds }
      );
    }
    evidence.push({
      sourcePhotoId,
      annotatedPhotoId,
      uploadSessionId: session.id,
      candidateIds: expectedCandidateIds
    });
  }

  const evidenceByCandidateId = new Map();
  for (const item of evidence) {
    for (const candidateId of item.candidateIds) evidenceByCandidateId.set(candidateId, item);
  }
  const decorate = (candidate) => {
    const item = evidenceByCandidateId.get(String(candidate.id));
    return item ? {
      ...candidate,
      annotatedPhotoId: item.annotatedPhotoId,
      annotationUploadSessionId: item.uploadSessionId
    } : candidate;
  };
  return {
    reviewed: outcome.reviewed.map(decorate),
    accepted: outcome.accepted.map(decorate),
    evidence
  };
}

export function normalizeCandidateChanges(changes) {
  if (!changes || typeof changes !== 'object') return {};
  const result = {};
  for (const [field, limit] of Object.entries({
    title: 120,
    desc: 2000,
    evidence: 2000,
    categoryCode: 50,
    categoryName: 120,
    location: 500,
    suggestion: 2000
  })) {
    if (changes[field] !== undefined) result[field] = clean(changes[field], limit);
  }
  if (changes.severity !== undefined) {
    const severity = clean(changes.severity, 20).toLowerCase();
    if (!['high', 'medium', 'low'].includes(severity)) {
      throw reviewError('候选风险等级无效。', 400, 'INVALID_SEVERITY');
    }
    result.severity = severity;
  }
  if (Object.hasOwn(changes, 'bbox')) {
    const bbox = Array.isArray(changes.bbox) ? changes.bbox.map(Number) : [];
    if (
      bbox.length !== 4
      || bbox.some((value) => !Number.isFinite(value) || value < 0 || value > 999)
      || bbox[2] <= bbox[0]
      || bbox[3] <= bbox[1]
    ) {
      throw reviewError('候选标注框必须是0—999范围内且右下角大于左上角的4个数字。', 400, 'INVALID_BBOX');
    }
    result.bbox = bbox;
  }
  if (Object.hasOwn(result, 'title') && !result.title) {
    throw reviewError('候选标题不能为空。', 400, 'CANDIDATE_TITLE_REQUIRED');
  }
  return result;
}

export function applyReviewDecisions(record, input, options = {}) {
  const candidates = candidatesFrom(record);
  const decisions = Array.isArray(input?.decisions) ? input.decisions : [];
  const decisionMap = new Map(decisions.map((item) => [String(item?.candidateId || ''), item]));
  const reviewerName = clean(input?.reviewerName, 120);
  if (!reviewerName) throw reviewError('请填写复核人员。', 400, 'REVIEWER_REQUIRED');
  if (!candidates.length && record?.status !== 'reviewing') {
    throw reviewError('当前分析没有可复核候选。', 409, 'NO_REVIEW_CANDIDATES');
  }

  const now = options.now || new Date().toISOString();
  const reviewed = candidates.map((candidate) => {
    const decision = decisionMap.get(String(candidate.id));
    const requestedStatus = clean(decision?.status || candidate.reviewStatus, 20).toLowerCase();
    const changes = normalizeCandidateChanges(decision?.changes);
    const status = requestedStatus === 'accepted'
      ? Object.keys(changes).length || candidate.reviewStatus === 'modified' ? 'modified' : 'accepted'
      : requestedStatus === 'modified'
        ? 'modified'
        : requestedStatus === 'excluded' || requestedStatus === 'rejected'
          ? 'excluded'
          : 'pending';
    return {
      ...candidate,
      ...changes,
      reviewStatus: status,
      reviewedAt: status === 'pending' ? candidate.reviewedAt || null : now
    };
  });
  const pending = reviewed.filter((item) => item.reviewStatus === 'pending');
  if (pending.length) {
    throw reviewError(`仍有${pending.length}个候选问题待复核。`, 409, 'REVIEW_INCOMPLETE', {
      pendingCandidateIds: pending.map((item) => item.id)
    });
  }

  const accepted = reviewed.filter((item) => ['accepted', 'modified'].includes(item.reviewStatus));
  return {
    reviewed,
    accepted,
    archivedRecord: {
      ...record,
      reviewIssues: reviewed,
      result: {
        ...(record.result || {}),
        issues: accepted
      },
      reviewerName,
      status: 'archived',
      archivedAt: now,
      updatedAt: now
    }
  };
}

export async function finalizeReview(
  client,
  issueRepository,
  analysisId,
  input,
  options = {},
  candidateRepository = null
) {
  const record = await client.getAnalysis(analysisId);
  if (record?.status === 'archived') {
    const issueIds = Array.isArray(record.officialIssueIds) ? record.officialIssueIds : [];
    const officialIssues = (await Promise.all(
      issueIds.map((issueId) => issueRepository.get?.(issueId))
    )).filter(Boolean);
    const reviewed = candidatesFrom(record);
    return {
      analysis: record,
      officialIssues,
      acceptedCount: reviewed.filter((item) => ['accepted', 'modified'].includes(item.reviewStatus)).length,
      excludedCount: reviewed.filter((item) => ['excluded', 'rejected'].includes(item.reviewStatus)).length,
      duplicated: true
    };
  }
  if (typeof options.assertAnalysisFresh === 'function') {
    await options.assertAnalysisFresh(record);
  }
  const outcome = applyReviewDecisions(record, input, options);
  const annotated = await attachAnnotationEvidence(
    record,
    outcome,
    input,
    options.uploadSessionRepository
  );
  outcome.reviewed = annotated.reviewed;
  outcome.accepted = annotated.accepted;
  outcome.archivedRecord = {
    ...outcome.archivedRecord,
    reviewIssues: annotated.reviewed,
    result: {
      ...(outcome.archivedRecord.result || {}),
      issues: annotated.accepted
    },
    annotationEvidence: annotated.evidence,
    annotatedPhotoIds: annotated.evidence.map((item) => item.annotatedPhotoId)
  };
  let officialIssues = [];
  if (outcome.accepted.length) {
    officialIssues = await issueRepository.createFromCandidates(
      outcome.accepted,
      record,
      clean(input.reviewerName, 120),
      options
    );
  }
  const archived = {
    ...outcome.archivedRecord,
    officialIssueIds: officialIssues.map((item) => item.id)
  };
  await client.putAnalysis(archived);
  if (candidateRepository) {
    const existing = await candidateRepository.list({ analysisId: String(analysisId) });
    const existingById = new Map(existing.map((candidate) => [String(candidate.id), candidate]));
    await candidateRepository.putMany(outcome.reviewed
      .filter((candidate) => existingById.has(String(candidate.id)))
      .map((candidate) => {
        const previous = existingById.get(String(candidate.id));
        const currentRevision = Math.max(1, Number(previous.candidateRevision) || 1);
        const nextRevision = currentRevision + 1;
        return {
          ...previous,
          ...candidate,
          analysisId: String(analysisId),
          projectId: String(record.projectId),
          candidateRevision: nextRevision,
          updatedAt: archived.updatedAt,
          auditTrail: [
            ...(Array.isArray(previous.auditTrail) ? previous.auditTrail : []),
            {
              revision: nextRevision,
              action: 'candidate_archived',
              actor: clean(input.reviewerName, 120),
              at: archived.updatedAt,
              previousStatus: previous.reviewStatus || 'pending',
              status: candidate.reviewStatus
            }
          ]
        };
      }));
  }
  return {
    analysis: archived,
    officialIssues,
    acceptedCount: outcome.accepted.length,
    excludedCount: outcome.reviewed.length - outcome.accepted.length
  };
}
