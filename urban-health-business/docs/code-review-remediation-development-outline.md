# 代码审查问题修复开发大纲

> 日期：2026-08-09
> 目标分支：`urban-health-business`
> 审查基线：当前工作区相对 `6ac338c` 的未提交开发内容
> 适用范围：NP-04 国标绑定、NP-05 CloudBase、NP-06 成果中心与系统设置

## 1. 背景与目标

当前版本已通过语法检查、210 个单元测试、1 个集成测试和 11 个端到端测试，但代码审查发现权限、迁移安全、CloudBase 数据完整性和成果汇总口径方面仍有缺口。

本轮修复目标：

1. 关闭国标绑定和系统设置接口的身份、项目权限缺口；
2. 保证 Provider 迁移在目标记录冲突、服务中断、重试和回滚场景下不会损坏数据；
3. 保证 CloudBase 模式可由干净安装启动，且集合超过 100 条时不会静默截断；
4. 修正跨项目成果汇总超过 200 个项目及资料完整度异常的统计口径；
5. 为上述边界补齐自动化证据，修复后再更新“开发完成”状态。

## 2. 实施原则

- 优先修复 P1 数据安全与权限问题，再修复 P2 统计和信息暴露问题；
- 不在迁移中静默覆盖目标库已有记录；默认采用安全失败，除非已有可恢复的 before-image 方案；
- 不以 Mock 测试代替真实 CloudBase 生产验收，`productionVerified` 继续保持 `false`；
- 所有写接口使用可信身份形成操作人，不直接信任前端提交的审计姓名；
- CloudBase 分页、成果汇总和页面分页必须区分“完整聚合”与“有界明细返回”；
- 保留当前工作区已有开发内容，不清理或覆盖与本轮无关的用户修改。

## 3. 修复任务

### CR-01（P1）国标绑定接口接入身份认证与项目 RBAC

涉及文件：

- `server/index.mjs`
- `server/security/rbac.mjs`
- `tests/integration/business-flow.test.mjs`
- 必要时新增路由级单元测试

实施要求：

1. `PATCH /api/issues/{issueId}/standard-binding` 先读取正式问题，取得真实 `projectId`；
2. 对写入执行项目范围权限校验。推荐新增语义明确的 `gis.issue.binding.edit` 权限，并分配给 `gis-editor`、`gis-manager` 和 `admin`；若复用既有权限，必须在文档中说明原因；
3. 通过 `accountableActor(identity, input.updatedBy)` 形成操作人：认证模式下必须覆盖前端提交值，本地禁用认证模式下才允许使用提交值；
4. `GET /api/issues/{issueId}/standard-binding-audit` 至少要求 `gis.view` 且校验问题所属项目；
5. 不存在的问题继续返回 404，不应通过响应差异向无项目权限用户泄露其他项目记录；
6. 保留 `expectedRevision` 冲突和标准库服务端派生逻辑。

验收标准：

- required 模式匿名写入和读取审计均返回 401；
- 有角色但无项目范围返回 403；
- 有项目范围的编辑者可绑定，查看者只能读取审计；
- 审计 actor 来自认证身份，不能由请求体伪造；
- 本地 disabled 模式现有开发流程不被破坏。

### CR-02（P1）迁移目标冲突与可恢复回滚

涉及文件：

- `server/services/provider-migration-service.mjs`
- `server/providers/cloudbase-provider.mjs`
- `tests/unit/provider-migration-service.test.mjs`
- Provider 契约测试

推荐安全方案：

1. 迁移写入前调用 Provider `get` 检查目标 ID；
2. 默认对目标库已有同 ID 记录报显式冲突，不执行覆盖；
3. `run.migrated` 只登记由本次迁移新创建且允许回滚删除的记录；
4. 若业务确实要求覆盖，必须显式启用独立模式，并持久化完整、受保护的 before-image；回滚时恢复旧值而不是删除；
5. 回滚前验证目标记录仍属于本次迁移，避免删除迁移后又被其他操作更新的记录；可记录迁移写入哈希或迁移版本标识；
6. 回滚结果记录 `restored/removed/skipped/conflicted/failed` 数量和明细；发生冲突时不得虚报回滚完成。

验收标准：

- 空目标库迁移后可回滚且只删除本次创建的记录；
- 目标库已有同 ID 数据时默认不覆盖、不删除；
- 若实现覆盖模式，回滚后目标记录与迁移前完全一致；
- 迁移后记录被第三方修改时回滚安全停止并留下冲突审计；
- 对重复回滚保持确定性结果。

### CR-03（P1）迁移检查点、中断恢复与重试

涉及文件：

- `server/services/provider-migration-service.mjs`
- Provider 迁移路由与运行仓储
- `tests/unit/provider-migration-service.test.mjs`
- 必要时增加集成测试

实施要求：

1. 每条记录或固定小批次写入后持久化迁移检查点，不得只在整个循环结束后保存；
2. 运行记录至少包含当前 Collection、已处理数量、成功/失败/冲突清单、最后心跳时间；
3. 为长期无心跳的 `running` 运行提供显式恢复操作：继续执行、标记失败后回滚或管理员接管；
4. 重试必须从检查点继续，不能丢失先前成功写入的 `migrated` 清单；
5. 进程异常或 Provider 暂时不可用时，运行必须进入可诊断、可恢复状态；
6. 并发执行同一 run 时必须由持久化锁、租约或原子状态变更保证只有一个执行者。

验收标准：

- 在第 N 条写入后模拟进程异常，重新加载运行记录仍能看见前 N 条检查点；
- 中断运行可按明确动作继续或回滚，不会永久卡在 `running`；
- 多次重试不会重复创建、漏记或扩大回滚范围；
- 两个执行者并发请求同一 run 时只有一个获得执行权。

### CR-04（P1）CloudBase Repository 完整分页

涉及文件：

- `server/providers/cloudbase-provider.mjs`
- `server/repositories/cloudbase-repository-adapter.mjs`
- `server/repositories/official-issue-repository.mjs`
- 其他直接调用 Provider `list` 的仓储
- `tests/unit/cloudbase-provider.test.mjs`

实施要求：

1. 不再用一次无分页的 `collection.get()` 表示“列出全部”；
2. 明确 Provider 的列表契约，可选择：
   - Provider 内部按 `skip/limit` 分页读取直到结束；或
   - Provider 返回 `{items,total,offset,limit,nextCursor}`，由上层显式遍历；
3. 单页大小不得超过 CloudBase SDK 上限，并为大数据量设置合理总量保护；
4. Repository 的 offset/limit 必须下推或建立在完整结果上，不能先被默认 100 条截断再切片；
5. `findByClientRequest`、成果统计、备份/迁移清单和管理员列表必须明确是全量查询还是有界分页；
6. 健康检查的 `{limit: 1}` 应作为查询限制，而不是被当成 `where({limit: 1})` 条件。

验收标准：

- Mock Collection 存放 250 条记录时可完整读取 250 条；
- offset=100、limit=50 返回第 101—150 条，不返回空数组；
- 带 `projectId/status` 条件的分页不会串项目或漏页；
- CloudBase 模式的正式问题、报告、任务等超过 100 条后仍能正确统计和下钻。

### CR-05（P1）补齐 CloudBase SDK 运行依赖与启动说明

涉及文件：

- `package.json`
- 对应 lock 文件
- `.env.example` 或部署文档
- CloudBase 启动烟雾测试

实施要求：

1. 将默认加载的 `@cloudbase/node-sdk` 以受控版本加入运行时 `dependencies`；
2. 更新 lock 文件，保证干净 `npm install` 后模块可加载；
3. 文档列出 `URBAN_HEALTH_PROVIDER=cloudbase`、`TCB_ENV/SCF_NAMESPACE`、身份凭据和 Collection 准备要求；
4. 保留 `CLOUDBASE_SDK_MODULE` 扩展点时，说明它是高级覆盖项，不是默认安装路径；
5. 启动错误应区分“SDK 缺失”“环境 ID 缺失”“凭据/权限失败”和“Collection 未准备”。

验收标准：

- 干净安装后 `@cloudbase/node-sdk` 可以被默认加载；
- 缺少环境 ID 时返回明确配置错误；
- 配置隔离环境后服务可启动并完成数据库、对象存储探测；
- 未完成真实环境验收前继续返回 `productionVerified=false`。

### CR-06（P2）修正超过 200 个项目的成果汇总

涉及文件：

- `server/services/outcome-center-service.mjs`
- `tests/unit/outcome-center-service.test.mjs`
- 必要时调整成果中心前端说明

实施要求：

1. `projectCount`、阶段分布、问题、风险、分析、报告和资料异常统计必须覆盖全部可见项目；
2. `projects` 明细可以有界返回，但必须与聚合过程分离，并返回明确的 `projectsTotal/projectsLimit/projectsTruncated`；
3. 不应依赖前端下载全部项目后自行统计；
4. 大项目量时避免无上限并发请求，可采用分批或限并发聚合；
5. 保持普通用户项目范围、空项目范围和管理员全范围的语义不变。

验收标准：

- 构造 201 个可见项目时，所有汇总值覆盖 201 个项目；
- 明细即使只返回前 200 个，也明确标记截断，汇总值不受影响；
- 无项目权限用户仍返回零统计且不访问不可见项目；
- 汇总值可与 `/projects|issues|reports` 分页结果对账。

### CR-07（P2）修正资料完整度异常统计状态

涉及文件：

- `server/services/outcome-center-service.mjs`
- `server/services/collection-validation-service.mjs`
- `tests/unit/outcome-center-service.test.mjs`

实施要求：

1. 统一异常定义：至少将 `collectionValidation.status === 'incomplete'` 计为资料异常；
2. 明确 warning 是否单独统计，避免把建议项与必填失败混为一类；
3. 建议输出 `incompleteCollectionProjectCount` 和 `collectionWarningProjectCount`，避免使用语义模糊且当前不存在的 `failed` 总状态；
4. 前端标签和说明与服务端口径一致。

验收标准：

- 缺少边界、照片或有效小区的项目进入资料不完整计数；
- 所有必填检查通过的项目不进入该计数；
- 只有可选 warning 时按约定进入独立 warning 计数；
- 空项目与零问题项目口径不被误判。

### CR-08（P2）系统设置接口接入登录校验和信息分级

涉及文件：

- `server/index.mjs`
- `server/security/rbac.mjs`
- `tests/integration/business-flow.test.mjs`
- 设置页前端错误态

实施要求：

1. `/api/settings/meta`、`/api/settings/providers`、`/api/settings/external-services` 在 required 模式下必须要求已登录；
2. 普通用户只返回与使用功能相关的能力状态；
3. 管理级 Provider 信息、CloudBase 环境 ID、Collection 映射、迁移状态等仅向管理员开放；
4. 继续禁止返回 AI Key、高德服务端 Key、CloudBase 凭据、S3 密钥等敏感值；
5. 设置页正确处理 401/403，不把权限不足显示成 Provider 故障。

验收标准：

- required 模式匿名访问三个接口均返回 401；
- 普通用户可读取允许的能力状态但看不到管理级基础设施标识；
- 管理员可读取完整但已脱敏的运行状态；
- disabled 模式保持本地预览可用。

## 4. 推荐实施顺序

### 阶段 A：权限与迁移安全阻断项

1. CR-01 国标绑定 RBAC；
2. CR-02 目标冲突与安全回滚；
3. CR-03 检查点和中断恢复。

阶段 A 完成前，不执行真实 CloudBase 数据迁移。

### 阶段 B：CloudBase 可运行性与数据完整性

1. CR-04 完整分页；
2. CR-05 SDK 依赖、启动与部署说明；
3. 在隔离 CloudBase 环境执行 100+ 条记录契约测试。

### 阶段 C：成果和设置口径

1. CR-06 201+ 项目汇总；
2. CR-07 资料异常状态；
3. CR-08 设置接口认证和信息分级。

### 阶段 D：回归与文档收口

1. 补齐所有新增测试；
2. 更新 API、数据模型、部署说明和开发状态；
3. 新建修复完成记录，逐项列出测试证据和仍未完成的生产验收；
4. 清理 `.DS_Store` 等无关文件，不覆盖其他已有修改；
5. 经审查后再提交 Git，不提前把任务标记为完成。

## 5. 必须补充的测试矩阵

| 范围 | 必测场景 |
| --- | --- |
| 绑定权限 | 匿名 401、跨项目 403、viewer 只读、editor 写入、actor 防伪造、revision 冲突 |
| 迁移冲突 | 空目标、同 ID 目标、迁移后目标被修改、部分失败、重复执行、重复回滚 |
| 迁移恢复 | 写入中断、检查点重载、继续执行、失败后回滚、并发执行租约 |
| CloudBase 分页 | 0/1/100/101/250 条、条件分页、offset 跨页、管理员列表与幂等查找 |
| CloudBase 启动 | SDK 可加载、缺环境 ID、缺凭据、缺 Collection、存储探测失败 |
| 成果汇总 | 0/1/200/201 个项目、项目权限过滤、零问题、stale 报告、资料 incomplete |
| 设置权限 | 匿名、普通用户、管理员、敏感字段缺失、前端 401/403 状态 |

完成实现后至少运行：

```bash
npm run check
npm test
npm run test:integration
npm run test:e2e
npm run verify:demo
npm run verify:boundary
git diff --check
```

另需在隔离 CloudBase 环境执行：

- 250 条以上记录的分页与对账；
- 同 ID 数据迁移冲突演练；
- 迁移中断、继续和回滚演练；
- 数据库与对象存储权限分别失败的健康检查；
- 服务重启后的数据恢复验证。

## 6. 完成定义

以下条件全部满足后，才可将本轮修复标记为完成：

1. CR-01—CR-08 均有代码、测试和文档证据；
2. P1 问题不存在仅靠文档规避的情况；
3. 所有自动化回归通过，新增边界测试能够在修复前失败、修复后通过；
4. 迁移对已有目标数据、中断、重试和回滚均可证明安全；
5. CloudBase 超过 100 条记录、成果中心超过 200 个项目时统计仍正确；
6. required 模式下匿名和跨项目访问均被阻止；
7. 不泄露任何明文密钥或管理级基础设施信息；
8. 未完成隔离环境验收时，所有 CloudBase 状态继续如实标记 `productionVerified=false`。

## 7. 交接提示

- 当前分支包含较多尚未提交的已有开发修改，接手对话应先运行 `git status --short` 并以现有工作区为基线继续，不要重置；
- 当前已知回归基线为：语法检查通过、单元测试 210/210、集成测试 1/1、E2E 11/11；
- 先为每个问题增加能够复现缺陷的测试，再实现修复；
- CloudBase 真实生产凭据当前未提供，不得用 Mock 结果把 `productionVerified` 改为 `true`；
- 完成后生成独立修复记录，并重新进行一次代码审查。
