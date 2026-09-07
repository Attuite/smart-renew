# GIS 完成条件证据矩阵

> 审计日期：2026-08-03（本地证据重验）
> 审计范围：`docs/modules/04-gis-v9.1-map-development-outline.md` 第17节22项完成定义，以及第7—13节实施和测试要求。
> 判定规则：只有实现、自动化测试和运行证据三者与要求范围相匹配时才判定完成；仅有代码、人工观察或间接测试时标记为“部分完成”。

## 1. 第17节完成定义

| # | 完成条件 | 当前证据 | 判定 |
|---|---|---|---|
| 1 | Business不引用Demo固定地图资产或结果 | `verify-demo-integrity.mjs`、Demo禁用数据单测、源码检索；Demo完整性42文件通过 | 完成 |
| 2 | 边界、问题、照片、路线、停留、POI和范围均可落图 | `map-view-service`、`AmapMapController`、SVG降级预览及对应单测；空数据不造假 | 完成 |
| 3 | 浅色、深色、卫星道路底图 | `MAP_STYLES`、卫星与RoadNet组合、控制器单测 | 完成 |
| 4 | 图层控制完整 | 边界、历史边界、正式/待确认问题、问题标签、原始/人工照片、路线、停留、POI、排除POI、分析范围和距离线均有独立开关；URL刷新E2E通过 | 完成 |
| 5 | 问题清单与地图双向联动 | 列表选择、Marker选择、地图定位、共享`selectedIssueId` | 完成 |
| 6 | 风险、类型、定位和stale组合筛选 | 前端组合过滤、服务端同条件过滤、单元测试 | 完成 |
| 7 | 点击和拖拽修订问题点位 | 草稿、前后对比、距离、取消恢复、边界校验、revision冲突和审计 | 完成 |
| 8 | 照片人工补绑 | 点击/拖拽草稿、单条和批量治理、独立人工照片图层；浏览器图层回归通过 | 完成 |
| 9 | POI逐条人工确认 | 逐条/批量确认、排除、说明、revision和审计测试 | 完成 |
| 10 | 路线清洗、停留确认和照片关联 | GPX/GeoJSON/CSV导入、清洗、异常断点MultiLineString、停留检测/复核、照片建议/复核、stale传播 | 完成 |
| 11 | 参数Circle、距离线和历史分析回放 | 服务端运行快照、Circle/半径标签、真实距离标签、历史运行选择和stale展示 | 完成 |
| 12 | CRS不静默混用并可追溯 | WGS84/GCJ-02转换记录、原始/显示几何分离、转换方法版本和人员审计 | 完成 |
| 13 | 地图快照冻结并进入报告版本 | 冻结报告输入、确定性SVG、哈希、对象存储、报告引用、异步Runner、并发限制和重启恢复测试 | 完成 |
| 14 | 高德不可用时真实降级 | 无Key能力状态、SVG真实矢量预览、浏览器无Key回归 | 完成 |
| 15 | 写入经BFF并支持权限、审计、幂等或revision | required RBAC集成流、项目隔离、认证身份覆盖、revision/幂等测试 | 完成 |
| 16 | 大数据通过视口和聚合可用 | 10,000问题、10,000定位照片、5,000 POI、20×50,000点路线、100空间运行和50地图快照容量测试；SQLite RTree查询计划验证 | 完成 |
| 17 | 单元、接口、集成、浏览器E2E和视觉回归全部通过 | 195项单元、1项required RBAC/SQLite集成、9项Playwright E2E；空/少量/密集/失败/卫星道路5类持久基线 | 完成（本地） |
| 18 | 真实高德地图、地址、POI、配额和错误完成预生产验收 | 部署清单与真实能力门禁已建立 | 外部阻塞：当前没有预生产Key与在线验收记录 |
| 19 | Demo完整性通过 | `npm run verify:demo`：42文件通过 | 完成 |
| 20 | 原smart-renew边界校验通过 | `npm run verify:boundary`通过；只忽略`.DS_Store`系统元数据 | 完成 |
| 21 | API、模型、阶段04、报告和状态文档同步 | API 202语义、Runner、RTree、MultiLineString、部署参数和证据文档已同步 | 完成 |
| 22 | 无“后续版本”遗留的V9.1地图功能 | 本地工程化缺口全部在本开发计划内收口，未拆分二期 | 完成（本地） |

## 2. 本地工程化缺口

| 优先级 | 缺口 | 当前状态 | 下次验收证据 |
|---|---|---|---|
| P0 | 可重复浏览器E2E | Playwright自动启动隔离双服务，覆盖无Key降级、筛选/图层/URL刷新、375px切换和接口失败 | 完成，`npm run test:e2e` |
| P0 | 视觉回归基线 | 空/少量/密集/失败/卫星道路五类PNG基线，差异像素比阈值1% | 完成 |
| P0 | 真实高德预生产验收 | 无真实凭据，不允许用Mock冒充 | 记录JS SDK、地址、POI、配额、错误码、环境和时间 |
| P1 | 地图快照后台任务 | 持久冻结输入、HTTP 202、独立Runner、前端轮询、失败终态、并发上限和重启恢复测试 | 完成 |
| P1 | 正式空间索引 | 正式问题和GIS记录与SQLite RTree原子同步，旧JSON数据可事务迁移，视口查询调用`listInBounds`，`EXPLAIN QUERY PLAN`确认虚拟表索引 | 完成 |
| P1 | 容量矩阵后两项 | 100空间运行可选回放，50快照内容与25+25分页测试 | 完成 |
| P2 | 前端GIS模块边界 | geometry、filters、view-model、layer-control、selection、snapshot-view、AMap控制器和Layer生命周期已分离，有独立测试 | 完成 |
| P2 | 图层统一生命周期对象 | `MapOverlayLayer` 统一`setData/setVisible/setSelected/clear/destroy`，覆盖幂等显隐、聚合替换和销毁 | 完成 |
| P2 | 路线断点分段 | 清洗生成LineString/MultiLineString显示几何，AMap、SVG降级和报告快照按段绘制 | 完成 |

## 3. 当前可作为完成证据的命令

```text
npm run check
npm test
npm run test:integration
npm run test:e2e
npm run verify:demo
npm run verify:boundary
npm run backup:production -- --help/按部署文档执行
npm run verify:backup -- <备份目录>
```

## 4. 审计结论

GIS大纲中可在本地完成的功能、生产基础和工程化验收项已全部收口。当前唯一未关闭门禁是
第18项“真实高德预生产验收”：需要环境提供受域名限制的JS Key、Security Code和服务端Web Service Key，
并由发布人员记录账号、配额、错误码和时间。在该外部记录归档前，可声明“本地代码与自动化验收完成”，
不声明“高德生产账号已验收”。

本次证据：195项单元测试、1项required RBAC/SQLite集成测试、9项Chromium E2E（含5类视觉基线）、
42文件Demo完整性和原项目边界校验全部通过。
