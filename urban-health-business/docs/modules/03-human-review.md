# 03 人工复核模块开发大纲

> 阶段ID：`human-review`  
> 上游：02 AI智能识别  
> 下游：04 GIS、05指标、06报告  
> 模块定位：将AI候选经人工确认转化为正式问题的唯一入口

## 1. 模块目标

允许专业人员对每条AnalysisCandidate进行确认、修改、排除和补录，保留完整复核轨迹，并通过后端幂等归档生成OfficialIssue。

## 2. 非目标

- 不覆盖AI原始输出；
- 不让候选问题直接进入正式统计；
- 不在前端多步拼接正式归档；
- 不要求所有问题都必须保留；
- 不在本模块计算指标；
- 不伪造固定42项有效问题。

## 3. 用户角色

- 人工复核人员；
- 专业审核人员；
- 项目负责人；
- 只读审计人员。

## 4. 前置条件

- 已选择Project；
- 存在可复核AnalysisJob；
- AnalysisCandidate已持久化；
- 原始Photo可访问；
- 问题类型标准库可查询；
- 当前复核人员信息可获得。

## 5. 完整用户流程

```text
选择分析任务
→ 查看候选问题队列
→ 查看原图、AI框和模型结论
→ 确认/修改/排除
→ 填写说明和必要字段
→ 保存ReviewAction
→ 继续下一条
→ 检查待复核项
→ 补录漏报（可选）
→ 正式归档
→ 后端生成OfficialIssue
→ 进入GIS
```

重新打开：

```text
查看已归档问题
→ 有权限时重新打开候选
→ 保存新的复核动作
→ 原正式问题进入修订或作废流程
```

## 6. 页面与组件

### 6.1 复核任务列表

- 待复核；
- 已确认；
- 已修改；
- 已排除；
- 未分类；
- 风险和类型筛选；
- 照片筛选；
- 批量操作。

### 6.2 影像核验

- 原始照片；
- AI框；
- 缩放；
- 多图证据；
- 模型原始结论；
- 置信度；
- 照片位置。

### 6.3 复核表单

- 结论；
- 问题类型；
- 严重程度；
- 描述；
- 测量值；
- 建议指标；
- 位置修正提示；
- 复核说明；
- 保存。

### 6.4 追溯与日志

- AI前值；
- 人工后值；
- 操作人员；
- 时间；
- 修改原因；
- 后续OfficialIssue引用。

### 6.5 正式归档

- 待复核校验；
- 已保留/排除/补录统计；
- 归档人员；
- 幂等提交；
- 归档结果；
- 失败恢复。

## 7. 输入数据

- AnalysisJob；
- AnalysisCandidate；
- Photo；
- 问题类型库；
- 严重程度规则；
- 项目、小区和楼栋上下文；
- 既有ReviewAction。

## 8. 输出数据

- ReviewAction；
- 候选reviewStatus；
- 补录候选；
- OfficialIssue；
- 标注照片引用；
- 正式归档结果；
- 复核summary；
- 工作流更新。

## 9. 状态机

候选复核：

```text
pending
confirmed
modified
excluded
```

归档：

```text
not_ready
ready
finalizing
archived
failed
stale
```

已归档候选重新修改必须进入明确的reopen/revision流程。

## 10. 数据模型

使用：

- AnalysisCandidate；
- ReviewAction；
- OfficialIssue；
- Photo；
- ReviewSummary；
- FinalizationOperation；
- EvidenceRef。

ReviewAction必须保存：

- before；
- after；
- action；
- reviewer；
- reviewedAt；
- note。

OfficialIssue保留candidateId和analysisId。

## 11. 前端服务

```text
reviewApi.listCandidates(analysisId, query)
reviewApi.getCandidate(candidateId)
reviewApi.patchCandidate(candidateId, revision, decision)
reviewApi.supplement(analysisId, payload)
reviewApi.getSummary(analysisId)
reviewApi.finalize(analysisId, payload, idempotencyKey)
issueApi.get(issueId)
```

前端不能在finalize后自行创建OfficialIssue。

## 12. 后端服务

- 复核校验；
- ReviewAction写入；
- 候选状态更新；
- 补录；
- 标注图登记；
- 正式归档编排；
- OfficialIssue生成；
- 幂等和失败恢复；
- 工作流和项目汇总刷新。

## 13. 目标API

```http
GET   /api/analyses/{analysisId}/candidates
GET   /api/analysis-candidates/{candidateId}
PATCH /api/analysis-candidates/{candidateId}/review
POST  /api/analyses/{analysisId}/candidates
GET   /api/analyses/{analysisId}/review-summary
POST  /api/analyses/{analysisId}/finalize
GET   /api/finalization-operations/{operationId}
```

finalize接受：

```http
Idempotency-Key
```

## 14. 旧smart-renew复用

原smart-renew已经具备基本完整的人工复核，不再视为“原版缺失模块”。

复用审计等级A/B：

- 当前人工确认交互逻辑；
- 接受、驳回、修改、风险筛选和全部接受；
- BBox百分比显示；
- Canvas标注图派生；
- 标注图片归档；
- 分析记录状态；
- 正式问题列表和项目数据索引。

必须改造的边界：

- 当前归档由前端多步串联；
- 当前候选内嵌在分析记录；
- saveRecord失败存在浏览器降级；
- 正式归档可能留下`finalizing`半状态；
- 候选和正式统计口径需分离。

Business Candidate、ReviewSession和OfficialIssue继续作为主数据源。原`/api/issues/finalize`和`official-issue-core`强制旧指标映射，只用于旧数据读取、迁移验证和选择性算法参考，不作为Business新正式问题主写入。

## 15. V9.1迁移内容

迁移：

- 人工复核工作台布局；
- 候选任务列表；
- 影像核验；
- 决策操作区；
- 复核进度；
- 追溯链；
- 完成汇总；
- 下一阶段入口。

## 16. 必须剥离的Demo内容

- 固定43/43；
- 固定42有效问题；
- 固定1项排除；
- 固定7项重点任务；
- 固定DEF编号；
- 固定操作人员和时间；
- 固定6/18/18结果；
- 自动演示快速确认；
- 固定追溯链；
- Demo预置完成状态。

## 17. 空、失败和恢复

| 场景 | 行为 |
|---|---|
| 无候选 | 返回02，显示真实空状态 |
| 未分类候选 | 允许人工选择或登记待收录 |
| 保存冲突 | 返回409，重新加载候选 |
| 部分复核 | 保存进度，刷新可恢复 |
| 仍有pending | 禁止正式归档 |
| 全部排除 | 允许形成0正式问题的有效归档结果 |
| finalize超时 | 用幂等键查询原操作，不重复生成 |
| 标注图失败 | 正式归档保持可恢复状态 |
| 上游分析变化 | 当前复核stale |

“全部排除”是合法业务结果，不应强制至少确认一个问题。

## 18. 跨模块依赖

上游02提供：

- 候选；
- 原始照片；
- AI元数据。

下游使用：

- 04只读取OfficialIssue；
- 05只引用OfficialIssue和ReviewAction证据；
- 06报告使用OfficialIssue统计；
- 整改模块后续引用OfficialIssue。

## 19. 数据一致性与幂等

- ReviewAction只追加，不覆盖历史；
- Candidate更新使用revision；
- finalize幂等；
- OfficialIssue由后端生成稳定ID；
- 排除候选不创建OfficialIssue；
- 补录问题保留来源；
- 正式归档后重新修改产生新revision；
- 汇总由后端计算。

## 20. 测试

### 20.1 单元测试

- 决策校验；
- before/after差异；
- pending统计；
- 全部排除；
- 补录；
- 正式问题映射。

### 20.2 契约测试

- Candidate PATCH；
- revision冲突；
- summary；
- finalize未就绪；
- finalize幂等；
- finalize失败恢复；
- 0正式问题归档。

### 20.3 E2E

- 确认一项；
- 修改一项；
- 排除一项；
- 补录一项；
- 刷新恢复；
- 正式归档；
- 重复点击不重复生成；
- 04显示相同OfficialIssue数量。

## 21. 验收标准

1. AI原始输出保留；
2. 每次人工动作可追溯；
3. 候选状态持久化；
4. 允许确认、修改、排除和补录；
5. 所有pending处理后才能归档；
6. 全部排除可以归档为0问题；
7. finalize幂等；
8. OfficialIssue成为下游唯一问题源；
9. 不出现固定42项；
10. 工作流状态准确。

## 22. 当前缺失能力

当前Business已实现AnalysisCandidate列表/详情/PATCH、旧分析候选自动建档、逐条 `candidateRevision` 乐观锁、保存审计、刷新恢复、最终归档审计与归档后只读；正式问题也已支持修订和问题级审计。

旧OfficialIssue已支持显式迁入Business主仓储。迁移记录保留旧问题和指标编码作为来源信息，但当前指标绑定仍为`not_integrated`，不会恢复旧问题—指标强制映射；来源指纹变化会形成迁移冲突，不覆盖Business问题。

本次A/B复用接入项已完成：

- 原人工复核筛选和批量接受交互已接入Candidate PATCH；
- BBox按0—999坐标映射百分比显示；
- Canvas按原图自然尺寸派生JPEG标注图；
- 标注图经持久化上传会话归档，并保存分析、原图、候选来源；
- finalize校验派生资产完整性，失败保持可重试；
- 照片内容由Business BFF同源代理，预览和Canvas不跨源；
- stale分析在候选保存、标注上传和最终归档入口均被阻塞。

C/D后续项：

- Candidate服务端分页和通用批量操作；
- 标注框拖拽编辑；
- 复核意见、附件和证据文件；
- 多人协作锁与批次级审计查询；
- 失败恢复操作查询；
- 问题类型待收录维护流程。

## 23. 当前接口与依据

- `docs/api/business-bff-api.md`；
- `docs/data-model/business-data-model.md`；
- `docs/original-smart-renew-reuse-audit.md`；
- `docs/reuse-first-ab-development-outline.md`。

## 24. AB-06完成记录

- 已抽取 `apps/business/src/review/annotation.js`；
- 已增加风险筛选和“接受当前筛选中的待复核项”；
- 已通过当前上传会话归档标注图并关联OfficialIssue；
- 已保持Candidate revision、审计、零问题、幂等、stale阻塞和归档只读；
- 已增加BBox几何、派生来源、失败可恢复、stale和同源照片内容测试。
