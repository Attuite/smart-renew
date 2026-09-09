/**
 * generation-validation.test.mjs
 * 测试 LLM 生成提示词构建、输出解析和正文校验
 */

import { buildGenerationPrompt, parseGenerationOutput, detectAILanguage } from '../../functions/api/report-generation-core.js';
import { validateReportContent } from '../../functions/api/report-validation-core.js';

let passed = 0;
let failed = 0;

function assert(c, m) { if (c) { passed++; } else { failed++; console.error('FAIL: ' + m); } }
function assertEqual(a, b, m) { if (a === b) { passed++; } else { failed++; console.error('FAIL: ' + m + ' (' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + ')'); } }
function assertThrows(fn, m) { try { fn(); failed++; console.error('FAIL: expected throw - ' + m); } catch { passed++; } }

console.log('=== generation-validation tests ===\n');

// --- detectAILanguage ---
assertEqual(detectAILanguage('这是一段正式报告正文。').length, 0, 'no AI language in normal text');
assert(detectAILanguage('作为 AI，我无法判断').length > 0, 'detects AI language');
assert(detectAILanguage('根据您提供的信息，以下分析').length > 0, 'detects user-provided');
assert(detectAILanguage('以上内容仅供参考').length > 0, 'detects reference only');
assert(detectAILanguage('请补充相关资料').length > 0, 'detects please supplement');
assert(detectAILanguage('模型分析显示').length > 0, 'detects model analysis');

// --- buildGenerationPrompt ---
const mockContext = {
  project: { name: '测试项目', administrativeArea: '测试区', scopeAreaSqKm: 2.5 },
  housing: { communityCount: 5, buildingCount: 20, householdCount: 1500, communitiesWithBuildingDetail: 3, communitiesWithHouseholdData: 4, communities: [] },
  photos: { originalCount: 30, annotatedCount: 10, communitiesWithPhotos: 4, buildingsWithPhotos: 15 },
  analyses: { totalCount: 5, archivedCount: 5 },
  officialIssues: {
    totalCount: 15, stats: { high: 3, medium: 8, low: 4 },
    indicatorCounts: { 'IND-HOUSE-003': 5, 'IND-HOUSE-001': 3 },
    communitiesAffected: 4, buildingsAffected: 10,
    communityRiskDistribution: {}, buildingRiskDistribution: {},
    withOriginalPhoto: 12, withAnnotatedPhoto: 8,
    remediationCategories: ['建议加固', '建议整改'],
    items: []
  },
  communityAnalysis: null,
  availability: { missingFields: [], missingImageSlots: [], warnings: [] },
  sourceIds: { projectIds: ['p1'] },
  contextHash: 'abc123'
};

const mockCalc = {
  results: [
    { ruleId: 'CALC-HOUSING-COMMUNITY-COUNT', label: '住宅小区数量', value: 5, formattedValue: '5个', status: 'calculated' },
    { ruleId: 'CALC-ISSUE-HIGH-RATE', label: '高风险问题占比', value: 20, formattedValue: '20%', status: 'calculated' }
  ]
};

const prompt = buildGenerationPrompt({
  section: { key: '3.1-achievements', title: '3.1 工作成效', purpose: '总结项目工作成效' },
  context: mockContext,
  calculations: mockCalc,
  previousSummaries: ['第1章完成了工作概述']
});

assert(prompt.systemPrompt.length > 100, 'system prompt exists');
assert(prompt.userPrompt.includes('3.1 工作成效'), 'user prompt includes section title');
assert(prompt.userPrompt.includes('测试项目'), 'user prompt includes project name');
assert(prompt.userPrompt.includes('5个'), 'user prompt includes calculated numbers');
assert(prompt.allowedNumbers.length > 0, 'allowed numbers collected');
assert(prompt.userPrompt.includes('此前已审核章节摘要'), 'previous summaries included');

// --- parseGenerationOutput ---
const goodOutput = JSON.stringify({
  sectionKey: '3.1-achievements',
  title: '工作成效',
  paragraphs: [
    { id: 'p1', text: '本项目在住区安全体检方面取得了显著成效。' },
    { id: 'p2', text: '共采集现场照片30张，完成分析批次5个。' }
  ],
  tableNarratives: [],
  usedFactKeys: ['project.name'],
  usedCalculationKeys: ['CALC-HOUSING-COMMUNITY-COUNT']
});

const parsed = parseGenerationOutput(goodOutput);
assertEqual(parsed.paragraphs.length, 2, 'parsed 2 paragraphs');
assert(parsed.paragraphs[0].text.includes('显著成效'), 'paragraph text preserved');
assertEqual(parsed.usedFactKeys.length, 1, 'fact keys preserved');

// 解析失败
assertThrows(() => parseGenerationOutput(''), 'empty output throws');
assertThrows(() => parseGenerationOutput('no json here'), 'no json throws');
assertThrows(() => parseGenerationOutput('{"no": "paragraphs"}'), 'missing paragraphs throws');
assertThrows(() => parseGenerationOutput('{"paragraphs": []}'), 'empty paragraphs throws');

// 解析带多余文字的 JSON
const messyOutput = '以下是生成结果：\n' + goodOutput + '\n\n以上是全部内容。';
const parsed2 = parseGenerationOutput(messyOutput);
assertEqual(parsed2.paragraphs.length, 2, 'extracts json from messy output');

// --- validateReportContent ---
const validResult = validateReportContent({
  text: '本项目共涉及5个住宅小区，20栋住宅楼。',
  projectCity: '测试市',
  allowedNumbers: ['住宅小区数量：5个', '住宅楼栋数量：20栋']
});
assert(validResult.valid, 'valid content passes');

// AI 语言
const aiResult = validateReportContent({
  text: '作为 AI，我认为本项目存在以下问题。',
  projectCity: '测试市'
});
assert(!aiResult.valid, 'AI language fails validation');
assert(aiResult.issues.some(function (i) { return i.type === 'ai-language'; }), 'ai-language issue type');

// 旧项目残留
const oldResult = validateReportContent({
  text: '虹苑路社区和金祥寺社区共计34个小区。',
  projectCity: '西安市'
});
assert(!oldResult.valid, 'old project content fails');
assert(oldResult.issues.some(function (i) { return i.type === 'old-project-geo'; }), 'old-project-geo issue type');

// 绵阳项目不检测绵阳关键词
const mianyangResult = validateReportContent({
  text: '绵阳市科技城新区虹苑路社区。',
  projectCity: '绵阳市'
});
assert(mianyangResult.valid, 'mianyang project allows mianyang keywords');

// 内部编号
const internalResult = validateReportContent({
  text: '问题 PRB-03-01 涉及楼道安全。',
  projectCity: '测试市'
});
assert(!internalResult.valid, 'internal IDs fail');
assert(internalResult.issues.some(function (i) { return i.type === 'internal-id'; }), 'internal-id issue type');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
