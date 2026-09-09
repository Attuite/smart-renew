# 报告工作台 API

> 统一前缀：`/api/report-studio`
> 建立日期：2026-09-09
> 状态：设计阶段，尚未实现

## 1. 数据准备

### GET /api/report-studio/projects/{projectId}/context

返回标准上下文摘要、可用数据、缺失项和来源统计。

**响应**
```json
{
  "schemaVersion": "2.0.0",
  "projectId": "...",
  "contextHash": "...",
  "project": {},
  "housing": {},
  "photos": {},
  "analyses": [],
  "officialIssues": [],
  "communityAnalysis": null,
  "availability": {
    "missingFields": [],
    "missingImageSlots": [],
    "warnings": []
  }
}
```

## 2. 计算

### POST /api/report-studio/projects/{projectId}/calculations

运行全部计算并保存快照。

**请求**
```json
{
  "contextHash": "...",
  "calculatedBy": "..."
}
```

**响应**：计算快照对象。

## 3. 草稿管理

### POST /api/report-studio/projects/{projectId}/drafts

创建报告草稿。

### GET /api/report-studio/projects/{projectId}/drafts

查询项目草稿列表。

### GET /api/report-studio/drafts/{draftId}

查询指定草稿详情。

## 4. 分段生成

### POST /api/report-studio/drafts/{draftId}/sections/{sectionId}/generate

生成或重新生成单个段落。

**请求**
```json
{
  "mode": "generate | regenerate",
  "requestedBy": "..."
}
```

## 5. 编辑与审核

### PUT /api/report-studio/drafts/{draftId}/sections/{sectionId}

保存编辑内容，使用 baseVersion 做乐观并发校验。

### POST /api/report-studio/drafts/{draftId}/sections/{sectionId}/review

审核通过。

### POST /api/report-studio/drafts/{draftId}/sections/{sectionId}/lock

锁定段落。

## 6. 校验

### POST /api/report-studio/drafts/{draftId}/validate

全文校验：解释性语言、旧项目残留、内部编号、无来源数字。

## 7. Word 导出

### POST /api/report-studio/drafts/{draftId}/exports/docx

**请求**
```json
{
  "edition": "review | formal",
  "generatedBy": "..."
}
```

### GET /api/report-studio/artifacts/{artifactId}/content

下载 Word 文件。
