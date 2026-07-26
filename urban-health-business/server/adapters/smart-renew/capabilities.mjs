const CAPABILITY_DEFINITIONS = Object.freeze({
  projects: {
    label: '项目主数据',
    adapter: 'SmartRenewClient',
    mode: 'read-write',
    sourceOfTruth: 'smart-renew'
  },
  photos: {
    label: '照片二进制与基础记录',
    adapter: 'SmartRenewClient',
    mode: 'read-write',
    sourceOfTruth: 'smart-renew'
  },
  analyses: {
    label: 'AI分析记录',
    adapter: 'SmartRenewClient',
    mode: 'read-write',
    sourceOfTruth: 'smart-renew'
  },
  fieldCollection: {
    label: '外业采集任务',
    adapter: 'FieldAdapter',
    mode: 'read-write',
    sourceOfTruth: 'smart-renew'
  },
  projectData: {
    label: 'ProjectData索引',
    adapter: 'ProjectDataAdapter',
    mode: 'read-write',
    sourceOfTruth: 'smart-renew'
  },
  legacyMigration: {
    label: '旧数据迁移',
    adapter: 'LegacyMigrationAdapter',
    mode: 'explicit-write',
    sourceOfTruth: 'smart-renew'
  },
  reportSnapshots: {
    label: '旧报告快照',
    adapter: 'ReportSnapshotAdapter',
    mode: 'read-only',
    sourceOfTruth: 'business',
    degradedReason: 'business_report_is_primary_legacy_is_read_only'
  },
  officialIssues: {
    label: '旧正式问题',
    adapter: 'SmartRenewClient',
    mode: 'read-only',
    sourceOfTruth: 'business',
    degradedReason: 'business_official_issue_is_primary_legacy_is_read_only'
  }
});

function cloneDefinition(key, definition, upstreamReady, upstreamError) {
  if (!upstreamReady) {
    return {
      key,
      ...definition,
      status: 'unavailable',
      ready: false,
      reason: upstreamError?.code || 'smart_renew_unavailable'
    };
  }
  if (definition.degradedReason) {
    return {
      key,
      ...definition,
      status: 'degraded',
      ready: true,
      reason: definition.degradedReason
    };
  }
  return {
    key,
    ...definition,
    status: 'available',
    ready: true,
    reason: null
  };
}

export class LegacyCapabilityRegistry {
  constructor(definitions = CAPABILITY_DEFINITIONS) {
    this.definitions = definitions;
  }

  snapshot(input = {}) {
    const upstreamReady = Boolean(input.upstreamReady);
    const upstreamError = input.upstreamError || null;
    return Object.fromEntries(
      Object.entries(this.definitions).map(([key, definition]) => [
        key,
        cloneDefinition(key, definition, upstreamReady, upstreamError)
      ])
    );
  }

  definition(key) {
    return this.definitions[key] ? { key, ...this.definitions[key] } : null;
  }
}

export { CAPABILITY_DEFINITIONS };
