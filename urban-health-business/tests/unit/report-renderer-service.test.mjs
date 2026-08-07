import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportContentSnapshot,
  buildReportSections,
  renderReportHtml
} from '../../server/services/report-renderer-service.mjs';

test('report snapshot freezes project, issue, community and annotated photo sources', () => {
  const snapshot = buildReportContentSnapshot({
    id: 'PRJ-1',
    name: '真实项目',
    area: '测试区',
    residentialInventory: {
      items: [{
        id: 'COMM-1',
        name: '一号社区',
        address: '测试路',
        buildings: [{ id: 'BLD-1' }]
      }]
    }
  }, [{
    id: 'ISS-1',
    title: '外墙风险',
    severity: 'high',
    originalPhotoId: 'PHOTO-1',
    annotatedPhotoId: 'PHOTO-A-1',
    geometry: { type: 'Point', coordinates: [108.9, 34.2] }
  }], [{ id: 'ANL-1', status: 'archived' }], {
    spatialAnalyses: [{ id: 'SPR-1', type: 'radius' }],
    reviewConclusions: [{ id: 'REV-1' }],
    photos: [{ id: 'PHOTO-1' }]
  });

  assert.equal(snapshot.project.communityCount, 1);
  assert.equal(snapshot.project.buildingCount, 1);
  assert.equal(snapshot.issues[0].annotatedPhotoId, 'PHOTO-A-1');
  assert.deepEqual(snapshot.sourceIds.spatialAnalysisIds, ['SPR-1']);
  assert.deepEqual(snapshot.sourceIds.reviewConclusionIds, ['REV-1']);
});

test('dynamic report renderer includes issue table, gallery and source index', () => {
  const report = {
    title: '测试报告',
    version: 1,
    reportRevision: 1,
    generatedAt: '2026-07-29T00:00:00.000Z',
    editorial: { executiveSummary: '综合研判', recommendations: '行动建议' },
    dataSnapshot: { severity: { high: 1, medium: 0, low: 0 }, locatedIssueCount: 1 },
    indicatorSnapshot: { status: 'unavailable' },
    notices: ['指标引擎未接入。'],
    contentSnapshot: {
      project: { id: 'PRJ-1', name: '真实项目', communityCount: 1, buildingCount: 1 },
      communities: [{ id: 'COMM-1', name: '社区', buildingCount: 1 }],
      issues: [{
        id: 'ISS-1',
        title: '外墙风险',
        severity: 'high',
        categoryName: '外墙',
        annotatedPhotoId: 'PHOTO-A-1'
      }],
      annotatedPhotos: [{
        photoId: 'PHOTO-A-1',
        issueId: 'ISS-1',
        title: '外墙风险',
        severity: 'high'
      }],
      spatialAnalyses: [],
      sourceIds: { projectId: 'PRJ-1', analysisIds: ['ANL-1'], officialIssueIds: ['ISS-1'] }
    }
  };
  const sections = buildReportSections(report);
  const html = renderReportHtml({ ...report, sections });

  assert.equal(sections.find((section) => section.id === 'evidence').itemCount, 1);
  assert.match(html, /AI识别与人工复核问题/);
  assert.match(html, /PHOTO-A-1\/content/);
  assert.match(html, /来源索引/);
  assert.doesNotMatch(html, /82\\.4/);
});
