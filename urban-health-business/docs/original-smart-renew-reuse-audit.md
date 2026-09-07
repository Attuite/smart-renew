# 原 smart-renew 能力复用对照审计

> 审计对象：开发总纲、00—06模块大纲、开发状态与原smart-renew实际源码  
> 审计日期：2026-07-26  
> 审计性质：只读代码审计与开发决策依据  
> 实施大纲：`docs/reuse-first-ab-development-outline.md`

## 1. 审计目的

逐项查询当前未完成能力在原smart-renew中的实现情况，避免重复开发，并明确：

- 哪些能力可直接调用；
- 哪些能力需要模块化抽取；
- 哪些只能复用数据或思路；
- 哪些原版确实没有；
- 哪些旧实现不能进入Business；
- 哪些对象存在双数据源风险。

## 2. 复用等级

| 等级 | 含义 | 参考复用比例 |
|---|---|---:|
| A | 可直接调用、导入或薄适配 | 70%—100% |
| B | 已有可运行实现，需要抽取或适配 | 40%—70% |
| C | 只能复用局部算法、数据结构或交互 | 10%—40% |
| D | 原版没有，需要新开发或外部接入 | 0%—10% |

本次开发实施A、B等级能力。C、D等级能力保留为后续清单，除非它是A/B能力正常接入的最小必要适配。

## 3. 总体结论

原smart-renew在以下方面已有高价值实现：

- CloudBase数据库与对象存储；
- 高德地图边界绘制、地理编码和POI检索；
- 项目范围内住宅小区识别；
- JSON和SQLite项目数据交换；
- 外业任务核心；
- AI模型代理、20张拆批和候选去重；
- 人工复核和标注图派生；
- 正式问题归档；
- 报告快照和动态章节；
- Legacy迁移；
- 412条城市体检标准库。

原版仍然没有可直接复用的：

- 正式事务、索引和多实例一致性；
- 对象存储直传、分片和断点续传；
- 独立AI Worker和多实例租约；
- 复杂GeoJSON和坐标转换；
- 正式指标计算引擎；
- 高级空间算子和政务GIS；
- 正式报告模板、服务端PDF和发布签发；
- 整改闭环；
- 全接口幂等、统一错误码和浏览器E2E。

合理复用预计可以减少约30%—40%的剩余应用层开发量。

## 4. 阶段01复用对照

| 能力 | 原版实现 | 等级 | 决策 |
|---|---|---:|---|
| 项目边界绘制 | 高德地图、地址定位、MouseTool多边形、面积和中心 | B | 已抽取地图Provider并接入Business边界写模型 |
| 范围内小区识别 | POI分页、点在面内、住宅过滤和去重 | B | 已复用查询、过滤和项目边界裁剪算法 |
| CloudBase对象存储 | uploadFile、downloadFile、临时URL | B | 建立可选StorageProvider |
| 直传、分片、断点续传 | 无 | D | 后续开发 |
| JSON导入导出 | Envelope、合并导入、引用重建和导出 | A | 接入ProjectData |
| SQLite导入导出 | sql.js、表扫描、字段转换和导出 | B | 抽取转换器 |
| CSV显式映射 | 没有CSV映射，只有通用转换框架 | C | 复用框架，映射层后续完善 |
| 复杂文档和压缩包解析 | 无 | D | 后续开发 |
| 复杂GeoJSON | 无 | D | 后续开发 |
| WebP上传 | photo-storage-core支持WebP | A | 复用MIME和路径规则 |
| WebP EXIF和时区校正 | 无 | D | 后续开发 |
| 外业任务后端 | 项目、小区、楼栋和幂等任务模型 | A | 接入BFF |
| 移动采集端 | 无 | D | 后续开发 |
| 踏勘路线正式模型 | 无 | D | 后续开发 |
| 完整度规则模板 | 无 | D | 后续开发 |

主要证据：

```text
functions/api/field-collection-core.js
functions/api/photo-storage-core.js
functions/api/index.js
assets/project-data.js
index.html
```

## 5. 阶段02复用对照

| 能力 | 原版实现 | 等级 | 决策 |
|---|---|---:|---|
| AI视觉接口 | DashScope代理、模型白名单、超时 | A | HTTP复用 |
| 每20张拆批 | 已拆批并跨批合并 | B | 抽取到服务端任务 |
| 候选去重 | 标题归一化、BBox IoU、同图同分类合并 | B | 抽取纯函数 |
| 候选规范化 | 分类、风险、BBox和置信度规范化 | B | 删除旧指标映射后复用 |
| 模型元数据 | model、requestId、usage、promptVersion | B | 接入任务记录 |
| 独立Worker和租约 | 无 | D | 后续开发 |
| 运行中取消 | 只有HTTP超时 | C | 后续任务状态机 |
| 单照片失败重试 | 无 | D | 后续开发 |
| Candidate分页 | 无 | D | 后续开发 |
| Candidate筛选和批量操作 | 前端风险筛选和全部接受 | C | 复用交互 |
| 原始模型响应归档 | 无 | D | 后续开发 |
| 提示词版本仓储 | 只有页面硬编码版本号 | C | 后续开发 |

不得复用：

- 页面内写死提示词；
- 固定问题—指标映射；
- 浏览器直接调用模型的降级路径。

## 6. 阶段03复用对照

原smart-renew已经具备基本完整的人工复核。

| 能力 | 原版实现 | 等级 | 决策 |
|---|---|---:|---|
| 接受、驳回和修改 | 已实现 | B | 迁移交互 |
| 风险筛选和全部接受 | 已实现 | A/B | 接入Candidate API |
| 复核人员和时间 | 已保存 | A | 对接Business字段 |
| 复核草稿 | reviewIssues整体保存 | B | 只复用语义 |
| 正式归档 | 检查、标注图、问题入库和分析归档 | B | 保留新版幂等后复用步骤 |
| BBox显示 | 0—999坐标转百分比 | B | 抽取Renderer |
| 标注图派生 | Canvas绘制和JPEG生成 | A/B | 本次接入 |
| BBox拖拽编辑 | 无 | C | 后续开发 |
| 复核意见和附件 | 无 | D | 后续开发 |
| 多人锁和批次审计 | 无 | D | 后续开发 |
| 问题待收录 | 有字典，无维护流程 | C | 只复用状态 |

原版限制：

- 整体PUT；
- 无Candidate revision；
- 无逐次审计；
- 不支持零问题结论；
- 强制旧指标映射；
- 前端多步归档可能形成半状态。

Business Candidate、ReviewSession和OfficialIssue继续作为主数据源。

## 7. 阶段04复用对照

| 能力 | 原版实现 | 等级 | 决策 |
|---|---|---:|---|
| 高德地图和控件 | 已实现 | B | 已抽取浏览器Provider |
| 正向/反向地理编码 | 已实现 | B | 已接入正向地址定位；反向地理编码后续 |
| 地图点击定位 | 已实现 | B | 已接入问题点位 |
| 半径Circle | 已实现 | B | 后续补底图覆盖物；参数分析已存在 |
| POI分类和分页查询 | 已实现 | B | 已抽取并由BFF代理 |
| POI允许和硬排除 | 已实现 | B | 已抽取纯函数 |
| 名称、地址和空间去重 | 已实现 | B | 已复用并补测试 |
| 原始POI持久化 | 原版只保存汇总 | C | 已新增Business SpatialAnalysisRun快照 |
| 清洗人工确认 | 无确认记录 | C | 后续开发 |
| 坐标转换 | 无 | D | 后续开发 |
| 点位拖拽 | 无 | C | 后续开发 |
| 正式图层和政务GIS | 无 | D | 外部接入 |
| 复杂缓冲、叠加和路网 | 无 | D | 外部空间引擎 |

原版高德坐标必须标记为GCJ-02，Key和SecurityCode不得硬编码，启发式强弱结论不得成为指标分数。

## 8. 阶段05复用对照

原标准库共412条：

| 类型 | 数量 |
|---|---:|
| dimension | 4 |
| element | 14 |
| indicator | 61 |
| problem_category | 35 |
| problem_type | 124 |
| remediation | 124 |
| severity_band | 5 |
| severity_rule | 4 |
| code_dict | 36 |
| geo_level | 5 |

| 能力 | 原版实现 | 等级 | 决策 |
|---|---|---:|---|
| 标准目录 | 412条记录 | A | 只读复用 |
| 61指标基本字段 | 名称、维度、单位、方向和来源类型 | A | 接入目录 |
| ProjectData输入索引 | 统一记录、标签、引用和导入 | B | 作为输入准备基础 |
| JSON/SQLite指标数据交换 | 已实现 | B | 本次接入 |
| readiness | 只有零散待补录 | C | 后续正式服务 |
| 权重、阈值和公式 | 61项全部为空 | D | 外部引擎 |
| 归一化、缺失值和综合评分 | 无 | D | 外部引擎 |
| IndicatorRun和Result | 无 | D | 外部引擎 |

原6组问题—指标硬编码不能作为正式指标规则。

## 9. 阶段06复用对照

| 能力 | 原版实现 | 等级 | 决策 |
|---|---|---:|---|
| 报告来源快照 | 项目、社区、楼栋、照片、分析和问题ID | A | 复用结构 |
| 报告版本递增 | 已实现 | A | 复用算法 |
| 版本列表和读取 | 已有接口 | A | 只读适配 |
| 动态章节 | 项目、AI、社区、研判、行动和附件 | B | 抽取Renderer |
| 风险统计和表格 | 已实现 | B | 复用组件 |
| 标注照片画廊 | 已实现 | B | 复用布局 |
| ReportTemplate | 无正式模型 | C | 后续开发 |
| 自由章节 | 无 | D | 后续开发 |
| 地图/图表快照 | 只有浏览器渲染 | C | 后续服务 |
| 服务端PDF | 无 | D | 后续开发 |
| Artifact、审批和发布 | 无 | D | 后续开发 |

Business ReportRepository继续作为唯一新报告写入源，原报告只读兼容或显式迁移。

## 10. 跨阶段能力

### 10.1 整改

| 能力 | 等级 | 决策 |
|---|---:|---|
| 124条整改建议目录 | A | 只读复用 |
| 问题到建议候选关联 | C | 只作参考 |
| 派发、责任、过程、复核和销项 | D | 后续开发 |

### 10.2 迁移

| 能力 | 等级 | 决策 |
|---|---:|---|
| Legacy差异审计 | A | 直接复用 |
| 嵌入照片迁移 | A | 接入适配 |
| 正式问题补建 | B | 去除指标强制后适配 |
| JSON/SQLite导入界面 | B | 迁移Business |
| 迁移任务、进度和错误修复 | D | 后续开发 |
| Schema升级框架 | C | 后续开发 |

## 11. 平台能力

| 能力 | 原版实现 | 等级 | 决策 |
|---|---|---:|---|
| CloudBase数据库 | 9个Collection | B | 建立可选Repository |
| CloudBase对象存储 | 照片上传、下载、临时URL | B | 扩展Provider |
| 数据库事务 | 无 | D | 后续开发 |
| 正式索引和查询 | 多为全量读取后过滤 | C | 不直接沿用 |
| 多实例一致性 | 无 | D | 后续开发 |
| PATCH/revision/409 | 无 | D | 保留Business实现 |
| 全接口幂等 | 局部重复检测 | C | 后续统一 |
| ProjectData搜索 | 类型、标签、引用和关键字 | B | 本次接入 |
| 游标分页 | 无 | D | 后续开发 |
| 浏览器同步 | IndexedDB和按时间覆盖 | C/不建议 | 禁止复用 |
| 备份恢复 | JSON/SQLite元数据导出 | C | 二进制恢复后续开发 |
| 统一错误码/requestId | 基本没有 | D | 保留新版契约 |
| 日志、指标和链路追踪 | 无 | D | 后续开发 |
| Render和CloudBase部署配置 | 已有旧配置 | B | 作为Provider和部署参考 |
| 自动化测试 | 只有语法检查 | D | 使用Business测试体系 |
| 登录 | Basic Auth和AI Key会话 | C | 不作为正式权限 |

CloudBase源码存在不等于Business生产数据库已经接入；真实环境还需要环境ID、Collection、存储权限和部署验证。

## 12. 当前实际复用与遗漏

当前Business主要通过HTTP复用：

- 项目；
- 照片；
- 分析记录；
- AI视觉接口；
- 部分旧问题、报告和ProjectData读取。

尚未真正接入：

1. 高德地图边界绘制；
2. POI查询和清洗；
3. CloudBase Provider；
4. 外业任务核心；
5. JSON/SQLite转换器；
6. AI拆批和候选去重；
7. 原人工复核交互；
8. 标注图生成；
9. 报告快照核心和动态Renderer；
10. Legacy迁移；
11. ProjectData搜索和数据交换。

## 13. 双数据源风险

| 对象 | 当前来源 | 决策 |
|---|---|---|
| OfficialIssue | 原officialIssues和Business仓储 | Business主写，原版只读迁移 |
| AnalysisCandidate | 原reviewIssues和Business仓储 | Business主写，原版初始化 |
| Report | 原报告快照和Business仓储 | Business主写，原版只读迁移 |
| 数据存储 | 原本地JSON、CloudBase和Business `.data` | 通过Provider显式选择 |

不得简单删除新版实现，因为新版已补充revision、审计、零问题、幂等和stale。正确方法是固定主数据源并把旧数据作为适配或迁移输入。

## 14. 复用优先级

### P1

- 高德地图和POI；
- JSON/SQLite转换；
- CloudBase Provider；
- 标注图；
- ProjectData。

### P2

- AI拆批和去重；
- 人工复核交互；
- 报告快照和动态Renderer；
- 外业任务；
- Legacy迁移。

### P3

- 412条标准库；
- 124条整改建议；
- 分类和状态字典；
- 原部署配置。

## 15. 明确不复用

- Demo固定照片、问题、坐标、指标和报告结果；
- 原固定问题—指标映射；
- 浏览器静默回退；
- 无revision整对象覆盖；
- 硬编码地图Key；
- POI启发式评分；
- 把浏览器打印称为服务端PDF；
- CloudBase全表读取作为正式分页；
- Basic Auth作为项目权限；
- 用原版弱一致性覆盖Business增强能力。

## 16. 已采用的开发决策

1. Business OfficialIssue是新正式问题唯一写入源；
2. Business ReportRepository是新报告唯一写入源；
3. Business AnalysisCandidate是候选主数据源；
4. 本地和CloudBase通过统一Repository和StorageProvider切换；
5. 高德地图以Provider形式抽取；
6. JSON/SQLite转换进入ProjectData适配层；
7. SourceAsset负责原始文件和来源追溯；
8. 标注图先复用原浏览器Canvas算法；
9. 原外业任务作为外业BFF基础；
10. ProjectData作为统一搜索和指标输入准备基础；
11. 原版A/B能力接入前不继续平行新写同类基础实现。

## 17. 关键源码索引

| 能力 | 原版源码 |
|---|---|
| CloudBase数据库和存储 | `functions/api/index.js` |
| 外业核心 | `functions/api/field-collection-core.js` |
| 照片核心 | `functions/api/photo-storage-core.js` |
| 正式问题核心 | `functions/api/official-issue-core.js` |
| 报告快照 | `functions/api/report-snapshot-core.js` |
| ProjectData | `functions/api/project-data-core.js` |
| Legacy迁移 | `functions/api/legacy-migration-core.js` |
| JSON/SQLite交换 | `assets/project-data.js` |
| 标准库 | `assets/data/city-health-standard-library-v1.js` |
| 地图、POI、AI、复核、标注和报告 | `index.html` |
| CloudBase部署 | `cloudbaserc.json` |
| Render部署 | `render.yaml` |

## 18. 维护要求

每完成一个复用工作包：

1. 更新实际复用等级；
2. 记录来源函数和适配层；
3. 更新主数据源状态；
4. 增加源行为回归测试；
5. 同步更新开发总纲、模块大纲和开发状态；
6. 如决定不复用，记录具体原因。
