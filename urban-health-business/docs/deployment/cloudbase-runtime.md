# CloudBase 运行说明

## 默认依赖

Business 运行时默认依赖固定版本 `@cloudbase/node-sdk@3.18.3`，已写入 `package.json` 与 `package-lock.json`。`CLOUDBASE_SDK_MODULE` 仅用于高级覆盖或隔离测试，不是默认安装路径。

## 必需环境变量

```text
URBAN_HEALTH_PROVIDER=cloudbase
TCB_ENV=<CloudBase环境ID>
# 或 SCF_NAMESPACE=<环境ID>
CLOUDBASE_HEALTH_OBJECT=<对象存储中已存在且可读的探针对象路径>
```

运行时还需要 CloudBase SDK 使用的凭据，以及下列业务 Collection 已由部署流程创建并配置索引：

- `businessOfficialIssues`
- `businessReports`
- `businessReviewSessions`
- `businessAnalysisJobs`
- `businessAnalysisCandidates`
- `businessSpatialAnalyses`
- `businessUploadSessions`
- `businessPhotoMetadata`
- `businessBoundaryRevisions`
- `businessCollectionValidations`
- `businessSourceAssets`
- `businessSourceAssetImports`
- `businessFieldTaskReferences`
- `businessMigrationRuns`
- `businessProviderMigrationRuns`
- `businessResidentialDiscoveryRuns`
- `businessAiConfigurations`
- `businessCoordinateTransforms`
- `businessSurveyRoutes`
- `businessSurveyStops`
- `businessPhotoRouteBindings`
- `businessMapSnapshots`

集合、索引、唯一键和 Schema 版本的代码契约位于 `server/providers/cloudbase-provider.mjs`。应用启动不会自动创建、清空或重建 Collection。

## 启动与健康检查错误

- `CLOUDBASE_SDK_UNAVAILABLE`：默认 SDK 或显式覆盖模块未安装；
- `CLOUDBASE_ENV_REQUIRED`：缺少 `TCB_ENV` 与 `SCF_NAMESPACE`；
- `CLOUDBASE_INIT_FAILED`：SDK 初始化失败，通常是凭据或环境权限问题；
- `CLOUDBASE_COLLECTION_NOT_CONFIGURED`：Collection 映射不完整；
- `CLOUDBASE_STORAGE_PROBE_FAILED` 或 `cloudbase_storage_health_object_not_configured`：对象存储探针失败或未配置。

`/api/ready` 和 `/api/provider/health` 分别报告数据库分页探针与对象存储探针；生产验收完成前 `productionVerified` 始终为 `false`。

## 数据迁移门禁

先调用 `POST /api/provider-migrations` 生成计划，再由管理员使用 `confirmed: true` 执行。目标已有同 ID 记录时默认冲突失败，不覆盖；每条记录写入后保存检查点。中断运行必须使用明确的恢复参数接管，回滚会校验迁移标记和写入哈希，第三方修改后的记录只记为冲突而不删除。

真实环境上线前必须完成 250 条以上分页、目标冲突、中断恢复、回滚、数据库权限和对象存储权限演练；本地 Mock/SQLite 测试不能把 `productionVerified` 改为 true。
