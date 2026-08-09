# Main 功能对齐 NP-01—NP-03 开发交接

> 日期：2026-08-09
> 分支：`urban-health-business`
> 开发依据：`docs/main-parity-next-development-outline.md`
> 停工点：NP-03 完成；NP-04 尚未开始

## 1. 本轮完成范围

### NP-01 住宅小区识别与台账治理

- 新增 `ResidentialDiscoveryRun` 本地持久化仓储；
- 复用现有高德住宅 POI 查询、边界裁剪、过滤、去重和近邻合并；
- 检索只生成待确认候选，不直接写正式住宅台账；
- 确认接口包含 revision、操作人、边界过期和 `clientRequestId` 幂等校验；
- 通过 Provider ID、标准化 ID、名称和地址阻止重复小区；
- 新增服务端小区合并、拆分和显式恢复接口；
- 合并保留主小区 ID、成员快照、楼栋快照、分区和修订审计；
- 拆分恢复原始小区 ID；
- 当前引用策略为 `block-if-referenced`：发现照片、任务、问题、报告、资料或分析引用时返回 409，不静默破坏引用；
- Business 阶段01已提供识别、勾选确认、合并、拆分、停用和恢复入口。

### NP-02 外业任务闭环

- 继续以 smart-renew 外业任务为任务主体，Business 保存编排引用和审计覆盖层；
- 任务支持问题编码、指标引用、楼栋数、户数、位置、预计照片数、采集人和采集时间；
- 新增项目级问题类型读取、任务照片会话、完成和重试 BFF；
- 外业照片复用现有 `UploadSession` 和 `/api/uploads/{sessionId}` 内容上传接口；
- 上传会话保存 `fieldTaskId`，服务端校验项目、小区、楼栋和问题编码一致性；
- 列表动态计算 `pending-upload/uploading/partially-uploaded/completed/failed`；
- 完成前按已完成上传会话核对预计照片数，并调用 smart-renew 完成接口；
- 失败项保留原会话和尝试次数，重试时要求浏览器重新选择匹配文件，不创建第二条 Base64 写入路径；
- Business 阶段01已提供任务字段、照片进度、任务上传、完成和失败重试入口。

### NP-03 AI 配置与用户 Key

- 新增用户 AI 配置仓储；
- Key 使用 AES-256-GCM 加密，主密钥保存于 `.data/ai-configurations/.master-key`，文件模式为 0600；
- 文件名使用用户 ID 的 SHA-256，不把 Key 写入 JSON、响应、日志或浏览器 LocalStorage；
- API 只返回 `ready`、尾四位提示、偏好、revision 和时间；
- 支持模型、10000—300000ms 超时和 1—20 张单批图片设置；
- 健康检查区分未配置、无权限、配额、上游失败和超时；
- 生产认证模式使用网关注入的已验证用户身份；本地关闭认证时固定使用 `local-development-user`，不信任请求用户名；
- AI Job 保存 `requestedBy`，后台 Runner 按该身份解密对应 Key；
- 用户范围客户端直接调用 DashScope compatible-mode，不再让浏览器持有 Key；
- Business 阶段02已提供 Key、模型参数和健康检查界面。

## 2. 新增主要接口

```http
POST /api/projects/{projectId}/residential-discovery-runs
GET  /api/projects/{projectId}/residential-discovery-runs
POST /api/projects/{projectId}/residential-discovery-runs/{runId}/confirm
POST /api/projects/{projectId}/communities/merge
POST /api/projects/{projectId}/communities/{communityId}/split
POST /api/projects/{projectId}/communities/{communityId}/restore

GET  /api/projects/{projectId}/field/problem-types
POST /api/projects/{projectId}/field/tasks/{taskId}/uploads
POST /api/projects/{projectId}/field/tasks/{taskId}/complete
POST /api/projects/{projectId}/field/tasks/{taskId}/retry

GET   /api/ai/config/meta
PUT   /api/ai/config/key
PATCH /api/ai/config/preferences
POST  /api/ai/config/health-check
GET   /api/admin/ai/users
```

## 3. 验证证据

```text
npm run check              PASS
npm test                   PASS 204/204
npm run test:integration  PASS 1/1
npm run test:e2e          PASS 9/9
npm run verify:demo       PASS 42 files
npm run verify:boundary   PASS
git diff --check          PASS
```

AI 加密、身份隔离和用户范围模型调用使用 Mock Fetch 单元测试验证。由于本机未提供真实 DashScope Key，本轮没有执行真实计费模型请求。

## 4. 已知边界

- 小区合并/拆分当前只支持“存在引用即阻断”，尚未实现跨主数据源自动重定向；这是有意的安全边界；
- 外业失败照片在浏览器刷新后需要人工重新选择原文件，服务端会复用失败会话；
- AI 主密钥必须纳入 Business 数据备份和恢复；丢失主密钥后已保存用户 Key 无法解密；
- `URBAN_HEALTH_AUTH_MODE=required` 才提供正式多用户隔离；本地模式只有固定开发身份；
- 新增页面操作已通过现有 E2E 回归，但尚未增加住宅识别、外业上传和 AI 配置的专用浏览器 E2E；
- 当前工作树尚未提交或推送，`.DS_Store` 是既有未跟踪文件，不应加入提交。

## 5. 下一对话起点

从 NP-04 开始，不要重做 NP-01—NP-03：

1. 先读取本文件和 `docs/main-parity-next-development-outline.md`；
2. 审计 `standard-library-service.mjs`、`official-issue-repository.mjs`、人工复核页面和报告快照；
3. 实现可选 `problemCode`、派生 `indicatorCode`、`remediationSnapshot`、`bindingStatus` 和 `bindingAudit`；
4. 保持“未绑定问题合法”，禁止恢复旧版强制指标映射；
5. NP-04 完成并回归后，再进入 NP-05 CloudBase 和 NP-06 成果中心。
