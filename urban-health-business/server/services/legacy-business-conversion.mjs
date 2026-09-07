import { createHash } from 'node:crypto';

function clean(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function legacyFingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function migratedId(prefix, projectId, legacyId) {
  const digest = createHash('sha256')
    .update(`${projectId}:${legacyId}`)
    .digest('hex')
    .slice(0, 24);
  return `${prefix}-${digest}`;
}

function migratedSourceId(item) {
  return clean(item?.migration?.sourceId || item?.sourceLegacyId, 180);
}

function migratedFingerprint(item) {
  return clean(item?.migration?.sourceFingerprint || item?.sourceLegacyFingerprint, 80);
}

function planKind(kind, legacyItems, businessItems) {
  const existingBySource = new Map(
    businessItems
      .map((item) => [migratedSourceId(item), item])
      .filter(([sourceId]) => sourceId)
  );
  const eligible = [];
  const alreadyMigrated = [];
  const conflicts = [];
  for (const source of legacyItems) {
    const sourceId = clean(source?.id, 180);
    if (!sourceId) {
      conflicts.push({ kind, sourceId: null, reason: 'legacy_id_missing' });
      continue;
    }
    const fingerprint = legacyFingerprint(source);
    const existing = existingBySource.get(sourceId);
    if (!existing) {
      eligible.push({ source, sourceId, fingerprint });
      continue;
    }
    if (migratedFingerprint(existing) === fingerprint) {
      alreadyMigrated.push({ sourceId, businessId: existing.id });
    } else {
      conflicts.push({
        kind,
        sourceId,
        businessId: existing.id,
        reason: 'legacy_source_changed_after_migration'
      });
    }
  }
  return {
    sourceCount: legacyItems.length,
    eligible,
    alreadyMigrated,
    conflicts
  };
}

export function buildBusinessLegacyPlan(
  legacyIssues,
  legacyReports,
  businessIssues,
  businessReports
) {
  const issues = planKind(
    'officialIssue',
    Array.isArray(legacyIssues) ? legacyIssues : [],
    Array.isArray(businessIssues) ? businessIssues : []
  );
  const reports = planKind(
    'report',
    Array.isArray(legacyReports) ? legacyReports : [],
    Array.isArray(businessReports) ? businessReports : []
  );
  return {
    issues,
    reports,
    hasConflicts: issues.conflicts.length > 0 || reports.conflicts.length > 0
  };
}

export function summarizeBusinessLegacyPlan(plan) {
  const summarize = (kind) => ({
    sourceCount: kind.sourceCount,
    eligible: kind.eligible.length,
    alreadyMigrated: kind.alreadyMigrated.length,
    conflicts: kind.conflicts
  });
  return {
    issues: summarize(plan.issues),
    reports: summarize(plan.reports),
    hasConflicts: plan.hasConflicts,
    reportMode: 'read-only'
  };
}

export function convertLegacyOfficialIssue(entry, projectId, executedBy, options = {}) {
  const source = entry.source;
  const now = options.now || new Date().toISOString();
  const confidence = source?.confidence == null ? null : Number(source.confidence);
  return {
    id: migratedId('ISS-LEGACY', projectId, entry.sourceId),
    projectId: String(projectId),
    analysisId: clean(source?.analysisId, 160),
    candidateId: null,
    source: 'legacy-migrated',
    sourceLegacyId: entry.sourceId,
    sourceLegacyFingerprint: entry.fingerprint,
    originalPhotoId: clean(source?.originalPhotoId, 160),
    annotatedPhotoId: clean(source?.annotatedPhotoId, 160),
    communityId: clean(source?.communityId, 160),
    buildingId: clean(source?.buildingId, 160),
    categoryCode: clean(source?.categoryCode, 50),
    categoryName: clean(source?.categoryName, 120),
    title: clean(source?.title, 120) || '旧版迁移问题',
    description: clean(source?.description || source?.desc, 2000),
    evidence: clean(source?.evidence, 2000),
    severity: ['high', 'medium', 'low'].includes(source?.severity) ? source.severity : 'medium',
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    location: clean(source?.location, 500),
    bbox: Array.isArray(source?.bbox) ? source.bbox.slice(0, 4) : null,
    suggestion: clean(source?.suggestion, 2000),
    geometry: source?.geometry || null,
    spatialBinding: null,
    indicatorCode: null,
    indicatorBindingStatus: 'not_integrated',
    legacyProblemCode: clean(source?.problemCode, 50) || null,
    legacyIndicatorCode: clean(source?.indicatorCode, 50) || null,
    reviewStatus: source?.reviewStatus === 'modified' ? 'modified' : 'confirmed',
    reviewerName: clean(source?.reviewerName, 120),
    reviewedAt: source?.reviewedAt || source?.updatedAt || source?.createdAt || now,
    status: source?.status === 'deleted' ? 'inactive' : 'active',
    issueRevision: 1,
    auditTrail: [{
      revision: 1,
      action: 'legacy_issue_migrated',
      actor: clean(executedBy, 120),
      at: now,
      sourceId: entry.sourceId
    }],
    migration: {
      source: 'smart-renew',
      sourceId: entry.sourceId,
      sourceFingerprint: entry.fingerprint,
      migratedBy: clean(executedBy, 120),
      migratedAt: now
    },
    createdAt: source?.createdAt || now,
    updatedAt: now,
    schemaVersion: '1.0.0'
  };
}

function issueIdsFromLegacyReport(source) {
  const fromSourceIds = Array.isArray(source?.sourceIds?.issueIds) ? source.sourceIds.issueIds : [];
  const fromSnapshot = Array.isArray(source?.snapshot?.issues?.items)
    ? source.snapshot.issues.items.map((item) => item?.id)
    : [];
  return [...new Set([...fromSourceIds, ...fromSnapshot].map(String).filter(Boolean))];
}

export function convertLegacyReport(
  entry,
  projectId,
  version,
  issueIdMap,
  executedBy,
  options = {}
) {
  const source = entry.source;
  const now = options.now || new Date().toISOString();
  const legacyIssueIds = issueIdsFromLegacyReport(source);
  const issueIds = legacyIssueIds.map((id) => issueIdMap.get(id)).filter(Boolean);
  const issueItems = Array.isArray(source?.snapshot?.issues?.items)
    ? source.snapshot.issues.items
    : [];
  const severity = {
    high: Number(source?.snapshot?.issues?.high)
      || issueItems.filter((item) => item?.severity === 'high').length,
    medium: Number(source?.snapshot?.issues?.medium)
      || issueItems.filter((item) => item?.severity === 'medium').length,
    low: Number(source?.snapshot?.issues?.low)
      || issueItems.filter((item) => item?.severity === 'low').length
  };
  const projectSnapshot = source?.snapshot?.project || {};
  return {
    id: migratedId('RPT-BIZ-LEGACY', projectId, entry.sourceId),
    projectId: String(projectId),
    version,
    title: clean(source?.title, 200) || '旧版迁移报告',
    generatedBy: clean(source?.generatedBy, 120),
    status: 'migrated_read_only',
    reportRevision: 1,
    editorial: {
      executiveSummary: '',
      recommendations: '',
      notes: `由旧版报告 ${entry.sourceId} 迁移，原始快照只读保存在migration.originalSnapshot。`
    },
    auditTrail: [{
      revision: 1,
      action: 'legacy_report_migrated',
      actor: clean(executedBy, 120),
      at: now,
      sourceId: entry.sourceId
    }],
    generatedAt: source?.generatedAt || now,
    projectSnapshot: {
      id: String(projectSnapshot.id || projectId),
      name: clean(projectSnapshot.name, 240),
      area: clean(projectSnapshot.area, 240),
      type: clean(projectSnapshot.type, 120),
      revision: 0,
      boundaryStatus: Number(projectSnapshot.scopeAreaSqKm) > 0 ? 'available' : 'unknown'
    },
    dataSnapshot: {
      officialIssueCount: issueIds.length,
      severity,
      locatedIssueCount: issueItems.filter((item) =>
        Array.isArray(item?.geometry?.coordinates)
      ).length,
      analysisRunCount: Number(source?.snapshot?.analyses?.total) || 0,
      manualReviewCount: 0,
      spatialAnalysisCount: 0,
      issueIds,
      issueRevisions: issueIds.map((id) => ({
        id,
        issueRevision: 1,
        geometryRevision: 0,
        updatedAt: now
      })),
      analysisIds: Array.isArray(source?.sourceIds?.analysisIds)
        ? source.sourceIds.analysisIds.map(String)
        : [],
      reviewConclusionIds: [],
      spatialAnalysisIds: [],
      photoRevisions: Array.isArray(source?.sourceIds?.photoIds)
        ? source.sourceIds.photoIds.map((id) => ({
          id: String(id),
          contentHash: null,
          metadataRevision: 0,
          governanceStatus: 'legacy'
        }))
        : []
    },
    indicatorSnapshot: {
      status: 'unavailable',
      reason: 'indicator_engine_not_integrated',
      results: [],
      score: null
    },
    notices: [
      '本报告由原smart-renew只读快照迁移，不参与当前报告编辑或重新计算。',
      '旧指标统计仅保存在migration.originalSnapshot中，不作为当前指标结果。'
    ],
    migration: {
      source: 'smart-renew',
      sourceId: entry.sourceId,
      sourceVersion: Number(source?.version) || null,
      sourceFingerprint: entry.fingerprint,
      migratedBy: clean(executedBy, 120),
      migratedAt: now,
      readOnly: true,
      originalSnapshot: source
    },
    schemaVersion: '1.0.0'
  };
}
