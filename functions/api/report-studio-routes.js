/** Shared formal-report routes. Storage and model access are injected. */
import { buildReportContext } from './report-context-core.js';
import { runAllCalculations } from './report-calculation-core.js';
import { createDraft, createSection, saveSectionEdit, saveSectionGenerated, reviewSection, transitionSection, SectionStatus } from './report-draft-core.js';
import { buildGenerationPrompt, parseGenerationOutput } from './report-generation-core.js';
import { validateReportContent, validateCrossSectionConsistency } from './report-validation-core.js';
import { generateDocx } from './report-docx-core.js';
import { buildReportFactBundle, selectNarrativeBlocks, buildReportNarrativePrompt, parseNarrativeModelContent, validateReportNarrativeDraft, buildStoredReportDraft, assembleReportDraftDocument, REPORT_TEMPLATE } from './report-narrative-core.js';

const DEFINITIONS = [
  ['cover', '封面'], ['chapter-1', '一、工作概述'], ['chapter-2', '二、构建指标体系与评价方法'], ['chapter-3', '三、总体结论'], ['chapter-4', '四、指标分析评价'], ['chapter-5', '五、城市治理建议'], ['chapter-6', '六、行动建议'], ['appendix-2', '附录2：指标分析评价结果统计表'], ['appendix-3', '附录3：问题清单及台账一览表'], ['appendix-4', '附录4：治理建议清单一览表'], ['appendix-5', '附录5：城市更新项目库']
].map(([key, title]) => ({ key, title, purpose: '正式城市体检报告章节' }));
const contentText = (sections) => sections.map((s) => (s.content?.paragraphs || []).map((p) => p.text || '').join('\n')).join('\n');
const publicDraft = (draft, sections) => ({ ...draft, sections: sections.sort((a, b) => a.sectionKey.localeCompare(b.sectionKey, 'zh-CN')) });

export async function handleReportStudioRoute(deps) {
  const { req, res, url, readJson, writeJson, loadProject, loadPhotos, loadAnalyses, loadIssues, loadDrafts, loadDraft, saveDraft, loadSections, saveSection, loadCalculation, saveCalculation, loadTemplateBlocks, saveArtifact, getArtifact, generateText } = deps;
  if (!url.pathname.startsWith('/api/report-studio')) return false;
  const respond = (status, body) => writeJson(res, status, body);
  const contextOf = async (projectId) => {
    const [project, photos, analyses, issues] = await Promise.all([loadProject(projectId), loadPhotos(projectId), loadAnalyses(projectId), loadIssues(projectId)]);
    if (!project) { const error = new Error('项目不存在'); error.status = 404; throw error; }
    return buildReportContext({ project, photos, analyses, officialIssues: issues });
  };
  try {
    let match = url.pathname.match(/^\/api\/report-studio\/projects\/([^/]+)\/context$/);
    if (req.method === 'GET' && match) return respond(200, { context: await contextOf(match[1]) });
    match = url.pathname.match(/^\/api\/report-studio\/projects\/([^/]+)\/calculations$/);
    if (req.method === 'POST' && match) {
      const body = await readJson(req), context = await contextOf(match[1]);
      const snapshot = { ...runAllCalculations(context), id: `RCS-${context.projectId}-${Date.now()}`, calculatedBy: String(body.calculatedBy || ''), frozenAt: new Date().toISOString() };
      await saveCalculation(snapshot); return respond(201, { snapshot });
    }
    match = url.pathname.match(/^\/api\/report-studio\/projects\/([^/]+)\/drafts$/);
    if (req.method === 'GET' && match) { await contextOf(match[1]); return respond(200, { items: await loadDrafts(match[1]) }); }
    if (req.method === 'POST' && match) {
      const body = await readJson(req), context = await contextOf(match[1]), calculation = await loadCalculation(body.calculationSnapshotId);
      if (!calculation || calculation.projectId !== context.projectId || calculation.contextHash !== context.contextHash) throw new Error('请先基于当前项目数据运行并冻结指标计算');
      const draft = createDraft({ projectId: context.projectId, title: body.title, templateId: body.templateId, contextSnapshotId: context.contextHash, calculationSnapshotId: calculation.id, createdBy: body.createdBy });
      const blocks = await loadTemplateBlocks();
      const sections = blocks.filter((block) => block.type === 'paragraph' && block.requiresReview).map((block) => createSection({ draftId: draft.id, projectId: context.projectId, sectionKey: 'template-paragraph', blockId: block.id, type: 'paragraph', content: { title: block.text || block.id, templateText: block.text || '', paragraphs: [] } }));
      draft.sectionIds = sections.map((s) => s.id); draft.status = 'calculated'; await saveDraft(draft); await Promise.all(sections.map(saveSection));
      return respond(201, { draft: publicDraft(draft, sections) });
    }
    match = url.pathname.match(/^\/api\/report-studio\/drafts\/([^/]+)$/);
    if (req.method === 'GET' && match) { const draft = await loadDraft(match[1]); return draft ? respond(200, { draft: publicDraft(draft, await loadSections(draft.id)) }) : respond(404, { message: '草稿不存在' }); }
    match = url.pathname.match(/^\/api\/report-studio\/drafts\/([^/]+)\/sections\/([^/]+)\/generate$/);
    if (req.method === 'POST' && match) {
      const [draftId, sectionId] = [match[1], match[2]], draft = await loadDraft(draftId), section = await loadSections(draftId).then((items) => items.find((x) => x.id === sectionId));
      if (!draft || !section || section.projectId !== draft.projectId) return respond(404, { message: '草稿或章节不存在' });
      if (section.locked) return respond(409, { message: '已锁定章节不能重新生成' });
      const [context, calculation] = await Promise.all([contextOf(draft.projectId), loadCalculation(draft.calculationSnapshotId)]);
      if (!calculation || calculation.contextHash !== context.contextHash) return respond(409, { message: '项目数据已变化，请创建新快照和草稿' });
      if (typeof generateText !== 'function') return respond(503, { message: '文字模型服务尚未配置' });
      const definition = section.sectionKey === 'template-paragraph'
        ? { key: section.blockId, title: section.content?.title || section.blockId, purpose: `仅重写 Word 母版中的当前段落。母版原文仅用于理解用途，不能保留其中旧项目事实：${String(section.content?.templateText || '').slice(0, 4000)}` }
        : (DEFINITIONS.find((d) => d.key === section.sectionKey) || { key: section.sectionKey, title: section.content?.title || section.sectionKey });
      const prompt = buildGenerationPrompt({ section: definition, context, calculations: calculation, previousSummaries: [] });
      const output = parseGenerationOutput(await generateText(prompt));
      const next = saveSectionGenerated(section, output, 'volcengine-ark', output.usedFactKeys, output.usedCalculationKeys, context.contextHash); await saveSection(next);
      return respond(200, { section: next });
    }
    match = url.pathname.match(/^\/api\/report-studio\/drafts\/([^/]+)\/sections\/([^/]+)$/);
    if (req.method === 'PUT' && match) {
      const body = await readJson(req), section = await loadSections(match[1]).then((items) => items.find((x) => x.id === match[2]));
      if (!section) return respond(404, { message: '章节不存在' }); const text = String(body.content?.text || '').trim(); if (!text) return respond(400, { message: '正文不能为空' });
      const next = saveSectionEdit(section, { ...(section.content || {}), paragraphs: [{ id: 'manual-1', text }] }, String(body.editedBy || '用户'), Number(body.baseVersion)); await saveSection(next); return respond(200, { section: next });
    }
    match = url.pathname.match(/^\/api\/report-studio\/drafts\/([^/]+)\/sections\/([^/]+)\/(review|lock|unlock)$/);
    if (req.method === 'POST' && match) {
      const body = await readJson(req), section = await loadSections(match[1]).then((items) => items.find((x) => x.id === match[2])); if (!section) return respond(404, { message: '章节不存在' });
      const next = match[3] === 'review' ? reviewSection(section, body.reviewedBy) : transitionSection(section, match[3] === 'lock' ? SectionStatus.LOCKED : SectionStatus.APPROVED, body.lockedBy || body.unlockedBy); await saveSection(next); return respond(200, { section: next });
    }
    match = url.pathname.match(/^\/api\/report-studio\/drafts\/([^/]+)\/validate$/);
    if (req.method === 'POST' && match) {
      const draft = await loadDraft(match[1]); if (!draft) return respond(404, { message: '草稿不存在' }); const [sections, context, calculation] = await Promise.all([loadSections(draft.id), contextOf(draft.projectId), loadCalculation(draft.calculationSnapshotId)]);
      const validation = validateReportContent({ text: contentText(sections), projectCity: context.project.administrativeArea || context.project.area, allowedNumbers: calculation?.results?.map((r) => r.formattedValue) || [] });
      const missing = sections.filter((s) => !s.content?.paragraphs?.length).map((s) => s.sectionKey); if (missing.length) validation.issues.push({ type: 'missing-section', severity: 'error', message: '存在未生成章节', details: missing }); if (!sections.some((s) => s.reviewedBy)) validation.issues.push({ type: 'missing-reviewer', severity: 'error', message: '尚未填写审核人员' }); validation.issues.push(...validateCrossSectionConsistency(sections).issues); validation.valid = !validation.issues.some((i) => i.severity === 'error'); draft.validation = validation; await saveDraft(draft); return respond(200, { validation });
    }
    match = url.pathname.match(/^\/api\/report-studio\/drafts\/([^/]+)\/exports\/docx$/);
    if (req.method === 'POST' && match) {
      const body = await readJson(req), draft = await loadDraft(match[1]); if (!draft) return respond(404, { message: '草稿不存在' }); const [sections, context, calculation, blocks] = await Promise.all([loadSections(draft.id), contextOf(draft.projectId), loadCalculation(draft.calculationSnapshotId), loadTemplateBlocks()]);
      const validation = validateReportContent({ text: contentText(sections), projectCity: context.project.administrativeArea || context.project.area, allowedNumbers: calculation?.results?.map((r) => r.formattedValue) || [] });
      if (body.edition === 'formal' && (!validation.valid || sections.some((s) => !s.reviewedBy || !s.content?.paragraphs?.length) || !body.generatedBy)) return respond(409, { message: '正式版尚未满足审核、校验或生成人员要求' });
      const artifact = await saveArtifact({ draft, buffer: await generateDocx({ templateBlocks: blocks, sections, context, calculations: calculation, edition: body.edition }), edition: body.edition, generatedBy: String(body.generatedBy || ''), validation }); return respond(201, { artifact });
    }
    match = url.pathname.match(/^\/api\/report-studio\/artifacts\/([^/]+)\/content$/);
    if (req.method === 'GET' && match) { const artifact = await getArtifact(match[1]); if (!artifact) return respond(404, { message: 'Word 文件不存在' }); res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="${encodeURIComponent(artifact.fileName)}"` }); return res.end(artifact.buffer); }

    // ============ AI 叙述生成接口 ============
    match = url.pathname.match(/^\/api\/report-studio\/reports\/([^/]+)\/narrative\/generate$/);
    if (req.method === 'POST' && match) {
      const reportId = match[1];
      const body = await readJson(req);
      const subsectionIds = Array.isArray(body.subsectionIds) ? body.subsectionIds : [];
      const loadReport = deps.loadReport || (async () => null);
      const saveReport = deps.saveReport || (async () => {});
      const report = await loadReport(reportId);
      if (!report || !report.snapshot) return respond(404, { message: '报告快照不存在' });
      if (typeof generateText !== 'function') return respond(503, { message: '文字模型服务尚未配置' });
      const targetBlocks = selectNarrativeBlocks(REPORT_TEMPLATE, subsectionIds);
      if (!targetBlocks.length) return respond(400, { message: '未找到需要生成的叙述区块' });
      const prompt = buildReportNarrativePrompt({ report, template: REPORT_TEMPLATE, subsectionIds });
      const rawOutput = await generateText(prompt);
      const parsed = parseNarrativeModelContent(rawOutput);
      const validatedDraft = validateReportNarrativeDraft({ draft: parsed, report, template: REPORT_TEMPLATE, subsectionIds });
      const storedDraft = buildStoredReportDraft({ report, validatedDraft, model: body.model || 'qwen', requestId: body.requestId || '', usage: body.usage || null, subsectionIds });
      report.draft = storedDraft;
      report.draftUpdatedAt = new Date().toISOString();
      await saveReport(report);
      return respond(200, { draft: storedDraft, generatedBlocks: validatedDraft.sections.length });
    }
    match = url.pathname.match(/^\/api\/report-studio\/reports\/([^/]+)\/narrative\/document$/);
    if (req.method === 'GET' && match) {
      const reportId = match[1];
      const loadReport = deps.loadReport || (async () => null);
      const report = await loadReport(reportId);
      if (!report || !report.snapshot) return respond(404, { message: '报告快照不存在' });
      const document = assembleReportDraftDocument({ report, template: REPORT_TEMPLATE });
      return respond(200, { document });
    }

    return respond(404, { message: '报告工作台接口不存在' });
  } catch (error) { return respond(error.status || 400, { message: error.message || '报告工作台请求失败' }); }
}
