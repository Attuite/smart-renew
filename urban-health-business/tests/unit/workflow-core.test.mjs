import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflow } from '../../packages/workflow-core/index.mjs';

const readyCapabilities = {
  ai: { ready: true },
  gis: { ready: true },
  indicator: { ready: false, reason: 'indicator_engine_not_integrated' },
  report: { ready: true }
};

test('empty real project is ready for collection and never receives demo results', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-EMPTY', revision: 1 },
    capabilities: readyCapabilities
  });

  assert.equal(workflow.stages.length, 6);
  assert.equal(workflow.stages[0].status, 'ready');
  assert.equal(workflow.stages[1].status, 'blocked');
  assert.equal(workflow.stages[4].status, 'unavailable');
  assert.equal(workflow.stages[4].progress.percent, null);
  assert.equal(workflow.overall.unavailableCount, 1);
  assert.equal(JSON.stringify(workflow).includes('82.4'), false);
});

test('real data flows from photo through official issue and report', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-001', revision: 4 },
    photos: [{ id: 'PHOTO-001', status: 'completed' }],
    analyses: [{
      id: 'ANL-001',
      status: 'archived',
      result: {
        issues: [{ id: 'CAND-001', reviewStatus: 'confirmed' }]
      }
    }],
    officialIssues: [{
      id: 'ISSUE-001',
      geometry: { type: 'Point', coordinates: [108.9, 34.2] }
    }],
    reports: [{ id: 'REPORT-001', status: 'generated' }],
    capabilities: readyCapabilities
  });

  const byId = Object.fromEntries(workflow.stages.map((stage) => [stage.id, stage]));
  assert.equal(byId.collection.status, 'completed');
  assert.equal(byId['ai-analysis'].status, 'completed');
  assert.equal(byId['human-review'].status, 'completed');
  assert.equal(byId['gis-and-issues'].status, 'completed');
  assert.equal(byId.indicators.status, 'unavailable');
  assert.equal(byId.reports.status, 'completed');
  assert.equal(byId['human-review'].outputs[0].count, 1);
});

test('zero official issues is a valid completed review and GIS outcome', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-ZERO', revision: 2 },
    photos: [{ id: 'PHOTO-001', status: 'completed' }],
    analyses: [{ id: 'ANL-001', status: 'archived', result: { issues: [] } }],
    officialIssues: [],
    capabilities: readyCapabilities
  });

  const byId = Object.fromEntries(workflow.stages.map((stage) => [stage.id, stage]));
  assert.equal(byId['human-review'].status, 'completed');
  assert.equal(byId['gis-and-issues'].status, 'completed');
  assert.equal(byId['gis-and-issues'].progress.total, 0);
});

test('missing AI capability is explicit and does not fall back to candidates', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-001' },
    photos: [{ id: 'PHOTO-001', status: 'completed' }],
    capabilities: {
      ...readyCapabilities,
      ai: { ready: false, reason: 'ai_not_configured' }
    }
  });

  const ai = workflow.stages.find((stage) => stage.id === 'ai-analysis');
  assert.equal(ai.status, 'unavailable');
  assert.equal(ai.capability.reason, 'ai_not_configured');
  assert.equal(ai.outputs[0].count, 0);
  assert.equal(workflow.overall.currentStage, 'human-review');
  assert.equal(
    workflow.stages.find((stage) => stage.id === 'human-review').status,
    'ready'
  );
});

test('completed real AI result remains completed when new AI runs become unavailable', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-001' },
    photos: [{ id: 'PHOTO-001', status: 'archived' }],
    analyses: [{
      id: 'ANL-001',
      status: 'reviewing',
      result: { issues: [{ id: 'CAND-001', reviewStatus: 'pending' }] }
    }],
    capabilities: {
      ...readyCapabilities,
      ai: { ready: false, reason: 'ai_not_configured' }
    }
  });

  const ai = workflow.stages.find((stage) => stage.id === 'ai-analysis');
  assert.equal(ai.status, 'completed');
  assert.equal(ai.capability.ready, false);
  assert.equal(ai.warnings[0].code, 'AI_CURRENTLY_UNAVAILABLE');
});

test('persistent upload and AI jobs drive workflow in-progress states after page refresh', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-JOBS' },
    photos: [{ id: 'PHOTO-001', status: 'completed' }],
    uploadSessions: [{ id: 'UPL-001', status: 'uploading' }],
    analyses: [{ id: 'AJOB-001', status: 'queued' }],
    capabilities: readyCapabilities
  });

  const byId = Object.fromEntries(workflow.stages.map((stage) => [stage.id, stage]));
  assert.equal(byId.collection.status, 'in_progress');
  assert.equal(byId['ai-analysis'].status, 'in_progress');
  assert.equal(byId['human-review'].status, 'blocked');
});

test('collection validation prevents one photo from falsely completing data governance', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-VALIDATION' },
    photos: [{ id: 'PHOTO-001', status: 'completed' }],
    collectionValidation: {
      status: 'incomplete',
      passedRequired: 4,
      requiredCount: 6,
      checks: [{
        code: 'PROJECT_BOUNDARY_REQUIRED',
        status: 'failed',
        message: '尚未登记可用于空间分析的项目边界。',
        details: {}
      }]
    },
    capabilities: readyCapabilities
  });
  const collection = workflow.stages.find((stage) => stage.id === 'collection');

  assert.equal(collection.status, 'in_progress');
  assert.equal(collection.progress.percent, 67);
  assert.equal(collection.progress.unit, '项必需校验');
  assert.equal(collection.warnings[0].code, 'PROJECT_BOUNDARY_REQUIRED');
});

test('archived manual review completes review and unlocks zero-issue GIS without AI', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-MANUAL' },
    reviewConclusions: [{ id: 'REV-MAN-001', status: 'archived', zeroIssueConfirmed: true }],
    capabilities: {
      ...readyCapabilities,
      ai: { ready: false, reason: 'ai_not_configured' }
    }
  });
  const byId = Object.fromEntries(workflow.stages.map((stage) => [stage.id, stage]));
  assert.equal(byId['ai-analysis'].status, 'unavailable');
  assert.equal(byId['human-review'].status, 'completed');
  assert.equal(byId['gis-and-issues'].status, 'completed');
  assert.equal(byId.reports.status, 'ready');
});

test('changed spatial and report inputs propagate explicit stale workflow states', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-STALE' },
    photos: [{ id: 'PHOTO-001', status: 'completed' }],
    analyses: [{ id: 'ANL-001', status: 'archived', result: { issues: [] } }],
    officialIssues: [{
      id: 'ISS-001',
      geometry: { type: 'Point', coordinates: [108.95, 34.27] }
    }],
    spatialAnalyses: [{
      id: 'SPRUN-001',
      status: 'stale',
      staleReasons: ['OFFICIAL_ISSUE_CHANGED']
    }],
    reports: [{
      id: 'RPT-001',
      status: 'stale',
      staleReasons: ['PROJECT_CHANGED']
    }],
    capabilities: readyCapabilities
  });
  const byId = Object.fromEntries(workflow.stages.map((stage) => [stage.id, stage]));
  assert.equal(byId['gis-and-issues'].status, 'stale');
  assert.equal(byId['gis-and-issues'].warnings[0].code, 'SPATIAL_ANALYSIS_STALE');
  assert.equal(byId.reports.status, 'stale');
  assert.equal(byId.reports.warnings.at(-1).code, 'REPORT_STALE');
  assert.equal(workflow.overall.hasStaleResults, true);
});

test('stale photo evidence blocks candidate review until AI is rerun', () => {
  const workflow = buildWorkflow({
    project: { id: 'PRJ-PHOTO-STALE' },
    photos: [{ id: 'PHOTO-001', status: 'completed' }],
    analyses: [{
      id: 'ANL-STALE',
      status: 'stale',
      staleReasons: ['PHOTO_METADATA_CHANGED'],
      result: { issues: [{ id: 'CAND-001', reviewStatus: 'pending' }] }
    }],
    capabilities: readyCapabilities
  });
  const byId = Object.fromEntries(workflow.stages.map((stage) => [stage.id, stage]));

  assert.equal(byId['ai-analysis'].status, 'stale');
  assert.equal(byId['human-review'].status, 'blocked');
  assert.equal(byId['human-review'].blockers[0].code, 'AI_ANALYSIS_STALE');
  assert.equal(workflow.overall.currentStage, 'human-review');
});
