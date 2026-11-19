# 前后端独立部署入口

本目录用于在同一台 Linux 服务器上**分别部署和运维前后端**，最终通过 **http://10.2.161.161:9088/** 访问。现有根目录 `docker-compose.yml` 的全栈一体化部署方式保持不动。

## 部署拓扑

```text
浏览器
  └─ http://10.2.161.161:9088
       └─ deploy/frontend：Nginx（唯一公开端口 9088）
            ├─ /h5/、/admin/ 等：六个前端应用静态产物
            └─ /api/ → http://backend:18080
                         └─ deploy/backend：Spring Boot
                              ├─ MySQL 8.4
                              ├─ Redis 7
                              └─ RabbitMQ 3.13
```

两端通过外部 Docker 网络 `mall-deploy-network` 通信。后端、MySQL、Redis 和 RabbitMQ 均不映射宿主机端口。

## 首次部署：先后端，再前端

### 1. 配置并启动后端

```bash
cd deploy/backend
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，分别填写 `DB_PASSWORD`、`RABBIT_PASSWORD`、`JWT_SECRET`、`PAYMENT_SECRET`。可逐项使用 `openssl rand -hex 32` 生成随机值，然后执行：

```bash
bash deploy.sh start
bash deploy.sh status
bash deploy.sh logs backend
```

完整说明见 [后端部署文档](backend/README.md)。

### 2. 配置并启动前端

确认后端容器已运行后执行：

```bash
cd ../frontend
cp .env.example .env
bash deploy.sh start
bash deploy.sh status
```

完整说明见 [前端部署文档](frontend/README.md)。

### 3. 验证访问

```bash
curl -I http://127.0.0.1:9088/                         # 预期 302 到买家端
curl -f http://127.0.0.1:9088/healthz                  # 预期 ok
curl -f http://127.0.0.1:9088/api/mall/product/list    # 预期 JSON
```

浏览器访问：

- 买家端：`http://10.2.161.161:9088/h5/h5-mall`
- 管理端：`http://10.2.161.161:9088/admin/`

## 日常运维

在 `deploy/backend` 或 `deploy/frontend` 目录内分别执行：

```bash
bash deploy.sh start       # 构建并启动；代码更新后使用
bash deploy.sh restart     # 重启现有容器，不重新构建
bash deploy.sh stop        # 停止，不删除数据卷或镜像
bash deploy.sh status      # 查看状态
bash deploy.sh logs        # 跟踪日志
bash backup.sh             # 快速备份
```

| 部署端 | 备份内容 | 默认位置 |
|---|---|---|
| backend | MySQL 一致性 SQL 压缩包 | `deploy/backend/backups/` |
| frontend | 当前镜像、回滚标签、Nginx 模板和前端 `.env` | `deploy/frontend/backups/frontend-*/` |

恢复和回滚命令分别见两端 README。真实 `.env` 和备份产物已被本目录 `.gitignore` 排除，不要提交到 Git。
