/**
 * calculations.test.mjs
 * 测试计算引擎模块
 */

import { runAllCalculations, getAllRules, getRulesByCategory } from '../../functions/api/report-calculation-core.js';
import { buildReportContext } from '../../functions/api/report-context-core.js';

// === 测试数据 ===

function makeProject(overrides = {}) {
  return {
    id: 'test-project-001',
    name: '测试项目',
    administrativeArea: '测试区',
    scopeAreaSqKm: 2.5,
    residentialInventory: {
      items: [
        {
          id: 'comm-1', name: '小区A', buildingCount: 3, householdCount: 300,
          buildings: [
            { id: 'bld-1', name: '1号楼', householdCount: 100, status: 'active' },
            { id: 'bld-2', name: '2号楼', householdCount: 100, status: 'active' },
            { id: 'bld-3', name: '3号楼', householdCount: 100, status: 'active' }
          ]
        },
        { id: 'comm-2', name: '小区B', buildingCount: 2, householdCount: 200, buildings: [] }
      ]
    },
    communityAnalysis: {
      categories: [
        { label: '养老服务', count: 3 },
        { label: '幼儿园', count: 2 },
        { label: '停车场', count: 5 }
      ]
    },
    ...overrides
  };
}

function makeFullContext() {
  return buildReportContext({
    project: makeProject(),
    photos: [
      { id: 'p1', projectId: 'test-project-001', communityId: 'comm-1', buildingId: 'bld-1', name: 'photo1.jpg', status: 'archived' },
      { id: 'p2', projectId: 'test-project-001', communityId: 'comm-1', name: 'photo2.jpg', status: 'archived' },
      { id: 'p3', projectId: 'test-project-001', communityId: 'comm-2', name: '标注图.jpg', status: 'archived' }
    ],
    analyses: [{ id: 'a1', projectId: 'test-project-001', status: 'archived' }],
    officialIssues: [
      { id: 'i1', projectId: 'test-project-001', communityId: 'comm-1', buildingId: 'bld-1', severity: 'high', indicatorCode: 'IND-HOUSE-001', categoryCode: 'PRB-01', originalPhotoId: 'p1', annotatedPhotoId: 'p3', suggestion: '建议A', status: 'active' },
      { id: 'i2', projectId: 'test-project-001', communityId: 'comm-1', severity: 'medium', indicatorCode: 'IND-HOUSE-002', categoryCode: 'PRB-02', originalPhotoId: 'p2', status: 'active' },
      { id: 'i3', projectId: 'test-project-001', communityId: 'comm-2', severity: 'low', indicatorCode: 'IND-HOUSE-001', categoryCode: 'PRB-01', status: 'active' },
      { id: 'i4', projectId: 'test-project-001', severity: 'high', indicatorCode: 'IND-HOUSE-003', originalPhotoId: 'x', status: 'active' }
    ]
  });
}

// === 测试 ===

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; } else { failed++; console.error('FAIL: ' + msg); }
}

function assertEqual(a, b, msg) {
  if (a === b) { passed++; } else { failed++; console.error('FAIL: ' + msg + ' (' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + ')'); }
}

console.log('=== report-calculation-core tests ===\n');

// Test 1: 规则注册
const allRules = getAllRules();
assert(allRules.length > 0, 'rules registered');
assertEqual(allRules.length, 27, 'total rule count');

// Test 2: 按类别查找
const housingRules = getRulesByCategory('housing');
assert(housingRules.length > 0, 'housing rules exist');
const photoRules = getRulesByCategory('photos');
assert(photoRules.length > 0, 'photo rules exist');

// Test 3: 完整计算
const ctx = makeFullContext();
const snapshot = runAllCalculations(ctx);

assert(snapshot.schemaVersion, 'snapshot has version');
assert(snapshot.contextHash, 'snapshot has contextHash');
assertEqual(snapshot.projectId, 'test-project-001', 'snapshot project id');
assert(snapshot.results.length > 0, 'has calculation results');

// Test 4: 小区数量
const communityCountRule = snapshot.results.find((r) => r.ruleId === 'CALC-HOUSING-COMMUNITY-COUNT');
assert(communityCountRule, 'community count rule exists');
assertEqual(communityCountRule.value, 2, 'community count = 2');
assertEqual(communityCountRule.status, 'calculated', 'community count status');

// Test 5: 楼栋数
const buildingCountRule = snapshot.results.find((r) => r.ruleId === 'CALC-HOUSING-BUILDING-COUNT');
assertEqual(buildingCountRule.value, 5, 'building count = 5 (3 detail + 2 summary)');

// Test 6: 户数
const householdRule = snapshot.results.find((r) => r.ruleId === 'CALC-HOUSING-HOUSEHOLD-COUNT');
assertEqual(householdRule.value, 500, 'household count = 500 (300 detail + 200 summary)');

// Test 7: 小区资料完整率
const detailRate = snapshot.results.find((r) => r.ruleId === 'CALC-HOUSING-COMMUNITY-DETAIL-RATE');
assertEqual(detailRate.value, 50, 'community detail rate = 50% (1/2)');

// Test 8: 照片数量
const photoCount = snapshot.results.find((r) => r.ruleId === 'CALC-PHOTO-ORIGINAL-COUNT');
assertEqual(photoCount.value, 2, 'original photo count = 2');

// Test 9: 问题数量
const issueCount = snapshot.results.find((r) => r.ruleId === 'CALC-ISSUE-TOTAL');
assertEqual(issueCount.value, 4, 'issue count = 4');

// Test 10: 高风险数量
const highCount = snapshot.results.find((r) => r.ruleId === 'CALC-ISSUE-HIGH-COUNT');
assertEqual(highCount.value, 2, 'high risk count = 2');

// Test 11: 高风险占比
const highRate = snapshot.results.find((r) => r.ruleId === 'CALC-ISSUE-HIGH-RATE');
assertEqual(highRate.value, 50, 'high risk rate = 50%');

// Test 12: 涉及小区数
const communitiesAffected = snapshot.results.find((r) => r.ruleId === 'CALC-ISSUE-COMMUNITIES-AFFECTED');
assertEqual(communitiesAffected.value, 2, 'communities affected = 2 (comm-1, comm-2)');

// Test 13: 项目范围面积
const scopeArea = snapshot.results.find((r) => r.ruleId === 'CALC-HOUSING-SCOPE-AREA');
assertEqual(scopeArea.value, 2.5, 'scope area = 2.5');

// Test 14: 设施密度
const density = snapshot.results.find((r) => r.ruleId === 'CALC-COMMUNITY-FACILITY-DENSITY');
assertEqual(density.value, 4, 'facility density = 10/2.5 = 4');

// Test 15: 按类别分组
assert(snapshot.byCategory.housing.length > 0, 'housing category grouped');
assert(snapshot.byCategory.issues.length > 0, 'issues category grouped');

// Test 16: 缺失值处理
const emptyCtx = buildReportContext({
  project: makeProject({ scopeAreaSqKm: 0, residentialInventory: { items: [] }, communityAnalysis: null }),
  photos: [], analyses: [], officialIssues: []
});
const emptySnapshot = runAllCalculations(emptyCtx);
const emptyScope = emptySnapshot.results.find((r) => r.ruleId === 'CALC-HOUSING-SCOPE-AREA');
assertEqual(emptyScope.status, 'not-computable', 'scope area not-computable when 0');

const emptyDensity = emptySnapshot.results.find((r) => r.ruleId === 'CALC-COMMUNITY-FACILITY-DENSITY');
assertEqual(emptyDensity.status, 'not-computable', 'density not-computable without data');

// Test 17: 计算确定性（相同输入相同输出）
const snapshot2 = runAllCalculations(ctx);
assertEqual(snapshot.contextHash, snapshot2.contextHash, 'deterministic: same context hash');
const rule1 = snapshot.results.find((r) => r.ruleId === 'CALC-ISSUE-HIGH-RATE');
const rule2 = snapshot2.results.find((r) => r.ruleId === 'CALC-ISSUE-HIGH-RATE');
assertEqual(rule1.value, rule2.value, 'deterministic: same high rate');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
