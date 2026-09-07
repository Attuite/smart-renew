# Business GIS 生产部署与验收

本文对应 `04-gis-v9.1-map-development-outline.md` 的生产配置和外部验收要求。

## 1. 部署边界

- Business BFF 只接受身份网关转发的流量。
- 身份网关必须删除外部请求自带的 `x-authenticated-*` 头，再注入已验证的用户、角色和项目范围。
- `AMAP_WEB_SERVICE_KEY` 只配置在 BFF 运行环境。
- `AMAP_JS_KEY` 与 `AMAP_JS_SECURITY_CODE` 仅作为高德浏览器 SDK 配置下发。
- 数据目录或正式 Provider 必须持久化；不得把容器可写层当作备份。

## 2. 身份头和角色

网关注入：

```text
x-authenticated-user: stable-user-id
x-authenticated-name: 用户显示名
x-authenticated-roles: gis-viewer,gis-editor
x-authenticated-projects: project-id-1,project-id-2
```

角色：

- `gis-viewer`：地图和项目空间数据只读；
- `gis-editor`：边界、问题点、照片点和空间分析；
- `gis-manager`：增加路线、POI审核、地图快照和审计；
- `admin`：全权限和全项目。

生产必须设置 `URBAN_HEALTH_AUTH_MODE=required`。缺少认证返回401，权限不足或跨项目访问返回403。

## 3. 容器启动

```bash
cp config/production.env.example config/production.env
# 填写真实环境值，尤其是上游地址、身份模式和高德凭据
docker compose -f compose.production.yaml up -d --build
```

应用只绑定宿主机 `127.0.0.1:4182`，由 TLS 反向代理对外提供服务。

## 4. 正式数据库、事务与对象存储

生产示例默认：

```text
URBAN_HEALTH_PROVIDER=sqlite
URBAN_HEALTH_SQLITE_PATH=/var/lib/urban-health/business-records.sqlite
GIS_MAP_SNAPSHOT_PROVIDER=s3
GIS_MAP_SNAPSHOT_CONCURRENCY=2
```

SQLite Provider保存Business正式问题及GIS新增的边界修订、空间分析、坐标转换、路线、停留、照片路线关联和
地图快照元数据，启用WAL、FULL同步、busy timeout、索引和`BEGIN IMMEDIATE`事务。
带几何的正式问题和GIS记录同步写入SQLite RTree，视口范围查询先经过RTree再回表读取payload；
已有数据库首次启动会在事务内自动重建`spatial_rtree_v1`。它适合
单实例或受控主备部署；多实例主动写入必须替换为环境实现的PostgreSQL/PostGIS Provider，
不得把共享文件系统上的SQLite误当成多主数据库。

已有JSON GIS记录切换前先在停写窗口迁移到新数据库：

```bash
npm run migrate:gis-sqlite -- \
  /var/lib/urban-health \
  /var/lib/urban-health/business-records.sqlite
```

迁移在单一事务内执行，可重复运行；同ID同内容跳过，同ID不同内容立即回滚并报告冲突。
确认迁移数量和备份后再切换`URBAN_HEALTH_PROVIDER`。

地图快照内容可写入私有S3兼容Bucket。需配置`S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、
`S3_ACCESS_KEY_ID`和`S3_SECRET_ACCESS_KEY`；BFF使用SigV4签名，浏览器只通过鉴权内容接口
读取，密钥不进入URL或响应。照片和SourceAsset仍由smart-renew及其存储策略负责，不因地图
快照切换到S3而静默迁移。

地图快照POST请求仅冻结生成输入并返回HTTP 202与`queued`记录，后台Runner按
`GIS_MAP_SNAPSHOT_CONCURRENCY`（默认2，范围1—8）生成内容。服务重启时会恢复`queued`任务，
并将中断的`running`任务重新入队；前端通过GET轮询至`generated`或`failed`。

## 5. 数据与备份

本地 Provider 的持久化目录为 `/var/lib/urban-health`，写入使用临时文件原子替换。生产备份至少包含：

- Business 数据卷；
- smart-renew 上游数据库和照片文件；
- 正式对象存储中的地图快照；
- 身份网关、Provider 和高德运行配置的密钥引用，不备份明文密钥到仓库。

建议每日增量、每周全量，并按季度执行恢复演练。恢复验收应抽查项目边界版本、问题几何审计、路线采样、POI审核、地图快照哈希和报告引用。

应用提供一致性备份和校验命令：

```bash
URBAN_HEALTH_DATA_DIR=/var/lib/urban-health \
URBAN_HEALTH_SQLITE_PATH=/var/lib/urban-health/business-records.sqlite \
npm run backup:production -- /srv/backups/urban-health

npm run verify:backup -- /srv/backups/urban-health/urban-health-YYYY-MM-DDTHH-MM-SSZ
```

备份脚本先执行SQLite `integrity_check`，再使用在线备份API生成一致副本和SHA-256清单。
filesystem对象一并复制；S3对象必须另外启用Bucket版本控制、跨区复制和保留策略。恢复属于
受控运维操作：停写、验证备份、替换数据卷、启动后核对哈希，不提供自动覆盖当前生产数据的
危险脚本。

## 6. 高德预生产验收

使用真实预生产账号执行：

1. 验证浅色、深色、卫星道路三种底图；
2. 导入 WGS84 边界并生成带审计的 GCJ-02 显示几何；
3. 验证浏览器 SDK 域名、安全密钥和 CSP；
4. 验证地址解析、POI检索、分页、超时、配额错误和不可重试凭据错误；
5. 确认浏览器网络、HTML、日志和错误响应中没有 `AMAP_WEB_SERVICE_KEY`；
6. 记录环境、时间、账号归属和结果，不记录密钥值。

未完成本节时，只能声明代码和 Mock/离线契约通过，不能声明真实高德生产能力已验收。

## 7. 发布门禁

```bash
npm run verify
```

另外必须完成：

- 身份网关401/403与项目隔离测试；
- 10,000问题、10,000定位照片、5,000 POI和50,000点路线容量测试；
- 备份恢复演练；
- 真实高德预生产验收；
- 地图版权和审图标识人工检查。
