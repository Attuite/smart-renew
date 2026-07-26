# 00 项目与六阶段工作流模块开发大纲

> 上位文档：`../../readme.md`  
> 共同约束：系统架构、业务数据模型、API规范、工作流接口  
> 模块定位：Business模式入口、项目上下文和六阶段统一调度中心

## 1. 模块目标

建立真实业务模式的项目入口和六阶段总工作台，使用户能够：

- 查询、创建、编辑和切换真实项目；
- 绘制或导入真实项目边界；
- 查看项目数据完整度；
- 查看六阶段状态、进度、阻塞、过期和不可用能力；
- 从统一入口进入01—06工作台；
- 查看跨阶段证据追溯；
- 明确后端、数据库、对象存储、AI、GIS、指标和报告服务状态。

本模块不是静态总览页，而是所有业务模块共享的项目上下文和工作流入口。

## 2. 非目标

- 不实现具体照片治理逻辑；
- 不直接执行AI分析；
- 不直接保存人工复核结果；
- 不在前端计算GIS、指标或报告结果；
- 不用一个项目 `status` 替代六阶段状态；
- 不修改V9.1 Demo的项目列表和自动演示。

## 3. 用户角色

当前业务角色先按操作职责表达，不在本模块实现完整权限系统：

- 项目负责人：创建和维护项目；
- 数据整理人员：进入资料治理；
- AI分析人员：创建和查看分析任务；
- 复核人员：进入人工复核；
- GIS人员：进入空间工作台；
- 指标人员：查看指标准备和引擎状态；
- 报告人员：编辑和生成报告；
- 只读查看人员：查看全过程结果。

后续权限模块接入时，工作流 `actions` 根据角色返回可用操作。

## 4. 前置条件

- Business应用入口可加载；
- BFF `/api/meta` 可访问；
- 项目API可通过smart-renew适配层查询；
- 工作流接口契约已固定；
- 服务不可用时能够返回明确能力状态。

## 5. 完整用户流程

```text
进入Business模式
→ 检查服务能力
→ 加载项目列表
→ 创建项目或选择已有项目
→ 加载项目详情、汇总和工作流
→ 查看六阶段状态
→ 进入具体阶段
→ 阶段操作成功后刷新工作流
→ 返回项目总览查看更新结果
```

项目创建：

```text
填写基本信息
→ 绘制/导入边界
→ 后端创建项目
→ 返回项目ID和revision
→ 进入01资料治理
```

## 6. 页面与组件

### 6.1 Business入口

- Demo/Business模式标识；
- 当前环境；
- API连接状态；
- 后端能力摘要；
- 不得自动切换到Demo。

### 6.2 项目列表

- 搜索；
- 状态过滤；
- 城市/区域过滤；
- 分页；
- 最近更新时间；
- 六阶段完成概况；
- 创建项目；
- 空状态和加载失败。

### 6.3 项目创建/编辑

- 项目名称；
- 城市和行政区；
- 地址；
- 描述；
- 项目边界；
- 标准库版本；
- 表单校验；
- revision冲突提示。

### 6.4 项目总工作台

- 项目摘要；
- 六阶段导航；
- 数据完整度；
- 当前阶段；
- 阻塞和警告；
- 服务能力；
- 过期结果；
- 最近运行；
- 跨阶段证据链；
- 进入模块动作。

### 6.5 阶段说明抽屉

迁移V9.1的Header/Body/Footer结构，但内容来自模块定义和工作流接口：

- 阶段目标；
- 输入；
- 过程；
- 输出；
- 当前状态；
- 阻塞原因；
- 固定CTA。

## 7. 输入数据

- `/api/meta`；
- Project列表和详情；
- Project summary；
- WorkflowState；
- 当前用户的只读业务身份信息；
- 路由中的 `projectId`；
- 模块能力声明。

## 8. 输出数据

- 新建或更新的Project；
- 当前项目上下文；
- 当前模块路由；
- 项目边界；
- 用户选择的项目；
- 工作流刷新事件。

本模块不直接输出照片、问题、指标或报告实体。

## 9. 状态机

前端页面状态：

```text
booting
checking-capabilities
loading-projects
no-project
project-selected
loading-workflow
ready
partial-service
failed
```

业务阶段状态统一使用：

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

## 10. 数据模型

直接使用：

- Project；
- WorkflowState；
- 通用Capability；
- ProjectSummary；
- BoundaryGeometry。

Project不得嵌入完整子对象列表。

项目边界使用GeoJSON：

```json
{
  "type": "Polygon",
  "coordinates": []
}
```

并明确记录坐标系。

## 11. 前端服务

```text
projectApi.list()
projectApi.get(projectId)
projectApi.create(payload)
projectApi.patch(projectId, revision, changes)
projectApi.getSummary(projectId)
workflowApi.get(projectId)
metaApi.get()
```

前端Store：

```text
environment
capabilities
projectListQuery
activeProject
projectSummary
workflow
route
uiPreferences
```

不得在Store中复制整个照片和问题数据库。

## 12. 后端服务

- 项目适配器；
- 项目汇总服务；
- 工作流聚合服务；
- 能力服务；
- 边界校验；
- revision兼容；
- 统一响应和错误。

## 13. 目标API

```http
GET    /api/meta
GET    /api/projects
POST   /api/projects
GET    /api/projects/{projectId}
PATCH  /api/projects/{projectId}
GET    /api/projects/{projectId}/summary
GET    /api/projects/{projectId}/workflow
```

列表支持：

```text
query
status
cityCode
limit
cursor
sort
```

## 14. 旧smart-renew复用

复用审计等级A/B：

- `/api/projects`；
- `/api/projects/{id}`；
- 项目边界和社区/楼栋数据；
- `field-collection-core`项目、小区和楼栋查询；
- `project-data-core`统一数据索引；
- JSON/SQLite项目数据交换；
- 高德地图项目边界绘制和范围内小区识别；
- CloudBase项目Collection实现。

适配要求：

- 数字ID转换为字符串；
- 旧整对象PUT包装为新版PATCH语义；
- revision、409冲突和软停用继续由Business提供；
- 项目汇总不使用分析候选作为正式问题数；
- 工作流继续由BFF聚合；
- ProjectData经适配层接入；
- 原地图代码改为Provider并移除硬编码Key；
- Project仍以上游smart-renew为主数据源。

详细范围见`docs/original-smart-renew-reuse-audit.md`和`docs/reuse-first-ab-development-outline.md`。

## 15. V9.1迁移内容

迁移：

- 城市项目总览视觉层次；
- 地图与项目卡片布局参考；
- 六阶段侧栏；
- 阶段说明抽屉；
- 阶段状态视觉；
- 顶部服务状态表达；
- 工作台切换动效。

不直接迁移V9.1全局状态对象和自动演示控制器。

## 16. 必须剥离的Demo内容

- 固定6个西安项目；
- 西安地图背景图；
- 固定项目P1—P6；
- 固定42问题、82.4分和3类报告摘要；
- 自动演示时间轴；
- 基于时间修改阶段完成状态；
- Demo调试对象。

## 17. 空、失败和恢复

| 场景 | 行为 |
|---|---|
| 无项目 | 显示创建项目入口 |
| API不可达 | 显示连接失败，不进入Demo |
| 部分服务不可用 | 项目仍可进入，相关阶段显示unavailable |
| 项目不存在 | 返回项目列表并提示 |
| revision冲突 | 重新加载项目，提示用户检查差异 |
| 工作流失败 | 保留项目详情，不伪造阶段状态 |
| 边界无效 | 阻止提交并定位到错误点 |

## 18. 跨模块依赖

本模块被01—06全部依赖。

本模块依赖：

- API规范；
- 工作流接口；
- Project和WorkflowState模型；
- smart-renew项目接口；
- 地图边界编辑能力。

## 19. 数据一致性与幂等

- 创建项目接受 `Idempotency-Key`；
- 项目更新使用 `If-Match`；
- 项目汇总以后端聚合为准；
- 阶段动作成功后重新查询workflow；
- 前端不直接将阶段标记为completed；
- 项目切换时清理上一个项目的模块缓存。

## 20. 测试

### 20.1 单元测试

- 项目表单校验；
- 边界校验；
- 工作流状态映射；
- capability映射；
- 项目切换清理。

### 20.2 契约测试

- `/api/meta`；
- 项目列表分页；
- 项目创建；
- PATCH与409；
- summary；
- workflow始终返回六阶段。

### 20.3 E2E

- 无项目创建第一个项目；
- 选择已有项目；
- 编辑项目产生revision；
- 服务部分不可用；
- 进入01—06各工作台；
- 项目切换不串数据。

## 21. 验收标准

1. Business模式能独立启动；
2. 项目来自真实后端；
3. 六阶段始终可见；
4. 状态来自workflow；
5. 模块不可用显示明确说明；
6. 固定V9.1项目和统计未进入Business；
7. 项目边界为真实GeoJSON；
8. 项目切换不串数据；
9. 原版smart-renew未修改；
10. Demo入口仍独立运行。

## 22. 当前缺失能力

以下内容已经完成，不再列为缺失：

- `/api/meta`；
- 后端workflow聚合；
- Business项目PATCH、revision和409冲突；
- 项目汇总统一口径；
- Business应用壳、API客户端、Store、项目列表和六阶段导航。

本次A/B复用接入项：

- 原高德地图项目边界编辑；
- 原ProjectData统一索引、搜索和JSON/SQLite数据交换；
- 原外业项目、小区和楼栋查询；
- CloudBase可选Project Repository。

C/D后续项：

- 跨服务事件驱动刷新和多实例缓存一致性；
- 用户、角色和项目权限。

## 23. 当前接口与依据

- `docs/api/business-bff-api.md`；
- `docs/api/workflow-api.md`；
- `docs/data-model/business-data-model.md`；
- `docs/original-smart-renew-reuse-audit.md`；
- `docs/reuse-first-ab-development-outline.md`。

## 24. 本次A/B开发任务

- 固定Project及相关对象主数据源；
- 接入ProjectData和外业查询适配；
- 抽取高德地图边界Provider；
- 建立CloudBase可选Repository契约；
- 增加适配器、地图和主数据源不双写测试。
