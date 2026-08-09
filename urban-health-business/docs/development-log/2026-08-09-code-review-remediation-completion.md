# 2026-08-09 代码审查整改完成记录（CR-01—CR-08）

## 1. 目标

依据 `docs/code-review-remediation-development-outline.md`，对标准绑定权限、CloudBase迁移安全、分页/运行时依赖、成果汇总、资料完整度口径和系统设置鉴权进行实现、测试和文档收口。

## 2. 交付结果

| 编号 | 结果 | 证据 |
|---|---|---|
| CR-01 | 标准绑定PATCH/审计GET接入可信身份和项目RBAC；编辑者具备 `gis.issue.binding.edit` | `server/index.mjs`、`server/security/rbac.mjs`、集成测试 |
| CR-02 | 迁移目标冲突不覆盖；新增记录带运行标记/哈希；回滚验证后再删除 | `server/services/provider-migration-service.mjs`、冲突/回滚单测 |
| CR-03 | 逐条检查点、心跳、运行租约和明确恢复；中断状态可续跑 | Provider迁移中断恢复单测 |
| CR-04 | CloudBase完整分页、条件查询、offset/limit，不把控制字段放进where | `server/providers/cloudbase-provider.mjs`、250条分页单测 |
| CR-05 | 默认锁定 `@cloudbase/node-sdk@3.18.3`；初始化、数据库和对象存储错误分类 | `package.json`、`package-lock.json`、`docs/deployment/cloudbase-runtime.md` |
| CR-06 | 成果汇总遍历全部可见项目，详情最大200条，受控批量并发 | `server/services/outcome-center-service.mjs`、201项目单测 |
| CR-07 | 分离必需资料未完成项目数与建议项警告项目数 | OutcomeSummary单测与接口文档 |
| CR-08 | 设置接口统一认证；普通用户脱敏，管理员可见诊断；保留401/403/disabled状态 | `server/index.mjs`、集成测试、Business设置页 |

## 3. 回归证据

- `npm run check`：通过；
- `npm test`：215/215通过；
- `npm run test:integration`：1/1通过，包含匿名设置/绑定审计401、跨项目403、项目编辑者绑定和查看者审计读取；
- `npm run test:e2e`：11/11通过，包含成果中心和系统设置；
- `npm run verify:demo`：42个快照文件一致；
- `npm run verify:boundary`：通过；
- `git diff --check`：通过；
- CloudBase Mock：覆盖250条分页、双探针健康、目标冲突、中断恢复、第三方修改后的回滚冲突，并持续返回 `productionVerified=false`。

## 4. 仍需外部验收

未使用真实CloudBase凭据或生产环境修改 `productionVerified`。上线前仍需在隔离环境完成Collection规则、数据库权限、对象存储探针、250条以上分页、迁移恢复和备份恢复演练，并归档运行记录。

## 5. 2026-08-10 复审追加整改

复审发现的剩余问题已继续修复：

- ProviderMigrationRun 通过 CloudBase `runTransaction` 原子获取持久化租约，检查点和最终状态必须携带同一租约令牌，令牌丢失立即停止当前执行者；进程内 Set 仅保留为本实例快速拒绝，不再作为跨实例安全边界；
- `/api/ready` 在 CloudBase 模式下复用数据库 Collection 和对象存储双探针，任一失败均返回 not-ready；
- `/api/meta` 需要 `gis.view` 并对普通用户脱敏，`/api/provider/health` 和 `/api/provider/collections` 仅管理员可读；
- CloudBase业务Repository改为完整读取、全局排序后只执行一次offset/limit，新增250条数据、数字offset=100/limit=50的Adapter回归；
- `collectionAnomalyProjectCount` 改为 incomplete 与 warning 项目的并集，同一项目只计一次。

本轮新增后回归证据：

- `npm run check`：通过；
- `npm test`：218/218通过；
- `npm run test:integration`：1/1通过，新增匿名meta和Provider诊断401；
- `npm run test:e2e`：11/11通过；
- `git diff --check`：通过。

`package.json` 与 `package-lock.json` 已锁定 `@cloudbase/node-sdk@3.18.3`。当前审查环境尝试执行 `npm install` 时外部执行审批中断，因此本机 `node_modules` 的SDK安装和真实CloudBase启动仍属于环境验证，不将其写成已通过。
