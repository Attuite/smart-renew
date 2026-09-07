# Urban Health Business 下一阶段功能对齐开发大纲

> 文档性质：`main` 已实现能力向 Business 工作流的增量接入计划
>
> 开发分支：`urban-health-business`
>
> 对照基线：`main@77ae142`、`urban-health-business@6ac338c`
>
> 编制日期：2026-08-09

> 执行状态（2026-08-09）：NP-01—NP-06 已完成并通过回归。NP-05 的 CloudBase 生产环境仍按安全边界保持 `productionVerified=false`，需在实际隔离环境完成凭据、Collection、权限和恢复演练后再置为 true。详见 `docs/development-log/2026-08-09-np05-np06-completion.md`。

## 1. 阶段目标

本阶段不再扩张新的业务边界，而是将 `main` 中已经完成、可使用，但尚未完整进入 `/business/` 的能力纳入 Business 主工作流。

开发目标共六项：

1. 边界内住宅小区自动识别、确认入台账及小区合并拆分；
2. 外业任务从创建、照片上传到完成验收的闭环；
3. AI 服务配置、模型选择和用户独立 Key 管理；
4. 人工复核中的问题编码、指标与整改建议关联；
5. Business CloudBase Provider 真实运行接线与迁移验收；
6. 跨项目成果中心和统一系统设置。

## 2. 完成后的目标结果

完成本大纲后，Business 应当达到：

- 项目范围可直接产生待确认住宅小区清单，人工确认后进入唯一住宅台账；
- 外业任务具有问题类型、户数、照片进度、同步状态和完成审计；
- Business 用户无需离开新版工作台即可查看 AI 能力、选择模型并管理自己的 Key；
- 正式问题可选关联 `PRB-*` 编码、指标和整改建议，但不回退为旧版强制映射；
- Business 可在受控环境真实使用 CloudBase 数据库与对象存储，且不与本地 Provider 静默双写；
- 管理人员可查看跨项目成果，并从统一设置页检查 AI、Provider、标准库和外部服务状态。

## 3. 开发边界与不可回退原则

### 3.1 主数据源不变

- Project、Photo 二进制和原 AnalysisRecord 继续由 smart-renew 主管；
- AnalysisCandidate、ReviewSession、Business OfficialIssue 和 Business Report 继续由 Business 主管；
- 标准库保持只读来源，项目业务对象只保存编码、版本和快照引用；
- CloudBase 接入不得在同一请求内与本地仓储无审计双写。

### 3.2 复用方式

- 优先通过 `server/adapters/smart-renew/` 接入 `main` 已有 API；
- 只有无服务器副作用的纯函数才能抽取或共享；
- 不加载旧版整个 `index.html` 来实现 Business 页面；
- 新界面必须继续通过 Business API Client 调用同源 BFF。

### 3.3 必须保留的 Business 约束

- revision 和 409 乐观冲突；
- 写入人员、时间、前后值和来源审计；
- 幂等请求和失败可重试；
- stale 传播及上游变化阻断；
- 零问题结论、归档后只读和 Demo 隔离；
- 空数据、未配置和失败状态不使用固定演示数据回退。

## 4. 工作包总览

| 编号 | 工作包 | 当前基线 | 本阶段交付 |
|---|---|---|---|
| NP-01 | 住宅小区识别与台账治理 | 人工小区、楼栋CRUD，住宅POI分析 | POI待确认清单、入台账、合并、拆分、分区和回收站 |
| NP-02 | 外业任务闭环 | 任务创建、读取和引用恢复 | 问题编码、户数、照片进度、上传关联、完成与重试 |
| NP-03 | AI配置与用户Key | AI能力查询和上游模型调用 | 配置会话、用户隔离Key、模型参数及健康检查 |
| NP-04 | 问题编码与整改建议关联 | 标准库只读目录，问题不强制映射 | 可选编码绑定、版本快照、关联校验和建议引用 |
| NP-05 | CloudBase真实运行接线 | Provider代码和Mock契约 | 运行时组装、Collection、存储、迁移、健康检查和隔离验收 |
| NP-06 | 成果中心与系统设置 | 当前项目六阶段工作台 | 跨项目汇总、空间/问题/报告索引和统一设置页 |

## 5. NP-01 住宅小区识别与台账治理

### 5.1 复用来源

- `main/index.html` 中边界内住宅小区检索与二次过滤行为；
- 小区合并、成员分区、拆分还原、软删除和回收站交互；
- Business 已有高德 Provider、POI 清洗、项目边界、小区和楼栋修订模型。

### 5.2 设计要求

- 检索结果先作为 `ResidentialDiscoveryRun` 快照保存，不直接写入正式台账；
- 人工确认时记录 Provider、POI ID、原始名称、地址、坐标、边界修订和操作人；
- 合并小区保留稳定主 ID 和全部成员快照，不破坏已有照片、任务、楼栋和问题引用；
- 拆分必须先检查下游引用，要求用户明确选择引用重定向策略；
- 删除继续使用软停用，恢复不生成新小区 ID。

### 5.3 拟定接口

```http
POST /api/projects/{projectId}/residential-discovery-runs
GET  /api/projects/{projectId}/residential-discovery-runs
POST /api/projects/{projectId}/residential-discovery-runs/{runId}/confirm
POST /api/projects/{projectId}/communities/merge
POST /api/projects/{projectId}/communities/{communityId}/split
POST /api/projects/{projectId}/communities/{communityId}/restore
```

### 5.4 验收标准

- 未确认 POI 不进入住宅台账；
- 重复检索和重复确认不产生重复小区；
- 小区合并、拆分、停用和恢复均有 revision 与审计；
- 已有照片、楼栋、外业任务和正式问题引用不丢失；
- 高德未配置或配额失败时保持明确不可用状态。

## 6. NP-02 外业任务闭环

### 6.1 复用来源

- `main/functions/api/field-collection-core.js` 中任务字段、层级校验和幂等编号；
- `main` 的任务完成和照片归档一致性校验；
- Business 已有外业任务引用仓储、持久化上传会话和照片治理。

### 6.2 新增任务字段

- `problemCode/problemName/indicatorCode`；
- `buildingCount/householdCount`；
- `location/photoCount/uploadedPhotoCount`；
- `capturedAt/collectorId`；
- `pending-upload/uploading/partially-uploaded/completed/failed/canceled` 状态；
- 照片 ID、上传会话 ID 和失败项清单。

### 6.3 接入要求

- 外业照片必须复用 Business 现有上传会话，不新建第二条 Base64 照片写入路径；
- 照片上传时校验 task/project/community/building/problemCode 一致性；
- 完成任务前服务端核对预期照片数、已完成会话和照片归档结果；
- 页面刷新后恢复待上传、部分失败和已完成任务；
- 本阶段不承诺微信小程序正式发布，但 BFF 契约必须能支持后续移动端。

### 6.4 拟定接口

```http
GET  /api/projects/{projectId}/field/problem-types
POST /api/projects/{projectId}/field/tasks
GET  /api/projects/{projectId}/field/tasks
GET  /api/projects/{projectId}/field/tasks/{taskId}
POST /api/projects/{projectId}/field/tasks/{taskId}/uploads
POST /api/projects/{projectId}/field/tasks/{taskId}/complete
POST /api/projects/{projectId}/field/tasks/{taskId}/retry
```

### 6.5 验收标准

- 同一 `clientTaskId` 重试幂等；
- 楼栋与小区不匹配、无效问题编码或照片数不足时明确拒绝；
- 部分上传失败可单项重试，不重复创建成功照片；
- 完成任务后保留只读快照和完成审计；
- 照片立即进入资料治理、AI 选图和项目完整度口径。

## 7. NP-03 AI 配置与用户 Key

### 7.1 复用来源

- `main` 的 `/api/config/users`、`/api/config/key`、`/api/config/session/health`；
- 用户独立 Key 的服务端保存与模型代理逻辑；
- Business 已有 AI 能力元数据、AnalysisJob 和错误状态。

### 7.2 安全边界

- 浏览器永不读取已保存 Key 明文；
- 日志、requestId、错误详情和导出中不得包含 Key；
- 配置请求必须使用已验证用户身份，不信任外部传入用户名；
- 本地模式也不将 Key 放入浏览器 LocalStorage；
- 管理员可查看用户配置状态，不可查看 Key 值。

### 7.3 界面与接口

- 阶段02显示当前模型、配置就绪状态和请求限制；
- 系统设置页提供 Key 设置/替换、模型选择、超时、单批图片数及健康检查；
- 实际路由由 BFF 包装，不让前端依赖旧路径。

```http
GET  /api/ai/config/meta
PUT  /api/ai/config/key
PATCH /api/ai/config/preferences
POST /api/ai/config/health-check
GET  /api/admin/ai/users
```

### 7.4 验收标准

- 用户 A 不能读取或使用用户 B 的 Key；
- Key 未配置、无效、配额用尽和网络失败返回不同错误码；
- 替换 Key 后旧配置失效并记录操作审计；
- 前端源码、响应和日志中不出现明文 Key；
- 不影响已完成历史分析的可读性。

## 8. NP-04 问题编码、指标与整改建议关联

### 8.1 实现策略

Business 不恢复旧版“没有指标编码就不能归档”的强制规则。新能力采用“可选绑定＋明确状态＋版本快照”：

- `problemCode`：人工选择的 `PRB-*` 问题编码；
- `indicatorCode`：由标准库关系确定，不允许前端自由填写；
- `remediationSnapshot`：保存当次选中建议的原文、类型、责任单位和标准库版本；
- `bindingStatus`：`unbound/suggested/confirmed/not-applicable`；
- `bindingAudit`：记录 AI 建议、人工确认、解除和重新绑定。

### 8.2 交互要求

- 复核人可按维度、问题大类或关键词搜索问题编码；
- 选中编码后显示关联指标和整改建议，人工确认后写入；
- 人工问题和零问题结论继续合法；
- 旧问题不批量自动映射，只在人工确认或显式迁移时更新；
- 编码关联不产生分数、权重、扣分或指标运行结果。

### 8.3 拟定接口

```http
GET   /api/standards/problem-types
GET   /api/standards/problem-types/{problemCode}
GET   /api/standards/problem-types/{problemCode}/remediations
PATCH /api/issues/{issueId}/standard-binding
GET   /api/issues/{issueId}/standard-binding-audit
```

### 8.4 验收标准

- 无效或已停用编码不能确认；
- `problemCode`、`indicatorCode` 和整改建议的关联来自同一标准库版本；
- 正式问题修订号、审计和报告 stale 传播正确；
- 未绑定问题可查询、可筛选，不伪造映射；
- 报告快照使用生成时的建议快照，后续标准库更新不改写旧报告。

## 9. NP-05 CloudBase 真实运行接线

### 9.1 当前基线

- `CloudBaseRepositoryProvider` 和 `CloudBaseStorageProvider` 已有代码与 Mock 契约；
- Business 运行时 `URBAN_HEALTH_PROVIDER` 仅接受 `local/sqlite`；
- 生产 GIS 可使用 SQLite/RTree，地图快照可使用 S3 兼容存储；
- smart-renew 上游已有 CloudBase 项目、照片、分析和外业数据。

### 9.2 实现范围

- 将 `cloudbase` 加入正式 Provider 组装选项；
- 为 Business 实体建立 Collection 命名、索引、唯一键和 Schema 版本；
- 实现专用 Repository 适配或统一仓储接口，不使业务服务直接调用 CloudBase SDK；
- 照片和 SourceAsset 二进制优先保持 smart-renew 主数据源，除非完成一次明确迁移；
- 建立本地/SQLite 到 CloudBase 的审计、演练、执行和回滚清单；
- `/api/meta`、`/api/ready` 和运行日志如实报告实际 Provider、环境和探测结果。

### 9.3 建议 Collection

```text
businessProjectsOverlay
businessAnalysisCandidates
businessReviewSessions
businessOfficialIssues
businessReports
businessSourceAssets
businessSpatialAnalyses
businessUploadSessions
businessFieldTaskReferences
businessMigrationRuns
```

实际 Collection 以数据模型和迁移审查结果为准，不得在生产首次启动时无提示自动重建或清空 Collection。

### 9.4 验收层级

1. Mock 契约；
2. CloudBase 隔离测试环境；
3. 小规模真实项目影子迁移；
4. 停写窗口正式迁移；
5. 恢复演练与业务对账。

### 9.5 验收标准

- CloudBase 模式重启后数据可恢复；
- 同一幂等键不产生重复数据；
- revision 冲突、跨项目权限和失败错误码与本地模式一致；
- 不在错误、日志、临时URL和浏览器配置中泄露密钥；
- 备份恢复后项目、问题、空间记录、报告和二进制引用数量一致；
- 完成前 `productionVerified` 始终保持 `false`。

### 9.6 本轮实际交付

- `URBAN_HEALTH_PROVIDER=cloudbase` 已进入正式运行时组装，业务仓储通过 CloudBase Repository Adapter 访问数据库与对象存储，不把 SDK 下沉到业务服务；
- `business*` Collection 契约已集中声明 Schema 版本、唯一键和索引字段，并提供 `/api/provider/health`、`/api/provider/collections`；
- Provider 迁移提供计划、显式确认执行、失败留痕、回滚和二进制 reference-only 护栏；AI 配置只迁移加密记录，主密钥仍需按备份方案单独保管；
- SourceAsset 和地图快照二进制不在普通 JSON 迁移中隐式复制，必须经过对象存储专项迁移与对账；
- `/api/meta`、`/api/ready`、设置页和迁移响应均不把未探测或未验收 CloudBase 标记为 ready。
- `scripts/backup-production-data.mjs` 与 `scripts/verify-production-backup.mjs` 已覆盖 local JSON 与 SQLite 两种本地模式；CloudBase 明确要求使用云端原生备份和对象存储版本控制，不伪造本地快照。

## 10. NP-06 跨项目成果中心与系统设置

### 10.1 成果中心

服务端提供有界汇总读模型，前端不通过下载所有项目明细自行统计。

汇总内容：

- 项目总数及六阶段状态分布；
- 正式问题数、风险分布和待绑定编码数；
- 已归档 AI 分析、已定位问题和有效空间分析；
- 最新报告、stale 报告和未生成报告项目；
- 外业任务、照片上传与资料完整度异常；
- 每个汇总值可下钻到项目或原始记录。

### 10.2 系统设置

- AI 配置和用户 Key 状态；
- 当前 Repository/Object Storage Provider 和健康检查；
- 标准库版本、数量及最后加载时间；
- 高德浏览器/Web Service 能力与配额错误；
- 备份、迁移和后台任务运行状态；
- 仅管理角色可执行配置更改，普通用户只看与自己相关的能力状态。

### 10.3 拟定接口

```http
GET /api/outcomes/summary
GET /api/outcomes/projects
GET /api/outcomes/issues
GET /api/outcomes/reports
GET /api/settings/meta
GET /api/settings/providers
GET /api/settings/external-services
```

配置写接口由 NP-03 和 NP-05 各自提供，NP-06 不再建第二套配置仓储。

### 10.4 验收标准

- 空库显示真实空状态；
- 汇总数可与各项目实际记录对账；
- stale、inactive、migrated-read-only 和零问题状态口径与项目页一致；
- 跨项目权限不足时不返回不可见项目的统计；
- 页面每个数字均可追溯到查询或业务记录；
- 设置页不展示明文密钥，不把未验证 Provider 标记为 ready。

### 10.5 本轮实际交付

- `/api/outcomes/summary|projects|issues|reports` 提供有界跨项目读模型，使用 Business 主记录覆盖同 ID 旧记录，并保留项目权限过滤；
- `/api/settings/meta|providers|external-services` 汇总标准库、Provider、对象存储、AI、高德和上游能力，不返回服务端 Key；
- Business 全局顶部新增成果中心与系统设置入口，空数据、未配置和不可用状态均显示真实状态，项目详情仍可从成果中心下钻；
- 迁移、成果中心和设置页均复用既有身份/RBAC，不创建第二套配置仓储。
- 结果中心将“无项目范围”与“无限制管理员范围”区分处理，不会把普通用户的空权限范围展开成全项目。

## 11. 数据模型增量

预计增加或扩展：

- `ResidentialDiscoveryRun`；
- `CommunityMergeRevision`；
- `FieldCollectionTaskSnapshot`；
- `AiUserConfigurationReference`；
- `StandardBindingSnapshot`；
- `ProviderMigrationRun`；
- `OutcomeSummaryReadModel`。

每个模型在实现前必须同步补充：

- 稳定 ID 和项目归属；
- Schema 版本；
- revision 或不可变快照语义；
- 来源、操作人和时间；
- 幂等键；
- 导出、备份、迁移和 stale 策略。

## 12. 依赖顺序

```text
契约与数据模型固定
→ NP-01 住宅台账
→ NP-02 外业闭环
→ NP-03 AI配置
→ NP-04 问题编码绑定
→ NP-05 CloudBase真实接线
→ NP-06 成果中心与设置页
→ 全过程回归、迁移演练和文档收口
```

说明：

- NP-01 先固定小区引用语义，避免外业任务再次迁移；
- NP-03 和 NP-04 可在 NP-02 接口稳定后交叉开发，但合并前必须共用统一身份和标准库契约；
- NP-05 在业务实体稳定后接线，避免一边设计 Collection 一边改模型；
- NP-06 最后汇总前五项的服务能力和统计口径。

## 13. 测试与回归要求

### 13.1 单元和契约测试

- 住宅POI去重、确认幂等、合并与拆分引用安全；
- 外业任务状态机、照片数量校验和部分失败重试；
- AI Key 隔离、脱敏和错误分类；
- 问题编码、指标与整改建议同版本校验；
- local、sqlite 和 cloudbase Repository/Storage 契约一致性；
- 跨项目汇总权限、口径和有界返回。

### 13.2 集成测试

```text
创建项目与边界
→ 检索住宅POI并确认台账
→ 合并/拆分与引用校验
→ 创建外业任务
→ 分批上传照片并完成任务
→ 使用用户AI配置发起分析
→ 复核问题并确认PRB编码
→ 生成包含整改建议快照的报告
→ 核对跨项目成果中心
→ 在CloudBase隔离环境重复同一流程
```

### 13.3 浏览器 E2E

- 桌面端与移动宽度的住宅台账操作；
- 外业部分上传、刷新恢复和完成任务；
- AI 未配置、配置失败和正常状态；
- 标准编码搜索、建议预览和确认；
- 成果中心下钻及系统设置权限；
- 可视回归必须使用真实隔离数据，不读取 Demo 固定结果。

### 13.4 发布门禁

每个工作包至少通过：

```bash
npm run check
npm test
npm run test:integration
npm run test:e2e
npm run verify:demo
npm run verify:boundary
git diff --check
```

CloudBase 工作包另需隔离环境契约、迁移对账和恢复演练记录。

## 14. 明确不纳入本阶段

- 微信小程序主体认证、备案、隐私协议和正式发布；
- 正式指标计算引擎、权重、阈值、扣分和综合评分；
- 服务端原生 PDF/DOCX 排版引擎；
- 报告审批、签发、发布和对外分享；
- 整改任务派发、责任人、复核和销项；
- 多实例主动-主动写入和 PostgreSQL/PostGIS 选型；
- 政务权威 GIS、法定测绘和外部数据采购。

## 15. 总体完成定义

六个工作包全部满足以下条件后，才能标记本阶段完成：

1. Business 页面可完成六项用户流程，不需要跳回旧版单页应用；
2. 所有新写入均经 BFF，且主数据源与实际路径一致；
3. 本地、SQLite 及配置后的 CloudBase 契约可验证；
4. 不恢复 Demo 固定结果和旧版强制指标映射；
5. revision、审计、幂等、stale、权限和失败恢复全部有测试证据；
6. 项目导出、备份和迁移包含本阶段新增对象；
7. 开发状态、API、数据模型、部署和运维文档已同步；
8. `main` 原版入口和 V9.1 Demo 保持不变。

本轮已满足以上本地、SQLite、Mock CloudBase 契约和界面验收条件；CloudBase 真实生产验收仍是部署运维动作，不由本地开发环境代为宣称完成。
