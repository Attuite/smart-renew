# Urban Health Business 开发总纲

> 项目代号：Urban Health Business  
> 开发分支：`urban-health-business`  
> 文档性质：全过程开发、迁移与后续模块大纲的最高层指导文件  
> 当前基线：V9.1 城市数智体检 Demo + smart-renew 本地最新版核心能力  
> 更新原则：架构或业务边界发生变化时，先更新本总纲，再更新模块开发大纲和代码

当前实现进度、可运行链路和剩余缺口以
[docs/development-status.md](docs/development-status.md) 为准；当前BFF实际接口以
[docs/api/business-bff-api.md](docs/api/business-bff-api.md) 为准。

---

## 1. 项目目标

本项目以 V9.1 城市数智体检 Demo 的视觉体系、六阶段工作台和业务表达为前端基底，复用原 `smart-renew` 可用能力并增量构建一套可连接真实后端、真实数据库、真实照片、真实 AI 分析、真实 GIS 数据和真实报告快照的业务系统。

最终目标不是完成某一个阶段或制作另一个演示页面，而是完成以下全过程：

```text
项目创建与资料治理
→ 照片和外业数据入库
→ AI智能识别
→ 人工复核
→ 正式问题入库
→ GIS落图与空间分析
→ 指标核算
→ 报告编辑、生成与版本归档
```

对于当前尚不具备实现条件的模块，必须：

1. 明确定义模块边界；
2. 预留稳定接口；
3. 提供接口和数据结构说明文档；
4. 在界面中显示真实的“待接入”状态；
5. 禁止使用 V9.1 固定演示数据伪装成业务结果；
6. 统一登记到本文末尾的“待开发模块汇总”中。

---

## 2. 基线与不可变约束

### 2.1 原版 smart-renew 暂不修改

新版项目位于 smart-renew Git 仓库根目录下的独立目录：

```text
urban-health-business/
```

在当前迁移期内，不修改原版 smart-renew 的：

- 根目录 `index.html`；
- 根目录 `server.mjs`；
- 根目录 `package.json`；
- 原 `assets/`；
- 原 `functions/`；
- 原核心模块、接口文档和部署文件。

新版项目必须拥有独立的：

- 前端入口；
- 后端适配层；
- `package.json`；
- 开发与构建命令；
- 接口契约；
- 测试；
- 文档；
- 部署配置。

若未来需要修改或抽取原版公共核心，必须单独评审，不得在迁移过程中顺带修改。

### 2.2 V9.1 Demo 模式保持不变

V9.1 Demo 继续承担：

- 离线展示；
- 60秒自动演示；
- 六阶段视觉和交互参考；
- 固定演示数据复现；
- 设计验收基准。

Demo 源文件纳入新版项目时应作为只读快照保存，并通过文件哈希校验防止误改。

业务模式不得修改、复用或依赖 Demo 的运行时状态。

### 2.3 业务模式禁止使用固定演示结果

业务模式不得引用或生成以下固定内容：

- 预设6张示例照片；
- 固定43个AI候选问题；
- 固定 `6 / 18 / 19` 风险分布；
- 固定 `92.6%` 平均置信度；
- 西安地图背景图；
- 百分比相对坐标；
- 固定项目边界；
- 固定42个问题点；
- 固定500/800/1000米分析结果；
- 固定10个演示指标；
- 固定问题—指标映射；
- 固定扣分值、权重和阈值；
- 固定78、84、82.4和82.7分；
- `IMG-XA-*`、`DEF-*`、`MAP-*` 等 Demo 证据编号。

业务数据为空时必须显示空状态、待补录或待接入，不得回退到 Demo 数据。

---

## 3. 最终交付形态

新版项目最终应提供两个互相隔离的入口：

```text
/demo/       V9.1固定演示模式
/business/   真实业务模式
```

### 3.1 Demo 模式

- 保持 V9.1 原有功能；
- 支持自动演示和手动演示；
- 可以断网运行；
- 不连接业务数据库；
- 不向业务后端写入数据；
- 明确标记为 Demo。

### 3.2 Business 模式

- 只读取真实项目和真实业务数据；
- 所有正式写入通过后端完成；
- 页面刷新、浏览器切换后数据仍存在；
- 不允许静默回退到 Demo 或浏览器临时数据；
- 后端不可用时明确提示连接状态和受影响模块；
- 六阶段状态由真实数据和后端工作流接口决定。

---

## 4. 目标目录结构

```text
urban-health-business/
├─ readme.md
├─ package.json
├─ .gitignore
│
├─ apps/
│  ├─ demo-v9.1/
│  │  ├─ index-v9.1.html
│  │  ├─ app-v9.1.js
│  │  ├─ styles-v9.1.css
│  │  ├─ build-v9.1.mjs
│  │  ├─ manifest-v9.1.txt
│  │  └─ assets/
│  │
│  └─ business/
│     ├─ index.html
│     ├─ public/
│     └─ src/
│        ├─ app/
│        ├─ api/
│        ├─ components/
│        ├─ store/
│        ├─ workflow/
│        ├─ styles/
│        └─ modules/
│           ├─ project/
│           ├─ collection/
│           ├─ ai-analysis/
│           ├─ review/
│           ├─ gis/
│           ├─ indicators/
│           └─ reports/
│
├─ server/
│  ├─ index.mjs
│  ├─ config/
│  ├─ middleware/
│  ├─ routes/
│  ├─ services/
│  └─ adapters/
│     └─ smart-renew/
│
├─ packages/
│  ├─ api-contracts/
│  ├─ business-models/
│  ├─ workflow-core/
│  └─ validation/
│
├─ docs/
│  ├─ architecture/
│  ├─ api/
│  ├─ modules/
│  ├─ data-model/
│  └─ deferred/
│
├─ scripts/
│  ├─ verify-demo-integrity.mjs
│  └─ verify-project-boundary.mjs
│
└─ tests/
   ├─ contract/
   ├─ integration/
   ├─ e2e/
   └─ fixtures/
```

目录可以随实现细化，但必须保持以下边界：

- `apps/demo-v9.1` 不承载业务代码；
- `apps/business` 不引用 Demo 数据；
- `server/adapters/smart-renew` 隔离旧接口差异；
- `packages/api-contracts` 是前后端共同遵守的接口定义；
- 待接入能力直接在对应的 `docs/modules/` 模块大纲中标注为 C/D 级，并统一汇总到本总纲的“后续开发模块汇总”，不另建空置的占位目录。

---

## 5. 总体架构

```text
Business 前端
    │
    │ 同源 /api
    ▼
新版 Backend For Frontend
    ├─ 工作流与聚合接口
    ├─ 新版统一错误处理
    ├─ smart-renew旧接口适配
    ├─ 待开发模块占位接口
    └─ 后续独立业务服务
            │
            ├─ smart-renew现有本地接口
            ├─ CloudBase数据库与对象存储
            ├─ 千问视觉模型
            ├─ 高德地图/GIS数据源
            ├─ 指标计算引擎（待接入）
            └─ 报告/PDF服务（待完善）
```

### 5.1 前端原则

- 页面组件不直接散布 `fetch()`；
- 统一通过 `src/api/` 调用接口；
- 模块状态不得由固定时间轴决定；
- 六阶段进度来自 `/workflow`；
- 所有列表必须支持加载、空、失败和部分完成状态；
- 正式操作失败时不得伪装成功；
- 不把大型照片Base64长期保存在页面状态中；
- 不在前端自行生成正式业务编号；
- 不在不同页面重复实现同一统计口径。

### 5.2 后端原则

- 对业务前端提供统一、稳定的接口；
- 旧接口差异由适配层消化；
- 关键写入支持幂等；
- 正式归档由后端编排，不由前端串联多次写入；
- 聚合统计由后端生成；
- 项目级操作必须显式携带 `projectId`；
- 正式数据不允许通过全局无条件删除接口清除；
- 大数据列表支持过滤、查询和分页；
- 每次指标运行、空间分析和报告生成都记录输入版本。

---

## 6. 全过程业务工作流

六阶段是业务工作流，不是开发批次。最终系统必须完成全过程连接。

### 6.1 工作流状态

每一阶段统一使用：

```text
not_started   未开始
ready         前置条件满足，可开始
in_progress   进行中
blocked       被明确条件阻塞
completed     已完成
failed        执行失败
stale         上游数据变化，原结果已过期
unavailable   模块或外部引擎尚未接入
```

### 6.2 工作流接口

目标接口：

```http
GET /api/projects/{projectId}/workflow
```

返回至少包括：

- 阶段编号和名称；
- 当前状态；
- 完成比例；
- 输入数量；
- 输出数量；
- 阻塞原因；
- 是否存在过期结果；
- 可执行动作；
- 相关记录编号；
- 最后更新时间。

阶段状态由后端根据真实记录推导，不只依赖项目表中的单一状态字段。

---

## 7. 公共业务数据模型

所有正式对象至少包含：

```text
id
projectId
status
createdAt
updatedAt
revision
source
schemaVersion
```

项目主链对象：

1. `Project`：项目、边界、基本信息和业务状态；
2. `SourceAsset`：上传资料、调查表、GIS文件和其他原始材料；
3. `Photo`：原始照片、标注照片、EXIF、位置和存储信息；
4. `FieldRecord`：外业采集记录；
5. `AnalysisJob`：AI分析任务；
6. `AnalysisCandidate`：AI候选问题；
7. `ReviewAction`：人工复核动作和修改日志；
8. `OfficialIssue`：人工确认后的正式问题；
9. `SpatialBinding`：问题与真实空间对象的绑定；
10. `SpatialAnalysisRun`：空间分析输入、参数、来源和结果版本；
11. `IndicatorRun`：指标计算任务和输入快照；
12. `IndicatorResult`：单项指标结果和证据引用；
13. `ReportSnapshot`：报告生成时的数据快照；
14. `ReportArtifact`：HTML、PDF、清单等交付物；
15. `WorkflowState`：项目六阶段状态和阻塞信息。

前端不得把所有对象重新塞回一个大型 `Project` 对象整体保存。

---

## 8. 统一接口契约

### 8.1 服务能力

```http
GET /api/meta
```

应返回：

- API版本；
- 数据结构版本；
- 后端构建版本；
- 数据库状态；
- 本地文件存储状态与对象存储接入状态；
- AI状态；
- GIS状态；
- 指标引擎状态；
- 报告引擎状态；
- 支持的功能列表。

### 8.2 成功响应

```json
{
  "ok": true,
  "data": {},
  "requestId": "REQ-..."
}
```

### 8.3 失败响应

```json
{
  "ok": false,
  "error": {
    "code": "BUSINESS_ERROR_CODE",
    "message": "用户可理解的错误说明",
    "details": {}
  },
  "requestId": "REQ-..."
}
```

### 8.4 接口通用要求

- 时间统一使用 ISO 8601；
- ID统一使用字符串；
- 列表使用 `items + nextCursor`；
- 关键写入接受 `idempotencyKey`；
- 并发更新使用 `revision`；
- 版本冲突返回 `409`；
- 不可用模块返回明确错误码，不返回伪造数据；
- 接口文档必须包含请求、响应、错误码和示例；
- 本地和云端必须使用同一接口契约。

---

## 9. 项目与工作台公共模块

业务模式首先建立项目上下文，但目标覆盖全部六阶段。

公共能力包括：

- 项目列表；
- 项目创建和编辑；
- 当前项目切换；
- 项目边界绘制和导入；
- 小区、楼栋和空间层级台账；
- 六阶段状态总览；
- 服务连接状态；
- 数据完整度；
- 最近操作和结果版本；
- 跨阶段证据追溯。

目标接口：

```http
GET    /api/projects
POST   /api/projects
GET    /api/projects/{projectId}
PATCH  /api/projects/{projectId}
GET    /api/projects/{projectId}/summary
GET    /api/projects/{projectId}/workflow
```

原 smart-renew 的整对象 `PUT` 可由适配层临时兼容，新版前端统一采用 `PATCH + revision` 语义。

---

## 10. 阶段01：资料上传与空间采集治理

### 10.1 目标

接入真实资料，形成可被AI、GIS、指标和报告继续使用的标准化项目数据基础。

### 10.2 输入

- 项目基本信息；
- 项目边界；
- 现场照片；
- 无人机影像；
- 外业调查表；
- GIS文件；
- 小区和楼栋台账；
- EXIF定位；
- 踏勘路线；
- 历史资料。

### 10.3 核心功能

- 真正的文件选择、批量上传和失败重试；
- 文件类型、大小和重复校验；
- 照片压缩但保留原始文件关系；
- EXIF解析；
- 缺失坐标识别；
- 人工补点；
- 踏勘路线导入和清洗；
- 照片—点位—路线—小区—楼栋绑定；
- 资料完整度检查；
- 来源登记；
- 入库结果查询。

### 10.4 目标接口

```http
GET  /api/projects/{projectId}/assets
POST /api/projects/{projectId}/assets
POST /api/uploads
PUT  /api/uploads/{uploadId}
POST /api/uploads/presign
POST /api/photos
GET  /api/photos?projectId={projectId}
PATCH /api/photos/{photoId}
POST /api/projects/{projectId}/collection/validate
GET  /api/projects/{projectId}/collection/summary
```

当前Business前端已通过持久化上传会话发送原始文件，BFF内部仍以原smart-renew Base64接口作为存储适配；最终目标是分片或预签名直传对象存储。

### 10.5 完成条件

- 真实资料已经持久化；
- 照片可跨浏览器查询；
- 每张照片有明确的位置状态；
- 资料完整度来自真实数据；
- 下游AI任务可以引用 `photoId`；
- 不出现186张、174张、12张等Demo锁定数量。

---

## 11. 阶段02：AI智能识别

### 11.1 目标

对当前项目的真实照片执行AI视觉分析，生成可人工复核的候选问题。

### 11.2 核心功能

- 选择照片和分析范围；
- 创建分析任务；
- 任务队列和执行状态；
- 按照片显示处理进度；
- 失败照片重试；
- 候选问题列表；
- 识别框和原图关联；
- 问题类型、风险等级、置信度和建议指标；
- 模型名称、提示词版本和分析时间记录；
- 分析结果不可直接进入正式统计。

### 11.3 目标接口

```http
POST /api/projects/{projectId}/analyses
GET  /api/analyses/{analysisId}
GET  /api/analyses/{analysisId}/candidates
POST /api/analyses/{analysisId}/retry
POST /api/analyses/{analysisId}/cancel
```

原 `/api/vision/analyze` 和 `/api/analysis-records` 由适配层兼容。

### 11.4 动态统计

以下数据必须由当前分析结果计算：

- 分析照片数；
- 已处理照片数；
- 候选问题数；
- 风险分布；
- 平均置信度；
- 重点待复核数；
- 失败数。

### 11.5 完成条件

- AI任务有明确状态；
- 候选问题与真实照片关联；
- 刷新页面后分析任务仍可查询；
- 不再加载预设6张图片和43个候选问题；
- AI失败不会自动显示Demo结果。

---

## 12. 阶段03：人工复核

### 12.1 目标

保留AI原始结果，通过人工确认、修改、排除和补录，形成正式问题。

### 12.2 核心功能

- 待复核任务列表；
- 原始照片和AI框选；
- 确认问题；
- 修改问题类型、等级、说明和位置；
- 排除误报；
- 补录漏报；
- 复核人员和复核时间；
- 修改前后差异；
- 完整复核日志；
- 批量操作；
- 正式归档。

### 12.3 目标接口

```http
PATCH /api/analysis-candidates/{candidateId}/review
POST  /api/analyses/{analysisId}/candidates
GET   /api/analyses/{analysisId}/review-summary
POST  /api/analyses/{analysisId}/finalize
```

### 12.4 正式归档要求

正式归档必须由后端一次性或可恢复地完成：

1. 保存标注照片引用；
2. 固定复核结果；
3. 生成正式问题；
4. 保存复核日志；
5. 更新分析任务状态；
6. 更新项目工作流；
7. 刷新项目统计。

接口必须支持幂等，避免重复点击生成重复正式问题。

### 12.5 完成条件

- AI原始候选未被覆盖；
- 每次人工修改可以追溯；
- 排除项不进入正式问题统计；
- 正式问题成为后续GIS、指标和报告的唯一问题数据源。

---

## 13. 阶段04：GIS落图与问题清单

### 13.1 目标

将正式问题绑定到真实坐标和真实空间对象，并形成可复现的空间分析结果。

### 13.2 核心功能

- 使用真实地图服务；
- 显示项目真实边界；
- 正式问题点位；
- 点位人工移动和确认；
- 坐标来源、坐标系和变更记录；
- 小区、楼栋、街区和道路绑定；
- 风险、类型和状态过滤；
- 问题详情与证据链；
- 周边服务和空间条件分析；
- 空间分析来源、参数和版本登记。

### 13.3 坐标要求

必须保存：

- 原始坐标；
- 原始坐标系；
- 地图显示坐标；
- 转换方式；
- 定位来源；
- 人工调整前后位置；
- 定位精度；
- 关联空间对象。

禁止使用百分比坐标作为正式数据。

### 13.4 目标接口

```http
GET   /api/issues?projectId={projectId}
GET   /api/issues/{issueId}
PATCH /api/issues/{issueId}/geometry
POST  /api/issues/{issueId}/spatial-bindings
POST  /api/projects/{projectId}/spatial-analyses
GET   /api/spatial-analyses/{analysisId}
GET   /api/projects/{projectId}/spatial-summary
```

### 13.5 真实空间分析要求

500/800/1000米或其他半径只能作为参数，结果必须记录：

- 输入点位；
- 分析半径；
- 数据源；
- 查询时间；
- 原始结果；
- 去重和清洗规则；
- 人工确认；
- 最终统计；
- 分析版本。

### 13.6 完成条件

- 地图不使用西安背景图；
- 项目边界来自当前项目；
- 问题点来自正式问题；
- 空间结论可复现；
- 不显示固定42点和固定缓冲区结果。

---

## 14. 阶段05：指标核算

### 14.1 当前策略

指标阶段保留完整工作台位置、业务状态、接口契约和说明文档，但不在指标引擎完成前实现虚假计算。

smart-renew 当前标准库提供：

- 4个体检维度；
- 14个体检要素；
- 61个指标；
- 问题分类和问题类型；
- 整治建议；
- 少量严重程度规则；
- 状态和类型码表。

但多数指标的：

- 权重；
- 达标阈值；
- 归一化方法；
- 综合评分规则；
- 缺失值处理；
- 跨维度汇总方法

尚未形成可直接运行的通用指标计算引擎。

### 14.2 待接入界面

引擎未就绪时，界面显示：

- 标准库版本；
- 指标数量和维度；
- 项目数据准备度；
- 可计算指标数；
- 缺失数据项；
- 引擎连接状态；
- “指标引擎待接入”说明；
- 接口文档入口。

不得显示78、84、82.4等Demo结果。

### 14.3 预留接口

```http
GET  /api/indicator-engine/capabilities
GET  /api/standards/indicators
GET  /api/standards/indicators/{indicatorCode}
POST /api/projects/{projectId}/indicator-runs
GET  /api/indicator-runs/{runId}
GET  /api/indicator-runs/{runId}/results
POST /api/indicator-runs/{runId}/cancel
```

### 14.4 预留运行模型

```json
{
  "id": "RUN-001",
  "projectId": "PRJ-001",
  "status": "completed",
  "engineVersion": "1.0.0",
  "standardLibraryVersion": "1.0.0",
  "inputSnapshotId": "SNAPSHOT-001",
  "results": [
    {
      "indicatorCode": "IND-HOUSE-001",
      "dimension": "HOUSE",
      "value": 3,
      "unit": "栋",
      "threshold": null,
      "assessment": "pending",
      "score": null,
      "evidenceRefs": []
    }
  ],
  "summary": null
}
```

`threshold`、`score` 和 `summary` 必须允许为空，前端不得假设引擎一定返回综合分。

### 14.5 完成条件

在外部指标引擎未完成前，本模块的完成定义为：

- 接口契约已固定；
- 数据输入快照结构已定义；
- 工作台能正确显示未接入状态；
- 不使用Demo指标；
- 不阻塞阶段01—04开发；
- 正式报告明确识别指标缺失。

引擎接入后的正式完成条件另由指标模块开发大纲定义。

---

## 15. 阶段06：报告编辑、生成与归档

### 15.1 目标

使用一次固定的数据快照生成可审查、可追溯和可重复导出的项目报告。

### 15.2 报告输入

- 项目基本信息；
- 资料治理统计；
- 照片和外业数据；
- AI分析版本；
- 正式问题；
- GIS绑定和空间分析；
- 指标运行结果或指标缺失状态；
- 标准库版本；
- 报告模板版本；
- 生成人员。

### 15.3 核心功能

- 综合报告、专项报告和空间分析报告；
- 真实数据驱动模板；
- 章节启用和排序；
- 页面组件配置；
- 证据引用；
- 数据来源说明；
- 报告校验；
- 数据变更后标记旧报告过期；
- 报告快照；
- 版本列表；
- HTML导出；
- PDF导出；
- 报告清单；
- 生成失败重试。

### 15.4 目标接口

```http
POST /api/projects/{projectId}/reports
GET  /api/projects/{projectId}/reports
GET  /api/reports/{reportId}
POST /api/reports/{reportId}/generate
GET  /api/reports/{reportId}/artifacts
GET  /api/reports/{reportId}/export?format=html
GET  /api/reports/{reportId}/export?format=pdf
```

原 `/api/reports/generate` 和报告快照核心由适配层复用。

### 15.5 指标未接入时

- 允许生成“数据不完整草稿”；
- 草稿必须明确标注指标引擎未接入；
- 指标章节显示缺失原因；
- 不允许标记为正式报告；
- 不允许输出无依据的综合分；
- 正式报告生成必须等待指标模块完成，或由业务规则明确允许无指标报告。

### 15.6 完成条件

- 报告不引用Demo锁定数据；
- 报告数据来自固定快照；
- 报告能追溯到正式问题、空间分析和指标运行；
- 上游数据变化后旧报告显示 `stale`；
- 导出结果与页面预览数据一致。

---

## 16. 前后端连接专项要求

### 16.1 单一API入口

业务前端统一调用：

```text
/api/...
```

不得在模块中硬编码：

- `127.0.0.1`；
- CloudBase静态站点域名；
- CloudBase函数域名；
- 环境相关端口。

开发和部署环境通过新版服务器或代理配置API目标。

### 16.2 smart-renew适配层

适配层负责：

- 旧接口到新接口的路径转换；
- 字段名称转换；
- 旧响应到统一响应结构的转换；
- 数字ID到字符串ID的兼容；
- 旧接口能力缺失的明确提示；
- 旧接口错误码转换；
- 新版分页和过滤的临时兼容。

前端不得知道自己是否正在调用旧接口。

### 16.3 禁止静默本地降级

Business模式的正式流程不得在后端失败时静默保存到浏览器。

允许的本地能力只包括：

- 未提交表单草稿；
- UI偏好；
- 尚未正式提交的编辑状态；
- 可见的待同步上传队列。

正式项目、正式问题、报告快照和指标结果必须以后端为准。

### 16.4 关键流程后端编排

以下流程不得由前端自行串联多个写入：

- 分析正式归档；
- 正式问题生成；
- 空间分析结果固化；
- 指标运行；
- 报告快照和交付物生成。

这些流程应提供单一业务接口、幂等键和可恢复状态。

---

## 17. 迁移方法

### 17.1 可迁移内容

从V9.1迁移：

- 整体视觉语言；
- 顶部导航；
- 六阶段导航；
- 阶段说明抽屉；
- 工作台布局；
- 侧栏、列表、详情和地图布局；
- 人工复核交互模式；
- 报告编辑器交互模式；
- 响应式设计；
- 空、加载、成功和失败状态的视觉基础。

从smart-renew复用：

- 项目核心数据；
- 照片存储核心；
- CloudBase数据库与对象存储实现；
- AI视觉分析能力；
- 20张拆批、候选规范化和去重算法；
- 分析记录；
- 人工复核交互和标注图派生；
- 正式问题核心；
- 项目统一数据索引；
- JSON和SQLite导入导出；
- 高德地图边界绘制、地理编码和POI检索清洗；
- 报告快照核心；
- 动态报告章节渲染；
- 外业采集核心；
- 迁移核心；
- 城市体检标准库。

复用范围、证据、等级和限制以[原smart-renew能力复用对照审计](docs/original-smart-renew-reuse-audit.md)为准。本次开发只直接实施审计中A、B等级能力，执行范围以[A/B等级复用优先开发大纲](docs/reuse-first-ab-development-outline.md)为准。

复用不等于回退旧架构。原版没有revision、候选级审计、零问题结论、stale传播或一致性保证时，继续保留Business现有增强实现。

### 17.2 不迁移内容

从V9.1业务模式中排除：

- 固定城市项目列表；
- 所有固定分析结果；
- 自动演示时间轴；
- Demo数据完整性锁定校验；
- 固定照片和地图资源；
- 固定指标计算；
- 固定报告统计；
- Demo调试状态。

### 17.3 迁移顺序原则

“全过程开发”不等于同时在所有文件中无边界改动。迁移时按依赖关系推进，但始终以六阶段完整闭环为最终验收目标：

1. 先建立公共模型和接口契约；
2. 先查询原smart-renew是否已有可复用接口、纯函数、算法或数据；
3. 为项目、照片、分析、候选、正式问题、报告等对象确定唯一主数据源；
4. 优先通过HTTP适配，其次直接复用纯函数，再进行最小算法抽取；
5. 建立Business前端壳和工作流，逐模块迁移视觉结构；
6. 用真实接口替换对应Demo状态；
7. 对原版确实缺失的引擎建立接口和说明；
8. 完成跨模块联调；
9. 以全过程E2E验收，而不是以某一个阶段页面完成作为项目完成。

---

## 18. 模块开发大纲编写规范

后续每个模块在开发前必须生成独立模块开发大纲，至少包含：

1. 模块目标；
2. 业务范围和非目标；
3. 用户角色；
4. 前置条件；
5. 完整用户流程；
6. 页面、组件和交互；
7. 输入数据；
8. 输出数据；
9. 状态机；
10. 数据模型；
11. 前端服务；
12. 后端服务；
13. API请求、响应和错误码；
14. 与其他阶段的依赖；
15. 原smart-renew实现证据和复用等级；
16. 复用方式、来源文件和目标适配层；
17. 主数据源及禁止双写规则；
18. V9.1迁移内容；
19. 必须剥离的Demo内容；
20. 空状态、失败状态和恢复策略；
21. 数据一致性和幂等要求；
22. 测试用例；
23. 验收标准；
24. 当前缺失能力；
25. 本次A/B开发任务；
26. C/D后续任务和外部条件。

模块大纲不得只描述页面，不得跳过数据来源、后端接口、异常状态、复用证据和唯一主数据源。已经被实际代码完成或被复用审计推翻的内容必须删除或更新，不得长期保留为“当前缺失”。

---

## 19. 测试与验收

### 19.1 Demo完整性测试

- Demo文件哈希保持一致；
- 60秒演示正常；
- Demo断网可运行；
- Business代码未进入Demo包；
- Demo操作不会写业务数据库。

### 19.2 Business固定数据排除测试

业务构建产物不得包含：

```text
IMG-XA-001
DEF-021
MAP-021
西仪厂城市更新改造项目
6 / 18 / 19
92.6%
82.4
xian-city-map.jpg
```

### 19.3 接口契约测试

- 前后端使用同一契约；
- 本地和云端返回结构一致；
- 缺失模块返回 `unavailable` 或明确错误；
- 不返回Demo兜底数据；
- 所有关键接口覆盖失败用例。

### 19.4 全过程E2E测试

最终必须自动验证：

```text
新建真实项目
→ 绘制或导入边界
→ 上传真实照片
→ 查看照片入库
→ 创建AI任务
→ 获得候选问题
→ 人工确认、修改和排除
→ 正式问题入库
→ 问题GIS落图
→ 执行或识别空间分析状态
→ 执行或识别指标引擎状态
→ 生成报告草稿
→ 固定报告快照
→ 导出报告
```

### 19.5 数据一致性验收

- 项目总览、问题列表、GIS和报告使用相同正式问题口径；
- AI候选问题不直接进入正式统计；
- 被排除问题不进入GIS、指标和正式报告；
- 报告引用的数据版本可查询；
- 页面刷新后所有正式状态保持；
- 切换项目后不串数据；
- 多次点击正式归档不产生重复问题。

---

## 20. 当前待开发模块汇总

当前待开发项分为两个清单：

1. 本次实施的A/B等级复用工作包；
2. 暂不实施的C/D等级能力和外部模块。

### 20.1 本次A/B等级增量开发范围

下表的“现有基线”已经完成，不属于待重写内容。本次开发只实施最后一列：

| 工作包 | Business现有基线 | 本次增量目标 |
|---|---|---|
| 主数据源与适配基础 | SmartRenewClient、上游代理、`/api/meta` | 补齐专项适配、唯一主数据源读取规则和契约 |
| ProjectData与结构化数据交换 | 集合读取、SourceAsset治理、项目JSON汇总导出 | JSON/SQLite导入导出、统一索引、搜索和引用重建 |
| 外业任务和照片存储核心 | WebP上传、上传会话、归属校验、哈希和本地持久化 | 外业任务BFF、原核心适配、规则收敛和CloudBase存储契约 |
| 高德地图和项目边界 | 边界校验、面积/中心、修订历史、GeoJSON和SVG预览 | 地图Provider、地址定位、交互绘制、底图回显和范围检索 |
| POI检索与清洗 | 参数化半径分析、快照和stale | POI分页查询、清洗、去重和来源快照 |
| AI拆批、规范化和去重 | 20张以内异步任务、类别/BBox规范化、Candidate和动态统计 | 超过20张自动拆批、跨批合并、IoU去重和批次元数据 |
| 人工复核与标注图 | 接受/排除/修改、审计、ReviewSession、归档和正式问题 | 风险筛选、批量接受、BBox显示和Canvas标注图 |
| 报告快照与Renderer | 快照、版本、修订、审计、比较、stale、JSON和打印 | 原快照来源适配、动态章节、表格和标注照片画廊 |
| CloudBase Provider | 本地JSON和文件Provider | 可选数据库和对象存储Provider |
| Legacy迁移 | 新旧问题及报告只读合并 | 迁移预检、显式执行、幂等保护和结果审计 |
| 标准库和整改建议目录 | 指标未接入契约 | 412条标准、61指标和124条建议的只读目录 |

现有基线只有在行为对照、回归测试和独立变更审查通过后才允许收敛代码；不得以“复用”为理由直接覆盖或另建平行实现。

AB-00“主数据源与适配基础”已完成；当前下一增量为ProjectData、外业任务和Legacy迁移的BFF接入。

完整范围、主数据源、接口、测试和完成条件见[A/B等级复用优先开发大纲](docs/reuse-first-ab-development-outline.md)。

### 20.2 C/D等级后续能力

以下能力不在本次A/B开发中：

- 正式指标计算引擎；
- 数据库事务、正式索引和多实例一致性；
- 对象存储直传、分片和断点续传；
- 独立AI Worker、租约、运行中取消和单照片重试；
- 复杂资料解析、复杂GeoJSON和坐标转换；
- 政务GIS和高级空间算子；
- 多人复核锁和完整协作；
- 正式模板、服务端PDF、审批、签发、发布和分享；
- 整改派发、责任、复核和销项；
- 游标分页、完整配置中心、链路追踪和正式权限。

全部逐项证据和复用等级见[原smart-renew能力复用对照审计](docs/original-smart-renew-reuse-audit.md)。新增或调整能力时必须同步更新审计、大纲和开发状态。

---

## 21. 项目完成定义

满足以下所有条件后，Urban Health Business 才能视为全过程开发完成：

1. V9.1 Demo原样可运行；
2. Business模式不加载任何固定Demo业务结果；
3. 六阶段均有真实业务工作台；
4. 已有smart-renew能力全部通过统一接口接入；
5. 缺失引擎均有明确接口、说明和真实未接入状态；
6. 项目、照片、AI候选、复核、正式问题、GIS、指标和报告数据关系可追溯；
7. 所有正式数据以后端为准；
8. 关键流程支持幂等和失败恢复；
9. 项目统计、GIS、指标和报告口径一致；
10. 全过程E2E测试通过；
11. 本地和目标云端接口契约一致；
12. 原版smart-renew未被迁移工作意外修改；
13. 待开发模块汇总完整、可追踪且有后续开发入口。

若指标引擎、正式GIS数据源或PDF服务仍由外部人员开发，则项目可以达到“业务主链完成、外部模块待接入”状态，但不得把这些模块标记为已完成，也不得使用Demo结果代替。

---

## 22. 后续文档清单

已建立的跨模块基础设计：

- [系统架构](docs/architecture/system-architecture.md)
- [业务数据模型](docs/data-model/business-data-model.md)
- [API规范](docs/api/api-conventions.md)
- [六阶段工作流接口](docs/api/workflow-api.md)
- [当前Business BFF接口](docs/api/business-bff-api.md)
- [原smart-renew能力复用对照审计](docs/original-smart-renew-reuse-audit.md)
- [A/B等级复用优先开发大纲](docs/reuse-first-ab-development-outline.md)
- [开发状态与剩余缺口](docs/development-status.md)

以上文档是后续模块开发大纲的共同约束。

已建立的模块开发大纲：

- [00 项目与六阶段工作流](docs/modules/00-project-and-workflow.md)
- [01 资料上传与空间采集治理](docs/modules/01-collection.md)
- [02 AI智能识别](docs/modules/02-ai-analysis.md)
- [03 人工复核](docs/modules/03-human-review.md)
- [04 GIS落图与问题清单](docs/modules/04-gis-and-issues.md)
- [05 指标核算与引擎接入](docs/modules/05-indicator-engine-integration.md)
- [06 报告编辑、生成与归档](docs/modules/06-report-generation.md)

不存在的计划文档不再列为“已建立”。后续只有在确有独立内容且不会重复本总纲、复用审计或模块大纲时才新增文档。

这些文档必须遵循本总纲和A/B复用优先开发大纲，不得重新引入Demo固定数据、绕开统一接口层或建立第二主数据源。

---

## 23. 当前本地运行与验证

要求 Node.js 20或以上。需要同时启动原smart-renew本地后端和Business BFF：

```powershell
# 终端1：smart-renew仓库根目录
npm start

# 终端2
cd urban-health-business
npm start
```

访问：

```text
Business  http://127.0.0.1:4182/business/
V9.1 Demo http://127.0.0.1:4182/demo/
存活检查  http://127.0.0.1:4182/api/health
就绪检查  http://127.0.0.1:4182/api/ready
```

完整验证：

```powershell
cd urban-health-business
npm run verify
```

`verify` 包含语法检查、88项单元测试、双服务隔离全过程集成测试、Demo 42文件完整性校验和原项目修改边界校验。集成测试只使用系统临时目录，不读写当前本地真实项目。
