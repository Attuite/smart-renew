# 智更 Smart Renew 上线步骤

## 推荐方案

使用 GitHub 保存代码，使用 Render Web Service 运行 Node.js 服务，并挂载持久化磁盘保存项目与分析记录。

## 1. GitHub

1. 注册或登录 GitHub。
2. 新建一个私有仓库，建议命名为 `smart-renew`。
3. 将本目录代码推送到该仓库。

## 2. Render

1. 注册或登录 Render，并连接 GitHub。
2. 使用仓库中的 `render.yaml` 创建 Blueprint。
3. 填写两个密钥：
   - `DASHSCOPE_API_KEY`：阿里云百炼 API Key。
   - `GROUP_VISION_API_KEY`：集团视觉模型访问密钥，仅配置在服务端环境变量中。
   - `GROUP_VISION_BASE_URL`：集团视觉模型兼容接口地址。
   - `GROUP_VISION_MODEL`：集团视觉模型名称，当前为 `qwen3-vl-plus`。
   - `APP_PASSWORD`：网站管理员访问密码，至少 16 位且不要与其他账号重复。
4. 确认实例为支持 Persistent Disk 的付费方案。
5. 确认磁盘挂载路径为 `/var/data`，容量从 1 GB 开始。
6. 部署完成后访问 Render 提供的 `onrender.com` 地址。

## 3. 数据迁移

部署完成后，将本机 `.smart-renew-data` 中的真实项目和分析记录通过受保护 API 上传到线上服务。不要将该目录提交到 GitHub。

## 4. 域名

网站稳定运行后，在 Render 中添加自有域名，再到域名服务商设置 Render 要求的 DNS 记录。HTTPS 证书由 Render 自动签发。

## 安全规则

- 不要把 `.env`、API Key、管理员密码或 `.smart-renew-data` 提交到 GitHub。集团视觉模型密钥同样禁止写入前端或仓库。
- GitHub 仓库应设为 Private。
- 线上必须设置 `APP_PASSWORD`，不要公开无密码的数据接口。
- 定期备份 Render 持久化磁盘中的项目数据。
