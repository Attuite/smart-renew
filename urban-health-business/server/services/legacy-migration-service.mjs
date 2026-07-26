import { randomUUID } from 'node:crypto';
import {
  buildBusinessLegacyPlan,
  convertLegacyOfficialIssue,
  convertLegacyReport,
  summarizeBusinessLegacyPlan
} from './legacy-business-conversion.mjs';

function clean(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function migrationError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function businessMigrationPlan(adapter, projectId, options) {
  if (!options?.issueRepository || !options?.reportRepository) return null;
  const [legacyIssues, legacyReports, businessIssues, businessReports] = await Promise.all([
    adapter.listIssues(projectId),
    adapter.listReports(projectId),
    options.issueRepository.list(projectId),
    options.reportRepository.list(projectId)
  ]);
  return {
    plan: buildBusinessLegacyPlan(
      legacyIssues,
      legacyReports,
      businessIssues,
      businessReports
    ),
    legacyIssues,
    legacyReports,
    businessIssues,
    businessReports
  };
}

export async function auditLegacyMigration(adapter, repository, projectId, options = {}) {
  const [upstream, runs, business] = await Promise.all([
    adapter.audit(projectId),
    repository.list(projectId),
    businessMigrationPlan(adapter, projectId, options)
  ]);
  return {
    projectId: String(projectId),
    upstream,
    runs,
    businessMigration: business ? summarizeBusinessLegacyPlan(business.plan) : null,
    source: 'smart-renew',
    executionAudit: 'business'
  };
}

export async function applyLegacyMigration(adapter, repository, projectId, input, options = {}) {
  const clientRequestId = clean(input?.clientRequestId, 160);
  const executedBy = clean(input?.executedBy || input?.reviewerName, 120);
  if (!clientRequestId) {
    throw migrationError('请提供迁移请求编号。', 400, 'MIGRATION_CLIENT_REQUEST_ID_REQUIRED');
  }
  if (!executedBy) {
    throw migrationError('请记录迁移执行人员。', 400, 'MIGRATION_EXECUTOR_REQUIRED');
  }
  if (input?.confirmed !== true) {
    throw migrationError('旧数据迁移必须显式确认。', 400, 'LEGACY_MIGRATION_CONFIRMATION_REQUIRED');
  }
  const existing = await repository.findByClientRequest(String(projectId), clientRequestId);
  if (existing) return { item: existing, duplicated: true };

  const startedAt = options.now || new Date().toISOString();
  const base = {
    id: options.id || `MIGRUN-${randomUUID()}`,
    projectId: String(projectId),
    clientRequestId,
    executedBy,
    status: 'running',
    source: 'smart-renew',
    startedAt,
    completedAt: null,
    result: null,
    error: null,
    schemaVersion: '1.0.0'
  };
  await repository.put(base);
  try {
    const upstream = await adapter.apply(projectId, {
      confirmed: true,
      reviewerName: executedBy
    });
    const business = await businessMigrationPlan(adapter, projectId, options);
    let businessResult = null;
    if (business) {
      if (business.plan.hasConflicts) {
        throw migrationError(
          '旧数据在上次迁移后已发生变化，请先处理迁移冲突。',
          409,
          'BUSINESS_LEGACY_MIGRATION_CONFLICT'
        );
      }
      const issueIdMap = new Map(
        business.businessIssues
          .map((issue) => [issue?.migration?.sourceId || issue?.sourceLegacyId, issue.id])
          .filter(([sourceId]) => sourceId)
      );
      const migratedIssues = [];
      for (const entry of business.plan.issues.eligible) {
        const issue = convertLegacyOfficialIssue(entry, projectId, executedBy, {
          now: options.completedAt
        });
        await options.issueRepository.put(issue);
        migratedIssues.push(issue);
        issueIdMap.set(entry.sourceId, issue.id);
      }
      let nextVersion = business.businessReports.reduce(
        (maximum, report) => Math.max(maximum, Number(report.version) || 0),
        0
      ) + 1;
      const migratedReports = [];
      const reportEntries = [...business.plan.reports.eligible].sort((left, right) =>
        String(left.source?.generatedAt || '').localeCompare(String(right.source?.generatedAt || ''))
      );
      for (const entry of reportEntries) {
        const report = convertLegacyReport(
          entry,
          projectId,
          nextVersion,
          issueIdMap,
          executedBy,
          { now: options.completedAt }
        );
        nextVersion += 1;
        await options.reportRepository.put(report);
        migratedReports.push(report);
      }
      businessResult = {
        migratedIssues: migratedIssues.length,
        migratedReports: migratedReports.length,
        skippedIssues: business.plan.issues.alreadyMigrated.length,
        skippedReports: business.plan.reports.alreadyMigrated.length,
        issueIds: migratedIssues.map((item) => item.id),
        reportIds: migratedReports.map((item) => item.id),
        reportMode: 'read-only'
      };
    }
    const result = {
      ...upstream,
      upstream,
      business: businessResult
    };
    const completed = {
      ...base,
      status: 'completed',
      completedAt: options.completedAt || new Date().toISOString(),
      result
    };
    await repository.put(completed);
    return { item: completed, duplicated: false };
  } catch (error) {
    const failed = {
      ...base,
      status: 'failed',
      completedAt: options.completedAt || new Date().toISOString(),
      error: {
        code: error.code || 'LEGACY_MIGRATION_FAILED',
        message: error.message
      }
    };
    await repository.put(failed);
    throw error;
  }
}
