import { poiStableId } from './poi-analysis-service.mjs';

function reviewError(message, status = 400, code = 'POI_REVIEW_INVALID') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizedPoi(item) {
  return {
    ...item,
    normalizedId: item.normalizedId || poiStableId(item),
    reviewStatus: item.reviewStatus || 'pending',
    reviewRevision: Math.max(0, Number(item.reviewRevision) || 0)
  };
}

export function hydratePoiReviewRun(run) {
  if (run?.type !== 'poi-search') return run;
  return {
    ...run,
    result: {
      ...(run.result || {}),
      items: (Array.isArray(run.result?.items) ? run.result.items : []).map(normalizedPoi)
    }
  };
}

export async function reviewPoi(repository, runId, normalizedId, input, options = {}) {
  const run = await repository.get(runId);
  if (!run || run.type !== 'poi-search') {
    throw reviewError('POI分析运行不存在。', 404, 'POI_ANALYSIS_NOT_FOUND');
  }
  if (run.status === 'stale') {
    throw reviewError('POI分析已过期，请重新运行后再确认。', 409, 'POI_ANALYSIS_STALE');
  }
  const items = (Array.isArray(run.result?.items) ? run.result.items : []).map(normalizedPoi);
  const item = items.find((candidate) => String(candidate.normalizedId) === String(normalizedId));
  if (!item) throw reviewError('POI记录不存在。', 404, 'POI_ITEM_NOT_FOUND');
  const expectedRevision = Number(input?.expectedRevision);
  if (
    Number.isFinite(expectedRevision)
    && expectedRevision !== Number(item.reviewRevision || 0)
  ) {
    throw reviewError('POI审核已被其他操作修改，请刷新后重试。', 409, 'POI_REVIEW_REVISION_CONFLICT');
  }
  const status = String(input?.reviewStatus || '');
  if (!['confirmed', 'excluded'].includes(status)) {
    throw reviewError('POI审核状态必须为confirmed或excluded。', 400, 'POI_REVIEW_STATUS_INVALID');
  }
  const reviewedBy = String(input?.reviewedBy || '').trim().slice(0, 120);
  if (!reviewedBy) throw reviewError('请填写POI审核人员。', 400, 'POI_REVIEWER_REQUIRED');
  const now = options.now || new Date().toISOString();
  const updatedItem = {
    ...item,
    reviewStatus: status,
    reviewNote: String(input?.reviewNote || '').trim().slice(0, 1000),
    reviewedBy,
    reviewedAt: now,
    reviewRevision: Number(item.reviewRevision || 0) + 1
  };
  const updated = {
    ...run,
    result: {
      ...run.result,
      items: items.map((candidate) =>
        candidate.normalizedId === updatedItem.normalizedId ? updatedItem : candidate
      ),
      confirmedItemCount: items.filter((candidate) =>
        candidate.normalizedId === updatedItem.normalizedId
          ? updatedItem.reviewStatus === 'confirmed'
          : candidate.reviewStatus === 'confirmed'
      ).length,
      excludedItemCount: items.filter((candidate) =>
        candidate.normalizedId === updatedItem.normalizedId
          ? updatedItem.reviewStatus === 'excluded'
          : candidate.reviewStatus === 'excluded'
      ).length
    },
    poiReviewAudit: [
      ...(Array.isArray(run.poiReviewAudit) ? run.poiReviewAudit : []),
      {
        normalizedId: updatedItem.normalizedId,
        revision: updatedItem.reviewRevision,
        reviewStatus: status,
        reviewedBy,
        reviewNote: updatedItem.reviewNote,
        at: now
      }
    ],
    updatedAt: now,
    schemaVersion: '1.1.0'
  };
  await repository.put(updated);
  return updatedItem;
}

export async function batchReviewPois(repository, runId, input, options = {}) {
  const run = await repository.get(runId);
  if (!run || run.type !== 'poi-search') {
    throw reviewError('POI分析运行不存在。', 404, 'POI_ANALYSIS_NOT_FOUND');
  }
  if (run.status === 'stale') {
    throw reviewError('POI分析已过期，请重新运行后再确认。', 409, 'POI_ANALYSIS_STALE');
  }
  const reviewedBy = String(input?.reviewedBy || '').trim().slice(0, 120);
  if (!reviewedBy) throw reviewError('请填写POI审核人员。', 400, 'POI_REVIEWER_REQUIRED');
  const decisions = Array.isArray(input?.items) ? input.items : [];
  if (!decisions.length || decisions.length > 500) {
    throw reviewError('POI批量审核每次必须包含1到500条记录。', 400, 'POI_REVIEW_BATCH_SIZE_INVALID');
  }
  const uniqueIds = new Set(decisions.map((item) => String(item?.normalizedId || '')));
  if (uniqueIds.has('') || uniqueIds.size !== decisions.length) {
    throw reviewError('POI批量审核存在空编号或重复编号。', 400, 'POI_REVIEW_BATCH_ID_INVALID');
  }
  const items = (Array.isArray(run.result?.items) ? run.result.items : []).map(normalizedPoi);
  const byId = new Map(items.map((item) => [String(item.normalizedId), item]));
  for (const decision of decisions) {
    const item = byId.get(String(decision.normalizedId));
    if (!item) throw reviewError('POI批量审核包含不存在的记录。', 404, 'POI_ITEM_NOT_FOUND');
    if (!['confirmed', 'excluded'].includes(decision.reviewStatus)) {
      throw reviewError('POI审核状态必须为confirmed或excluded。', 400, 'POI_REVIEW_STATUS_INVALID');
    }
    if (
      Number.isFinite(Number(decision.expectedRevision))
      && Number(decision.expectedRevision) !== Number(item.reviewRevision || 0)
    ) {
      throw reviewError('POI批量审核包含已被修改的记录。', 409, 'POI_REVIEW_REVISION_CONFLICT');
    }
  }
  const now = options.now || new Date().toISOString();
  const decisionsById = new Map(decisions.map((item) => [String(item.normalizedId), item]));
  const updatedItems = items.map((item) => {
    const decision = decisionsById.get(String(item.normalizedId));
    if (!decision) return item;
    return {
      ...item,
      reviewStatus: decision.reviewStatus,
      reviewNote: String(decision.reviewNote || '').trim().slice(0, 1000),
      reviewedBy,
      reviewedAt: now,
      reviewRevision: Number(item.reviewRevision || 0) + 1
    };
  });
  await repository.put({
    ...run,
    result: {
      ...run.result,
      items: updatedItems,
      confirmedItemCount: updatedItems.filter((item) => item.reviewStatus === 'confirmed').length,
      excludedItemCount: updatedItems.filter((item) => item.reviewStatus === 'excluded').length
    },
    poiReviewAudit: [
      ...(Array.isArray(run.poiReviewAudit) ? run.poiReviewAudit : []),
      ...updatedItems
        .filter((item) => decisionsById.has(String(item.normalizedId)))
        .map((item) => ({
          normalizedId: item.normalizedId,
          revision: item.reviewRevision,
          reviewStatus: item.reviewStatus,
          reviewedBy,
          reviewNote: item.reviewNote,
          batch: true,
          at: now
        }))
    ],
    updatedAt: now,
    schemaVersion: '1.1.0'
  });
  return updatedItems.filter((item) => decisionsById.has(String(item.normalizedId)));
}
