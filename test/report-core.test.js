import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { computeCommunityHousingMetrics } from '../functions/api/report-metrics-core.js';
import {
  REPORT_TEMPLATE,
  assembleReportDraftDocument,
  buildReportFactBundle,
  buildReportNarrativePrompt,
  buildStoredReportDraft,
  parseNarrativeModelContent,
  selectNarrativeBlocks,
  validateReportNarrativeDraft
} from '../functions/api/report-narrative-core.js';
import { buildReportSnapshot, nextReportVersion } from '../functions/api/report-snapshot-core.js';

function projectFixture() {
  return {
    id: 'project-1',
    name: '示范项目',
    area: '测试区',
    type: '完整社区',
    scope: '测试范围',
    desc: '用于报告核心逻辑回归测试',
    scopeAreaSqKm: 1.25,
    residentialInventory: {
      items: [
        {
          id: 'community-1',
          name: '一号社区',
          householdCount: 120,
          buildingCount: 2,
          buildings: [
            { id: 'building-1', name: '一栋' },
            { id: 'building-2', name: '二栋' },
            { id: 'building-deleted', name: '已删除楼栋', status: 'deleted' }
          ]
        },
        { id: 'community-deleted', status: 'deleted', householdCount: 999, buildingCount: 9 }
      ]
    },
    communityAnalysis: {
      dimension: 'community',
      radiusKm: 1,
      spaceTotal: 3,
      rawTotal: 5,
      counts: { cat1: 2, cat2: 0 },
      center: { lng: 104, lat: 31 },
      categoryMetrics: [
        { categoryKey: 'cat1', sampleFacilities: [{ name: '养老服务站' }] }
      ],
      conclusion: '已完成设施检索',
      advice: '后续实地复核'
    }
  };
}

function issueFixture(overrides = {}) {
  return {
    id: 'issue-1',
    indicatorCode: 'IND-HOUSE-001',
    problemCode: 'H-SAFE-001',
    severity: 'high',
    communityId: 'community-1',
    buildingId: 'building-1',
    analysisId: 'analysis-1',
    originalPhotoId: 'photo-1',
    annotatedPhotoId: 'photo-1-annotated',
    location: '一栋外墙',
    ...overrides
  };
}

function reportFixture() {
  return buildReportSnapshot({
    project: projectFixture(),
    issues: [issueFixture(), issueFixture({ id: 'issue-2' })],
    photos: [{ id: 'photo-1', status: 'archived' }],
    analyses: [{ id: 'analysis-1', status: 'archived', communityId: 'community-1', buildingId: 'building-1' }],
    existing: [],
    generatedBy: '测试人员'
  });
}

test('报告版本号忽略无效值并连续递增', () => {
  assert.equal(nextReportVersion([{ version: 2 }, { version: '5' }, { version: 'invalid' }]), 6);
});

test('住房指标按楼栋去重，并以已归档分析楼栋为分母', () => {
  const metrics = computeCommunityHousingMetrics({
    project: projectFixture(),
    analyses: [
      { id: 'analysis-1', status: 'archived', communityId: 'community-1', buildingId: 'building-1' },
      { id: 'analysis-2', status: 'archived', communityId: 'community-1', buildingId: 'building-2' },
      { id: 'analysis-draft', status: 'draft', communityId: 'community-1', buildingId: 'building-3' }
    ],
    issues: [issueFixture(), issueFixture({ id: 'issue-2' })],
    calculatedAt: '2026-08-27T00:00:00.000Z'
  });

  const structural = metrics.housing.items.find((item) => item.indicatorCode === 'IND-HOUSE-001');
  assert.equal(metrics.housing.scope.buildingCount, 2);
  assert.equal(metrics.housing.scope.surveyedBuildingCount, 2);
  assert.equal(structural.issueCount, 2);
  assert.equal(structural.affectedBuildingCount, 1);
  assert.equal(structural.rate, 50);
  assert.equal(structural.status, 'ready');
  assert.deepEqual(structural.evidenceLineage.issueIds, ['issue-1', 'issue-2']);
});

test('缺楼栋编号的正式问题降级为 partial，不能推算比例', () => {
  const metrics = computeCommunityHousingMetrics({
    project: projectFixture(),
    analyses: [{ id: 'analysis-1', status: 'archived', buildingId: 'building-1' }],
    issues: [issueFixture({ buildingId: '' })]
  });
  const structural = metrics.housing.items.find((item) => item.indicatorCode === 'IND-HOUSE-001');

  assert.equal(structural.status, 'partial');
  assert.equal(structural.rate, null);
  assert.match(structural.reason, /缺少楼栋编号/);
});

test('社区指标保留真实零值，并明确标记为代理观测', () => {
  const metrics = computeCommunityHousingMetrics({ project: projectFixture() });
  const childcare = metrics.community.items.find((item) => item.categoryKey === 'cat2');
  const unavailable = metrics.community.items.find((item) => item.categoryKey === 'cat3');

  assert.equal(childcare.value, 0);
  assert.equal(childcare.status, 'partial');
  assert.equal(childcare.resultType, 'proxyObservation');
  assert.equal(unavailable.value, null);
  assert.equal(unavailable.status, 'unavailable');
});

test('街区分析不能冒充社区维度指标', () => {
  const project = projectFixture();
  project.communityAnalysis.dimension = 'block';
  const metrics = computeCommunityHousingMetrics({ project });

  assert.equal(metrics.community.status, 'unavailable');
  assert.ok(metrics.community.items.every((item) => item.value === null));
  assert.match(metrics.community.items[0].reason, /街区维度/);
});

test('报告快照排除已删除台账并保留证据来源编号', () => {
  const report = reportFixture();

  assert.equal(report.id, 'RPT-project-1-V0001');
  assert.equal(report.snapshot.housing.communityCount, 1);
  assert.equal(report.snapshot.housing.buildingCount, 2);
  assert.equal(report.snapshot.housing.householdCount, 120);
  assert.deepEqual(report.sourceIds.buildingIds, ['building-1', 'building-2']);
  assert.equal(report.snapshot.issues.total, 2);
  assert.equal(report.snapshot.issues.high, 2);
});

test('3.1.0 母版的全部正文均参考范例原文并由 AI 生成', () => {
  const blocks = selectNarrativeBlocks();
  const allTemplateBlocks = REPORT_TEMPLATE.sections.flatMap((section) => section.subsections.flatMap((subsection) => subsection.blocks));

  assert.equal(REPORT_TEMPLATE.version, '3.1.0');
  assert.equal(blocks.length, 14);
  assert.equal(allTemplateBlocks.filter((block) => block.type === 'fixed').length, 0);
  assert.ok(blocks.every((block) => block.reference?.content.includes('范例')));
  assert.ok(!REPORT_TEMPLATE.sections.some((section) => ['city-analysis', 'block-analysis', 'resident-survey'].includes(section.id)));
  assert.throws(() => selectNarrativeBlocks(REPORT_TEMPLATE, ['unknown-subsection']), /未知报告二级小节/);
});

test('网页母版与 CloudBase 函数内置母版保持完全一致', () => {
  const webTemplate = readFileSync(new URL('../assets/reports/report-template.json', import.meta.url), 'utf8');
  const functionTemplate = readFileSync(new URL('../functions/api/report-template.json', import.meta.url), 'utf8');

  assert.equal(functionTemplate, webTemplate);
});

test('局部生成提示词只包含指定小节和其授权 FACT 路径', () => {
  const prompt = buildReportNarrativePrompt({
    report: reportFixture(),
    subsectionIds: ['project-overview']
  });
  const payload = JSON.parse(prompt.user);

  assert.equal(payload.blocks.length, 1);
  assert.equal(payload.blocks[0].subsectionId, 'project-overview');
  assert.deepEqual(
    payload.blocks[0].allowedFactEvidenceRefs,
    payload.blocks[0].evidencePaths.map((path) => `FACT:${path}`)
  );
  assert.match(prompt.system, /通用城市体检.*背景知识补足定性叙述/);
  assert.match(prompt.system, /所有统计数字必须逐字来自事实包/);
});

test('模型 JSON 解析兼容代码围栏和外围说明', () => {
  assert.deepEqual(parseNarrativeModelContent('```json\n{"sections":[]}\n```'), { sections: [] });
  assert.deepEqual(parseNarrativeModelContent('说明文字 {"sections":[]} 结束'), { sections: [] });
  assert.throws(() => parseNarrativeModelContent('不是 JSON'), /未返回合法/);
});

test('草稿校验拒绝当前小节未授权但实际存在的 FACT 路径', () => {
  const report = reportFixture();
  const draft = {
    sections: [{
      sectionId: 'work-overview',
      subsectionId: 'project-overview',
      blockId: 'project-overview-narrative',
      paragraphs: ['本段只说明项目当前已有的数据基础与边界，所有结论仍需结合后续人工复核后再进入正式成果。'],
      evidenceRefs: ['FACT:issues'],
      warnings: []
    }]
  };

  assert.throws(
    () => validateReportNarrativeDraft({ draft, report, subsectionIds: ['project-overview'] }),
    /当前小节未授权的事实路径/
  );
});

test('草稿校验接受当前小节授权的 FACT 路径并拒绝虚构数字', () => {
  const report = reportFixture();
  const baseSection = {
    sectionId: 'work-overview',
    subsectionId: 'project-overview',
    blockId: 'project-overview-narrative',
    paragraphs: ['本段只说明项目当前已有的数据基础与边界，所有结论仍需结合后续人工复核后再进入正式成果。'],
    evidenceRefs: ['FACT:project'],
    warnings: []
  };

  const validated = validateReportNarrativeDraft({
    draft: { sections: [baseSection] },
    report,
    subsectionIds: ['project-overview']
  });
  assert.equal(validated.sections.length, 1);
  assert.deepEqual(validated.sections[0].evidenceRefs, ['FACT:project']);

  assert.throws(
    () => validateReportNarrativeDraft({
      draft: { sections: [{ ...baseSection, paragraphs: ['本段虚构了项目共有 987654 栋住宅，并以这一错误数据继续形成项目判断，因此不应通过报告事实校验。'] }] },
      report,
      subsectionIds: ['project-overview']
    }),
    /事实包之外的数字/
  );

  assert.throws(
    () => validateReportNarrativeDraft({
      draft: { sections: [{ ...baseSection, paragraphs: ['本节相关内容暂无数据，待补充权威资料后再形成结论。'] }] },
      report,
      subsectionIds: ['project-overview']
    }),
    /未完成占位语/
  );
});

test('局部草稿合并保留其他小节，并隔离旧模板版本', () => {
  const report = reportFixture();
  const oldSection = {
    sectionId: 'community-analysis',
    subsectionId: 'community-results',
    blockId: 'community-overall-narrative',
    paragraphs: ['原有社区段落'],
    evidenceRefs: ['FACT:metrics.community'],
    warnings: []
  };
  report.draft = { templateVersion: REPORT_TEMPLATE.version, sections: [oldSection] };
  const replacement = {
    sectionId: 'work-overview',
    subsectionId: 'project-overview',
    blockId: 'project-overview-narrative',
    paragraphs: ['新的项目概况段落'],
    evidenceRefs: ['FACT:project'],
    warnings: []
  };

  const merged = buildStoredReportDraft({
    report,
    validatedDraft: { sections: [replacement] },
    model: 'test-model',
    requestId: 'request-1',
    usage: null,
    subsectionIds: ['project-overview']
  });
  assert.equal(merged.sections.length, 2);
  assert.equal(merged.sections[0].blockId, 'project-overview-narrative');
  assert.equal(merged.sections[1].blockId, 'community-overall-narrative');

  report.draft.templateVersion = '2.2.0';
  const isolated = buildStoredReportDraft({ report, validatedDraft: { sections: [replacement] } });
  assert.deepEqual(isolated.sections.map((section) => section.blockId), ['project-overview-narrative']);
});

test('未生成 AI 时组装完整母版兜底正文和二十二项指标明细', () => {
  const report = reportFixture();
  const facts = buildReportFactBundle(report);
  const document = assembleReportDraftDocument({ report });
  const blocks = document.sections.flatMap((section) => section.subsections.flatMap((subsection) => subsection.blocks));
  const metricDetails = blocks.filter((block) => block.type === 'metric-detail');

  assert.equal(facts.metrics.catalog.length, 22);
  assert.equal(document.completeness.narrativeTotal, 14);
  assert.equal(document.completeness.narrativeReady, 0);
  assert.equal(document.completeness.narrativeFallback, 14);
  assert.equal(document.completeness.complete, false);
  assert.equal(metricDetails.reduce((sum, block) => sum + block.items.length, 0), 22);
  assert.ok(blocks.filter((block) => block.type === 'ai-narrative').every((block) => block.status === 'fallback'));
});
