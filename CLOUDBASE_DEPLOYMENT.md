# 智更 CloudBase 部署约束

- 固定环境：`smart-renew-d2gamusvr1b96ce95`
- 固定域名：`smart-renew-d2gamusvr1b96ce95-1456348363.tcloudbaseapp.com`
- 只允许从已同步且无已跟踪修改的 `main` 分支部署。
- 发布前执行 `powershell -ExecutionPolicy Bypass -File scripts/deploy-cloudbase.ps1`。
- 确认检查通过后，执行同一命令并添加 `-Deploy`。
- 政策图谱及其他项目严禁使用此环境。
- 云函数部署时必须通过进程环境变量提供 `GROUP_VISION_API_KEY`；`cloudbaserc.json` 只保留变量占位符，禁止提交真实密钥。
