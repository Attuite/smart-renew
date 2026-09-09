# 报告字段字典

> 模板编号：`TPL-WORD-V1`
> 版本：1.0.0
> 建立日期：2026-09-09
> 用途：统一项目数据字段、计算引擎字段和 Word 模板引用字段的映射

## 1. 字典说明

每个字段包含：

- `key`：机器可读字段标识
- `label`：中文名称
- `type`：数据类型
- `unit`：单位（如有）
- `source`：数据来源集合/字段
- `filter`：过滤条件
- `missingPolicy`：缺失时处理策略
- `reportLabel`：报告正文中的显示名称
- `allowInNarrative`：是否允许出现在正文叙述中
- `allowInTable`：是否允许出现在表格中
- `internalOnly`：是否仅内部使用（默认 false）

缺失策略（missingPolicy）说明：

- `not-computable`：输入不足，无法计算
- `omit-claim`：不在报告中声称该数值
- `show-pending`：显示"待补充"
- `show-zero`：显示 0（仅当确认真实为 0 时）
- `skip-section`：缺少时跳过对应小节
- `formal-generalization`：使用不依赖具体数字的正式表述

---

## 2. 报告元数据

| key | label | type | source | missingPolicy |
|-----|-------|------|--------|---------------|
| `report.title` | 报告标题 | string | 自动生成 | - |
| `report.year` | 报告年份 | integer | 当前年份 | - |
| `report.generatedYearMonth` | 生成年月 | string | 当前年月 | - |
| `report.generatedBy` | 生成人员 | string | 用户输入 | - |
| `report.templateId` | 模板编号 | string | 固定值 | - |
| `report.templateVersion` | 模板版本 | integer | 固定值 | - |
| `report.dataCutoffAt` | 数据截止时间 | string | 生成时 | - |
| `report.organizer` | 编制单位 | string | 项目字段 | show-pending |

## 3. 项目基本信息

| key | label | type | source | missingPolicy | reportLabel |
|-----|-------|------|--------|---------------|-------------|
| `project.id` | 项目编号 | string | projects.id | - | - |
| `project.name` | 项目名称 | string | projects.name | show-pending | 项目名称 |
| `project.administrativeArea` | 行政区划 | string | projects.administrativeArea | show-pending | - |
| `project.area` | 项目类型 | string | projects.area | show-pending | - |
| `project.type` | 更新类型 | string | projects.type | show-pending | - |
| `project.stage` | 项目阶段 | string | projects.stage | show-pending | - |
| `project.scope` | 项目范围 | string | projects.scope | show-pending | 项目范围 |
| `project.scopeAreaSqKm` | 范围面积 | number | projects.scopeAreaSqKm | not-computable | 范围面积 |
| `project.description` | 项目说明 | string | projects.desc | omit-claim | - |
| `project.responsibleUnit` | 责任单位 | string | projects.responsibleUnit | show-pending | - |
| `project.plannedPeriod` | 计划周期 | string | projects.plannedPeriod | show-pending | - |

## 4. 住宅小区、楼栋和户数

| key | label | type | unit | source | missingPolicy | reportLabel |
|-----|-------|------|------|--------|---------------|-------------|
| `housing.communityCount` | 有效住宅小区数量 | integer | 个 | projects.residentialInventory.items (status!=deleted) | - | 住宅小区 |
| `housing.buildingCount` | 有效住宅楼栋数量 | integer | 栋 | 小区楼栋明细或小区汇总 | not-computable | 住宅楼栋 |
| `housing.householdCount` | 已核实住宅户数 | integer | 户 | 小区楼栋明细或小区汇总 | not-computable | 住宅户数 |
| `housing.communitiesWithBuildingDetail` | 已录入楼栋明细的小区数量 | integer | 个 | 计算 | - | - |
| `housing.communitiesWithHouseholdData` | 已核实户数的小区数量 | integer | 个 | 计算 | - | - |
| `housing.communityDetailRate` | 小区资料完整率 | number | % | 计算 | not-computable | - |
| `housing.buildingDetailRate` | 楼栋资料完整率 | number | % | 计算 | not-computable | - |
| `housing.householdDataRate` | 户数资料完整率 | number | % | 计算 | not-computable | - |

统计口径：

- 住宅楼栋数：优先使用有效楼栋明细数量；无明细时使用小区 `buildingCount`
- 住宅户数：优先使用有效楼栋户数求和；不完整时使用小区 `householdCount`
- 不得同时叠加楼栋明细和小区汇总

## 5. 现场照片和采集覆盖

| key | label | type | unit | source | missingPolicy | reportLabel |
|-----|-------|------|------|--------|---------------|-------------|
| `photos.originalCount` | 原始现场照片数量 | integer | 张 | photoRecords (type=original, status=archived, projectId匹配) | - | 现场照片 |
| `photos.annotatedCount` | 标注图数量 | integer | 张 | photoRecords (type=annotated) | - | - |
| `photos.communitiesWithPhotos` | 有照片的小区数量 | integer | 个 | 计算 | - | - |
| `photos.buildingsWithPhotos` | 有照片的楼栋数量 | integer | 栋 | 计算 | - | - |
| `photos.communityCoverageRate` | 小区照片覆盖率 | number | % | 计算 | not-computable | 小区覆盖率 |
| `photos.buildingCoverageRate` | 楼栋照片覆盖率 | number | % | 计算 | not-computable | 楼栋覆盖率 |
| `photos.analyzedCount` | 已完成分析的原始照片数量 | integer | 张 | 计算 | - | - |
| `photos.pendingAnalysisCount` | 待分析原始照片数量 | integer | 张 | 计算 | - | - |

覆盖率规则：分母真实且 >0 时计算；缺失时状态 `not-computable`，报告使用不引用比例的表述。

## 6. AI 分析批次

| key | label | type | source | missingPolicy | reportLabel |
|-----|-------|------|--------|---------------|-------------|
| `analyses.totalCount` | 分析批次总数 | integer | analysisRecords (status=archived) | - | - |
| `analyses.note` | 分析批次说明 | string | 固定文案 | - | 仅用于工作量说明 |

AI 分析批次仅用于工作量说明，不作为正式问题依据。

## 7. 正式问题

| key | label | type | unit | source | missingPolicy | reportLabel |
|-----|-------|------|------|--------|---------------|-------------|
| `issues.totalCount` | 正式问题总数 | integer | 个 | officialIssues (projectId匹配) | - | 正式问题 |
| `issues.highCount` | 高风险问题数量 | integer | 个 | 计算 | - | 高风险 |
| `issues.mediumCount` | 中风险问题数量 | integer | 个 | 计算 | - | 中风险 |
| `issues.lowCount` | 低风险问题数量 | integer | 个 | 计算 | - | 低风险 |
| `issues.highRate` | 高风险问题占比 | number | % | 计算 | not-computable | - |
| `issues.mediumRate` | 中风险问题占比 | number | % | 计算 | not-computable | - |
| `issues.lowRate` | 低风险问题占比 | number | % | 计算 | not-computable | - |
| `issues.communitiesAffected` | 涉及小区数量 | integer | 个 | 计算 | - | - |
| `issues.buildingsAffected` | 涉及楼栋数量 | integer | 栋 | 计算 | - | - |
| `issues.indicatorCategoryCounts` | 各指标大类数量 | object | - | 计算 | - | - |
| `issues.issueCategoryCounts` | 各问题小类数量 | object | - | 计算 | - | - |
| `issues.communityRiskDistribution` | 每个小区的问题和风险分布 | array | - | 计算 | - | - |
| `issues.buildingRiskDistribution` | 每栋楼的问题和风险分布 | array | - | 计算 | - | - |
| `issues.withOriginalPhoto` | 有原图证据的问题数量 | integer | 个 | 计算 | - | - |
| `issues.withAnnotatedPhoto` | 有标注图证据的问题数量 | integer | 个 | 计算 | - | - |
| `issues.remediationCategories` | 整改建议分类去重结果 | array | - | 计算 | - | - |

问题统计口径：

- 只统计 `officialIssues`
- 按 `projectId` 严格过滤
- 驳回的候选问题不统计
- 同一正式问题按稳定 ID 去重

## 8. 社区/街区设施

| key | label | type | unit | source | missingPolicy | reportLabel |
|-----|-------|------|------|--------|---------------|-------------|
| `community.facilityCategoryCounts` | 各设施类别检索数量 | object | 个 | 项目社区/街区分析 | - | - |
| `community.facilityTotal` | 检索设施总数 | integer | 个 | 计算 | - | - |
| `community.categoriesWithResults` | 有结果的设施类别数量 | integer | 个 | 计算 | - | - |
| `community.facilityDensity` | 设施密度 | number | 个/km² | 计算 | not-computable | - |
| `community.searchRadius` | 搜索半径 | number | m | 分析记录 | - | - |
| `community.zeroResultCategories` | 零结果类别 | array | - | 计算 | - | - |
| `community.analysisConclusion` | 已保存的短板分析结论 | string | - | 分析记录 | omit-claim | - |

口径说明：

- 使用已经保存的检索结果和聚合结果
- 正文使用"本次检索识别到"或"项目分析范围内检索到"等准确口径
- 不将地图检索结果表述为行政统计部门的全量普查数据
- 零结果类别只作为本次检索发现，不直接表述为绝对缺失

## 9. 指标计算结果

| key | label | type | unit | source | missingPolicy | reportLabel |
|-----|-------|------|------|--------|---------------|-------------|
| `calculations.all` | 全部计算结果 | array | - | 计算引擎 | - | - |
| `calculations.snapshotId` | 计算快照ID | string | - | 保存 | - | - |

每个计算结果结构见计算引擎设计文档。计算结果按母版章节需要分组提供。

## 10. 项目图片

| key | label | type | source | missingPolicy | reportLabel |
|-----|-------|------|--------|---------------|-------------|
| `images.projectMap` | 项目范围地图 | image | 项目截图 | omit-claim | - |
| `images.issuePhotos` | 问题原图 | array | photoRecords | omit-claim | - |
| `images.annotatedMaps` | 标注图 | array | photoRecords | omit-claim | - |
| `images.technicalRouteMap` | 技术路线图 | image | 通用素材 | omit-claim | - |
| `images.genericDecorations` | 通用装饰图片 | array | 模板素材 | omit-claim | - |

缺失图片规则：

- 不阻塞正式导出
- Word 中省略图片和对应图注，正文自然补位
- 不得输出"图片缺失"占位文字
- 不得使用母版旧项目图片冒充当前项目材料

## 11. 来源追踪字段

| key | label | type | reportVisibility | allowInNarrative | allowInTable |
|-----|-------|------|------------------|------------------|--------------|
| `sourceIds.projectIds` | 项目编号列表 | array | internalOnly | false | false |
| `sourceIds.communityIds` | 小区编号列表 | array | internalOnly | false | false |
| `sourceIds.buildingIds` | 楼栋编号列表 | array | internalOnly | false | false |
| `sourceIds.photoIds` | 照片编号列表 | array | internalOnly | false | false |
| `sourceIds.analysisIds` | 分析批次编号列表 | array | internalOnly | false | false |
| `sourceIds.issueIds` | 正式问题编号列表 | array | internalOnly | false | false |
| `sourceIds.projectDataRecordIds` | 指标库记录编号列表 | array | internalOnly | false | false |
| `contextHash` | 上下文内容哈希 | string | internalOnly | false | false |
| `calculationSnapshotId` | 计算快照ID | string | internalOnly | false | false |

---

## 12. Word 模板内容类型映射

| 内容类型 | 说明 | LLM 调用 | 示例 |
|----------|------|----------|------|
| `fixed-text` | 确认可跨项目复用的制式内容 | 不调用 | 工作背景通用段落、工作原则、技术路线正文 |
| `field-text` | 直接使用项目字段替换 | 不调用 | 项目名称、行政区划、范围面积 |
| `calculated-text` | 由计算结果填充固定句式 | 不调用 | "共采集X栋居住建筑"、"涉及X个小区" |
| `generated-paragraph` | 用母版口径和允许事实调用 LLM | 调用 | 问题分析段落、治理建议段落 |
| `conditional-paragraph` | 根据计算结果选择正式句式 | 可调用 | 有/无问题时的不同表述 |
| `loop-table` | 按问题/小区/指标生成表格行 | 不调用 | 问题清单表、指标统计表 |
| `image-slot` | 项目地图、现场照片、标注图 | 不调用 | 各维度分析图、问题照片 |
| `caption` | 只在对应图片存在时生成 | 不调用 | 图题、表题 |
