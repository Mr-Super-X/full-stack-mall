# 前端独立部署

本目录复用 `frontend/Dockerfile` 构建六个前端应用，以 Nginx 托管静态产物，并将 `/api/` 同源反向代理到后端。默认对外入口为 **http://10.2.161.161:9088/**。

## 1. 部署前提与启动顺序

- Linux 服务器已安装 Docker 和 Docker Compose 插件。
- 已按 [`../backend/README.md`](../backend/README.md) 启动后端，且 `backend` 容器正在运行。
- 两端使用同一个外部网络 `mall-deploy-network`；前端启动脚本会在网络不存在时自动创建。

> 默认 `API_UPSTREAM=http://backend:18080` 在 Nginx 启动时解析。请先启动后端再启动前端，否则 Nginx 可能因无法解析 `backend` 而启动失败；后端未就绪时 `/api/` 也可能暂时返回 502。

## 2. 首次启动

在仓库根目录执行：

```bash
cd deploy/frontend
cp .env.example .env
bash deploy.sh start
```

首次构建需要安装 pnpm 依赖并构建六个应用，耗时取决于服务器性能。后续 `start` 会复用 Docker 构建缓存。

`.env` 默认配置：

```dotenv
IMAGE_TAG=latest
HTTP_BIND=0.0.0.0
HTTP_PORT=9088
API_UPSTREAM=http://backend:18080
```

`API_UPSTREAM` 末尾不要添加 `/`。本方案前端 API 地址在构建时固定为同源 `/api`，不需要把后端地址写入 JavaScript。

## 3. 访问与验证

| 用途 | 地址 |
|---|---|
| 商城入口（302 跳转买家端） | `http://10.2.161.161:9088/` |
| 买家端 | `http://10.2.161.161:9088/h5/h5-mall` |
| 管理端 | `http://10.2.161.161:9088/admin/` |
| Nginx 健康检查 | `http://10.2.161.161:9088/healthz` |
| 后端匿名商品接口（经 Nginx） | `http://10.2.161.161:9088/api/mall/product/list` |

服务器上可执行：

```bash
curl -I http://127.0.0.1:9088/
curl -f http://127.0.0.1:9088/healthz
curl -f http://127.0.0.1:9088/api/mall/product/list
```

根路径返回 302 属于预期；健康检查返回 `ok`；商品接口返回 JSON。若使用防火墙或云安全组，只需对目标访问来源开放 TCP `9088`，不要开放 MySQL、Redis 或 RabbitMQ 端口。

## 4. 日常操作

```bash
bash deploy.sh             # 等同于 start：重新构建并启动
bash deploy.sh restart     # 重启现有容器，不加载新镜像
bash deploy.sh stop        # 停止容器，保留镜像和配置
bash deploy.sh status
bash deploy.sh logs web
```

修改 Nginx 模板后，普通 `restart` 不足以重建挂载配置的容器，请执行：

```bash
docker compose up -d --force-recreate web
```

## 5. 快速备份

前端容器运行时执行：

```bash
bash backup.sh
```

每次生成一个独立目录：

```text
backups/frontend-YYYYMMDD-HHMMSS/
├── image.tar.gz             # 可离线加载的完整前端镜像
├── image-reference.txt      # 独立回滚标签，如 mall-frontend:backup-20261119-153000-12345
├── default.conf.template    # 备份时的 Nginx 模板
└── .env                     # 备份时的前端环境配置
```

脚本根据运行容器的实际镜像 ID 创建独立备份标签，避免 `latest` 已变化时保存到错误镜像；同时校验 gzip，失败只清理本次残缺目录和本次新建标签，不删除历史备份。镜像包体积较大，请将整个备份目录复制到服务器之外的安全位置。

可通过环境变量指定其他备份目录：

```bash
BACKUP_DIR=/path/to/secure-backups bash backup.sh
```

## 6. 镜像回滚

```bash
# 1. 加载备份镜像（替换为实际目录）
gzip -dc backups/frontend-YYYYMMDD-HHMMSS/image.tar.gz | docker image load

# 2. 查看备份镜像标签
cat backups/frontend-YYYYMMDD-HHMMSS/image-reference.txt
```

编辑当前 `.env`，将 `IMAGE_TAG` 改成备份标签中冒号后的部分，例如：

```dotenv
IMAGE_TAG=backup-20261119-153000-12345
```

如还需恢复旧 Nginx 配置，先人工比较备份的 `default.conf.template` 与当前文件，再决定是否替换；备份的 `.env` 也仅供对照，避免直接覆盖当前端口或 upstream 配置。最后重建容器：

```bash
docker compose up -d --no-build --force-recreate web
curl -f http://127.0.0.1:9088/healthz
```

**不要使用 `bash deploy.sh start` 进行回滚**，它会按当前源码重新构建镜像；也不要只用普通 `restart`，因为它不会切换到新加载的镜像。`backup-*` 是只读回滚标签：后续需要构建新代码时，必须先把 `IMAGE_TAG` 改回 `latest` 或新的发布标签，启动脚本会拒绝向 `backup-*` 标签执行构建。

## 7. 独立部署说明

- 前端与后端可分别执行 `start`、`stop`、`restart` 和备份，互不需要执行对方的构建命令。
- 同机默认通过 Docker 服务名访问后端；如改为其他已授权的内网后端，只修改 `API_UPSTREAM`，并确保网络路由可达。
- 后端 CORS 白名单必须包含 `http://10.2.161.161:9088`。更换前端地址时，同时更新后端 `.env` 的 `CORS_ALLOWED_ORIGINS`。
- `backups/` 和真实 `.env` 已被 `deploy/.gitignore` 排除，不应提交到 Git。
