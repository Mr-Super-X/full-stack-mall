# pnpm dev 与 pnpm dev:local 模式对比

> 一份写给本项目开发者的"菜单加载模式"差异速查。回答两个问题：两个命令到底有什么不同？什么时候该用哪个？

---

## TL;DR

两个命令**在 app 脚本层**的唯一差异是一个环境变量 `VITE_MENU_SOURCE`，但它驱动了**完全不同的菜单加载路径**：

| 维度         | `pnpm dev`（remote 菜单） | `pnpm dev:local`（local 菜单）  |
| ------------ | ------------------------- | ------------------------------- |
| 菜单模式     | `remote`（默认）          | `local`                         |
| 菜单来源     | 后端 `/api/menu` 接口     | 本地 `routes/index.ts` 静态路由 |
| 是否需要后端 | **是**（无 mock 必失败）  | **否**                          |
| 适用阶段     | 联调真实后端 / 演示       | 离线开发 / 调试前端 / E2E       |

> 根命令语境：`pnpm dev` = `turbo run dev` 并行起 **6 个 app**（全部 remote 模式），`pnpm dev:local` = `pnpm -C apps/admin dev:local` 只起 **admin** 一个 app。下表对比的是菜单加载模式差异；app 形态差异见 docs/43。

切换命令一行：

```bash
pnpm dev          # 6 app 并行（remote，默认）
pnpm dev:local    # 只起 admin（local，无需后端联调）
```

---

## 1. 背景与问题

本项目作为中后台门户，菜单与路由的来源**有两条路径**：

- **真实生产**：后端按用户角色动态下发菜单，前端只负责渲染与权限收紧
- **前端开发**：开发者本地启动时往往没有后端，或者只想专注前端逻辑

如果不区分这两种场景，要么开发者**每次启动都依赖后端**（体验差），要么前端代码**永远走不到生产路径**（隐患大）。

解决方案：用一个开关 `VITE_MENU_SOURCE` 切换菜单加载模式，命令层封装为 `dev` / `dev:local`，让开发者无感切换。

---

## 2. 核心机制

### 2.1 script 定义

```jsonc
// 根 package.json:8-9（workspace 编排层——dev 起 6 app，dev:local 只起 admin）
"dev":       "turbo run dev",
"dev:local": "pnpm -C apps/admin dev:local",

// apps/admin/package.json（vite 直跑形态只存在于 app 级）
"dev":       "vite",
"dev:local": "cross-env VITE_MENU_SOURCE=local vite"
```

app 级两个脚本**都跑同一个 `vite` 命令**，差异仅在 `cross-env` 是否注入 `VITE_MENU_SOURCE=local`（`cross-env` 用于跨平台兼容 Windows 的 cmd / PowerShell / Git Bash）。

### 2.2 配置解析

```ts
// apps/admin/src/router/config.ts:22-28
function resolveMenuSource(): MenuSource {
  const raw = import.meta.env.VITE_MENU_SOURCE
  if (raw === 'remote' || raw === 'local') return raw
  // 默认：remote（贴近生产，强制走接口；本地无 mock 时启动会失败）
  return 'remote'
}
```

- 未设置 → `'remote'`（贴近生产）
- 非法值（如拼错 `'reomte'`）→ **静默 fallback 到 `'remote'`**（无 console 报错）

`ROUTER_CONFIG.source` 在启动时冻结为常量（`as const`），后续模块通过 `import { ROUTER_CONFIG }` 读取，不再重新解析 env。

### 2.3 分叉点

```ts
// apps/admin/src/router/guards/remote-menu.ts:56
export async function ensureRemoteMenuLoaded(to, userStore, routerStore, router) {
  if (ROUTER_CONFIG.source !== 'remote') return null // ← 唯一分叉点
  // ... 后续 remote 流程
}
```

`pnpm dev:local` 在这一行直接 `return null`，**完全跳过**接口调用、Zod 校验、`router.addRoute()` 等所有远程菜单相关逻辑。

---

## 3. pnpm dev 的核心能力（remote 模式）

### 3.1 完整流程

```text
登录成功
  ↓
auth.ts 守卫拦截
  ↓
ensureRemoteMenuLoaded()  ── ROUTER_CONFIG.source === 'remote'
  ↓
fetchRemoteRoutes()
  ├─ withRetry(() => menuApi.getMenu({ timeout: 5000 }), {
  │      retries: 2, baseDelay: 300 })   ← 自动重试 + 指数退避
  └─ validateAndConvertMenu(raw)
       ├─ Zod 校验整体数组（递归 lazy，含 children）
       ├─ 单项校验失败 → 跳过该项，其他保留（容错优先）
       └─ convertMenu → convertItem
            ├─ COMPONENT_REGISTRY 查 component loader
            ├─ 后端 hidden:true → 转 meta.visible:false（双轨收紧）
            └─ 返回 RouteRecordRaw
  ↓
router 注入
  ├─ 同名路由 → Object.assign 合并 meta（不动 children 结构）
  └─ 独家路由 → router.addRoute()
  ↓
{ path: to.fullPath, replace: true }  ← 重新触发守卫
```

### 3.2 能力清单

| 能力                      | 实现位置                                        | 说明                                 |
| ------------------------- | ----------------------------------------------- | ------------------------------------ |
| 按角色动态菜单            | `menuApi.getMenu()` → 后端按权限过滤            | 不同账号看到不同菜单                 |
| 网络故障自动重试          | `withRetry`（packages/shared/src/api/retry.ts） | 指数退避，最多 3 次                  |
| 单次超时控制              | `{ timeout: 5000 }`                             | 5s 超时                              |
| 运行时安全                | Zod schema 校验（含递归 children）              | 后端返回结构异常时容错               |
| 优雅降级                  | `validateAndConvertMenu` 返回 `[]`              | 守卫 fallback 到 local，console.warn |
| 菜单不可见 → 路由不可访问 | `hidden:true` → `visible:false` 转换            | 守卫跳 `/404`                        |
| 登录周期管理              | `dynamicLoaded` + `currentAuthState`            | 同一登录态只拉一次；切账号自动重置   |
| 开发反馈                  | `showBadge('Router · 远程菜单', ...)`           | 浏览器右下角 GitHub 风格徽章         |

### 3.3 失败场景行为

| 场景                       | 行为                                               |
| -------------------------- | -------------------------------------------------- |
| 后端服务挂了               | console.warn + 徽章"0 个 · fallback"，菜单用 local |
| 后端返回 `[]`              | 同上（warning 文案"接口失败或返回空"）             |
| 后端返回非数组             | Zod 校验失败 → 逐项校验兜底                        |
| 后端 item 中 `name` 未注册 | `convertItem` 跳过 + warn                          |
| 后端 `hidden:true`         | 转 `meta.visible:false` → 守卫跳 404               |

---

## 4. pnpm dev:local 的核心能力（local 模式）

### 4.1 完整流程

```text
启动应用
  ↓
apps/admin/src/router/auto-register.ts: 本地路由单一事实源
  ├─ 扫描 routes/index.ts + 各业务模块 routes/
  └─ 导出 COMPONENT_REGISTRY（name → component loader）
  ↓
routes/index.ts: 静态路由结构（业务模块根 + layout + children）
  ↓
守卫拦截：ensureRemoteMenuLoaded → 立即 return null  ← 完全跳过
  ↓
layout 内渲染：从 router.getRoutes() 派生菜单树
  └─ buildMenuTree(router)  ← apps/admin/src/layouts/default/config/menu.ts:117
       ├─ 过滤：visible !== false && requiresAuth !== false
       ├─ 过滤：白名单（Login/Forbidden/NotFound/ServerError）
       ├─ 过滤：动态段路径（:param / catch-all）
       └─ 递归构建 MenuNode（path 解析为绝对路径）
```

### 4.2 能力清单

| 能力           | 实现位置                                       | 说明                                  |
| -------------- | ---------------------------------------------- | ------------------------------------- |
| 零后端依赖     | remote 守卫直接 return null                    | 不发任何 `/api/menu` 请求             |
| 本地单一事实源 | `apps/admin/src/router/auto-register.ts`       | 路由结构 = 菜单结构（同一份 TS 代码） |
| 离线开发       | 不依赖 vite-plugin-mock                        | 没配 mock 也能跑                      |
| 菜单实时可见   | `buildMenuTree(router)` 直接读 vue-router 实例 | 改 routes/index.ts → 刷新即生效       |
| 编译期类型安全 | routes/index.ts 是 TS 写                       | 路由结构错改立刻类型报错              |
| 启动零等待     | 无接口调用                                     | 0ms 加载延迟                          |

### 4.3 适用场景

- 本地离线开发——后端未起 / 未联调
- 前端样式 / 交互调试——只需看菜单渲染
- 新模块脚手架——`pnpm new-module` 加新模块后立即看路由生效
- CI / E2E 测试环境——`pnpm test:e2e` 用 local 模式跑
- 演示 / 截图——菜单是写死的，截图稳定

---

## 5. 详细对照

### 5.1 行为对比

| 维度               | `pnpm dev`                          | `pnpm dev:local`        |
| ------------------ | ----------------------------------- | ----------------------- |
| 启动失败风险       | **高**（无后端必失败）              | **零**                  |
| 首次登录等待       | 5000ms 超时 + 2 次重试（最坏 ~10s） | 0ms（同步）             |
| 菜单数据源         | 后端实时                            | 本地 routes             |
| 不同账号菜单差异   | **有**（后端按权限过滤）            | **无**（所有人相同）    |
| 后端菜单权限收紧   | 即时生效（接口返回）                | 不生效（需改 routes）   |
| 新增业务模块可见性 | 需后端配菜单 + 前端 routes          | 改 routes/index.ts 即可 |

### 5.2 优先级陷阱（重要）

`cross-env` 注入的进程环境变量 **优先级高于** `.env` 文件：

```text
cross-env 注入 (VITE_MENU_SOURCE=local)   ← 优先级最高
  └─ 即便 .env.development 里写 remote 也会被覆盖
```

> 启动 `pnpm dev:local` 后再 `export VITE_MENU_SOURCE=remote` **无效**（cross-env 已覆盖 process.env）。

### 5.3 等价命令对照

以下三组命令**运行时行为完全一致**：

```bash
# 组 1：local 模式
pnpm dev:local
cross-env VITE_MENU_SOURCE=local pnpm dev

# 组 2：remote 模式（默认）
pnpm dev
# 等价于 .env.development 没设 VITE_MENU_SOURCE 时
```

---

## 6. 相关环境变量：VITE_USE_MOCK

> 新手常把 `VITE_MENU_SOURCE` 和 `VITE_USE_MOCK` 混用，但它们是**完全正交**（互不依赖）的两个开关，控制链路中不同环节。

### 6.1 一句话区分

- `VITE_MENU_SOURCE`：**菜单从哪来？**（`local` 本地静态 vs `remote` 后端接口）
- `VITE_USE_MOCK`：**HTTP 请求被谁拦截？**（`true` vite-plugin-mock 拦截 vs `false` 直连真实后端）

### 6.2 核心差异

| 维度         | `VITE_MENU_SOURCE`                                 | `VITE_USE_MOCK`                                                                                                         |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 解决的问题   | "菜单从哪来？"                                     | "HTTP 请求被谁拦截？"                                                                                                   |
| 作用域       | 仅 `/api/menu` 一个接口                            | **所有** `/api/*` 接口                                                                                                  |
| 读取时机     | 客户端运行时（`import.meta.env`）                  | 构建期（`process.env`）                                                                                                 |
| 读取位置     | `apps/admin/src/router/config.ts`（已打入 bundle） | `@vv/config` 工厂 `packages/config/src/create-vite-config.ts`（vite 启动时）                                            |
| 消费方       | `apps/admin/src/router/guards/remote-menu.ts` 守卫 | `vite-plugin-mock`（dev 阶段中间件）                                                                                    |
| 生效阶段     | 运行时（应用代码逻辑分支）                         | 构建期（中间件是否挂载）                                                                                                |
| 默认值       | `remote`（未设/非法→静默 fallback）                | `true`（`undefined !== 'false'` 判定为开）                                                                              |
| 典型值       | `local` / `remote`                                 | `true` / `false`                                                                                                        |
| 关联命令     | `pnpm dev:local`（cross-env 注入）                 | 无专属命令，需在 `.env.development` 设置                                                                                |
| 生产构建影响 | 有（代码分支逻辑）                                 | 常规构建**无**（tree-shake）；`true` 时经 `mockProdServer.ts` client 侧接线（gh-pages 演示，见 docs/22 §15 与 docs/40） |

### 6.3 读取时机详解

| 阶段       | `VITE_MENU_SOURCE`                    | `VITE_USE_MOCK`     |
| ---------- | ------------------------------------- | ------------------- |
| vite 启动  | ❌ 未读                               | ✅ 读取并挂载中间件 |
| 应用初始化 | ✅ 已打入 bundle（`import.meta.env`） | ❌ 不再读取         |
| 运行时     | ✅ 浏览器中可读                       | ❌ 不参与运行时     |

> ⚠️ 因此**不能用** `process.env.VITE_MENU_SOURCE` 在 `@vv/config` 工厂（`packages/config/src/create-vite-config.ts`）里读（虽然能读到），因为应用代码读到的是另一份。两边必须保持一致地"信任" dotenv 加载顺序。

### 6.4 4 种正交组合

两个开关互不依赖，可任意搭配形成 4 种场景：

| 场景                                 | `VITE_MENU_SOURCE` | `VITE_USE_MOCK` | 行为                                                        |
| ------------------------------------ | ------------------ | --------------- | ----------------------------------------------------------- |
| **真实联调**（连真后端）             | `remote`           | `false`         | `/api/menu` 走真实后端；其他接口也走真实后端                |
| **dev 默认**（离线但要 remote 逻辑） | `remote`           | `true`（默认）  | `/api/menu` 由 `mock/menu.ts` 拦截返回；其他接口也都走 mock |
| **完全离线前端**                     | `local`            | `true`          | 守卫直接 return null，不调 `/api/menu`；其他接口仍走 mock   |
| **纯前端 / CI**                      | `local`            | `false`         | 不调任何菜单接口；其他接口也走真实后端（可能 404）          |

> **关键洞察**：`pnpm dev:local` 命令**只设了 `VITE_MENU_SOURCE=local`**，没动 `VITE_USE_MOCK`。因此默认情况下 `pnpm dev:local` 仍然是**菜单走本地 + 其他接口走 mock** 的混合模式。

### 6.5 默认值与 fallback 行为

`VITE_MENU_SOURCE` 的静默 fallback：

```ts
if (raw === 'remote' || raw === 'local') return raw
return 'remote' // 未设/拼错/空串/任意非法值 → 静默 fallback
```

→ 拼错 `VITE_MENU_SOURCE=reomte` 不会报错，会以 `remote` 模式启动 → 菜单加载失败时排查极易踩坑（参见 `docs/07-路由模块设计.md:758`）。

`VITE_USE_MOCK` 的"默认开"：

```ts
enable: process.env.VITE_USE_MOCK !== 'false'
```

→ 未设置时 `undefined !== 'false'` 为 `true` → mock **默认开**。要让 mock 关闭必须**显式**设 `VITE_USE_MOCK=false`（反直觉设计：默认开 ≠ 默认关）。

### 6.6 与命令的绑定

| 命令             | `VITE_MENU_SOURCE`     | `VITE_USE_MOCK`             |
| ---------------- | ---------------------- | --------------------------- |
| `pnpm dev`       | 未设 → `remote`        | 未设 → `true`               |
| `pnpm dev:local` | `'local'`（cross-env） | 未设 → `true`               |
| `pnpm build`     | 未设 → `remote`        | `vite-plugin-mock` 自身禁用 |
| `pnpm preview`   | 未设 → `remote`        | `vite-plugin-mock` 自身禁用 |

注意：**没有** `dev:no-mock` 之类的命令。要在 dev 时关闭 mock，必须经 **shell env**：`VITE_USE_MOCK=false VITE_API_BASE_URL=<真后端 URL> pnpm -C apps/<a> dev`（dev 中间件开关读 `process.env`，`.env` 文件对该键无效——2026-10-28 口径修正，详见 README §环境变量表）。

---

## 7. 选型决策

| 场景                           | 推荐命令                                                  |
| ------------------------------ | --------------------------------------------------------- |
| 联调真实后端 / 验证权限收紧    | `pnpm dev`（可加 `VITE_USE_MOCK=false`）                  |
| 后端未起 / 离线开发 / 调试样式 | `pnpm dev:local`                                          |
| E2E 测试 / CI 环境             | `pnpm dev:local`（避免 mock 服务依赖）                    |
| 给后端同事演示菜单权限         | `pnpm dev`                                                |
| 排查"菜单加载失败"问题         | 先 `pnpm dev:local` 排除前端逻辑 → 再切 `pnpm dev` 看接口 |

---

## 8. 手动验证步骤

1. **验证 remote 模式生效**：启动 `pnpm dev`，打开浏览器 console，应看到 `Router · 远程菜单` 徽章（注入路由计数）
2. **验证 local 模式生效**：启动 `pnpm dev:local`，console **不应**出现该徽章，且**不发起** `/api/menu` 请求（DevTools Network 面板验证）
3. **验证 `.env` 优先级**：在 `.env.development` 写 `VITE_MENU_SOURCE=local`，跑 `pnpm dev`，应与 `pnpm dev:local` 行为一致
4. **验证 fallback**：故意把 `VITE_API_BASE_URL` 指向不存在的后端，跑 `pnpm dev`，应看到 console.warn + 徽章"0 个 · fallback"，菜单仍可见（用 local）
5. **验证 mock 拦截**：跑 `pnpm dev`，DevTools Network 面板应看到 `/api/auth/login`、`/api/menu` 等被 vite-plugin-mock 拦截（response 来源是 mock/*.ts）
6. **验证 mock 关闭**：shell env 前置 `VITE_USE_MOCK=false VITE_API_BASE_URL=<真后端>` 跑 `pnpm dev`，DevTools 应看到所有请求直连真后端（该开关读 `process.env`，写 `.env` 无效）

---

## 9. 相关代码与文档

| 路径                                            | 职责                                                          |
| ----------------------------------------------- | ------------------------------------------------------------- |
| 各 app `package.json` 的 `dev` / `dev:local`    | script 定义                                                   |
| `packages/shared/src/types/env.d.ts`            | `VITE_MENU_SOURCE` / `VITE_USE_MOCK` 类型声明（共享单源）     |
| `apps/admin/src/router/config.ts`               | `resolveMenuSource()` 解析                                    |
| `packages/config/src/create-vite-config.ts`     | `viteMockServe` 中间件（读取 `process.env.VITE_USE_MOCK`）    |
| `apps/admin/src/router/remote.ts`               | `fetchRemoteRoutes` + Zod 校验 + `convertMenu`                |
| `apps/admin/src/router/guards/remote-menu.ts`   | 模式分叉点（`if source !== 'remote' return null`）            |
| `packages/shared/src/api/modules/menu.ts`       | `menuApi.getMenu` 接口定义                                    |
| `apps/admin/src/layouts/default/config/menu.ts` | `buildMenuTree` 从 router 派生菜单树（local 模式核心）        |
| `apps/admin/src/router/auto-register.ts`        | 本地路由注册（local 模式的"单一事实源"）                      |
| `packages/mock/src/*.ts`                        | `vite-plugin-mock` 数据源（auth/menu/dict/user/pro-table 等） |
| `docs/07-路由模块设计.md` §107-114              | 路由菜单模式详细机制                                          |
| `docs/22-mock使用规范.md` §257-277              | vite-plugin-mock 配置详解                                     |
| `docs/23-权限设计.md` §588                      | 权限矩阵（按命令维度）                                        |
| `docs/04-构建与测试工具.md` §612                | 工具链表格（dev / dev:local 命令对照）                        |
| `README.md` §574-575                            | 环境变量表                                                    |

---

**文档版本**：v1.1.0 | **生成日期**：2026-09-20 | **新增**：§6 `VITE_USE_MOCK` 对比章节（解释与 `VITE_MENU_SOURCE` 的正交关系）
