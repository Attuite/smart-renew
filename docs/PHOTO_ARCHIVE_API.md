# 照片档案与存储接口

## 目标

- 新增照片不再长期保存在分析记录的 Base64 字段中。
- 原始照片和标注照片分别保存为独立文件。
- 每张照片必须关联项目和小区，可选关联具体楼栋。
- 分析记录只保存照片编号，问题通过照片编号追溯原图。

线上环境使用 CloudBase 云存储与 `photoRecords` 集合；本地开发环境使用独立照片目录与照片元数据文件。两种环境使用相同接口。

## 上传并归档

```http
POST /api/photos/upload
Content-Type: application/json
```

```json
{
  "photoId": "PHOTO-1784860000000-ORIGINAL-1",
  "projectId": "1784512879166",
  "communityId": "B03300Q4O6",
  "buildingId": "BLD-001",
  "analysisId": "1784860000000",
  "imageIndex": 1,
  "name": "3号楼北立面.jpg",
  "width": 1920,
  "height": 1280,
  "dataUrl": "data:image/jpeg;base64,..."
}
```

上传接口只把 Base64 当作传输内容，归档后立即拆分为照片文件和元数据，不写入分析记录。相同 `photoId` 重试不会产生第二份照片。

照片档案页面的本地上传会先按项目检查照片名称：同一次选择中的同名文件自动只保留首张；如果项目档案中已经存在同名照片，会提示用户选择继续保留上传或跳过重复照片。新建分析页面也会自动跳过同一次选择中的同名文件。

## 查询照片档案

```http
GET /api/photos?projectId={projectId}
GET /api/photos?projectId={projectId}&communityId={communityId}
GET /api/photos?projectId={projectId}&communityId={communityId}&buildingId={buildingId}
GET /api/photos?projectId={projectId}&analysisId={analysisId}
```

## 查询单张照片

```http
GET /api/photos/{photoId}
```

## 读取照片内容

```http
GET /api/photos/{photoId}/content
```

网页端通过该接口显示照片，不持久保存临时下载地址。

## 删除照片

```http
DELETE /api/photos/{photoId}
```

删除会同时清理照片文件和照片档案记录。已经被分析记录、正式问题或报告快照引用的照片会返回 `409`，以保护历史分析、问题和报告中的照片证据。

## 状态和引用

- `archived`：照片文件和元数据均已保存。
- 原始照片编号写入分析记录的 `photoIds`。
- 标注照片编号写入分析记录的 `annotatedPhotoIds`。
- 指标库中的照片、分析批次和问题记录使用这些编号互相引用。
- 从照片档案重新分析时，明确选择“加入重新分析”，不会重新上传同一原图。
