/**
 * report-draft-core.js
 * 报告草稿、段落版本和审核状态管理。纯函数模块。
 * 草稿和段落状态机、乐观锁、版本历史。
 *
 * 草稿状态机：
 *   created → data-ready → calculated → generating → reviewing → exportable → exported
 *                                                             ↘ failed
 *
 * 段落状态机：
 *   not-generated → generating → generated → edited → approved → locked
 *                       ↘ error             ↘ regenerated
 */

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function now() {
  return new Date().toISOString();
}

/**
 * 草稿状态枚举
 */
export const DraftStatus = Object.freeze({
  CREATED: 'created',
  DATA_READY: 'data-ready',
  CALCULATED: 'calculated',
  GENERATING: 'generating',
  REVIEWING: 'reviewing',
  EXPORTABLE: 'exportable',
  EXPORTED: 'exported',
  FAILED: 'failed'
});

/**
 * 段落状态枚举
 */
export const SectionStatus = Object.freeze({
  NOT_GENERATED: 'not-generated',
  GENERATING: 'generating',
  GENERATED: 'generated',
  EDITED: 'edited',
  APPROVED: 'approved',
  LOCKED: 'locked',
  ERROR: 'error'
});

/**
 * 合法的状态转移
 */
const DRAFT_TRANSITIONS = {
  [DraftStatus.CREATED]: [DraftStatus.DATA_READY, DraftStatus.FAILED],
  [DraftStatus.DATA_READY]: [DraftStatus.CALCULATED, DraftStatus.FAILED],
  [DraftStatus.CALCULATED]: [DraftStatus.GENERATING, DraftStatus.FAILED],
  [DraftStatus.GENERATING]: [DraftStatus.REVIEWING, DraftStatus.FAILED],
  [DraftStatus.REVIEWING]: [DraftStatus.EXPORTABLE, DraftStatus.GENERATING],
  [DraftStatus.EXPORTABLE]: [DraftStatus.EXPORTED, DraftStatus.REVIEWING],
  [DraftStatus.EXPORTED]: [DraftStatus.REVIEWING],
  [DraftStatus.FAILED]: [DraftStatus.CREATED]
};

const SECTION_TRANSITIONS = {
  [SectionStatus.NOT_GENERATED]: [SectionStatus.GENERATING, SectionStatus.ERROR],
  [SectionStatus.GENERATING]: [SectionStatus.GENERATED, SectionStatus.ERROR],
  [SectionStatus.GENERATED]: [SectionStatus.EDITED, SectionStatus.GENERATING, SectionStatus.APPROVED],
  [SectionStatus.EDITED]: [SectionStatus.APPROVED, SectionStatus.GENERATING],
  [SectionStatus.APPROVED]: [SectionStatus.LOCKED, SectionStatus.EDITED, SectionStatus.GENERATING],
  [SectionStatus.LOCKED]: [SectionStatus.APPROVED],
  [SectionStatus.ERROR]: [SectionStatus.GENERATING]
};

/**
 * 校验草稿状态转移是否合法
 */
export function canTransitionDraft(from, to) {
  const allowed = DRAFT_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * 校验段落状态转移是否合法
 */
export function canTransitionSection(from, to) {
  const allowed = SECTION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * 创建新草稿
 */
export function createDraft({ projectId, title, templateId, contextSnapshotId, calculationSnapshotId, createdBy }) {
  if (!projectId) throw new Error('项目编号无效');
  const id = `RPD-${projectId}-${Date.now()}`;
  return {
    id,
    projectId: String(projectId),
    title: clean(title, 200) || '城市体检报告',
    templateId: clean(templateId, 120) || 'TPL-WORD-V1',
    templateVersion: 1,
    contextSnapshotId: clean(contextSnapshotId, 120),
    calculationSnapshotId: clean(calculationSnapshotId, 120),
    status: DraftStatus.CREATED,
    createdBy: clean(createdBy, 120),
    createdAt: now(),
    updatedAt: now(),
    sectionIds: [],
    validation: {},
    schemaVersion: '1.0.0'
  };
}

/**
 * 创建段落
 */
export function createSection({ draftId, projectId, sectionKey, blockId, type, content }) {
  if (!draftId || !sectionKey) throw new Error('缺少草稿ID或段落key');
  const id = `RPS-${draftId}-${sectionKey}-${blockId || Date.now()}`;
  return {
    id,
    projectId: String(projectId || ''),
    draftId: String(draftId),
    sectionKey: clean(sectionKey, 120),
    blockId: clean(blockId, 120),
    type: clean(type, 40) || 'paragraph',
    content: content || {},
    status: SectionStatus.NOT_GENERATED,
    locked: false,
    version: 1,
    generatedByModel: '',
    generatedAt: '',
    editedBy: '',
    editedAt: '',
    reviewedBy: '',
    reviewedAt: '',
    lockedBy: '',
    lockedAt: '',
    usedFactKeys: [],
    usedCalculationKeys: [],
    contextHash: '',
    history: [],
    createdAt: now(),
    updatedAt: now()
  };
}

/**
 * 更新草稿状态
 */
export function transitionDraft(draft, newStatus, actor) {
  if (!draft) throw new Error('草稿不存在');
  if (!canTransitionDraft(draft.status, newStatus)) {
    throw new Error(`草稿状态不允许从 ${draft.status} 转移到 ${newStatus}`);
  }
  return {
    ...draft,
    status: newStatus,
    updatedAt: now()
  };
}

/**
 * 更新段落状态
 */
export function transitionSection(section, newStatus, actor) {
  if (!section) throw new Error('段落不存在');
  if (!canTransitionSection(section.status, newStatus)) {
    throw new Error(`段落状态不允许从 ${section.status} 转移到 ${newStatus}`);
  }
  const updates = {
    ...section,
    status: newStatus,
    updatedAt: now()
  };
  if (newStatus === SectionStatus.LOCKED) {
    updates.locked = true;
    updates.lockedBy = clean(actor, 120);
    updates.lockedAt = now();
  } else if (newStatus === SectionStatus.APPROVED && section.locked) {
    updates.locked = false;
    updates.lockedBy = '';
    updates.lockedAt = '';
  }
  return updates;
}

/**
 * 保存编辑内容（乐观锁校验）
 */
export function saveSectionEdit(section, content, editedBy, baseVersion) {
  if (!section) throw new Error('段落不存在');
  if (section.locked) throw new Error('已锁定段落不能编辑');
  if (typeof baseVersion === 'number' && section.version !== baseVersion) {
    throw new Error(`版本冲突：期望 v${baseVersion}，当前 v${section.version}`);
  }
  const history = (section.history || []).slice(-9);
  history.push({
    version: section.version,
    content: section.content,
    status: section.status,
    editedBy: section.editedBy,
    editedAt: section.editedAt,
    snapshotAt: now()
  });
  return {
    ...section,
    content,
    status: SectionStatus.EDITED,
    editedBy: clean(editedBy, 120),
    editedAt: now(),
    version: section.version + 1,
    history,
    updatedAt: now()
  };
}

/**
 * 保存生成结果
 */
export function saveSectionGenerated(section, content, model, usedFactKeys, usedCalculationKeys, contextHash) {
  if (!section) throw new Error('段落不存在');
  if (section.locked) throw new Error('已锁定段落不能重新生成');
  const history = (section.history || []).slice(-9);
  history.push({
    version: section.version,
    content: section.content,
    status: section.status,
    editedBy: section.editedBy,
    editedAt: section.editedAt,
    snapshotAt: now()
  });
  return {
    ...section,
    content,
    status: SectionStatus.GENERATED,
    generatedByModel: clean(model, 200),
    generatedAt: now(),
    usedFactKeys: Array.isArray(usedFactKeys) ? usedFactKeys : [],
    usedCalculationKeys: Array.isArray(usedCalculationKeys) ? usedCalculationKeys : [],
    contextHash: clean(contextHash, 200),
    version: section.version + 1,
    history,
    updatedAt: now()
  };
}

/**
 * 审核段落
 */
export function reviewSection(section, reviewedBy) {
  if (!section) throw new Error('段落不存在');
  if (section.status !== SectionStatus.GENERATED && section.status !== SectionStatus.EDITED) {
    throw new Error('只有已生成或已编辑的段落可以审核');
  }
  return {
    ...section,
    status: SectionStatus.APPROVED,
    reviewedBy: clean(reviewedBy, 120),
    reviewedAt: now(),
    updatedAt: now()
  };
}
