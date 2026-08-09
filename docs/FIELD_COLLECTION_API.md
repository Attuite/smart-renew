# 现场采集端接口

该接口供微信小程序或其他现场采集端使用。正式发布小程序前，还需要配置 AppID、登录方式、合法域名和隐私协议。

## 基本原则

- 每个任务必须关联项目和小区。
- 如果按楼栋采集，楼栋必须属于所选小区。
- 客户端生成并长期保存 `clientTaskId`，断网重试时继续使用同一编号。
- 服务端按 `项目编号 + clientTaskId` 防重复；重复提交返回原任务并标记 `duplicated: true`。
- 当前阶段只接收采集任务和照片数量，不接收照片二进制。照片上传及云存储路径在第3步接入。

## 接口清单

### 获取项目

```http
GET /api/field/projects
```

### 获取项目小区

```http
GET /api/field/projects/{projectId}/communities
```

返回稳定的小区编号、名称、地址、楼栋汇总、户数汇总和已录入楼栋明细数。

### 获取小区楼栋

```http
GET /api/field/projects/{projectId}/communities/{communityId}/buildings
```

### 创建现场采集任务

```http
POST /api/field/collection-tasks
Content-Type: application/json
```

```json
{
  "clientTaskId": "wx-20260724-device01-0001",
  "projectId": "1784512879166",
  "communityId": "community-1",
  "buildingId": "BLD-001",
  "buildingCount": 12,
  "householdCount": 960,
  "photoCount": 4,
  "location": "3号楼北侧外墙",
  "description": "现场拍摄，待上传原图",
  "collectorId": "openid-or-user-id",
  "capturedAt": "2026-07-24T02:30:00.000Z"
}
```

首次创建返回 HTTP 201：

```json
{
  "item": {
    "id": "field-task-1784512879166-wx-20260724-device01-0001",
    "status": "pending-upload",
    "syncStatus": "accepted"
  },
  "duplicated": false
}
```

断网恢复后重复提交同一 `clientTaskId` 返回 HTTP 200，`duplicated` 为 `true`，不会创建第二条任务。

### 查询同步状态

```http
GET /api/field/collection-tasks/{taskId}
```

## 小程序离线队列要求

1. 拍摄时先将任务和照片临时路径写入小程序本地存储。
2. 每个任务只生成一次 `clientTaskId`。
3. 网络可用后先创建任务，再进入照片上传步骤。
4. 超时或断线时重试原任务，禁止生成新编号。
5. 收到 `duplicated: true` 视为任务已被服务端接收。

## 后续接口

第3步将在本接口基础上增加：

- 创建照片上传凭证。
- 上传完成回调。
- 提交照片元数据。
- 查询单张照片的归档、分析和复核状态。

## 微信小程序采集端补充

### 获取住区问题分类

```http
GET /api/field/problem-types
```

返回网页住区维度使用的 6 个大类、35 个问题小类。小程序应使用返回的
`code` 和 `name`，不要另行维护一套硬编码名称。

### 创建任务新增字段

```json
{
  "problemCode": "PRB-04-01",
  "householdCount": 96,
  "photoCount": 3
}
```

服务端会补充 `problemName`、`problemGroupName` 和 `indicatorCode`。

### 完成任务

全部照片上传成功后调用：

```http
POST /api/field/collection-tasks/{taskId}/complete
Content-Type: application/json

{
  "uploadedPhotoCount": 3
}
```

小程序照片上传仍使用 `POST /api/photos/upload`，并额外传入 `taskId`、
`problemCode`、`householdCount` 和 `collectorId`。服务端会核对照片与采集任务
的小区、楼栋和问题类型，避免照片挂接错误。
