/**
 * draft-state.test.mjs
 * 测试草稿和段落状态机
 */

import {
  DraftStatus, SectionStatus,
  canTransitionDraft, canTransitionSection,
  createDraft, createSection,
  transitionDraft, transitionSection,
  saveSectionEdit, saveSectionGenerated, reviewSection
} from '../../functions/api/report-draft-core.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) { if (cond) { passed++; } else { failed++; console.error('FAIL: ' + msg); } }
function assertEqual(a, b, msg) { if (a === b) { passed++; } else { failed++; console.error('FAIL: ' + msg + ' (' + JSON.stringify(a) + ' vs ' + JSON.stringify(b) + ')'); } }
function assertThrows(fn, msg) {
  try { fn(); failed++; console.error('FAIL: expected throw - ' + msg); } catch { passed++; }
}

console.log('=== report-draft-core tests ===\n');

// --- 草稿创建 ---
const draft = createDraft({ projectId: 'p1', title: '测试报告', createdBy: 'test-user' });
assert(draft.id.startsWith('RPD-p1-'), 'draft id prefix');
assertEqual(draft.status, DraftStatus.CREATED, 'initial status');
assertEqual(draft.templateId, 'TPL-WORD-V1', 'default template');
assertEqual(draft.createdBy, 'test-user', 'createdBy');

// --- 段落创建 ---
const section = createSection({ draftId: draft.id, projectId: 'p1', sectionKey: '1.1-background', blockId: 'p-0008' });
assert(section.id.startsWith('RPS-'), 'section id prefix');
assertEqual(section.status, SectionStatus.NOT_GENERATED, 'section initial status');
assertEqual(section.locked, false, 'not locked');
assertEqual(section.version, 1, 'initial version');

// --- 草稿状态转移 ---
assert(canTransitionDraft(DraftStatus.CREATED, DraftStatus.DATA_READY), 'created → data-ready');
assert(canTransitionDraft(DraftStatus.DATA_READY, DraftStatus.CALCULATED), 'data-ready → calculated');
assert(canTransitionDraft(DraftStatus.CALCULATED, DraftStatus.GENERATING), 'calculated → generating');
assert(canTransitionDraft(DraftStatus.GENERATING, DraftStatus.REVIEWING), 'generating → reviewing');
assert(canTransitionDraft(DraftStatus.REVIEWING, DraftStatus.EXPORTABLE), 'reviewing → exportable');
assert(!canTransitionDraft(DraftStatus.CREATED, DraftStatus.EXPORTABLE), 'created → exportable invalid');
assert(!canTransitionDraft(DraftStatus.LOCKED, DraftStatus.CREATED), 'non-existent transition');

const d2 = transitionDraft(draft, DraftStatus.DATA_READY, 'user');
assertEqual(d2.status, DraftStatus.DATA_READY, 'transitioned status');
assert(d2.updatedAt, 'updatedAt exists');

assertThrows(() => transitionDraft(draft, DraftStatus.EXPORTABLE), 'invalid transition throws');

// --- 段落状态转移 ---
assert(canTransitionSection(SectionStatus.NOT_GENERATED, SectionStatus.GENERATING), 'not-generated → generating');
assert(canTransitionSection(SectionStatus.GENERATING, SectionStatus.GENERATED), 'generating → generated');
assert(canTransitionSection(SectionStatus.GENERATED, SectionStatus.EDITED), 'generated → edited');
assert(canTransitionSection(SectionStatus.GENERATED, SectionStatus.APPROVED), 'generated → approved');
assert(canTransitionSection(SectionStatus.EDITED, SectionStatus.APPROVED), 'edited → approved');
assert(!canTransitionSection(SectionStatus.LOCKED, SectionStatus.GENERATED), 'locked → generated invalid');

// --- 生成保存 ---
const s1 = saveSectionGenerated(section, { text: '生成的正文' }, 'qwen-vl', ['fact1'], ['calc1'], 'hash123');
assertEqual(s1.status, SectionStatus.GENERATED, 'after generate');
assertEqual(s1.version, 2, 'version incremented');
assertEqual(s1.generatedByModel, 'qwen-vl', 'model recorded');
assertEqual(s1.usedFactKeys.length, 1, 'fact keys saved');
assert(s1.history.length === 1, 'history saved');

// --- 编辑保存 ---
const s2 = saveSectionEdit(s1, { text: '人工编辑的正文' }, 'editor', 2);
assertEqual(s2.status, SectionStatus.EDITED, 'after edit');
assertEqual(s2.version, 3, 'version incremented again');
assertEqual(s2.editedBy, 'editor', 'editor recorded');
assert(s2.history.length === 2, 'history preserved');

// --- 乐观锁冲突 ---
assertThrows(() => saveSectionEdit(s2, { text: '冲突' }, 'editor', 1), 'version conflict throws');

// --- 已锁定不能编辑 ---
const locked = { ...s2, locked: true, status: SectionStatus.LOCKED };
assertThrows(() => saveSectionEdit(locked, { text: 'x' }, 'user'), 'locked section edit throws');

// --- 已锁定不能重新生成 ---
assertThrows(() => saveSectionGenerated(locked, { text: 'x' }, 'model'), 'locked section regenerate throws');

// --- 审核 ---
const s3 = reviewSection(s2, 'reviewer');
assertEqual(s3.status, SectionStatus.APPROVED, 'after review');
assertEqual(s3.reviewedBy, 'reviewer', 'reviewer recorded');

// --- 锁定 ---
const s4 = transitionSection(s3, SectionStatus.LOCKED, 'locker');
assertEqual(s4.status, SectionStatus.LOCKED, 'locked');
assertEqual(s4.locked, true, 'locked flag');
assertEqual(s4.lockedBy, 'locker', 'locked by');

// --- 解锁 ---
const s5 = transitionSection(s4, SectionStatus.APPROVED, 'unlocker');
assertEqual(s5.locked, false, 'unlocked');
assertEqual(s5.lockedBy, '', 'cleared lockedBy');

// --- 批量生成跳过锁定 ---
const sections = [
  { ...s5, sectionKey: 'a', locked: false, status: SectionStatus.GENERATED },
  { ...s5, sectionKey: 'b', locked: true, status: SectionStatus.LOCKED },
  { ...s5, sectionKey: 'c', locked: false, status: SectionStatus.NOT_GENERATED }
];
const toGenerate = sections.filter((s) => !s.locked && s.status !== SectionStatus.LOCKED);
assertEqual(toGenerate.length, 2, 'skip locked in batch');

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) process.exit(1);
