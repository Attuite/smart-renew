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

function compactIssue(issue, indicatorMeta = null) {
  return {
    id: text(issue?.id, 160),
    problemCode: text(issue?.problemCode, 120),
    indicatorCode: text(issue?.indicatorCode, 120),
    communityId: text(issue?.communityId, 160),
    buildingId: text(issue?.buildingId, 160),
    title: text(issue?.title || issue?.problemName || issue?.type, 240),
    description: text(issue?.description, 1000),
    evidence: text(issue?.evidence, 800),
    severity: ['high', 'medium', 'low'].includes(issue?.severity) ? issue.severity : 'medium',
    location: text(issue?.location || issue?.position, 240) || '待定位',
    suggestion: text(issue?.suggestion, 600) || '待评估',
    indicatorName: text(indicatorMeta?.name, 240),
    indicatorGroup: text(indicatorMeta?.group, 120),
    metricValue: indicatorMeta?.value == null ? null : number(indicatorMeta.value),
    metricUnit: text(indicatorMeta?.unit, 40),
    metricRate: indicatorMeta?.rate == null ? null : number(indicatorMeta.rate)
  };
}

export function buildReportFactBundle(report) {
  if (!report?.id || !report?.snapshot) throw new Error('报告快照结构无效');
  const snapshot = report.snapshot;
  const rawIssues = list(snapshot.issues?.items);
  const metricResults = snapshot.metricResults || { housing: null, community: null };
  const housingMetricItems = list(metricResults?.housing?.items);
  const communityMetricItems = list(metricResults?.community?.items);
  const indicatorMetaByCode = new Map(housingMetricItems.map((item) => [text(item?.indicatorCode, 120), item]));
  const issues = rawIssues.map((issue) => compactIssue(issue, indicatorMetaByCode.get(text(issue?.indicatorCode, 120))));
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
    metrics: {
      ...metricResults,
      catalog: [
        ...housingMetricItems.map((item) => ({ ...item, dimension: 'housing', dimensionLabel: '住房' })),
        ...communityMetricItems.map((item) => ({ ...item, dimension: 'community', dimensionLabel: '小区（社区）' }))
      ],
      overview: {
        communityMetricCount: communityMetricItems.length,
        communityAvailableCount: communityMetricItems.filter((item) => item?.status === 'ready' || item?.status === 'partial').length,
        housingMetricCount: housingMetricItems.length,
        housingReadyCount: housingMetricItems.filter((item) => item?.status === 'ready').length,
        housingPartialCount: housingMetricItems.filter((item) => item?.status === 'partial').length,
        housingUnavailableCount: housingMetricItems.filter((item) => item?.status === 'unavailable').length
      }
    },
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
      reference: block.reference && typeof block.reference === 'object' ? {
        section: text(block.reference.section, 240),
        content: text(block.reference.content, 1600)
      } : null,
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
  const blocks = selectNarrativeBlocks(template, subsectionIds).map((block) => ({
    ...block,
    allowedFactEvidenceRefs: block.evidencePaths.map((path) => `FACT:${path}`)
  }));
  return {
    facts,
    blocks,
    system: [
      '你是城市更新项目体检报告的专业撰稿人。',
      '本任务不是自由创作，而是在正式范例报告的母版槽位中替换项目事实。必须保持范例的论证深度、层次和篇幅。',
      '每个区块都包含其对应范例小节的 reference。reference 只用于学习该小节的结构、论证顺序、段落密度和表达方式，不得复制其中的城市名称、数字或结论。',
      '写法遵循“总体判断—分项事实—问题解释—数据边界或治理含义”，避免空泛总结和重复套话。',
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
        '逐区块阅读 reference.section 和 reference.content，生成文本必须体现对应范例小节的展开顺序，不得用同一套通用结构处理所有小节',
        '每个区块按 objective 要求输出 3 至 6 个自然段；段首可采用“一是”“二是”或判断式短句增强正式报告层次',
        '不得把事实包逐项机械复述；每段须包含明确主题，并说明该事实对体检判断的含义',
        '数字使用阿拉伯数字，并且必须已经出现在事实包中',
        '住房指标比例必须保留“已归档分析覆盖楼栋”分母口径，不能扩展为项目全部楼栋',
        '图片识别结果只引用人工确认或修正后正式入库的问题及其证据链',
        '每个区块至少提供 1 个 evidenceRef；来源编号优先使用 sourceIds 中的编号，统计事实使用 FACT:加事实路径',
        'FACT 证据引用只能原样选用当前区块 allowedFactEvidenceRefs 中列出的值，不得追加、缩写或自行猜测子路径',
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

function metricNames(items, predicate = () => true, limit = 4) {
  return list(items).filter(predicate).slice(0, limit).map((item) => text(item?.standardName || item?.name, 120)).filter(Boolean);
}

function buildNarrativeFallback(block, facts) {
  const project = facts.project || {};
  const housing = facts.housing || {};
  const issues = facts.issues?.summary || {};
  const housingMetrics = facts.metrics?.housing || {};
  const communityMetrics = facts.metrics?.community || {};
  const availableCommunity = list(communityMetrics.items).filter((item) => item?.value != null);
  const availableHousing = list(housingMetrics.items).filter((item) => item?.status === 'ready' || item?.status === 'partial');
  const unavailableHousing = metricNames(housingMetrics.items, (item) => item?.status === 'unavailable', 5);
  const communityTotal = number(communityMetrics.scope?.facilitySpaceTotal);
  const radiusKm = number(communityMetrics.scope?.radiusKm);
  const surveyedBuildings = number(housingMetrics.scope?.surveyedBuildingCount);
  const paragraphsByBlock = {
    'project-overview-narrative': [
      `${text(project.name, 240) || '本项目'}位于${text(project.area, 240) || '项目所在区域'}，项目类型为${text(project.type, 120) || '待补充'}。本次体检以项目档案确定的范围为基础，围绕小区（社区）设施现状和既有住房状况开展资料归集、现场识别和综合评价。`,
      `项目住房台账现包含 ${number(housing.communityCount)} 个小区（社区）、${number(housing.buildingCount)} 栋住宅和 ${number(housing.householdCount)} 户。报告同步读取已归档现场照片、分析批次、人工复核后的正式问题和社区设施分析结果，形成项目级数据快照。`,
      '当前报告仅对已经接入且能够追溯的数据形成结论。居民问卷、历年对比、专项检测以及缺少调查分母的指标不作推算，后续可在补充调查后更新相应小节。'
    ],
    'community-overall-narrative': [
      `本次小区（社区）维度以项目保存的设施地图检索结果为基础，${radiusKm ? `在 ${radiusKm} 千米分析范围内` : '在当前分析范围内'}归集 ${communityTotal} 个设施空间，共形成 ${availableCommunity.length} 类可用设施现状指标。`,
      `设施完善方面，当前已对养老托育、教育、停车和充电等设施类别进行归集；环境宜居方面，已对公共活动场地、步行空间和垃圾分类设施进行观察；管理健全方面，已对物业管理和智慧设施进行统计。各指标结果详见本节评价结果表和分项指标评价。`,
      '需要说明的是，当前结果属于地图检索与空间合并形成的设施现状代理观测。由于尚缺居住用地、步行路网、设施建筑面积和服务能力等数据，本版本不据此判断配建达标率、服务覆盖率或设施缺口。'
    ],
    'housing-overall-narrative': [
      `本次住房维度覆盖项目台账中的 ${number(housing.buildingCount)} 栋住宅，其中已归档分析覆盖楼栋为 ${surveyedBuildings} 栋。住房比例指标均以已归档分析覆盖楼栋为有效分母，不扩展为项目全部楼栋。`,
      `本版本共纳入人工确认或修正后正式入库的问题 ${number(issues.total)} 条，其中高风险 ${number(issues.high)} 条、中风险 ${number(issues.medium)} 条、低风险 ${number(issues.low)} 条。当前可按完整或限定口径使用的住房指标为 ${availableHousing.length} 项。`,
      `住房指标按照安全耐久、功能完备和绿色智能三个方面组织。对于${unavailableHousing.length ? unavailableHousing.join('、') : '尚未接入专项数据的指标'}，当前仅保留指标位置和数据说明，不形成零值、达标或优良判断。`
    ],
    'community-judgement-narrative': [
      '总体来看，项目已具备社区设施数量结构的基础观察条件，但尚不足以形成配建达标和服务覆盖判断。现阶段应把地图检索结果作为后续实地核验的线索，而不是直接作为设施短板结论。',
      '一老一幼和教育服务需要结合设施实际开放状态、服务对象和步行可达性进一步核实；公共活动与步行环境需要补充场地规模、道路连续性和无障碍条件；停车、充电、物业和智慧设施则需要结合小区边界与实际运营情况复核。',
      '下一步应按照设施完善、环境宜居和管理健全三个方面完善调查台账，逐步接入居住规模、设施面积、服务半径和运营能力数据，再形成可用于更新决策的社区问题清单。'
    ],
    'housing-judgement-narrative': [
      `住房维度当前共归集 ${number(issues.total)} 条正式问题，调查和评价结果以已归档分析覆盖楼栋为边界。由于有效调查分母和部分专项数据仍不完整，本版本重点识别问题类型和证据链，不作无依据的总体等级判断。`,
      '安全耐久方面，应持续关注结构、燃气、楼道和围护系统中已正式入库的问题；功能完备方面，应结合管线管道、住宅成套性和适老化需求补充逐栋调查；绿色智能方面，仍需接入节能和数字化设施调查数据。',
      '建议建立楼栋级问题复核、风险分类、处置销号和动态复评机制，使现场照片、人工复核、指标计算和整治结果能够持续关联。'
    ],
    'remediation-strategy-narrative': [
      '一是完善社区设施核查。以现有设施地图检索结果为线索，补充设施开放状态、服务对象、步行可达性和实际服务能力调查，形成可复核的社区设施现状台账。',
      '二是分类处置住房问题。对正式问题按照安全耐久、功能完备和绿色智能分类，结合风险等级、发生位置和照片证据确定复核顺序；涉及专业安全鉴定的事项应转交具备资质的机构进一步确认。',
      '三是完善住房功能和长效管理。结合管线更新、适老化、节能和数字化需求逐步补齐调查字段，建立问题入库、复核、整改和销号的闭环管理机制。'
    ],
    'action-recommendations-narrative': [
      '近期以数据核验和安全问题复核为重点，完善社区、楼栋、现场照片和正式问题之间的编号关联，清理测试或缺少对象编号的数据，并对现有正式问题逐项确认。',
      '中期结合核验后的社区设施现状和住房问题清单，形成分类更新任务。社区维度重点补充公共服务与环境设施调查，住房维度重点推进安全隐患处置和使用功能完善。',
      '持续性工作应建立报告版本、问题整改和指标复评机制。每次新增调查或完成整改后更新数据快照，保留来源编号和审核记录，为后续正式报告和项目实施清单提供依据。'
    ]
  };
  return list(paragraphsByBlock[block.id || block.blockId]);
}

function metricStatusText(status) {
  return status === 'ready' ? '可直接用于本版本评价'
    : (status === 'partial' ? '仅可按限定口径用于本版本评价'
      : (status === 'invalid' ? '数据校验未通过，本版本不形成数值结论' : '当前来源未接入，本版本不形成数值结论'));
}

function buildMetricDetailItems(items, dimension) {
  return list(items).map((item, index) => {
    const isHousing = dimension === 'housing';
    const recognitionNames = list(item?.recognitionCatalog?.problemTypes).map((problem) => text(problem?.problemName, 120)).filter(Boolean);
    const inspectionContent = isHousing
      ? `本项体检围绕“${text(item?.name, 240)}”开展。现场识别与人工复核重点关注${recognitionNames.length ? recognitionNames.join('、') : '与该指标相关的可见问题及其发生位置'}，并核对问题是否已绑定具体社区、楼栋和原始照片。`
      : `本项体检对应第07步指标库中的“${text(item?.standardName || item?.name, 240)}”。当前数据条件下，以“${text(item?.name, 240)}”作为设施现状代理观测，重点核对设施类别、空间合并数量及样本名称。`;
    const criteria = isHousing
      ? '经人工确认或修正后形成正式问题，且问题具有对应指标编码时纳入统计；楼栋数量按 buildingId 去重。比例仅在存在已归档分析覆盖楼栋分母时计算。'
      : '地图检索结果经类别归集和邻近空间合并后计为设施空间。由于尚缺配建标准核验所需的居住规模、服务半径、步行网络或建筑面积数据，当前结果不用于判定达标、不达标或设施缺口。';
    const dataSource = isHousing
      ? '项目住房台账、现场原始照片、图片智能识别记录、人工复核结果和正式问题台账。'
      : '项目社区设施地图检索、空间合并结果和第07步社区指标库。';
    let evaluationResult = `该指标状态为“${metricStatusText(item?.status)}”。`;
    if (isHousing) {
      if (item?.value != null) {
        evaluationResult += `本版本识别受影响住宅 ${number(item.value)} ${text(item.unit, 20) || '栋'}，对应正式问题 ${number(item.issueCount)} 条`;
        if (item?.rate != null) evaluationResult += `，占已归档分析覆盖楼栋的 ${number(item.rate)}%`;
        evaluationResult += '。';
      } else if (number(item?.issueCount) > 0) {
        evaluationResult += `已形成正式问题 ${number(item.issueCount)} 条，但当前对象编号或统计分母不足，不能折算为${text(item.unit, 20) || '栋'}数或比例。`;
      }
    } else if (item?.value != null) {
      evaluationResult += `在当前地图检索与空间合并范围内，共记录 ${number(item.value)} 个相关设施空间。`;
      const samples = list(item?.sampleFacilities).map((sample) => text(sample?.name || sample, 80)).filter(Boolean).slice(0, 5);
      if (samples.length) evaluationResult += `检索样本包括${samples.join('、')}等。`;
    }
    if (text(item?.reason, 500)) evaluationResult += `口径说明：${text(item.reason, 500)}。`;
    return {
      number: index + 1,
      id: text(item?.id, 160),
      code: text(item?.indicatorCode || item?.referenceIndicatorCode, 120),
      group: text(item?.group, 120),
      title: text(item?.standardName || item?.name, 240),
      observedName: text(item?.name, 240),
      status: text(item?.status, 40),
      inspectionContent,
      criteria,
      dataSource,
      evaluationResult,
      evidenceRefs: list(item?.sourceIds)
    };
  });
}

export function parseNarrativeModelContent(content) {
  if (content && typeof content === 'object') return content;
  let raw = String(content || '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        // Continue to the validated error below.
      }
    }
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

function factPathParts(path) {
  return String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
}

function pathExists(root, path) {
  const parts = factPathParts(path);
  let value = root;
  for (const part of parts) {
    if (value == null || !Object.prototype.hasOwnProperty.call(Object(value), part)) return false;
    value = value[part];
  }
  return true;
}

function valueAtPath(root, path) {
  const parts = factPathParts(path);
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
    if (!paragraphs.length || paragraphs.length > 6) throw new Error(`${blockId} 必须包含 1 至 6 个段落`);
    const contentLength = paragraphs.join('').length;
    const suggestedMinLength = Math.max(40, number(definition.length?.min));
    const suggestedMaxLength = Math.max(suggestedMinLength, number(definition.length?.max) || 1200);
    const hardMaxLength = Math.max(2400, suggestedMaxLength * 2);
    if (contentLength < 40) throw new Error(`${blockId} 内容过短，至少需要 40 字`);
    if (contentLength > hardMaxLength) throw new Error(`${blockId} 内容异常冗长，不得超过 ${hardMaxLength} 字`);
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
    const warnings = list(section.warnings).map((item) => text(item, 500)).filter(Boolean).slice(0, 8);
    if (contentLength < suggestedMinLength) warnings.push(`当前事实较少，正文 ${contentLength} 字，低于模板建议的 ${suggestedMinLength} 字；未要求模型虚构或重复内容补足篇幅`);
    if (contentLength > suggestedMaxLength) warnings.push(`正文 ${contentLength} 字，超过模板建议的 ${suggestedMaxLength} 字，正式定稿时建议精简`);
    return {
      sectionId,
      subsectionId,
      blockId,
      paragraphs,
      evidenceRefs: [...new Set(evidenceRefs)],
      warnings: [...new Set(warnings)].slice(0, 8)
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
  const compatibleDraftSections = report?.draft?.templateVersion === template.version ? report?.draft?.sections : [];
  const generatedBlocks = new Map(list(compatibleDraftSections)
    .map((block) => [`${block.sectionId}/${block.subsectionId}/${block.blockId}`, block]));
  let narrativeTotal = 0;
  let narrativeReady = 0;
  let narrativeFallback = 0;
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
            tableVariant: text(block.tableVariant, 80),
            sourceMode: block.type === 'fixed'
              ? (subsection.treatment === 'retain' ? 'sample-fixed' : 'template-fixed')
              : (block.type === 'variable-table' ? 'snapshot-data' : (block.type === 'metric-detail' ? 'computed-metrics' : 'ai-assisted-slot')),
            allowedAction: block.type === 'ai-narrative' ? 'regenerate' : ((block.type === 'variable-table' || block.type === 'metric-detail') ? 'auto-fill' : 'none')
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
          if (block.type === 'metric-detail') {
            const dataPath = text(block.dataPath, 200);
            const data = valueAtPath(facts, dataPath);
            const items = buildMetricDetailItems(data, text(block.dimension, 40));
            return {
              ...base,
              status: items.length ? 'ready' : 'empty',
              dataPath,
              dimension: text(block.dimension, 40),
              items,
              emptyText: text(block.emptyText, 300) || '暂无数据'
            };
          }
          if (block.type === 'ai-narrative') {
            narrativeTotal += 1;
            const generated = generatedBlocks.get(`${section.id}/${subsection.id}/${block.id}`);
            if (generated) narrativeReady += 1;
            const fallbackParagraphs = generated ? [] : buildNarrativeFallback(block, facts);
            if (!generated && fallbackParagraphs.length) narrativeFallback += 1;
            return {
              ...base,
              sourceMode: generated ? 'ai-assisted-slot' : 'template-fallback',
              status: generated ? 'ready' : (fallbackParagraphs.length ? 'fallback' : 'missing'),
              paragraphs: generated ? list(generated?.paragraphs) : fallbackParagraphs,
              evidenceRefs: list(generated?.evidenceRefs),
              warnings: generated ? list(generated?.warnings) : ['当前显示母版兜底正文，重新生成本小节后将由AI依据项目事实和对应范例内容深化。']
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
      narrativeFallback,
      complete: narrativeTotal > 0 && narrativeReady === narrativeTotal
    },
    sections
  };
}
