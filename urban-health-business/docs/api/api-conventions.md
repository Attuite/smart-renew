# Urban Health Business API规范

> 上位文档：`urban-health-business/readme.md`  
> 关联文档：`docs/architecture/system-architecture.md`、`docs/data-model/business-data-model.md`  
> 目标：定义Business前端、新版BFF、smart-renew适配器和外部引擎共同遵守的接口规则

## 1. 基本原则

1. Business前端只访问同源 `/api`；
2. 本地与云端接口路径和语义一致；
3. 旧smart-renew接口由BFF适配，不暴露给页面；
4. 业务数据为空时返回空结果，不返回Demo数据；
5. 缺失模块返回明确能力状态；
6. 关键写入支持幂等和revision冲突；
7. 异步任务使用统一任务模型；
8. 所有错误可通过稳定错误码处理；
9. 正式统计由后端生成；
10. 契约先于实现，接口变化必须更新文档和契约测试。

## 2. API根路径与版本

浏览器统一访问：

```text
/api
```

接口版本通过 `/api/meta` 声明。业务路径默认不包含版本号，破坏兼容的升级再引入：

```text
/api/v2/...
```

服务端返回：

```json
{
  "apiVersion": "1.0.0",
  "schemaVersion": "1.0.0"
}
```

## 3. URL命名

使用：

- 小写；
- 复数资源名；
- 连字符；
- 层级关系；
- 查询参数过滤。

正确：

```text
/api/projects
/api/projects/{projectId}/workflow
/api/analysis-candidates/{candidateId}
/api/spatial-analyses/{analysisId}
/api/indicator-runs/{runId}
```

避免：

```text
/api/getProjects
/api/finalizeCurrentData
/api/clearAll
```

业务动作无法自然表达为资源更新时使用子动作：

```text
POST /api/analyses/{analysisId}/finalize
POST /api/analyses/{analysisId}/retry
POST /api/reports/{reportId}/generate
```

## 4. HTTP方法

| 方法 | 语义 |
|---|---|
| GET | 查询，不改变业务状态 |
| POST | 创建资源或执行业务动作 |
| PATCH | 局部更新 |
| PUT | 完整替换；新版业务接口原则上少用 |
| DELETE | 删除或归档明确资源，必须限定目标 |

禁止使用无项目范围的全局清理接口。

## 5. 成功响应

单个资源：

```json
{
  "ok": true,
  "data": {
    "item": {}
  },
  "requestId": "REQ-01HX..."
}
```

列表：

```json
{
  "ok": true,
  "data": {
    "items": [],
    "nextCursor": null,
    "total": null
  },
  "requestId": "REQ-01HX..."
}
```

动作结果：

```json
{
  "ok": true,
  "data": {
    "operation": {},
    "affected": {}
  },
  "requestId": "REQ-01HX..."
}
```

`total` 无法低成本获得时允许为 `null`。

## 6. 失败响应

```json
{
  "ok": false,
  "error": {
    "code": "PROJECT_REVISION_CONFLICT",
    "message": "项目已被其他页面更新，请重新加载。",
    "details": {
      "expectedRevision": 4,
      "actualRevision": 5
    },
    "retryable": false
  },
  "requestId": "REQ-01HX..."
}
```

错误中不得返回：

- 密钥；
- 完整服务端堆栈；
- 数据库连接信息；
- 对象存储内部凭据。

## 7. HTTP状态码

| 状态码 | 使用场景 |
|---|---|
| 200 | 查询、更新或动作成功 |
| 201 | 资源创建成功 |
| 202 | 异步任务已接受 |
| 204 | 无响应体的成功删除/归档 |
| 400 | 请求结构或参数错误 |
| 404 | 资源不存在 |
| 409 | revision冲突、重复业务动作或状态冲突 |
| 413 | 上传或请求体过大 |
| 422 | 业务校验不通过 |
| 429 | 限流或任务并发超限 |
| 500 | 未分类服务端错误 |
| 502 | 上游服务异常 |
| 503 | 模块或依赖暂不可用 |
| 504 | 上游服务超时 |

缺失引擎优先使用：

```text
503 + MODULE_UNAVAILABLE
```

能力查询本身仍返回200，并在数据中标记 `ready: false`。

## 8. 标准错误码

### 8.1 通用

```text
INVALID_REQUEST
VALIDATION_FAILED
RESOURCE_NOT_FOUND
REVISION_CONFLICT
IDEMPOTENCY_CONFLICT
MODULE_UNAVAILABLE
UPSTREAM_UNAVAILABLE
UPSTREAM_TIMEOUT
OPERATION_NOT_ALLOWED
INTERNAL_ERROR
```

### 8.2 项目与工作流

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_CONFLICT
WORKFLOW_STAGE_BLOCKED
WORKFLOW_RESULT_STALE
WORKFLOW_ACTION_NOT_AVAILABLE
```

### 8.3 资料与照片

```text
UPLOAD_TOO_LARGE
UPLOAD_TYPE_NOT_SUPPORTED
UPLOAD_INCOMPLETE
PHOTO_NOT_FOUND
PHOTO_LOCATION_REQUIRED
ASSET_ALREADY_EXISTS
```

### 8.4 AI与复核

```text
ANALYSIS_NOT_FOUND
ANALYSIS_ALREADY_RUNNING
ANALYSIS_FAILED
ANALYSIS_NOT_FINALIZABLE
CANDIDATE_NOT_FOUND
CANDIDATE_ALREADY_REVIEWED
REVIEW_PENDING
FINALIZATION_IN_PROGRESS
FINALIZATION_ALREADY_COMPLETED
```

### 8.5 GIS

```text
GEOMETRY_INVALID
COORDINATE_SYSTEM_UNSUPPORTED
SPATIAL_BINDING_REQUIRED
SPATIAL_DATA_SOURCE_UNAVAILABLE
SPATIAL_ANALYSIS_FAILED
```

### 8.6 指标

```text
INDICATOR_ENGINE_UNAVAILABLE
INDICATOR_INPUT_INCOMPLETE
INDICATOR_RUN_NOT_FOUND
INDICATOR_STANDARD_VERSION_MISMATCH
```

### 8.7 报告

```text
REPORT_NOT_FOUND
REPORT_INPUT_INCOMPLETE
REPORT_GENERATION_FAILED
REPORT_RESULT_STALE
REPORT_ARTIFACT_NOT_READY
```

## 9. ID规则

- API中的ID始终作为字符串；
- 不在前端对ID调用 `parseInt`；
- 前端不得依赖ID排序推断创建时间；
- 新ID由后端生成；
- 旧数字ID由适配层转换为字符串；
- URL中的ID使用路径编码；
- ID不携带敏感信息。

推荐前缀仅用于可读性：

```text
PRJ-
AST-
PHOTO-
ANL-
CAND-
REVIEW-
ISSUE-
BIND-
SPATIAL-
INDRUN-
REPORT-
```

## 10. 时间规则

- 使用ISO 8601 UTC时间；
- 传输格式示例：`2026-07-26T08:30:00.000Z`；
- 前端负责显示本地时区；
- 不传递模糊本地时间字符串；
- `createdAt` 和 `updatedAt` 由后端生成；
- 业务采集时间允许由客户端提交，但必须注明来源。

## 11. 分页、过滤和排序

统一游标分页：

```http
GET /api/issues?projectId=PRJ-001&status=open&limit=50&cursor=...
```

响应：

```json
{
  "items": [],
  "nextCursor": null,
  "total": null
}
```

规则：

- `limit` 默认50，最大值由接口契约定义；
- 过滤在数据库或后端完成；
- 不先读取全部文档再由前端过滤；
- 排序字段必须显式；
- 游标视为不透明字符串；
- 客户端不得解析游标。

## 12. PATCH与revision

请求：

```http
PATCH /api/projects/PRJ-001
If-Match: "5"
Content-Type: application/json
```

```json
{
  "changes": {
    "name": "新项目名称"
  }
}
```

成功返回 `revision: 6`。

冲突：

```http
409 Conflict
```

```json
{
  "code": "PROJECT_REVISION_CONFLICT",
  "details": {
    "expectedRevision": 5,
    "actualRevision": 6
  }
}
```

旧后端不支持revision时，由适配层标记为兼容模式，并在 `/api/meta` 中暴露：

```json
{
  "features": {
    "optimisticConcurrency": false
  }
}
```

## 13. 幂等

关键POST请求接受：

```http
Idempotency-Key: 01HX...
```

适用：

- 创建AI任务；
- 正式归档；
- 创建空间分析；
- 创建指标运行；
- 创建报告；
- 生成报告交付物；
- 数据迁移。

相同键和相同请求返回原结果；相同键和不同请求返回：

```text
409 IDEMPOTENCY_CONFLICT
```

## 14. 异步任务契约

创建：

```http
POST /api/projects/{projectId}/analyses
```

返回：

```http
202 Accepted
```

```json
{
  "item": {
    "id": "ANL-001",
    "status": "queued",
    "progress": {
      "percent": 0,
      "currentStep": "queued"
    }
  }
}
```

查询：

```http
GET /api/analyses/{analysisId}
```

任务公共字段：

```json
{
  "status": "running",
  "progress": {
    "percent": 40,
    "currentStep": "analyzing",
    "processed": 4,
    "total": 10
  },
  "resultRef": null,
  "error": null
}
```

前端轮询策略由模块定义。服务器后续可增加SSE或WebSocket，但不得改变任务对象语义。

## 15. 上传契约

最终目标：

```http
POST /api/uploads/presign
```

请求：

```json
{
  "projectId": "PRJ-001",
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 12345,
  "hash": "sha256:..."
}
```

返回上传凭证和 `uploadId`。上传完成后登记：

```http
POST /api/uploads/{uploadId}/complete
```

过渡期Base64上传只能存在于适配器内部，不应成为Business公开契约。

## 16. 能力接口

```http
GET /api/meta
```

示例：

```json
{
  "ok": true,
  "data": {
    "apiVersion": "1.0.0",
    "schemaVersion": "1.0.0",
    "build": "local",
    "services": {
      "database": {
        "ready": true,
        "mode": "local-json-files",
        "managedDatabaseReady": false,
        "managedDatabaseReason": "managed_database_not_integrated"
      },
      "storage": {
        "ready": true,
        "mode": "local-filesystem",
        "objectStorageReady": false,
        "objectStorageReason": "object_storage_not_integrated"
      },
      "ai": { "ready": false, "reason": "not_configured" },
      "gis": { "ready": true },
      "indicator": { "ready": false, "reason": "not_integrated" },
      "report": { "ready": true, "pdfReady": false }
    },
    "features": {
      "optimisticConcurrency": true,
      "localJsonPersistence": true,
      "managedDatabase": false,
      "directUpload": false,
      "localFileStorage": true,
      "objectStorage": false,
      "asyncAnalysis": true,
      "serverPdf": false
    }
  },
  "requestId": "REQ-..."
}
```

前端根据能力禁用或标记模块，不通过尝试调用不存在接口来探测能力。

## 17. 指标引擎接口占位

```http
GET /api/indicator-engine/capabilities
```

未接入：

```json
{
  "ready": false,
  "engineVersion": null,
  "supportedDimensions": [],
  "message": "指标计算引擎待接入"
}
```

创建运行：

```http
POST /api/projects/{projectId}/indicator-runs
```

未接入返回：

```text
503 INDICATOR_ENGINE_UNAVAILABLE
```

不得返回V9.1固定指标结果。

## 18. 请求头

推荐支持：

| 请求头 | 用途 |
|---|---|
| `Accept` | 响应类型 |
| `Content-Type` | 请求内容类型 |
| `X-Request-Id` | 客户端提供请求追踪ID，可由服务端替换 |
| `Idempotency-Key` | 幂等写入 |
| `If-Match` | revision并发控制 |

认证与权限头在后续安全专项中定义，当前接口设计不得阻止未来加入。

## 19. 超时和重试

前端只自动重试：

- 明确标记 `retryable: true`；
- GET查询；
- 使用幂等键的安全POST。

不得自动重试：

- 无幂等保护的写入；
- revision冲突；
- 业务校验失败；
- 用户主动取消。

上游超时由BFF转换为：

```text
504 UPSTREAM_TIMEOUT
```

## 20. 删除与归档

资源删除必须明确目标：

```http
DELETE /api/analysis-records/{analysisId}
```

项目级批量操作：

```http
POST /api/projects/{projectId}/analysis-records/archive
```

禁止：

```http
DELETE /api/analysis-records
```

在没有 `projectId` 和明确确认语义时删除全局数据。

## 21. 下载与报告交付物

下载接口返回：

- 流式文件；或
- 短期下载URL。

元数据接口必须提供：

```json
{
  "format": "pdf",
  "size": 12345,
  "hash": "sha256:...",
  "generatedAt": "",
  "status": "ready"
}
```

报告未完成时返回 `REPORT_ARTIFACT_NOT_READY`，不能返回空文件。

## 22. 旧smart-renew接口适配

适配器为每个接口记录：

```text
目标新版接口
旧接口路径
字段转换
能力差异
临时限制
错误映射
计划替代方式
```

示例：

| 新版语义 | 当前旧接口 | 适配要求 |
|---|---|---|
| 创建分析 | `/api/vision/analyze` | 包装为AnalysisJob |
| 查询分析 | `/api/analysis-records/{id}` | 转换状态和ID |
| 正式归档 | `/api/issues/finalize` | 增加幂等和结果聚合 |
| 报告生成 | `/api/reports/generate` | 转换为ReportSnapshot |
| 项目查询 | `/api/projects` | 统一列表响应 |

## 23. 契约文档

每个接口文档至少包含：

1. 用途；
2. 前置条件；
3. URL和方法；
4. 路径参数；
5. 查询参数；
6. 请求头；
7. 请求体；
8. 成功响应；
9. 错误响应；
10. 幂等规则；
11. revision规则；
12. 旧接口映射；
13. 当前实现状态；
14. 测试用例。

## 24. 契约测试

必须验证：

- 响应封装一致；
- ID为字符串；
- 时间为ISO 8601；
- 错误码稳定；
- 列表分页结构一致；
- 幂等重复调用结果一致；
- revision冲突返回409；
- 未接入模块返回明确不可用；
- 本地和云端响应符合相同Schema；
- Business接口失败不返回Demo数据。

## 25. API规范验收

1. 前端只使用 `/api`；
2. 所有模块使用统一API客户端；
3. 成功和失败响应结构固定；
4. 关键写入具备幂等约定；
5. 更新具备revision约定；
6. 异步任务模型统一；
7. 缺失引擎有能力和错误接口；
8. 删除操作目标明确；
9. smart-renew旧接口被适配层隔离；
10. 契约测试可以覆盖本地和云端。
