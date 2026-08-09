# 2026-08-09 NP-05 / NP-06 完成记录

## 目标

在 NP-04 标准绑定完成后，继续完成 CloudBase 运行接线、迁移护栏、跨项目成果中心和统一系统设置，并进行全量回归。

## 已交付

### NP-05 CloudBase真实运行接线

- `URBAN_HEALTH_PROVIDER` 支持 `local/sqlite/cloudbase`；CloudBase SDK、数据库和对象存储只在 Provider 层组装。
- Business 业务集合统一使用 `business*` 命名，集中声明 Schema 版本、`id` 唯一键和索引字段。
- 官方问题、报告、复核会话、分析任务/候选、空间分析、上传会话、照片元数据、边界修订、资料资产、外业引用、住宅识别、AI配置、路线/停留点/照片绑定及地图快照均有 CloudBase Repository 路径。
- `/api/provider/health`、`/api/provider/collections`、`/api/ready` 和 `/api/meta` 显式报告 Provider、数据库/存储类型和探测结果。
- Provider 迁移支持计划、显式确认执行、失败留痕、重试式写入和确认回滚；未执行不会改目标库。
- 相同 `clientRequestId` 的迁移计划幂等返回；已完成迁移重复执行、已回滚迁移重复回滚均有确定性结果，运行中重复执行明确返回冲突。
- 二进制资料、照片和地图快照不随 JSON 迁移隐式复制，迁移计划标记为 reference-only；AI 配置只迁移密文记录，主密钥要求单独备份。

### NP-06 成果中心与系统设置

- 新增 `/api/outcomes/summary|projects|issues|reports`，均有最大分页边界，并按可信身份项目范围过滤。
- 新增 `/api/settings/meta|providers|external-services`，展示标准库、AI、高德、上游、Provider 和对象存储状态，不输出敏感凭据。
- Business 顶部新增成果中心与系统设置入口；成果中心可下钻项目、问题和报告，空库和未配置状态使用真实空/不可用状态。
- Business 主记录覆盖同 ID legacy 只读记录，stale、inactive、迁移只读和零问题口径与项目工作流共用。
- 结果中心区分管理员无限范围、普通用户项目范围和无项目范围，后者返回空读模型。

## 测试证据

```text
npm run check                 通过（包含新增 Provider/迁移/成果中心语法检查）
npm test                      210/210 通过
npm run test:integration      1/1 通过
npm run test:e2e              11/11 通过
npm run verify:demo           42 个 Demo 文件完整性通过
npm run verify:boundary       通过
git diff --check              通过
node scripts/backup-production-data.mjs + verify-production-backup.mjs
```

新增单元证据覆盖 CloudBase 集合契约、inactive 读取、迁移 dry-run/确认/回滚、成果中心主记录去重与有界索引；集成证据覆盖空库成果中心、SQLite Provider 设置页、标准库数量和敏感配置不回传。

## 未宣称事项

当前开发环境没有 CloudBase 生产凭据、真实 Collection 权限和线上恢复窗口，因此所有接口和运行时仍保持 `productionVerified=false`。上线前必须在隔离环境完成真实 SDK 探测、Collection 索引核对、对象存储二进制迁移、备份恢复对账和停写窗口切换；这些是部署验收动作，不由本地测试伪造完成。
