import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOutcomeIssues, buildOutcomeReports, buildOutcomeSummary } from '../../server/services/outcome-center-service.mjs';

function clientFixture() {
  return {
    async listProjects() {
      return { items: [
        { id: 'PRJ-1', name: '一号项目' },
        { id: 'PRJ-2', name: '二号项目' }
      ] };
    },
    async listIssues({ projectId }) {
      return { items: [{ id: `LEGACY-${projectId}`, projectId, title: '旧问题', status: 'active' }] };
    },
    async listReports({ projectId }) {
      return { items: [{ id: `LEGACY-RPT-${projectId}`, projectId, version: 1, status: 'generated', generatedAt: '2026-08-01T00:00:00.000Z' }] };
    }
  };
}

test('outcome center merges business primary records, scopes projects and bounds indexes', async () => {
  const client = clientFixture();
  const issues = await buildOutcomeIssues(client, {
    issueRepository: {
      async list(projectId) {
        return projectId === 'PRJ-1'
          ? [{ id: 'LEGACY-PRJ-1', projectId, title: '正式问题', status: 'active' }]
          : [{ id: 'ISS-2', projectId, title: '二号问题', status: 'active' }];
      }
    }
  }, { projectIds: ['PRJ-1'], limit: 1 });
  assert.equal(issues.total, 1);
  assert.equal(issues.items[0].id, 'LEGACY-PRJ-1');
  assert.equal(issues.items[0].title, '正式问题');

  const reports = await buildOutcomeReports(client, {
    reportRepository: {
      async list(projectId) {
        return projectId === 'PRJ-1'
          ? [{ id: 'RPT-1', projectId, version: 2, status: 'stale', generatedAt: '2026-08-02T00:00:00.000Z', title: '正式报告' }]
          : [];
      }
    }
  }, { projectIds: ['PRJ-1'], limit: 1 });
  assert.equal(reports.total, 2);
  assert.equal(reports.items[0].id, 'RPT-1');
  assert.equal(reports.items[0].status, 'stale');

  const noProjectScope = await buildOutcomeIssues(client, {
    issueRepository: { async list() { return []; } }
  }, { projectIds: [], limit: 10 });
  assert.equal(noProjectScope.total, 0);
});

test('outcome summary aggregates every visible project while bounding detail rows and separating collection warnings', async () => {
  const projects = Array.from({ length: 201 }, (_, index) => ({
    id: `PRJ-${String(index + 1).padStart(3, '0')}`,
    name: `项目${index + 1}`
  }));
  const client = {
    async listProjects() { return { items: projects }; },
    async getProject(id) { return { id, name: `项目${Number(id.slice(4))}` }; },
    async health() { return { ready: false }; },
    async projectCollections() {
      return {
        projectData: { items: [], available: true },
        issues: { items: [], available: true },
        reports: { items: [], available: true },
        analyses: { items: [], available: true },
        photos: { items: [], available: true },
        fieldRecords: { items: [], available: true }
      };
    },
    async listIssues() { return { items: [] }; },
    async listReports() { return { items: [] }; }
  };
  const repository = { async list() { return []; } };
  const summary = await buildOutcomeSummary(client, {
    issueRepository: repository,
    reportRepository: repository,
    analysisJobRepository: repository,
    uploadSessionRepository: repository,
    reviewSessionRepository: repository,
    spatialAnalysisRepository: repository,
    photoMetadataRepository: repository,
    sourceAssetRepository: repository
  }, { detailLimit: 200, batchSize: 10 });
  assert.equal(summary.projectCount, 201);
  assert.equal(summary.projectsTotal, 201);
  assert.equal(summary.projects.length, 200);
  assert.equal(summary.projectsTruncated, true);
  assert.equal(summary.incompleteCollectionProjectCount, 201);
  assert.equal(summary.collectionWarningProjectCount, 201);
  assert.equal(summary.collectionAnomalyProjectCount, 201);
  assert.equal(summary.stageStatus.collection, 201);
});
