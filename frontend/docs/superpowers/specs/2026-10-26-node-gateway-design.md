# node 网关替代 nginx/docker 本地同域网关 — 设计稿

> **日期**：2026-10-26 | **状态**：已批准（用户逐节确认） | **分支**：feature/monorepo
>
> **一句话**：本地开发同域网关从「docker compose + nginx 容器」替换为「零依赖 node 原生反向代理」，`pnpm dev:gateway` 单命令拉起 6 dev server + 网关，彻底去除 docker/nginx 依赖。

---

## 1. 背景 & 问题

Monorepo 6 应用（admin/docs/portal/h5/big/auth，端口 5174-5179）为复现生产「同域 path 部署 + 统一登录 cookie 跨 app 漫游」，在本地用 nginx 容器做反向聚合（`:8080` → 各 dev server，保留路径前缀）。现状痛点：

| 痛点 | 具体表现 |
|------|---------|
| 依赖重 | 需要 Docker Desktop 常驻 + `docker compose up` 第二个终端 |
| 平台坑 | nginx 在容器内反代宿主机，须用 Docker Desktop host-gateway IPv4 字面量（`192.168.65.254`），注释自述「宿主 IP 漂移要手改 6 处」 |
| 配置双写 | nginx.dev.conf 是静态配置无法 import `apps-registry.mjs`，靠 `check-gateway-conf.ts` 在 CI 校验两处一致（漂移只能事后发现） |
| 命令割裂 | 两个终端两条命令（`dev:gateway` + `docker compose up`），Ctrl+C 只退一边 |

## 2. 决策记录（用户已确认）

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 进程形态 | **一体化单命令**：`dev-gateway.ts` 内同时拉起网关 + 6 dev server，统一 shutdown |
| 2 | 实现选型 | **零依赖 node 原生**（`node:http` + `http.request` + `server.on('upgrade')`），不引入 http-proxy-middleware |
| 3 | docker 处置 | **全部删除**（docker-compose.yml / docker/nginx.dev.conf / check-gateway-conf 的 nginx 校验部分） |

零依赖选型理由：项目 engines 强制 node ≥22.18（原生能力足够）；`scripts/` 已有 `node --experimental-strip-types` 直跑先例，风格一致；网关路由仅 7 条规则，KISS；模板消费者零供应链成本。

## 3. 总体架构

```
pnpm dev:gateway（唯一命令，scripts/dev-gateway.ts）
  ├─ ① 起 node 网关 :8080（scripts/node-gateway.ts，node:http 原生）
  │     路由表从 scripts/apps-registry.mjs 单源代码派生
  ├─ ② 串行 spawn 6 dev server（现有逻辑原样保留：VITE_BASE=/<app>/ + waitForPort，
  │     防共享 @vv/mock 源并发编译竞态）
  └─ ③ 全就绪打印入口；任一 dev server 异常退出 / Ctrl+C → 进程树 + 网关一并关闭
```

**单源派生消灭双写**：nginx 版「静态 conf 无法 import 注册表」的漂移问题在结构上消失——路由表由 `buildGatewayRoutes(APPS)` 代码生成，注册表就是唯一事实。

## 4. 路由与转发语义（逐条对齐 nginx 版）

| 路径 | 行为 | 对齐点 |
|------|------|--------|
| `/<app>/` 前缀 ×6 | 原样路径转发 `127.0.0.1:<port>` | `proxy_pass` 不带 URI（保留前缀是 vite base 的生命线）；端口取注册表，不写死 |
| `/api/` | 转发 admin 端口（mock 最全：auth/user/menu 三模块） | 同 nginx；port 由 `APPS.find(name==='admin')` 派生 |
| `GET /`（精确） | 302 → `http://{Host}/portal/` | 对齐 `$http_host` 保留端口语义（曾踩过丢端口坑） |
| WS upgrade | 101 状态行+响应头回写 → head 透传 → socket 双向 pipe | vite HMR 经网关可用 |
| 上游不可达 | 502 + 友好提示 | 迁移期友好：提示「是否有旧 docker 网关未关（docker compose down）」 |
| 转发头 | Host 保留（浏览器原值）+ X-Real-IP / X-Forwarded-For(追加) / X-Forwarded-Proto | 对齐 nginx proxy_set_header 组 |
| 超时 | 不设 | SSE 流式（docs/13）与 HMR 长连接友好；node 流式转发无缓冲问题 |
| 匹配语义 | `pathname.startsWith(prefix)`，先命中先赢 | `/api/` 在 app 路由之外独立注册（无 app 名冲突） |
| 监听地址 | 默认 `0.0.0.0`（LAN 可达，与各 dev server 的 `server.host` 一致） | 真机调试（手机访问电脑 IP:8080）仍可用 |

**根路径 302 细节**：`Location` 用 `req.headers.host`（含端口，对齐 `$http_host`）；与 nginx 相同返回 302 非 307（浏览器对根路径 GET 语义不变）。

## 5. 文件变更清单

### 新增（2）

| 文件 | 职责 |
|------|------|
| `scripts/node-gateway.ts` | 网关模块：纯函数 `buildGatewayRoutes(apps)` / `resolveRoute(pathname, routes)` + `createGatewayServer(options): http.Server`（HTTP 转发 + WS upgrade + 302 + 502） |
| `scripts/node-gateway.spec.ts` | node:test 单测（node ≥22 内置 runner，零依赖）：路由表派生表驱动 + 集成 smoke（假上游 echo 验证 HTTP 转发 / 302 / 502 / WS echo 透传） |

### 修改（14）

| 文件 | 变更 |
|------|------|
| `scripts/dev-gateway.ts` | 集成网关：先监听 8080（EADDRINUSE 报清晰错误）→ 串行起 dev（现有逻辑）→ shutdown 时 `server.close()`；文件头注释重写 |
| `scripts/check-routes.ts` | `validateGatewayConf` 校验段删除（含打印块、import）；`validatePortWiring` 函数体从 check-gateway-conf.ts 迁入本文件内联；注释更新 |
| `scripts/apps-registry.mjs` | 头注第 4 处硬编码引用改写（nginx.dev.conf → 已消灭，路由表单源派生） |
| `package.json` | 删 `check:gateway-conf` script；新增 `test:gateway`（`node --test --experimental-strip-types scripts/node-gateway.spec.ts`） |
| `packages/config/src/server.ts` | `0.0.0.0` 绑定注释改写（不再为 docker 容器，保留理由改为 LAN 可达） |
| `playwright.config.ts` | 注释更新（gateway project 启动方式描述去 docker） |
| `tests/e2e/gateway/cross-app-roaming.spec.ts` | 注释更新（`docker compose up + pnpm dev:gateway` → `pnpm dev:gateway`）；逻辑零改动（已是可达性探测自跳过，且 fetch 跟随 302 与 nginx 行为一致） |
| `CLAUDE.md` | Commands 表（dev:gateway 描述、删 check:gateway-conf 行）；§2.1 拓扑表 #12 `docker/` 行改写；顶部 v3.0.2 变更记录 |
| `README.md` | 网关相关段落（§常用脚本 / §CI/CD / 最近更新） |
| `docs/43-Monorepo结构与开发指引.md` | 同域网关章节重写（node 版用法/原理） |
| `docs/04-构建与测试工具.md` | 命令表删 check:gateway-conf 行 |
| `docs/10-新手指引.md` | 涉及网关的两终端表述改单命令 |
| `apps/admin/src/router/config.ts` | 注释中的 docker 引用更新 |
| `CHANGELOG.md` | 「未发布」区新增条目 |

（README/CLAUDE.md 精确段落以实施时 Grep 为准。）

### 删除（4）

| 文件 | 原因 |
|------|------|
| `docker-compose.yml` | 网关容器编排，node 网关取代 |
| `docker/nginx.dev.conf` | 被 scripts/node-gateway.ts 取代 |
| `docker/` 目录 | 唯一文件删除后目录即空 |
| `scripts/check-gateway-conf.ts` | nginx 校验随 conf 删除；`validatePortWiring` 已迁入 check-routes.ts |

## 6. 明确不做（YAGNI / 范围外）

- **生产部署不动**：`docs/13` 的 prod nginx SSE 配置示例与本地 dev 网关无关，保留
- **历史文档不改写**：`docs/42` 评估稿、`docs/superpowers/` 历史 specs/plans——记录当时决策，不追改
- **vite `server.host: 0.0.0.0` 行为保留**：LAN 真机调试仍有价值，仅更新注释理由
- **不加 access log / 请求超时 / 重试**：本地 dev 工具，安静优先；SSE/HMR 长连接不设超时
- **不保留 docker 备选**：避免两套网关配置长期漂移（用户已确认）

## 7. 测试策略

| 层 | 内容 | 命令 |
|----|------|------|
| 单元（纯函数） | `buildGatewayRoutes`：6 app 路由 + /api/ → admin 端口 + 端口来自注册表；`resolveRoute`：前缀命中/未命中/先命中先赢/`/admin`（无尾斜杠）不命中 | `pnpm test:gateway` |
| 集成 smoke | 假上游（http echo + ws echo）经网关：GET 转发（路径/头/状态码透传）、POST body 透传、`GET /` 302（含端口）、未知前缀 404、上游未起 502、WS 双向 echo | 同上 |
| 路由门禁 | `validatePortWiring` 仍在 `pnpm check:routes` 内（CI 单点） | `pnpm check:routes` |
| E2E | `tests/e2e/gateway/cross-app-roaming.spec.ts` 逻辑零改动，真实链路回归留待实施后手动 | `pnpm test:e2e --project=gateway`（需 dev:gateway 在跑） |

技术细节：spec 用 `node:test` + `node:assert/strict`；WS client 用 node ≥22 内置全局 `WebSocket`；假上游 WS 用 `server.on('upgrade')` 手写 101 回显。`scripts/` 不在任何 app 的 vitest 配置内，turbo test 不会误扫（实施时验证）。

## 8. 验收标准（手动验证步骤）

1. `pnpm dev:gateway` 单命令启动：打印网关路由表 + 6 个「✓ 就绪」，无第二终端
2. `curl -I http://localhost:8080/` → 302，`Location: http://localhost:8080/portal/`
3. `http://localhost:8080/admin/` / `/auth/login` / `/docs/` / `/h5/h5-demo` / `/big/big-demo` 均可达（页面渲染非 502）
4. 登录态漫游：`/admin` 登录 → 整页跳 `/portal/` 无登录按钮（统一登录 cookie 同域生效）
5. HMR：改 `apps/admin` 任一 `.vue` 保存 → 浏览器无刷新热更新（WS 透传生效）
6. API mock：`curl http://localhost:8080/api/auth/login`（POST）非 404（/api/ 转发 admin 生效）
7. `pnpm check:routes` 绿（含迁入后的端口双写锁死）
8. `pnpm test:gateway` 绿
9. 回归：`pnpm type-check` 绿；`pnpm lint` 绿
10. `docker compose` 相关文件已不存在，`Grep docker|nginx` 剩余命中仅为 docs/13 生产示例与历史文档

## 9. 风险与回退

| 风险 | 缓解 |
|------|------|
| WS 转发边界情况（head 数据、半开连接） | spec 集成 smoke 覆盖 echo 全双工；HMR 手动验证兜底 |
| 8080 被旧 nginx 容器占用 | 网关启动 EADDRINUSE 错误消息附「docker compose down」提示 |
| 用户习惯两终端流程 | dev:gateway 单命令更简单；CHANGELOG/README 同步说明 |
| 回退 | git revert 本批次提交即可完全恢复 docker/nginx 方案（纯新增+删除，无 apps/packages 逻辑改动） |
