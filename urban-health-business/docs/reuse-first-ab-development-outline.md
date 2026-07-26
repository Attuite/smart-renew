# Urban Health Business A/B等级复用优先开发大纲

> 文档定位：本次开发的直接执行大纲  
> 上位文件：`readme.md`开发总纲  
> 审计依据：`docs/original-smart-renew-reuse-audit.md`  
> 开发范围：复用等级A、B的能力  
> 非本次范围：复用等级C、D的能力，除非它是A/B能力正常接入的最小必要适配  
> 更新日期：2026-07-26

## 1. 开发目标

本次开发不再默认把未完成功能从零实现，而是优先接入原 `smart-renew` 已经可运行、可抽取或可通过接口适配的能力。

本次开发完成后，应达到：

1. 原版A/B等级能力中当前Business尚缺的部分，通过统一BFF或独立前端模块增量进入Business；
2. 已有新版增强能力不因复用而降级；
3. 项目、照片、分析、候选、正式问题、报告等对象具有明确唯一主数据源；
4. 原版单页中的地图、POI、标注图、导入和报告算法被模块化；
5. CloudBase代码被封装为可选Provider，本地模式仍可独立运行；
6. 原版ProjectData、外业任务、迁移和报告快照能力不再重复开发；
7. C/D等级能力继续返回真实缺失、待接入或受限状态；
8. V9.1 Demo继续保持只读和哈希一致。
9. 已经完成的Business照片、边界、AI任务、人工复核和报告核心继续作为实现基线，不因复用工作被平行重写。

## 2. 本次范围判定

### 2.1 纳入本次开发

- 复用审计中标记为A的能力；
- 复用审计中标记为B的能力；
- 为接入A/B能力必须增加的薄适配器、契约、测试和说明；
- 为消除双数据源必须增加的一次性迁移或只读兼容；
- 已经开始但尚未接线的功能，如果能复用原版实现，应先调整设计再继续。

已经在Business中完成且运行约束更强的能力，不再作为“待开发功能”重复实施；它们只作为A/B接入时必须保持的现有基线。

### 2.2 不纳入本次开发

- 正式指标计算引擎；
- 数据库事务和多实例一致性；
- 对象存储直传、分片和断点续传；
- 独立AI Worker、多实例租约和抢占；
- DOCX、XLSX、ZIP和无人机资料深度解析；
- 复杂GeoJSON、坐标转换和高级空间算子；
- 政务GIS；
- 多人复核锁和完整协作系统；
- 正式模板服务、服务端PDF、审批、签发、发布和分享；
- 整改派发、责任、复核和销项；
- 游标分页、全链路追踪和完整配置中心；
- 正式角色权限和安全专项。

这些能力保留在复用审计和开发总纲的后续待开发清单中，不得用原版弱实现或Demo数据伪装完成。

## 3. 复用原则

### 3.1 API优先

原版已有稳定接口时，Business通过`server/adapters/smart-renew/`调用，不复制服务端实现。

适用能力：

- 项目；
- 照片；
- 分析记录；
- AI视觉模型；
- 外业任务；
- ProjectData；
- Legacy迁移；
- 旧报告读取。

### 3.2 纯函数直接复用

原版已拆分为无运行时副作用的纯函数时，通过适配层导入或建立薄包装，不再重写同类校验和转换。

优先来源：

```text
functions/api/field-collection-core.js
functions/api/photo-storage-core.js
functions/api/project-data-core.js
functions/api/report-snapshot-core.js
functions/api/legacy-migration-core.js
```

`official-issue-core.js`含旧指标强制映射，只允许选择性复用，不作为Business正式问题主写入逻辑。

### 3.3 单页算法最小抽取

原版`index.html`中的可运行算法应抽取为独立模块，不直接加载整个旧页面，不复制无关UI状态。

优先抽取：

- 高德地图初始化；
- 项目边界绘制；
- 点在多边形内判断；
- POI分页查询；
- POI允许、排除和去重；
- AI每20张拆批；
- BBox IoU候选去重；
- 标注框渲染；
- Canvas标注图生成；
- 动态报告章节渲染。

每个抽取模块必须记录来源函数并增加回归测试。

### 3.4 数据优先复用

标准库、整改建议和状态字典作为只读目录复用，不把数据目录误判为运行引擎。

### 3.5 不回退新版约束

原版缺少以下语义时，继续使用新版实现：

- revision；
- 409冲突；
- 候选级审计；
- 正式问题修订；
- 零问题结论；
- 幂等请求；
- stale传播；
- 归档后只读；
- Demo隔离；
- 后端失败不静默保存浏览器。

## 4. 主数据源决策

本次开发开始前先固定以下主数据源，后续代码不得绕过：

| 对象 | 主数据源 | 原版数据处理 |
|---|---|---|
| Project | 原smart-renew项目仓储 | Business通过BFF适配PATCH和revision |
| Photo二进制及基础记录 | 原smart-renew照片仓储或配置后的CloudBase Provider | Business照片治理保存覆盖层 |
| AnalysisRecord | 原smart-renew分析记录 | Business任务和候选引用其ID |
| AnalysisCandidate | Business Candidate仓储 | 原`reviewIssues`只作为初始化来源 |
| ReviewSession | Business ReviewSession仓储 | 原版无对应正式模型 |
| OfficialIssue | Business OfficialIssue仓储 | 原`officialIssues`只读兼容并显式迁移 |
| SourceAsset | Business SourceAsset仓储 | 原版ProjectData导入作为转换来源 |
| SpatialAnalysisRun | Business空间分析仓储 | 原`communityAnalysis`只读导入或参考 |
| Report | Business Report仓储 | 原报告快照只读导入或作为基础快照来源 |
| ProjectData索引 | 原ProjectData能力经BFF统一暴露 | Business实体通过适配器进入索引 |
| 标准库 | 原412条标准库只读来源 | 不在Business复制演示指标公式 |

### 4.1 双写禁令

- 新正式问题不得同时写Business和原`officialIssues`；
- 新报告不得同时由两个报告仓储独立生成；
- 新Candidate不得同时以两个可编辑副本存在；
- CloudBase模式与本地模式不得在同一次请求中无审计双写；
- Legacy迁移必须显式触发并记录结果。

## 5. 工作包总览

以下工作包右侧所列增量全部属于本次A/B开发范围；现有基线仅用于约束接入，不计入待开发量。排列顺序表示技术依赖，不表示只完成某一个阶段。

| 工作包 | Business现有基线（保留、不重写） | 本次仅完成的增量 |
|---|---|---|
| AB-00 主数据源和复用适配基础 | SmartRenewClient、上游代理、`/api/meta`、基础能力声明 | 能力注册、专项适配器、唯一主数据源读取规则和契约测试 |
| AB-01 ProjectData与结构化数据交换 | ProjectData集合读取、SourceAsset二进制/哈希/预览、项目JSON汇总导出 | JSON Envelope和SQLite导入导出、统一索引、搜索及引用重建 |
| AB-02 外业任务和照片存储核心 | 上传会话、WebP、照片归属校验、哈希、幂等和本地持久化 | 外业任务BFF、原核心适配、归属规则收敛和CloudBase存储契约 |
| AB-03 高德地图和项目边界 | 边界校验、面积/中心、修订历史、GeoJSON导入、点在多边形内和SVG预览 | 高德Provider、地址定位、交互绘制、底图回显和边界内小区检索 |
| AB-04 POI检索与清洗 | 参数化半径分析、结果快照和stale传播 | POI分页查询、清洗、去重、Provider和来源快照 |
| AB-05 AI拆批、规范化和去重 | 20张以内异步任务、类别/BBox规范化、Candidate持久化和动态统计 | 超过20张自动拆批、跨批合并、IoU去重和批次元数据 |
| AB-06 人工复核交互与标注图 | 接受/排除/修改、Candidate修订审计、ReviewSession、归档和正式问题 | 风险筛选、批量接受、BBox显示、Canvas标注图及派生资产归档 |
| AB-07 报告快照与动态Renderer | Business快照、版本、内容修订、审计、比较、stale、JSON和打印页 | 原快照来源适配、动态章节Renderer、表格及标注照片画廊 |
| AB-08 CloudBase Provider | 本地JSON仓储和本地文件存储能力声明 | 可选数据库/对象存储Provider及Mock契约 |
| AB-09 Legacy迁移 | 新旧问题和报告只读合并展示 | 迁移预检、显式执行、结果审计、幂等保护和只读版本迁移 |
| AB-10 标准库和整改建议目录 | 指标引擎未接入状态和空结果契约 | 412条标准、61指标和124条建议的只读目录 |
| AB-11 文档、回归与边界验证 | 现有单元、全过程集成、Demo及原项目边界校验 | 只补增量模块的源行为、适配契约和浏览器回归 |

### 5.1 增量执行规则

- 表中“Business现有基线”不是本次待开发清单，不得重新立项或平行实现；
- 每个工作包开始前，先为现有基线建立或确认回归测试，再接入右侧增量；
- 原版能力弱于Business现有语义时，只抽取缺失算法或数据，不替换Business主模型；
- 发现原版与Business存在同类算法时，先做行为对照；只有确认完全等价且不损失revision、审计、stale和幂等语义后，才允许收敛为共享实现；
- 删除或替换现有Business代码必须作为独立变更审查，不能以“复用”为理由直接覆盖；
- 工作包完成度只按“本次仅完成的增量”计算。

## 6. AB-00 主数据源和复用适配基础

> 状态：已完成（2026-07-26）。后续工作包必须通过本节建立的适配器和主数据源策略接入。

### 6.1 目标

- 保留当前`SmartRenewClient`、通用上游代理、`/api/meta`和已有能力声明；
- 建立统一LegacyCapabilityRegistry；
- 明确本地原服务、CloudBase和Business仓储的启用状态；
- 为外业、ProjectData、迁移和旧报告补齐适配器方法；
- 禁止业务服务直接拼接旧接口地址；
- 在`/api/meta`中如实报告复用能力。

当前适配客户端和元数据接口不重写，只补齐缺少的方法、注册和契约。

### 6.2 交付物

```text
server/adapters/smart-renew/
├─ client
├─ capabilities
├─ field-adapter
├─ project-data-adapter
├─ legacy-migration-adapter
├─ report-snapshot-adapter
├─ source-of-truth
└─ read-model-policy
```

实际实现还提供统一适配器工厂；Business服务对旧照片、分析、问题和报告的调用已收敛到适配层方法，不再在业务服务中拼接旧接口路径。

### 6.3 验收

- 每项旧能力有`available/unavailable/degraded`状态；
- 上游不可用时返回明确错误；
- 不回退Demo或浏览器持久化；
- 主数据源表与实际写入路径一致；
- 适配器具有隔离集成测试。

## 7. AB-01 ProjectData与结构化数据交换

> 状态：本工作包A/B范围已完成。记录数组与JSON Envelope、跨项目ID/引用重定向、SQLite SourceAsset转换、来源追溯、真实SQLite导出及索引重建均已接入。

### 7.1 当前基线

- `SmartRenewClient.projectCollections()`已经读取原ProjectData集合；
- 工作流和完整度校验已经消费其中部分记录；
- SourceAsset已经负责原始二进制、哈希、预览和不可变引用；
- 项目级JSON导出已经汇总当前Business及旧集合数据。

以上能力保留。本工作包不再建设第二套SourceAsset仓储，也不重写现有项目导出。

### 7.2 本次复用增量

- `normalizeProjectDataRecord`；
- `buildNativeProjectIndex`；
- `projectDataStats`；
- JSON Envelope；
- SQLite表扫描；
- SQLite行到ProjectData转换；
- 记录重定向和引用重建；
- JSON和SQLite导出。

### 7.3 与当前SourceAsset的连接

SourceAsset负责：

- 原始文件二进制；
- 哈希；
- 来源；
- 上传人员；
- 预览；
- 不可变文件引用。

ProjectData转换器负责：

- 结构化行；
- 类型归一化；
- 来源编号；
- 引用重建；
- 导入结果。

不得让SourceAsset解析器再独立实现一套通用ProjectData模型。

ProjectData SQLite使用独立转换服务并复用现有SourceAsset二进制、哈希与导入审计仓储；`source-asset-import-service.mjs`仍只处理小区/楼栋CSV和JSON字段映射，不再承担第二套通用ProjectData模型。

### 7.4 本次支持

- JSON Envelope导入；
- JSON记录数组导入；
- SQLite已知表导入；
- JSON和SQLite项目数据导出；
- 按类型、标签、引用和关键字查询；
- SourceAsset到ProjectData的来源追溯。

CSV显式字段映射只实现接入A/B转换框架所需的最小层，复杂自定义映射仍保留后续任务。

## 8. AB-02 外业任务和照片存储核心

> 状态：部分完成。外业层级查询、任务创建/读取和任务引用列表已接入；外业工作台及CloudBase存储契约尚未完成。

### 8.1 当前基线

- Business已支持JPEG、PNG和WebP上传；
- 已有上传会话、刷新恢复、取消、失败重试、哈希和幂等；
- 已有照片与有效小区、可选楼栋的归属校验；
- 已有原始二进制持久化和照片治理覆盖层。

这些代码继续作为照片主流程，不重新迁移一套上传服务。

### 8.2 本次复用增量

- 有效小区和楼栋列表；
- 小区/楼栋归属校验；
- 外业任务ID；
- 外业任务幂等；
- WebP MIME支持；
- 照片存储路径；
- CloudBase照片上传和下载。

其中WebP和归属校验已经具备，本次只做与原核心的行为对照和规则收敛，不重复实现。

### 8.3 本次交付

- BFF外业项目、小区、楼栋查询；
- 外业任务创建和读取；
- Business工作台的外业任务列表；
- 现有WebP上传与Provider契约一致性验证；
- 现有照片归属规则与原核心收敛为单一调用路径；
- 本地与CloudBase Provider契约一致。

移动采集页面、路线模型、WebP EXIF和批量归属历史属于C/D，不在本次开发。

## 9. AB-03 高德地图和项目边界

### 9.1 当前基线

- Business后端已有边界点、闭合、自相交、面积和项目revision校验；
- 已有面积、中心点、修订快照、历史和GeoJSON导入；
- 已有点在多边形内判断及问题点边界内约束；
- 前端已有不依赖固定底图的真实经纬度SVG预览。

这些几何和审计能力保留，高德接入不得另写一套边界保存模型。

### 9.2 本次复用增量

- 地图初始化；
- Scale、ToolBar等控件；
- 地址正向地理编码；
- Polygon绘制；
- 面积和中心点计算；
- 已有边界回显；
- 边界内小区检索；
- 点在多边形内判断。

面积、中心点和点在多边形内已经存在，本次先做源行为对照；地图模块统一调用Business现有后端校验。

### 9.3 必须改造

- Key和SecurityCode改为运行配置；
- Provider显式声明坐标系为GCJ-02；
- 地图加载失败显示真实不可用状态；
- 保存前继续调用Business后端边界校验；
- 不复用原浏览器本地回退；
- 不复用原页面全局变量。

### 9.4 验收

- 可以从真实地址定位；
- 可以绘制和回显真实项目边界；
- 保存产生Business边界修订历史；
- 无地图配置时不生成假边界；
- Demo西安背景图不进入Business。

## 10. AB-04 POI检索与清洗

### 10.1 当前基线

Business已有参数化问题半径分析、结果快照、来源revision和stale传播。该分析继续保留，POI能力作为新的数据来源和分析类型接入，不替换现有问题半径分析。

### 10.2 本次复用增量

- 社区和街区分类规则；
- 高德PlaceSearch分页；
- 半径过滤；
- 硬排除规则；
- 允许规则；
- 名称和地址归一化；
- 空间合并；
- 分类汇总。

### 10.3 必须改造

- 搜索结果通过BFF或受控Provider运行；
- 保存原始POI；
- 保存查询参数和Provider信息；
- 保存清洗前后数量；
- 记录清洗规则版本；
- 自动结论不得作为指标评分；
- 结果写入Business SpatialAnalysisRun，不覆盖项目单字段。

人工逐条确认、正式图层和复杂空间算子不在本次A/B范围。

## 11. AB-05 AI拆批、规范化和去重

### 11.1 当前基线

- Business已有持久化异步AnalysisJob、排队、失败、取消、重试和重启恢复；
- 当前单任务限制为最多20张照片；
- 已有模型JSON解析、类别/BBox/置信度规范化；
- 已有Candidate独立仓储、照片内容哈希快照、stale传播和动态风险统计。

以上任务和Candidate框架保留。本工作包不得重新建设AI任务执行器或候选仓储。

### 11.2 本次复用增量

- 超过20张时按20张一批；
- 多批结果合并；
- 分类规范化；
- BBox合法化；
- 标题归一化；
- BBox IoU；
- 同图同分类去重；
- 模型、requestId、usage和promptVersion字段。

分类和BBox规范化已有实现，只补源行为对照、跨批一致性及当前缺失的去重逻辑。

### 11.3 必须改造

- 拆批发生在服务端任务执行器；
- 每批状态写入AnalysisJob；
- 原固定问题—指标映射删除；
- 候选写入Business Candidate仓储；
- 每批照片证据和内容哈希可追溯；
- 失败不得回退浏览器模型直连。

独立Worker、租约、运行中取消和单照片重试不在本次A/B范围。

## 12. AB-06 人工复核交互与标注图

### 12.1 当前基线

- Business已有逐项接受、排除、字段修正和人工补录；
- 已有Candidate独立存储、乐观修订、审计、归档后只读和stale阻塞；
- 已有ReviewSession、零问题结论和Business OfficialIssue主写入。

上述复核主流程已经完成，不从原版重新迁移。

### 12.2 本次仅复用的缺失增量

- 风险筛选；
- 全部接受；
- 标注框百分比渲染；
- Canvas标注图生成；
- 标注图上传归档步骤；
- 复核完成后的分析归档语义。

现有归档语义继续作为准则；原版归档代码只用于行为参考，不替换Business归档服务。

### 12.3 保留新版能力

- Candidate独立仓储；
- `candidateRevision`；
- 候选审计；
- ReviewSession；
- 零问题结论；
- OfficialIssue独立于指标引擎；
- 归档幂等；
- 归档后只读；
- stale阻塞。

### 12.4 主写入规则

原`/api/issues/finalize`由于强制旧指标映射，不作为Business新正式问题的主写入接口。它只用于旧数据读取和迁移验证。

## 13. AB-07 报告快照与动态Renderer

### 13.1 当前基线

- Business已有唯一报告仓储、真实数据快照和版本递增；
- 已有内容修订、乐观冲突、审计、版本比较和stale传播；
- 已有JSON下载和独立打印过渡页；
- 已支持零正式问题及指标未接入状态。

上述报告模型和仓储不重写，原报告只作为快照来源和Renderer素材。

### 13.2 本次复用增量

- 来源ID快照；
- 项目概况章节；
- AI问题章节；
- 社区/街区章节；
- 综合研判；
- 行动建议；
- 风险统计卡；
- 表格和照片画廊。

现有版本算法和数据统计只进行对照测试，不重新实施。

### 13.3 保留新版能力

- Business报告仓储为唯一主写入；
- 内容修订；
- 修订审计；
- 报告比较；
- stale传播；
- 不完整草稿；
- JSON下载；
- 打印过渡页。

原`/api/reports/generate`只用于旧报告兼容或迁移，不再与Business并行生成新报告。

正式Template、自由章节、服务端PDF、发布签发不在本次A/B范围。

## 14. AB-08 CloudBase Provider

### 14.1 目标

复用原CloudBase数据库与对象存储实现，建立可选Provider，不改变本地模式的可运行性。

当前Business只有本地JSON和本地文件实现以及真实能力声明，不存在可复用的Business CloudBase Provider；本工作包属于新增接入，不替换本地Provider。

### 14.2 本次范围

- Provider能力声明；
- 数据库Collection配置；
- Photo、SourceAsset和ReportArtifact对象存储接口；
- 上传、下载和临时URL；
- Repository基础CRUD适配；
- 使用Mock或隔离环境进行契约测试。

### 14.3 外部条件

真实CloudBase部署验证需要：

- 环境ID；
- Collection；
- 存储权限；
- 部署权限；
- 网络和凭据。

缺少这些外部条件时，代码、契约和Mock测试可以完成，但不得声称真实云环境已经验收。

事务、正式索引、多实例一致性和直传不在本次A/B范围。

## 15. AB-09 Legacy迁移

> 状态：本工作包A/B范围已完成。原迁移、Business问题/报告转换、只读报告、来源指纹、冲突预检、运行审计、失败留痕和请求幂等均已接入。

### 15.1 当前基线

Business当前对旧正式问题和旧报告采用只读合并展示，但这不是迁移，也没有迁移结果审计。现有只读兼容在迁移完成前保留。

### 15.2 本次复用内容

- 嵌入原始照片统计；
- 嵌入标注图统计；
- 已归档候选统计；
- 正式问题差异；
- 原照片迁移；
- 原问题补建；
- 迁移前后审计。

### 15.3 本次交付

- 迁移预检；
- 显式执行；
- 迁移结果记录；
- 重复执行保护；
- 旧OfficialIssue到Business OfficialIssue的一次性迁移；
- 原报告快照到Business只读版本的迁移；
- 失败项目清单。

通用迁移任务队列和Schema升级框架不在本次A/B范围。

## 16. AB-10 标准库和整改建议目录

### 16.1 本次交付

当前Business仅有“指标引擎未接入”的能力契约，没有标准和整改建议查询接口；以下内容均为增量接入：

- 412条标准库只读查询；
- 61个指标目录；
- 问题分类、问题类型和严重度字典；
- 124条整改建议目录；
- ProjectData引用；
- 指标输入准备页面的数据来源说明。

### 16.2 明确限制

- 权重、阈值和公式为空；
- 不计算综合分；
- 不把124条建议直接变成整改派发；
- 不自动把Business问题强制绑定旧6组指标；
- 外部指标引擎仍显示未接入。

## 17. API调整范围

本次开发优先补齐或统一以下接口，最终路径以API规范为准：

```text
GET  /api/meta

GET  /api/projects/{projectId}/field/communities
GET  /api/projects/{projectId}/field/communities/{communityId}/buildings
POST /api/projects/{projectId}/field/tasks
GET  /api/projects/{projectId}/field/tasks

GET  /api/projects/{projectId}/project-data
POST /api/projects/{projectId}/project-data
GET  /api/projects/{projectId}/project-data/export
POST /api/projects/{projectId}/project-data/sqlite-import
GET  /api/projects/{projectId}/project-data/imports
POST /api/projects/{projectId}/project-data/rebuild
GET  /api/projects/{projectId}/project-data/sqlite-export

GET  /api/projects/{projectId}/legacy-migration
POST /api/projects/{projectId}/legacy-migration

GET  /api/standards
GET  /api/standards/indicators
GET  /api/standards/remediations
```

地图和POI运行接口是否由BFF代理，应根据高德服务端接口授权方式决定；不得在页面暴露不应公开的服务密钥。

## 18. 测试要求

现有单元测试、全过程集成测试、Demo完整性和原项目边界校验全部保留。本节只要求为新接入的增量补测试，不重新建立一套平行测试框架。

### 18.1 源行为回归

每个抽取模块必须包含原版行为样例：

- 项目边界面积和中心；
- 点在多边形内；
- POI名称/地址合并；
- BBox IoU；
- 候选去重；
- 20张拆批；
- 标注图坐标换算；
- SQLite字段转换；
- 引用重建；
- 报告版本递增；
- Legacy迁移审计。

### 18.2 适配契约

- 原本地API；
- CloudBase Provider Mock；
- Business BFF；
- 上游不可用；
- 重复提交；
- 空数据；
- 旧数据迁移；
- 主数据源不双写。

### 18.3 浏览器验证

- 地图加载和缺配置状态；
- 边界绘制和回显；
- POI查询结果；
- 标注框和标注图；
- JSON/SQLite导入导出；
- 动态报告章节；
- 刷新后状态恢复；
- 无Demo固定数据。

### 18.4 固定边界

- Demo哈希保持；
- 原smart-renew文件无修改；
- 新功能只进入`urban-health-business/`；
- 真实项目不被自动化测试写入；
- 临时集成测试使用隔离目录。

## 19. 完成定义

本次A/B复用开发只有在以下条件全部满足时完成：

1. A/B工作包表中“本次仅完成的增量”均有实际代码接入或明确外部条件阻塞记录；
2. 原版已有实现和Business现有基线均不再被平行重写；
3. 地图、POI、导入、标注图、报告Renderer等抽取代码有回归测试；
4. ProjectData、外业、迁移等原接口已进入BFF；
5. 主数据源决策与实际写入一致；
6. 无正式问题、候选或报告双写；
7. CloudBase Provider代码和契约可验证，真实云环境状态如实声明；
8. C/D能力仍显示未接入或受限，不被误报完成；
9. 六阶段工作流仍使用真实业务数据；
10. Demo和原smart-renew完整性校验通过；
11. 开发状态和复用审计同步更新；
12. 所有新增接口具有文档和自动化测试。

## 20. 依赖顺序说明

以下顺序只表示技术依赖，不缩减全过程范围：

```text
主数据源与适配基础
→ ProjectData / 外业 / Legacy后端能力
→ 地图、POI、AI和复核算法抽取
→ 报告Renderer和标准库
→ CloudBase Provider
→ 全过程联调与回归
```

所有A/B工作包均属于本次开发目标，不能把某一个工作包完成视为整个开发完成。
