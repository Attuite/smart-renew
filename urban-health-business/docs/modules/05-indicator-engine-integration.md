# 05 指标核算与引擎接入模块开发大纲

> 阶段ID：`indicators`  
> 上游：项目资料、正式问题、GIS空间分析  
> 下游：06报告  
> 当前策略：完成业务工作台、输入准备、接口契约和待接入说明，不实现无依据评分

## 1. 模块目标

建立指标标准库浏览、项目指标输入准备、缺失数据检查、指标引擎能力查询、运行提交、结果展示和证据追溯的完整接入边界。

在外部指标引擎完成前，本模块必须如实显示 `unavailable`，不得沿用V9.1固定公式或分数。

## 2. 非目标

- 不自行编造61个指标的权重和阈值；
- 不把标准库当成计算引擎；
- 不输出固定78、84、82.4；
- 不使用V9.1固定10指标；
- 不在浏览器完成正式评分；
- 不在引擎缺失时将阶段标记completed；
- 不阻塞01—04真实业务能力开发。

## 3. 用户角色

- 指标业务人员；
- 项目负责人；
- 数据整理人员；
- 报告人员；
- 引擎开发/接入人员；
- 只读审核人员。

## 4. 前置条件

接口占位阶段：

- 标准库可读取；
- Project可读取；
- OfficialIssue和SpatialAnalysisRun可读取；
- 引擎能力接口存在，即使返回ready=false。

正式运行阶段：

- 指标引擎ready；
- 标准库版本兼容；
- 输入快照可以创建；
- 必填数据达到引擎要求。

## 5. 完整用户流程

引擎未接入：

```text
进入指标工作台
→ 查询标准库和引擎能力
→ 显示61个指标定义
→ 汇总项目已有输入
→ 标记可准备/缺失/待外部数据
→ 显示接口待接入说明
→ 不生成运行和分数
```

引擎接入后：

```text
检查输入完整度
→ 选择计算方案/引擎版本
→ 创建IndicatorRun
→ 查询运行进度
→ 获取IndicatorResult
→ 展示值、阈值、判定、得分和证据
→ 固化运行版本
→ 提供给报告
```

## 6. 页面与组件

### 6.1 引擎状态

- ready；
- 引擎版本；
- 支持维度；
- 标准库版本；
- 未接入原因；
- 接口文档。

### 6.2 指标标准库

- 住房、小区、街区、城市；
- 体检要素；
- 指标名称；
- 单位；
- 核心标记；
- 方向；
- 数据来源类型；
- 当前阈值和权重是否定义。

### 6.3 数据准备

- 已有项目数据；
- 正式问题映射；
- GIS结果；
- 外业/统计数据；
- 可计算指标；
- 缺失输入；
- 数据版本。

### 6.4 运行和结果

- 任务状态；
- 运行版本；
- 单项指标值；
- 阈值；
- 达标判定；
- 得分；
- 证据引用；
- 缺失原因；
- 综合结果（允许无）。

### 6.5 追溯

```text
资料/照片
→ 候选
→ 复核
→ 正式问题
→ GIS
→ 指标结果
```

## 7. 输入数据

- CITY_HEALTH_STANDARD_LIBRARY；
- Project；
- FieldRecord；
- OfficialIssue；
- SpatialAnalysisRun；
- 其他统计数据；
- IndicatorEngineCapability；
- 指标计算方案。

## 8. 输出数据

引擎未接入：

- IndicatorReadiness；
- MissingInput；
- Capability；
- 标准库浏览结果。

引擎接入后：

- IndicatorInputSnapshot；
- IndicatorRun；
- IndicatorResult；
- result summary；
- 报告引用。

## 9. 状态机

能力：

```text
unknown
ready
unavailable
incompatible
```

IndicatorRun：

```text
queued
running
completed
failed
canceled
stale
unavailable
```

指标数据准备：

```text
missing
partial
ready
not_applicable
```

## 10. 数据模型

使用：

- StandardIndicator；
- IndicatorEngineCapability；
- IndicatorReadiness；
- IndicatorInputSnapshot；
- IndicatorRun；
- IndicatorResult；
- CalculationScheme。

IndicatorResult允许：

```json
{
  "value": null,
  "threshold": null,
  "assessment": "pending",
  "score": null,
  "evidenceRefs": [],
  "missingInputs": []
}
```

需要由外部引擎人员确认：

- CalculationScheme；
- 权重层级；
- 归一化；
- 缺失值；
- 汇总；
- 不适用处理；
- 精度和取整。

## 11. 前端服务

```text
standardApi.listIndicators(query)
standardApi.getIndicator(code)
indicatorApi.getCapabilities()
indicatorApi.getReadiness(projectId)
indicatorApi.createRun(projectId, payload)
indicatorApi.getRun(runId)
indicatorApi.listResults(runId, query)
indicatorApi.cancel(runId)
```

前端不得实现正式评分公式。

## 12. 后端服务

当前：

- 标准库读取；
- readiness聚合；
- capability接口；
- 未接入错误；
- 输入快照契约。

引擎接入后：

- 输入转换；
- 引擎调用；
- 运行任务；
- 结果Schema校验；
- 版本保存；
- stale传播；
- 报告引用。

## 13. 目标API

```http
GET  /api/indicator-engine/capabilities
GET  /api/standards/indicators
GET  /api/standards/indicators/{indicatorCode}
GET  /api/projects/{projectId}/indicator-readiness
POST /api/projects/{projectId}/indicator-runs
GET  /api/projects/{projectId}/indicator-runs
GET  /api/indicator-runs/{runId}
GET  /api/indicator-runs/{runId}/results
POST /api/indicator-runs/{runId}/cancel
```

未接入时：

- capabilities返回200、ready=false；
- createRun返回503 `INDICATOR_ENGINE_UNAVAILABLE`。

## 14. 旧smart-renew复用

复用审计等级A/B：

- 412条标准库记录；
- 61个指标；
- 4维度和14要素；
- 35个问题分类和124个问题类型；
- 124条整治建议；
- severity规则和码表；
- `project-data-core`统一索引和指标结果类型；
- JSON和SQLite导入导出；
- 部分住宅台账指标展示。

当前不足：

- 61个指标权重全部为null；
- 61个指标达标阈值全部为null；
- 61个指标计算公式全部为空；
- 没有通用计算运行；
- 没有输入快照；
- 没有引擎版本；
- 没有正式综合得分依据。

因此，本次A/B开发只接入只读标准目录、ProjectData索引和输入准备，不实现或推测评分。

## 15. V9.1迁移内容

迁移：

- 指标工作台布局；
- 指标分类和列表；
- 指标详情；
- 证据追溯；
- 权重/阈值信息展示形式；
- 基线与运行版本对比视觉；
- 完成汇总布局。

情景模拟是否保留，必须在真实引擎支持后单独定义。

## 16. 必须剥离的Demo内容

- 固定10指标；
- IND-BS/IND-CE演示编号；
- 固定映射；
- 固定问题贡献；
- 固定权重；
- 固定阈值80；
- 固定77.55/84.45；
- 固定82.4；
- 固定82.7模拟结果；
- 固定3项未达标；
- 固定公式和取整。

## 17. 空、失败和恢复

| 场景 | 行为 |
|---|---|
| 引擎未接入 | unavailable，显示接口说明 |
| 标准库可用但数据缺失 | 显示readiness，不生成分数 |
| 标准库失败 | 模块failed或unavailable |
| 版本不兼容 | blocked/incompatible |
| 运行中 | 恢复runId和进度 |
| 部分指标无结果 | 明确missing/not_applicable |
| 运行失败 | 保留输入快照，可重试 |
| 上游变化 | 旧运行stale |
| overallScore为空 | 正常展示“未提供综合分” |

## 18. 跨模块依赖

上游：

- 01资料和外业输入；
- 03 OfficialIssue；
- 04 SpatialAnalysisRun；
- 标准库。

下游：

- 06引用IndicatorRun或明确缺失状态。

上游变化必须使对应运行stale。

## 19. 数据一致性与幂等

- 创建Run使用幂等键；
- 输入Snapshot不可变；
- 结果关联engineVersion和standardLibraryVersion；
- 结果不覆盖旧运行；
- 前端不二次计算正式结果；
- score为null不转换为0；
- summary为null不显示Demo总结。

## 20. 测试

### 20.1 当前占位测试

- capabilities ready=false；
- 标准库61指标；
- readiness；
- createRun返回503；
- 页面不显示固定分数；
- 报告识别指标缺失。

### 20.2 引擎接入契约测试

- createRun 202；
- 任务查询；
- 结果Schema；
- null阈值和score；
- 版本不兼容；
- 幂等；
- stale。

### 20.3 E2E

- 未接入状态完整显示；
- 接入测试引擎后创建运行；
- 查看结果和证据；
- 上游修改使结果stale；
- 报告引用正确runId。

## 21. 验收标准

当前接口占位验收：

1. V9.1固定指标全部剥离；
2. 真实标准库可查询；
3. readiness可展示；
4. capabilities存在；
5. 未接入状态明确；
6. createRun不返回假结果；
7. 报告可以识别指标缺失；
8. 接口文档足够外部人员实现；
9. 结果模型允许null；
10. 工作流返回unavailable。

正式引擎验收由后续接入大纲补充。

## 22. 当前缺失能力

本次A/B复用接入项：

- 412条标准库查询；
- 61个指标目录；
- 问题分类、问题类型、严重度和状态字典；
- 124条整改建议只读目录；
- ProjectData索引；
- JSON和SQLite指标数据交换；
- 指标输入准备的数据来源说明。

C/D及外部模块：

- 指标计算引擎；
- 计算方案；
- 权重和阈值；
- 归一化；
- 缺失值规则；
- 综合评分；
- 正式IndicatorInputSnapshot；
- 通用readiness规则服务；
- IndicatorRun和Result；
- 引擎版本兼容。

## 23. 当前接口与依据

- `docs/api/business-bff-api.md`；
- `docs/api/workflow-api.md`；
- `docs/data-model/business-data-model.md`；
- `docs/original-smart-renew-reuse-audit.md`；
- `docs/reuse-first-ab-development-outline.md`。

## 24. 本次A/B开发任务

- 建立标准库查询适配；
- 接入ProjectData查询和JSON/SQLite交换；
- 建立指标与整改建议只读目录；
- 迁移指标目录和输入准备界面，但不迁移公式；
- 保持引擎`unavailable`和报告指标缺失状态；
- 完成目录、输入来源、空值和禁止生成分数测试。

正式readiness、Run、Result和评分仍由外部指标引擎接入大纲负责。
