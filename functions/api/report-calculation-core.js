/**
 * report-calculation-core.js
 * 确定性计算引擎。纯函数模块，不访问 DOM、不调用 LLM、不直接访问数据库。
 * 相同输入 + 相同规则版本 = 完全相同输出。
 *
 * 所有规则集中注册，不允许在 UI 或提示词中零散计算。
 */

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * 计算结果状态
 */
const CalcStatus = Object.freeze({
  CALCULATED: 'calculated',
  NOT_COMPUTABLE: 'not-computable',
  NOT_APPLICABLE: 'not-applicable',
  MANUALLY_ADJUSTED: 'manually-adjusted',
  ZERO: 'zero',
  NULL: 'null'
});

/**
 * 规则注册表
 * 每条规则包含：id, version, label, category, formula, unit, rounding, missingPolicy
 */
const RULES = [
  // === 项目与住宅台账 ===
  {
    id: 'CALC-HOUSING-COMMUNITY-COUNT',
    version: '1.0.0',
    label: '住宅小区数量',
    category: 'housing',
    formulaLabel: '有效住宅小区去重计数',
    unit: '个',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => ({ value: ctx.housing.communityCount })
  },
  {
    id: 'CALC-HOUSING-BUILDING-COUNT',
    version: '1.0.0',
    label: '住宅楼栋数量',
    category: 'housing',
    formulaLabel: '有效楼栋明细计数或小区汇总',
    unit: '栋',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => ({ value: ctx.housing.buildingCount })
  },
  {
    id: 'CALC-HOUSING-HOUSEHOLD-COUNT',
    version: '1.0.0',
    label: '已核实住宅户数',
    category: 'housing',
    formulaLabel: '有效楼栋户数求和或小区汇总',
    unit: '户',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => ctx.housing.householdCount === null
      ? { status: CalcStatus.NOT_COMPUTABLE, inputs: { reason: '存在未核实户数' } }
      : ({ value: ctx.housing.householdCount })
  },
  {
    id: 'CALC-HOUSING-COMMUNITY-DETAIL-RATE',
    version: '1.0.0',
    label: '小区资料完整率',
    category: 'housing',
    formulaLabel: '已录入楼栋明细的小区数 ÷ 有效小区数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const total = ctx.housing.communityCount;
      if (total === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { total } };
      const withDetail = ctx.housing.communitiesWithBuildingDetail;
      return { value: roundTo(withDetail / total * 100, 1), inputs: { withDetail, total } };
    }
  },
  {
    id: 'CALC-HOUSING-BUILDING-DETAIL-RATE',
    version: '1.0.0',
    label: '楼栋资料完整率',
    category: 'housing',
    formulaLabel: '已录入户数的楼栋数 ÷ 有效楼栋数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const communities = ctx.housing.communities || [];
      let totalBuildings = 0;
      let withHousehold = 0;
      for (const c of communities) {
        for (const b of (c.buildingDetail || [])) {
          totalBuildings += 1;
          if (number(b.householdCount) > 0) withHousehold += 1;
        }
      }
      if (totalBuildings === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { totalBuildings } };
      return { value: roundTo(withHousehold / totalBuildings * 100, 1), inputs: { withHousehold, totalBuildings } };
    }
  },
  {
    id: 'CALC-HOUSING-HOUSEHOLD-DATA-RATE',
    version: '1.0.0',
    label: '户数资料完整率',
    category: 'housing',
    formulaLabel: '已核实户数的小区数 ÷ 有效小区数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const total = ctx.housing.communityCount;
      if (total === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { total } };
      const withData = ctx.housing.communitiesWithHouseholdData;
      return { value: roundTo(withData / total * 100, 1), inputs: { withData, total } };
    }
  },
  {
    id: 'CALC-HOUSING-SCOPE-AREA',
    version: '1.0.0',
    label: '项目范围面积',
    category: 'housing',
    formulaLabel: '项目范围面积（用户提供或地图框选）',
    unit: 'km²',
    rounding: 2,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const v = number(ctx.project.scopeAreaSqKm);
      if (v === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { scopeAreaSqKm: ctx.project.scopeAreaSqKm } };
      return { value: roundTo(v, 2) };
    }
  },

  // === 现场采集 ===
  {
    id: 'CALC-PHOTO-ORIGINAL-COUNT',
    version: '1.0.0',
    label: '原始现场照片数量',
    category: 'photos',
    formulaLabel: '已归档原始现场照片计数',
    unit: '张',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => ({ value: ctx.photos.originalCount })
  },
  {
    id: 'CALC-PHOTO-ANNOTATED-COUNT',
    version: '1.0.0',
    label: '标注图数量',
    category: 'photos',
    formulaLabel: '已归档标注图计数',
    unit: '张',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => ({ value: ctx.photos.annotatedCount })
  },
  {
    id: 'CALC-PHOTO-COMMUNITY-COVERAGE',
    version: '1.0.0',
    label: '小区照片覆盖率',
    category: 'photos',
    formulaLabel: '有照片的小区数 ÷ 有效小区数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const total = ctx.housing.communityCount;
      if (total === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { total } };
      const covered = ctx.photos.communitiesWithPhotos;
      return { value: roundTo(covered / total * 100, 1), inputs: { covered, total } };
    }
  },
  {
    id: 'CALC-PHOTO-BUILDING-COVERAGE',
    version: '1.0.0',
    label: '楼栋照片覆盖率',
    category: 'photos',
    formulaLabel: '有照片的楼栋数 ÷ 有效楼栋数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const total = ctx.housing.buildingCount;
      if (total === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { total } };
      const covered = ctx.photos.buildingsWithPhotos;
      return { value: roundTo(covered / total * 100, 1), inputs: { covered, total } };
    }
  },
  {
    id: 'CALC-PHOTO-ANALYZED-COUNT',
    version: '1.0.0',
    label: '已完成分析的原始照片数量',
    category: 'photos',
    formulaLabel: '已归档分析批次中关联的原始照片数',
    unit: '张',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      // 已完成分析 = 有对应分析批次的原始照片
      const analyzed = new Set();
      for (const issue of ctx.officialIssues.items || []) {
        if (issue.originalPhotoId) analyzed.add(issue.originalPhotoId);
      }
      return { value: analyzed.size };
    }
  },
  {
    id: 'CALC-PHOTO-PENDING-ANALYSIS',
    version: '1.0.0',
    label: '待分析原始照片数量',
    category: 'photos',
    formulaLabel: '原始照片总数 - 已完成分析的照片数',
    unit: '张',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const analyzed = new Set();
      for (const issue of ctx.officialIssues.items || []) {
        if (issue.originalPhotoId) analyzed.add(issue.originalPhotoId);
      }
      return { value: Math.max(0, ctx.photos.originalCount - analyzed.size) };
    }
  },

  // === 正式问题 ===
  {
    id: 'CALC-ISSUE-TOTAL',
    version: '1.0.0',
    label: '正式问题总数',
    category: 'issues',
    formulaLabel: '有效正式问题计数',
    unit: '个',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => ({ value: ctx.officialIssues.totalCount })
  },
  {
    id: 'CALC-ISSUE-HIGH-COUNT',
    version: '1.0.0',
    label: '高风险问题数量',
    category: 'issues',
    formulaLabel: 'severity=high 的正式问题计数',
    unit: '个',
    rounding: 'integer',
    compute: (ctx) => ({ value: ctx.officialIssues.stats.high })
  },
  {
    id: 'CALC-ISSUE-MEDIUM-COUNT',
    version: '1.0.0',
    label: '中风险问题数量',
    category: 'issues',
    formulaLabel: 'severity=medium 的正式问题计数',
    unit: '个',
    rounding: 'integer',
    compute: (ctx) => ({ value: ctx.officialIssues.stats.medium })
  },
  {
    id: 'CALC-ISSUE-LOW-COUNT',
    version: '1.0.0',
    label: '低风险问题数量',
    category: 'issues',
    formulaLabel: 'severity=low 的正式问题计数',
    unit: '个',
    rounding: 'integer',
    compute: (ctx) => ({ value: ctx.officialIssues.stats.low })
  },
  {
    id: 'CALC-ISSUE-HIGH-RATE',
    version: '1.0.0',
    label: '高风险问题占比',
    category: 'issues',
    formulaLabel: '高风险正式问题数 ÷ 正式问题总数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const total = ctx.officialIssues.totalCount;
      if (total === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { total } };
      return { value: roundTo(ctx.officialIssues.stats.high / total * 100, 1), inputs: { high: ctx.officialIssues.stats.high, total } };
    }
  },
  {
    id: 'CALC-ISSUE-MEDIUM-RATE',
    version: '1.0.0',
    label: '中风险问题占比',
    category: 'issues',
    formulaLabel: '中风险正式问题数 ÷ 正式问题总数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const total = ctx.officialIssues.totalCount;
      if (total === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { total } };
      return { value: roundTo(ctx.officialIssues.stats.medium / total * 100, 1), inputs: { medium: ctx.officialIssues.stats.medium, total } };
    }
  },
  {
    id: 'CALC-ISSUE-LOW-RATE',
    version: '1.0.0',
    label: '低风险问题占比',
    category: 'issues',
    formulaLabel: '低风险正式问题数 ÷ 正式问题总数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const total = ctx.officialIssues.totalCount;
      if (total === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { total } };
      return { value: roundTo(ctx.officialIssues.stats.low / total * 100, 1), inputs: { low: ctx.officialIssues.stats.low, total } };
    }
  },
  {
    id: 'CALC-ISSUE-COMMUNITIES-AFFECTED',
    version: '1.0.0',
    label: '涉及小区数量',
    category: 'issues',
    formulaLabel: '正式问题关联的不重复小区数',
    unit: '个',
    rounding: 'integer',
    compute: (ctx) => ({ value: ctx.officialIssues.communitiesAffected })
  },
  {
    id: 'CALC-ISSUE-BUILDINGS-AFFECTED',
    version: '1.0.0',
    label: '涉及楼栋数量',
    category: 'issues',
    formulaLabel: '正式问题关联的不重复楼栋数',
    unit: '栋',
    rounding: 'integer',
    compute: (ctx) => ({ value: ctx.officialIssues.buildingsAffected })
  },
  {
    id: 'CALC-ISSUE-COMMUNITY-AFFECTED-RATE',
    version: '1.0.0',
    label: '涉及小区占比',
    category: 'issues',
    formulaLabel: '涉及小区数 ÷ 有效小区数 × 100%',
    unit: '%',
    rounding: 1,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const total = ctx.housing.communityCount;
      if (total === 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { total } };
      return { value: roundTo(ctx.officialIssues.communitiesAffected / total * 100, 1), inputs: { affected: ctx.officialIssues.communitiesAffected, total } };
    }
  },
  {
    id: 'CALC-ISSUE-WITH-PHOTO',
    version: '1.0.0',
    label: '有原图证据的问题数量',
    category: 'issues',
    formulaLabel: 'originalPhotoId 非空的正式问题计数',
    unit: '个',
    rounding: 'integer',
    compute: (ctx) => ({ value: ctx.officialIssues.withOriginalPhoto })
  },
  {
    id: 'CALC-ISSUE-WITH-ANNOTATION',
    version: '1.0.0',
    label: '有标注图证据的问题数量',
    category: 'issues',
    formulaLabel: 'annotatedPhotoId 非空的正式问题计数',
    unit: '个',
    rounding: 'integer',
    compute: (ctx) => ({ value: ctx.officialIssues.withAnnotatedPhoto })
  },

  // === 社区/街区 ===
  {
    id: 'CALC-COMMUNITY-FACILITY-TOTAL',
    version: '1.0.0',
    label: '检索设施总数',
    category: 'community',
    formulaLabel: '社区/街区分析中所有设施数量之和',
    unit: '个',
    rounding: 'integer',
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const ca = ctx.communityAnalysis;
      if (!ca || !ca.categories) return { status: CalcStatus.NOT_COMPUTABLE };
      const total = Object.values(ca.categories).reduce((s, cat) => s + number(cat?.count), 0);
      return { value: total, inputs: { categories: Object.keys(ca.categories) } };
    }
  },
  {
    id: 'CALC-COMMUNITY-FACILITY-DENSITY',
    version: '1.0.0',
    label: '设施密度',
    category: 'community',
    formulaLabel: '检索设施总数 ÷ 项目范围面积',
    unit: '个/km²',
    rounding: 2,
    missingPolicy: 'not-computable',
    compute: (ctx) => {
      const area = number(ctx.project.scopeAreaSqKm);
      if (area <= 0) return { status: CalcStatus.NOT_COMPUTABLE, inputs: { scopeAreaSqKm: ctx.project.scopeAreaSqKm } };
      const ca = ctx.communityAnalysis;
      if (!ca || !ca.categories) return { status: CalcStatus.NOT_COMPUTABLE };
      const total = Object.values(ca.categories).reduce((s, cat) => s + number(cat?.count), 0);
      return { value: roundTo(total / area, 2), inputs: { total, area } };
    }
  }
];

/**
 * 按 category 查找所有规则
 * @param {string} category
 * @returns {Array}
 */
export function getRulesByCategory(category) {
  return RULES.filter((r) => r.category === category);
}

/**
 * 获取所有规则
 * @returns {Array}
 */
export function getAllRules() {
  return [...RULES];
}

/**
 * 运行全部计算
 * @param {object} context - buildReportContext 的输出
 * @returns {object} 计算快照
 */
export function runAllCalculations(context) {
  const results = [];
  const now = new Date().toISOString();

  for (const rule of RULES) {
    try {
      const raw = rule.compute(context);
      const status = raw.status || (raw.value === undefined || raw.value === null ? CalcStatus.NOT_COMPUTABLE : CalcStatus.CALCULATED);
      let value = raw.value;
      let formattedValue = '';

      if (status === CalcStatus.CALCULATED && value !== undefined && value !== null) {
        if (rule.rounding === 'integer') {
          value = Math.round(value);
          formattedValue = `${value}${rule.unit || ''}`;
        } else if (typeof rule.rounding === 'number') {
          value = roundTo(value, rule.rounding);
          formattedValue = `${value}${rule.unit || ''}`;
        } else {
          formattedValue = `${value}${rule.unit || ''}`;
        }
      } else {
        formattedValue = '—';
      }

      results.push({
        ruleId: rule.id,
        ruleVersion: rule.version,
        label: rule.label,
        category: rule.category,
        formulaLabel: rule.formulaLabel,
        value,
        formattedValue,
        unit: rule.unit,
        rounding: rule.rounding,
        status,
        inputs: raw.inputs || {},
        calculatedAt: now
      });
    } catch (error) {
      results.push({
        ruleId: rule.id,
        ruleVersion: rule.version,
        label: rule.label,
        category: rule.category,
        formulaLabel: rule.formulaLabel,
        value: null,
        formattedValue: '—',
        unit: rule.unit,
        rounding: rule.rounding,
        status: 'error',
        error: error.message,
        calculatedAt: now
      });
    }
  }

  return {
    schemaVersion: '1.0.0',
    contextHash: context.contextHash,
    projectId: context.projectId,
    calculatedAt: now,
    ruleSetVersion: '1.0.0',
    results,
    byCategory: {
      housing: results.filter((r) => r.category === 'housing'),
      photos: results.filter((r) => r.category === 'photos'),
      issues: results.filter((r) => r.category === 'issues'),
      community: results.filter((r) => r.category === 'community')
    }
  };
}
