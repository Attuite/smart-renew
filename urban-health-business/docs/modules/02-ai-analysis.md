# 02 AI智能识别模块开发大纲

> 阶段ID：`ai-analysis`  
> 上游：01资料上传与治理  
> 下游：03人工复核  
> 模块定位：使用真实照片创建可持久化、可恢复、可追溯的AI分析任务

## 1. 模块目标

对当前项目选定的真实照片执行视觉AI分析，生成独立的AnalysisCandidate候选问题，并提供真实进度、风险分布、平均置信度、失败照片和模型版本。

## 2. 非目标

- AI候选不直接成为正式问题；
- 不用固定43项候选代替失败结果；
- 不在浏览器中长期保存大批Base64图片；
- 不由前端决定最终问题类型和严重程度；
- 不把模型输出覆盖原始照片；
- 不在本模块生成正式项目统计。

## 3. 用户角色

- AI分析操作人员；
- 项目负责人；
- 复核人员；
- 只读查看人员。

## 4. 前置条件

- 已选择Project；
- 至少有一张可分析Photo；
- Photo可以通过ID被后端读取；
- AI能力通过 `/api/meta` 报告为可用；
- 阶段01没有阻塞级错误；
- 已知当前模型和提示词配置。

## 5. 完整用户流程

```text
进入AI工作台
→ 查看可分析照片
→ 选择全部或部分照片
→ 查看模型和分析范围
→ 创建AnalysisJob
→ 后端读取照片并调用模型
→ 前端查询任务进度
→ 显示逐照片成功/失败
→ 后端保存AnalysisCandidate
→ 查看候选问题和动态统计
→ 将完成任务交给03人工复核
```

失败恢复：

```text
部分照片失败
→ 查看失败原因
→ 只重试失败照片
→ 合并到同一运行版本或生成新运行
→ 保留原始失败日志
```

## 6. 页面与组件

### 6.1 分析准备

- 可分析照片数量；
- 已分析/未分析；
- 照片选择；
- 模型状态；
- 提示词版本；
- 分析配置；
- 预计任务规模；
- 创建任务。

### 6.2 任务监控

- queued/running状态；
- 当前步骤；
- 已处理/总数；
- 失败数；
- 百分比；
- 取消和重试；
- 上游服务状态。

### 6.3 识别结果

- 照片列表；
- 候选问题框选；
- 问题类型；
- 风险初判；
- 置信度；
- 分类命中状态；
- 建议指标；
- 模型说明；
- 进入人工复核。

### 6.4 历史分析

- 分析版本；
- 创建时间；
- 模型；
- 照片集合；
- 候选数量；
- 失败情况；
- archived/stale状态。

## 7. 输入数据

- Project；
- Photo列表；
- photoIds；
- 照片存储引用；
- 标准问题类型库；
- AI服务能力；
- 模型配置；
- 可选项目、小区和楼栋上下文。

## 8. 输出数据

- AnalysisJob；
- AnalysisCandidate；
- AI原始响应引用；
- 分析统计；
- 失败照片；
- 模型和提示词版本；
- 输入快照；
- 供03使用的候选列表。

## 9. 状态机

AnalysisJob：

```text
queued
running
completed
failed
canceled
finalizing
archived
stale
```

AnalysisCandidate：

```text
pending
confirmed
modified
excluded
```

分类状态：

```text
matched
review
unclassified
```

分类状态与人工复核状态必须分开。

## 10. 数据模型

使用：

- AnalysisJob；
- AnalysisCandidate；
- Photo；
- AnalysisInputSnapshot；
- AIModelMetadata；
- AnalysisFailure。

候选至少保存：

- candidateId；
- analysisId；
- photoId；
- 原始模型输出；
- bbox；
- 置信度；
- 建议问题类型；
- 分类命中；
- reviewStatus；
- officialIssueId。

## 11. 前端服务

```text
analysisApi.create(projectId, payload)
analysisApi.get(analysisId)
analysisApi.list(projectId, query)
analysisApi.listCandidates(analysisId, query)
analysisApi.retry(analysisId, failedPhotoIds)
analysisApi.cancel(analysisId)
analysisApi.getSummary(analysisId)
```

前端API层负责轮询，不允许各组件各自创建轮询定时器。

## 12. 后端服务

- 分析任务创建；
- 输入快照；
- 照片读取；
- AI请求；
- 结果验证和标准化；
- 问题分类匹配；
- 候选独立存储；
- 进度和失败记录；
- 重试和取消；
- 工作流刷新。

## 13. 目标API

```http
POST /api/projects/{projectId}/analyses
GET  /api/projects/{projectId}/analyses
GET  /api/analyses/{analysisId}
GET  /api/analyses/{analysisId}/candidates
GET  /api/analyses/{analysisId}/summary
POST /api/analyses/{analysisId}/retry
POST /api/analyses/{analysisId}/cancel
```

创建任务接受 `Idempotency-Key`。

## 14. 旧smart-renew复用

复用审计等级A/B：

- `/api/vision/analyze`；
- `/api/analysis-records`；
- 原分析结果；
- 千问视觉模型配置；
- 图片压缩；
- 每20张拆批和跨批合并；
- BBox IoU、标题归一化和候选去重；
- 候选分类与字段规范化；
- `model`、`requestId`、`usage`和`promptVersion`元数据；
- 照片存储。

已落地的适配：

- 把同步调用包装为AnalysisJob；
- 把内嵌 `result.issues` 拆为AnalysisCandidate；
- 分析任务状态持久化；
- 统计从候选聚合；
- 模型失败不得回退浏览器本地Demo；
- Business任务只传 `photoId`，服务端从原smart-renew照片存储取图；Base64仅存在于BFF到旧视觉接口的内部适配链路。

当前Business已经完成20张以内任务编排以及类别、BBox和置信度规范化。本次A/B复用只补超过20张自动拆批、跨批合并、IoU去重和批次元数据，并对现有规范化做源行为回归；原固定问题—指标映射和浏览器模型直连不复用。

## 15. V9.1迁移内容

迁移：

- AI工作台视觉；
- 左侧照片、中央图像、右侧候选详情布局；
- 框选视觉；
- 任务进度；
- 风险筛选；
- 候选问题切换；
- 下一阶段入口。

## 16. 必须剥离的Demo内容

- 固定6张识别图片；
- 固定43个候选；
- 固定6/18/19风险；
- 固定92.6%置信度；
- 固定7项重点；
- 固定1秒/照片动画；
- 固定AI-XA编号；
- 自动演示完成事件；
- 固定问题框坐标。

## 17. 空、失败和恢复

| 场景 | 行为 |
|---|---|
| 无照片 | 显示返回01上传入口 |
| AI未配置 | 状态unavailable，不显示结果 |
| 任务排队 | 显示queued |
| 部分照片失败 | 展示成功结果和失败清单 |
| 全部失败 | 任务failed，可重试 |
| 返回结构错误 | 保存原始错误，不生成候选 |
| 页面刷新 | 按analysisId恢复任务 |
| 上游照片变化 | 旧任务stale |
| 未分类问题 | 保存unclassified，交人工复核 |

## 18. 跨模块依赖

依赖01：

- Photo和storageRef；
- collection状态；
- 项目/空间上下文。

输出给03：

- AnalysisCandidate；
- 原始照片；
- bbox；
- 模型元数据；
- 任务版本。

输出给06：

- 分析运行元数据，不直接输出正式问题。

## 19. 数据一致性与幂等

- 相同幂等键不创建重复任务；
- 每个候选有稳定ID；
- 原始模型输出不可被人工复核覆盖；
- 重试必须记录父运行或重试关系；
- 候选统计由后端聚合；
- 新照片使旧分析stale但不删除；
- 已归档任务不可无记录重写。

## 20. 测试

### 20.1 单元测试

- AI结果Schema校验；
- 候选标准化；
- 平均置信度；
- 风险聚合；
- 分类状态；
- 任务进度。

### 20.2 契约测试

- 创建任务202；
- 幂等；
- 查询任务；
- 候选分页；
- AI不可用；
- 部分失败；
- 重试；
- 取消。

### 20.3 E2E

- 真实照片创建任务；
- 查看运行中进度；
- 获得候选；
- 页面刷新恢复；
- 部分失败重试；
- 进入03；
- Business产物不含固定示例图片和固定43项。

## 21. 验收标准

1. 分析任务持久化；
2. 候选独立保存；
3. 候选与真实photoId关联；
4. 风险和置信度动态计算；
5. AI不可用时不返回Demo；
6. 刷新后可恢复；
7. 失败照片可重试；
8. 原始输出可追溯；
9. 03可读取候选；
10. 工作流状态准确。

当前Business任务已保存照片内容哈希、治理修订、空间归属和坐标快照。照片被停用或治理修订变化后，任务查询与工作流派生为 `stale`；尚未归档的候选在重新分析前不能继续复核。

## 22. 当前缺失能力

当前已完成Candidate字段修订、逐条revision、审计和任务证据stale，不再列为缺失。

本次A/B复用接入项：

- 超过20张时按每20张自动拆批和跨批结果合并；
- 原BBox IoU和标题归一化去重；
- 现有候选分类、BBox和字段规范化与原算法的行为对照；
- 跨批模型请求元数据；
- 原模型配置白名单。

C/D后续项：

- 独立后台执行进程、多实例租约与任务抢占；
- 运行中模型请求取消；
- 单照片部分失败重试；
- Candidate服务端分页和完整版本查询；
- 原始模型响应独立归档；
- 正式模型/提示词版本仓储；
- 跨项目和版本变化的完整stale传播。

## 23. 当前接口与依据

- `docs/api/business-bff-api.md`；
- `docs/data-model/business-data-model.md`；
- `docs/original-smart-renew-reuse-audit.md`；
- `docs/reuse-first-ab-development-outline.md`。

## 24. 本次A/B开发任务

- 抽取超过20张的拆批、结果合并和候选去重为服务端纯函数；
- 去除抽取逻辑中的旧指标强制映射；
- 将每批状态和模型元数据写入AnalysisJob；
- 建立源行为回归测试；
- 完成多批成功、批次失败、重复候选和上游不可用契约测试。

现有AnalysisJob、Candidate仓储、20张以内执行链路、结果规范化、风险统计和stale传播不重新实现。
