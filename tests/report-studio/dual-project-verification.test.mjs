/**
 * dual-project-verification.test.mjs
 * 阶段 9：双项目验收测试。
 * 使用西安和绵阳两个模拟项目数据，验证完整流水线：
 *   上下文构建 → 计算 → 生成提示词 → 校验 → Word 生成
 * 验证项目隔离、旧项目残留检测和数据正确性。
 */

import { buildReportContext } from '../../functions/api/report-context-core.js';
import { runAllCalculations } from '../../functions/api/report-calculation-core.js';
import { buildGenerationPrompt, parseGenerationOutput, detectAILanguage } from '../../functions/api/report-generation-core.js';
import { validateReportContent } from '../../functions/api/report-validation-core.js';
import { generateDocx } from '../../functions/api/report-docx-core.js';
import {
  createDraft, createSection, saveSectionGenerated, reviewSection,
  transitionSection, SectionStatus
} from '../../functions/api/report-draft-core.js';
import fs from 'node:fs/promises';
import path from 'node:path';

let passed = 0;
let failed = 0;

function assert(c, m) { if (c) { passed++; } else { failed++; console.error('FAIL: ' + m); } }
function assertEqual(a, b, m) { if (a === b) { passed++; } else { failed++; console.error('FAIL: ' + m + ' (' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + ')'); } }

console.log('=== dual-project verification ===\n');

// === 加载测试数据 ===
const xianProj = JSON.parse(await fs.readFile(path.join(process.cwd(), 'tests', 'report-studio', 'fixtures', 'xian-project.json'), 'utf8'));
const myProj = JSON.parse(await fs.readFile(path.join(process.cwd(), 'tests', 'report-studio', 'fixtures', 'mianyang-project.json'), 'utf8'));

// 模拟照片和问题
const xianPhotos = [
  { id: 'xp-1', projectId: 'xian-yanta-001', communityId: 'xian-comm-1', buildingId: 'xian-bld-1', name: '现场照片1.jpg', status: 'archived', communityName: '紫薇花园' },
  { id: 'xp-2', projectId: 'xian-yanta-001', communityId: 'xian-comm-2', buildingId: 'xian-bld-9', name: '现场照片2.jpg', status: 'archived', communityName: '世家星城' },
  { id: 'xp-ann', projectId: 'xian-yanta-001', communityId: 'xian-comm-1', name: '标注图1.jpg', status: 'archived', communityName: '紫薇花园' }
];

const xianIssues = [
  { id: 'xi-1', projectId: 'xian-yanta-001', communityId: 'xian-comm-1', buildingId: 'xian-bld-1', problemCode: 'PRB-03-01', indicatorCode: 'IND-HOUSE-003', categoryCode: 'PRB-03', title: '楼道堆放杂物', severity: 'high', originalPhotoId: 'xp-1', annotatedPhotoId: 'xp-ann', suggestion: '清理楼道堆放物并设置标识', status: 'active' },
  { id: 'xi-2', projectId: 'xian-yanta-001', communityId: 'xian-comm-2', problemCode: 'PRB-01-02', indicatorCode: 'IND-HOUSE-001', categoryCode: 'PRB-01', title: '外墙裂缝', severity: 'medium', originalPhotoId: 'xp-2', suggestion: '进行结构安全评估', status: 'active' },
  { id: 'xi-3', projectId: 'xian-yanta-001', communityId: 'xian-comm-3', problemCode: 'PRB-04-01', indicatorCode: 'IND-HOUSE-004', categoryCode: 'PRB-04', title: '屋面渗漏', severity: 'low', originalPhotoId: '', suggestion: '修缮屋面防水层', status: 'active' }
];

const myPhotos = [
  { id: 'mp-1', projectId: 'mianyang-001', communityId: 'my-comm-1', name: '现场照片M1.jpg', status: 'archived', communityName: '虹苑路社区小区' }
];

const myIssues = [
  { id: 'mi-1', projectId: 'mianyang-001', communityId: 'my-comm-1', problemCode: 'PRB-03-01', indicatorCode: 'IND-HOUSE-003', categoryCode: 'PRB-03', title: '消防通道堵塞', severity: 'high', originalPhotoId: 'mp-1', suggestion: '疏通消防通道', status: 'active' },
  { id: 'mi-2', projectId: 'mianyang-001', communityId: 'my-comm-2', problemCode: 'PRB-02-01', indicatorCode: 'IND-HOUSE-002', categoryCode: 'PRB-02', title: '燃气管道老化', severity: 'high', originalPhotoId: '', suggestion: '更换燃气管道', status: 'active' }
];

// ============================================================
// 1. 西安项目完整流水线
// ============================================================
console.log('--- Xi\'an project pipeline ---');

const xianCtx = buildReportContext({ project: xianProj, photos: xianPhotos, analyses: [{ id: 'xa-1', projectId: 'xian-yanta-001', status: 'archived' }], officialIssues: xianIssues });
assertEqual(xianCtx.projectId, 'xian-yanta-001', 'xian: projectId');
assertEqual(xianCtx.housing.communityCount, 3, 'xian: 3 active communities');
assertEqual(xianCtx.housing.buildingCount, 19, 'xian: 19 buildings (8+6 detail + 5 summary)');
assertEqual(xianCtx.housing.householdCount, 1520, 'xian: 1520 households (1120 detail + 400 summary)');
assertEqual(xianCtx.photos.originalCount, 2, 'xian: 2 original photos');
assertEqual(xianCtx.photos.annotatedCount, 1, 'xian: 1 annotated photo');
assertEqual(xianCtx.officialIssues.totalCount, 3, 'xian: 3 issues');
assert(xianCtx.communityAnalysis, 'xian: has community analysis');

const xianCalc = runAllCalculations(xianCtx);
assertEqual(xianCalc.projectId, 'xian-yanta-001', 'xian: calc projectId');
const xianCommunityCount = xianCalc.results.find((r) => r.ruleId === 'CALC-HOUSING-COMMUNITY-COUNT');
assertEqual(xianCommunityCount.value, 3, 'xian: community count = 3');
const xianHighRate = xianCalc.results.find((r) => r.ruleId === 'CALC-ISSUE-HIGH-RATE');
assertEqual(xianHighRate.value, 33.3, 'xian: high rate ≈ 33.3%');
const xianDensity = xianCalc.results.find((r) => r.ruleId === 'CALC-COMMUNITY-FACILITY-DENSITY');
assertEqual(xianDensity.value, 9.38, 'xian: facility density = 30/3.2 ≈ 9.38');

// 生成提示词
const xianPrompt = buildGenerationPrompt({
  section: { key: '1.1-background', title: '1.1 工作背景' },
  context: xianCtx, calculations: xianCalc, previousSummaries: []
});
assert(xianPrompt.userPrompt.includes('西安市雁塔区'), 'xian: prompt has project name');
assert(xianPrompt.userPrompt.includes('3 个'), 'xian: prompt has community count');
assert(!xianPrompt.userPrompt.includes('虹苑路社区'), 'xian: no Mianyang community names');

// 模拟 LLM 输出并校验
const xianLLMOutput = JSON.stringify({
  sectionKey: '1.1-background', title: '1.1 工作背景',
  paragraphs: [{ id: 'p1', text: '西安市雁塔区城市体检评估工作是推动城市治理体系和治理能力现代化的重要举措。本次体检范围覆盖3个住宅小区，共计14栋住宅楼。' }],
  usedFactKeys: ['project.name', 'housing.communityCount'], usedCalculationKeys: ['CALC-HOUSING-COMMUNITY-COUNT']
});
const xianParsed = parseGenerationOutput(xianLLMOutput);
assertEqual(xianParsed.paragraphs.length, 1, 'xian: parsed 1 paragraph');

// 正文校验 - 西安项目不应包含绵阳内容
const xianValidation = validateReportContent({
  text: xianParsed.paragraphs[0].text,
  projectCity: '西安市',
  allowedNumbers: ['住宅小区数量：3个', '住宅楼栋数量：14栋']
});
assert(xianValidation.valid, 'xian: validation passes');

// 检测旧项目残留（如果混入了绵阳内容）
const contaminatedText = '西安市雁塔区虹苑路社区进行了体检。';
const contaminatedResult = validateReportContent({ text: contaminatedText, projectCity: '西安市' });
assert(!contaminatedResult.valid, 'xian: detects Mianyang contamination');
assert(contaminatedResult.issues.some((i) => i.type === 'old-project-geo'), 'xian: contamination is old-project-geo type');

// Word 生成
const xianSections = [
  createSection({ draftId: 'd-xian', projectId: 'xian-yanta-001', sectionKey: '1.1-background', blockId: 'p-0008' }),
  createSection({ draftId: 'd-xian', projectId: 'xian-yanta-001', sectionKey: 'cover', blockId: 'p-0001' })
];
xianSections[0] = saveSectionGenerated(xianSections[0], { paragraphs: [{ id: 'p1', text: '西安市雁塔区城市体检评估工作是推动城市治理现代化的重要举措。' }] }, 'test-model', ['project.name'], [], 'hash1');
xianSections[1] = saveSectionGenerated(xianSections[1], { paragraphs: [{ id: 'p1', text: '西安市雁塔区城市体检报告' }] }, 'test-model', [], [], 'hash2');

const xianDocx = await generateDocx({
  templateBlocks: [
    { id: 'p-0001', type: 'paragraph', style: 'Normal', text: '封面标题' },
    { id: 'p-0006', type: 'paragraph', style: 'Heading 1', text: '一、工作概述' },
    { id: 'p-0008', type: 'paragraph', style: 'Normal', text: '默认正文' }
  ],
  sections: xianSections,
  context: xianCtx, calculations: xianCalc, edition: 'formal'
});
assert(xianDocx instanceof Buffer, 'xian: docx generated');
assert(xianDocx.length > 500, 'xian: docx has content');

// ============================================================
// 2. 绵阳项目完整流水线
// ============================================================
console.log('\n--- Mianyang project pipeline ---');

const myCtx = buildReportContext({ project: myProj, photos: myPhotos, analyses: [{ id: 'ma-1', projectId: 'mianyang-001', status: 'archived' }], officialIssues: myIssues });
assertEqual(myCtx.projectId, 'mianyang-001', 'my: projectId');
assertEqual(myCtx.housing.communityCount, 3, 'my: 3 communities');
assertEqual(myCtx.housing.buildingCount, 17, 'my: 17 buildings (3 detail + 8 + 6 from summaries)');
assertEqual(myCtx.housing.householdCount, 1360, 'my: 1360 households (240 detail + 640 + 480)');
assertEqual(myCtx.officialIssues.totalCount, 2, 'my: 2 issues');

const myCalc = runAllCalculations(myCtx);
const myHighRate = myCalc.results.find((r) => r.ruleId === 'CALC-ISSUE-HIGH-RATE');
assertEqual(myHighRate.value, 100, 'my: high rate = 100%');

// 绵阳项目允许出现绵阳关键词
const myValidation = validateReportContent({
  text: '绵阳市科技城新区虹苑路社区小区共12栋住宅楼。',
  projectCity: '绵阳市',
  allowedNumbers: ['住宅楼栋数量：12栋']
});
assert(myValidation.valid, 'my: Mianyang content allowed for Mianyang project');

// ============================================================
// 3. 项目隔离验证
// ============================================================
console.log('\n--- Cross-project isolation ---');

assertNotEqual(xianCtx.projectId, myCtx.projectId, 'isolation: different projectIds');
assertNotEqual(xianCtx.housing.buildingCount, myCtx.housing.buildingCount, 'isolation: different building counts');
assert(xianCtx.sourceIds.communityIds.every((id) => id.startsWith('xian-')), 'isolation: xian community IDs');
assert(myCtx.sourceIds.communityIds.every((id) => id.startsWith('my-')), 'isolation: my community IDs');
assert(xianCtx.sourceIds.issueIds.every((id) => id.startsWith('xi-')), 'isolation: xian issue IDs');
assert(myCtx.sourceIds.issueIds.every((id) => id.startsWith('mi-')), 'isolation: my issue IDs');

// 上下文哈希不同
assertNotEqual(xianCtx.contextHash, myCtx.contextHash, 'isolation: different context hashes');

// ============================================================
// 4. 草稿隔离验证
// ============================================================
console.log('\n--- Draft isolation ---');

const xianDraft = createDraft({ projectId: 'xian-yanta-001', title: '西安报告', createdBy: 'test' });
const myDraft = createDraft({ projectId: 'mianyang-001', title: '绵阳报告', createdBy: 'test' });
assertNotEqual(xianDraft.id, myDraft.id, 'draft: different draft IDs');
assertEqual(xianDraft.projectId, 'xian-yanta-001', 'draft: xian draft projectId');
assertEqual(myDraft.projectId, 'mianyang-001', 'draft: my draft projectId');

// ============================================================
// 5. AI 语言检测在两个项目中都有效
// ============================================================
console.log('\n--- AI language detection ---');

const aiText = '作为 AI，我认为西安市雁塔区存在问题。';
const aiResult = validateReportContent({ text: aiText, projectCity: '西安市' });
assert(!aiResult.valid, 'ai-detect: works for Xi\'an');

const aiText2 = '作为 AI，我认为绵阳市存在问题。';
const aiResult2 = validateReportContent({ text: aiText2, projectCity: '绵阳市' });
assert(!aiResult2.valid, 'ai-detect: works for Mianyang');

// ============================================================
// 6. 内部编号检测在两个项目中都有效
// ============================================================
const internalText = '问题PRB-03-01涉及楼道安全。';
const intResult1 = validateReportContent({ text: internalText, projectCity: '西安市' });
assert(!intResult1.valid, 'internal-id: detected in Xi\'an');
const intResult2 = validateReportContent({ text: internalText, projectCity: '绵阳市' });
assert(!intResult2.valid, 'internal-id: detected in Mianyang');

// ============================================================
// 7. 保存测试产出
// ============================================================
console.log('\n--- Saving test artifacts ---');
const outDir = path.join(process.cwd(), 'tests', 'report-studio', 'fixtures');
await fs.writeFile(path.join(outDir, 'xian-report.docx'), xianDocx);
assert(true, 'saved xian-report.docx');

const myDocx = await generateDocx({
  templateBlocks: [
    { id: 'p-0001', type: 'paragraph', style: 'Normal', text: '绵阳封面' },
    { id: 'p-0006', type: 'paragraph', style: 'Heading 1', text: '一、工作概述' }
  ],
  sections: [saveSectionGenerated(
    createSection({ draftId: 'd-my', projectId: 'mianyang-001', sectionKey: 'cover', blockId: 'p-0001' }),
    { paragraphs: [{ id: 'p1', text: '绵阳市科技城新区重点片区体检报告' }] },
    'test-model', [], [], 'hash3'
  )],
  context: myCtx, calculations: myCalc, edition: 'formal'
});
await fs.writeFile(path.join(outDir, 'mianyang-report.docx'), myDocx);
assert(true, 'saved mianyang-report.docx');

// ============================================================
// Helpers
// ============================================================
function assertNotEqual(a, b, m) {
  if (a !== b) { passed++; } else { failed++; console.error('FAIL: ' + m + ' (both are ' + JSON.stringify(a) + ')'); }
}

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
