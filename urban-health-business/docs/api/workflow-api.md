# Urban Health Business 六阶段工作流接口

> 上位文档：`urban-health-business/readme.md`  
> 关联文档：`docs/api/api-conventions.md`、`docs/data-model/business-data-model.md`  
> 目标：统一六阶段状态、进度、阻塞、过期、可执行动作和跨模块依赖

## 1. 设计原则

1. 六阶段是完整业务链，不是互相独立的页面；
2. 工作流由真实数据推导；
3. 前端不自行猜测阶段状态；
4. 单一项目状态字段不能代替阶段状态；
5. 上游变化可以让下游结果过期；
6. 缺失外部模块必须显示 `unavailable`；
7. 阶段不可用不能被Demo数据标记为完成；
8. 工作流接口是只读聚合视图，业务写入仍调用对应模块接口。

## 2. 阶段标识

固定阶段ID：

```text
collection
ai-analysis
human-review
gis-and-issues
indicators
reports
```

显示顺序：

| 顺序 | 阶段ID | 名称 |
|---|---|---|
| 01 | `collection` | 资料上传与治理 |
| 02 | `ai-analysis` | AI智能识别 |
| 03 | `human-review` | 人工复核 |
| 04 | `gis-and-issues` | GIS落图与问题清单 |
| 05 | `indicators` | 指标核算 |
| 06 | `reports` | 报告生成 |

阶段ID进入接口和数据库后不得因显示名称变化而修改。

## 3. 阶段状态

```text
not_started
ready
in_progress
blocked
completed
failed
stale
unavailable
```

含义：

| 状态 | 含义 |
|---|---|
| `not_started` | 前置条件不足或尚无任何业务数据 |
| `ready` | 前置条件满足，可以开始 |
| `in_progress` | 已有进行中的业务操作 |
| `blocked` | 有明确阻塞条件，用户无法继续 |
| `completed` | 当前版本输入下已完成 |
| `failed` | 最近一次运行失败且未恢复 |
| `stale` | 曾完成，但上游数据已经变化 |
| `unavailable` | 模块或外部引擎尚未接入 |

`unavailable` 与 `blocked` 不同：

- `blocked` 表示业务条件未满足；
- `unavailable` 表示系统能力不存在或未接入。

## 4. 查询接口

```http
GET /api/projects/{projectId}/workflow
```

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `includeActions` | boolean | 否 | 是否包含可执行动作，默认true |
| `includeCounts` | boolean | 否 | 是否包含统计，默认true |

## 5. 响应模型

```json
{
  "ok": true,
  "data": {
    "projectId": "PRJ-001",
    "computedAt": "2026-07-26T08:30:00.000Z",
    "projectRevision": 5,
    "overall": {
      "currentStage": "human-review",
      "completedCount": 2,
      "blockedCount": 0,
      "unavailableCount": 1,
      "hasStaleResults": false
    },
    "stages": []
  },
  "requestId": "REQ-..."
}
```

## 6. 阶段响应结构

```json
{
  "id": "human-review",
  "number": "03",
  "title": "人工复核",
  "status": "in_progress",
  "progress": {
    "percent": 60,
    "completed": 6,
    "total": 10,
    "unit": "项"
  },
  "inputs": [
    {
      "type": "analysis-candidate",
      "count": 10,
      "ready": true
    }
  ],
  "outputs": [
    {
      "type": "official-issue",
      "count": 4
    }
  ],
  "blockers": [],
  "warnings": [],
  "staleReasons": [],
  "capability": {
    "ready": true,
    "reason": null
  },
  "actions": [
    {
      "id": "continue-review",
      "label": "继续复核",
      "enabled": true,
      "href": "/business/projects/PRJ-001/review"
    }
  ],
  "latestRun": null,
  "updatedAt": ""
}
```

## 7. Blocker结构

```json
{
  "code": "AI_ANALYSIS_INCOMPLETE",
  "message": "AI分析尚未完成。",
  "sourceStage": "ai-analysis",
  "resolvable": true,
  "actionId": "open-ai-analysis",
  "details": {}
}
```

阻塞码必须稳定，前端不通过解析 `message` 判断行为。

## 8. Warning结构

```json
{
  "code": "PHOTO_LOCATION_INCOMPLETE",
  "message": "部分照片缺少位置，不阻止AI分析，但会影响GIS落图。",
  "details": {
    "missingCount": 3
  }
}
```

警告不一定阻止当前阶段，但可能阻止下游正式完成。

## 9. Action结构

```json
{
  "id": "start-analysis",
  "label": "开始AI识别",
  "enabled": true,
  "href": "/business/projects/PRJ-001/ai-analysis",
  "method": null,
  "reasonDisabled": null
}
```

工作流接口主要返回导航和操作能力，不直接自动执行写入。

## 10. 阶段01推导规则

### 10.1 输入

- Project；
- SourceAsset；
- Photo；
- FieldRecord；
- 项目边界；
- 小区/楼栋台账；
- 位置治理结果。

### 10.2 状态建议

`not_started`：

- 项目存在，但没有任何资料、照片或外业数据。

`ready`：

- 项目已创建，可以上传资料。

`in_progress`：

- 存在上传中或治理中的资料；
- 已有资料，但尚未完成必要校验。

`blocked`：

- 存在不可恢复的资料校验错误；
- 必须的项目边界缺失且下游要求边界。

`completed`：

- 至少有一项有效输入；
- 所有正式使用的资料已入库；
- 没有阻塞级校验错误；
- 可以创建AI任务或继续非AI数据流程。

`failed`：

- 最近资料治理任务失败且没有可用结果。

`stale`：

- 一般不作为01主状态；资料变化通过下游过期体现。

### 10.3 统计

```text
assetCount
photoCount
fieldRecordCount
locatedPhotoCount
unlocatedPhotoCount
validationErrorCount
validationWarningCount
```

不得使用V9.1固定186/174/12数量。

## 11. 阶段02推导规则

### 11.1 输入

- 可分析Photo；
- AI服务能力；
- AnalysisJob。

### 11.2 状态

`not_started`：

- 没有分析任务，且资料阶段未完成。

`ready`：

- 有可分析照片；
- AI服务可用；
- 没有活动分析任务。

`in_progress`：

- 存在 `queued` 或 `running` 的AnalysisJob。

`blocked`：

- 没有可分析照片；
- 阶段01存在阻塞。

`completed`：

- 至少一个AnalysisJob完成；
- 当前照片集合没有未处理的强制分析变更；
- 候选结果可进入复核。

`failed`：

- 最近分析任务失败，且没有可用成功结果。

`stale`：

- 完成分析后照片集合或分析配置发生变化；
- 旧分析仍可查看，但不能代表当前资料版本。

`unavailable`：

- AI服务未配置或模型服务未接入。

### 11.3 统计

```text
analysisCount
activeAnalysisCount
photoTotal
photoProcessed
photoFailed
candidateCount
averageConfidence
riskCounts
pendingReviewCount
```

统计来自AnalysisJob和AnalysisCandidate。

## 12. 阶段03推导规则

### 12.1 输入

- AnalysisCandidate；
- ReviewAction；
- 正式归档能力。

### 12.2 状态

`not_started`：

- 没有候选问题。

`ready`：

- 有待复核候选；
- AI分析已经产生可复核结果。

`in_progress`：

- 已复核部分候选；
- 仍存在 `pending` 候选；
- 或正式归档正在执行。

`blocked`：

- 候选数据损坏；
- 分析尚未达到可复核状态；
- 正式归档缺少必要复核人员或必填字段。

`completed`：

- 当前纳入范围的候选全部有复核结论；
- 正式归档完成；
- 正式问题和排除记录都可以查询。

`failed`：

- 正式归档失败且处于不可自动恢复状态。

`stale`：

- 上游分析被重新执行或候选集合变化；
- 已归档结果不再对应最新分析。

### 12.3 统计

```text
candidateCount
pendingCount
confirmedCount
modifiedCount
excludedCount
supplementedCount
officialIssueCount
```

## 13. 阶段04推导规则

### 13.1 输入

- OfficialIssue；
- SpatialBinding；
- 项目边界；
- GIS能力；
- SpatialAnalysisRun。

### 13.2 状态

`not_started`：

- 没有正式问题。

`ready`：

- 有正式问题；
- 地图服务可用；
- 可以开始空间绑定。

`in_progress`：

- 部分问题尚未完成绑定；
- 或空间分析任务正在执行。

`blocked`：

- 正式问题缺少所有可用定位信息；
- 项目边界缺失且分析必须使用边界；
- 空间数据源返回阻塞级错误。

`completed`：

- 所有要求落图的问题完成绑定或有明确无需落图结论；
- 必要空间分析已完成；
- 结果与当前正式问题版本一致。

`failed`：

- 最新空间分析失败且没有可用结果。

`stale`：

- 正式问题、点位、项目边界或空间数据版本变化。

`unavailable`：

- GIS服务或正式空间数据源未接入。

### 13.3 统计

```text
officialIssueCount
bindingRequiredCount
boundCount
pendingBindingCount
confirmedBindingCount
spatialAnalysisCount
latestAnalysisStatus
```

不得固定为42/42。

## 14. 阶段05推导规则

### 14.1 输入

- 标准库；
- OfficialIssue；
- SpatialAnalysisRun；
- 项目和外业指标输入；
- 指标引擎能力；
- IndicatorRun。

### 14.2 当前状态

在指标引擎未接入期间：

```text
status = unavailable
capability.ready = false
capability.reason = indicator_engine_not_integrated
```

工作流仍返回：

- 标准库版本；
- 指标数量；
- 可准备输入；
- 缺失输入；
- 接口说明入口；
- 后续动作说明。

### 14.3 引擎接入后的状态

`not_started`：

- 尚无IndicatorRun，且输入不完整。

`ready`：

- 引擎可用；
- 输入快照可创建。

`in_progress`：

- IndicatorRun为 `queued` 或 `running`。

`blocked`：

- 必填输入缺失；
- 标准库和引擎版本不兼容。

`completed`：

- 当前输入版本对应的IndicatorRun完成。

`failed`：

- 最新运行失败且无可用结果。

`stale`：

- 正式问题、空间分析、项目输入、标准库或引擎规则变化。

### 14.4 统计

```text
standardIndicatorCount
computableCount
missingInputCount
resultCount
assessedCount
unmetCount
overallScore
```

`overallScore` 允许为 `null`。

## 15. 阶段06推导规则

### 15.1 输入

- ReportSnapshot；
- ReportArtifact；
- 01—05的当前结果引用；
- 报告引擎能力。

### 15.2 状态

`not_started`：

- 尚无报告草稿。

`ready`：

- 至少有项目和正式数据可以生成草稿。

`in_progress`：

- 报告正在生成；
- 或存在未固定的编辑草稿。

`blocked`：

- 正式报告要求的输入缺失；
- 报告模板校验失败；
- 必须的指标运行未完成。

`completed`：

- 最新数据版本对应的报告快照和必要交付物已生成。

`failed`：

- 最新生成任务失败。

`stale`：

- 项目、正式问题、空间分析、指标结果或模板变化。

`unavailable`：

- 报告引擎完全未接入。

### 15.3 指标未接入策略

如果指标引擎不可用：

- 可以生成不完整草稿；
- 工作流警告 `INDICATOR_ENGINE_UNAVAILABLE`；
- 正式报告动作禁用；
- 报告快照记录 `missingModules: ["indicator"]`；
- 不显示Demo综合分。

### 15.4 统计

```text
reportCount
draftCount
generatedCount
staleCount
artifactCount
latestReportVersion
```

## 16. overall.currentStage

推荐规则：

1. 首个 `in_progress` 阶段；
2. 否则首个 `blocked` 阶段；
3. 否则首个 `ready` 阶段；
4. `unavailable` 阶段不自动阻止显示后续可预览模块；
5. 全部完成时为 `reports`；
6. 若报告完成但上游过期，currentStage指向最早的 `stale` 阶段。

## 17. 过期传播

```mermaid
flowchart LR
    C["01资料变化"] --> A["02 AI stale"]
    A --> H["03复核 stale"]
    H --> G["04 GIS stale"]
    G --> I["05指标 stale"]
    I --> R["06报告 stale"]
```

传播不是无条件删除旧结果，而是：

- 保留旧版本；
- 标记 `stale`；
- 说明原因；
- 提供重新运行或重新确认动作。

## 18. 工作流刷新触发

以下事件后重新计算工作流：

- 项目创建或更新；
- 资料上传完成；
- 照片位置更新；
- AI任务状态变化；
- 候选复核；
- 正式归档；
- 正式问题修改；
- GIS绑定；
- 空间分析完成；
- 指标运行完成；
- 报告生成；
- 报告模板变化；
- 服务能力变化。

前端在业务写入成功后重新请求工作流，不自行局部修改阶段为完成。

## 19. 工作流缓存

可以短期缓存工作流结果，但必须包含：

- `computedAt`；
- `projectRevision`；
- 相关运行版本；
- 缓存失效事件。

不能让缓存长期掩盖后端状态变化。

## 20. 模块未接入状态

模块未接入时必须提供：

```json
{
  "status": "unavailable",
  "capability": {
    "ready": false,
    "reason": "indicator_engine_not_integrated",
    "documentation": "/docs/modules/05-indicator-engine-integration.md"
  },
  "blockers": [],
  "warnings": []
}
```

前端显示：

- 模块名称；
- 未接入原因；
- 当前已经具备的数据；
- 缺失能力；
- 接口说明；
- 对后续正式结果的影响。

不得显示伪造进度或固定结果。

## 21. 典型完整响应

```json
{
  "ok": true,
  "data": {
    "projectId": "PRJ-001",
    "computedAt": "2026-07-26T08:30:00.000Z",
    "projectRevision": 5,
    "overall": {
      "currentStage": "gis-and-issues",
      "completedCount": 3,
      "blockedCount": 0,
      "unavailableCount": 1,
      "hasStaleResults": false
    },
    "stages": [
      {
        "id": "collection",
        "number": "01",
        "title": "资料上传与治理",
        "status": "completed",
        "progress": {
          "percent": 100,
          "completed": 12,
          "total": 12,
          "unit": "项"
        },
        "blockers": [],
        "warnings": [],
        "staleReasons": [],
        "capability": {
          "ready": true,
          "reason": null
        },
        "actions": []
      },
      {
        "id": "indicators",
        "number": "05",
        "title": "指标核算",
        "status": "unavailable",
        "progress": {
          "percent": null,
          "completed": 0,
          "total": 61,
          "unit": "项"
        },
        "blockers": [],
        "warnings": [],
        "staleReasons": [],
        "capability": {
          "ready": false,
          "reason": "indicator_engine_not_integrated"
        },
        "actions": [
          {
            "id": "view-indicator-readiness",
            "label": "查看指标数据准备情况",
            "enabled": true,
            "href": "/business/projects/PRJ-001/indicators"
          }
        ]
      }
    ]
  },
  "requestId": "REQ-..."
}
```

实际响应必须始终返回六个阶段，示例为节省篇幅省略了部分阶段。

## 22. 前端使用规则

前端：

- 使用阶段ID定位模块；
- 使用status决定状态样式；
- 使用actions生成可操作入口；
- 使用blocker code决定恢复引导；
- 不根据固定阶段顺序自行判断完成；
- 不使用Demo时间轴修改Business状态；
- 不在刷新失败时回退到上次Demo状态。

## 23. 契约测试

至少覆盖：

1. 空项目；
2. 只有照片的项目；
3. AI服务不可用；
4. AI任务执行中；
5. 部分候选待复核；
6. 正式归档完成；
7. GIS部分绑定；
8. GIS结果过期；
9. 指标引擎未接入；
10. 指标引擎接入后的运行中和完成；
11. 不完整报告草稿；
12. 正式报告完成；
13. 上游修改导致报告过期；
14. 本地和云端返回相同结构；
15. 所有响应均无Demo固定数据。

## 24. 工作流接口验收

1. 每个项目始终返回六阶段；
2. 阶段状态由真实数据推导；
3. 候选、正式问题和报告口径分离；
4. 阻塞与模块不可用可以区分；
5. 指标引擎未接入时返回 `unavailable`；
6. 过期原因可以追溯到上游变化；
7. 前端无需调用多个接口猜测阶段状态；
8. 不使用固定数量和固定分数；
9. 工作流动作能引导用户恢复或继续；
10. 工作流接口只聚合，不替代模块正式写入接口。
