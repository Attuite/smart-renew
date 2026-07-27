# AI 复核与正式问题接口

## 数据边界

AI 返回内容先保存在分析批次的 `reviewIssues` 中，属于候选问题。候选问题不计入指标统计和体检报告。

人工操作分为：

- `accepted`：确认 AI 判断。
- `modified`：人工修正类型、指标编码、等级、位置或建议后确认。
- `rejected`：判定为误报，不进入正式问题库。

## 正式入库

```http
POST /api/issues/finalize
Content-Type: application/json
```

```json
{
  "analysisId": "1784860000000",
  "reviewerName": "复核人员姓名",
  "issues": [
    {
      "id": "issue-1784860000000-1",
      "reviewStatus": "modified",
      "problemCode": "PRB-04-01",
      "indicatorCode": "IND-HOUSE-004",
      "imageIndex": 1
    }
  ]
}
```

服务端根据分析批次补充项目、小区、楼栋、原始照片和标注照片编号，并重新校验 `problemCode` 与指标库大类的关系。

## 查询正式问题

```http
GET /api/issues?projectId={projectId}
GET /api/issues?projectId={projectId}&communityId={communityId}
GET /api/issues?projectId={projectId}&buildingId={buildingId}
GET /api/issues?projectId={projectId}&indicatorCode={indicatorCode}
```

## 正式问题必备字段

- 项目、小区、楼栋和分析批次编号。
- 原始照片、标注照片编号。
- 指标库问题编码和国标指标大类编码。
- 风险等级、置信度、位置框和整改建议。
- 复核状态、复核人员和复核时间。

任何缺少指标库编码或原始照片编号的候选问题都会被拒绝正式入库。
