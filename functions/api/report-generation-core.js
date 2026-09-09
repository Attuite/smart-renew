/**
 * report-generation-core.js
 * 分章 LLM 生成核心。纯函数模块：提示词构建、输出解析、正文校验。
 * 不直接调用 LLM，只构造请求和解析响应。
 */

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/**
 * 正式口径系统提示词
 */
const SYSTEM_PROMPT = `你是一位城市体检正式报告撰写专家。你正在为一份正式提交的城市体检报告撰写正文。

严格遵守以下规则：
1. 只输出指定的 JSON 结构，不要输出任何其他内容。
2. 不向读者解释生成过程，不使用"根据您提供的信息""作为 AI""无法判断""建议补充资料""以上内容仅供参考""模型分析""提示词""系统数据不足"等表述。
3. 不编造未提供的数字、地点、机构、时间、设施和问题。
4. 缺少事实时，改写为不依赖该事实的完整正式表述，不写"待补充"或"资料缺失"。
5. 只能使用允许事实和计算结果中列出的数字，不自行推算。
6. 不输出系统内部编号（如 PRB-03-01、PDI-*、RPT-* 等）。
7. 保持正式、客观、审慎的专业报告语气。
8. 不把候选问题表述为正式发现。
9. 表格使用指标中文名称、问题中文名称、行政区名称、数量、单位和正式结论。`;

/**
 * 为指定章节构建生成提示词
 * @param {object} params
 * @param {object} params.section - 章节定义（来自 template-schema.js）
 * @param {object} params.context - 标准报告上下文
 * @param {object} params.calculations - 计算快照
 * @param {string[]} params.previousSummaries - 此前已审核章节的短摘要
 * @returns {object} { systemPrompt, userPrompt, allowedNumbers }
 */
export function buildGenerationPrompt({ section, context, calculations, previousSummaries }) {
  const p = context.project;
  const iss = context.officialIssues;
  const h = context.housing;
  const ph = context.photos;

  // 收集允许使用的数字
  const allowedNumbers = [];
  const calcResults = (calculations?.results || []);
  for (const r of calcResults) {
    if (r.status === 'calculated' && r.value !== undefined && r.value !== null) {
      allowedNumbers.push(`${r.label}：${r.formattedValue}`);
    }
  }

  // 构建允许事实
  const facts = {
    '项目名称': p.name,
    '行政区划': p.administrativeArea,
    '项目范围面积': p.scopeAreaSqKm ? p.scopeAreaSqKm + ' km²' : '未提供',
    '住宅小区数量': h.communityCount + ' 个',
    '住宅楼栋数量': h.buildingCount + ' 栋',
    '住宅户数': h.householdCount + ' 户',
    '原始现场照片': ph.originalCount + ' 张',
    '标注图': ph.annotatedCount + ' 张',
    '正式问题总数': iss.totalCount + ' 个',
    '高风险问题': iss.stats.high + ' 个',
    '中风险问题': iss.stats.medium + ' ' + '个',
    '低风险问题': iss.stats.low + ' 个',
    '涉及小区数': iss.communitiesAffected + ' 个',
    '涉及楼栋数': iss.buildingsAffected + ' 栋'
  };

  // 问题分类摘要
  const indicatorCounts = iss.indicatorCounts || {};
  const indicatorNames = {
    'IND-HOUSE-001': '结构安全', 'IND-HOUSE-002': '燃气安全',
    'IND-HOUSE-003': '楼道安全', 'IND-HOUSE-004': '围护安全',
    'IND-HOUSE-005': '住宅性能', 'IND-HOUSE-006': '管线管道'
  };
  for (const [code, count] of Object.entries(indicatorCounts)) {
    const name = indicatorNames[code] || code;
    facts[name + '问题'] = count + ' 个';
  }

  // 整改建议摘要
  const suggestions = (iss.remediationCategories || []).slice(0, 10);
  if (suggestions.length) {
    facts['主要整改建议'] = suggestions.join('；');
  }

  // 此前章节摘要
  let prevContext = '';
  if (previousSummaries && previousSummaries.length) {
    prevContext = '\n\n此前已审核章节摘要（不可改写这些内容）：\n' +
      previousSummaries.map((s, i) => `第${i + 1}章：${s}`).join('\n');
  }

  const sectionTitle = section.title || '';
  const userPrompt = `请为以下章节撰写正式报告正文：

章节标题：${sectionTitle}
章节用途：${section.purpose || '正式城市体检报告正文'}

允许使用的事实：
${JSON.stringify(facts, null, 2)}

允许使用的数字：
${allowedNumbers.join('\n') || '无'}${prevContext}

请严格按以下 JSON 格式输出：
{
  "sectionKey": "${section.key || ''}",
  "title": "${sectionTitle}",
  "paragraphs": [
    { "id": "p1", "text": "正式正文段落……" }
  ],
  "tableNarratives": [],
  "usedFactKeys": [],
  "usedCalculationKeys": []
}`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt, allowedNumbers };
}

/**
 * 解析 LLM 输出为结构化段落
 * @param {string} rawOutput - 模型原始输出
 * @returns {object} { paragraphs, tableNarratives, usedFactKeys, usedCalculationKeys }
 */
export function parseGenerationOutput(rawOutput) {
  if (!rawOutput) throw new Error('模型输出为空');

  // 尝试提取 JSON
  let parsed;
  const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error('模型输出的 JSON 格式无效');
    }
  } else {
    throw new Error('模型输出中未找到 JSON 结构');
  }

  // 校验结构
  if (!parsed.paragraphs || !Array.isArray(parsed.paragraphs)) {
    throw new Error('输出缺少 paragraphs 数组');
  }

  const paragraphs = parsed.paragraphs
    .filter((p) => p && typeof p.text === 'string' && p.text.trim())
    .map((p, i) => ({
      id: clean(p.id, 120) || `p${i + 1}`,
      text: clean(p.text, 10000)
    }));

  if (!paragraphs.length) {
    throw new Error('生成的段落内容为空');
  }

  return {
    sectionKey: clean(parsed.sectionKey, 120),
    title: clean(parsed.title, 200),
    paragraphs,
    tableNarratives: Array.isArray(parsed.tableNarratives) ? parsed.tableNarratives : [],
    usedFactKeys: Array.isArray(parsed.usedFactKeys) ? parsed.usedFactKeys : [],
    usedCalculationKeys: Array.isArray(parsed.usedCalculationKeys) ? parsed.usedCalculationKeys : []
  };
}

/**
 * 检查生成内容是否包含禁止的解释性语言
 * @param {string} text
 * @returns {string[]} 匹配到的禁止模式
 */
export function detectAILanguage(text) {
  if (!text) return [];
  const patterns = [
    '作为 AI', '作为人工智能', '作为语言模型',
    '根据您提供的信息', '根据您提供', '根据用户提供的',
    '我认为', '我觉得', '在我看来',
    '无法获取', '无法判断', '无法确定',
    '请补充', '请提供', '需要补充',
    '以上内容仅供参考', '仅供参考', '仅供',
    '模型分析', 'AI 分析', '机器分析',
    '提示词', 'prompt',
    '系统数据不足', '数据不足',
    '无法访问', '没有权限',
    '作为一个 AI', '作为一个语言模型'
  ];
  const hits = [];
  for (const p of patterns) {
    if (text.includes(p)) hits.push(p);
  }
  return hits;
}
