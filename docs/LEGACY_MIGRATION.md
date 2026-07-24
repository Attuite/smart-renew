# 旧数据迁移与全流程联调

## 安全原则

旧数据迁移默认只审计，不修改项目。只有请求体明确包含 `"apply": true` 才执行。

迁移使用稳定编号，可重复运行：

- 原图：`PHOTO-{analysisId}-ORIGINAL-{imageIndex}`
- 标注图：`PHOTO-{analysisId}-ANNOTATED-{imageIndex}`
- 正式问题沿用原问题编号

重复运行不会生成第二份照片或问题。

## 审计旧项目

```http
GET /api/migrations/legacy?projectId={projectId}
```

返回分析批次数量、仍嵌入的原图和标注图数量、已归档候选问题、已有照片档案、正式问题数量以及是否需要迁移。

## 应用迁移

```http
POST /api/migrations/legacy
Content-Type: application/json
```

```json
{
  "projectId": "1784512879166",
  "apply": true,
  "reviewerName": "历史数据迁移"
}
```

执行内容：

1. 将旧分析记录中的 Base64 原图拆入照片档案。
2. 将旧标注图拆入独立照片档案。
3. 分析记录改为保存 `photoIds` 和 `annotatedPhotoIds`。
4. 将原本已归档的问题写入正式问题库。
5. 按指标库规则补齐问题小类和指标大类编码。
6. 删除分析记录中的 Base64 字段。
7. 重建项目指标库索引。

## 已完成联调

```text
项目及住宅台账
→ 原图与标注图归档
→ 分析批次
→ 人工确认问题正式入库
→ 指标库重建
→ 按楼栋反查分析、照片和问题
→ 生成不可变报告 V1 快照
```

实际项目数据不会随代码更新自动迁移，应先运行审计并核对数量，再单独授权执行。
