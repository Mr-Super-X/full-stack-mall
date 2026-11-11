# 阶段 5：部署上线（docker-compose 全栈）+ README 作品集化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一条 `docker compose up -d` 起全栈（web+backend+mysql+redis+rabbitmq，仅 8080 对外），README 重构为招聘场景黄金一页（4b 证据链 + 六张实截）。

**Architecture:** 前端部署资产沿用模板遗产（多阶段 Dockerfile + nginx envsubst + build-prod.ts 聚合构建，6 app 全保留）；补齐后端 multi-stage Dockerfile（maven build → jre-alpine runtime）；新建根 compose 统一编排，基础设施不暴露宿主机端口；nginx 根 302 改 /h5/h5-mall。

**Tech Stack:** Docker Compose v2 · nginx:1.27-alpine · node:24-alpine + corepack pnpm@12（前端构建）· maven:3.9-eclipse-temurin-17 → eclipse-temurin:17-jre-alpine（后端镜像）· Playwright/chromium（截图）。

**Spec:** `docs/superpowers/specs/2026-11-11-阶段5-部署上线与README作品集化设计.md`（v1.0 已批准，builder-check 修正已回写）

## Global Constraints

- Java 17 / Spring Boot 3.5.9 / MyBatis-Plus 3.5.18.1；前端 pnpm monorepo（Node >=22.18）
- 中文 commit message、不加 AI 协作痕迹（不加 Co-Authored-By）
- 已有文件只 Edit，仅新建文件用 Write
- backend/docker-compose.yml 不动（开发态保留）；前端 6 app 全保留不裁剪
- 截图必须来自真实运行的全栈容器
- application.yml 零改动（环境变量占位符已完备）
- RabbitMQ 必须建 mall/mall 用户（guest 被 loopback_users 禁远程）
- HEALTHCHECK 端点 `/api/mall/product/list`（actuator 未引入，该端点已核实匿名可访问）

## Review Focus

1. **前端 Docker 首次构建资源**：6 app 全量构建在 Docker Desktop 可能内存不足/超时——失败降级=调 Docker Desktop 内存上限，README FAQ 注明。
2. **init.sql 卷缓存语义**：mysql entrypoint 只在空数据目录跑 initdb——用户重跑或改种子后须 `docker compose down -v` 重建卷，README 必须注明（否则"我改了 init.sql 怎么没生效"成迷）。
3. **compose project 卷隔离**：根 compose（project=full-stack-mall）与 backend compose（project=backend）卷名天然隔离；但**端口不隔离**——backend compose 的 13306/6379/5672 若仍在跑，根 compose 起容器不撞（不映射宿主机），但 backend compose 的 backend 本机进程会占 18080——冒烟前须确认本机 mvn 后端不在跑。
4. **SECKILL_STRATEGY=redis 回归依赖链**：受理表路径依赖 Redis+RabbitMQ 双 healthy——depends_on condition 已含；但 redis 策略下秒杀下单返回受理态（paymentNo 缺失），冒烟走查须按 4b 的轮询语义验证而非期待同步收银台。
5. **教学密钥默认值**：JWT_SECRET/PAYMENT_SECRET 显式进 compose——诚实声明已在设计稿 §6.2，README 不得暗示"生产可用默认值"。

---

### Task 1: 后端 Dockerfile + .dockerignore

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Interfaces:**
- Produces: `mall-backend:prod` 镜像（multi-stage）；容器内监听 18080，context-path /api；容器网络服务名 `backend` 供 T2 web 反代消费

- [ ] **Step 1: 确认 Spring Boot repackage 插件（JAR 名可预期）**

Run: `grep -A3 "spring-boot-maven-plugin" backend/pom.xml`
Expected: 输出含 repackage execution（或 spring-boot starter parent 默认 repackage）——确定 target 产物为可执行 fat JAR
不匹配处理：若无 repackage，在 T1 内先补插件配置（最小 pom Edit）再继续

- [ ] **Step 2: 编写 backend/Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1
# 生产镜像（多阶段）：maven 构建可执行 JAR → jre-alpine 运行。
# 构建期不跑测试（209 用例由本地 mvn verify 承担，镜像构建跑测试 10min+ 无收益——spec §6.1 取舍）。
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:17-jre-alpine
RUN addgroup -S mall && adduser -S mall -G mall
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
USER mall
EXPOSE 18080
# 健康检查：/api/mall/product/list 匿名可访问（WebMvcConfig 拦截名单不含它）；
# alpine 无 curl，用 busybox wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:18080/api/mall/product/list > /dev/null 2>&1 || exit 1
ENTRYPOINT ["java", "-jar", "app.jar"]
```

- [ ] **Step 3: 编写 backend/.dockerignore**

```
target/
.git/
*.md
.idea/
*.iml
```

- [ ] **Step 4: 镜像构建 smoke**

Run: `docker build -t mall-backend:prod backend/`
Expected: 构建成功（mvn package 输出 BUILD SUCCESS；首次约 2-5min 拉基础镜像）
失败处理：按 build 输出定位（依赖下载失败→重试；编译错→与改动无关不可能出现，出现则上报）

- [ ] **Step 5: 容器单测 smoke（不依赖全栈）**

Run: `docker run -d --name mall-backend-smoke -e DB_URL="jdbc:mysql://host.docker.internal:13306/mall?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true" -e REDIS_HOST=host.docker.internal -e RABBIT_HOST=host.docker.internal -p 18099:18080 mall-backend:prod`，等待 60s 后 `curl -s -o /dev/null -w "%{http_code}" http://localhost:18099/api/mall/product/list`
Expected: HTTP 200（本机 backend compose 三件套若在跑则连通真实 MySQL；不在跑则 DB 连接失败属预期——本步只验证 JAR 启动 + 端口监听，curl 返回 500/200 均说明进程存活，用 `docker logs mall-backend-smoke | tail -5` 确认启动日志无 crash 即可）
清理: `docker rm -f mall-backend-smoke`

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "chore(backend): 应用本体 multi-stage Dockerfile（maven build → jre-alpine，非 root + wget 健康检查）"
```

---

### Task 2: 根 compose + nginx 302 微调 + 全栈冒烟

**Files:**
- Create: `docker-compose.yml`（根目录）
- Modify: `frontend/deploy/nginx.prod.conf.template`（1 处 302）

**Interfaces:**
- Consumes: T1 的 `mall-backend:prod` 镜像；前端 `vv-web:prod` 镜像（frontend/Dockerfile 现有，build: ./frontend）
- Produces: 全栈运行形态（8080 唯一对外口）；浏览器可达 /h5/h5-mall 真实链路

- [ ] **Step 1: nginx 根 302 微调**

Edit `frontend/deploy/nginx.prod.conf.template`：`location = /` 的 `return 302 $scheme://$http_host/portal/;` → `return 302 $scheme://$http_host/h5/h5-mall;`
Expected: 文件中仅 1 处 /portal/ 302 被改（favicon 指向不动——h5 无 favicon 文件，builder-check 已核实）；`grep -c "portal/" frontend/deploy/nginx.prod.conf.template` ≥2（favicon + portal SPA 路径仍在）

- [ ] **Step 2: 编写根 docker-compose.yml**

```yaml
# 生产形态全栈编排（一条命令起全栈；开发调试用 backend/docker-compose.yml + 本机 mvn）。
# 对外仅暴露 8080（web）；基础设施与 backend 仅在容器网络内可达。
# 压测/演示种子数据随 init.sql 全量初始化（含活动 18 + perf001~500 压测账号池——benchmark/README.md 引用，属特性非残留）。
services:
  mysql:
    image: mysql:8.4
    container_name: mall-mysql-prod
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD:-mall-root}
      MYSQL_DATABASE: mall
      TZ: Asia/Shanghai
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --innodb-lock-wait-timeout=5
    volumes:
      - mall-mysql-prod-data:/var/lib/mysql
      - ./backend/sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: [ "CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-p$${MYSQL_ROOT_PASSWORD}" ]
      interval: 5s
      timeout: 3s
      retries: 20
    restart: unless-stopped

  mall-redis:
    image: redis:7
    container_name: mall-redis-prod
    healthcheck:
      test: [ "CMD", "redis-cli", "ping" ]
      interval: 5s
      timeout: 3s
      retries: 20
    restart: unless-stopped

  mall-rabbit:
    image: rabbitmq:3.13-management
    container_name: mall-rabbit-prod
    environment:
      # guest 被 rabbitmq loopback_users 禁远程，容器网络内必 ACCESS_REFUSED——
      # 首启建 mall/mall 替代（开发态 guest 走宿主机 loopback 不受影响）
      RABBITMQ_DEFAULT_USER: ${RABBIT_USER:-mall}
      RABBITMQ_DEFAULT_PASS: ${RABBIT_PASSWORD:-mall}
    healthcheck:
      test: [ "CMD", "rabbitmq-diagnostics", "-q", "ping" ]
      interval: 10s
      timeout: 5s
      retries: 20
    restart: unless-stopped

  backend:
    build: ./backend
    image: mall-backend:prod
    container_name: mall-backend-prod
    depends_on:
      mysql: { condition: service_healthy }
      mall-redis: { condition: service_healthy }
      mall-rabbit: { condition: service_healthy }
    environment:
      DB_URL: jdbc:mysql://mysql:3306/mall?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
      DB_USER: root
      DB_PASSWORD: ${DB_PASSWORD:-mall-root}
      REDIS_HOST: mall-redis
      REDIS_PORT: 6379
      RABBIT_HOST: mall-rabbit
      RABBIT_PORT: 5672
      RABBIT_USER: ${RABBIT_USER:-mall}
      RABBIT_PASSWORD: ${RABBIT_PASSWORD:-mall}
      SECKILL_STRATEGY: ${SECKILL_STRATEGY:-optimistic}
      JWT_SECRET: ${JWT_SECRET:-dev-only-mall-jwt-secret-key-please-override-in-prod}
      PAYMENT_SECRET: ${PAYMENT_SECRET:-dev-only-mall-payment-secret-please-override-in-prod}
    # 不暴露宿主机端口（web 容器内反代）；调试可临时加 ports: ["18080:18080"]
    restart: unless-stopped

  web:
    build: ./frontend
    image: vv-web:prod
    container_name: mall-web-prod
    ports:
      - "8080:80"
    environment:
      API_UPSTREAM: http://backend:18080
    depends_on:
      backend: { condition: service_started }
    restart: unless-stopped

volumes:
  mall-mysql-prod-data:
```

- [ ] **Step 3: 全栈构建 + 启动**

前置确认：`tasklist //FI "IMAGENAME eq java.exe"` 无占 18080 的本机进程（有则先停——backend compose 本机 mvn 进程会抢 18080 不影响容器网络，但保险起见确认）
Run: `docker compose up -d --build 2>&1 | tail -20`
Expected: 5 容器全部 Created/Started；随后 `docker compose ps` 显示 mysql/redis/rabbit healthy、backend/web running（backend 首启 30-60s，wget 健康检查通过）
失败处理：按 systematic-debugging 读 `docker compose logs <svc>` 定位，不打补丁

- [ ] **Step 4: 冒烟走查（浏览器逐条）**

1. `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:8080/` → Expected: `302 http://localhost:8080/h5/h5-mall`
2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/mall/product/list` → Expected: `200`（经 nginx 反代到 backend）
3. 浏览器开 `http://localhost:8080/` → 自动跳 /h5/h5-mall → 首页渲染真实商品种子（非 mock）
4. buyer/buyer123 登录（cookie 会话生效）→ 商品详情 → 下单 → 模拟支付 → 我的订单可见新单
5. h5 秒杀会场（或活动 18 入口）下单 → optimistic 策略同步建单成功 → 订单列表含秒杀单
6. admin/admin123 走 `http://localhost:8080/admin/` 登录 → 订单管理可见第 4/5 步的订单

- [ ] **Step 5: SECKILL_STRATEGY=redis 策略回归**

Run: `SECKILL_STRATEGY=redis docker compose up -d backend` → 等 backend healthy → 浏览器重复 Step 4 第 5 条
Expected: 秒杀下单进受理态（h5 显示"排队出单中…"轮询→收银台，4b 语义）→ MySQL 订单落行 → 恢复：默认 optimistic `docker compose up -d backend`（不带环境变量）

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml frontend/deploy/nginx.prod.conf.template
git commit -m "feat(deploy): 根目录全栈 compose（web+backend+三件套，仅 8080 对外，RabbitMQ mall 用户）+ nginx 根 302 → /h5/h5-mall"
```

---

### Task 3: README 作品集化重构

**Files:**
- Modify: `README.md`（全文重构：重排为主，差异化既有内容保留）

**Interfaces:**
- Consumes: T2 全栈冒烟通过的事实；benchmark/README.md 实测数字（逐字核对：T=500 线程 avg 954/1345/1658ms）
- Produces: 招聘场景黄金一页 README

- [ ] **Step 1: 逐字核对压测数字**

Run: `grep -E "954|1345|1658" backend/benchmark/README.md`
Expected: 三数字均在实测矩阵行出现；README 落字与之完全一致（不一致则以 benchmark/README.md 为准修正）

- [ ] **Step 2: 重构 README.md**（结构按设计稿 §4.4）

全文骨架（保留既有「四种玩法=两种货源」核心洞察与演示账号节，重排为）：

```
# full-stack-mall 转卖商城
一句话定位（现有首段保留微调）

【技术亮点】（首屏，4 条 bullet，每条带证据链接）
· 秒杀三实现配置开关（optimistic/pessimistic/redis）+ 三实现×五档并发对照实验：
  T=500 线程 Redis 受理即返 avg 954ms vs DB 乐观锁 1345ms / 悲观锁 1658ms（实测矩阵→benchmark/README.md）
· Lua 预扣 + RabbitMQ 异步出单 + DLX 自动回补——取舍：最终一致，宁可少卖不超卖
· JWT + HttpOnly Cookie 鉴权闭环；PaymentProvider 抽象（FakeProvider→支付宝沙箱）
· 测试资产：后端 209 用例 + h5 142 用例 + 15 组压测对账存档（results/*-reconcile.txt）

【功能截图】（docs/screenshots/ 六张，T4 后嵌入——T3 先留占位路径）

## 快速开始
体验全栈（推荐，Docker 一键）：docker compose up -d --build → http://localhost:8080/
开发调试：cd backend && docker compose up -d（三件套）+ mvn spring-boot:run；前端 pnpm dev:gateway h5
种子重建提示：改 init.sql 后须 docker compose down -v（mysql entrypoint 仅空目录初始化——Review Focus #2）

## 演示账号（现有表格保留 + 补一行：perf001~perf500/admin123 为压测账号池，JMeter 对照实验用）

## 核心洞察（现有"四种玩法=两种货源"节下沉保留）

## 架构形态（现有 Mermaid 保留 + 补容器化拓扑：浏览器→web(nginx,:8080)→backend→mysql/redis/rabbitmq）

## 技术栈（现有表格 + 部署行：Docker Compose 全栈 / nginx envsubst / multi-stage JAR）

## 阶段路线（4/5 打 ✅ 填日期 2026-11-11）

## 深读索引
CHANGELOG.md · benchmark/README.md（压测三层证据链）· docs/superpowers/specs/（设计稿）· backend/benchmark/results/（对账存档）

## 目录结构（现有保留）
```

写作约束：不加 AI 协作痕迹；截图区 T3 先写占位 `<!-- T4 嵌入截图 -->` 与路径，T4 落图后 Edit 嵌入。

- [ ] **Step 3: 链接可达性自检**

Run: 逐一 `ls` README 中引用的相对路径（benchmark/README.md、CHANGELOG.md、backend/benchmark/results/；docs/screenshots/ T4 创建）
Expected: 全部存在（docs/screenshots/ 例外——T4 创建后闭合）

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): 作品集化重构——黄金一页技术亮点（4b 证据链摘要+链接）+ 全栈 quickstart"
```

---

### Task 4: 功能截图六张 + README 嵌入

**Files:**
- Create: `docs/screenshots/`（目录）+ 6 张 PNG
- Modify: `README.md`（截图区占位 → 实际嵌入）

**Interfaces:**
- Consumes: T2 全栈运行中（截图源）；chrome-devtools MCP（4c 验证过的通道）
- Produces: docs/screenshots/h5-home.png / h5-product-detail.png / h5-seckill.png / admin-home.png / admin-seckill.png / rabbitmq-console.png

- [ ] **Step 1: 临时映射 15672**

Run: 编辑根 compose 临时加 `ports: ["15672:15672"]` 到 mall-rabbit → `docker compose up -d mall-rabbit`
Expected: `curl -s -o /dev/null -w "%{http_code}" -u mall:mall http://localhost:15672/api/overview` → 200

- [ ] **Step 2: 逐张截取（浏览器 375 宽设备模式截 h5；桌面宽度截 admin/MQ）**

| 文件 | 操作路径 | Expected |
|---|---|---|
| h5-home.png | 8080/ → /h5/h5-mall 首页（商品列表真实种子） | 有商品卡片非空态 |
| h5-product-detail.png | 点进寄卖商品详情 | 有价格/库存 1/寄卖标识 |
| h5-seckill.png | 活动 18 下单后的"排队出单中…"或秒杀单收银台 | 体现 4b 受理语义（redis 策略下） |
| admin-home.png | 8080/admin/ 登录后首页 | Element Plus 布局 + 菜单 |
| admin-seckill.png | admin 秒杀活动管理列表 | 活动 18 在列 |
| rabbitmq-console.png | 15672 管理台 Queues 视图（mall:mall 登录） | seckill 队列/DLX 可见 |

截图存 `docs/screenshots/`（git 跟踪；单张 <500KB，超则压）

- [ ] **Step 3: 撤 15672 映射**

根 compose 移除临时 ports → `docker compose up -d mall-rabbit` 恢复仅容器网络

- [ ] **Step 4: README 嵌入截图**

Edit README.md 截图区占位 → 六张 `![]` 引用（相对路径 docs/screenshots/）+ 每张一句图注
Expected: README 在 GitHub 预览模式图片可渲染（相对路径以仓库根为基）

- [ ] **Step 5: Commit**

```bash
git add docs/screenshots/ README.md docker-compose.yml
git commit -m "docs(screenshots): 全栈实截六张（h5 买家链路/admin/RabbitMQ 管理台）入 README 截图区"
```

---

### Task 5: CHANGELOG 落字 + 终检

**Files:**
- Modify: `CHANGELOG.md`（Unreleased 顶部插阶段 5 块）

- [ ] **Step 1: CHANGELOG 条目**

插于 Unreleased 顶部（阶段 4b 块之前），格式：
```markdown
### 阶段 5：部署上线 + README 作品集化（2026-11-11）
#### 后端
- **应用本体容器化**：backend/Dockerfile（multi-stage：maven:3.9-eclipse-temurin-17 构建 → eclipse-temurin:17-jre-alpine 运行，非 root + busybox wget 健康检查 /api/mall/product/list）；构建不跑测试（209 用例本地门禁，镜像可复现由 frozen-lockfile + 锁定 base image 保障）
#### 部署
- **根目录全栈 compose**：docker compose up -d 一键起 web(nginx,:8080 唯一对外) + backend(JAR) + mysql/redis/rabbitmq；RabbitMQ mall/mall 用户替代 guest（loopback_users 禁远程）；教学密钥显式进 compose（生产必须改）；基础设施仅容器网络
- **nginx 根 302 → /h5/h5-mall**（favicon/portal 落地页保留）
#### 文档
- **README 作品集化**：黄金一页技术亮点区（4b 压测三层证据摘要 + 数字 + 取舍金句）+ 六张全栈实截截图（docs/screenshots/）+ 深读索引
```

- [ ] **Step 2: 终检清单**

1. `git status` 干净（设计稿/计划/ledger 按计划归属）
2. `git log --oneline -8` 确认 T1-T5 commit 链（chore(backend) Dockerfile → feat(deploy) compose → docs(readme) → docs(screenshots) → docs: CHANGELOG）
3. 全栈仍在跑：`docker compose ps` 五容器健康（截图后未误停）
4. 招聘视角 10 分钟演练：新窗口读 README → 快速开始一条命令 → 演示账号 → 深读索引点击路径全部可达
5. README 截图 GitHub 渲染路径正确（相对路径、大小写）

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: 阶段 5 CHANGELOG 落字（后端镜像化/全栈 compose/README 作品集化/实截六张）"
```

---

## 自审记录

- **Spec 覆盖**：设计稿 §4.1→T1、§4.2/§4.3→T2、§4.4→T3、§4.5→T4、§4.6 步骤 5→T5；§6 四条取舍全部落为 T1 Step 2（不跑测试）/T2 Step 2（密钥显式）/README 种子说明/T2 不暴露端口；§7 风险表 6 条映射 Review Focus #1/#2、T1 Step 5、T4 Step 1/3。
- **步骤扫描**：每步一个命令/一个文件操作 + Expected；无 TBD 行。
- **接口一致**：T1 Produces 镜像名 `mall-backend:prod` 与 T2 `image: mall-backend:prod` 一致；T2 `API_UPSTREAM: http://backend:18080` 与 T1 EXPOSE 18080 一致；T3/T4 截图路径 `docs/screenshots/` 一致。
- **Review Focus**：5 条均映射到步骤（#1→T2 Step 3 失败处理 + README FAQ 说明；#2→T3 Step 2 种子重建提示；#3→T2 Step 3 前置确认；#4→T2 Step 5 受理语义验证；#5→T5 Step 1 措辞 + README 不暗示生产可用默认值）。
