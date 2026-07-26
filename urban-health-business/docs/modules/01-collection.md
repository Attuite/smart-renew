# 01 资料上传与空间采集治理模块开发大纲

> 阶段ID：`collection`  
> 上游：项目与工作流  
> 下游：AI智能识别、GIS、指标、报告  
> 模块定位：真实项目数据和媒体资料的统一入口

## 1. 模块目标

将项目照片、无人机影像、外业记录、调查表、GIS文件、路线和历史资料真实上传、校验、治理并持久化，建立可供后续阶段引用的数据基础。

## 2. 非目标

- 不执行AI问题识别；
- 不生成正式问题；
- 不伪造EXIF或GPS；
- 不用固定照片数表示完整度；
- 不在浏览器长期保存正式文件；
- 不在当前模块计算指标或报告结论。

## 3. 用户角色

- 数据整理人员；
- 外业采集人员；
- 项目负责人；
- GIS资料整理人员；
- 只读审核人员。

## 4. 前置条件

- 已选择真实Project；
- 项目至少包含名称；
- 上传和存储能力状态可查询；
- 当前项目ID有效；
- 地图服务不可用时仍可上传无坐标资料，但必须标记位置状态。

## 5. 完整用户流程

```text
进入资料治理
→ 查看现有资料和完整度
→ 选择资料类型
→ 选择文件
→ 客户端预校验
→ 申请上传
→ 上传对象存储
→ 后端登记资产
→ 解析EXIF/结构
→ 识别重复和错误
→ 人工补充元数据/位置
→ 绑定小区、楼栋和路线
→ 运行治理校验
→ 完成阶段01
```

外业记录：

```text
外业数据导入/接收
→ 校验项目和空间层级
→ 绑定照片
→ 保存FieldRecord
→ 纳入资料完整度
```

## 6. 页面与组件

### 6.1 资料治理总览

- 总资料数；
- 分类统计；
- 上传中、失败、待治理、已完成；
- 照片位置状态；
- 完整度；
- 阻塞错误和警告。

### 6.2 上传工作区

- 拖放和文件选择；
- 文件类型识别；
- 上传队列；
- 进度；
- 暂停/重试/取消；
- 重复提示；
- 上传结果。

### 6.3 照片治理

- 缩略图列表；
- 原图预览；
- EXIF；
- 拍摄时间；
- 坐标；
- 小区、楼栋；
- 路线；
- 位置来源和精度；
- 批量操作。

### 6.4 空间采集治理

迁移V9.1空间采集布局，但使用真实地图：

- 项目边界；
- 踏勘路线；
- 照片点；
- 缺失位置；
- 人工补点；
- 路线节点；
- 图层控制；
- 真实数量。

### 6.5 其他资料

- 调查表；
- GIS文件；
- 无人机影像；
- 文档；
- 历史压缩包；
- 校验结果。

## 7. 输入数据

- Project；
- SourceAsset；
- Photo；
- FieldRecord；
- 空间层级台账；
- 项目边界；
- 上传能力；
- 对象存储能力；
- 地图能力。

## 8. 输出数据

- 已登记SourceAsset；
- 已登记Photo；
- FieldRecord；
- 照片位置；
- 路线和空间绑定；
- 治理校验结果；
- collection summary；
- 可供AI引用的photoIds；
- 输入数据快照。

## 9. 状态机

资产状态：

```text
selected
validating
uploading
uploaded
processing
needs_review
completed
failed
canceled
archived
```

照片位置状态：

```text
unlocated
exif_located
auto_located
pending_confirmation
manually_located
bound
rejected
```

阶段状态遵循workflow，不直接使用V9.1七种Demo动画状态作为正式状态。

## 10. 数据模型

使用：

- SourceAsset；
- Photo；
- FieldRecord；
- UploadSession；
- SurveyRoute；
- CollectionValidationRun；
- EvidenceRef。

需要在本模块细化：

```text
UploadSession
UploadPart
SurveyRoute
RoutePoint
CollectionValidationRun
CollectionSnapshot
```

## 11. 前端服务

```text
assetApi.list(projectId, query)
uploadApi.createSession(fileMeta)
uploadApi.upload(session, file)
uploadApi.complete(uploadId)
photoApi.list(projectId, query)
photoApi.patch(photoId, revision, changes)
fieldApi.list(projectId)
collectionApi.validate(projectId)
collectionApi.getSummary(projectId)
```

前端只保留文件上传过程对象，不保留正式Base64副本。

## 12. 后端服务

- 上传凭证；
- 对象存储登记；
- 文件哈希去重；
- EXIF解析；
- 资料结构校验；
- 图片派生缩略图；
- GIS文件解析；
- 路线保存；
- 位置转换；
- collection summary；
- 工作流刷新。

## 13. 目标API

```http
GET  /api/projects/{projectId}/assets
POST /api/projects/{projectId}/assets
PATCH /api/projects/{projectId}/assets/{assetId}
PUT  /api/assets/{assetId}/content
GET  /api/assets/{assetId}/content
POST /api/projects/{projectId}/boundary/import
POST /api/uploads/presign
POST /api/uploads/{uploadId}/complete
GET  /api/uploads/{uploadId}
GET  /api/photos?projectId={projectId}
GET  /api/photos/{photoId}
PATCH /api/projects/{projectId}/photos/{photoId}
GET  /api/field-records?projectId={projectId}
GET  /api/projects/{projectId}/collection/validation
POST /api/projects/{projectId}/collection/validate
GET  /api/projects/{projectId}/collection/validation-runs
GET  /api/projects/{projectId}/collection/summary
```

## 14. 旧smart-renew复用

复用审计等级A/B：

- `photo-storage-core`照片MIME、路径和归属校验；
- `/api/photos/upload`；
- 照片列表和读取；
- CloudBase对象存储上传、下载和临时URL；
- `field-collection-core`外业任务和幂等ID；
- 项目、小区和楼栋数据；
- `project-data-core`；
- JSON和SQLite导入、导出及引用重建；
- 高德地图项目边界绘制和范围内小区识别；
- `legacy-migration-core`。

适配限制：

- 当前Base64上传仅作为过渡；
- CloudBase Provider不等于对象存储直传；
- SourceAsset保存原始文件、哈希和来源，ProjectData转换器保存结构化记录；
- Business照片治理覆盖层继续负责revision、软停用和元数据来源；
- Business现有上传会话、WebP支持、哈希、幂等和归属校验是保留基线，只与原核心对照并收敛调用路径；
- 移动外业前端、路线模型和复杂资料解析不属于A/B复用范围；
- 原项目内嵌数据通过显式Legacy迁移转换，禁止静默迁移。

详细范围见`docs/original-smart-renew-reuse-audit.md`和`docs/reuse-first-ab-development-outline.md`。

## 15. V9.1迁移内容

迁移：

- 资料治理工作台布局；
- 上传进度视觉；
- 分类统计；
- 空间采集二级页；
- 地图与左右侧栏布局；
- 图层控制；
- 照片/路线详情；
- 完整度表达。

交互必须改为真实接口驱动。

## 16. 必须剥离的Demo内容

- “模拟上传”按钮逻辑；
- `requestAnimationFrame`伪上传；
- 固定186张照片；
- 固定12张无人机影像；
- 固定3份调查表；
- 固定8类GIS图层统计；
- 固定174/186定位；
- 固定12个候选补点；
- 固定路线和8个节点；
- 固定百分比坐标；
- 自动演示的14—18秒事件。

## 17. 空、失败和恢复

| 场景 | 行为 |
|---|---|
| 无资料 | 显示真实空状态和上传入口 |
| 存储不可用 | 禁止正式上传，显示能力原因 |
| 单文件失败 | 保留队列其他文件，可重试 |
| 重复文件 | 显示已有资产，允许跳过或登记引用 |
| EXIF缺失 | 标记unlocated，不生成假坐标 |
| 地图不可用 | 允许资料入库，位置治理显示unavailable |
| GIS文件错误 | 保存失败记录和校验信息 |
| 页面刷新 | 从uploadId和后端恢复状态 |

## 18. 跨模块依赖

下游：

- 02通过photoIds创建分析；
- 04读取项目边界和照片位置；
- 05读取FieldRecord和项目指标输入；
- 06读取资料统计和来源。

上游变化导致：

- 新照片使相关AI和报告可能stale；
- 项目边界变化使GIS、指标和报告可能stale；
- 外业数据变化使指标和报告可能stale。

## 19. 数据一致性与幂等

- 上传完成使用uploadId幂等；
- 同一hash重复完成不重复创建文件；
- Photo更新使用revision；
- 坐标调整保留前后值；
- 删除资产前检查下游引用；
- collection summary由后端聚合；
- 正式资产以后端列表为准。

## 20. 测试

### 20.1 单元测试

- 文件类型和大小；
- hash；
- EXIF映射；
- 坐标状态；
- 完整度规则；
- 队列恢复。

当前Business实现已覆盖上传会话持久化、原始二进制上传、哈希记录、失败重试、照片归属/时间/坐标/备注修订、软停用/恢复和乐观修订冲突。照片治理采用Business覆盖层，不改写原smart-renew照片二进制。

通用SourceAsset已经支持PDF、JSON/GeoJSON、CSV、TXT、XLSX、DOCX和ZIP的元数据登记、本地二进制持久化、SHA-256、幂等创建、下载、修订冲突及软停用/恢复。单一无孔洞GeoJSON Polygon可以导入为项目真实边界，且边界版本保留来源资产ID和内容哈希；不会在多面资料中自动选择。

### 20.2 契约测试

- 上传凭证；
- 上传完成幂等；
- 照片分页；
- Photo PATCH与409；
- collection validation；
- storage unavailable。

### 20.3 E2E

- 上传真实照片；
- 上传混合资料；
- 部分失败重试；
- 无EXIF照片补点；
- 刷新恢复；
- 完成后02可创建任务；
- Business中不出现V9.1固定数量。

## 21. 验收标准

1. 真文件可持久化；
2. 刷新后可查询；
3. 上传失败可恢复；
4. Photo具有真实storageRef；
5. EXIF缺失不生成假位置；
6. 真实边界和路线可保存；
7. summary来自真实数据；
8. 02能引用photoIds；
9. Demo资料未进入业务数据库；
10. 工作流正确更新。

## 22. 当前缺失能力

本次A/B复用接入项：

- CloudBase对象存储Provider；
- JSON和SQLite结构化资料导入导出；
- SourceAsset到ProjectData的来源追溯；
- 外业任务查询、创建和读取；
- 现有WebP原文件上传与Provider契约一致性验证；
- 现有照片归属校验与原核心的行为对照及单一调用路径收敛；
- 原高德地图边界绘制和范围内小区识别；
- Legacy照片和嵌入数据迁移。

C/D后续项：

- 对象存储直传、分片和字节级断点续传；
- DOCX、XLSX、ZIP和无人机资料深度解析；
- GeoJSON多面、孔洞、坐标转换和图层选择；
- 踏勘路线正式模型；
- 项目类型差异化完整度规则模板；
- 移动外业采集界面；
- WebP EXIF、时区校正和批量归属历史；
- 跨项目重复资料治理。

## 23. 当前接口与依据

- `docs/api/business-bff-api.md`；
- `docs/data-model/business-data-model.md`；
- `docs/original-smart-renew-reuse-audit.md`；
- `docs/reuse-first-ab-development-outline.md`。

## 24. 本次A/B开发任务

- 接入ProjectData JSON/SQLite转换器；
- 调整未接线SourceAsset导入服务，避免重复实现通用转换模型；
- 接入外业任务BFF和任务列表；
- 建立CloudBase StorageProvider；
- 抽取项目边界地图Provider；
- 接入Legacy迁移；
- 完成结构化导入、外业、对象存储Mock和地图浏览器测试。

本任务列表不包含重新实现上传会话、WebP、照片哈希、小区/楼栋归属、照片治理或本地二进制持久化。
