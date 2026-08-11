# 智更平台工作任务总结

> 更新时间：2026-08-11  
> 工作目录：`G:\智更平台 - 副本`  
> 当前分支：`main`  
> GitHub：`https://github.com/Attuite/smart-renew`  
> 最新功能提交：`54417f0 修复项目数据索引与报告统计`

## 最新发布记录（2026-08-11）

### 本次完成

- 在智更 CloudBase 环境 `smart-renew-d2gamusvr1b96ce95` 创建：
  - `projectDataRecords`
  - `reportSnapshots`
- 重建两个项目的数据索引：
  - 西安雁塔区城市体检：`61` 条；
  - 绵阳城市体检：`55` 条。
- 云函数增加缺失集合自动补建，后续新环境首次访问数据索引或报告快照接口时可自动初始化集合。
- 修正动态报告标题重复，现为“西安雁塔区城市体检报告”。
- 统一现场照片统计口径：只统计照片档案中的原始现场照片，排除 AI 标注图：
  - 西安项目：`10` 张；
  - 绵阳项目：`3` 张；
  - 项目总览：`13` 张。
- 动态报告中的“补充住区分析”和“补充社区/街区分析”改为当前项目专属路由，不再跳转旧的全局路由。
- 增加根目录 `AGENTS.md`，长期记录两套视觉模型架构：
  - 千问视觉模型走智更 CloudBase 云端；
  - 单位／集团视觉模型走姚工电脑的 `4173` 局域网代理。

### 本次发布结果

- 功能代码已提交并推送至 GitHub `main`：`54417f0`。
- API 云函数采用“仅更新代码”方式发布，保留线上已有环境变量和密钥。
- 智更静态站上传 `10` 个文件，全部成功。
- 部署目标核对通过：
  - 环境：`smart-renew-d2gamusvr1b96ce95`
  - 域名：`smart-renew-d2gamusvr1b96ce95-1456348363.tcloudbaseapp.com`
  - 标题：`智更Smart Renew · 城市更新`
- 线上验证：项目接口返回 `2` 个项目，西安索引返回 `61` 条，报告快照接口正常返回空列表。
- 本轮没有部署或修改政策图谱、微信小程序。

### 本次验证

- `npm run check` 通过。
- `node --check functions/api/index.js` 通过。
- `git diff --check` 通过。
- 本地页面验证通过：标题、照片数量和项目路由正确，控制台无错误。

## 一、项目边界

目前共有三个项目，必须始终分开处理：

1. **智更网页**
   - 城市更新体检与项目管理网页。
   - CloudBase 环境：`smart-renew-d2gamusvr1b96ce95`
   - 线上域名：`https://smart-renew-d2gamusvr1b96ce95-1456348363.tcloudbaseapp.com`
   - 页面标题：`智更Smart Renew · 城市更新`

2. **微信小程序**
   - 与智更网页配套，用于现场照片采集和上传。
   - 本轮工作未修改、未重新部署小程序。

3. **政策图谱**
   - 独立项目，不属于智更网页。
   - 已创建独立 CloudBase 环境：`policy-atlas-d2gk1a1cl086fd328`
   - 当前任务记录中没有确认政策图谱已完成代码部署及独立域名绑定。

## 二、已完成工作

### 1. 智更网页恢复与环境隔离

- 明确智更网页、微信小程序、政策图谱三个项目的边界。
- 智更网页的部署目标固定为 `smart-renew-d2gamusvr1b96ce95`。
- 增加 `cloudbase.target.json` 和部署前置检查，部署前校验：
  - 当前分支必须是 `main`；
  - 本地 `main` 必须与 `origin/main` 一致；
  - 页面标题必须是智更标题；
  - CloudBase 环境 ID 和目标域名必须匹配。
- 已将智更网页和 API 部署到原智更环境，未覆盖政策图谱。

### 2. GitHub 仓库整理与发布

- GitHub 远端：`Attuite/smart-renew`。
- 已将本轮代码直接提交并推送到 `main`。
- 最新功能提交：`54417f0 修复项目数据索引与报告统计`。
- 推送内容包括：
  - `index.html`
  - `server.mjs`
  - `functions/api/index.js`
  - `CLOUDBASE_DEPLOYMENT.md`
  - 本机局域网代理启动、停止和计划任务脚本
- `.playwright-cli/` 为本地测试临时目录，未上传 GitHub。

### 3. 智更网页界面与流程调整

- “住区分析”与“人工复核”完成栏目拆分：
  - 住区分析保留识别概览、标注预览和进入人工复核入口；
  - 接受、修改、驳回、复核人员、生成标注图和正式入库迁移至“人工复核”。
- 人工复核页增加独立复核工作区。
- 待复核统计改为右侧动态抽屉，减少页面纵向占用。
- 已接受/已修正问题改为紧凑归档卡：
  - 默认显示缩略图、问题名称和状态；
  - 鼠标悬停或键盘聚焦时展开大图和详情；
  - 可重新修改或驳回；
  - 鼠标移开后自动收起。
- 修正“已修正”状态显示及重新编辑状态保持问题。
- 页面刷新后保留当前 URL 路由，不再强制返回首页。
- 项目内部页面调整为左侧目录、右侧工作区。
- 左侧目录接入 React Bits `LineSidebar` 的等效原生实现：
  - 编号与刻度线；
  - 鼠标距离感应；
  - 平滑位移和颜色变化；
  - 当前栏目高亮；
  - 小屏幕自动切换为横向菜单。
- 进一步缩窄左侧目录，工作区按页面中心线居中。
- “返回项目管理”改为更小的无边框文字入口。

### 4. AI 视觉模型接入

- 保留原有千问视觉模型，没有删除已有配置。
- 增加集团视觉模型选项，用户可在网页中选择模型。
- 集团模型接口位于集团内网，腾讯云云函数无法直接访问。
- 已将本机配置为局域网代理：
  - 地址：`http://172.16.71.214:4173`
  - 端口：`4173`
  - 集团模型请求由本机直连内网；
  - 其他业务 API 转发至智更 CloudBase。
- 已创建 Windows 防火墙入站规则。
- 已注册计划任务 `SmartRenewLanProxy`，登录后启动代理。

### 5. 标注图和正式问题入库修复

- 修复 Canvas 跨域污染：
  - 原因是腾讯云 COS 签名图片缺少可用于 Canvas 导出的跨域许可；
  - 现在通过 `/api/photos/{照片ID}/content` 同源图片流加载；
  - 不再直接把 COS 签名地址绘入 Canvas。
- 已验证照片流返回 `200 image/jpeg`。
- 修复正式入库时缺少 `officialIssues` 集合的问题：
  - 已在智更 CloudBase 环境创建 `officialIssues`；
  - API 中增加集合自动初始化逻辑；
  - 已验证问题接口返回 `200`。

### 6. 本轮上线结果

- 智更 API 云函数部署成功。
- 智更静态网页部署成功，共上传 10 个文件。
- 上线前已核对环境、域名和页面标题。
- 线上地址：`https://smart-renew-d2gamusvr1b96ce95-1456348363.tcloudbaseapp.com`

## 三、未完成或本轮没有执行的工作

### 1. 微信小程序

- 未修改小程序代码。
- 未重新上传或部署小程序。
- 未验证小程序最新版本与线上版本的差异。

### 2. 政策图谱

- 本轮没有部署政策图谱代码。
- 没有确认政策图谱独立域名已经购买、备案、绑定并生效。
- 没有确认政策图谱 GitHub 仓库及 `main` 的最新状态。
- 没有对政策图谱环境执行任何覆盖性操作。

### 3. 集团视觉模型公网运行

- 集团模型仍不能由腾讯云云函数直接访问。
- 当前方案依赖本机作为集团内网代理，并非真正的公网云端服务。
- 本机关闭、休眠、断网、退出集团内网或代理进程停止后，其他局域网用户将无法使用集团模型。
- 千问模型及智更其他云端功能不依赖本机集团内网连接。

### 4. 仓库临时文件

- `.playwright-cli/` 仍保留在本地且未纳入 Git。
- 当前 Git 状态除该临时目录外，`main` 与 `origin/main` 已同步。

### 5. 仍待处理的网站问题

- 线上 API 当前没有启用 `APP_PASSWORD`，匿名用户能够读取接口；在正式扩大使用范围前应增加访问鉴权，并重点保护修改、删除、导入和模型密钥配置接口。
- 西安项目的“完整报告原文”仍展示绵阳报告作为参考模板，需要增加明确的“示例报告”标识或改成项目自己的正式报告。
- 人工复核页关闭状态的统计抽屉仍可能撑大页面宽度，需要调整隐藏抽屉的定位方式。
- 通过普通项目目录链接切换栏目时，部分情况下会保留上一页滚动位置。
- 小屏幕项目目录采用横向滚动，后半部分栏目缺少明显的可滑动提示。
- `scripts/start-lan-proxy.ps1` 仍包含本机 `image_test.py` 的固定路径，后续如需迁移电脑应改用本机私有配置。
- 当前自动检查主要是语法检查，尚未建立完整的接口、路由和业务流程自动化测试。

## 四、后续工作注意事项

### 1. 严格防止项目互相覆盖

- 智更网页只能部署到：`smart-renew-d2gamusvr1b96ce95`。
- 政策图谱只能部署到：`policy-atlas-d2gk1a1cl086fd328`。
- 部署前必须同时检查：
  1. 项目目录；
  2. Git 分支；
  3. `cloudbase.target.json`；
  4. `cloudbaserc.json`；
  5. 页面 `<title>`；
  6. CloudBase 环境 ID；
  7. 目标域名。

### 2. 智更推荐部署顺序

1. 确认在智更项目目录。
2. 检查 `git status`，避免混入临时文件或无关改动。
3. 将代码提交并推送到 GitHub `main`。
4. 执行部署预检：

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/deploy-cloudbase.ps1
   ```

5. 需要更新 API 时，先部署 `api` 云函数。
6. 再执行静态网页部署：

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/deploy-cloudbase.ps1 -Deploy
   ```

7. 上线后核对网页标题和实际域名。

### 3. 集团模型密钥安全

- 集团模型真实 API Key 不得写入 GitHub、`index.html`、`cloudbaserc.json` 或 Markdown 文档。
- 当前本机启动脚本从单位提供的 `image_test.py` 中读取密钥。
- `scripts/start-lan-proxy.ps1` 当前包含本机 `image_test.py` 的固定路径；如果仓库需要给其他电脑使用，应改为环境变量或本机私有配置文件。
- 不要把 `4173` 端口映射到公网，只允许集团可信局域网访问。

### 4. 本机代理维护

- 启动：

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/start-lan-proxy.ps1
  ```

- 停止：

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/stop-lan-proxy.ps1
  ```

- 查看计划任务：

  ```powershell
  Get-ScheduledTask -TaskName SmartRenewLanProxy
  ```

- 如果电脑 IP 变化，应重新确认局域网访问地址，不要长期假定一定是 `172.16.71.214`。

### 5. 数据库集合

- 智更正式问题依赖 `officialIssues` 集合。
- 新建 CloudBase 环境时，应检查以下业务集合是否存在：
  - `projects`
  - `analysisRecords`
  - `projectDataRecords`
  - `settings`
  - `apiKeyUsers`
  - `fieldCollectionTasks`
  - `photoRecords`
  - `officialIssues`
  - `reportSnapshots`
- 如果新环境缺少集合，应先初始化数据库再进行业务入库测试。
- 当前智更环境已经创建 `projectDataRecords`、`officialIssues` 和 `reportSnapshots`；西安、绵阳项目的数据索引已经完成重建。

### 6. 上线后的功能检查建议

- 智更首页标题与导航。
- 刷新后是否保持当前项目栏目。
- 住区分析能否生成识别记录。
- 人工复核接受、修改、驳回是否保存。
- 标注图能否生成并正式入库。
- 问题台账是否显示正式问题。
- 报告成果是否能读取已归档数据。
- 千问模型是否可用。
- 集团局域网内用户是否可通过本机代理使用集团模型。

## 五、关键文件

- `index.html`：智更网页主体、项目工作台、人工复核和前端交互。
- `server.mjs`：本机服务、集团视觉模型代理、CloudBase API 转发。
- `functions/api/index.js`：CloudBase API、照片、问题入库和模型代理。
- `cloudbase.target.json`：智更部署环境、域名和标题锁定信息。
- `cloudbaserc.json`：智更 CloudBase 云函数配置。
- `scripts/deploy-cloudbase.ps1`：智更上线前检查与静态托管部署。
- `scripts/start-lan-proxy.ps1`：启动本机集团视觉模型代理。
- `scripts/stop-lan-proxy.ps1`：停止本机代理。
- `scripts/register-lan-proxy-task.ps1`：注册 Windows 登录启动任务。
