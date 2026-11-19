# 后端独立部署

本目录启动 Spring Boot、MySQL、Redis 和 RabbitMQ，复用仓库现有的 `backend/Dockerfile` 与 `backend/sql/init.sql`。服务通过外部 Docker 网络 `mall-deploy-network` 提供给前端，**不映射任何宿主机端口**。

## 1. 部署前提

- Linux 服务器已安装 Docker 和 Docker Compose 插件。
- 当前仓库已完整上传到服务器。
- 后端先于此目录对应的前端启动；前端默认通过 `http://backend:18080` 访问本服务。

在仓库根目录执行：

```bash
cd deploy/backend
cp .env.example .env
chmod 600 .env
```

编辑 `.env`，至少填写以下四个必填项，且每项使用不同的随机值：

```dotenv
DB_PASSWORD=
RABBIT_PASSWORD=
JWT_SECRET=
PAYMENT_SECRET=
```

可逐项执行 `openssl rand -hex 32` 生成随机值。不要将真实 `.env` 提交到 Git，也不要继续使用 `application.yml` 中的开发默认密钥。

## 2. 启动与检查

```bash
bash deploy.sh start       # 首次启动或代码更新后重新构建
bash deploy.sh status      # 查看容器与健康状态
bash deploy.sh logs backend
```

等待 `mysql`、`mall-redis`、`mall-rabbit` 均为 healthy，`backend` 启动成功后，可检查匿名商品接口：

```bash
docker compose exec backend wget -qO- http://127.0.0.1:18080/api/mall/product/list
```

看到 JSON 响应即表示后端进程和数据库连接可用。后端容器在共享网络中的地址为 `http://backend:18080`，业务接口前缀为 `/api/mall/**`。

## 3. 日常操作

```bash
bash deploy.sh             # 等同于 start
bash deploy.sh restart     # 重启现有容器，不重新构建镜像
bash deploy.sh stop        # 停止容器，保留容器与数据卷
bash deploy.sh status
bash deploy.sh logs        # 跟踪全部日志
bash deploy.sh logs mysql mall-rabbit
```

### 后端容器重建后的必要联动

`bash deploy.sh start` 在代码更新后可能重建 `backend` 容器并改变其容器 IP。运行中的 Nginx 会缓存启动时解析的上游地址，因此**后端容器重建后**必须重启前端，让 Nginx 重新解析 `backend`：

```bash
cd ../frontend
bash deploy.sh restart
curl -f http://127.0.0.1:9088/api/mall/product/list
```

普通后端 `restart` 不会更换容器，无需重启前端；只有容器重建后才需要这一步。

需要移除容器时，在本目录执行 `docker compose down`；命名卷默认保留。**不要在需要保留数据时执行 `docker compose down -v`。**

## 4. 快速备份

```bash
bash backup.sh
```

备份文件默认写入 `deploy/backend/backups/mall-YYYYMMDD-HHMMSS.sql.gz`，目录权限为 `700`、文件权限为 `600`。脚本具备以下行为：

- 要求 MySQL 容器正在运行，通过 `mysqldump --single-transaction` 导出一致性快照。
- 导出 `mall` 数据库的表、数据、视图、触发器、事件和例程，并压缩为 `.sql.gz`。
- 自动执行 `gzip -t` 校验；失败时清理本次 `.partial` 文件，不删除历史备份。

备份包含业务数据，应尽快加密复制到服务器之外的安全位置。Redis 与 RabbitMQ 虽有独立持久卷，但**此 SQL 备份不包含它们的运行状态**。若 `SECKILL_STRATEGY=redis` 且有秒杀流量，应先停止写入并等待队列消费完成，否则未落库状态不在本次 MySQL 快照内。

可通过环境变量指定其他备份目录：

```bash
BACKUP_DIR=/path/to/secure-backups bash backup.sh
```

## 5. 恢复 MySQL 备份

> 恢复会向目标数据库写回备份中的同名表并覆盖其中的数据，但不会自动删除备份之后新增的额外表。先在测试环境验证备份，并确认目标环境无误。

```bash
# 1. 恢复前再备份当前数据库
bash backup.sh

# 2. 停止应用写入，保留 MySQL 运行
docker compose stop backend

# 3. 校验并恢复（将文件名替换为实际备份）
gzip -t backups/mall-YYYYMMDD-HHMMSS.sql.gz
gzip -dc backups/mall-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'

# 4. 重新启动后端并检查日志
docker compose start backend
bash deploy.sh logs backend
```

## 6. 数据与配置注意事项

- MySQL、Redis、RabbitMQ 分别使用命名卷 `mall-deploy-mysql-data`、`mall-deploy-redis-data`、`mall-deploy-rabbitmq-data`。
- `backend/sql/init.sql` 仅在 MySQL 数据目录为空时自动执行；修改该文件不会重置已有数据库。
- 默认 `CORS_ALLOWED_ORIGINS=http://10.2.161.161:9088`。更换访问地址时同步修改 `.env`，然后重新执行 `bash deploy.sh start`。
- 默认 `SECKILL_STRATEGY=optimistic`；需要 Redis + MQ 异步出单时改为 `redis`。
- 后端不直接暴露宿主机端口。如需临时排查，优先使用 `docker compose exec`，不要随意向公网开放 MySQL、Redis 或 RabbitMQ。
