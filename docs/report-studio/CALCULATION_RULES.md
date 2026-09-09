# 计算规则注册表

> 规则集版本：`1.0.0`
> 建立日期：2026-09-09
> 源文件：`functions/api/report-calculation-core.js`

## 1. 规则概览

共 27 条注册规则，分 4 大类：

| 类别 | 规则数 | 说明 |
|------|--------|------|
| housing | 7 | 项目与住宅台账 |
| photos | 6 | 现场采集和照片 |
| issues | 11 | 正式问题统计 |
| community | 3 | 社区/街区设施 |

## 2. 住宅台账规则

| 规则 ID | 标签 | 公式 | 单位 | 舍入 | 缺失策略 |
|---------|------|------|------|------|----------|
| CALC-HOUSING-COMMUNITY-COUNT | 住宅小区数量 | 有效住宅小区去重计数 | 个 | integer | not-computable |
| CALC-HOUSING-BUILDING-COUNT | 住宅楼栋数量 | 有效楼栋明细计数或小区汇总 | 栋 | integer | not-computable |
| CALC-HOUSING-HOUSEHOLD-COUNT | 已核实住宅户数 | 有效楼栋户数求和或小区汇总 | 户 | integer | not-computable |
| CALC-HOUSING-COMMUNITY-DETAIL-RATE | 小区资料完整率 | 已录入楼栋明细的小区数 ÷ 有效小区数 × 100% | % | 1位小数 | not-computable |
| CALC-HOUSING-BUILDING-DETAIL-RATE | 楼栋资料完整率 | 已录入户数的楼栋数 ÷ 有效楼栋数 × 100% | % | 1位小数 | not-computable |
| CALC-HOUSING-HOUSEHOLD-DATA-RATE | 户数资料完整率 | 已核实户数的小区数 ÷ 有效小区数 × 100% | % | 1位小数 | not-computable |
| CALC-HOUSING-SCOPE-AREA | 项目范围面积 | 项目范围面积（用户提供或地图框选） | km² | 2位小数 | not-computable |

### 统计口径优先级

**住宅楼栋数：**
1. 小区存在完整有效楼栋明细时，按有效楼栋明细数量统计
2. 没有楼栋明细时，使用人工核实的小区 `buildingCount`
3. 不得同时叠加楼栋明细和小区汇总

**住宅户数：**
1. 楼栋明细户数完整时，按有效楼栋户数求和
2. 楼栋明细不完整时，使用人工核实的小区 `householdCount`
3. 未核实或空值不得转换为 0 后用于覆盖率判断

## 3. 现场采集规则

| 规则 ID | 标签 | 公式 | 单位 | 舍入 |
|---------|------|------|------|------|
| CALC-PHOTO-ORIGINAL-COUNT | 原始现场照片数量 | 已归档原始现场照片计数 | 张 | integer |
| CALC-PHOTO-ANNOTATED-COUNT | 标注图数量 | 已归档标注图计数 | 张 | integer |
| CALC-PHOTO-COMMUNITY-COVERAGE | 小区照片覆盖率 | 有照片的小区数 ÷ 有效小区数 × 100% | % | 1位小数 |
| CALC-PHOTO-BUILDING-COVERAGE | 楼栋照片覆盖率 | 有照片的楼栋数 ÷ 有效楼栋数 × 100% | % | 1位小数 |
| CALC-PHOTO-ANALYZED-COUNT | 已完成分析的原始照片数量 | 有对应正式问题原图引用的去重照片数 | 张 | integer |
| CALC-PHOTO-PENDING-ANALYSIS | 待分析原始照片数量 | 原始照片总数 - 已完成分析的照片数 | 张 | integer |

### 照片统计口径

- 只统计原始现场照片
- 标注图单独统计，不得计入现场照片总数
- 删除、无效或跨项目照片不得计入
- 覆盖率仅在分母真实且大于 0 时计算

## 4. 正式问题规则

| 规则 ID | 标签 | 公式 | 单位 | 舍入 |
|---------|------|------|------|------|
| CALC-ISSUE-TOTAL | 正式问题总数 | 有效正式问题计数 | 个 | integer |
| CALC-ISSUE-HIGH-COUNT | 高风险问题数量 | severity=high 的正式问题计数 | 个 | integer |
| CALC-ISSUE-MEDIUM-COUNT | 中风险问题数量 | severity=medium 的正式问题计数 | 个 | integer |
| CALC-ISSUE-LOW-COUNT | 低风险问题数量 | severity=low 的正式问题计数 | 个 | integer |
| CALC-ISSUE-HIGH-RATE | 高风险问题占比 | 高风险正式问题数 ÷ 正式问题总数 × 100% | % | 1位小数 |
| CALC-ISSUE-MEDIUM-RATE | 中风险问题占比 | 中风险正式问题数 ÷ 正式问题总数 × 100% | % | 1位小数 |
| CALC-ISSUE-LOW-RATE | 低风险问题占比 | 低风险正式问题数 ÷ 正式问题总数 × 100% | % | 1位小数 |
| CALC-ISSUE-COMMUNITIES-AFFECTED | 涉及小区数量 | 正式问题关联的不重复小区数 | 个 | integer |
| CALC-ISSUE-BUILDINGS-AFFECTED | 涉及楼栋数量 | 正式问题关联的不重复楼栋数 | 栋 | integer |
| CALC-ISSUE-COMMUNITY-AFFECTED-RATE | 涉及小区占比 | 涉及小区数 ÷ 有效小区数 × 100% | % | 1位小数 |
| CALC-ISSUE-WITH-PHOTO | 有原图证据的问题数量 | originalPhotoId 非空的正式问题计数 | 个 | integer |
| CALC-ISSUE-WITH-ANNOTATION | 有标注图证据的问题数量 | annotatedPhotoId 非空的正式问题计数 | 个 | integer |

### 问题统计口径

- 只统计 `officialIssues`
- 按 `projectId` 严格过滤
- 驳回的候选问题不统计
- 同一正式问题按稳定 ID 去重

## 5. 社区/街区规则

| 规则 ID | 标签 | 公式 | 单位 | 舍入 |
|---------|------|------|------|------|
| CALC-COMMUNITY-FACILITY-TOTAL | 检索设施总数 | 社区/街区分析中所有设施数量之和 | 个 | integer |
| CALC-COMMUNITY-FACILITY-DENSITY | 设施密度 | 检索设施总数 ÷ 项目范围面积 | 个/km² | 2位小数 |

### 社区/街区口径

- 使用已经保存的检索结果和聚合结果
- 正文使用"本次检索识别到"或"项目分析范围内检索到"等准确口径
- 不将地图检索结果表述为行政统计部门的全量普查数据
- 零结果类别只作为本次检索发现，不直接表述为绝对缺失

## 6. 缺失值状态

| 状态 | 说明 | 报告处理 |
|------|------|----------|
| `calculated` | 正常计算完成 | 使用计算结果 |
| `not-computable` | 输入不足，不能计算 | 报告使用不引用比例的表述 |
| `not-applicable` | 当前项目不适用 | 跳过对应段落 |
| `zero` | 真实计算得到零 | 使用 0 |
| `null` | 没有输入值 | 使用"—"或省略 |

**禁止规则：** 不得使用 `Number(value) || 0` 一类写法把未知值静默变成 0。

## 7. 算法来源等级

| 等级 | 说明 | 审计可见 |
|------|------|----------|
| `template-explicit` | 母版明确给出 | 是 |
| `data-definition` | 由现有字段和业务定义直接确定 | 是 |
| `standard-statistical` | 使用标准计数、去重、求和、比例或密度算法 | 是 |
| `derived-conservative` | 在不扩大结论的前提下采用保守推导规则 | 是 |

这些来源等级仅用于计算页面的审计明细，不进入正式报告。
