# 43 - Monorepo 结构与开发指引

> 本文档是 Monorepo 迁移（P0-P5）的落地说明与日常开发入口。
> 设计稿：`docs/superpowers/specs/2026-10-21-monorepo-migration-design.md`；
> 前期评估：`docs/42-Monorepo多应用改造评估.md`；治理硬约束：`CLAUDE.md` §2。

## 1. 总览

单应用 `src/` 已升级为 **pnpm workspace + turbo@2** 的 Monorepo：**6 个独立应用（apps/）+ 4 个共享包（packages/）**。每个 app 是完整可独立 dev/build/test 的 Vue 3 工程，共享代码全部经 `@vv/*` workspace 包消费（源码直链，不建 dist）。

```text
vue3-vite-project（pnpm workspace + turbo@2）
├── apps/
│   ├── admin   @vv-app/admin   端口 5174  中后台管理（主干业务：user/reports/workbench/error）
│   ├── auth    @vv-app/auth    端口 5179  统一登录（登录页 + 登出 + 跨应用重定向协议）
│   ├── portal  @vv-app/portal  端口 5176  门户企业官网（home + portal layout）
│   ├── h5      @vv-app/h5      端口 5177  H5 移动端（h5-demo + rem 适配）
│   ├── big     @vv-app/big     端口 5178  数据大屏（big-demo + scale 适配）
│   └── docs    @vv-app/docs    端口 5175  组件示例文档（demo 模块 + DemoDocs 布局）
├── packages/
│   ├── config  @vv/config      vite 工厂 createViteConfig（插件/别名/css/分包单点）
│   ├── mock    @vv/mock        vite-plugin-mock 数据源（原根 mock/ 职责）
│   ├── shared  @vv/shared      网络层基建 + 全局 store + useAppRouter/useRequest/useAuth/useDict
│   └── ui      @vv/ui          全局组件三目录 + 弹窗族（useDialog/useConfirm/useLogout）+ 图标/样式
├── scripts/                    工程脚本（check-routes / build-pages / build-prod / dev-gateway / node-gateway / new-module …）
├── deploy/                     生产 nginx 模板（nginx.prod.conf.template，envsubst 渲染 API_UPSTREAM）
├── Dockerfile                  生产多阶段镜像（build-prod 聚合 6 app → nginx:1.27-alpine）
├── docker-compose.prod.yml     生产编排（本地模拟/单机部署，注入 API_UPSTREAM）
└── .github/workflows/          ci.yml（turbo affected）+ deploy.yml（六应用聚合 Pages）
```

**依赖方向铁律**（CLAUDE.md §2.1）：`apps/* → packages/*`；包间 `config ∥ shared → mock → ui` 单向（mock 消费 shared 契约类型为 import type，无运行时依赖）；apps 互不依赖（跨 app 走整页跳转协议）；运行时依赖（vue/element-plus 等）一律 `peerDependencies` + `pnpm-workspace.yaml` catalog 单版本源。

## 2. 应用与包速查

| app    | dev 端口 | 依赖的 @vv 包                      | 说明                                             |
| ------ | -------- | ---------------------------------- | ------------------------------------------------ |
| admin  | 5174     | mock / shared / ui（+ config dev） | 默认 remote 菜单模式；`dev:local` 切本地         |
| docs   | 5175     | mock / shared / ui                 | 组件示例站，白名单含全部 Demo 前缀               |
| portal | 5176     | mock / shared / ui                 | `/home` 公开访问                                 |
| h5     | 5177     | mock / shared / ui                 | rem 适配仅转换本 app h5 前缀目录                 |
| big    | 5178     | mock / shared / ui                 | scale 适配，路由 `meta.bigScreen` 声明设计稿尺寸 |
| auth   | 5179     | mock / shared / ui                 | 登录接口 mock 必需（4 端点）                     |

端口 = 各 app `app.manifest.json` 的 `port` 字段（单源，P2 起），`strictPort: true`——端口占用直接报错不漂移（漂移会让网关路由表反代落空，排查困难）。

## 3. 常用命令

| 场景                                                                        | 命令                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 安装全 workspace 依赖                                                       | `pnpm install`                                                                                                |
| 全量 dev（⚠️ turbo 并行 6 app 有 mock 共享竞态 §9.3；日常首推 dev:gateway） | `pnpm dev`                                                                                                    |
| 单 app dev                                                                  | `pnpm -C apps/<a> dev`（`dev:local` = 本地菜单模式）                                                          |
| 同域网关 dev（6 app 带 base，见 §6）                                        | `pnpm dev:gateway`                                                                                            |
| 全量构建（turbo 拓扑序 + 类型门禁）                                         | `pnpm build`                                                                                                  |
| 全量单测（turbo，test 依赖 ^build）                                         | `pnpm test`                                                                                                   |
| 单 app 测试 / 覆盖率 / UI                                                   | `pnpm -C apps/admin test`、`test:coverage`、`test:ui`；根 `pnpm test:coverage` / `test:ui` 收容（admin 口径） |
| 类型检查                                                                    | `pnpm type-check`（turbo）/ `pnpm -C apps/<a> type-check:full`                                                |
| gh-pages 六应用聚合构建                                                     | `pnpm build:pages`（产物根 `dist/<app>/` + 落地页）                                                           |
| 生产六应用聚合构建                                                          | `pnpm build:prod`（`base=/<app>/` + history + remote 菜单 + 真实后端，产物根 `dist-prod/<app>/`，见 §7）      |
| 路由一致性（6 app 逐个校验）                                                | `pnpm check:routes`                                                                                           |
| alias 与 tsconfig paths 同步                                                | `pnpm generate:tsconfig-paths` / `pnpm check:aliases`                                                         |

新增业务模块：`pnpm new-module <kebab-name>`（默认生成到 `apps/admin/src/modules/<name>/`，`--app <a>` 指定其他 app，`--with-mock` 等选项见脚本头注）。脚本以 `import.meta.dirname` 定位仓库根，**在任意目录执行均可**，无须先 `cd` 进 app 目录。

## 4. 新增应用流程

> 属 CLAUDE.md §2.2 列管操作，**须先走 §2.4 修改申请获批**后执行。P2 起（2026-10-27）一键脚手架：

1. `pnpm new-app <kebab-name>`——预检（名称 / 目录不存在 / 端口 = 现有 manifest 最大 port + 1 自动分配跳网关 8080）全过才写盘，生成「可 dev/build/test 的最小公开应用」（公开 Home + 站内 404）。
2. `pnpm install` 锁 workspace 链接 → `pnpm -C apps/<name> dev` 起服务 → `pnpm check:routes`（脚本自动发现新 app）。

**app 元数据单源是各 app 的 `app.manifest.json`**（`{ name, port, requiredRoutes }`，JSON 无注释——字段说明见本节末尾表）。注册表（`scripts/apps-registry.mjs`）/ 网关路由表 / check-routes / eslint 边界规则均经 `packages/config` 的 `discoverAppManifests` **自动派生**，新增 app 零手改。dev/HMR 端口与 `VITE_APP_ID` 由 `createViteConfig` 读 manifest 注入——`vite.config.ts` 不再传 `appName`/`portOffset`。

| 字段             | 约束                                                           |
| ---------------- | -------------------------------------------------------------- |
| `name`           | kebab-case，必须等于 app 目录名                                |
| `port`           | 1-65535 整数，workspace 唯一，不与网关 8080 冲突               |
| `requiredRoutes` | 非空字符串数组，必须含 `NotFound`（系统兜底路由 B/C 校验名单） |

历史手动流程（脚手架落地前）：mkdir + package.json + vite.config + src 骨架 + env + 端口登记——已收敛为 `new-app` 模板，无特殊需求不要绕过。gh-pages 无需改脚本：`scripts/build-pages.ts` 自动发现含 `vite.config.ts` 的 app 目录并聚合部署。

## 5. 统一登录协议

**目标**：6 个 app 各自独立部署，但登录态（httpOnly cookie，见 README §3 user store 口径）在同一 origin 下漫游——生产形态为同域 path 部署（`/admin/`、`/auth/` …），dev 由 §6 网关复现。

**协议**（实现：`@vv/shared` 的 `redirect.ts` + 各 app 路由守卫）：

```text
1. 任一 app 守卫发现无会话（Session.get('auth') 缺失 / profile 401）
   → window.location.href = ${VITE_AUTH_ORIGIN}/login?redirect=<encodeURIComponent(当前完整 URL)>
   （跨 app 用整页跳转而非 router.push：各 app 无共享 router 实例）
2. auth 登录成功 → 校验 redirect 必须同域同源前缀（防开放重定向）→ location.href = redirect
   无 redirect 时按角色落 /admin 或 /portal
3. 登出（@vv/ui useLogout）→ 清会话 → ${VITE_AUTH_ORIGIN} 整页回跳
```

- `VITE_AUTH_ORIGIN` 由各 app `.env` 注入（生产缺省 `/auth`；子路径部署时按实际前缀改）；包内不硬编码 app 名。**例外：gh-pages 演示形态由 `scripts/build-pages.ts` 统一注入 `${REPO_PREFIX}/auth/#`**（`#` 尾巴承载 auth 的 hash 路由形态）——进程 env 优先于 `.env`，退出/未登录跳才能拼出 Pages 可接住的 `/<repo>/auth/#/login`（2026-10-30 修复，此前三条协议线全 404）。
- dev 下**统一登录全链路必须走 §6 网关（:8080）**——单 app 起服务（如只起 admin）时 `VITE_AUTH_ORIGIN` 指向的 `/auth` 无路由可达，未登录跳 `/auth/login` **404 属预期**。注意全量 `pnpm dev` 也不可用：各 app 独立端口（5174-5179），`/auth` 是相对路径，在 5174 上跳 `/auth/login` 仍是 5174 的 404，不会跨端口到达 auth（5179）。

## 6. 本地同域网关（node 一体化，pnpm dev:gateway）

复现生产「同域 path 部署」：零依赖 node 反向代理（`scripts/node-gateway.ts`，`node:http` 原生）监听 `:8080`，按路径前缀反代 6 个 vite dev server（上游 `127.0.0.1:5174-5179`），浏览器只访问 `localhost:8080`（同 origin），cookie 漫游与重定向协议和生产一致。

```bash
pnpm dev:gateway             # 全量：网关 + 6 app，Ctrl+C 一并退出
pnpm dev:gateway admin auth  # 子集模式（2026-10-27）：仅起指定 app——日常中后台开发
                             # 省一半启动时间与内存；同一入口地址（8080 同源），
                             # 根 302 跳子集第一个（未起 portal 时避免根落 502）
```

| 网关路径                        | 反代目标（127.0.0.1）                     |
| ------------------------------- | ----------------------------------------- |
| `http://localhost:8080/admin/`  | `:5174`                                   |
| `http://localhost:8080/docs/`   | `:5175`                                   |
| `http://localhost:8080/portal/` | `:5176`                                   |
| `http://localhost:8080/h5/`     | `:5177`                                   |
| `http://localhost:8080/big/`    | `:5178`                                   |
| `http://localhost:8080/auth/`   | `:5179`                                   |
| `http://localhost:8080/api/`    | `:5174`（admin mock 最全）                |
| `http://localhost:8080/mock/`   | `:5174`（mock 统一前缀，与 /api/ 同目标） |
| `http://localhost:8080/`        | 302 → `/portal/`（保留端口）              |

**三个关键语义**（实现见 `scripts/node-gateway.ts`）：

1. 前缀匹配 + 原样路径转发（`/admin/xxx` → 5174 的 `/admin/xxx`），与各 app dev 的 `VITE_BASE=/<app>/` 严格对齐；路由表由 `buildGatewayRoutes(apps-registry)` 单源代码派生，不存在静态配置第二事实源。
2. WS upgrade 透传（101 回写 + socket 双向 pipe）→ 任何 ws 场景经 8080 可用（注：`@vv/config` `server.hmr` 默认把 clientPort 固定到各 app 自身端口，HMR 流量实际多直连）。
3. 根路径 302 用原始 Host 头（含端口）；上游不可达 502；不设超时（SSE 流式与 HMR 长连接友好）。

**演进史**：原为 `docker compose up`（nginx:alpine 容器，:8080 → host.docker.internal），2026-10-26 起由 node 网关替代并删除——去除 Docker Desktop 依赖与宿主 IP 字面量维护坑；`check-gateway-conf` 校验随之删除，`validatePortWiring`（端口双写锁死）迁入 `check-routes`。

**验证**：`curl -I http://localhost:8080/admin/` 与 `http://localhost:8080/auth/login` 均 200（dev 起好后）。

**生产形态（2026-10-27 起）**：本地开发链路与生产部署链路分离——dev 走本节 node 网关（零依赖、单命令）；生产部署走根 `Dockerfile` + `docker-compose.prod.yml` + `deploy/nginx.prod.conf.template`（多阶段构建 6 app 产物至 `dist-prod/<app>/`，nginx 路径分发 + `/api/` envsubst 反代真实后端），路径语义与本节 dev 网关逐条对齐。详见 §7 与 README「生产 Docker 部署」。

## 7. CI/CD 与发布

- **ci.yml**：lint 根全仓一次；Build/Test 走 turbo——master push 全量（`turbo run build` 全量 + test **showroom 分级**排除 docs/big/h5 纯测试，构建保留全量由本网拦截），PR / develop push 走 affected（`--filter=[origin/master]...`，未变更 app 命中缓存或跳过）；turbo 本地缓存统一 `--cache-dir=.turbo` 并接 `actions/cache`；`check:routes` 保留。
- **deploy.yml**（push master 自动）：`pnpm build:pages` 自动发现 6 app，逐个 spawn 注入演示五开关（`VITE_BASE` 由脚本内 `REPO_PREFIX` 按 `/vue3-vite-project/<app>/` 注入；自定义域改脚本常量），产物聚合根 `dist/<app>/` + 落地导航页，整目录发 GitHub Pages。
- 顺序约束：turbo `build` 内含 `build-only`（unplugin 生成声明）→ `type-check:full`，CI 干净 checkout 下类型检查依赖 build 先生成声明，故不单独拆 type-check step。
- **生产 docker 部署**（`docker-compose.prod.yml`，非 CI 内置）：根 `Dockerfile` 多阶段（corepack pnpm → `pnpm build:prod` 聚合 6 app → `nginx:1.27-alpine`），`API_UPSTREAM` env 注入反代真实后端（SSE 关缓冲）；产物 `dist-prod/<app>/` 与 gh-pages 的 `dist/` 隔离；本地模拟 / 单机服务器均适用。路径语义与 §6 dev 网关逐条对齐（根 302 `/portal/`、`/<app>/` SPA fallback），详见 README「生产 Docker 部署」。

## 8. 治理约束速查

- workspace 结构 / 依赖方向 / 修改申请 / 写操作清单：**CLAUDE.md §2**（apps/packages Architecture Lockdown）
- 全局组件不要显式 import（@vv/ui 三目录自动注册）：CLAUDE.md §1.7
- AutoImport 标识符来源注释约定：CLAUDE.md §1.6.1
- 单 app 使用场景（模板受众只取一个 app）：取 `apps/admin` + `packages/*` 即可，包与 app 间仅 workspace 链接耦合
- **vue beta 警示（复用隐性地雷）**：`pnpm-workspace.yaml` 的 catalog 与 `overrides` **双钉精确值** `3.6.0-beta.17`（2026-10-28 C1 决策，原浮动 `beta` tag 已弃用——lockfile 缺席时克隆不可复现）——4 个包的全部开发 / 测试都跑在 Vue **beta** 上；包被其它 Vue3 工程复用（宿主用稳定版 vue）时兼容性**未经验证**，且包源码的宿主装配契约（auto-import / scss 注入 / dirs 扫描，见各包 README）也须一并复刻

## 9. 本地开发排障（高频 4 场景）

> **前置（网关相关场景）**：需 `pnpm dev:gateway` 在跑（一体化拉起 node 网关 :8080 + 6 dev server）。

### 9.1 dev 启动报 `Port 517X is already in use`

`@vv/config` 的 `SERVER_DEFAULTS.strictPort: true`（`packages/config/src/server.ts`）——端口被占用**直接报错退出，不会自动漂移**（漂移会让网关路由表反代落空，排查困难）。端口表：

| 端口 | 归属      | 端口 | 归属 |
| ---- | --------- | ---- | ---- |
| 5174 | admin     | 5177 | h5   |
| 5175 | docs      | 5178 | big  |
| 5176 | portal    | 5179 | auth |
| 8080 | node 网关 |      |      |

处置：先找到占用进程释放（Windows `netstat -ano | findstr 5174`，macOS/Linux `lsof -i:5174`）。确需换端口时改目标 app `app.manifest.json` 的 `port` 字段（单源）——`check:routes` 会校验 manifest 完整性（有 src 必有 manifest）；网关路由表由注册表自动派生，无需另改。

### 9.2 网关 502：`http://localhost:8080/admin/` 返回 Bad Gateway

上游 dev server 未就绪：node 网关的 502 只在对应 app 的 dev server 未启动 / 已崩溃时出现——先看 `dev:gateway` 终端该 app 是否打印「✓ 就绪」；已就绪仍 502 则查 `pnpm check:routes`（manifest 完整性 + 路由一致性）是否红。

### 9.3 mock 接口 404：`/mock/auth/login` 等返回 404

按序排查：

1. **网关模式**：确认请求地址是 `:8080` 而非具体 app 端口——`/mock/*` 与 `/api/*` 由 node 网关路由表统一反代到 admin（5174，其 mock 最全：auth/user/menu 三模块）；不经网关直连单 app 端口时，由各 app 自己的 vite-plugin-mock 处理（同一 `@vv/mock` 数据源，响应一致）
2. **mock 文件位置**：mock 已迁 `packages/mock/src/`（**不是**根 `mock/`）；新建 mock 文件要放进该目录（或被 viteMockServe 扫描到的约定目录）才会生效
3. **new-module 未带 `--with-mock`**：该选项可选，未传时只生成业务骨架、不生成 mock——接口自然 404，补一个 mock 文件即可
4. **并行 dev 的 mock 竞态（`pnpm dev` 偶发全部 mock 404）**：6 app 共享同一 `@vv/mock` 源码目录，turbo 并行起 dev 时 vite-plugin-mock 的 bundle-require 会对 `_*.bundled_*.mjs` 临时文件无容错 unlink，并发编译下互相抢删会让某 app 的 mockData 静默清空（接口返回 index.html / 404）。**已内置修复**：`@vv/config` 的 `cleanMockBundled` 插件带 5 秒 mtime 门槛（只删创建超 5s 的陈旧临时文件，在飞文件不碰）；若老分支复现，重启该 app dev 即可，升级 `packages/config` 后根治
5. **上次非正常关闭残留的 bundled 文件（dev:gateway 启动后全部 mock 404，2026-10-29 根治）**：vite-plugin-mock 的 `getMockConfig` glob 会匹配 mock 源目录下所有 ts/mjs/js 文件——上次 Ctrl+C 未跑 closeBundle / 启动中途被 tear down 留下的 `_*.bundled_*.mjs` 会被当成 mock 源打包，与启动清理竞态后 esbuild 解析已删文件 → 该 app mockData 静默清空（admin 挂 = 经网关的全部 mock 404，典型症状：登录接口 404）。**已内置修复**：`dev:gateway` orchestrator 启动任何 app 前无条件预清全部 bundled 临时文件（`cleanStaleMockBundled`，无 5s 门槛——此时无 dev server 在跑，删除绝对安全），有残留时启动首行打印「🧹 预清 N 个」；老分支应急：停全部 dev → `find packages/mock/src -name '_*.bundled_*' -delete` → 重启

### 9.4 HMR 失效：console 报 `[vite] failed to connect to websocket ... client:865`

经网关 dev 时，vite client 若把 ws 指向网关端口会握手失败（页面不热更）。**已内置修复**：`@vv/config` 工厂 `server.hmr` 段将 `port` / `clientPort` 固定为 app 自身端口（5174-5179），client 直连 vite 原生 ws 端点（与 `VITE_BASE=/<app>/` 的 hmrBase 匹配）。若仍报错，按序确认：

1. app 由 `pnpm dev:gateway` 启动（带 `VITE_BASE=/<app>/`）——直连单 app dev 时同样生效，可用它区分是网关问题还是 vite 自身问题
2. node 网关内置 WS upgrade 透传（`scripts/node-gateway.ts` proxyWebSocket），无需任何配置；若经 8080 的 ws 仍握手失败，看 `dev:gateway` 终端启动日志确认网关已在 :8080 监听
3. 浏览器代理 / 安全软件未拦截 5174-5179 的 websocket 连接
