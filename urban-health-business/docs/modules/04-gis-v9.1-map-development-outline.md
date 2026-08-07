# Business GIS 地图完整能力开发大纲

> 专项目标：在 Business 模式中使用真实项目、真实经纬度和真实业务记录，完整实现 V9.1 Demo 的地图视觉、图层、筛选、联动和空间操作能力。
> 适用模块：阶段01资料治理、阶段04 GIS落图与问题清单、阶段06报告地图快照。
> 当前状态：主体功能与本地生产基础已形成，专项总体验收尚未完成；详见完成条件证据矩阵。
> 编制日期：2026-07-30。
> 上位文档：`readme.md`、`docs/architecture/system-architecture.md`、`docs/modules/04-gis-and-issues.md`。
> 生产部署：`docs/deployment/gis-production-deployment.md`。
> 实施原则：本文所有工作包均属于同一个交付范围，不划分为演示版、首版或后续二期。

---

## 1. 开发目标

在现有高德地图、真实项目边界、正式问题点位、POI查询和空间分析能力之上，建设完整的 Business GIS 地图工作台：

```text
真实项目边界
+ 正式问题点位
+ 风险分级和问题标签
+ 现场照片点位
+ 踏勘路线和关键停留节点
+ POI与公共设施
+ 用户参数化分析范围
+ 距离连线和命中关系
+ 图层控制
+ 问题清单与地图双向联动
+ 点位拖拽和人工确认
+ 坐标转换与来源追溯
+ 报告地图快照
```

完成后，Business 地图在视觉和交互完整度上应达到或超过 V9.1 Demo，但任何业务结果必须来自真实接口和真实数据。

本专项不是把 Demo 的固定西安地图、百分比坐标和42个问题点复制进 Business，而是复用其视觉语言和操作方式，重新建立基于真实地理坐标的实现。

---

## 2. 不可变约束

### 2.1 禁止引入Demo固定业务数据

Business不得引用或生成：

- `xian-city-map.jpg`；
- Demo固定项目边界；
- 百分比相对坐标；
- 固定42个问题点；
- `MAP-*`、`DEF-*`等Demo编号；
- 固定500、800、1000米分析结果；
- 固定设施点、照片点、路线和停留节点；
- 固定风险数量或命中数量。

空数据必须显示真实空状态，服务不可用必须显示真实不可用状态。

### 2.2 地图不成为业务主数据源

- 正式写入必须通过BFF；
- 地图内存对象不得作为刷新后的正式状态；
- Marker、Polygon、Circle和Polyline必须由服务端记录重建；
- 前端不得生成正式问题编号、空间分析编号或边界版本号；
- 拖拽、绘制和点击只形成草稿，服务端校验成功后才显示为已保存。

### 2.3 坐标系不可静默混用

- 高德浏览器底图使用GCJ-02；
- WGS84数据不得未经转换直接叠加在高德底图；
- 每个空间对象必须记录原始坐标系；
- 坐标转换必须保存来源、方法、版本、时间和操作人员；
- 原始坐标不可被转换结果覆盖；
- 无法确认坐标系时阻止正式落图；
- 矢量降级预览可以显示同一坐标系内部的相对位置，但必须标明不是在线底图定位结果。

### 2.4 高德密钥边界

- `AMAP_JS_KEY`和预期用于JS SDK的安全配置可以按高德规范提供给浏览器；
- `AMAP_WEB_SERVICE_KEY`只允许由BFF使用；
- 服务端Key不得进入HTML、前端日志、接口错误详情或构建产物；
- 未配置地图服务时不得生成假底图、假POI或假地址解析结果。

---

## 3. 完成后的用户工作流

### 3.1 项目边界

```text
选择真实项目
→ 读取项目原始边界和坐标系
→ 必要时生成有追溯记录的GCJ-02显示几何
→ 高德地图回显边界
→ 用户绘制、编辑或导入边界草稿
→ 服务端进行几何和坐标系校验
→ 保存新边界版本
→ 相关空间分析和报告进入stale
```

### 3.2 正式问题落图

```text
读取正式问题清单
→ 按已定位、未定位、待确认分类
→ 点击问题定位地图
→ 点击地图或拖拽Marker形成坐标草稿
→ 校验点位位于项目边界内
→ 保存坐标系、来源和确认人员
→ 写入问题几何修订
→ 地图、统计、审计和空间分析状态同步更新
```

### 3.3 空间分析

```text
选择正式问题
→ 输入50—10000米真实分析半径
→ 地图显示Circle草稿
→ 运行半径分析或POI分析
→ 服务端保存参数和数据快照
→ 地图显示命中点、距离线和结果摘要
→ 切换历史运行时重建当时的分析图层
```

### 3.4 照片与路线

```text
读取具有真实坐标的现场照片
→ 区分EXIF、人工补绑和坐标转换来源
→ 读取踏勘路线及关键停留节点
→ 显示路线、节点和关联照片
→ 点击照片查看缩略图和证据关系
→ 对缺失定位照片执行人工补绑
→ 保存照片治理修订和路线关联
```

### 3.5 报告引用

```text
选择已冻结的报告版本
→ 按报告快照重建边界、问题、风险、POI和分析范围
→ 生成确定性的地图快照
→ 保存地图快照对象及内容哈希
→ 报告只引用该冻结快照
```

---

## 4. 完整功能范围

以下功能全部属于本专项交付范围。

### 4.1 在线底图

- 高德地图SDK按运行配置延迟加载；
- 支持浅色、深色、卫星加道路三种底图模式；
- 默认样式由项目或系统配置决定；
- 支持缩放、拖拽、比例尺、地图复位和自动适配项目范围；
- 支持切换地图样式但不改变业务数据；
- 保留地图服务商要求的版权和审图标识；
- SDK失败、网络失败、密钥缺失、配额错误分别显示明确状态；
- 在线地图不可用时保留真实坐标矢量预览。

### 4.2 项目边界图层

- 回显真实项目边界；
- 支持Polygon和MultiPolygon；
- 支持内环/孔洞；
- 支持边界标签、面积、坐标系和版本展示；
- 支持绘制、节点编辑、撤销、重做、清除草稿和取消编辑；
- 支持从GeoJSON资料选择图层后导入；
- 支持WGS84和GCJ-02原始数据；
- 支持生成有追溯记录的显示几何；
- 边界保存前执行点数、自相交、闭合、面积、范围和项目修订校验；
- 边界外问题点、照片点和POI提供可见告警；
- 历史边界版本只读回放。

### 4.3 正式问题图层

- 所有正式问题使用真实经纬度Marker；
- Marker按高、中、低风险显示不同颜色和图形；
- 显示问题短编号或序号；
- 支持正常、选中、悬停、待确认、过期和未保存状态；
- 支持按风险、类型、状态、空间绑定状态筛选；
- 支持Marker聚合和展开；
- 点击Marker打开信息窗；
- 信息窗显示标题、类型、风险、位置、来源、修订和证据摘要；
- 点击信息窗可定位到问题清单和编辑表单；
- 选择问题后地图自动定位并高亮；
- 未定位问题只出现在列表中，不生成假Marker；
- 停用问题默认不显示，可在治理模式查看；
- stale问题显示明确标识但不改变原坐标。

### 4.4 点位编辑和人工确认

- 点击地图回填选中问题坐标；
- Marker拖拽形成坐标草稿；
- 拖拽期间显示经纬度和距原位置的距离；
- 保存前显示前后坐标对比；
- 保存使用真实登录用户；
- 服务端校验坐标范围、项目边界、坐标系和问题修订；
- 使用乐观锁处理多人并发修改；
- 失败时Marker恢复服务端位置；
- 成功后写入几何修订历史；
- 支持取消草稿、恢复原位置和查看历史点位；
- 区分AI建议、照片建议、地址建议和人工点击来源；
- 支持逐条确认和有权限控制的批量确认。

### 4.5 分析范围和距离关系

- 用户输入50—10000米分析半径；
- 地图使用真实米制Circle显示范围；
- Circle中心随当前问题或用户选定中心更新；
- Circle显示半径标签和分析状态；
- 支持显示问题到命中对象的距离线；
- 距离线显示真实距离；
- 支持选择历史空间分析运行并重建当时的Circle和命中关系；
- 分析运行stale时保持历史图层可查看，但明确标记为过期；
- 不生成固定500、800、1000米结果；
- 地图显示只引用服务端保存的运行快照。

### 4.6 POI与公共设施图层

- 使用BFF高德POI查询结果；
- 支持社区服务、教育、医疗、养老、商业、交通、公共空间等类别；
- 支持原始POI、清洗后POI和人工确认POI三种状态；
- 按类别显示不同图标；
- 支持聚合、展开、隐藏和单项选择；
- 点击显示名称、地址、类别、距离、Provider、查询时间和确认状态；
- 显示允许、硬排除、重复合并和边界裁剪摘要；
- 支持POI逐条人工接受、排除和说明；
- 人工确认写入修订和审计；
- 只把清洗并确认后的POI作为正式业务输入；
- 不把高德POI汇总称为政务GIS正式成果；
- Provider失败时保留历史成功运行，不生成新结果。

### 4.7 现场照片图层

- 显示具有有效真实坐标的原始现场照片；
- 区分EXIF定位、人工补绑、批量导入和坐标转换来源；
- 点击点位显示缩略图、拍摄时间、小区、楼栋、坐标和治理状态；
- 支持从照片定位到关联问题；
- 支持从问题高亮证据照片；
- 支持未定位照片清单；
- 支持点击地图补绑单张照片；
- 支持批量补绑结果查看；
- 停用照片不进入默认图层；
- 标注派生照片不作为新的现场位置点；
- 照片治理修订后更新依赖任务的stale状态。

### 4.8 踏勘路线和关键停留节点

- 新增正式踏勘路线实体；
- 支持导入或保存带时间序列的路线坐标；
- 显示路线Polyline、起点、终点和方向；
- 根据时间和距离规则生成候选停留节点；
- 候选停留节点必须人工确认后成为正式节点；
- 支持路线点清洗、异常跳点标记和断点显示；
- 支持照片与最近路线位置及时间窗口关联；
- 支持人工修正照片—路线关联；
- 支持查看路线关联照片数量和未关联照片；
- 保存清洗规则版本、原始路线哈希和确认人员；
- 路线更新后传播相关绑定、分析和报告stale状态。

### 4.9 图层控制

图层面板至少包括：

```text
底图
  - 浅色
  - 深色
  - 卫星 + 道路

项目
  - 项目边界
  - 边界标签
  - 历史边界对比

问题
  - 正式问题
  - 风险分级
  - 问题编号
  - 待确认点位

证据
  - 现场照片
  - 人工补绑照片
  - 踏勘路线
  - 关键停留节点

分析
  - 当前分析范围
  - 距离连线
  - POI设施
  - 被排除POI
```

控制要求：

- 图层开关只改变显示；
- 图层状态保存在当前用户的页面偏好中；
- 图层开关不得写入正式业务记录；
- 折叠、展开和复位行为与V9.1视觉语言一致；
- 不可用图层显示原因，不能伪装为空；
- 图层数据量过大时显示聚合或加载范围提示；
- 当前地图可见对象数量实时显示。

### 4.10 问题清单与地图双向联动

- 问题搜索支持编号、标题、类型、小区、楼栋和证据编号；
- 风险、类型、定位状态和stale状态可以组合筛选；
- 列表筛选立即同步地图可见Marker；
- 点击列表项定位并高亮Marker；
- 点击Marker滚动并选中列表项；
- 列表与地图共用同一选择状态；
- 当前选择切换时更新信息窗、Circle、分析历史和编辑表单；
- 地图聚合展开后保持当前筛选；
- URL保存项目、问题、分析运行和图层选择，支持刷新恢复；
- 刷新页面后从服务端重建状态，不依赖旧地图对象。

### 4.11 地图工具

- 放大、缩小、地图复位；
- 自动适配项目、全部问题、照片或路线范围；
- 底图切换和全屏查看；
- 坐标拾取；
- 距离和面积测量；
- 边界绘制与编辑；
- 点位拖拽；
- 地图快照；
- 图层开关；
- 清除临时测量覆盖物。

测量结果默认是临时交互数据；只有用户明确提交且接口有对应正式实体时才持久化。

### 4.12 报告地图快照

- 根据报告冻结快照生成确定性地图画面；
- 快照包含边界、问题风险、分析范围、必要POI和图例；
- 不直接截取用户当前任意地图状态作为正式报告输入；
- 保存快照配置、对象ID、修订、坐标系、地图样式、生成时间和内容哈希；
- 报告版本引用不可变地图快照；
- 新业务数据不得修改历史报告地图；
- 在线底图授权不允许服务端截图时，提供符合授权要求的替代渲染方案；
- 地图服务不可用时明确缺图原因，不使用Demo图片兜底。

---

## 5. 数据模型

### 5.1 空间几何通用结构

```json
{
  "geometry": {
    "type": "Point|LineString|Polygon|MultiPolygon",
    "coordinates": []
  },
  "crs": "WGS84|GCJ02",
  "source": "exif|manual|import|provider|converted|analysis",
  "sourceId": "string|null",
  "sourceRevision": 1,
  "coordinateTransform": {
    "applied": false,
    "from": null,
    "to": null,
    "method": null,
    "version": null,
    "transformedAt": null
  }
}
```

不得只保存转换后的高德显示坐标。

### 5.2 问题空间绑定扩展

```json
{
  "geometry": {
    "type": "Point",
    "coordinates": [108.95, 34.27]
  },
  "geometryCrs": "GCJ02",
  "displayGeometry": null,
  "bindingSource": "manual-drag",
  "bindingStatus": "confirmed",
  "confirmedBy": "user-id",
  "confirmedAt": "ISO-8601",
  "geometryRevision": 3,
  "previousGeometry": {
    "type": "Point",
    "coordinates": [108.949, 34.269]
  }
}
```

### 5.3 踏勘路线 `FieldSurveyRoute`

```json
{
  "id": "ROUTE-*",
  "projectId": "string",
  "name": "string",
  "status": "draft|confirmed|inactive",
  "geometry": {
    "type": "LineString",
    "coordinates": []
  },
  "crs": "WGS84|GCJ02",
  "samples": [
    {
      "coordinates": [0, 0],
      "capturedAt": "ISO-8601",
      "accuracyMeters": null
    }
  ],
  "source": {
    "kind": "gpx|geojson|csv|mobile-collection|manual",
    "assetId": null,
    "contentHash": null
  },
  "cleaning": {
    "ruleVersion": "string",
    "removedPointCount": 0,
    "breakCount": 0
  },
  "routeRevision": 1,
  "createdBy": "user-id",
  "createdAt": "ISO-8601"
}
```

### 5.4 停留节点 `FieldSurveyStop`

```json
{
  "id": "STOP-*",
  "projectId": "string",
  "routeId": "string",
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  },
  "crs": "WGS84|GCJ02",
  "arrivedAt": "ISO-8601",
  "departedAt": "ISO-8601",
  "durationSeconds": 0,
  "status": "candidate|confirmed|rejected|stale",
  "routeRevision": 1,
  "staleReasons": [],
  "confirmedBy": null,
  "revision": 1
}
```

### 5.5 照片路线关联 `PhotoRouteBinding`

```json
{
  "id": "PRB-*",
  "projectId": "string",
  "photoId": "string",
  "routeId": "string",
  "stopId": null,
  "routeSampleIndex": null,
  "distanceMeters": null,
  "timeDifferenceSeconds": null,
  "source": "automatic|manual",
  "status": "suggested|confirmed|rejected|stale",
  "routeRevision": 1,
  "photoMetadataRevision": 1,
  "staleReasons": [],
  "revision": 1,
  "confirmedBy": null
}
```

### 5.6 POI人工确认扩展

```json
{
  "providerId": "string",
  "normalizedId": "string",
  "geometry": {
    "type": "Point",
    "coordinates": [0, 0]
  },
  "crs": "GCJ02",
  "cleaningStatus": "accepted|excluded|merged|outside-boundary",
  "reviewStatus": "pending|confirmed|excluded",
  "reviewNote": "",
  "reviewedBy": null,
  "reviewedAt": null,
  "revision": 1
}
```

### 5.7 地图快照 `MapSnapshot`

```json
{
  "id": "MAPSNAP-*",
  "projectId": "string",
  "reportId": "string|null",
  "purpose": "report|export|audit",
  "mapStyle": "light|dark|satellite-road",
  "viewport": {
    "center": [0, 0],
    "zoom": 15,
    "bounds": []
  },
  "layers": {},
  "sourceRevisions": {},
  "objectKey": "string|null",
  "contentHash": "string|null",
  "status": "queued|generated|failed",
  "generatedAt": null
}
```

---

## 6. BFF接口

接口沿用当前 `/api` 语义和统一响应结构。

### 6.1 地图配置

```text
GET /api/gis/config
```

扩展返回SDK、底图样式、POI Provider、坐标转换、路线、地图快照能力及各自不可用原因。

### 6.2 项目地图聚合读模型

```text
GET /api/projects/:projectId/map-view
```

返回：

- 项目边界及显示几何；
- 正式问题摘要和点位；
- 照片点位摘要；
- 路线和停留节点摘要；
- 最新或指定空间分析摘要；
- 图层数量和截断信息；
- 坐标系兼容状态；
- 各数据源修订。

支持风险、类型、绑定状态、分析运行、视口、缩放和limit查询。大数据量必须使用视口范围查询，不允许无界返回所有照片和POI。

### 6.3 坐标转换

```text
POST /api/gis/coordinate-transforms
```

输入原始Geometry、原始CRS、目标CRS、来源对象和操作人员；输出原始Geometry、转换后Geometry、方法、版本、误差说明和转换记录ID。

### 6.4 问题点位

```text
PATCH /api/issues/:issueId/geometry
GET   /api/issues/:issueId/geometry-revisions
POST  /api/projects/:projectId/issues/geometry-batch-confirm
```

写入必须包含 `expectedGeometryRevision`、原始坐标或转换记录、绑定来源、登录用户和幂等键。

### 6.5 照片点位

```text
GET   /api/projects/:projectId/photos/map-points
PATCH /api/projects/:projectId/photos/:photoId/geometry
POST  /api/projects/:projectId/photos/geometry-batch
```

只更新治理覆盖层和修订，不修改照片二进制。

### 6.6 踏勘路线

```text
GET   /api/projects/:projectId/survey-routes
POST  /api/projects/:projectId/survey-routes
GET   /api/survey-routes/:routeId
PATCH /api/survey-routes/:routeId
POST  /api/survey-routes/:routeId/clean
POST  /api/survey-routes/:routeId/stops/detect
POST  /api/survey-routes/:routeId/photo-bindings/suggest
PATCH /api/photo-route-bindings/:bindingId
```

路线导入复用SourceAsset，不在JSON接口中长期保存大型原始文件。

### 6.7 POI确认

```text
GET   /api/spatial-analyses/:runId/pois
PATCH /api/spatial-analyses/:runId/pois/:normalizedId
POST  /api/spatial-analyses/:runId/pois/batch-review
```

必须保留原始Provider记录，不因人工确认覆盖原始返回。

### 6.8 地图快照

```text
POST /api/projects/:projectId/map-snapshots
GET  /api/map-snapshots/:snapshotId
GET  /api/map-snapshots/:snapshotId/content
```

地图快照生成使用持久化任务，支持失败状态和重试。

---

## 7. 服务端开发

### 7.1 新增Repository

```text
server/repositories/coordinate-transform-repository.mjs
server/repositories/survey-route-repository.mjs
server/repositories/survey-stop-repository.mjs
server/repositories/photo-route-binding-repository.mjs
server/repositories/map-snapshot-repository.mjs
```

要求：

- 当前本地实现使用原子临时文件替换；
- ID进行文件名安全校验；
- 正式数据库Provider实现同一契约；
- 列表支持项目过滤、状态过滤和有界分页；
- 正式编辑支持revision冲突；
- 迁移和审计信息不得丢失。

### 7.2 新增Service

```text
server/services/map-view-service.mjs
server/services/coordinate-transform-service.mjs
server/services/survey-route-service.mjs
server/services/survey-stop-service.mjs
server/services/photo-route-binding-service.mjs
server/services/poi-review-service.mjs
server/services/map-snapshot-service.mjs
```

职责：

- Controller不计算正式空间结果；
- `map-view-service`只聚合有界读模型；
- 坐标转换集中在单一服务；
- 路线清洗和停留检测保存规则版本；
- POI人工确认不修改Provider原始快照；
- 地图快照由冻结输入生成；
- 输入变化统一调用stale传播。

### 7.3 AMap Provider

扩展现有Provider：

- 保持服务端Key不下发；
- 增加错误码、配额和超时归一化；
- POI详情请求设置并发上限；
- 保存Provider请求参数摘要；
- 日志不得记录完整密钥；
- 区分可重试和不可重试错误；
- 真实在线验收记录环境和时间，但不保存凭据。

### 7.4 空间校验

服务端必须实现：

- Point位于Polygon/MultiPolygon；
- 边界自相交和孔洞合法性；
- 经纬度范围和Geometry类型白名单；
- 单次点数和负载大小限制；
- LineString异常速度或跳点；
- 真实米制距离；
- 视口查询边界；
- 同一分析中坐标系一致性；
- 原始几何与显示几何的来源关系。

正式数据库优先使用PostGIS，Node实现保留为本地Provider和契约基线。

### 7.5 路由拆分

新增：

```text
server/routes/gis-routes.mjs
server/routes/map-view-routes.mjs
server/routes/survey-route-routes.mjs
server/routes/map-snapshot-routes.mjs
```

不得继续把全部新增路由直接堆入 `server/index.mjs`。

---

## 8. 前端开发

### 8.1 GIS模块目录

```text
apps/business/src/modules/gis/
├─ gis-workspace.js
├─ gis-state.js
├─ gis-filters.js
├─ gis-selection.js
├─ gis-layer-control.js
├─ gis-issue-list.js
├─ gis-info-window.js
├─ gis-geometry-editor.js
├─ gis-spatial-analysis.js
├─ gis-poi-review.js
├─ gis-photo-layer.js
├─ gis-survey-route.js
├─ gis-map-snapshot.js
└─ gis-view-model.js
```

现有 `app.js` 只保留页面级装配，不继续承载GIS全部渲染和事件。

### 8.2 地图控制器图层化

```text
AmapMapController
├─ BaseMapLayer
├─ ProjectBoundaryLayer
├─ IssueMarkerLayer
├─ PhotoMarkerLayer
├─ SurveyRouteLayer
├─ SurveyStopLayer
├─ PoiLayer
├─ AnalysisCircleLayer
├─ DistanceLineLayer
├─ DrawingController
├─ GeometryEditController
├─ MeasureController
└─ MapSnapshotController
```

每个图层支持 `setData()`、`setVisible()`、`setSelected()`、`clear()`和`destroy()`；项目切换时释放覆盖物和事件。

### 8.3 自定义Marker

- 问题使用风险颜色、编号、待确认和stale状态；
- 支持选中、悬停和键盘焦点；
- 聚合点显示数量；
- 颜色之外同时使用形状、图标或文字；
- 标题和属性值必须转义；
- 照片、POI和停留节点使用不同视觉语言。

### 8.4 GIS状态

```text
mapReady
mapStyle
visibleLayers
filters
selectedIssueId
selectedPhotoId
selectedPoiId
selectedRouteId
selectedSpatialRunId
geometryDraft
circleDraft
viewport
loadingByLayer
errorByLayer
truncatedByLayer
```

正式数据仍由主Store持有，GIS状态只保存交互和显示选择。

### 8.5 URL和刷新恢复

支持：

```text
/business/?project=:projectId&stage=gis&issue=:issueId&run=:runId
```

URL中的对象ID仍必须经过服务端权限检查。

### 8.6 降级矢量预览

SVG预览覆盖边界、风险问题、选中问题、分析范围、照片、路线、POI和图例，并明确标记“矢量相对预览，不代表在线底图定位”。

---

## 9. 视觉规范

- 复用V9.1深色工作台、图层面板、光晕边界和地图工具视觉；
- 装饰层必须 `pointer-events: none`；
- 高、中、低风险分别使用红、橙、蓝绿色；
- 待确认使用黄色，stale使用灰紫色；
- 选中对象使用白色外圈或高亮光晕；
- 图例随可见图层变化；
- 显示当前可见对象数量；
- 聚合点和单点使用不同图例；
- 失败、空、加载、截断和stale分别显示；
- 不使用“0项”掩盖接口失败；
- 不遮挡地图版权信息；
- 小屏幕下问题列表和地图可以切换显示。

---

## 10. 性能和容量

### 10.1 前端

- 只对显示几何做简化，不覆盖原始几何；
- 问题、照片和POI超过阈值时启用聚合；
- 按视口和缩放级别加载点位；
- 视口事件节流；
- 信息窗按需加载详情；
- 项目切换和页面退出销毁地图与事件；
- 聚合响应返回截断信息。

### 10.2 服务端

- 所有列表有上限；
- 空间查询建立正式索引；
- POI请求设置分页、超时、重试和配额保护；
- 坐标转换支持有界批量；
- 路线导入限制文件大小和采样点数量；
- 地图快照进入后台任务；
- 日志不输出完整Geometry、照片URL或密钥。

### 10.3 验收容量

单项目至少验证：

- 10,000个正式问题点；
- 50,000张照片元数据，其中10,000张具有坐标；
- 5,000个清洗后POI；
- 20条路线、每条50,000个原始采样点；
- 100个空间分析历史运行；
- 50个报告地图快照。

通过视口查询和聚合完成验收，不要求浏览器同时创建全部覆盖物。

---

## 11. 权限和审计

权限：

```text
gis.view
gis.boundary.edit
gis.issue.geometry.edit
gis.photo.geometry.edit
gis.route.manage
gis.poi.review
gis.analysis.run
gis.map_snapshot.create
gis.audit.view
```

审计覆盖边界编辑、问题点点击和拖拽、照片补绑、路线清洗、停留确认、照片路线关联、POI审核、坐标转换、空间分析和地图快照。

审计使用登录用户身份，不以自由文本操作人员字段作为唯一依据。

---

## 12. stale传播

### 12.1 边界变化

重新校验问题点、照片点和路线边界关系，并使POI裁剪、空间分析和未冻结报告地图快照进入stale。

### 12.2 问题几何变化

使依赖该问题的半径分析、距离关系、最新报告和未冻结地图快照进入stale；不影响与正式问题集合无关的纯项目POI搜索。

### 12.3 照片几何变化

使照片路线关联、照片位置建议和相关未冻结地图快照进入stale或待确认。

### 12.4 路线变化

使停留节点、照片路线关联、路线统计和相关未冻结地图快照进入stale。

历史冻结报告和历史分析运行不重写，只标记其与当前状态的差异。

---

## 13. 测试大纲

### 13.1 单元测试

- SDK缺配置、加载失败和重试；
- 项目切换释放地图和事件；
- 图层显隐、选择、聚合和销毁；
- Circle真实米制半径；
- 拖拽取消、失败恢复和revision冲突；
- WGS84/GCJ-02转换记录；
- Point、LineString、Polygon、MultiPolygon和孔洞；
- 跳点识别、停留候选和照片路线匹配；
- POI原始记录不可变及人工确认；
- 地图快照冻结输入和哈希；
- stale传播不改写历史对象。

### 13.2 接口测试

- 未登录401、无权限403、跨项目隔离；
- revision冲突409；
- 坐标系不匹配422；
- Provider未配置能力状态；
- 超限Geometry；
- 幂等键重复提交；
- 视口查询有界；
- 地图读模型不泄漏其他项目数据。

### 13.3 集成测试

```text
创建项目
→ 导入WGS84边界
→ 生成GCJ-02显示几何
→ 上传带EXIF照片
→ 创建无坐标正式问题
→ 点击地图绑定问题点
→ 拖拽修订点位
→ 运行真实半径分析
→ 查询、清洗并确认POI
→ 导入踏勘路线
→ 检测并确认停留节点
→ 建立照片路线关联
→ 切换图层和筛选
→ 生成报告地图快照
→ 修改边界并验证stale传播
```

### 13.4 浏览器E2E

- 地图加载和缺密钥状态；
- 三种底图切换；
- 问题列表与Marker双向选择；
- 风险和类型筛选；
- Marker聚合；
- 点击和拖拽保存点位；
- Circle和历史分析；
- POI审核；
- 照片缩略图；
- 路线和停留节点；
- 图层控制、复位和全屏；
- 页面刷新恢复；
- 键盘操作和小屏幕布局；
- 地图快照生成状态。

### 13.5 视觉回归

以V9.1为视觉参考，建立Business真实空数据、少量数据、密集数据、失败状态和卫星底图截图基线，不复制V9.1固定数据。

---

## 14. 开发工作包与顺序

所有工作包属于同一个开发计划，必须全部完成后才能将专项标记为完成。

### GIS-00 契约和基线

- 固化现有地图、POI和空间分析测试；
- 定义统一Geometry、CRS和地图聚合读模型；
- 建立能力声明、GIS路由和前端模块目录；
- 保持Demo完整性和原项目边界校验。

### GIS-01 坐标转换和复杂边界

- 坐标转换Provider和记录；
- 原始几何与显示几何；
- MultiPolygon和孔洞；
- 边界节点编辑、版本回放和服务端校验。

### GIS-02 地图控制器图层化

- 控制器拆分；
- 三种底图；
- 图层生命周期；
- 地图工具、图层控制和降级SVG预览。

### GIS-03 问题地图和清单双向联动

- 风险Marker、编号和状态；
- 聚合、搜索和组合筛选；
- 信息窗、双向选择和URL状态。

### GIS-04 点位编辑

- 点击拾取和Marker拖拽；
- 保存前后对比；
- revision冲突、几何历史、批量确认、RBAC和审计。

### GIS-05 分析范围和关系图层

- Circle、参数化半径、距离线和命中关系；
- 历史空间分析回放和stale状态。

### GIS-06 POI正式图层

- POI分类、聚合和详情；
- 清洗来源、逐条和批量审核；
- 被排除POI图层及Provider失败状态。

### GIS-07 照片空间图层

- 原始照片点、人工补绑点、缩略图和证据联动；
- 缺失定位治理、照片聚合和stale传播。

### GIS-08 踏勘路线和停留节点

- 路线模型、接口和SourceAsset导入；
- 路线清洗、Polyline、停留候选和确认；
- 照片路线建议、人工确认、统计和审计。

### GIS-09 地图快照

- 快照模型、冻结输入、生成任务和对象存储归档；
- 报告引用、失败重试和授权合规检查。

### GIS-10 性能、安全和完整回归

- 视口查询、聚合和大数据验收；
- 权限隔离和日志脱敏；
- 单元、接口、集成、E2E和视觉回归；
- 真实高德账号在线验收；
- 文档和部署配置更新。

---

## 15. 预计修改范围

### 15.1 现有文件

```text
apps/business/index.html
apps/business/src/app.js
apps/business/src/api/client.js
apps/business/src/gis/amap-map-controller.js
apps/business/src/store/app-store.js
apps/business/src/styles/app.css
server/index.mjs
server/services/amap-provider.mjs
server/services/spatial-analysis-service.mjs
server/services/spatial-binding-service.mjs
server/services/workflow-service.mjs
docs/api/business-bff-api.md
docs/data-model/business-data-model.md
docs/modules/04-gis-and-issues.md
docs/modules/06-report-generation.md
docs/development-status.md
```

### 15.2 新增文件

以前文Repository、Service、Route和前端GIS模块清单为准，并补充：

```text
tests/unit/*gis*.test.mjs
tests/unit/*route*.test.mjs
tests/unit/*coordinate*.test.mjs
tests/unit/*map-snapshot*.test.mjs
tests/integration/gis-business-flow.test.mjs
tests/e2e/gis-workspace.spec.mjs
```

不得重新把所有逻辑集中回 `app.js` 或 `server/index.mjs`。

---

## 16. 配置

```text
AMAP_JS_KEY
AMAP_JS_SECURITY_CODE
AMAP_WEB_SERVICE_KEY
GIS_DEFAULT_MAP_STYLE
GIS_COORDINATE_PROVIDER
GIS_MAX_VIEW_FEATURES
GIS_MAX_ROUTE_POINTS
GIS_MAP_SNAPSHOT_PROVIDER
GIS_MAP_SNAPSHOT_STORAGE_PREFIX
```

要求：

- 配置启动时校验；
- 能力状态由实际配置和健康检查生成；
- 前端只获取可公开配置；
- 测试环境使用Mock Provider；
- 预生产和生产完成真实在线验收；
- 不在代码中提供默认生产密钥。

---

## 17. 完成定义

只有同时满足以下条件，专项才能标记为完成：

1. Business不引用任何Demo固定地图资产或结果数据；
2. 真实边界、正式问题、照片、路线、停留节点、POI和分析范围均可落图；
3. 支持浅色、深色和卫星加道路底图；
4. 图层控制完整可用；
5. 问题列表与地图双向联动；
6. 风险、类型、定位状态和stale状态组合筛选有效；
7. 支持点击和拖拽修订问题点位；
8. 支持照片人工补绑；
9. 支持POI逐条人工确认；
10. 支持踏勘路线清洗、停留确认和照片关联；
11. 支持参数化Circle、距离线和历史分析回放；
12. WGS84与GCJ-02不静默混用，转换有完整追溯；
13. 地图快照可冻结并进入报告版本；
14. 高德不可用时显示真实降级状态；
15. 写入通过BFF并支持权限、审计、幂等或revision冲突；
16. 大数据量通过视口查询和聚合保持可用；
17. 单元、接口、集成、浏览器E2E和视觉回归全部通过；
18. 真实高德在线地图、地址、POI、配额和错误状态完成预生产验收；
19. Demo完整性校验通过；
20. 原smart-renew项目边界校验通过；
21. API、数据模型、阶段04、报告和开发状态文档同步更新；
22. 不存在以“后续版本”名义遗留的V9.1地图功能。

---

## 17.1 实施状态（2026-07-30）

| 工作包 | 状态 | 验证 |
|---|---|---|
| GIS-00 | 已完成 | 统一空间契约、读模型、能力声明、Demo/边界校验脚本 |
| GIS-01 | 已完成 | 转换审计、复杂边界、节点编辑、历史回放及几何单测 |
| GIS-02 | 已完成 | 分层控制器、三种底图、图层生命周期、降级SVG |
| GIS-03 | 已完成 | Marker、聚合、组合筛选、信息窗、双向选择、URL恢复 |
| GIS-04 | 已完成 | 点击/拖拽草稿、前后对比、撤销恢复、批量确认、RBAC和审计 |
| GIS-05 | 已完成 | 参数Circle、距离线、历史运行及stale回放 |
| GIS-06 | 已完成 | POI清洗来源、逐条/批量复核、排除图层及Provider错误 |
| GIS-07 | 已完成 | 照片点、缩略图、人工补绑、批量治理、聚合及stale传播 |
| GIS-08 | 已完成 | 路线导入/清洗、停留确认、照片关联、修订与审计 |
| GIS-09 | 已完成 | 持久化快照任务、冻结输入、报告引用、哈希、重试和stale |
| GIS-10 | 本地项已完成 | 容量、权限、安全头、SQLite事务、S3对象存储、备份、单元/集成/浏览器/响应式及部署文档 |

第17条本地验证、19—21条已完成。第18条“真实高德账号在线验收”必须在预生产环境提供
真实Key后执行，当前明确保留为外部发布门禁；未使用Mock或空配置冒充通过。原项目边界
脚本仅忽略仓库上层既有`.DS_Store`系统元数据，仍严格拦截Business目录外的源码或业务
数据变化；GIS实现没有修改原smart-renew业务源码。

---

## 18. 非目标

- 将高德POI冒充政务权威设施数据；
- 生成规划审批或行政执法结论；
- 恢复Demo固定综合得分和指标结果；
- 绕过阶段05指标引擎计算正式评分；
- 将Business变成依赖固定西安底图的离线Demo；
- 未经授权抓取或永久缓存第三方底图瓦片；
- 替代专业测绘成果的法定坐标精度认定。

---

## 19. 开发纪律

- 每完成一个工作包，先更新测试和对应模块文档，再进入下一工作包；
- 不修改V9.1 Demo快照；
- 不使用Demo数据作为开发方便性兜底；
- 不用前端显示成功掩盖服务端保存失败；
- 不在地图控制器中直接调用分散API；
- 不把大型Geometry、照片Base64或完整POI原始响应长期保存在全局Store；
- 不形成WGS84与GCJ-02双写且来源不明的空间主数据；
- 不形成原smart-renew与Business两个可写正式问题仓储；
- 不在未经真实在线验收时声明高德生产能力已完成；
- 所有新增能力必须进入 `/api/meta` 或 `/api/gis/config` 的真实能力声明。
