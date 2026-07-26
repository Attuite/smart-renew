function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function valueAt(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source);
}

function setDifference(left, right) {
  return [...left].filter((item) => !right.has(item));
}

function referenceMap(items) {
  return new Map((Array.isArray(items) ? items : []).map((item) => [String(item.id), item]));
}

export function compareReports(baseReport, targetReport) {
  if (!baseReport || !targetReport) {
    const error = new Error('请选择两个存在的报告版本。');
    error.status = 404;
    error.code = 'REPORT_COMPARE_NOT_FOUND';
    throw error;
  }
  if (String(baseReport.projectId) !== String(targetReport.projectId)) {
    const error = new Error('只能比较同一项目的报告版本。');
    error.status = 400;
    error.code = 'REPORT_COMPARE_PROJECT_MISMATCH';
    throw error;
  }
  if (String(baseReport.id) === String(targetReport.id)) {
    const error = new Error('请选择两个不同的报告版本。');
    error.status = 400;
    error.code = 'REPORT_COMPARE_SAME_VERSION';
    throw error;
  }

  const contentFields = [
    ['title', '报告标题'],
    ['editorial.executiveSummary', '执行摘要'],
    ['editorial.recommendations', '建议'],
    ['editorial.notes', '内部备注']
  ];
  const metricFields = [
    ['projectSnapshot.revision', '项目修订'],
    ['dataSnapshot.officialIssueCount', '正式问题'],
    ['dataSnapshot.locatedIssueCount', '已定位问题'],
    ['dataSnapshot.severity.high', '高风险问题'],
    ['dataSnapshot.severity.medium', '中风险问题'],
    ['dataSnapshot.severity.low', '低风险问题'],
    ['dataSnapshot.analysisRunCount', 'AI分析批次'],
    ['dataSnapshot.manualReviewCount', '人工复核次数'],
    ['dataSnapshot.spatialAnalysisCount', '空间分析次数']
  ];
  const buildChanges = (fields) => fields.flatMap(([field, label]) => {
    const before = valueAt(baseReport, field);
    const after = valueAt(targetReport, field);
    return sameValue(before, after) ? [] : [{ field, label, before: before ?? null, after: after ?? null }];
  });

  const baseIssues = new Set((baseReport.dataSnapshot?.issueIds || []).map(String));
  const targetIssues = new Set((targetReport.dataSnapshot?.issueIds || []).map(String));
  const baseSpatial = new Set((baseReport.dataSnapshot?.spatialAnalysisIds || []).map(String));
  const targetSpatial = new Set((targetReport.dataSnapshot?.spatialAnalysisIds || []).map(String));
  const basePhotos = referenceMap(baseReport.dataSnapshot?.photoRevisions);
  const targetPhotos = referenceMap(targetReport.dataSnapshot?.photoRevisions);
  const addedPhotoIds = setDifference(new Set(targetPhotos.keys()), new Set(basePhotos.keys()));
  const removedPhotoIds = setDifference(new Set(basePhotos.keys()), new Set(targetPhotos.keys()));
  const changedPhotos = [...basePhotos.keys()].flatMap((id) => {
    const before = basePhotos.get(id);
    const after = targetPhotos.get(id);
    if (!after || sameValue(before, after)) return [];
    const reasons = [];
    if (Number(before.metadataRevision || 0) !== Number(after.metadataRevision || 0)) {
      reasons.push('METADATA_REVISION_CHANGED');
    }
    if (String(before.contentHash || '') !== String(after.contentHash || '')) {
      reasons.push('CONTENT_HASH_CHANGED');
    }
    if (String(before.governanceStatus || '') !== String(after.governanceStatus || '')) {
      reasons.push('GOVERNANCE_STATUS_CHANGED');
    }
    return [{ id, before, after, reasons }];
  });
  const contentChanges = buildChanges(contentFields);
  const metricChanges = buildChanges(metricFields);
  const issueChanges = {
    addedIds: setDifference(targetIssues, baseIssues),
    removedIds: setDifference(baseIssues, targetIssues)
  };
  const spatialChanges = {
    addedIds: setDifference(targetSpatial, baseSpatial),
    removedIds: setDifference(baseSpatial, targetSpatial)
  };
  const photoChanges = { addedIds: addedPhotoIds, removedIds: removedPhotoIds, changed: changedPhotos };
  const totalChanges =
    contentChanges.length
    + metricChanges.length
    + issueChanges.addedIds.length
    + issueChanges.removedIds.length
    + spatialChanges.addedIds.length
    + spatialChanges.removedIds.length
    + photoChanges.addedIds.length
    + photoChanges.removedIds.length
    + photoChanges.changed.length;

  return {
    projectId: String(baseReport.projectId),
    base: {
      id: String(baseReport.id),
      version: Number(baseReport.version) || 0,
      reportRevision: Number(baseReport.reportRevision) || 0,
      title: baseReport.title || '',
      generatedAt: baseReport.generatedAt || null
    },
    target: {
      id: String(targetReport.id),
      version: Number(targetReport.version) || 0,
      reportRevision: Number(targetReport.reportRevision) || 0,
      title: targetReport.title || '',
      generatedAt: targetReport.generatedAt || null
    },
    summary: {
      changed: totalChanges > 0,
      totalChanges,
      contentChangeCount: contentChanges.length,
      metricChangeCount: metricChanges.length,
      issueChangeCount: issueChanges.addedIds.length + issueChanges.removedIds.length,
      spatialChangeCount: spatialChanges.addedIds.length + spatialChanges.removedIds.length,
      photoChangeCount: photoChanges.addedIds.length + photoChanges.removedIds.length + photoChanges.changed.length
    },
    contentChanges,
    metricChanges,
    issueChanges,
    spatialChanges,
    photoChanges,
    comparedAt: new Date().toISOString(),
    schemaVersion: '1.0.0'
  };
}
