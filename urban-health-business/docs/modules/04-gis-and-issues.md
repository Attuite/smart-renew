# 04 GIS落图与问题清单模块开发大纲

> 阶段ID：`gis-and-issues`  
> 上游：03人工复核、01项目边界与资料  
> 下游：05指标、06报告  
> 模块定位：正式问题的真实空间定位、绑定、查询和可复现分析
>
> V9.1地图视觉、图层、问题联动、照片、路线、POI确认、坐标转换和报告地图快照的完整专项开发范围，统一以
> [`04-gis-v9.1-map-development-outline.md`](04-gis-v9.1-map-development-outline.md)
> 为执行大纲；该专项为单一完整交付范围，不拆分首版或后续二期。

## 1. 模块目标

将OfficialIssue绑定到真实地图坐标和真实空间对象，形成可筛选、可调整、可追溯的问题空间台账，并对需要的项目范围或问题点执行可复现的空间分析。

## 2. 非目标

- 不使用西安静态背景图；
- 不使用百分比坐标；
- 不假设每个项目固定42个问题；
- 不预置500/800/1000米分析结果；
- 不在浏览器临时计算后直接写报告；
- 不把AI候选当作GIS正式问题；
- 不把高德POI搜索汇总误称为正式政务GIS成果。

## 3. 用户角色

- GIS分析人员；
- 人工复核人员；
- 项目负责人；
- 报告人员；
- 只读审核人员。

## 4. 前置条件

- 已选择Project；
- Project存在真实边界或明确允许无边界操作；
- 03已形成OfficialIssue，允许数量为0；
- 地图能力状态可查询；
- 问题照片位置、人工坐标或空间对象至少有一种定位依据。

## 5. 完整用户流程

```text
进入GIS工作台
→ 加载项目边界和正式问题
→ 加载已有SpatialBinding
→ 自动建议点位和空间对象
→ 人工确认或调整点位
→ 绑定小区/楼栋/地块/道路
→ 查看问题清单和证据
→ 选择分析范围和数据源
→ 创建SpatialAnalysisRun
→ 后端查询、清洗、去重和统计
→ 人工确认分析结果
→ 固化空间分析版本
→ 提供给指标和报告
```

0正式问题：

```text
加载项目
→ 显示“本次复核未形成正式问题”
→ 允许记录无问题结论
→ 不生成固定点位
→ 报告引用0问题的正式结果
```

## 6. 页面与组件

### 6.1 问题清单

- 分页；
- 风险筛选；
- 类型筛选；
- 状态筛选；
- 位置状态；
- 搜索；
- 当前显示数；
- 选择问题。

### 6.2 真实地图

- 项目边界；
- 正式问题点；
- 照片点；
- 小区、楼栋、地块和道路；
- 图层控制；
- 缩放、平移和复位；
- 点位拖动；
- 聚合显示；
- 当前坐标系。

### 6.3 问题详情

- 正式问题；
- 原始和标注照片；
- 复核结论；
- 当前geometry；
- 坐标来源；
- 位置精度；
- 空间对象绑定；
- 调整历史；
- 证据链。

### 6.4 空间分析

- 分析类型；
- 输入问题；
- 分析半径；
- POI或图层类别；
- 数据源；
- 原始数量；
- 清洗规则；
- 最终数量；
- 地图结果；
- 分析版本；
- 人工确认。

### 6.5 数据来源

- 提供者；
- 查询时间；
- 来源版本；
- 数据性质；
- 适用范围；
- 限制说明。

## 7. 输入数据

- Project boundary；
- OfficialIssue；
- Photo location；
- SpatialBinding；
- 小区、楼栋和其他空间台账；
- 地图服务；
- POI/GIS数据源；
- 空间分析配置。

## 8. 输出数据

- SpatialBinding；
- geometry变更日志；
- SpatialAnalysisRun；
- 原始和清洗结果引用；
- 项目空间summary；
- GIS证据引用；
- 指标和报告可使用的版本ID。

## 9. 状态机

SpatialBinding：

```text
pending
auto_bound
confirmed
adjusted
rejected
not_required
```

SpatialAnalysisRun：

```text
queued
running
needs_confirmation
completed
failed
canceled
stale
unavailable
```

问题位置：

```text
missing
photo_derived
manually_located
object_bound
confirmed
```

## 10. 数据模型

使用：

- OfficialIssue；
- SpatialBinding；
- SpatialAnalysisRun；
- SpatialLayer；
- SpatialFeature；
- SpatialSource；
- SpatialCleaningResult；
- GeometryRevision。

需要进一步定义：

```text
SpatialLayer
SpatialFeature
PoiRawRecord
PoiCleanRecord
GeometryRevision
SpatialAnalysisResult
```

坐标必须记录：

- geometry；
- crs；
- originalGeometry；
- originalCrs；
- conversion；
- source；
- accuracy；
- confirmedBy。

## 11. 前端服务

```text
issueApi.list(projectId, query)
issueApi.get(issueId)
spatialApi.getBinding(issueId)
spatialApi.patchGeometry(issueId, revision, geometry)
spatialApi.confirmBinding(issueId, payload)
spatialApi.createAnalysis(projectId, payload)
spatialApi.getAnalysis(analysisId)
spatialApi.listAnalyses(projectId)
spatialApi.getSummary(projectId)
layerApi.list(projectId)
```

## 12. 后端服务

- 坐标校验和转换；
- 位置建议；
- 空间对象绑定；
- geometry revision；
- 地图数据适配；
- POI查询；
- 原始结果保存；
- 清洗和去重；
- 空间聚合；
- 分析运行版本；
- 数据来源登记；
- 工作流和stale传播。

## 13. 目标API

```http
GET   /api/issues?projectId={projectId}
GET   /api/issues/{issueId}
GET   /api/issues/{issueId}/spatial-binding
PATCH /api/issues/{issueId}/geometry
POST  /api/issues/{issueId}/spatial-bindings
GET   /api/gis/config
POST  /api/projects/{projectId}/gis/geocode
GET   /api/projects/{projectId}/spatial-layers
POST  /api/projects/{projectId}/spatial-analyses
GET   /api/projects/{projectId}/spatial-analyses
POST  /api/projects/{projectId}/poi-analyses
GET   /api/projects/{projectId}/poi-analyses
GET   /api/spatial-analyses/{analysisId}
POST  /api/spatial-analyses/{analysisId}/confirm
GET   /api/projects/{projectId}/spatial-summary
```

## 14. 旧smart-renew复用

复用审计等级A/B：

- 高德地图初始化和项目边界绘制；
- 地址定位、反向地理编码和地图点击；
- 半径Circle显示；
- 社区/街区POI搜索；
- POI分页；
- POI允许、硬排除、名称/地址归一化和空间去重；
- 社区/街区分类规则；
- 项目communityAnalysis；
- OfficialIssue核心；
- 项目、小区和楼栋台账；
- 照片位置。

当前不足：

- POI搜索和清洗主要发生在浏览器；
- 只保存汇总，缺原始/清洗数据；
- 缺问题geometry独立模型；
- 缺空间运行版本；
- 缺人工调整日志；
- 部分充电桩等统计存在推定逻辑。

适配后原始POI、清洗参数和规则版本写入Business SpatialAnalysisRun；原`communityAnalysis`只作为只读迁移来源。不得把估算值、启发式强弱结论或高德GCJ-02坐标冒充正式指标和WGS84数据。

## 15. V9.1迁移内容

迁移：

- GIS三栏工作台；
- 问题清单；
- 风险和类型过滤；
- 地图图层控制；
- 问题详情页签；
- 周边条件展示；
- 数据来源页签；
- 证据追溯；
- 空间绑定完成汇总。

## 16. 必须剥离的Demo内容

- 西安地图背景；
- 固定项目边界；
- 固定42点；
- 固定36已绑定/6待确认；
- 固定MAP编号；
- 固定500/800/1000结果；
- 固定8类输入图层；
- 百分比坐标；
- 固定楼栋、地块和道路；
- Demo预置距离连线和周边数量。

## 17. 空、失败和恢复

| 场景 | 行为 |
|---|---|
| 0正式问题 | 显示合法无问题结论 |
| 地图不可用 | 列表可读，地图标记unavailable |
| 坐标缺失 | 标记missing，允许人工补点 |
| 坐标转换失败 | 不保存显示坐标，提示原坐标 |
| POI数据源失败 | SpatialAnalysisRun失败，可重试 |
| 部分绑定 | 保存已确认项 |
| 页面刷新 | 从Binding和Run恢复 |
| 上游问题修改 | 相关绑定/分析stale |
| 边界变化 | 项目空间分析stale |

## 18. 跨模块依赖

上游：

- 00 Project boundary；
- 01 Photo location和空间台账；
- 03 OfficialIssue。

下游：

- 05读取SpatialAnalysisRun；
- 06读取Binding和空间分析版本；
- 后续整改模块读取问题位置。

## 19. 数据一致性与幂等

- OfficialIssue不复制为GIS问题实体；
- Binding引用issueId；
- geometry更新使用revision；
- Analysis创建使用幂等键；
- 原始POI和清洗结果保留版本；
- 相同Run不重复固化；
- 上游变化标记stale；
- 统计由后端生成。

## 20. 测试

### 20.1 单元测试

- GeoJSON校验；
- 坐标系转换；
- 位置状态；
- 空间绑定；
- 半径参数；
- 去重规则；
- stale传播。

### 20.2 契约测试

- issue分页；
- geometry PATCH；
- revision冲突；
- 创建SpatialAnalysisRun；
- 数据源不可用；
- 0问题summary；
- 分析确认。

### 20.3 E2E

- 加载真实问题；
- 补点并确认；
- 调整点位；
- 创建空间分析；
- 刷新恢复；
- 上游修改导致stale；
- 0正式问题流程；
- Business不出现固定42点。

## 21. 验收标准

1. 地图使用真实服务；
2. 边界来自Project；
3. 点位来自OfficialIssue和Binding；
4. 使用真实坐标；
5. 位置调整可追溯；
6. 空间分析可复现；
7. 数据源有说明；
8. 0问题可合法完成；
9. 指标和报告可引用运行ID；
10. 无固定GIS结果。

## 22. 当前实现状态

当前Business已按V9.1 GIS专项大纲完成本地开发与离线验收，包括：

- 高德地图Provider；
- 三种底图、图层控制、Marker聚合、信息窗和无Key降级预览；
- 地址定位、地图点击、边界绘制、节点编辑、撤销/重做和历史回放；
- Polygon、MultiPolygon、孔洞及WGS84/GCJ-02可追溯显示转换；
- 正式问题组合筛选、清单/地图双向联动、拖拽草稿、前后对比和失败恢复；
- 照片点、人工补绑、缩略图、治理修订和聚合；
- 参数化Circle、命中关系、距离线、历史运行回放和stale标识；
- POI分页检索；
- POI自动清洗和去重；
- POI逐条/批量确认及已排除POI图层；
- 原始POI、查询参数和清洗摘要保存；
- 原社区/街区分类规则；
- 住宅POI按真实项目边界二次裁剪；
- GPX/GeoJSON/CSV路线导入、清洗、异常断点MultiLineString、停留检测/确认和照片路线关联；
- 确定性地图快照、报告冻结引用、HTTP 202后台Runner、重启恢复、失败重试和stale传播；
- SQLite RTree视口范围查询、路线抽稀、聚合和六类容量测试；
- 可重复Playwright E2E与空/少量/密集/失败/卫星道路视觉基线；
- 独立图层生命周期对象和geometry、filters、view-model、layer-control、selection、snapshot-view前端模块；
- GIS RBAC、审计身份覆盖、生产部署及备份恢复配置；
- 距离/面积测量、批量点位确认、图层偏好与URL恢复；
- 路线起终点、异常采样点、边界外对象告警，以及路线/照片修订后的关联stale传播；
- 无配置、Provider失败和坐标系不匹配状态；
- 服务端Web服务Key不下发浏览器。

尚未完成的是必须在部署环境使用真实高德账号执行的在线验收，包括JS SDK加载、地址返回
质量、真实POI、配额和错误码。此项不以假Key或Mock结果冒充完成。政务权威GIS、法定测绘
精度认定和小区/楼栋/地块/道路的独立正式空间绑定属于本模块原有扩展目标，不属于把V9.1
地图能力落入Business的替代性遗留项。

## 23. 当前接口与依据

- `docs/api/business-bff-api.md`；
- `docs/api/workflow-api.md`；
- `docs/data-model/business-data-model.md`；
- `docs/original-smart-renew-reuse-audit.md`；
- `docs/reuse-first-ab-development-outline.md`。

## 24. 本次A/B开发结果

- 已抽取高德浏览器地图Controller和服务端Web服务Provider，Key全部改为运行配置；
- 已将地址解析和POI请求收敛到BFF，服务端Key不下发；
- 已抽取POI分类、允许、硬排除、去重、近邻合并和项目边界裁剪；
- 已保存原始POI、Provider、查询参数、拒绝原因和规则版本；
- 已将清洗结果写入`type: poi-search`的SpatialAnalysisRun；
- 继续复用Business后端边界、点在多边形内、revision和stale校验；
- 已增加地图缺配置、Provider契约、POI清洗、边界裁剪和坐标系不混用测试；
- 当前无法用真实高德账号做自动化在线回归，需在部署环境配置三项AMAP变量后完成账号级验收。
