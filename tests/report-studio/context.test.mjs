/**
 * context.test.mjs
 * 测试报告上下文构建模块
 * 使用 Node 内置 node:test（如可用）或手动断言
 */

import { buildReportContext } from '../../functions/api/report-context-core.js';

// === 测试数据 ===

function makeProject(overrides = {}) {
  return {
    id: 'test-project-001',
    name: '测试城市体检项目',
    administrativeArea: '测试市测试区',
    area: 'residential',
    type: '综合更新',
    stage: 'survey',
    scope: '测试范围',
    scopeAreaSqKm: 2.5,
    desc: '测试说明',
    responsibleUnit: '测试单位',
    plannedPeriod: '2026-2028',
    updatedAt: '2026-09-01T00:00:00Z',
    residentialInventory: {
      items: [
        {
          id: 'comm-1',
          name: '测试小区A',
          buildingCount: 3,
          householdCount: 300,
          buildings: [
            { id: 'bld-1', name: '1号楼', householdCount: 100, status: 'active' },
            { id: 'bld-2', name: '2号楼', householdCount: 100, status: 'active' },
            { id: 'bld-3', name: '3号楼', householdCount: 100, status: 'active' }
          ]
        },
        {
          id: 'comm-2',
          name: '测试小区B',
          buildingCount: 2,
          householdCount: 200,
          buildings: []
        },
        {
          id: 'comm-deleted',
          name: '已删除小区',
          status: 'deleted',
          buildingCount: 1,
          householdCount: 50,
          buildings: []
        }
      ]
    },
    communityAnalysis: {
      categories: [
        { label: '养老服务', count: 3, names: ['养老院A', '养老院B', '养老院C'] },
        { label: '幼儿园', count: 2, names: ['幼儿园A', '幼儿园B'] }
      ],
      conclusion: '测试结论'
    },
    ...overrides
  };
}

function makePhotos() {
  return [
    { id: 'photo-1', projectId: 'test-project-001', communityId: 'comm-1', buildingId: 'bld-1', name: '现场照片1.jpg', status: 'archived', communityName: '测试小区A', buildingName: '1号楼', cloudPath: 'projects/test/photos/1.jpg' },
    { id: 'photo-2', projectId: 'test-project-001', communityId: 'comm-1', buildingId: 'bld-2', name: '现场照片2.jpg', status: 'archived', communityName: '测试小区A', buildingName: '2号楼', cloudPath: 'projects/test/photos/2.jpg' },
    { id: 'photo-annotated', projectId: 'test-project-001', communityId: 'comm-1', name: '标注图1.jpg', status: 'archived', communityName: '测试小区A', cloudPath: 'projects/test/photos/ann1.jpg' },
    { id: 'photo-deleted', projectId: 'test-project-001', name: 'deleted.jpg', status: 'deleted', communityName: '', cloudPath: '' }
  ];
}

function makeAnalyses() {
  return [
    { id: 'ana-1', projectId: 'test-project-001', status: 'archived' },
    { id: 'ana-2', projectId: 'test-project-001', status: 'archived' },
    { id: 'ana-other', projectId: 'other-project', status: 'archived' }
  ];
}

function makeIssues() {
  return [
    { id: 'iss-1', projectId: 'test-project-001', communityId: 'comm-1', buildingId: 'bld-1', problemCode: 'PRB-03-01', indicatorCode: 'IND-HOUSE-003', categoryCode: 'PRB-03', title: '楼道问题1', severity: 'high', originalPhotoId: 'photo-1', annotatedPhotoId: 'photo-annotated', suggestion: '建议整改', status: 'active' },
    { id: 'iss-2', projectId: 'test-project-001', communityId: 'comm-1', buildingId: 'bld-2', problemCode: 'PRB-03-02', indicatorCode: 'IND-HOUSE-003', categoryCode: 'PRB-03', title: '楼道问题2', severity: 'medium', originalPhotoId: 'photo-2', annotatedPhotoId: '', suggestion: '建议整改B', status: 'active' },
    { id: 'iss-3', projectId: 'test-project-001', communityId: 'comm-2', problemCode: 'PRB-01-01', indicatorCode: 'IND-HOUSE-001', categoryCode: 'PRB-01', title: '结构问题', severity: 'low', originalPhotoId: '', annotatedPhotoId: '', suggestion: '', status: 'active' },
    { id: 'iss-deleted', projectId: 'test-project-001', status: 'deleted' },
    { id: 'iss-other', projectId: 'other-project', status: 'active' }
  ];
}

// === 测试运行器 ===

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error('FAIL: ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed += 1;
  } else {
    failed += 1;
    console.error('FAIL: ' + message + ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')');
  }
}

// === 测试用例 ===

console.log('=== report-context-core tests ===\n');

// Test 1: 基本上下文构建
const ctx = buildReportContext({
  project: makeProject(),
  photos: makePhotos(),
  analyses: makeAnalyses(),
  officialIssues: makeIssues()
});

assertEqual(ctx.schemaVersion, '2.0.0', 'schema version');
assertEqual(ctx.projectId, 'test-project-001', 'project id');
assert(ctx.contextHash, 'context hash exists');

// Test 2: 住宅台账 - 软删除过滤
assertEqual(ctx.housing.communityCount, 2, 'communities: deleted filtered');
assertEqual(ctx.housing.buildingCount, 5, 'buildings: 3 detail + 2 summary');
assertEqual(ctx.housing.householdCount, 500, 'households: 300 detail + 200 summary');
assertEqual(ctx.housing.communitiesWithBuildingDetail, 1, 'communities with building detail');

// Test 3: 照片分类
assertEqual(ctx.photos.originalCount, 2, 'original photos count');
assertEqual(ctx.photos.annotatedCount, 1, 'annotated photos count');
assertEqual(ctx.photos.communitiesWithPhotos, 1, 'communities with photos');
assertEqual(ctx.photos.buildingsWithPhotos, 2, 'buildings with photos');

// Test 4: 正式问题过滤
assertEqual(ctx.officialIssues.totalCount, 3, 'active issues count');
assertEqual(ctx.officialIssues.stats.high, 1, 'high issues');
assertEqual(ctx.officialIssues.stats.medium, 1, 'medium issues');
assertEqual(ctx.officialIssues.stats.low, 1, 'low issues');
assertEqual(ctx.officialIssues.communitiesAffected, 2, 'communities affected');
assertEqual(ctx.officialIssues.buildingsAffected, 2, 'buildings affected');

// Test 5: 分析批次
assertEqual(ctx.analyses.totalCount, 2, 'project analyses count');
assertEqual(ctx.analyses.archivedCount, 2, 'archived analyses count');

// Test 6: 社区分析
assert(ctx.communityAnalysis, 'community analysis exists');
assertEqual(ctx.communityAnalysis.categories.length, 2, 'facility categories');

// Test 7: 缺失项检查
assertEqual(ctx.availability.missingFields.length, 0, 'no missing fields for complete project');
assertEqual(ctx.availability.warnings.length, 0, 'no warnings for complete project');

// Test 8: 来源追踪
assertEqual(ctx.sourceIds.projectIds.length, 1, 'source project ids');
assertEqual(ctx.sourceIds.communityIds.length, 2, 'source community ids');
assertEqual(ctx.sourceIds.issueIds.length, 3, 'source issue ids');

// Test 9: 无数据项目
const emptyCtx = buildReportContext({
  project: makeProject({ residentialInventory: { items: [] }, communityAnalysis: null }),
  photos: [],
  analyses: [],
  officialIssues: []
});
assertEqual(emptyCtx.housing.communityCount, 0, 'empty: no communities');
assertEqual(emptyCtx.photos.originalCount, 0, 'empty: no photos');
assertEqual(emptyCtx.officialIssues.totalCount, 0, 'empty: no issues');
assert(emptyCtx.availability.warnings.length > 0, 'empty: has warnings');

// Test 10: 无效项目
let errorThrown = false;
try {
  buildReportContext({ project: null, photos: [], analyses: [], officialIssues: [] });
} catch (e) {
  errorThrown = true;
}
assert(errorThrown, 'null project throws');

// Test 11: 上下文哈希稳定性
const ctx2 = buildReportContext({
  project: makeProject(),
  photos: makePhotos(),
  analyses: makeAnalyses(),
  officialIssues: makeIssues()
});
assertEqual(ctx.contextHash, ctx2.contextHash, 'context hash is deterministic');

// Test 12: 问题指标计数
assertEqual(ctx.officialIssues.indicatorCounts['IND-HOUSE-003'], 2, 'indicator count for IND-HOUSE-003');
assertEqual(ctx.officialIssues.indicatorCounts['IND-HOUSE-001'], 1, 'indicator count for IND-HOUSE-001');

// Test 13: 有原图/标注图证据的问题数
assertEqual(ctx.officialIssues.withOriginalPhoto, 2, 'issues with original photo');
assertEqual(ctx.officialIssues.withAnnotatedPhoto, 1, 'issues with annotated photo');

// Test 14: 整改建议去重
assert(ctx.officialIssues.remediationCategories.length <= 2, 'remediation dedup');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
