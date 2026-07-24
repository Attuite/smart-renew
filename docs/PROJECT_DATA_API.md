# 智更平台指标库索引接口

## 目标

指标库用于统一管理项目档案、住宅台账、地理单元、照片、分析批次、问题、指标结果、报告和标准字典。每条数据都有稳定的 `id`，其他页面和外部系统统一从指标库通过该编号直接读取或建立引用。

## 数据结构

```json
{
  "id": "PDI-1784512879166-issue-ABC123",
  "projectId": "1784512879166",
  "dataType": "issue",
  "dataTypeLabel": "问题实例",
  "sourceId": "DEF-PROJ-0001",
  "code": "PRB-04-01",
  "title": "外墙饰面层开裂脱落",
  "tags": ["问题实例", "住房维度", "高风险"],
  "references": [
    {
      "targetId": "PDI-1784512879166-analysisRecord-DEF456",
      "relation": "来源分析批次"
    }
  ],
  "status": "confirmed",
  "source": "colleague-sqlite",
  "schemaVersion": "2.0.0",
  "payload": {},
  "createdAt": "2026-07-24T00:00:00.000Z",
  "updatedAt": "2026-07-24T00:00:00.000Z"
}
```

`payload` 保存原始字段；平台统一使用顶层字段进行跨模块索引。照片的二进制内容不进入索引，后续应存入 CloudBase 云存储，并在 `payload` 中保存文件地址和元数据。

## 接口

### 查询指标库数据

`GET /api/project-data?projectId={项目ID}&type={数据类型}&tag={标签}&communityId={小区编号}&buildingId={楼栋编号}&referenceId={关联数据编号}&q={关键词}`

可按项目、类型、标签、小区、楼栋、关联数据编号、名称和业务编码检索。例如使用 `type=building&communityId=C-1` 查询某小区下的全部楼栋。

### 读取单条数据

`GET /api/project-data/{指标库索引ID}`

这是其他页面和外部系统从指标库直接索引数据的标准接口。

### 保存标记或更新数据

`PUT /api/project-data/{指标库索引ID}`

请求体为完整的指标库索引对象。

### 删除单条指标库数据

`DELETE /api/project-data/{指标库索引ID}`

仅删除索引记录，不删除原始项目或分析记录。

### 批量导入

`POST /api/project-data/import`

```json
{
  "projectId": "1784512879166",
  "mode": "merge",
  "records": []
}
```

`merge` 按稳定编号更新或新增；`replace` 只替换外部导入数据，保留智更平台自身生成的数据。

### 同步智更平台现有数据

`POST /api/projects/{项目ID}/data-index/rebuild`

重新索引项目档案、地图范围、住宅台账、分析批次、问题实例和社区／街区分析。

### 导出指标库数据

`GET /api/projects/{项目ID}/data-export`

返回带版本号的 JSON 数据包。网页端可以进一步下载为 JSON 或 SQLite。

## CloudBase 集合

正式部署前需创建 `projectDataRecords` 集合。原有 `projects` 和 `analysisRecords` 集合保持不变。
