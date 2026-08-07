import { normalizeCandidateChanges } from './review-service.mjs';

function clean(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function candidateError(message, status = 400, code = 'ANALYSIS_CANDIDATE_VALIDATION_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function candidatesFrom(record) {
  if (Array.isArray(record?.reviewIssues)) return record.reviewIssues;
  if (Array.isArray(record?.result?.issues)) return record.result.issues;
  return [];
}

export async function updateAnalysisCandidate(
  client,
  repository,
  candidateId,
  input,
  options = {}
) {
  const id = clean(candidateId, 160);
  const analysisIdFromInput = clean(input?.analysisId, 160);
  let candidate = await repository.get(id);
  let analysisId = String(candidate?.analysisId || analysisIdFromInput || '');
  if (!analysisId) throw candidateError('请提供候选所属分析编号。', 400, 'ANALYSIS_ID_REQUIRED');
  const analysis = await client.getAnalysis(analysisId);
  if (analysis?.status === 'archived') {
    throw candidateError('已归档分析的候选不能继续修改。', 409, 'ANALYSIS_ALREADY_ARCHIVED');
  }
  if (typeof options.assertAnalysisFresh === 'function') {
    await options.assertAnalysisFresh(analysis);
  }
  if (!candidate) {
    const source = candidatesFrom(analysis).find((item) => String(item.id) === id);
    if (!source) throw candidateError('AI候选不存在。', 404, 'ANALYSIS_CANDIDATE_NOT_FOUND');
    candidate = {
      ...source,
      id,
      analysisId,
      projectId: String(analysis.projectId || input?.projectId || ''),
      source: source.source || 'ai',
      candidateRevision: 1,
      auditTrail: [],
      schemaVersion: '1.0.0'
    };
  }
  if (String(candidate.analysisId) !== analysisId) {
    throw candidateError('候选与分析编号不一致。', 409, 'ANALYSIS_CANDIDATE_MISMATCH');
  }

  const currentRevision = Math.max(1, Number(candidate.candidateRevision) || 1);
  if (input?.expectedRevision !== undefined && Number(input.expectedRevision) !== currentRevision) {
    throw candidateError('候选已被其他复核操作修改，请刷新后重试。', 409, 'ANALYSIS_CANDIDATE_REVISION_CONFLICT');
  }
  const updatedBy = clean(input?.updatedBy, 120);
  if (!updatedBy) throw candidateError('请填写候选复核人员。', 400, 'CANDIDATE_EDITOR_REQUIRED');
  const changes = normalizeCandidateChanges(input?.changes || {});
  const requestedStatus = clean(input?.reviewStatus ?? candidate.reviewStatus ?? 'pending', 20).toLowerCase();
  if (!['pending', 'accepted', 'modified', 'excluded', 'rejected'].includes(requestedStatus)) {
    throw candidateError('候选复核状态无效。', 400, 'INVALID_CANDIDATE_REVIEW_STATUS');
  }
  const reviewStatus = requestedStatus === 'rejected'
    ? 'excluded'
    : requestedStatus === 'accepted' && Object.keys(changes).length
      ? 'modified'
      : requestedStatus;
  const now = options.now || new Date().toISOString();
  const nextRevision = currentRevision + 1;
  const updated = {
    ...candidate,
    ...changes,
    reviewStatus,
    reviewedAt: reviewStatus === 'pending' ? candidate.reviewedAt || null : now,
    candidateRevision: nextRevision,
    updatedAt: now,
    updatedBy,
    auditTrail: [
      ...(Array.isArray(candidate.auditTrail) ? candidate.auditTrail : []),
      {
        revision: nextRevision,
        action: 'candidate_review_saved',
        actor: updatedBy,
        at: now,
        previousStatus: candidate.reviewStatus || 'pending',
        status: reviewStatus,
        changedFields: Object.keys(changes)
      }
    ]
  };
  await repository.put(updated);

  const reviewIssues = candidatesFrom(analysis).map((item) =>
    String(item.id) === id ? { ...item, ...updated } : item
  );
  await client.putAnalysis({
    ...analysis,
    reviewIssues,
    status: 'reviewing',
    updatedAt: now
  });
  return updated;
}
