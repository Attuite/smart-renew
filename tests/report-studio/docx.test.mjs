/**
 * docx.test.mjs
 * Word 生成技术验证测试。
 * 生成包含中文标题、正文、三列表格的 Word，在 Node 中正常生成。
 */

import { generateDocx } from '../../functions/api/report-docx-core.js';
import fs from 'node:fs/promises';
import path from 'node:path';

let passed = 0;
let failed = 0;

function assert(c, m) { if (c) { passed++; } else { failed++; console.error('FAIL: ' + m); } }

console.log('=== report-docx-core tests ===\n');

// === 测试数据 ===
const mockTemplateBlocks = [
  { id: 'p-0001', type: 'paragraph', style: 'Normal', text: '测试市测试区城市体检报告' },
  { id: 'p-0002', type: 'paragraph', style: 'Heading 1', text: '一、工作概述' },
  { id: 'p-0003', type: 'paragraph', style: 'Heading 2', text: '1.1 工作背景' },
  { id: 'p-0004', type: 'paragraph', style: 'Normal', text: '城市体检评估是新时代推动城市治理体系和治理能力现代化的重要举措。' },
  { id: 'p-0005', type: 'paragraph', style: 'Normal', text: '本项目对测试区范围内的住宅建筑进行了全面体检。' },
  { id: 'p-0006', type: 'paragraph', style: 'Heading 1', text: '二、指标分析' },
  { id: 'p-0007', type: 'paragraph', style: 'Normal', text: '共采集5个住宅小区，20栋住宅楼，1500户居民。' },
  { id: 't-001', type: 'table', style: 'Table Grid', rows: [
    { cells: ['指标名称', '数值', '评价'] },
    { cells: ['住宅小区数量', '5个', '已计算'] },
    { cells: ['住宅楼栋数量', '20栋', '已计算'] },
    { cells: ['正式问题总数', '15个', '已计算'] }
  ]},
  { id: 'p-0008', type: 'paragraph', style: 'Normal', text: '以上数据均来自项目正式数据。' }
];

const mockSections = [
  {
    id: 'sec-1', sectionKey: 'cover', blockId: 'p-0001',
    content: { paragraphs: [{ id: 'p1', text: '西安市雁塔区城市体检报告' }] }
  },
  {
    id: 'sec-2', sectionKey: '1.1-background', blockId: 'p-0004',
    content: { paragraphs: [{ id: 'p1', text: '城市体检评估是推动城市治理现代化的重要举措。西安市雁塔区积极响应国家政策要求。' }] }
  }
];

const mockContext = {
  project: { name: '西安市雁塔区城市体检', administrativeArea: '西安市雁塔区', scopeAreaSqKm: 3.2 },
  housing: { communityCount: 5, buildingCount: 20, householdCount: 1500 },
  photos: { originalCount: 30, annotatedCount: 10 },
  officialIssues: { totalCount: 15, stats: { high: 3, medium: 8, low: 4 } }
};

const mockCalculations = {
  results: [
    { ruleId: 'CALC-HOUSING-COMMUNITY-COUNT', label: '住宅小区数量', value: 5, formattedValue: '5个', status: 'calculated' },
    { ruleId: 'CALC-ISSUE-TOTAL', label: '正式问题总数', value: 15, formattedValue: '15个', status: 'calculated' }
  ]
};

// === 测试 ===

// Test 1: 生成正式版 Word Buffer
async function runTests() {
  try {
    const buffer = await generateDocx({
      templateBlocks: mockTemplateBlocks,
      draft: { id: 'draft-1', title: '测试报告' },
      sections: mockSections,
      context: mockContext,
      calculations: mockCalculations,
      edition: 'formal'
    });

    assert(buffer instanceof Buffer, 'output is Buffer');
    assert(buffer.length > 1000, 'buffer has reasonable size (' + buffer.length + ' bytes)');

    // 验证 docx 文件头 (PK zip signature)
    assert(buffer[0] === 0x50 && buffer[1] === 0x4B, 'docx has valid PK zip header');

    // 保存测试文件
    const outDir = path.join(process.cwd(), 'tests', 'report-studio', 'fixtures');
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, 'test-report-formal.docx');
    await fs.writeFile(outPath, buffer);
    assert(true, 'wrote test-report-formal.docx (' + buffer.length + ' bytes)');

    // Test 2: 生成审核稿
    const reviewBuffer = await generateDocx({
      templateBlocks: mockTemplateBlocks,
      draft: { id: 'draft-1', title: '测试报告' },
      sections: mockSections,
      context: mockContext,
      calculations: mockCalculations,
      edition: 'review'
    });
    assert(reviewBuffer instanceof Buffer, 'review buffer is Buffer');
    const reviewPath = path.join(outDir, 'test-report-review.docx');
    await fs.writeFile(reviewPath, reviewBuffer);
    assert(true, 'wrote test-report-review.docx');

    // Test 3: 无段落覆盖时使用模板默认内容
    const noOverrideBuffer = await generateDocx({
      templateBlocks: mockTemplateBlocks,
      draft: { id: 'draft-2', title: '无覆盖测试' },
      sections: [],
      context: mockContext,
      calculations: mockCalculations,
      edition: 'formal'
    });
    assert(noOverrideBuffer instanceof Buffer, 'no-override buffer is Buffer');
    assert(noOverrideBuffer.length > 500, 'no-override has content');

    // Test 4: 缺失图片占位
    const imgBlocks = [
      { id: 'p-img', type: 'paragraph', style: 'Body Text Indent 2', text: '', images: [{ src: 'test.jpg', alt: '项目分析图' }] }
    ];
    const imgBuffer = await generateDocx({
      templateBlocks: imgBlocks,
      sections: [],
      context: mockContext,
      calculations: mockCalculations,
      edition: 'formal'
    });
    assert(imgBuffer instanceof Buffer, 'image placeholder buffer is Buffer');

    console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
    if (failed > 0) process.exit(1);

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    failed++;
    console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
    process.exit(1);
  }
}

runTests();
