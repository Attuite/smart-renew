const SOURCE_OF_TRUTH = Object.freeze({
  project: Object.freeze({
    primary: 'smart-renew',
    businessRole: 'adapter-and-revision-coordination',
    legacyRole: 'primary'
  }),
  photo: Object.freeze({
    primary: 'smart-renew',
    businessRole: 'metadata-governance-overlay',
    legacyRole: 'binary-and-base-record'
  }),
  analysisRecord: Object.freeze({
    primary: 'smart-renew',
    businessRole: 'job-and-candidate-reference',
    legacyRole: 'primary'
  }),
  analysisCandidate: Object.freeze({
    primary: 'business',
    businessRole: 'primary',
    legacyRole: 'initialization-read-only'
  }),
  reviewSession: Object.freeze({
    primary: 'business',
    businessRole: 'primary',
    legacyRole: 'none'
  }),
  officialIssue: Object.freeze({
    primary: 'business',
    businessRole: 'primary',
    legacyRole: 'read-only-and-explicit-migration'
  }),
  sourceAsset: Object.freeze({
    primary: 'business',
    businessRole: 'primary',
    legacyRole: 'project-data-conversion-source'
  }),
  spatialAnalysisRun: Object.freeze({
    primary: 'business',
    businessRole: 'primary',
    legacyRole: 'read-only-import'
  }),
  report: Object.freeze({
    primary: 'business',
    businessRole: 'primary',
    legacyRole: 'read-only-and-explicit-migration'
  }),
  projectData: Object.freeze({
    primary: 'smart-renew',
    businessRole: 'adapter-and-source-lineage',
    legacyRole: 'primary'
  }),
  fieldCollectionTask: Object.freeze({
    primary: 'smart-renew',
    businessRole: 'adapter',
    legacyRole: 'primary'
  })
});

export function sourceOfTruthSnapshot() {
  return Object.fromEntries(
    Object.entries(SOURCE_OF_TRUTH).map(([key, value]) => [key, { ...value }])
  );
}

export function sourceOfTruthFor(entity) {
  const rule = SOURCE_OF_TRUTH[String(entity || '')];
  return rule ? { ...rule } : null;
}

export function assertPrimarySource(entity, attemptedSource) {
  const rule = sourceOfTruthFor(entity);
  if (!rule) {
    const error = new Error(`未登记主数据源：${entity}`);
    error.status = 500;
    error.code = 'SOURCE_OF_TRUTH_NOT_REGISTERED';
    throw error;
  }
  if (rule.primary !== attemptedSource) {
    const error = new Error(`${entity}只能写入主数据源${rule.primary}。`);
    error.status = 409;
    error.code = 'SOURCE_OF_TRUTH_VIOLATION';
    error.details = {
      entity,
      primary: rule.primary,
      attemptedSource
    };
    throw error;
  }
  return rule;
}

export { SOURCE_OF_TRUTH };
