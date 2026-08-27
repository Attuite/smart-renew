# 智更平台回家继续开发说明

## 1. 当前版本身份

- GitHub 仓库：`https://github.com/Attuite/smart-renew.git`
- 日常开发分支：`姚博迪修改`
- 稳定备份分支：`main`
- 本说明对应版本：以压缩包内 `PACKAGE_VERSION.txt` 记录的提交号为准。
- 线上网页：`https://smart-renew-d2gamusvr1b96ce95-1456348363.tcloudbaseapp.com/`

以后修改网页时，先确认当前分支是 `姚博迪修改`，不要直接在 `main` 上开发。阶段版本确认稳定后，再把同一提交同步到 `main`。

## 2. 回家后推荐的打开方式

### 方式 A：从 GitHub 获取（推荐）

电脑安装 Git 和 Node.js 20 或更高版本后，在 PowerShell 中执行：

```powershell
git clone --branch "姚博迪修改" https://github.com/Attuite/smart-renew.git
Set-Location smart-renew
npm start
```

浏览器打开：`http://127.0.0.1:4173`

以后每次开始修改前执行：

```powershell
git switch "姚博迪修改"
git pull --ff-only origin "姚博迪修改"
```

### 方式 B：直接使用本压缩包

解压到不带特殊权限限制的目录，例如 `D:\Projects\smart-renew`，进入目录后执行：

```powershell
npm start
```

压缩包是源码快照，不包含 `.git` 历史。需要继续向 GitHub 提交时，优先使用方式 A；不要在解压目录里随意重新初始化并强制推送。

## 3. 本地数据与线上数据的区别

- 普通运行 `npm start` 时，项目、照片和分析记录默认保存在当前电脑的 `.smart-renew-data` 目录。
- 该目录包含本机项目资料和照片，不进入 Git，也不包含在源码压缩包中。
- 因此，回家第一次启动时看不到办公室电脑里的本地测试项目是正常现象，不代表代码或项目丢失。
- 正式线上数据存放在智更 CloudBase 环境 `smart-renew-d2gamusvr1b96ce95`，不要与政策图谱环境混用。
- 如确实需要把办公室本地测试项目带回家，应单独制作数据备份并核对照片、隐私和密钥，不能直接提交 GitHub。

## 4. 两套视觉模型

### 千问视觉模型

- 正式网页通过智更 CloudBase API 调用。
- 不依赖办公室电脑或单位内网。
- API Key 只能配置在服务端或个人私有环境中，不能写入网页、Markdown 或 GitHub。

### 单位视觉模型（集团视觉模型）

- 只能通过单位内网访问。
- 办公室电脑是代理中转机，默认端口为 `4173`。
- 回家后如果没有单位 VPN／内网，集团模型不可用属于正常情况；千问模型不受影响。
- 不要把 `4173` 端口映射到公网，也不要把集团模型密钥复制进源码包。

## 5. 主要文件与目录

- `index.html`：网页主页面、路由和大部分界面逻辑。
- `assets/`：页面样式、结构脚本、报告模板、指标资料和静态资源。
- `server.mjs`：本地 `4173` 服务、数据接口和视觉模型代理。
- `functions/api/`：CloudBase 云端 API。
- `miniprogram/`：微信现场采集小程序。
- `scripts/`：本地代理、CloudBase 发布和报告模板处理脚本。
- `AGENTS.md`：项目长期规则，开始修改前必须先阅读。
- `HOME_DEVELOPMENT_GUIDE.md`：本说明。

## 6. 日常 Git 操作

完成一轮修改后，先查看改动，不要直接使用 `git add .`：

```powershell
git status
git diff
git add -- 具体文件1 具体文件2
git commit -m "说明本次修改内容"
git push origin "姚博迪修改"
```

确认是稳定阶段版本后，再把 `姚博迪修改` 快进同步到 `main`。如果远端分支出现分叉，停止操作并先核对，不使用强制推送、硬重置或覆盖式切换。

## 7. 禁止进入 GitHub 或压缩包的内容

- `.env`、API Key、密码和登录令牌。
- `.smart-renew-data/`、`.uploads/` 和真实项目照片。
- `node_modules/`、浏览器测试缓存、临时文件和 `_backup*` 目录。
- 微信或其他软件的私有文件路径中的密钥脚本。

## 8. 发布边界

- 日常改代码不等于上线。
- 未明确要求时，不主动发布 CloudBase，也不主动测试正式网站。
- CloudBase 静态网页只发布 `index.html + assets`。
- `server.mjs` 和本机集团模型代理不能上传为公网代理。
- 发布前必须再次确认目标环境是 `smart-renew-d2gamusvr1b96ce95`。

## 9. 交给 Codex 时可直接这样说

> 请先阅读项目根目录的 AGENTS.md 和 HOME_DEVELOPMENT_GUIDE.md，确认当前位于“姚博迪修改”分支。先核对工作区和现有代码，不要覆盖未提交内容；不要主动上线或测试，除非我明确要求。
