export const ANALYSIS_BATCH_SIZE = 20;

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))];
}

function numericConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function longerText(current, next) {
  return String(next || '').length > String(current || '').length ? next : current;
}

export function createAnalysisBatches(photoIds, photoSnapshot = [], batchSize = ANALYSIS_BATCH_SIZE) {
  const ids = Array.isArray(photoIds) ? photoIds.map(String) : [];
  const size = Math.max(1, Math.trunc(Number(batchSize)) || ANALYSIS_BATCH_SIZE);
  const snapshotById = new Map(
    (Array.isArray(photoSnapshot) ? photoSnapshot : []).map((item) => [String(item.id), item])
  );
  const batches = [];
  for (let offset = 0; offset < ids.length; offset += size) {
    const batchPhotoIds = ids.slice(offset, offset + size);
    const batchIndex = batches.length + 1;
    batches.push({
      id: `BATCH-${String(batchIndex).padStart(3, '0')}`,
      batchIndex,
      offset,
      photoIds: batchPhotoIds,
      photoSnapshot: batchPhotoIds
        .map((photoId) => snapshotById.get(photoId))
        .filter(Boolean)
    });
  }
  return batches;
}

export function normalizeCandidateTitle(value) {
  return String(value || '')
    .replace(/[的了与及、，。\s]/g, '')
    .replace(/(问题|隐患|风险|现象)$/u, '')
    .slice(0, 12);
}

export function bboxIoU(first, second) {
  if (!Array.isArray(first) || first.length !== 4 || !Array.isArray(second) || second.length !== 4) {
    return 0;
  }
  const a = first.map(Number);
  const b = second.map(Number);
  if ([...a, ...b].some((value) => !Number.isFinite(value))) return 0;
  const intersectionWidth = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const intersectionHeight = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const intersection = intersectionWidth * intersectionHeight;
  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const union = areaA + areaB - intersection;
  return union > 0 ? intersection / union : 0;
}

function sameEvidencePhoto(first, second) {
  const firstPhotoId = String(first.photoId || '');
  const secondPhotoId = String(second.photoId || '');
  if (firstPhotoId || secondPhotoId) return firstPhotoId !== '' && firstPhotoId === secondPhotoId;
  return Number(first.globalImageIndex) === Number(second.globalImageIndex);
}

function mergeDuplicate(target, duplicate) {
  const currentConfidence = numericConfidence(target.confidence);
  const duplicateConfidence = numericConfidence(duplicate.confidence);
  const merged = {
    ...target,
    confidence: currentConfidence === null
      ? duplicateConfidence
      : duplicateConfidence === null
        ? currentConfidence
        : Math.max(currentConfidence, duplicateConfidence),
    desc: longerText(target.desc, duplicate.desc),
    evidence: longerText(target.evidence, duplicate.evidence),
    suggestion: longerText(target.suggestion, duplicate.suggestion),
    mergedCount: Number(target.mergedCount || 1) + Number(duplicate.mergedCount || 1),
    sourceBatchIds: unique([
      ...(Array.isArray(target.sourceBatchIds) ? target.sourceBatchIds : [target.sourceBatchId]),
      ...(Array.isArray(duplicate.sourceBatchIds) ? duplicate.sourceBatchIds : [duplicate.sourceBatchId])
    ]),
    sourceAnalysisIds: unique([
      ...(Array.isArray(target.sourceAnalysisIds) ? target.sourceAnalysisIds : [target.sourceAnalysisId]),
      ...(Array.isArray(duplicate.sourceAnalysisIds) ? duplicate.sourceAnalysisIds : [duplicate.sourceAnalysisId])
    ]),
    duplicateCandidateIds: unique([
      ...(Array.isArray(target.duplicateCandidateIds) ? target.duplicateCandidateIds : []),
      duplicate.id,
      ...(Array.isArray(duplicate.duplicateCandidateIds) ? duplicate.duplicateCandidateIds : [])
    ])
  };
  return merged;
}

export function deduplicateAnalysisCandidates(candidates, options = {}) {
  const threshold = Number.isFinite(Number(options.iouThreshold))
    ? Number(options.iouThreshold)
    : 0.42;
  const merged = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const normalizedTitle = normalizeCandidateTitle(candidate.title);
    const duplicateIndex = merged.findIndex((current) => {
      if (!sameEvidencePhoto(current, candidate)) return false;
      if (String(current.categoryCode || 'OTHER') !== String(candidate.categoryCode || 'OTHER')) return false;
      const sameTitle = normalizedTitle
        && normalizeCandidateTitle(current.title) === normalizedTitle;
      return sameTitle || bboxIoU(current.bbox, candidate.bbox) > threshold;
    });
    if (duplicateIndex === -1) {
      merged.push({
        ...candidate,
        mergedCount: Number(candidate.mergedCount) || 1,
        sourceBatchIds: unique([
          ...(Array.isArray(candidate.sourceBatchIds) ? candidate.sourceBatchIds : []),
          candidate.sourceBatchId
        ]),
        sourceAnalysisIds: unique([
          ...(Array.isArray(candidate.sourceAnalysisIds) ? candidate.sourceAnalysisIds : []),
          candidate.sourceAnalysisId
        ]),
        duplicateCandidateIds: Array.isArray(candidate.duplicateCandidateIds)
          ? [...candidate.duplicateCandidateIds]
          : []
      });
      continue;
    }
    merged[duplicateIndex] = mergeDuplicate(merged[duplicateIndex], candidate);
  }
  return merged;
}

function mergeUsageValue(current, next) {
  if (typeof next === 'number' && Number.isFinite(next)) {
    return (typeof current === 'number' && Number.isFinite(current) ? current : 0) + next;
  }
  if (next && typeof next === 'object' && !Array.isArray(next)) {
    const result = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
    for (const [key, value] of Object.entries(next)) {
      result[key] = mergeUsageValue(result[key], value);
    }
    return result;
  }
  return current === undefined ? next : current;
}

export function aggregateAnalysisUsage(usages) {
  let result = null;
  for (const usage of Array.isArray(usages) ? usages : []) {
    if (!usage || typeof usage !== 'object') continue;
    result = mergeUsageValue(result || {}, usage);
  }
  return result;
}

export function mergeAnalysisBatchResults(batchResults, options = {}) {
  const summaries = [];
  const candidates = [];
  const models = [];
  const requestIds = [];
  const promptVersions = [];
  const usages = [];
  const batches = [];

  for (const entry of Array.isArray(batchResults) ? batchResults : []) {
    const batch = entry.batch || {};
    const analysis = entry.analysis || {};
    const batchIssues = Array.isArray(analysis.result?.issues) ? analysis.result.issues : [];
    if (analysis.result?.summary) summaries.push(String(analysis.result.summary));
    if (analysis.model) models.push(String(analysis.model));
    if (analysis.modelRequestId || analysis.requestId) {
      requestIds.push(String(analysis.modelRequestId || analysis.requestId));
    }
    if (analysis.promptVersion) promptVersions.push(String(analysis.promptVersion));
    if (analysis.usage) usages.push(analysis.usage);
    batches.push({
      id: batch.id,
      batchIndex: batch.batchIndex,
      photoIds: [...(batch.photoIds || [])],
      analysisId: String(analysis.id || ''),
      candidateCount: batchIssues.length,
      model: analysis.model || null,
      requestId: analysis.modelRequestId || analysis.requestId || null,
      usage: analysis.usage || null,
      promptVersion: analysis.promptVersion || null
    });
    for (const issue of batchIssues) {
      candidates.push({
        ...issue,
        globalImageIndex: Number(batch.offset || 0) + Math.max(1, Number(issue.imageIndex) || 1),
        sourceBatchId: batch.id,
        sourceBatchIndex: batch.batchIndex,
        sourceAnalysisId: String(analysis.id || issue.analysisId || '')
      });
    }
  }

  const issues = deduplicateAnalysisCandidates(candidates, options);
  return {
    result: {
      summary: summaries.join(' ').trim(),
      issues,
      rawIssueCount: candidates.length,
      duplicateIssueCount: candidates.length - issues.length
    },
    batches,
    models: unique(models),
    requestIds: unique(requestIds),
    promptVersions: unique(promptVersions),
    usage: aggregateAnalysisUsage(usages)
  };
}
