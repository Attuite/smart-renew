# Business BFF 当前接口

> 基准版本：`0.1.0`  
> 本地地址：`http://127.0.0.1:4182`  
> 上游smart-renew：默认 `http://127.0.0.1:4173`

本文记录当前代码已经实现的接口，不代表最终目标接口已全部完成。

## 1. 通用响应

Business BFF自有接口使用：

```json
{
  "ok": true,
  "data": {},
  "requestId": "uuid"
}
```

错误：

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误说明",
    "details": {},
    "retryable": false
  },
  "requestId": "uuid"
}
```

未被BFF接管的 `/api/*` 会转发到原smart-renew，可能保留原接口响应结构。

## 2. 能力与工作流

```http
GET /api/health
GET /api/ready
GET /api/metrics
GET /api/meta
GET /api/projects/{projectId}/summary
GET /api/projects/{projectId}/workflow
```

`/api/meta` 必须真实报告AI、指标、地图、报告及原smart-renew复用能力，不得因界面需要伪造ready。`services.legacy`中的每项能力使用`available/degraded/unavailable`状态，并声明适配器、访问模式和主数据源。

`/api/meta.dataSources`返回项目、照片、分析、Candidate、正式问题、SourceAsset、空间分析、报告、ProjectData和外业任务的唯一主数据源规则。正式问题和报告以Business为主，原数据只读兼容并仅允许显式迁移。

`/api/health` 是进程存活检查，不依赖上游；`/api/ready` 检查运行所需的smart-renew数据库与存储连接。AI、地图底图、指标和服务端PDF作为可选能力单独报告，不会因为未配置而把整个Business服务判为不可运行。

`/api/metrics` 返回当前进程启动时间、运行秒数、请求数、错误数和HTTP状态码分布。每个请求完成后输出单行JSON日志，包含 `requestId/method/path/status/durationMs`，不记录请求体和照片内容。

## 3. 项目与空间层级

```http
GET  /api/projects
GET  /api/projects/{projectId}
PATCH /api/projects/{projectId}
GET  /api/projects/{projectId}/export
POST /api/projects
POST /api/projects/{projectId}/communities
GET  /api/projects/{projectId}/communities
PATCH /api/projects/{projectId}/communities/{communityId}
GET  /api/field/projects/{projectId}/communities
POST /api/projects/{projectId}/communities/{communityId}/buildings
GET  /api/projects/{projectId}/communities/{communityId}/buildings
PATCH /api/projects/{projectId}/communities/{communityId}/buildings/{buildingId}
GET  /api/field/projects/{projectId}/communities/{communityId}/buildings
PATCH /api/projects/{projectId}/boundary
GET   /api/projects/{projectId}/boundary
```

新项目使用兼容原smart-renew的数字ID，但不会生成边界、照片、问题或分析结果。

项目PATCH可修订名称、区域、类型、范围和说明，并使用 `expectedRevision` 检测冲突；不会覆盖项目边界、小区、楼栋或其他业务集合。

项目导出返回可下载JSON，汇总旧后端照片元数据、分析、问题、报告和Business上传会话、任务、候选、人工复核、正式问题、空间分析及报告。导出清单明确 `includesPhotoBinaries: false`，当前不包含照片二进制。

新建小区只写入人工提供的名称和地址，不生成楼栋、户数和坐标。

Business小区列表包含active和inactive记录。PATCH可修正名称和地址，或软停用/恢复小区；已有楼栋、照片和问题引用保持稳定。修改使用 `expectedRevision` 检测并发冲突。

新增楼栋可保存名称、户数、单元数和层数，且必须属于当前项目的有效小区。

Business楼栋列表包含active和inactive记录。PATCH可修正楼栋字段，或用 `status: inactive|active` 软停用和恢复；楼栋ID不会变化，已有照片引用不会被物理删除。修改使用 `expectedRevision` 检测并发冲突。

边界请求：

```json
{
  "coordinates": [
    [108.94, 34.26],
    [108.96, 34.26],
    [108.96, 34.28],
    [108.94, 34.28]
  ],
  "crs": "WGS84",
  "updatedBy": "录入人员",
  "expectedRevision": 3
}
```

边界接口执行：

- 经度、纬度范围校验；
- 至少3个不同点；
- 最大5000点；
- 闭合重复点清理；
- 自相交检测；
- 零面积检测；
- WGS84或GCJ02坐标系校验；
- 项目修订冲突检测；
- 面积和中心点计算。

每次通过Business保存边界后，同时写入不可覆盖的边界修订快照；GET返回按项目修订倒序排列的坐标、坐标系、面积、中心、更新人员与时间。迁移前已存在但未经过Business保存的旧边界不会被伪造成历史版本。

## 4. 照片与持久化上传会话

```http
GET  /api/photos?projectId={projectId}&includeInactive={true|false}
PATCH /api/projects/{projectId}/photos/{photoId}
POST  /api/projects/{projectId}/photos/batch-metadata
POST /api/photos/upload
GET  /api/photos/{photoId}/content
GET  /api/uploads?projectId={projectId}
POST /api/uploads
GET  /api/uploads/{uploadId}
PUT  /api/uploads/{uploadId}
POST /api/uploads/{uploadId}/cancel
```

浏览器先创建持久化上传会话，再把原始文件二进制写入 `PUT /api/uploads/{uploadId}`。BFF当前仍通过适配层转换后写入原smart-renew文件存储：

- JPEG、PNG或WebP；
- 单张不超过12MB；
- 必须绑定当前项目中的真实小区；
- 可以进一步绑定该小区中的真实楼栋；
- `clientRequestId` 支持幂等创建；
- 会话持久化 `ready/uploading/completed/failed/canceled`、尝试次数、已接收字节、文件哈希和稳定照片ID；
- 失败会话保留且允许使用同一会话重试；
- 刷新页面后可恢复查看上传队列；
- 文件保存到原smart-renew本地文件存储；
- 最终仍应把BFF存储适配器替换为对象存储分片或预签名直传。

照片治理PATCH不改写原smart-renew照片记录或二进制文件，而是在Business仓储中保存可修订覆盖层。可修订字段包括显示名称、小区/楼栋绑定、拍摄时间、经纬度、坐标系、治理备注和 `active|inactive` 状态；请求必须提供治理人员，并可用 `expectedRevision` 检测并发冲突。

JPEG上传完成时，BFF会在服务端解析 `DateTimeOriginal/DateTimeDigitized/DateTime` 和GPS经纬度。提取成功后以“系统EXIF解析”写入照片治理覆盖层，并分别保存 `capturedAtSource`、`coordinateSource`；EXIF时间不含时区时记录为时区未知，不擅自换算。人工表单再次修订相应字段后来源变为 `manual`。无EXIF、格式损坏或不支持的PNG/WebP不会阻断上传，也不会产生备用坐标。

批量治理接口每次接受1—200项 `photoId/longitude/latitude/capturedAt?/expectedRevision` 和统一 `updatedBy`。同批次照片ID不可重复；后端逐项调用同一照片治理规则，返回 `updated|failed`、新修订号或明确错误。部分失败使用HTTP 207，成功项不回滚，失败项可按返回清单修正后重试。Business工作台支持对应CSV清单输入，并在部分失败后只保留失败行。

普通照片列表默认隐藏已停用照片；治理工作台使用 `includeInactive=true` 查看并恢复停用记录。工作流统计、AI任务和人工问题证据只接受使用中的照片，引用停用照片创建AI任务时返回 `PHOTO_INACTIVE`。项目JSON导出在 `business.photoMetadata` 中包含治理覆盖记录，但仍不包含照片二进制。

### 4.1 通用资料资产

```http
GET   /api/projects/{projectId}/assets?includeInactive=true
POST  /api/projects/{projectId}/assets
PATCH /api/projects/{projectId}/assets/{assetId}
PUT   /api/assets/{assetId}/content
GET   /api/assets/{assetId}/content
GET   /api/assets/{assetId}/preview
POST  /api/projects/{projectId}/boundary/import
```

资料资产采用两步上传：先POST登记文件名、MIME、字节数、分类、可选小区、上传人员和 `clientRequestId`，再PUT原始二进制。当前支持PDF、JSON/GeoJSON、CSV、TXT、XLSX、DOCX和ZIP，单个1字节—20MB；BFF校验声明大小和MIME，完成后记录SHA-256。大小或MIME失败会持久化失败原因；前端重新选择同名、同大小、同类型、同分类和同归属文件时续传原资产，不重复登记。已完成资产的相同内容PUT幂等返回，不同内容禁止覆盖；同项目新资产命中已有SHA-256时保存为重复引用，不再写第二份二进制。资产支持乐观修订、软停用和恢复，治理操作必须填写本次操作人员。

当前二进制保存在Business本地文件仓储，项目导出包含 `business.sourceAssets` 元数据及 `includesSourceAssetBinaries: false` 声明，不把二进制嵌入JSON。对象存储、分片上传和重复文件合并仍是待接入能力。

CSV、JSON和GeoJSON可请求只读结构预览。CSV支持引号、转义引号和逗号字段，返回字段、总行数及最多200行；JSON数组返回字段和样例行，GeoJSON返回要素数、几何类型和属性键，不回传整份坐标。预览不自动写入业务对象，后续字段映射引擎必须在用户明确确认映射后单独导入。

GIS分类的JSON/GeoJSON资产可通过边界导入接口转成真实项目边界。只接受一个无孔洞Polygon，单面MultiPolygon可兼容；多个面、分离MultiPolygon、孔洞或无Polygon会明确拒绝，不静默选择。边界版本保存来源资产ID和内容哈希，GeoJSON按WGS84处理。

### 4.2 资料完整度校验

```http
GET  /api/projects/{projectId}/collection/validation
POST /api/projects/{projectId}/collection/validate
GET  /api/projects/{projectId}/collection/validation-runs
```

GET实时计算当前资料状态。POST需要 `validatedBy`，把同一规则结果保存为不可覆盖的人工校验快照；历史记录和项目JSON导出均包含该快照。

阶段01的完成状态不再由“照片数量大于0”决定。当前6个必需项为项目档案、有效小区、项目边界、使用中照片、照片空间归属和上传队列已结束；照片坐标、楼栋台账、辅助资料和失败上传治理是建议项，只形成警告。必需项未全部通过时，阶段01保持 `in_progress` 或 `ready`，不会伪装为已完成。

## 5. AI分析任务

```http
GET  /api/analysis-records?projectId={projectId}
POST /api/projects/{projectId}/analyses
GET  /api/projects/{projectId}/analysis-jobs
POST /api/projects/{projectId}/analysis-jobs
GET  /api/analysis-jobs/{jobId}
GET  /api/analysis-jobs/{jobId}/candidates
POST /api/analysis-jobs/{jobId}/cancel
POST /api/analysis-jobs/{jobId}/retry
```

前端业务入口使用异步任务接口。创建任务：

```json
{
  "photoIds": ["PHOTO-..."],
  "analysisType": "综合巡检分析",
  "description": "本次重点",
  "clientRequestId": "前端生成的UUID"
}
```

限制：

- 单批1—20张；
- AI未配置时返回 `AI_NOT_CONFIGURED`；
- 模型非JSON结果返回 `AI_RESPONSE_INVALID`；
- 不生成回退候选；
- 持久化任务状态为 `queued/running/completed/failed/canceled`，查询和工作流可根据当前照片证据派生 `stale`；
- 任务创建时保存照片内容哈希、治理修订、归属和坐标快照；
- 照片停用、治理修订或内容变化后，已完成任务返回 `stale` 和明确 `staleReasons`；
- 尚未归档的stale候选必须重新分析后才能进入人工复核；
- 服务重启后会把未结束任务恢复到队列；
- 前端轮询任务状态，刷新页面不丢失任务；
- 完成后候选问题独立写入Business仓储，并通过任务候选接口读取；
- 排队和失败任务可取消，失败任务可创建子任务重试；
- 当前版本不支持中断已经发出的模型请求；
- 旧同步 `POST /analyses` 仅保留兼容，不再由Business前端调用。

## 6. 人工复核和正式问题

```http
POST /api/analyses/{analysisId}/review/finalize
GET  /api/analysis-candidates?projectId={projectId}&analysisId={analysisId}&jobId={jobId}
GET  /api/analysis-candidates/{candidateId}
PATCH /api/analysis-candidates/{candidateId}
GET  /api/issues?projectId={projectId}
POST /api/projects/{projectId}/issues
PATCH /api/issues/{issueId}
GET  /api/projects/{projectId}/manual-reviews
POST /api/projects/{projectId}/manual-reviews
```

归档请求：

```json
{
  "reviewerName": "复核人员",
  "decisions": [
    {
      "candidateId": "CAND-...",
      "status": "accepted"
    },
    {
      "candidateId": "CAND-...",
      "status": "excluded"
    }
  ]
}
```

所有候选均可排除，0个正式问题是合法归档结果。

候选归档请求允许在 `changes` 中修正标题、描述、证据、分类、风险等级、位置、建议和标注框；后端使用字段白名单，发生修正的接受项记录为 `modified`。

候选PATCH用于归档前逐条保存，要求 `analysisId`、`updatedBy` 和 `expectedRevision`，可同时保存字段修正与 `pending|accepted|excluded` 结论。每次保存递增 `candidateRevision` 并追加审计轨迹；旧分析记录中的候选会在第一次保存时建立独立候选记录并同步回分析，刷新页面不会丢失。分析归档后候选不可再修改，最终归档会再追加 `candidate_archived` 审计。

AI不可用或漏检时可人工补录正式问题。人工复核结论必须显式归档；当正式问题为0时，必须传 `zeroIssueConfirmed: true`，不能把空数据静默当成零问题。正式问题PATCH使用 `expectedRevision` 检测冲突，并追加问题级审计记录。

Business正式问题不再依赖旧问题—指标映射：

```json
{
  "indicatorCode": null,
  "indicatorBindingStatus": "not_integrated"
}
```

## 7. GIS基础绑定

```http
PATCH /api/issues/{issueId}/geometry
```

请求：

```json
{
  "longitude": 108.95,
  "latitude": 34.27,
  "crs": "WGS84",
  "confirmedBy": "GIS人员"
}
```

当前支持Business正式问题的人工点坐标，以及真实经纬度矢量预览。项目必须先有有效边界；问题坐标系必须与边界坐标系一致，点位必须位于项目多边形内部或边界线上。前端可选择正式问题后点击矢量预览回填真实经纬度，后端仍会再次做范围、坐标系和边界归属校验。无项目边界时不会生成或推测坐标。请求可带 `expectedGeometryRevision` 防止覆盖他人点位修订，每次成功保存均递增 `geometryRevision` 并追加前后坐标、坐标系、确认人员和时间审计。

参数化空间分析：

```http
GET  /api/projects/{projectId}/spatial-analyses
POST /api/projects/{projectId}/spatial-analyses
```

```json
{
  "radiusMeters": 650,
  "createdBy": "GIS人员"
}
```

半径必须由用户在50—10000米间提供，且必须填写实际操作人员；中心默认取真实项目边界中心，也可由接口显式提供。结果保存项目修订、正式问题修订、真实距离和命中ID，不生成固定500/800/1000米结果。Business前端在项目无边界时禁用运行按钮。地图SDK、坐标转换、POI和空间对象绑定尚未接入。

工作流会比较空间运行保存的边界时间、正式问题集合和问题更新时间；输入变化后阶段04返回 `stale` 和原因，要求重新运行。

## 8. 指标引擎预留

```http
GET  /api/indicator-engine/meta
POST /api/projects/{projectId}/indicator-runs
```

能力查询返回draft契约。运行入口在未接入时固定返回：

```text
HTTP 501
INDICATOR_ENGINE_NOT_INTEGRATED
```

不得返回演示指标、权重、扣分或综合得分。

## 9. 报告快照

```http
GET  /api/reports?projectId={projectId}
POST /api/projects/{projectId}/reports
GET  /api/projects/{projectId}/reports/compare?baseReportId={id}&targetReportId={id}
GET  /api/reports/{reportId}
PATCH /api/reports/{reportId}
GET  /api/reports/{reportId}/json
GET  /api/reports/{reportId}/print
```

生成请求：

```json
{
  "title": "项目城市体检报告",
  "generatedBy": "报告人员"
}
```

必须先存在已归档的人工复核结论。0个正式问题仍允许生成报告。

当前报告是JSON数据快照，不是PDF。指标部分固定记录为：

```json
{
  "status": "unavailable",
  "reason": "indicator_engine_not_integrated",
  "results": [],
  "score": null
}
```

报告可修订标题、执行摘要、建议和内部备注；PATCH使用 `expectedRevision` 检测并发冲突，并追加修订审计。`/json` 返回下载附件；`/print` 返回独立打印页面，可由浏览器打印或另存为PDF。服务端稳定PDF渲染尚未接入。

新报告保存项目修订、正式问题修订、空间分析引用、照片集合和照片治理修订；这些输入变化后报告列表和阶段06返回 `stale`。旧报告文件仍保留并显示原因；使用当前证据生成更高版本后，最新报告恢复有效，历史过期版本不会被覆盖。

版本比较接口只接受同一项目的两个不同报告，返回标题/摘要/建议/备注差异、项目与问题统计口径差异，以及正式问题、空间分析和照片证据集合的新增、移除或修订。接口返回结构化差异，不修改任一报告版本。

## 10. 数据目录和环境变量

```text
URBAN_HEALTH_PORT
URBAN_HEALTH_HOST
URBAN_HEALTH_DATA_DIR
SMART_RENEW_API_BASE
SMART_RENEW_API_TIMEOUT_MS
```

Business扩展数据默认写入：

```text
urban-health-business/.data/
```

该目录被Git忽略。原smart-renew项目、照片和分析记录继续使用其本地数据目录。
