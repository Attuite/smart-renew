# 06 报告编辑、生成与归档模块开发大纲

> 阶段ID：`reports`  
> 上游：01—05全部业务数据  
> 模块定位：使用固定输入快照生成可审查、可追溯、可版本化的报告草稿和交付物

## 1. 模块目标

建立综合体检报告、专项体检报告和空间问题分析报告的真实数据编辑、校验、快照、生成、版本和导出能力。

报告必须引用真实项目、正式问题、空间分析和指标运行，或明确记录缺失模块。

## 2. 非目标

- 不引用V9.1固定页数和固定统计作为业务结果；
- 不把浏览器页面状态直接当成报告快照；
- 不在指标缺失时生成假综合分；
- 不声称Word兼容HTML为原生DOCX；
- 不声称浏览器打印等于服务端PDF；
- 不覆盖历史报告版本；
- 不让报告读取AI候选作为正式问题。

## 3. 用户角色

- 报告编制人员；
- 项目负责人；
- 专业审核人员；
- 只读查看人员；
- 后续正式发布人员。

## 4. 前置条件

草稿：

- 已选择Project；
- 至少存在可用项目数据；
- 报告模板可加载。

正式报告：

- 所有模板规定的必填输入完整；
- OfficialIssue、SpatialAnalysisRun、IndicatorRun状态满足模板要求；
- 没有阻塞级stale；
- 报告引擎可用。

## 5. 完整用户流程

```text
进入报告工作台
→ 选择报告类型和模板
→ 创建/加载草稿
→ 加载真实数据摘要
→ 配置章节和页面组件
→ 编辑允许编辑的文案
→ 查看证据引用
→ 运行校验
→ 创建ReportSnapshot
→ 创建生成任务
→ 生成HTML/PDF/清单
→ 查看版本和交付物
→ 上游变化后标记旧报告stale
```

指标未接入：

```text
加载草稿
→ 标记指标模块缺失
→ 指标章节显示待接入
→ 允许不完整草稿
→ 禁止标记正式报告
```

## 6. 页面与组件

### 6.1 报告列表

- 报告类型；
- 版本；
- 状态；
- 完整度；
- 生成时间；
- 生成人员；
- stale提示；
- 交付物。

### 6.2 报告配置

- 模板；
- 报告元信息；
- 专项主题；
- 章节启用；
- 章节排序；
- 页面布局；
- 组件开关；
- 必选项锁定。

### 6.3 报告编辑

- 允许编辑的文案；
- 数据字段只读；
- 来源；
- 证据；
- 图表和地图快照；
- 变更统计；
- 恢复模板。

### 6.4 校验

- 缺失输入；
- 模块不可用；
- stale输入；
- 引用失效；
- 溢出；
- 必选章节；
- 交付物要求。

### 6.5 预览和生成

- 页面预览；
- 生成进度；
- 当前步骤；
- 失败原因；
- 版本；
- HTML/PDF/清单下载。

## 7. 输入数据

- Project及revision；
- collection snapshot/summary；
- AnalysisJob元数据；
- OfficialIssue及revision；
- SpatialBinding；
- SpatialAnalysisRun；
- IndicatorRun或缺失状态；
- 标准库版本；
- ReportTemplate；
- 编辑草稿；
- 生成人员。

## 8. 输出数据

- ReportDraft；
- ReportValidationResult；
- ReportSnapshot；
- ReportGenerationJob；
- ReportArtifact；
- 报告版本；
- 证据清单；
- 工作流更新。

## 9. 状态机

草稿：

```text
editing
validating
ready
incomplete
invalid
```

ReportSnapshot：

```text
draft
generating
generated
failed
stale
archived
```

Artifact：

```text
pending
generating
ready
failed
expired
```

## 10. 数据模型

使用：

- ReportTemplate；
- ReportDraft；
- ReportValidationResult；
- ReportSnapshot；
- ReportGenerationJob；
- ReportArtifact；
- EvidenceRef。

ReportSnapshot至少固定：

- projectRevision；
- collectionSnapshotId；
- analysisIds；
- OfficialIssue revisions；
- SpatialAnalysisRun IDs；
- IndicatorRun ID或缺失；
- 标准库版本；
- 模板版本；
- 草稿revision；
- 生成人员和时间。

## 11. 前端服务

```text
reportApi.list(projectId, query)
reportApi.createDraft(projectId, payload)
reportApi.get(reportId)
reportApi.patchDraft(reportId, revision, changes)
reportApi.validate(reportId)
reportApi.createSnapshot(reportId, idempotencyKey)
reportApi.generate(reportId, idempotencyKey)
reportApi.getGeneration(jobId)
reportApi.listArtifacts(reportId)
reportApi.getDownload(artifactId)
```

## 12. 后端服务

- 模板管理；
- 草稿保存；
- 数据聚合；
- 输入快照；
- 校验；
- 证据索引；
- HTML渲染；
- PDF生成适配；
- 交付物存储；
- 版本号；
- stale传播；
- 工作流刷新。

## 13. 目标API

```http
GET   /api/projects/{projectId}/reports
POST  /api/projects/{projectId}/reports
GET   /api/reports/{reportId}
PATCH /api/reports/{reportId}
POST  /api/reports/{reportId}/validate
POST  /api/reports/{reportId}/snapshots
POST  /api/reports/{reportId}/generate
GET   /api/report-generation-jobs/{jobId}
GET   /api/reports/{reportId}/artifacts
GET   /api/report-artifacts/{artifactId}/download
```

创建快照和生成接受幂等键。

## 14. 旧smart-renew复用

复用审计等级A/B：

- report-snapshot-core；
- `/api/reports/generate`；
- 来源ID快照，以及与Business现有报告版本递增算法的行为对照；
- project-data报告引用；
- 动态项目报告数据；
- 项目概况、AI问题、社区/街区、综合研判、行动建议和附件章节；
- 风险统计、表格和标注照片画廊。

当前不足：

- 缺正式服务端PDF；
- 模板和数据耦合；
- 报告页面会加载完整22MB PDF；
- 版本并发可能竞争；
- 指标引擎未接入；
- 报告正式/不完整状态需分离。

Business ReportRepository继续作为新报告唯一主写入。原`/api/reports/generate`和旧快照只用于只读兼容、基础算法参考或显式迁移，不与Business并行生成新报告。

## 15. V9.1迁移内容

迁移：

- 报告工作台布局；
- 三类报告选择；
- 模板页预览；
- 章节编辑；
- 页面排序；
- 组件开关；
- 草稿校验；
- 生成步骤；
- 报告快照；
- 交付物列表；
- 打印/HTML导出作为过渡能力。

## 16. 必须剥离的Demo内容

- 固定8/5/6页作为真实报告页数；
- 固定3类报告统计；
- 固定42问题；
- 固定6/18/18风险；
- 固定78/84/82.4；
- 固定3项未达标；
- 固定RPT内容；
- 固定西仪厂项目；
- 固定证据链；
- 固定报告生成时间动画。

模板可以保留布局概念，但不得保留业务结果。

## 17. 空、失败和恢复

| 场景 | 行为 |
|---|---|
| 无正式问题 | 报告显示0问题正式结论 |
| 指标未接入 | 允许incomplete草稿，禁止正式 |
| GIS缺失 | 按模板规则警告或阻塞 |
| 模板缺失 | blocked |
| 校验失败 | 不创建正式快照 |
| 生成超时 | 按jobId恢复，不重复生成 |
| PDF服务不可用 | HTML可用时明确部分能力 |
| 上游变化 | 旧报告stale |
| 页面刷新 | 从ReportDraft和Job恢复 |

## 18. 跨模块依赖

依赖：

- 00 Project和workflow；
- 01资料summary；
- 02分析运行元数据；
- 03 OfficialIssue；
- 04 SpatialAnalysisRun；
- 05 IndicatorRun或缺失状态。

报告不得反向修改上游业务对象。

## 19. 数据一致性与幂等

- Snapshot不可变；
- Draft使用revision；
- 创建Snapshot幂等；
- 生成Job幂等；
- 版本号由后端生成；
- 报告统计来自快照；
- 旧Artifact不被覆盖；
- 上游变化只标记stale；
- 不完整草稿不得冒充正式报告。

## 20. 测试

### 20.1 单元测试

- 模板校验；
- 输入完整度；
- stale判断；
- 版本；
- 证据引用；
- 缺失指标；
- 0问题报告。

### 20.2 契约测试

- 创建草稿；
- PATCH冲突；
- validate；
- snapshot幂等；
- generate异步；
- Artifact未就绪；
- PDF不可用；
- stale。

### 20.3 E2E

- 使用真实项目生成草稿；
- 编辑章节；
- 创建快照；
- 导出HTML；
- PDF服务可用时导出PDF；
- 指标缺失阻止正式；
- 上游修改导致stale；
- 0正式问题报告；
- 不出现V9.1固定结果。

## 21. 验收标准

1. 报告使用真实快照；
2. 正式问题统计一致；
3. 指标缺失如实呈现；
4. 版本由后端生成；
5. 生成任务可恢复；
6. 交付物可追溯；
7. 上游变化标记stale；
8. 支持0问题报告；
9. 不含固定V9.1结果；
10. 工作流正确更新。

当前Business报告快照已覆盖项目修订、正式问题修订、空间分析引用和照片治理修订。照片集合、状态或治理修订变化后旧版本派生为 `stale`；生成新版本后以最新有效版本决定阶段06状态，旧版本仍保留过期原因。

当前Business还提供同项目两版本结构化比较，覆盖编辑内容、统计口径、正式问题集合、空间分析集合和照片证据修订；比较结果只读，不反向修改报告。

原smart-renew报告快照已支持显式迁入Business版本序列。迁移版本完整保存原快照和来源指纹，状态为`migrated_read_only`，不可通过Business报告PATCH修改；旧指标统计仅作为原始快照留存，不进入当前指标结果。

## 22. 当前缺失能力

当前Business已实现快照、内容编辑、修订审计、版本比较、stale、JSON下载和打印过渡，不再把“迁移报告工作台、真实数据绑定、校验和快照”列为未开始。

本次A/B复用接入已完成：

- 原报告来源快照适配和现有版本算法行为对照；
- 动态真实数据章节与固定章节索引；
- 风险统计、问题/小区表格、标注照片画廊和来源索引；
- ProjectData报告引用；
- 已完成原报告快照只读迁移。

C/D后续项：

- ReportTemplate正式模型；
- 自由章节编排；
- 图表快照服务；
- 服务端PDF和Artifact存储；
- 审批、签发、发布和分享；
- 指标引擎结果章节。

地图快照已接入：报告可生成确定性SVG地图对象，快照读取该报告版本冻结的项目边界、正式
问题和空间分析输入，保存内容哈希与源修订并回写报告引用。失败任务可重试；历史报告地图
不会随当前项目变化而重写。生成使用可恢复后台Runner：POST返回`queued`，工作进程按有界并发执行，
服务重启后继续未完成任务，前端轮询到终态。

## 23. 当前接口与依据

- `docs/api/business-bff-api.md`；
- `docs/api/workflow-api.md`；
- `docs/data-model/business-data-model.md`；
- `docs/original-smart-renew-reuse-audit.md`；
- `docs/reuse-first-ab-development-outline.md`。

## 24. 本次A/B开发任务

- 已选择性抽取原report-snapshot-core中Business尚缺的来源适配算法；
- 已抽取动态报告章节Renderer和图文组件；
- 已将Renderer接入Business报告快照；
- 已建立旧报告只读迁移适配；
- 保留Business修订、比较、stale和不完整草稿；
- 完成真实数据、旧版本迁移、指标缺失和无双写测试。

Business ReportRepository、快照、版本递增、修订、比较、stale、JSON下载和打印页不重新实现。
