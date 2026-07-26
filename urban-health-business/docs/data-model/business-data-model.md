# Urban Health Business 业务数据模型

> 上位文档：`urban-health-business/readme.md`  
> 关联文档：`docs/architecture/system-architecture.md`  
> 目标：定义六阶段共享的对象、关系、状态、版本和正式数据口径

## 1. 建模原则

1. 业务对象使用字符串ID；
2. 所有正式对象可追溯到项目；
3. AI候选与正式问题分离；
4. 原始数据与人工修改分离；
5. 空间分析、指标计算和报告均为版本化运行结果；
6. 页面显示状态不代替业务状态；
7. 项目对象不承载所有子对象；
8. 正式数据以后端为准；
9. 缺失值使用 `null` 或明确状态，不使用Demo值；
10. 对象之间通过ID引用，避免重复嵌入大型数据。

## 2. 总体关系

```mermaid
erDiagram
    PROJECT ||--o{ SOURCE_ASSET : owns
    PROJECT ||--o{ PHOTO : owns
    PROJECT ||--o{ FIELD_RECORD : owns
    PROJECT ||--o{ ANALYSIS_JOB : runs
    ANALYSIS_JOB ||--o{ ANALYSIS_CANDIDATE : produces
    ANALYSIS_CANDIDATE ||--o{ REVIEW_ACTION : reviewed_by
    PROJECT ||--o{ OFFICIAL_ISSUE : owns
    ANALYSIS_CANDIDATE o|--o| OFFICIAL_ISSUE : finalized_as
    OFFICIAL_ISSUE ||--o{ SPATIAL_BINDING : located_by
    PROJECT ||--o{ SPATIAL_ANALYSIS_RUN : runs
    PROJECT ||--o{ INDICATOR_RUN : runs
    INDICATOR_RUN ||--o{ INDICATOR_RESULT : contains
    PROJECT ||--o{ REPORT_SNAPSHOT : generates
    REPORT_SNAPSHOT ||--o{ REPORT_ARTIFACT : outputs
    PROJECT ||--|| WORKFLOW_STATE : summarized_by
```

## 3. 公共字段

所有持久化对象建议包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 全局或类型范围内唯一ID |
| `projectId` | string | 所属项目；全局字典可为 `"0"` |
| `status` | string | 对象状态 |
| `createdAt` | ISO datetime | 创建时间 |
| `updatedAt` | ISO datetime | 更新时间 |
| `revision` | integer | 乐观锁版本，从1递增 |
| `source` | string | 数据来源 |
| `schemaVersion` | string | 数据结构版本 |
| `createdBy` | string/null | 创建人员 |
| `updatedBy` | string/null | 最后修改人员 |

运行结果类对象额外包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| `inputSnapshotId` | string | 固定输入快照 |
| `engineVersion` | string/null | 引擎版本 |
| `startedAt` | ISO datetime/null | 开始时间 |
| `completedAt` | ISO datetime/null | 完成时间 |
| `error` | object/null | 标准错误 |

## 4. Project

项目是业务归属对象，不直接嵌入完整照片、问题、GIS、指标和报告列表。

建议字段：

```json
{
  "id": "PRJ-001",
  "name": "项目名称",
  "status": "collecting",
  "description": "",
  "cityCode": "",
  "districtCode": "",
  "address": "",
  "boundary": {
    "type": "Polygon",
    "coordinates": []
  },
  "boundaryCrs": "GCJ02",
  "activeStandardLibraryVersion": "1.0.0",
  "createdAt": "",
  "updatedAt": "",
  "revision": 1
}
```

项目状态只做高层提示。六阶段准确状态由 `WorkflowState` 提供。

## 5. SourceAsset

表示项目原始资料。

主要类型：

```text
photo
uav
survey-form
gis-file
route
document
archive
other
```

建议字段：

```json
{
  "id": "AST-001",
  "projectId": "PRJ-001",
  "assetType": "gis-file",
  "name": "项目边界.geojson",
  "mimeType": "application/geo+json",
  "size": 12345,
  "hash": "sha256:...",
  "storageRef": "cloud://...",
  "ingestStatus": "completed",
  "validation": {
    "valid": true,
    "warnings": [],
    "errors": []
  }
}
```

SQLite进入ProjectData时另存`SourceAssetImportRun`审计，不把转换记录塞回SourceAsset元数据：

```json
{
  "id": "ASSETIMP-001",
  "projectId": "PRJ-001",
  "assetId": "AST-001",
  "sourceContentHash": "sha256...",
  "sourceAssetRevision": 1,
  "target": "projectData",
  "format": "sqlite",
  "mode": "append",
  "importedCount": 120,
  "recognizedTables": ["project_data_index"],
  "tableStats": {"project_data_index": 120},
  "importedBy": "",
  "completedAt": ""
}
```

## 6. Photo

照片是独立正式实体，不在分析记录中长期保存Base64。

建议字段：

```json
{
  "id": "PHOTO-001",
  "projectId": "PRJ-001",
  "assetId": "AST-001",
  "kind": "original",
  "name": "现场照片.jpg",
  "mimeType": "image/jpeg",
  "storageRef": "cloud://...",
  "thumbnailRef": "cloud://...",
  "width": 1920,
  "height": 1080,
  "capturedAt": "",
  "capturedAtSource": "exif|manual|file-last-modified|legacy",
  "captureSource": "mobile",
  "exif": {},
  "location": {
    "status": "located",
    "source": "exif",
    "originalCrs": "WGS84",
    "originalCoordinates": [0, 0],
    "displayCrs": "GCJ02",
    "displayCoordinates": [0, 0],
    "accuracyMeters": null
  },
  "communityId": null,
  "buildingId": null,
  "routeId": null,
  "status": "completed"
}
```

`kind` 至少支持：

```text
original
annotated
uav
derived
```

## 7. FieldRecord

表示移动端、外业调查表或人工补录的结构化记录。

建议字段：

```json
{
  "id": "FIELD-001",
  "projectId": "PRJ-001",
  "recordType": "building-survey",
  "communityId": "",
  "buildingId": "",
  "collector": "",
  "collectedAt": "",
  "geometry": null,
  "payload": {},
  "photoIds": [],
  "status": "submitted"
}
```

## 8. AnalysisJob

表示一次AI分析运行。

```json
{
  "id": "ANL-001",
  "projectId": "PRJ-001",
  "status": "running",
  "photoIds": ["PHOTO-001"],
  "model": "qwen3-vl-plus",
  "promptVersion": "1.0.0",
  "progress": {
    "total": 1,
    "processed": 0,
    "failed": 0,
    "percent": 0
  },
  "candidateSummary": {
    "total": 0,
    "averageConfidence": null,
    "riskCounts": {}
  },
  "inputSnapshotId": "SNAP-AI-001"
}
```

状态：

```text
queued
running
completed
failed
canceled
finalizing
archived
```

## 9. AnalysisCandidate

AI候选问题保留模型原始输出。

```json
{
  "id": "CAND-001",
  "projectId": "PRJ-001",
  "analysisId": "ANL-001",
  "photoId": "PHOTO-001",
  "modelOutput": {
    "problemTypeCode": "",
    "title": "",
    "description": "",
    "severity": null,
    "confidence": null,
    "bbox": null,
    "suggestedIndicatorCodes": []
  },
  "classification": {
    "status": "review",
    "matchedProblemCode": null
  },
  "reviewStatus": "pending",
  "officialIssueId": null
}
```

候选问题不得直接作为项目正式问题统计源。

## 10. ReviewAction

记录人工对候选问题的每次操作。

```json
{
  "id": "REVIEW-001",
  "projectId": "PRJ-001",
  "analysisId": "ANL-001",
  "candidateId": "CAND-001",
  "action": "modified",
  "reviewer": "",
  "reviewedAt": "",
  "before": {},
  "after": {},
  "note": ""
}
```

`action`：

```text
confirmed
modified
excluded
supplemented
reopened
```

## 11. OfficialIssue

正式问题是GIS、指标、报告和后续整改的唯一正式问题源。

```json
{
  "id": "ISSUE-001",
  "projectId": "PRJ-001",
  "analysisId": "ANL-001",
  "candidateId": "CAND-001",
  "problemCode": "PRB-04-01",
  "title": "",
  "description": "",
  "severity": 8,
  "severityLabel": "严重",
  "reviewStatus": "confirmed",
  "reviewer": "",
  "photoIds": ["PHOTO-001"],
  "annotatedPhotoIds": [],
  "communityId": null,
  "buildingId": null,
  "geometryStatus": "pending",
  "remediationStatus": "open",
  "status": "open"
}
```

正式问题修改必须增加 `revision` 并保留变更记录。

旧问题迁入时使用新的确定性Business ID，并增加`migration.sourceId`、`migration.sourceFingerprint`、`migratedBy`和`migratedAt`。旧`problemCode`和`indicatorCode`只保存为`legacyProblemCode`、`legacyIndicatorCode`来源字段；当前`indicatorCode`仍为`null`。

## 12. SpatialBinding

保存正式问题和真实空间对象的绑定。

```json
{
  "id": "BIND-001",
  "projectId": "PRJ-001",
  "issueId": "ISSUE-001",
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  },
  "crs": "GCJ02",
  "source": "photo-exif",
  "accuracyMeters": null,
  "communityId": null,
  "buildingId": null,
  "parcelId": null,
  "roadId": null,
  "confirmedBy": null,
  "confirmedAt": null,
  "status": "pending"
}
```

状态：

```text
pending
auto_bound
confirmed
adjusted
rejected
```

## 13. SpatialAnalysisRun

保存可复现的空间分析。

```json
{
  "id": "SPRUN-001",
  "projectId": "PRJ-001",
  "type": "poi-search",
  "status": "completed",
  "parameters": {
    "center": [108.95, 34.27],
    "centerCrs": "GCJ02",
    "radiusMeters": 1000,
    "category": "residential",
    "keywords": ["小区", "家园"],
    "boundaryOnly": true
  },
  "providerSnapshot": {
    "provider": "amap",
    "api": "place-around-v3",
    "coordinateSystem": "GCJ-02",
    "queriedAt": ""
  },
  "sourceSnapshot": {
    "projectRevision": 1,
    "boundaryUpdatedAt": "",
    "boundaryCrs": "GCJ02"
  },
  "cleaning": {
    "ruleVersion": "smart-renew-ab-poi-v1",
    "rawCount": 0,
    "acceptedBeforeMergeCount": 0,
    "mergedCount": 0,
    "rejectedCount": 0
  },
  "rawPois": [],
  "result": {
    "itemCount": 0,
    "items": [],
    "rejected": []
  }
}
```

当前实现支持`official-issue-radius`和`poi-search`两类运行。POI运行保存原始Provider响应、清洗拒绝原因和合并结果，不能只保存最终汇总数字；自动清洗结果不是指标得分。

## 14. IndicatorRun

指标引擎未接入前仍固定数据契约。

```json
{
  "id": "INDRUN-001",
  "projectId": "PRJ-001",
  "status": "unavailable",
  "engineVersion": null,
  "standardLibraryVersion": "1.0.0",
  "inputSnapshotId": "SNAP-IND-001",
  "resultSummary": null
}
```

状态：

```text
queued
running
completed
failed
canceled
unavailable
stale
```

## 15. IndicatorResult

```json
{
  "id": "INDRESULT-001",
  "projectId": "PRJ-001",
  "runId": "INDRUN-001",
  "indicatorCode": "IND-HOUSE-001",
  "dimension": "HOUSE",
  "value": null,
  "unit": "栋",
  "threshold": null,
  "assessment": "pending",
  "score": null,
  "evidenceRefs": [],
  "missingInputs": []
}
```

`threshold`、`score` 允许为 `null`。

## 16. ReportSnapshot

报告快照固定一次生成输入。

```json
{
  "id": "REPORT-001",
  "projectId": "PRJ-001",
  "reportType": "comprehensive",
  "version": 1,
  "status": "draft",
  "templateVersion": "1.0.0",
  "generatedBy": "",
  "inputRefs": {
    "projectRevision": 1,
    "collectionSnapshotId": "",
    "analysisIds": [],
    "officialIssueRevisions": {},
    "spatialAnalysisIds": [],
    "indicatorRunId": null,
    "standardLibraryVersion": "1.0.0"
  },
  "completeness": {
    "complete": false,
    "missingModules": ["indicator"]
  }
}
```

状态：

```text
draft
generating
generated
failed
stale
archived
migrated_read_only
```

`migrated_read_only`保存完整`migration.originalSnapshot`、来源ID和来源指纹，不允许内容PATCH，也不把旧指标统计转换成当前指标结果。

## 17. ReportArtifact

```json
{
  "id": "ARTIFACT-001",
  "projectId": "PRJ-001",
  "reportId": "REPORT-001",
  "format": "pdf",
  "storageRef": "",
  "size": null,
  "hash": null,
  "generatedAt": "",
  "status": "ready"
}
```

## 18. WorkflowState

```json
{
  "projectId": "PRJ-001",
  "computedAt": "",
  "projectRevision": 1,
  "stages": [],
  "overall": {
    "currentStage": "collection",
    "completedCount": 0,
    "blockedCount": 0,
    "unavailableCount": 1
  }
}
```

工作流为后端计算视图，不作为重复业务数据手工维护。

## 19. 来源与证据引用

证据引用统一使用：

```json
{
  "refType": "photo",
  "refId": "PHOTO-001",
  "relation": "source-image",
  "revision": 1
}
```

`refType` 至少支持：

```text
source-asset
photo
field-record
analysis-candidate
review-action
official-issue
spatial-binding
spatial-analysis
indicator-result
report
```

## 20. 正式数据源矩阵

| 业务信息 | 唯一正式数据源 |
|---|---|
| 项目信息 | Project |
| 资料数量 | SourceAsset / Photo / FieldRecord |
| AI候选数量和置信度 | AnalysisCandidate |
| 人工复核状态 | ReviewAction + AnalysisCandidate |
| 正式问题数量 | OfficialIssue |
| GIS点位 | SpatialBinding |
| 空间统计 | SpatialAnalysisRun |
| 指标值和得分 | IndicatorResult |
| 报告内容 | ReportSnapshot |
| 报告文件 | ReportArtifact |

## 21. 版本与过期

以下上游变化会使下游结果 `stale`：

| 上游变化 | 受影响结果 |
|---|---|
| 照片增加、删除或替换 | AnalysisJob、ReportSnapshot |
| 候选重新复核 | OfficialIssue、SpatialAnalysisRun、IndicatorRun、ReportSnapshot |
| 正式问题修改 | SpatialBinding、SpatialAnalysisRun、IndicatorRun、ReportSnapshot |
| 空间绑定修改 | SpatialAnalysisRun、IndicatorRun、ReportSnapshot |
| 标准库更新 | IndicatorRun、ReportSnapshot |
| 指标引擎或规则更新 | IndicatorRun、ReportSnapshot |
| 报告模板更新 | 新报告版本 |

旧结果不物理覆盖，应保留版本并标记过期。

## 22. 并发与修订

更新对象时前端提交当前 `revision`。

成功：

```text
revision 5 → revision 6
```

若服务端已经是 revision 6，而客户端提交 revision 5：

```http
409 Conflict
```

前端提示重新加载和合并，不自动覆盖。

## 23. 删除规则

- 默认使用归档或软删除；
- 项目级删除必须明确 `projectId`；
- 禁止无条件清空所有分析记录；
- 删除照片前检查分析和报告引用；
- 删除候选不应删除审计记录；
- 正式问题删除应转换为关闭、作废或归档；
- 已被报告引用的对象保留快照引用。

## 24. Demo数据隔离

业务数据模型中不得出现：

- 百分比地图坐标；
- V9.1固定项目ID；
- 固定IMG/DEF/MAP编号；
- 固定问题数；
- 固定分数；
- 固定报告页统计。

Demo对象不迁移为业务数据库种子数据。

## 25. 与smart-renew旧数据映射

适配阶段优先映射：

| 旧数据 | 新对象 |
|---|---|
| project | Project |
| analysis-record | AnalysisJob |
| analysis result issue | AnalysisCandidate |
| photo record | Photo |
| official issue | OfficialIssue |
| report snapshot | ReportSnapshot |
| project-data records | 按 `dataType` 映射到对应新对象或字典 |

旧对象缺失的 `revision`、独立候选ID、空间运行版本等字段由适配层补充兼容值，但正式新写入应使用完整模型。

## 26. 当前待补数据模型

以下模型需要在对应模块大纲中进一步定义：

- 上传会话与分片；
- 踏勘路线；
- 空间图层；
- POI逐条人工确认状态（原始与自动清洗结果已进入SpatialAnalysisRun）；
- 指标输入快照；
- 指标计算方案；
- 报告模板；
- 整改任务和销项；
- 通用Schema升级与迁移任务队列（LegacyMigrationRun已实现）；
- 用户、角色和项目权限。

## 27. 数据模型验收

1. 六阶段对象关系完整；
2. 候选和正式问题分离；
3. GIS、指标和报告不读取Demo或页面临时值；
4. 正式问题是共同问题源；
5. 运行结果均可记录输入快照和版本；
6. 缺失指标引擎时字段允许为空；
7. 报告可以明确记录缺失模块；
8. 项目对象不承载全部子对象；
9. 更新支持revision冲突；
10. smart-renew旧数据存在明确映射边界。
