# 智更平台正式报告生成模块开发大纲

> 文档用途：交给 Mimo Code 作为正式开发的总体实施依据  
> 适用仓库：`smart-renew`  
> 当前开发分支：`dev`  
> 基准母版：`assets/report-templates/report-template-v1.docx`  
> 模板编号：`TPL-WORD-V1`  
> 目标成果：网页内完成数据准备、指标计算、分章生成、人工审核和锁定，并导出可继续编辑的正式 `.docx` 报告  
> 部署边界：未经用户明确授权，不合并 `main`，不部署 CloudBase，不测试或修改正式线上数据

---

## 1. Mimo Code 开发前必读

开始编码前，必须依次阅读并遵守：

1. `AGENTS.md`：两套视觉模型、密钥安全、分支和部署规则。
2. `HOME_DEVELOPMENT_GUIDE.md`：本地运行、数据目录和发布边界。
3. `SESSION_HANDOFF.md`：当前系统能力、CloudBase 环境和技术债务。
4. `SMART_RENEW_WORKFLOW_IMPLEMENTATION.md`：项目数据全流程和正式数据边界。
5. `WORD_REPORT_WORKFLOW.md`：已有 Word 模板工作流。
6. `REPORT_TEMPLATE_V1_SCREENING.md`：模板中的旧项目内容、制式内容和待替换内容。
7. `docs/REPORT_SNAPSHOT_API.md`：现有报告快照接口。
8. 本文档：本次开发的最终范围、架构和验收依据。

执行前必须检查：

```powershell
git status --short --branch
git diff --check
```

要求：

- 在用户指定的开发分支工作，不直接修改 `main`。
- 不覆盖用户已有未提交改动。
- 不提交 `.env`、API Key、密码、真实照片、`.smart-renew-data/` 或临时测试文件。
- 不主动迁移真实项目数据。
- 不主动部署或验证正式线上环境。

---

## 2. 已确认的产品要求

### 2.1 模板与输出

- 只使用现有绵阳正式报告作为母版，不开发“任意 Word 自动模板化”。
- 保持原报告的章节顺序、标题层级、表格样式和图片槽位逻辑。
- 不要求最终 Word 与母版页数完全一致，允许内容长度导致自然分页。
- 本阶段不重点处理复杂目录、页眉页脚、域、交叉引用和高级 Word 编排。
- 内容完整度、项目数据正确性和可编辑性优先于复杂版式复刻。
- 第一阶段必须同时实现：
  - 网页内完整编辑；
  - 分段审核和锁定；
  - 单段重新生成；
  - 正式 Word 下载。

### 2.2 数据与计算

- 报告只读取当前项目的正式数据。
- AI 候选问题不得直接进入报告；只有人工接受或修正并正式入库的问题可以统计。
- 所有数量、比例、评分、覆盖率、风险分布和指标判断必须由确定性计算引擎完成。
- LLM 不参与算术，不得让 LLM 从自然语言中自行推算数字。
- 计算算法优先根据母版报告、现有指标库、数据字段含义和可验证统计关系还原。
- 算法必须完整、可解释、可复现、可版本化。
- 不建立面向用户的“规则待确认清单”；如果原报告未显式写出算法，应采用明确、保守且可审计的默认算法补全。
- 算法补全不得演变为编造项目事实；只有真实输入存在时才能生成项目数值。

### 2.3 缺失数据

- 缺失地名、数量、设施、问题、图片或其他事实时，不得编造。
- LLM 可以参考母版生成不依赖未知事实的正式背景、方法、分析框架和过渡段落。
- 正式正文不得出现“待补充”“资料缺失”“根据您提供的信息”“作为 AI”等工作性或解释性语言。
- 缺失项只在网页审核界面提示。
- 缺少项目专属图片、地图或图表不阻止导出正式版。
- Word 中不得继续使用母版里的旧项目专属图片冒充当前项目材料。
- 缺失图片在 Word 中默认省略图片和对应图注，正文自然补位；不得输出“图片缺失”占位文字。
- 通用装饰图片、通用技术路线图等经确认可复用的制式素材可以保留。

### 2.4 正式报告口径

- 生成内容必须使用正式报告、公文和专业技术报告口径。
- 不得包含模型解释、推理过程、对用户说话、提示词痕迹或系统内部状态。
- 表格中不得出现 `PRB-03-01`、`PDI-*`、`RPT-*` 等系统内部复杂编号。
- 内部编号只保存在数据来源和审计记录中，不出现在正式正文和正式表格。
- 正式表格使用指标中文名称、问题中文名称、行政区名称、数量、单位和正式结论。
- 已审核和锁定的内容不得被批量重新生成覆盖。

### 2.5 模块化要求

- 新功能必须尽量放在主代码文件之外。
- 不在 `index.html` 中继续堆积大段业务逻辑和样式。
- 不在现有报告逻辑中进行大规模重写。
- 现有页面只通过按钮、挂载容器和统一入口调用新模块。
- 新模块失败时，不应破坏项目管理、住区分析、人工复核和现有动态报告。
- 本阶段不引入 React、Vue、Vite 等新的前端框架或构建体系。
- 前端继续使用与现有项目一致的原生 JavaScript 和 IIFE/全局命名空间方式。

---

## 3. 项目现状与可复用能力

### 3.1 已有能力

- `index.html` 已有项目工作台和“报告成果”栏目。
- `assets/report-template-editor.js` 已有 Word 模板网页编辑和审核原型。
- `assets/report-templates/report-template-v1.docx` 是不可直接覆盖的原始母版。
- `assets/report-templates/report-template-v1.json` 已保存从 Word 提取的段落、表格和图片模型。
- `functions/api/report-template-core.js` 已有模板内容标准化和审核状态处理。
- `functions/api/report-snapshot-core.js` 已有基础报告快照生成。
- `reportSnapshots` 已用于保存项目级报告版本。
- `projectDataRecords` 已建立项目数据统一索引。
- `officialIssues` 保存人工确认后的正式问题。
- `photoRecords` 保存原图和标注图档案。
- `analysisRecords` 保存分析批次。
- 项目记录保存住宅台账和社区／街区分析结果。
- 本地 `server.mjs` 和 CloudBase `functions/api/index.js` 已有相同业务接口的双实现。

### 3.2 当前不足

- 报告字段字典尚未完整建立。
- 现有快照只包含基础统计，无法支撑完整 Word。
- 没有独立、可查看的指标计算引擎。
- 没有稳定的分章 LLM 生成和局部重新生成机制。
- 没有完整的报告草稿、段落版本、审核锁定和生成来源模型。
- 没有从结构化报告草稿生成 `.docx` 的服务。
- 母版仍包含需要清除或改写的旧项目内容。
- 当前自动化测试偏少，缺少计算、生成、导出和跨项目隔离测试。

### 3.3 必须保持兼容

- 现有 `/api/reports`、`/api/reports/generate` 和 `/api/reports/{id}` 接口不能被破坏。
- 现有 `reportSnapshots` 历史记录必须继续可读。
- 现有 Word 模板编辑器不得因新模块接入而失效。
- 新版快照使用新的 `schemaVersion`，读取旧版时提供兼容转换。
- 本地数据与 CloudBase 正式数据的结构和行为保持一致。

---

## 4. 总体架构

```text
现有正式业务数据
├─ projects
├─ projectDataRecords
├─ officialIssues
├─ photoRecords
├─ analysisRecords
└─ reportTemplates
        │
        ▼
报告数据适配层
        │ 统一字段、项目隔离、来源追踪、缺失检查
        ▼
计算引擎
        │ 确定性公式、单位、舍入、派生指标、证据链
        ▼
计算快照
        │ 冻结本次输入和结果
        ▼
章节生成器
        │ 母版片段 + 允许事实 + 计算结果 + 正式口径
        ▼
报告草稿与段落版本
        │ 编辑、审核、锁定、单段重生成
        ▼
Word 渲染器
        │ 章节、表格、项目图片、样式、自然分页
        ▼
正式 Word 文件与报告版本
```

架构原则：

1. **数据适配与展示分离**：前端不直接拼接各种业务集合。
2. **计算与语言生成分离**：数字由引擎生成，文字由 LLM 生成。
3. **生成与导出分离**：先形成结构化、可审核的报告草稿，再渲染 Word。
4. **项目严格隔离**：所有查询、草稿、段落、快照和文件必须带 `projectId`。
5. **版本不可漂移**：正式 Word 只从冻结快照和冻结草稿生成。
6. **主文件最小改动**：新模块通过单一入口挂载。

---

## 5. 建议文件结构

### 5.1 前端独立模块

```text
assets/report-studio/
├─ report-studio.js          # 唯一公开入口、流程状态、模块协调
├─ report-studio.css         # 全部新增界面样式
├─ api-client.js             # 报告工作台 API 封装
├─ data-readiness.js         # 数据准备和缺失项展示
├─ calculation-view.js       # 计算引擎显式操作页面
├─ template-schema.js        # 章节、段落、表格和图片槽位定义
├─ section-editor.js         # 分段编辑、审核、锁定和重生成
├─ report-preview.js         # 网页正式报告预览
├─ export-panel.js           # Word 版本和下载
└─ report-studio-utils.js    # 转义、状态、格式化等纯工具
```

公开入口仅保留：

```javascript
window.SmartRenewReportStudio.open({ projectId, projectName });
```

禁止为每个文件随意增加全局变量。内部模块统一挂在：

```javascript
window.SmartRenewReportStudioModules
```

### 5.2 服务端独立模块

```text
functions/api/
├─ report-context-core.js       # 构建标准报告上下文
├─ report-calculation-core.js   # 纯函数计算引擎
├─ report-rule-registry.js      # 指标公式、单位、舍入和缺失策略
├─ report-generation-core.js    # 分章提示词、输出解析和正文校验
├─ report-draft-core.js         # 草稿、段落状态和版本处理
├─ report-docx-core.js          # Word 文档结构和渲染
└─ report-studio-contracts.js   # 请求、响应和数据结构校验
```

需要新增薄适配层时可以使用：

```text
functions/api/report-studio-cloud-adapter.js
```

本地服务可以复用同一批纯核心文件，并在 `server.mjs` 内仅完成本地存储、文件读写和路由委托。

### 5.3 文档和测试

```text
docs/report-studio/
├─ FIELD_DICTIONARY.md
├─ CALCULATION_RULES.md
├─ TEMPLATE_SECTION_MAP.md
├─ API.md
└─ ACCEPTANCE_CHECKLIST.md

tests/report-studio/
├─ context.test.mjs
├─ calculations.test.mjs
├─ generation-validation.test.mjs
├─ draft-state.test.mjs
├─ docx.test.mjs
└─ fixtures/
```

如果仓库暂时不引入统一测试框架，可先使用 Node 内置的 `node:test` 和 `assert`，避免为本模块引入大型测试依赖。

### 5.4 主文件允许的最小改动

`index.html`：

- 引入一个 `report-studio.css`。
- 按依赖顺序引入报告模块脚本。
- 在现有“报告成果”区域增加一个按钮和一个挂载容器。
- 按钮只调用 `SmartRenewReportStudio.open(...)`。
- 不在 `index.html` 中实现计算、提示词、审核或 Word 生成逻辑。

`server.mjs`：

- 增加报告工作台核心模块导入。
- 增加一个统一路由委托入口。
- 提供本地存储和本地 Word 文件路径适配。

`functions/api/index.js`：

- 增加报告工作台核心模块导入。
- 增加一个统一路由委托入口。
- 提供 CloudBase 集合和云存储适配。

建议控制目标：

- `index.html` 新增或改动不超过约 40 行，不进行大段挪动。
- `server.mjs` 路由接入部分不超过约 30 行，核心逻辑全部外置。
- `functions/api/index.js` 路由接入部分不超过约 40 行，核心逻辑全部外置。

---

## 6. 报告工作台页面设计

### 6.1 入口

在项目工作台的“报告成果”栏目增加主按钮：

```text
生成正式报告
```

点击后打开独立报告工作台。不要新增平台一级导航，也不修改现有项目路由体系。

### 6.2 工作台步骤

```text
01 数据准备 → 02 指标计算 → 03 分章生成 → 04 编辑审核 → 05 Word 导出
```

#### 步骤 01：数据准备

展示：

- 当前项目和数据截止时间。
- 项目档案字段完整度。
- 小区、楼栋和户数来源。
- 原始现场照片和标注图数量。
- 已归档分析批次数量。
- 正式问题数量。
- 社区／街区分析状态。
- 可复用项目图片和缺失图片槽位。
- 不阻塞正式导出的缺失项提示。

操作：

- “重新读取项目数据”。
- “查看来源”。
- “进入指标计算”。

#### 步骤 02：指标计算

计算引擎必须是显式页面，但默认一键自动完成。

展示每个指标：

- 中文指标名称。
- 指标类别。
- 原始输入值。
- 公式的人类可读表达。
- 计算结果和单位。
- 舍入方式。
- 数据来源数量。
- 计算状态。
- 查看明细入口。

不得默认展示复杂系统 ID；来源抽屉内可以显示内部 ID 供审计。

操作：

- “运行全部计算”。
- “重新计算当前指标”。
- “查看计算依据”。
- “冻结本次计算结果”。

用户不能在正式流程中直接手填一个结果绕过计算。确需人工修订时，必须保存：原结果、修订结果、修订原因、修订人和时间。

#### 步骤 03：分章生成

展示母版全部章节及状态：

- 未生成。
- 生成中。
- 已生成。
- 已人工编辑。
- 已审核。
- 已锁定。
- 生成失败。

操作：

- “生成全部未锁定章节”。
- “生成本章”。
- “重新生成本段”。
- “取消本次请求”。
- “查看本段使用的数据”。

批量生成必须跳过已锁定内容。

#### 步骤 04：编辑审核

支持：

- 按章节预览正式报告内容。
- 直接编辑普通文字、标题、表格单元格和图注。
- 显示修改前版本。
- 审核通过。
- 锁定或解锁。
- 只重新生成选中段落。
- 恢复上一版本。
- 查找母版旧项目地名残留。
- 查找 AI 解释性语句。
- 查找无来源数字。

编辑后自动将该段状态改为“已人工编辑”；审核后为“已审核”；锁定后任何批量生成不能修改。

#### 步骤 05：Word 导出

展示：

- 报告名称。
- 项目名称。
- 草稿版本。
- 计算快照版本。
- 模板版本。
- 审核人员。
- 正文校验结果。
- 缺失图片数量，仅提示，不阻塞。
- Word 历史版本。

操作：

- “导出审核稿”。
- “导出正式版”。
- “下载 Word”。
- “查看版本来源”。

正式版导出条件：

- 所有必需正文和表格已经生成。
- 正文校验通过。
- 不包含母版旧项目专属内容。
- 不包含 AI 解释性语句。
- 所有正文数字通过来源校验。
- 已填写正式版生成或审核人员。
- 图片缺失不作为阻塞条件。

---

## 7. 标准报告上下文

### 7.1 上下文构建原则

所有计算和生成只能使用一次冻结的标准上下文，不能在每个章节生成时重新散查数据库。

上下文构建过程：

1. 校验 `projectId`。
2. 读取当前项目。
3. 读取相同 `projectId` 的统一索引、正式问题、照片和分析批次。
4. 清除候选问题、软删除小区、软删除楼栋和无效照片。
5. 区分原始现场照片和标注图。
6. 标准化风险等级、指标编码、中文名称和单位。
7. 建立来源 ID，但不把内部 ID传给正式正文。
8. 输出缺失项和可用图片槽位。
9. 生成上下文内容哈希，用于判断数据是否发生变化。

### 7.2 建议结构

```json
{
  "schemaVersion": "2.0.0",
  "projectId": "1784512879166",
  "dataCutoffAt": "2026-09-09T00:00:00.000Z",
  "contextHash": "...",
  "project": {},
  "scope": {},
  "housing": {
    "communities": [],
    "buildings": [],
    "verifiedTotals": {}
  },
  "photos": {
    "original": [],
    "annotated": [],
    "byCommunity": {},
    "byBuilding": {}
  },
  "analyses": [],
  "officialIssues": [],
  "indicators": [],
  "communityAnalysis": null,
  "template": {
    "id": "TPL-WORD-V1",
    "version": 1
  },
  "availability": {
    "missingFields": [],
    "missingImageSlots": [],
    "warnings": []
  },
  "sourceIds": {}
}
```

### 7.3 统计口径优先级

住宅楼栋数：

1. 小区存在完整有效楼栋明细时，按有效楼栋明细数量统计。
2. 没有楼栋明细时，使用人工核实的小区 `buildingCount`。
3. 不得同时叠加楼栋明细和小区汇总，避免重复。

住宅户数：

1. 楼栋明细户数完整时，按有效楼栋户数求和。
2. 楼栋明细不完整时，使用人工核实的小区 `householdCount`。
3. 未核实或空值不得转换为 0 后用于覆盖率判断。

照片数：

- 只统计原始现场照片。
- 标注图单独统计，不得计入现场照片总数。
- 删除、无效或跨项目照片不得计入。

问题数：

- 只统计 `officialIssues`。
- 按 `projectId` 严格过滤。
- 驳回的候选问题不统计。
- 同一正式问题按稳定问题 ID 去重。

社区／街区设施：

- 使用已经保存的检索结果和聚合结果。
- 正文使用“本次检索识别到”或“项目分析范围内检索到”等准确口径。
- 不将地图检索结果表述为行政统计部门的全量普查数据。

---

## 8. 报告字段字典

新增 `docs/report-studio/FIELD_DICTIONARY.md`，并建立机器可读字段字典。

每个字段至少包含：

```json
{
  "key": "housing.communityCount",
  "label": "住宅小区数量",
  "type": "integer",
  "unit": "个",
  "source": "projects.residentialInventory.items",
  "filter": "status != deleted",
  "missingPolicy": "omit-claim",
  "reportLabel": "住宅小区",
  "allowInNarrative": true,
  "allowInTable": true
}
```

字段分类至少覆盖：

- 报告元数据。
- 项目基本信息。
- 项目空间范围。
- 住宅小区、楼栋和户数。
- 现场照片和采集覆盖。
- AI 分析批次，仅用于工作量说明，不作为正式问题依据。
- 正式问题。
- 风险等级。
- 问题中文分类和整改建议。
- 社区／街区设施。
- 指标计算结果。
- 项目图、地图、问题原图和标注图。
- 来源追踪字段。

内部字段必须标记：

```json
{
  "internalOnly": true,
  "allowInNarrative": false,
  "allowInTable": false
}
```

`projectId`、`sourceIds`、`PRB` 编码等可以参与内部绑定，但默认不得进入正式输出。

---

## 9. 计算引擎设计

### 9.1 核心要求

- `report-calculation-core.js` 必须是纯函数模块。
- 相同输入、相同规则版本必须得到完全相同的输出。
- 不访问 DOM、不调用 LLM、不直接访问数据库、不读取环境变量。
- 所有规则集中注册，不允许在页面渲染代码中零散计算。
- 所有结果必须携带输入引用、公式版本、单位、舍入规则和状态。
- 计算异常不能静默转换成 0。

### 9.2 规则注册结构

```json
{
  "id": "CALC-HOUSING-COMMUNITY-COUNT",
  "version": "1.0.0",
  "label": "住宅小区数量",
  "category": "housing",
  "inputKeys": ["housing.communities"],
  "formulaLabel": "有效住宅小区去重计数",
  "unit": "个",
  "rounding": "integer",
  "missingPolicy": "not-computable",
  "reportVisibility": "public-name-only"
}
```

### 9.3 计算结果结构

```json
{
  "ruleId": "CALC-ISSUE-HIGH-RATE",
  "ruleVersion": "1.0.0",
  "label": "高风险问题占比",
  "value": 25.6,
  "formattedValue": "25.6%",
  "unit": "%",
  "formulaLabel": "高风险正式问题数 ÷ 正式问题总数 × 100%",
  "inputs": {
    "highIssueCount": 10,
    "officialIssueCount": 39
  },
  "sourceIds": ["..."],
  "status": "calculated",
  "calculatedAt": "..."
}
```

### 9.4 第一批基础规则

#### 项目与住宅台账

- 有效小区数量。
- 有效楼栋数量。
- 已核实住宅户数。
- 已录入楼栋明细的小区数量。
- 已核实户数的小区数量。
- 小区资料完整率。
- 楼栋资料完整率。
- 户数资料完整率。
- 项目范围面积。

#### 现场采集

- 原始现场照片数量。
- 标注图数量。
- 有照片的小区数量。
- 有照片的楼栋数量。
- 小区照片覆盖率。
- 楼栋照片覆盖率。
- 已完成分析的原始照片数量。
- 待分析原始照片数量。

覆盖率仅在分母真实且大于 0 时计算。分母缺失时结果状态为 `not-computable`，报告正文自动采用不引用比例的表述，不将其写成 0%。

#### 正式问题

- 正式问题总数。
- 高、中、低风险问题数量。
- 各风险等级占比。
- 涉及小区数量。
- 涉及楼栋数量。
- 各问题中文小类数量。
- 各指标中文大类数量。
- 每个小区的问题数量和风险分布。
- 每栋楼的问题数量和风险分布。
- 有原图证据的问题数量。
- 有标注图证据的问题数量。
- 整改建议分类去重结果。

#### 社区／街区

- 各设施类别检索数量。
- 检索设施总数。
- 有结果的设施类别数量。
- 当前检索范围面积有效时的设施密度。
- 当前搜索半径和空间模式。
- 零结果类别，只作为本次检索发现，不直接表述为绝对缺失。
- 已保存的短板分析和结论。

#### 综合评价与优先级

综合评分不得由 LLM 生成。需要综合判断时，先在规则注册表中明确：

- 输入指标。
- 权重。
- 标准化方式。
- 阈值。
- 缺失输入的处理。
- 舍入方式。
- 结果对应的正式中文等级。

如果母版没有要求综合分数，不为了页面效果新增虚构综合分。优先生成问题结构、风险分布和整改优先序。

整改优先序可以基于以下确定性信息组合，但正式实现前必须在 `CALCULATION_RULES.md` 固化实际公式：

- 风险等级权重。
- 同类问题数量。
- 涉及小区和楼栋范围。
- 是否具有现场图片证据。
- 是否存在多次重复发现。

### 9.5 缺失值规则

明确区分：

- `0`：真实计算得到零。
- `null`：没有输入值。
- `not-computable`：输入不足，不能计算。
- `not-applicable`：当前项目不适用。
- `calculated`：正常计算完成。
- `manually-adjusted`：人工按审计流程修订。

禁止使用 `Number(value) || 0` 一类写法把未知值静默变成 0。

### 9.6 算法补全策略

不展示“规则待确认清单”，但必须保留内部算法来源等级：

- `template-explicit`：母版明确给出。
- `data-definition`：由现有字段和业务定义直接确定。
- `standard-statistical`：使用标准计数、去重、求和、比例或密度算法。
- `derived-conservative`：在不扩大结论的前提下采用保守推导规则。

这些来源等级仅用于计算页面的审计明细，不进入正式报告。

---

## 10. 母版章节与内容模型

### 10.1 模板建模

以 `report-template-v1.json` 为基础建立 `template-schema.js` 和 `TEMPLATE_SECTION_MAP.md`。

每个模板块必须补充：

```json
{
  "id": "section-2-3-paragraph-4",
  "sectionKey": "housing-diagnosis",
  "type": "generated-paragraph",
  "sourceBlockId": "p-128",
  "title": "住房维度问题分析",
  "templateText": "...",
  "requiredFacts": [],
  "optionalFacts": [],
  "calculationKeys": [],
  "imageSlots": [],
  "tableSchema": null,
  "missingPolicy": "formal-generalization",
  "generationPolicy": "llm",
  "reviewRequired": true
}
```

### 10.2 内容类型

- `fixed-text`：确认可跨项目复用的制式内容，不调用 LLM。
- `field-text`：直接使用项目字段替换。
- `calculated-text`：由计算结果填充固定句式。
- `generated-paragraph`：用母版口径和允许事实调用 LLM。
- `conditional-paragraph`：根据计算结果选择正式句式。
- `loop-table`：按问题、小区、楼栋或指标生成表格行。
- `image-slot`：项目地图、现场照片、标注图或通用图片。
- `caption`：只在对应图片存在时生成。

### 10.3 母版旧项目清理

建立旧项目专属词和素材清单，至少检查：

- 绵阳及其区县、街道、小区名称。
- 原报告年份。
- 原项目数量、面积、人口、设施和问题数字。
- 原项目专属图片、地图和图注。
- 原报告单位名称、人员名称和编制信息。

除当前项目本身就是绵阳且数据一致外，这些内容不得进入其他项目报告。

---

## 11. 分章 LLM 生成设计

### 11.1 调用边界

- 每次只生成一个章节或一个可审核段落。
- 不一次请求生成整篇报告。
- 不把全部项目原始记录无差别传给模型。
- 每个请求只包含该段允许使用的事实、计算结果、母版示例和语言规则。
- 数字先格式化并列入允许数字集合。
- 旧项目专属文字在发送给模型前必须经过标记或清理。

### 11.2 输入结构

```json
{
  "project": {
    "name": "西安雁塔区城市体检",
    "administrativeArea": "..."
  },
  "section": {
    "key": "housing-diagnosis",
    "title": "...",
    "templateStyleSample": "...",
    "purpose": "..."
  },
  "allowedFacts": [],
  "calculatedFacts": [],
  "missingFacts": [],
  "approvedContextSummaries": [],
  "outputContract": {}
}
```

### 11.3 输出契约

模型必须返回结构化 JSON，不直接返回带解释的 Markdown：

```json
{
  "sectionKey": "housing-diagnosis",
  "title": "住房维度问题分析",
  "paragraphs": [
    { "id": "p1", "text": "正式正文……" }
  ],
  "tableNarratives": [],
  "usedFactKeys": [],
  "usedCalculationKeys": []
}
```

服务端解析成功并通过校验后才能保存。解析失败不得把原始模型文本直接写入草稿。

### 11.4 正式口径提示词原则

系统提示至少包含：

- 你正在撰写城市体检正式报告正文。
- 只输出指定 JSON 结构。
- 不向读者解释生成过程。
- 不使用“根据用户提供”“作为 AI”“无法判断”“建议补充资料”等表述。
- 不编造未提供的数字、地点、机构、时间、设施和问题。
- 缺少事实时，改写为不依赖该事实的完整正式表述。
- 只能使用允许事实和计算结果中的数字。
- 不输出系统内部编号。
- 保持母版的正式、客观、审慎语气。
- 不把候选问题表述为正式发现。

### 11.5 上下文连续性

为了避免章节互相矛盾：

- 每章可以读取项目全局事实摘要。
- 每章可以读取此前已审核章节的短摘要。
- 不将此前全文反复传给模型。
- 已锁定章节摘要不可被后续生成改写。
- 全文完成后运行一次跨章节一致性检查，但一致性检查只能给出问题列表，不能自动改写已锁定正文。

---

## 12. 生成后校验

保存模型结果前运行确定性校验。

### 12.1 禁止解释性语言

检查但不限于：

- “作为 AI”。
- “根据您提供的信息”。
- “我认为”。
- “无法获取”。
- “请补充”。
- “以上内容仅供参考”。
- “模型分析”。
- “提示词”。
- “系统数据不足”。

注意：不能粗暴禁止正式报告中正常使用的“建议”“可能”“应”等词，应检测完整的 AI 元话语模式。

### 12.2 旧项目残留

- 当前项目不是绵阳时，检查所有绵阳项目专属词。
- 检查母版旧年份、原单位和原项目图片图注。
- 检查模板已知旧数字片段。

### 12.3 数字来源

- 提取正文中的阿拉伯数字、百分数、面积、数量和年份。
- 章节编号、法规编号等模板允许数字单独白名单处理。
- 项目统计数字必须存在于 `allowedFacts` 或计算结果中。
- 数字格式变化如 `25.60%` 与 `25.6%` 应规范化后比较。
- 无来源数字阻止正式版导出。

### 12.4 内部编号

检查：

- `PRB-*`。
- `PDI-*`。
- `RPT-*`。
- `ANA-*`。
- `PHOTO-*`。
- 数据库文档 ID。

这些内容可以出现在网页“查看来源”抽屉，但不得进入正式正文和表格。

### 12.5 项目一致性

- 报告标题、正文行政区、项目名称和数据必须属于同一 `projectId`。
- 不允许跨项目照片和问题进入 Word。
- 所有段落保存其 `contextHash` 和 `calculationSnapshotId`。
- 项目数据变化后，旧草稿显示“数据已更新”，但不自动覆盖旧内容。

---

## 13. 草稿、段落、审核和锁定

### 13.1 报告草稿结构

建议新增集合或本地数据文件：`reportDrafts`。

```json
{
  "id": "RPD-{projectId}-{timestamp}",
  "projectId": "...",
  "title": "...",
  "templateId": "TPL-WORD-V1",
  "templateVersion": 1,
  "contextSnapshotId": "...",
  "calculationSnapshotId": "...",
  "status": "reviewing",
  "createdBy": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "sectionIds": [],
  "validation": {},
  "schemaVersion": "1.0.0"
}
```

### 13.2 段落结构

建议新增集合或本地数据文件：`reportSections`。

```json
{
  "id": "RPS-{draftId}-{sectionKey}-{blockId}",
  "projectId": "...",
  "draftId": "...",
  "sectionKey": "...",
  "blockId": "...",
  "type": "paragraph",
  "content": {},
  "status": "generated",
  "locked": false,
  "version": 1,
  "generatedByModel": "...",
  "generatedAt": "...",
  "editedBy": "",
  "editedAt": "",
  "reviewedBy": "",
  "reviewedAt": "",
  "usedFactKeys": [],
  "usedCalculationKeys": [],
  "contextHash": "...",
  "history": []
}
```

如果单条文档可能过大，不把所有历史正文无限嵌入同一条记录；使用独立版本记录或限制最近版本数量。

### 13.3 状态机

草稿状态：

```text
created → data-ready → calculated → generating → reviewing → exportable → exported
                                                     ↘ failed
```

段落状态：

```text
not-generated → generating → generated → edited → approved → locked
                    ↘ error             ↘ regenerated
```

规则：

- `locked` 内容不得被批量生成覆盖。
- 解锁必须记录操作人和时间。
- 重新生成先保存旧版本，再写新版本。
- 人工编辑不丢失模型版本和来源数据。
- 正式版导出后继续修改，应创建新报告版本，不覆盖已有文件。

---

## 14. API 设计

统一前缀：

```text
/api/report-studio
```

### 14.1 数据准备

```http
GET /api/report-studio/projects/{projectId}/context
```

返回标准上下文摘要、可用数据、缺失项和来源统计。默认不返回大体积图片 Base64。

### 14.2 运行计算

```http
POST /api/report-studio/projects/{projectId}/calculations
Content-Type: application/json

{
  "contextHash": "...",
  "calculatedBy": "..."
}
```

返回并保存计算快照。

### 14.3 创建草稿

```http
POST /api/report-studio/projects/{projectId}/drafts

{
  "templateId": "TPL-WORD-V1",
  "contextSnapshotId": "...",
  "calculationSnapshotId": "...",
  "createdBy": "..."
}
```

### 14.4 查询草稿

```http
GET /api/report-studio/projects/{projectId}/drafts
GET /api/report-studio/drafts/{draftId}
```

### 14.5 分段生成

```http
POST /api/report-studio/drafts/{draftId}/sections/{sectionId}/generate

{
  "mode": "generate | regenerate",
  "requestedBy": "..."
}
```

每个请求只生成一个段落或一个受控章节，避免 CloudBase 函数超时。

### 14.6 保存编辑

```http
PUT /api/report-studio/drafts/{draftId}/sections/{sectionId}

{
  "content": {},
  "editedBy": "...",
  "baseVersion": 3
}
```

使用 `baseVersion` 做乐观并发校验，避免覆盖其他人的新修改。

### 14.7 审核和锁定

```http
POST /api/report-studio/drafts/{draftId}/sections/{sectionId}/review
POST /api/report-studio/drafts/{draftId}/sections/{sectionId}/lock
```

审核、锁定和解锁均保存人员、时间和原因。

### 14.8 全文校验

```http
POST /api/report-studio/drafts/{draftId}/validate
```

返回解释性语言、旧项目残留、内部编号、无来源数字和跨项目引用检查结果。

### 14.9 Word 导出

```http
POST /api/report-studio/drafts/{draftId}/exports/docx

{
  "edition": "review | formal",
  "generatedBy": "..."
}
```

返回：

```json
{
  "artifactId": "RPA-...",
  "reportId": "RPT-...",
  "fileName": "西安雁塔区城市体检报告-V1.docx",
  "downloadUrl": "...",
  "missingImageCount": 2,
  "validation": { "passed": true }
}
```

### 14.10 文件下载

```http
GET /api/report-studio/artifacts/{artifactId}/content
```

本地返回文件流；CloudBase 返回安全下载地址或通过同源接口转发。

### 14.11 API 共通要求

- 所有接口校验当前资源所属 `projectId`。
- 写接口要求 JSON 大小限制。
- 不在响应中返回 API Key。
- 错误消息对用户可读，日志保留内部细节。
- 所有写入使用稳定 ID、防重复策略和版本校验。
- 不允许通过更换 URL 中的项目 ID 读取其他项目草稿。

---

## 15. Word 生成方案

### 15.1 推荐技术路线

使用 Node 端 Word 生成库，将已经审核的结构化报告草稿渲染成 `.docx`。推荐评估 `docx` npm 包，并在根项目与 CloudBase 函数依赖中保持相同兼容版本。

选择原则：

- 能生成可编辑的普通段落和表格。
- 支持中文字体、标题层级、单元格合并和图片。
- 支持自然分页。
- 不依赖 Windows Office COM。
- 可以在 Node 20 和 CloudBase 函数中运行。

在正式选定依赖前，先做一个最小技术验证：

- 生成包含中文标题、正文、三列表格和两张图片的 Word。
- 在 Microsoft Word 中正常打开。
- 文字和表格可编辑。
- 文件在本地 Node 20 和 CloudBase 构建环境均可生成。

### 15.2 版式范围

本阶段重点复刻：

- 章节顺序。
- 一级、二级和三级标题层级。
- 正文字体、字号、段距和行距。
- 表格边框、底色、对齐和列宽比例。
- 图片在对应章节中的相对位置。
- 图题和表题。
- 分页控制和自然分页。

本阶段不重点复刻：

- 自动目录域。
- 复杂页眉页脚。
- 复杂分节、浮动文本框和环绕。
- Word 宏。
- 高级交叉引用和域自动更新。

### 15.3 表格规则

- 表格列名和样式来自模板定义。
- 动态行数允许随项目数据增长。
- 系统内部编号不得输出。
- 同一中文问题名称重复时按正式统计口径合并或列明位置。
- 空表不得输出“暂无数据”系统行；按模板规则改为正式概述或省略。
- 表格数值和正文数值必须来自同一计算快照。

### 15.4 图片规则

- 通用制式图片可复用。
- 项目地图、项目照片、问题照片和标注图必须属于当前项目。
- 下载或读取图片时复用现有同源照片内容接口，避免跨域和临时签名失效。
- 图片生成前检查 MIME 类型、大小和尺寸。
- 缺图时省略图片及图注，并让文档自然排版。
- 不将网页端的“缺图”提示写入 Word。

### 15.5 文件保存

本地：

```text
.smart-renew-data/reports/{projectId}/{reportId}/{fileName}.docx
```

CloudBase：

```text
reports/{projectId}/{reportId}/{fileName}.docx
```

数据库只保存文件元数据、文件 ID、哈希、大小、模板版本、草稿版本和生成时间。

---

## 16. 报告版本和快照扩展

现有 `reportSnapshots` 继续作为正式报告版本入口，扩展时保持旧版兼容。

建议新版结构：

```json
{
  "id": "RPT-{projectId}-V0001",
  "projectId": "...",
  "version": 1,
  "title": "...",
  "status": "generated",
  "templateId": "TPL-WORD-V1",
  "templateVersion": 1,
  "fieldDictionaryVersion": "1.0.0",
  "calculationRuleSetVersion": "1.0.0",
  "contextSnapshotId": "...",
  "calculationSnapshotId": "...",
  "draftId": "...",
  "generatedBy": "...",
  "generatedAt": "...",
  "dataCutoffAt": "...",
  "sourceIds": {},
  "snapshot": {},
  "wordFileId": "...",
  "wordFileName": "...",
  "wordFileHash": "...",
  "missingImageSlots": [],
  "validation": {},
  "schemaVersion": "2.0.0"
}
```

原则：

- 新版本只新增，不覆盖。
- 导出正式版后不允许原地替换 Word 文件。
- 同一草稿再次导出正式版时创建新的报告版本。
- 下载历史版本时读取该版本对应的冻结文件。

---

## 17. 本地与 CloudBase 双端实现

### 17.1 共享核心

以下逻辑必须共享：

- 上下文标准化。
- 计算规则。
- 草稿状态机。
- 提示词构建。
- LLM 输出解析。
- 正式正文校验。
- Word 内容模型。

### 17.2 允许不同的部分

本地：

- JSON 文件或现有本地存储。
- 本地照片和 Word 文件目录。
- 本地模型代理或 CloudBase API 转发。

CloudBase：

- 数据库集合。
- 云存储。
- 云端千问和现有文本模型调用。
- 凭证重试和集合初始化。

### 17.3 模型调用

- 正式报告正文优先复用现有文本模型配置入口，不在新前端代码中保存密钥。
- 服务端统一封装文本生成客户端。
- 记录模型、请求 ID、提示词版本和生成时间，不保存明文密钥。
- 千问视觉模型和集团视觉模型的既有链路不得被本模块改动。
- 报告文本生成失败不得影响现有视觉分析功能。

---

## 18. 安全与数据隔离

- 所有报告资源必须校验 `projectId`。
- 禁止将真实项目数据发送给未配置或未经授权的新模型供应商。
- API Key 仅由服务端读取。
- 正式上线前必须启用并验证应用访问鉴权。
- 新接口必须纳入现有 `APP_PASSWORD` 或后续统一鉴权。
- 报告下载地址应有有效期或通过鉴权后的同源接口提供。
- 文件名过滤非法字符，防止路径穿越。
- 图片路径和模板路径只允许访问白名单目录。
- 上传、生成和导出接口设置体积和超时限制。
- 日志不得输出完整项目照片 Base64、API Key 或用户密码。
- 删除草稿和文件不在第一阶段提供永久删除；如需要，后续使用软删除和回收策略。

---

## 19. 错误处理与恢复

### 19.1 分段生成失败

- 只标记当前段落失败。
- 已成功段落保留。
- 用户可以重试当前段落。
- 批量生成可从失败位置继续。
- 不重复覆盖已审核或锁定内容。

### 19.2 数据变化

- 通过 `contextHash` 检测项目数据是否变化。
- 数据变化后提示“项目数据已有更新，可创建新计算快照”。
- 不自动改变旧草稿。
- 用户选择刷新数据时创建新快照，并明确哪些段落可能受影响。

### 19.3 Word 生成失败

- 草稿和计算快照保持不变。
- 保存失败原因。
- 修复后可以重新导出。
- 不产生半成品正式版本记录。

### 19.4 并发编辑

- 使用段落版本号或 `updatedAt` 做并发检查。
- 发现版本冲突时不静默覆盖，显示双方版本供选择。

---

## 20. 测试方案

### 20.1 单元测试

必须覆盖：

- 小区软删除过滤。
- 楼栋明细和小区汇总的优先级。
- 户数缺失不能变成 0。
- 原图和标注图分开统计。
- 正式问题和候选问题隔离。
- 风险数量和比例。
- `PRB` 中文名称映射。
- 社区／街区检索数量口径。
- 跨项目数据排除。
- 计算结果可重复。
- 锁定段落不能被覆盖。
- 段落版本冲突。
- AI 解释性语句检测。
- 旧项目地名检测。
- 内部编号检测。
- 无来源数字检测。
- 缺图不阻塞正式 Word。

### 20.2 API 测试

- 无效项目 ID。
- 项目不存在。
- 跨项目访问草稿。
- 重复创建计算快照。
- 生成单段。
- 重新生成未锁定段落。
- 重生成锁定段落被拒绝。
- 保存编辑的版本冲突。
- 正式版校验不通过时拒绝导出。
- 正式版缺图但其他校验通过时允许导出。
- 历史报告版本不被覆盖。

### 20.3 Word 验证

至少使用两个真实项目的授权数据副本验证：

- 西安雁塔区城市体检。
- 绵阳城市体检。

检查：

- Word 可正常打开。
- 中文无乱码。
- 标题层级正确。
- 章节顺序与母版一致。
- 表格样式一致且可编辑。
- 表格不出现内部编号。
- 图片属于当前项目。
- 缺图不显示系统占位提示。
- 正文自然分页。
- 数字与计算页面一致。
- 正文没有 AI 解释性语句。
- 非绵阳项目没有绵阳旧内容残留。

### 20.4 回归测试

必须确认没有破坏：

- 首页。
- 项目管理。
- 新建项目和地图范围。
- 住宅台账。
- 照片档案。
- 住区分析。
- 人工复核和正式问题入库。
- 社区／街区分析。
- 指标库。
- 原有报告快照查询。
- 微信小程序现有接口。
- 千问视觉模型选择。
- 集团视觉模型本机／局域网代理选择。

---

## 21. 分阶段开发计划

每个阶段必须独立完成检查和提交，不要一次性修改全部系统。

### 阶段 0：建立基线和保护范围

任务：

- 确认开发分支和干净工作区。
- 记录关键文件当前大小、语法状态和已有接口。
- 为现有报告页面和接口建立最小回归记录。
- 创建新模块空目录和入口，不改变现有功能。

验收：

- 原系统行为无变化。
- 新入口未启用时页面正常。

建议提交：

```text
chore: establish formal report module baseline
```

### 阶段 1：母版章节映射和字段字典

任务：

- 分析 `report-template-v1.json`。
- 结合 `REPORT_TEMPLATE_V1_SCREENING.md` 标记制式内容和旧项目内容。
- 建立章节、段落、表格、图片槽位清单。
- 建立机器可读字段字典。
- 建立旧项目词和图片黑名单。

验收：

- 母版全部块都有明确类型和处理方式。
- 所有动态块都有数据字段或生成策略。
- 不存在无法归类的模板块。

建议提交：

```text
feat: define formal report template and field dictionary
```

### 阶段 2：标准报告上下文

任务：

- 新建 `report-context-core.js`。
- 聚合项目、台账、照片、分析、正式问题和社区／街区结果。
- 建立数据来源和内容哈希。
- 增加本地和 CloudBase 数据适配。
- 编写上下文测试。

验收：

- 同一项目本地和云端得到相同结构。
- 跨项目数据不会混入。
- 候选问题不会进入正式上下文。

建议提交：

```text
feat: build isolated report data context
```

### 阶段 3：确定性计算引擎

任务：

- 分析母版中全部数值、比例、判断和表格统计。
- 建立 `CALCULATION_RULES.md`。
- 实现规则注册表和纯函数计算器。
- 实现计算快照。
- 实现缺失值状态和审计来源。
- 编写完整单元测试。

验收：

- 母版需要的派生数字全部由引擎提供。
- LLM 请求中没有要求模型算数。
- 相同输入计算结果完全一致。
- 未知值不会自动变成 0。

建议提交：

```text
feat: add deterministic report calculation engine
```

### 阶段 4：显式计算页面

任务：

- 建立 `assets/report-studio` 前端骨架。
- 实现数据准备和计算页面。
- 实现一键计算、明细抽屉、重新计算和冻结快照。
- 在现有报告成果页增加最小按钮入口。

验收：

- 用户能看见公式、输入、结果和来源。
- 默认操作简单，不要求用户逐项确认。
- `index.html` 只承担入口，不包含业务实现。

建议提交：

```text
feat: add report data and calculation workspace
```

### 阶段 5：草稿、段落和审核状态

任务：

- 建立草稿和段落数据结构。
- 实现状态机、版本历史和乐观锁。
- 实现编辑、审核、锁定、解锁和恢复旧版本。
- 保证项目隔离。

验收：

- 人工内容不会被静默覆盖。
- 锁定内容不会被重新生成。
- 每次修改都有人员、时间和旧版本。

建议提交：

```text
feat: add versioned report drafts and review locks
```

### 阶段 6：分章 LLM 生成

任务：

- 实现章节提示词和结构化输出契约。
- 接入现有服务端文本模型配置。
- 实现单段生成、批量生成和失败重试。
- 实现使用事实和计算结果记录。
- 不修改视觉模型链路。

验收：

- 可以只生成或重生成一个段落。
- 批量生成跳过锁定段落。
- 生成结果没有模型解释。
- 不出现未提供的事实和数字。

建议提交：

```text
feat: generate formal report sections with llm
```

### 阶段 7：正文校验和网页预览

任务：

- 实现解释性语言、旧项目内容、内部编号和数字来源校验。
- 实现跨章节一致性检查。
- 实现正式报告网页预览。
- 实现错误定位和跳转。

验收：

- 校验问题能定位到具体章节和段落。
- 已锁定内容只提示，不自动修改。
- 正式版导出前校验可重复执行。

建议提交：

```text
feat: validate and preview formal report content
```

### 阶段 8：Word 生成和下载

任务：

- 完成 Word 库技术验证。
- 建立报告样式映射。
- 渲染标题、正文、表格、图片和图注。
- 实现本地文件和 CloudBase 云存储适配。
- 实现审核稿、正式版和历史版本下载。

验收：

- Word 可打开、可编辑。
- 内容、表格和图片来自冻结草稿。
- 缺图时仍可导出正式版。
- 历史版本不可漂移。

建议提交：

```text
feat: export reviewed reports as editable word files
```

### 阶段 9：双项目验收和回归

任务：

- 使用授权的西安和绵阳数据副本全流程测试。
- 核对计算结果和正式正文。
- 核对旧项目残留。
- 执行原系统回归。
- 更新 API、计算规则和验收文档。

验收：

- 两个项目使用同一母版生成各自独立报告。
- 项目名称、数据、图片和问题不串项目。
- 正文达到正式报告口径。
- 主文件改动维持最小范围。

建议提交：

```text
test: verify formal report workflow across projects
```

### 阶段 10：用户验收后再决定部署

任务：

- 展示本地成果和测试记录。
- 等待用户明确同意。
- 用户同意后再制定 CloudBase 集合初始化、依赖安装、云函数部署和静态页面发布步骤。

禁止：

- 未经授权自动部署。
- 未经授权合并 `main`。
- 未经授权迁移或重算正式项目报告。

---

## 22. 每阶段开发检查

每个阶段完成后执行适用检查：

```powershell
git status --short
git diff --check
node --check server.mjs
node --check functions/api/index.js
```

新模块逐个执行 `node --check`。有测试后执行：

```powershell
node --test tests/report-studio/*.test.mjs
```

前端内联脚本检查继续保留，同时对新增独立脚本执行语法检查。

任何阶段不得仅凭“页面能打开”判定完成，必须检查数据来源、计算结果、项目隔离和旧功能回归。

---

## 23. Mimo Code 实施纪律

1. 每次只执行当前阶段，不提前大范围修改下一阶段。
2. 编码前先说明计划修改的文件及原因。
3. 优先新增文件，不优先重写现有文件。
4. 修改 `index.html`、`server.mjs`、`functions/api/index.js` 前先检查相关未提交改动。
5. 不复制一份现有项目数据逻辑形成第二套事实来源。
6. 计算逻辑只能存在于计算核心模块，不在 UI、提示词和 Word 渲染器内重复计算。
7. LLM 结果必须经过结构化解析和确定性校验。
8. 不用 LLM 输出直接覆盖人工审核内容。
9. 不因测试方便写入虚拟项目、虚拟 KPI 或假统计。
10. 测试数据放入专用 fixture，不能混入正式项目数据目录。
11. 不把模板原文件当作项目草稿覆盖保存。
12. 新依赖必须说明用途、版本和 CloudBase 兼容性。
13. 不修改两套视觉模型的既有选择和代理架构。
14. 不改变项目、照片、正式问题的原有数据职责边界。
15. 每阶段结束更新本文档或对应子文档中的完成状态和验证结果。

---

## 24. 第一阶段完成定义

满足以下全部条件，才能认定正式报告模块第一阶段完成：

- [ ] 现有绵阳母版的所有章节、表格和图片槽位均完成结构化映射。
- [ ] 报告字段字典完整。
- [ ] 母版中需要的派生数据均由确定性引擎计算。
- [ ] 计算引擎有显式页面，可查看公式、输入、输出和来源。
- [ ] 可以冻结项目上下文和计算快照。
- [ ] 可以按章节或段落调用 LLM。
- [ ] 可以单独重新生成未锁定段落。
- [ ] 可以人工编辑、审核、锁定和恢复版本。
- [ ] 已锁定内容不会被批量生成覆盖。
- [ ] 正文不包含 AI 解释性语言。
- [ ] 正文和表格不包含内部复杂编号。
- [ ] 项目统计数字均有来源。
- [ ] 缺失事实没有被编造。
- [ ] 缺失内容可以用不依赖未知事实的正式表述补足。
- [ ] 缺少项目图片时网页提示，但仍能导出正式版。
- [ ] Word 不复用其他项目的专属图片。
- [ ] Word 章节顺序、标题层级、表格样式和图片位置逻辑与母版一致。
- [ ] Word 允许自然分页，可在 Microsoft Word 中继续编辑。
- [ ] 报告历史版本不覆盖、不漂移。
- [ ] 西安与绵阳项目数据严格隔离。
- [ ] 新功能主要位于独立文件，主文件只有最小接入改动。
- [ ] 现有项目、分析、复核、指标和小程序接口回归通过。
- [ ] 未经用户授权没有部署、合并 `main` 或修改正式数据。

---

## 25. 建议交给 Mimo Code 的首轮任务

首次不要直接开发全部功能，先执行阶段 0 和阶段 1：

```text
请先阅读 AGENTS.md、HOME_DEVELOPMENT_GUIDE.md、SESSION_HANDOFF.md、
SMART_RENEW_WORKFLOW_IMPLEMENTATION.md、WORD_REPORT_WORKFLOW.md、
REPORT_TEMPLATE_V1_SCREENING.md，以及
docs/FORMAL_REPORT_GENERATION_DEVELOPMENT_PLAN.md。

确认当前位于用户指定的开发分支，检查工作区，不覆盖已有改动，不部署。
本轮只执行开发大纲中的“阶段 0”和“阶段 1”：
建立当前报告功能基线，分析 report-template-v1.json，完成模板章节、段落、
表格、图片槽位映射，建立字段字典和旧项目内容清单。

优先新增 assets/report-studio、functions/api 的独立模块和 docs/report-studio 文档，
不要在 index.html 中加入业务逻辑，不要开始调用 LLM，不要生成 Word，
不要修改现有视觉模型链路。完成后提供修改文件、映射覆盖率、未归类块数量、
语法检查和回归检查结果，等待确认后再进入阶段 2。
```

---

## 26. 最终约束摘要

本模块的核心不是“让 AI 写一篇报告”，而是：

```text
用正式项目数据建立可追溯事实
→ 用确定性引擎完成计算
→ 用固定母版约束章节和版式
→ 用 LLM 完成正式口径的分段表达
→ 用人工审核与锁定控制最终内容
→ 用冻结版本生成可编辑 Word
```

任何实现方案如果绕过正式问题库、让 LLM 自行算数、将未知数据写成事实、把内部编号输出到正式表格、覆盖人工锁定内容，或大规模继续堆积进 `index.html`，均视为不符合本开发大纲。
