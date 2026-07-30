# 2026-07-31 GIS 开发日志与停工点

## 今日目标

完成最终计划第1步：按照GIS开发大纲的22项完成定义，建立当前实现与验证证据矩阵；完成
后停止继续开发，保存当前成果并上传GitHub。

## 今日完成

- 建立逐项完成证据矩阵：
  `docs/testing/gis-completion-evidence-matrix.md`；
- 对上一轮“本地全部完成”的结论重新做严格审计，明确区分已完成、部分完成和外部阻塞；
- 补齐审计过程中已开始的可见图层能力：
  - 历史边界对比图层；
  - 待确认问题独立图层；
  - 人工补绑照片独立图层；
  - 图层选择进入URL和浏览器显示偏好；
  - 动态地图图例和全图层对象计数；
  - 375px以下问题清单/地图切换；
  - SVG降级预览遵循图层显隐；
- 保持Demo隔离、真实空状态、CRS追溯和BFF写入边界不变。

## 本次停止点

代码停止在“完成证据审计并补齐已识别的直接可见图层缺口”之后。计划第2步“补齐缺失的
自动化E2E、视觉与接口验收证据”尚未开始，不应把当前提交描述为整个GIS专项最终完成。

提交前验证结果：

- `npm run check`通过；
- `npm test`通过，共181项；
- `npm run test:integration`通过，共1项，覆盖required RBAC与SQLite集成路径；
- `npm run verify:demo`通过，校验42个Demo文件；
- `npm run verify:boundary`通过；
- `git diff --check`在提交前执行。

## 下次开始点

下次从以下顺序开始：

1. 建立仓库内可重复运行的浏览器E2E，先覆盖无Key降级、图层显隐、URL刷新恢复和移动端
   清单/地图切换；
2. 建立真实空数据、少量数据、密集数据、失败状态和卫星模式视觉基线；
3. 增加100个空间分析运行和50个地图快照容量测试；
4. 将地图快照生成从请求内同步执行改为持久化后台Runner；
5. 为正式空间查询增加SQLite RTree或PostgreSQL/PostGIS Provider；
6. 继续拆分GIS前端模块和统一图层生命周期契约；
7. 在获得预生产高德凭据后执行真实在线发布验收。

## 已知外部门禁

- 真实高德在线验收需要在预生产环境配置：
  `AMAP_JS_KEY`、`AMAP_JS_SECURITY_CODE`、`AMAP_WEB_SERVICE_KEY`；
- 不在日志、提交或PR中保存任何真实Key；
- 当前GitHub CLI认证已失效，需要重新执行`gh auth login -h github.com`后才能创建或更新
  GitHub PR；本地Git提交可保留完整工作成果。

## 关联文档

- `docs/modules/04-gis-v9.1-map-development-outline.md`
- `docs/testing/gis-completion-evidence-matrix.md`
- `docs/deployment/gis-production-deployment.md`
- `docs/development-status.md`
