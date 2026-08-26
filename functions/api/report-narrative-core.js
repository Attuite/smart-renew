import fs from 'node:fs';

const fixedSubsection = (id, number, title, content = '当前版本暂无对应结构化数据，本小节不作推断。') => ({
  id, number, title, treatment: 'unavailable',
  blocks: [{ id: `${id}-note`, type: 'fixed', title: '数据说明', content }]
});
const aiSubsection = (id, number, title, blockId, blockTitle, evidencePaths, min, max) => ({
  id, number, title, treatment: 'ai-narrative',
  blocks: [{ id: blockId, type: 'ai-narrative', title: blockTitle, objective: blockTitle, evidencePaths, length: { min, max } }]
});

const FALLBACK_TEMPLATE = {
  templateId: 'smart-renew-project-diagnostic-report',
  version: '2.2.0',
  name: '智更项目级城市体检报告模板',
  scope: 'project',
  generationPolicy: {
    generationUnit: 'subsection', factsSource: 'reportSnapshot', requireEvidenceRefs: true, missingDataText: '暂无数据',
    blockTypePolicy: {
      fixed: { sourceMode: 'template-fixed', action: 'none' },
      'variable-table': { sourceMode: 'snapshot-data', action: 'auto-fill' },
      'ai-narrative': { sourceMode: 'ai-generated', action: 'regenerate' }
    }
  },
  sections: [
    { id: 'work-overview', order: 1, title: '一、工作概述', subsections: [
      fixedSubsection('work-background', '1.1', '工作背景', '本报告依据项目正式数据开展城市更新项目体检。'),
      { ...aiSubsection('project-overview', '1.2', '项目发展与现状概况', 'project-overview-narrative', '项目现状概述', ['project', 'housing', 'photos', 'analyses', 'communityAnalysis'], 220, 520), blocks: [{ id: 'project-overview-table', type: 'variable-table', title: '项目基本信息', dataPath: 'project' }, ...aiSubsection('project-overview', '1.2', '', 'project-overview-narrative', '项目现状概述', ['project', 'housing', 'photos', 'analyses', 'communityAnalysis'], 220, 520).blocks] },
      { id: 'inspection-scope', number: '1.3', title: '体检范围', blocks: [{ id: 'inspection-scope-table', type: 'variable-table', title: '体检范围与住房台账', dataPath: 'scopeSummary' }] },
      fixedSubsection('work-method', '1.4', '工作思路', '项目采用建档、采集、AI识别、人工复核、正式入库、指标汇总和报告生成的闭环方式。'),
      { ...aiSubsection('issue-action-overview', '1.5', '问题清单和整治建议清单', 'issue-action-overview-narrative', '问题与整治任务概述', ['issues.summary', 'issues.topIndicators', 'issues.topLocations', 'issues.items'], 220, 520), blocks: [...aiSubsection('issue-action-overview', '1.5', '', 'issue-action-overview-narrative', '问题与整治任务概述', ['issues.summary', 'issues.topIndicators', 'issues.topLocations', 'issues.items'], 220, 520).blocks, { id: 'issue-action-overview-table', type: 'variable-table', title: '问题清单', dataPath: 'issues.items' }] },
      fixedSubsection('platform-database', '1.6', '信息平台与数据库建设'), fixedSubsection('public-participation', '1.7', '公众参与和宣传推广'), fixedSubsection('institution-building', '1.8', '制度建设')
    ] },
    { id: 'resident-survey', order: 2, title: '二、居民社会问卷调查', subsections: [fixedSubsection('survey-overall', '2.1', '总体调查情况'), fixedSubsection('survey-city', '2.2', '城区维度'), fixedSubsection('survey-block', '2.3', '街区维度'), fixedSubsection('survey-community', '2.4', '社区维度'), fixedSubsection('survey-housing', '2.5', '住房维度')] },
    { id: 'indicator-system', order: 3, title: '三、指标体系构建', subsections: [fixedSubsection('base-indicators', '3.1', '基础指标'), fixedSubsection('special-indicators', '3.2', '特色指标'), { id: 'project-indicator-system', number: '3.3', title: '项目体检指标体系', blocks: [{ id: 'project-indicator-table', type: 'variable-table', title: '指标问题统计', dataPath: 'issues.indicatorCounts' }] }] },
    { id: 'indicator-analysis', order: 4, title: '四、指标分析与评价', subsections: [
      fixedSubsection('city-indicator-analysis', '4.1', '城区（城市）维度'),
      aiSubsection('block-indicator-analysis', '4.2', '街区维度', 'block-indicator-narrative', '街区设施与空间分析', ['communityAnalysis'], 220, 560),
      { ...aiSubsection('community-indicator-analysis', '4.3', '小区（社区）维度', 'community-indicator-narrative', '小区与社区问题分析', ['metrics.community', 'housing', 'issues.topLocations'], 260, 620), blocks: [{ id: 'community-metric-table', type: 'variable-table', title: '社区设施现状指标', dataPath: 'metrics.community.items' }, ...aiSubsection('community-indicator-analysis', '4.3', '', 'community-indicator-narrative', '小区与社区问题分析', ['metrics.community', 'housing', 'issues.topLocations'], 260, 620).blocks] },
      { ...aiSubsection('housing-indicator-analysis', '4.4', '住房维度', 'housing-indicator-narrative', '住房安全指标分析', ['metrics.housing', 'housing', 'photos', 'issues.summary', 'issues.items'], 300, 720), blocks: [{ id: 'housing-ledger-table', type: 'variable-table', title: '住房台账概况', dataPath: 'housing' }, { id: 'housing-metric-table', type: 'variable-table', title: '住房维度指标计算结果', dataPath: 'metrics.housing.items' }, ...aiSubsection('housing-indicator-analysis', '4.4', '', 'housing-indicator-narrative', '住房安全指标分析', ['metrics.housing', 'housing', 'photos', 'issues.summary', 'issues.items'], 300, 720).blocks] }
    ] },
    { id: 'comprehensive-judgement', order: 5, title: '五、综合研判', subsections: [fixedSubsection('city-judgement', '5.1', '城区维度'), aiSubsection('block-judgement', '5.2', '街区维度', 'block-judgement-narrative', '街区维度综合研判', ['communityAnalysis'], 200, 500), aiSubsection('community-judgement', '5.3', '社区维度', 'community-judgement-narrative', '社区维度综合研判', ['metrics.community', 'housing', 'issues.topLocations'], 220, 520), aiSubsection('housing-judgement', '5.4', '住房维度', 'housing-judgement-narrative', '住房维度综合研判', ['metrics.housing', 'housing', 'issues.summary', 'issues.items'], 260, 620)] },
    { id: 'previous-remediation', order: 6, title: '六、上一年度问题整治情况', subsections: [fixedSubsection('previous-remediation-overall', '6.1', '总体情况'), fixedSubsection('remediation-effectiveness', '6.2', '成效评估')] },
    { id: 'remediation-actions', order: 7, title: '七、整治对策与行动建议', subsections: [aiSubsection('remediation-strategy', '7.1', '整治对策', 'remediation-strategy-narrative', '分类整治对策', ['issues.summary', 'issues.topIndicators', 'issues.items', 'communityAnalysis'], 300, 720), aiSubsection('action-recommendations', '7.2', '行动建议', 'action-recommendations-narrative', '近期、中期和长期行动建议', ['issues.items', 'issues.topIndicators', 'communityAnalysis'], 320, 760)] },
    { id: 'appendix-indicators', order: 8, title: '附件1：指标汇总表', subsections: [fixedSubsection('appendix-city-indicators', '附1.1', '城区维度指标汇总表'), fixedSubsection('appendix-block-indicators', '附1.2', '街区维度指标汇总表'), { id: 'appendix-community-indicators', number: '附1.3', title: '社区维度指标汇总表', treatment: 'data-driven', blocks: [{ id: 'appendix-community-indicators-table', type: 'variable-table', title: '社区设施现状指标汇总', dataPath: 'metrics.community.items' }] }, { id: 'appendix-housing-indicators', number: '附1.4', title: '住房维度指标汇总表', treatment: 'data-driven', blocks: [{ id: 'appendix-housing-indicators-table', type: 'variable-table', title: '住房指标计算结果汇总', dataPath: 'metrics.housing.items' }] }] },
    { id: 'appendix-issues', order: 9, title: '附件2：问题清单及整治清单', subsections: [{ id: 'appendix-housing-issues', number: '附2.1', title: '住房维度问题及整治清单', blocks: [{ id: 'appendix-housing-issues-table', type: 'variable-table', title: '正式问题与整治建议', dataPath: 'issues.items' }] }, fixedSubsection('appendix-community-issues', '附2.2', '社区维度问题及整治清单'), fixedSubsection('appendix-block-issues', '附2.3', '街区维度问题及整治清单'), fixedSubsection('appendix-city-issues', '附2.4', '城区维度问题及整治清单')] },
    { id: 'appendix-project-library', order: 10, title: '附件3：城市更新重点项目库建议清单', subsections: [fixedSubsection('project-library-note', '附3.1', '项目库建议说明')] },
    { id: 'appendix-sources', order: 11, title: '附录：报告来源数据索引', subsections: [{ id: 'source-data-index', number: '附录', title: '来源数据编号', blocks: [{ id: 'source-data-index-table', type: 'variable-table', title: '项目、照片、分析和问题来源编号', dataPath: 'sourceIds' }] }] }
  ]
};

function loadAssetTemplate() {
  try {
    const url = new URL('../../assets/reports/report-template.json', import.meta.url);
    return JSON.parse(fs.readFileSync(url, 'utf8'));
  } catch {
    // CloudBase deploys only functions/api. Keep an equivalent built-in narrative
    // definition so the API remains usable when the web asset is not packaged.
    return FALLBACK_TEMPLATE;
  }
}

export const REPORT_TEMPLATE = loadAssetTemplate();

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function percent(value, total) {
  if (!total) return '0%';
  const result = Math.round((number(value) / number(total)) * 1000) / 10;
  return `${result}%`;
}

function countBy(items, keySelector, emptyLabel = '未分类') {
  const counts = {};
  for (const item of items) {
    const key = text(keySelector(item), 160) || emptyLabel;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'zh-CN'));
}

function compactIssue(issue) {
  return {
    id: text(issue?.id, 160),
    problemCode: text(issue?.problemCode, 120),
    indicatorCode: text(issue?.indicatorCode, 120),
    communityId: text(issue?.communityId, 160),
    buildingId: text(issue?.buildingId, 160),
    title: text(issue?.title || issue?.problemName || issue?.type, 240),
    severity: ['high', 'medium', 'low'].includes(issue?.severity) ? issue.severity : 'medium',
    location: text(issue?.location || issue?.position, 240) || '待定位',
    suggestion: text(issue?.suggestion, 600) || '待评估'
  };
}

export function buildReportFactBundle(report) {
  if (!report?.id || !report?.snapshot) throw new Error('报告快照结构无效');
  const snapshot = report.snapshot;
  const rawIssues = list(snapshot.issues?.items);
  const issues = rawIssues.map(compactIssue);
  const total = number(snapshot.issues?.total ?? issues.length);
  const high = number(snapshot.issues?.high);
  const medium = number(snapshot.issues?.medium);
  const low = number(snapshot.issues?.low);
  const indicatorCounts = snapshot.issues?.indicatorCounts && typeof snapshot.issues.indicatorCounts === 'object'
    ? snapshot.issues.indicatorCounts
    : {};
  const topIndicators = Object.entries(indicatorCounts)
    .map(([key, count]) => ({ indicatorCode: text(key, 120) || '未分类', count: number(count) }))
    .sort((a, b) => b.count - a.count || a.indicatorCode.localeCompare(b.indicatorCode, 'zh-CN'))
    .slice(0, 12);
  const topLocations = countBy(issues, (issue) => issue.location).slice(0, 12)
    .map((item) => ({ location: item.key, count: item.count }));

  return {
    report: {
      id: text(report.id, 160),
      version: number(report.version),
      title: text(report.title, 240),
      generatedAt: text(report.generatedAt, 80),
      dataCutoffAt: text(report.dataCutoffAt, 80),
      generatedBy: text(report.generatedBy, 120)
    },
    project: {
      id: text(snapshot.project?.id, 160),
      name: text(snapshot.project?.name, 240) || '未命名项目',
      area: text(snapshot.project?.area, 240) || '未填写',
      type: text(snapshot.project?.type, 120) || '未填写',
      scope: text(snapshot.project?.scope, 600) || '未填写',
      description: text(snapshot.project?.description, 1000),
      scopeAreaSqKm: number(snapshot.project?.scopeAreaSqKm)
    },
    housing: {
      communityCount: number(snapshot.housing?.communityCount),
      buildingCount: number(snapshot.housing?.buildingCount),
      householdCount: number(snapshot.housing?.householdCount)
    },
    scopeSummary: {
      projectArea: text(snapshot.project?.area, 240) || '未填写',
      projectScope: text(snapshot.project?.scope, 600) || '未填写',
      scopeAreaSqKm: number(snapshot.project?.scopeAreaSqKm),
      communityCount: number(snapshot.housing?.communityCount),
      buildingCount: number(snapshot.housing?.buildingCount),
      householdCount: number(snapshot.housing?.householdCount)
    },
    photos: {
      total: number(snapshot.photos?.total),
      archived: number(snapshot.photos?.archived)
    },
    analyses: {
      archived: number(snapshot.analyses?.total)
    },
    issues: {
      summary: {
        total,
        high,
        medium,
        low,
        highRate: percent(high, total),
        mediumRate: percent(medium, total),
        lowRate: percent(low, total)
      },
      indicatorCounts,
      topIndicators,
      topLocations,
      items: issues
    },
    communityAnalysis: snapshot.communityAnalysis || null,
    metrics: snapshot.metricResults || { housing: null, community: null },
    sourceIds: report.sourceIds || {}
  };
}

function narrativeBlocks(template = REPORT_TEMPLATE) {
  return list(template.sections).flatMap((section) => list(section.subsections).flatMap((subsection) => list(subsection.blocks)
    .filter((block) => block.type === 'ai-narrative')
    .map((block) => ({
      sectionId: section.id,
      sectionTitle: section.title,
      subsectionId: subsection.id,
      subsectionNumber: subsection.number,
      subsectionTitle: subsection.title,
      blockId: block.id,
      blockTitle: block.title,
      objective: block.objective,
      evidencePaths: list(block.evidencePaths),
      length: block.length || { min: 120, max: 600 }
    }))));
}

export function selectNarrativeBlocks(template = REPORT_TEMPLATE, subsectionIds = []) {
  const all = narrativeBlocks(template);
  const selected = list(subsectionIds).map((item) => text(item, 120)).filter(Boolean);
  if (!selected.length) return all;
  const allowedSubsections = new Set(all.map((item) => item.subsectionId));
  const unknown = selected.filter((id) => !allowedSubsections.has(id));
  if (unknown.length) throw new Error(`未知报告二级小节：${unknown.join('、')}`);
  return all.filter((item) => selected.includes(item.subsectionId));
}

export function buildReportNarrativePrompt({ report, template = REPORT_TEMPLATE, subsectionIds = [] }) {
  const facts = buildReportFactBundle(report);
  const blocks = selectNarrativeBlocks(template, subsectionIds);
  return {
    facts,
    blocks,
    system: [
      '你是城市更新项目体检报告的专业撰稿人。',
      '你只能依据用户提供的“报告事实包”写作，不得使用示例城市的事实，不得虚构、推算或补齐缺失数据。',
      '所有数字必须逐字来自事实包，禁止自行计算。事实不足时明确写“暂无数据”。',
      '指标状态为partial时必须说明限定口径；unavailable或invalid指标不得写成0、达标、优良或无问题。',
      'resultType为proxyObservation的社区数据只代表地图检索到的设施空间，不得写成配建达标、覆盖率、缺口或服务盲区。',
      '只输出合法 JSON，不要输出 Markdown、解释或代码围栏。'
    ].join(''),
    user: JSON.stringify({
      task: '按范例报告二级小节生成项目级体检报告草稿',
      requirements: [
        '严格按区块清单逐项输出，不得新增、遗漏或更改 sectionId、subsectionId 和 blockId',
        '每个区块输出 1 至 4 个自然段，保持正式、审慎、可复核的专业语气',
        '数字使用阿拉伯数字，并且必须已经出现在事实包中',
        '住房指标比例必须保留“已归档分析覆盖楼栋”分母口径，不能扩展为项目全部楼栋',
        '图片识别结果只引用人工确认或修正后正式入库的问题及其证据链',
        '每个区块至少提供 1 个 evidenceRef；来源编号优先使用 sourceIds 中的编号，统计事实使用 FACT:加事实路径',
        '行动建议不得虚构资金、责任单位、工期和政策依据'
      ],
      outputSchema: {
        sections: [{
          sectionId: '原样返回',
          subsectionId: '原样返回',
          blockId: '原样返回',
          paragraphs: ['段落文字'],
          evidenceRefs: ['来源编号或 FACT:事实路径'],
          warnings: ['可选的数据不足说明']
        }]
      },
      blocks,
      facts
    })
  };
}

export function parseNarrativeModelContent(content) {
  if (content && typeof content === 'object') return content;
  let raw = String(content || '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('模型未返回合法的报告草稿 JSON');
  }
}

function collectAllowedEvidenceRefs(facts) {
  const refs = new Set();
  Object.values(facts.sourceIds || {}).forEach((items) => list(items).forEach((item) => refs.add(text(item, 200))));
  refs.add(facts.report.id);
  refs.add(facts.project.id);
  return refs;
}

function pathExists(root, path) {
  const parts = String(path || '').split('.').filter(Boolean);
  let value = root;
  for (const part of parts) {
    if (value == null || !Object.prototype.hasOwnProperty.call(Object(value), part)) return false;
    value = value[part];
  }
  return true;
}

function valueAtPath(root, path) {
  const parts = String(path || '').split('.').filter(Boolean);
  let value = root;
  for (const part of parts) {
    if (value == null || !Object.prototype.hasOwnProperty.call(Object(value), part)) return null;
    value = value[part];
  }
  return value;
}

function numericTokens(value) {
  return String(value || '').match(/\d+(?:\.\d+)?%?/g) || [];
}

export function validateReportNarrativeDraft({ draft, report, template = REPORT_TEMPLATE, subsectionIds = [] }) {
  const facts = buildReportFactBundle(report);
  const expected = selectNarrativeBlocks(template, subsectionIds);
  const expectedByKey = new Map(expected.map((item) => [`${item.sectionId}/${item.subsectionId}/${item.blockId}`, item]));
  const sections = list(draft?.sections);
  if (sections.length !== expected.length) throw new Error(`报告草稿区块数量无效，应为 ${expected.length} 个`);

  const allowedEvidenceRefs = collectAllowedEvidenceRefs(facts);
  const allowedNumbers = new Set(numericTokens(JSON.stringify(facts)));
  const seen = new Set();
  const normalized = sections.map((section) => {
    const sectionId = text(section?.sectionId, 120);
    const subsectionId = text(section?.subsectionId, 120);
    const blockId = text(section?.blockId, 120);
    const key = `${sectionId}/${subsectionId}/${blockId}`;
    const definition = expectedByKey.get(key);
    if (!definition || seen.has(key)) throw new Error(`报告草稿包含未知或重复区块：${key}`);
    seen.add(key);
    const paragraphs = list(section.paragraphs).map((item) => text(item, 2000)).filter(Boolean);
    if (!paragraphs.length || paragraphs.length > 4) throw new Error(`${blockId} 必须包含 1 至 4 个段落`);
    const contentLength = paragraphs.join('').length;
    const minLength = Math.max(40, number(definition.length?.min));
    const maxLength = Math.max(minLength, number(definition.length?.max) || 1200);
    if (contentLength < minLength || contentLength > maxLength) throw new Error(`${blockId} 长度应为 ${minLength}-${maxLength} 字`);
    const unexpectedNumbers = numericTokens(paragraphs.join('\n')).filter((item) => !allowedNumbers.has(item));
    if (unexpectedNumbers.length) throw new Error(`${blockId} 出现事实包之外的数字：${[...new Set(unexpectedNumbers)].join('、')}`);
    const evidenceRefs = list(section.evidenceRefs).map((item) => text(item, 200)).filter(Boolean);
    if (!evidenceRefs.length) throw new Error(`${blockId} 缺少证据引用`);
    for (const ref of evidenceRefs) {
      if (ref.startsWith('FACT:')) {
        if (!pathExists(facts, ref.slice(5))) throw new Error(`${blockId} 引用了不存在的事实路径：${ref}`);
      } else if (!allowedEvidenceRefs.has(ref)) {
        throw new Error(`${blockId} 引用了不存在的来源编号：${ref}`);
      }
    }
    return {
      sectionId,
      subsectionId,
      blockId,
      paragraphs,
      evidenceRefs: [...new Set(evidenceRefs)],
      warnings: list(section.warnings).map((item) => text(item, 500)).filter(Boolean).slice(0, 8)
    };
  });
  if (seen.size !== expectedByKey.size) throw new Error('报告草稿缺少指定区块');
  return { sections: normalized };
}

export function buildStoredReportDraft({ report, validatedDraft, model, requestId, usage, subsectionIds = [] }) {
  const now = new Date().toISOString();
  const previousSections = report?.draft?.templateVersion === REPORT_TEMPLATE.version ? list(report.draft.sections) : [];
  const replacements = new Map(validatedDraft.sections.map((item) => [`${item.sectionId}/${item.subsectionId}/${item.blockId}`, item]));
  const merged = previousSections.filter((item) => !replacements.has(`${item.sectionId}/${item.subsectionId}/${item.blockId}`));
  merged.push(...validatedDraft.sections);
  const order = new Map(narrativeBlocks(REPORT_TEMPLATE).map((item, index) => [`${item.sectionId}/${item.subsectionId}/${item.blockId}`, index]));
  merged.sort((a, b) => (order.get(`${a.sectionId}/${a.subsectionId}/${a.blockId}`) ?? 999) - (order.get(`${b.sectionId}/${b.subsectionId}/${b.blockId}`) ?? 999));
  return {
    templateId: REPORT_TEMPLATE.templateId,
    templateVersion: REPORT_TEMPLATE.version,
    status: 'draft',
    generatedAt: now,
    generatedBy: text(report?.generatedBy, 120),
    regeneratedSubsections: list(subsectionIds).length ? list(subsectionIds) : narrativeBlocks(REPORT_TEMPLATE).map((item) => item.subsectionId),
    aiGeneration: {
      model: text(model, 160),
      requestId: text(requestId, 240),
      usage: usage || null
    },
    sections: merged
  };
}

export function assembleReportDraftDocument({ report, template = REPORT_TEMPLATE }) {
  const facts = buildReportFactBundle(report);
  const generatedBlocks = new Map(list(report?.draft?.sections)
    .map((block) => [`${block.sectionId}/${block.subsectionId}/${block.blockId}`, block]));
  let narrativeTotal = 0;
  let narrativeReady = 0;
  const sections = list(template.sections)
    .slice()
    .sort((a, b) => number(a.order) - number(b.order))
    .map((section) => ({
      id: text(section.id, 120),
      order: number(section.order),
      title: text(section.title, 240),
      subsections: list(section.subsections).map((subsection) => ({
        id: text(subsection.id, 120),
        number: text(subsection.number, 40),
        title: text(subsection.title, 240),
        treatment: text(subsection.treatment, 80),
        blocks: list(subsection.blocks).map((block) => {
          const base = {
            id: text(block.id, 120),
            type: text(block.type, 80),
            title: text(block.title, 240),
            sourceMode: block.type === 'fixed'
              ? (subsection.treatment === 'retain' ? 'sample-fixed' : 'template-fixed')
              : (block.type === 'variable-table' ? 'snapshot-data' : 'ai-generated'),
            allowedAction: block.type === 'ai-narrative' ? 'regenerate' : (block.type === 'variable-table' ? 'auto-fill' : 'none')
          };
          if (block.type === 'fixed') {
            return { ...base, status: 'ready', content: text(block.content, 6000) };
          }
          if (block.type === 'variable-table') {
            const dataPath = text(block.dataPath, 200);
            const data = valueAtPath(facts, dataPath);
            return {
              ...base,
              status: data == null || (Array.isArray(data) && !data.length) ? 'empty' : 'ready',
              dataPath,
              data,
              emptyText: text(block.emptyText, 300) || '暂无数据'
            };
          }
          if (block.type === 'ai-narrative') {
            narrativeTotal += 1;
            const generated = generatedBlocks.get(`${section.id}/${subsection.id}/${block.id}`);
            if (generated) narrativeReady += 1;
            return {
              ...base,
              status: generated ? 'ready' : 'missing',
              paragraphs: list(generated?.paragraphs),
              evidenceRefs: list(generated?.evidenceRefs),
              warnings: list(generated?.warnings)
            };
          }
          return { ...base, status: 'unsupported' };
        })
      }))
    }));

  return {
    reportId: report.id,
    reportVersion: number(report.version),
    templateId: template.templateId,
    templateVersion: template.version,
    title: text(report.title, 240) || `${facts.project.name}体检报告`,
    generatedAt: report.generatedAt,
    dataCutoffAt: report.dataCutoffAt,
    draftUpdatedAt: report.draftUpdatedAt || report.draft?.generatedAt || '',
    completeness: {
      narrativeReady,
      narrativeTotal,
      complete: narrativeTotal > 0 && narrativeReady === narrativeTotal
    },
    sections
  };
}
