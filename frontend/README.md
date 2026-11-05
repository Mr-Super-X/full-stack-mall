# vue3-vite-project · 四栖工程底座

[![CI](https://github.com/Mr-Super-X/vue3-vite-project/actions/workflows/ci.yml/badge.svg)](https://github.com/Mr-Super-X/vue3-vite-project/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![demo](https://img.shields.io/badge/demo-GitHub_Pages-brightgreen)](https://mr-super-x.github.io/vue3-vite-project/)

**简体中文** | [English](./README.en.md)

对内中后台 + 对外门户 + H5 移动端 + 数据大屏，一套代码四种面板。Feature-Sliced 风格，模块独立开发，不依赖后端即可联调。

> 📌 **仓库定位**（2026-10-28 裁决，[docs/45](docs/45-仓库定位声明.md)）：单人维护的 opinionated 工程底座——**代码公开供参考、demo 在线可玩，不承诺模板级支持**（无 npm 包发布 / 无社区运营）。欢迎 fork 与借鉴，issue 可提但响应不保证。

> 🆕 **新同事请先看 [docs/10-新手指引.md](docs/10-新手指引.md)** —— 30 分钟 5 任务，带你从 clone 到提交首个 PR。
>
> **最近更新**：2026-11-02 — **docs/49 样式分层架构规范落地 + 端级样式骨架全端就位**，详见 [CHANGELOG.md](CHANGELOG.md)：
>
> - **docs/49 新增**：样式分层架构规范（五层分层 + monorepo 映射 / tokens 与 EP 变量源-镜像立场 / EP 覆盖三级形态 / z-index 分层强约束 / L5 豁免登记）；CLAUDE.md §3 互链
> - **端级样式层骨架**：6 app 各建 `src/styles/{index,tokens,ui-overwrite}.scss` + main.ts 统一接线（公共 → 端级层次入口可见）；h5 vant 主题覆盖归位 `src/styles/ui-overwrite.scss`；`pnpm new-app` 脚手架自带同构骨架
>
> **2026-10-30 更新** — **docs/46-48 收录 + commit message 零 AI 痕迹三层防线**：
>
> - **docs/48 新增**：单应用模式与 Monorepo 多应用能力对比（17 章双版对比 + src/ 全目录归属映射 + 选型建议）；README 文档表同步收录 docs/45-48
> - **commit-msg 防线**（CLAUDE.md §4 #16）：`.claude/settings.json` attribution 空配置（机制层根治尾注注入）+ `scripts/check-commit-msg.sh` husky 宽拦（Co-Authored-By trailer / AI 署名全拦）+ commitlint——开源门面 commit history 零 AI 协作痕迹
>
> **2026-10-28 更新** — **三批次架构演进**（可复用性 / 契约单源 / 脚手架，全部真实验证通过）：
>
> - **P0 共享包自包含**：`packages/*` 生产源码全量显式 import——AutoImport 隐式注入只停留在最终宿主（apps/*），可复用包不再要求消费方「懂隐式契约」；新增本地 ESLint 规则 `local/package-contract`（依赖声明 + `@vv/*` 方向铁律机械检查）；详见 CLAUDE.md §1.6.3
> - **P1 API 契约单源**：`@vv/shared` auth `login`/`fetchProfile` 同址 zod schema（`.passthrough()` 前向兼容）+ `requestValidated`——TS 类型与运行时校验同源，mock 保持 `import type` 零运行时依赖；security-reviewer 审查通过（可合并）
> - **P2 应用 manifest 单源**：各 app `app.manifest.json`（`name/port/requiredRoutes`）单源；`createViteConfig` 删 `appName/portOffset` 改读 manifest；`apps-registry.mjs` 自动派生（dev-gateway/网关/Playwright/ESLint/check-routes 五消费方零改动）；新增 **`pnpm new-app <name>`** 一键生成可 dev/build/test 的最小公开应用（新增 app 零手改注册表/CI）
>
> **本轮更新**（2026-10-28）— **可插拔版本检测插件**（生产页面资源更新检测）：
>
> - **双机制检测**：`@vv/shared` `versionCheck` runtime 插件（轮询 `version.json` 比对 buildId + `ChunkLoadError` 兜底监听，零 UI 依赖、回调注入通知）+ `@vv/config` `version-check-vite` 构建插件（`closeBundle` 生成 `version.json`，buildId 支持 `VITE_BUILD_ID` 注入 git sha 可追溯）；`createAppPlugins` / `createViteConfig` 工厂默认装配，6 app 零改动拥有检测能力，使用规范见 [docs/44](docs/44-版本检测插件使用规范.md)
>
> **上轮更新**（2026-10-27）— **生产 Docker 部署链路落地**（本地开发 node 网关 / 生产部署 docker+nginx 分离）：
>
> - **生产 Docker 部署**：根 `Dockerfile`（多阶段：corepack pnpm → `pnpm build:prod` 聚合 6 app → `nginx:1.27-alpine`）+ `docker-compose.prod.yml`（唯一环境变量 `API_UPSTREAM` 经 envsubst 渲染反代真实后端，SSE 关缓冲）；`pnpm build:prod` 生产聚合构建（`base=/<app>/` + history + remote 菜单 + `VITE_USE_MOCK=false`）；路径语义与 dev 网关逐条对齐（`/` → 302 `/portal/`），详见下方「生产 Docker 部署」节
> - **六应用四包结构**（[docs/43-Monorepo结构与开发指引.md](docs/43-Monorepo结构与开发指引.md)，评估 [docs/42](docs/42-Monorepo多应用改造评估.md)）：`apps/admin`（中后台）/ `apps/auth`（统一登录）/ `apps/portal`（门户）/ `apps/h5`（移动端）/ `apps/big`（数据大屏）/ `apps/docs`（组件示例文档）+ `packages/config|mock|shared|ui` 共享包（源码直链 workspace 消费）
> - **统一登录协议**：未登录守卫整页跳 `/auth/login?redirect=...`（`VITE_AUTH_ORIGIN` env 注入），cookie 同域漫游；本地经 node 网关 :8080 复现（`pnpm dev:gateway` 一体化单命令，零 docker 依赖）
> - **CI/CD 改造**：ci.yml 走 turbo affected（PR 只构建变更波及 app，`.turbo` 缓存上 actions/cache）；deploy.yml 走 `pnpm build:pages` 六应用聚合发布 gh-pages（落地页 + 6 子目录）
>
> 上轮同步（2026-10-20）：门户企业官网 + gh-pages 一键部署 + 团队级图标体系，详见 [CHANGELOG.md](CHANGELOG.md)。
>
> 上轮同步（2026-10-15）：四栖能力 + 开源首发准备——v2.1 big 大屏布局、v2.0 h5 移动端布局、/autoplan 多视角审查 15 项落地、组件渲染层测试 14 例，详见 [CHANGELOG.md](CHANGELOG.md)。
> 上轮同步（2026-09-20）：全代码库审计 9 项修复 + 3 项误判，详见 [CHANGELOG.md](CHANGELOG.md)。
> 上轮同步（2026-09-17）：docs/11 useDict v2 多 code 契约、docs/27 §8.5 useConfirm、docs/10 §3.7 命令式弹窗、docs/26 组件级杀手锏、docs/32 §3 错位路径、docs/04 测试覆盖；详见 [CHANGELOG.md](CHANGELOG.md)。

---

## 📋 项目简介

基于 Vue 3 + Vite 8 + TypeScript 6 的 **Monorepo 多应用工程底座**（pnpm workspace + turbo）：一套代码仓拆为 **6 个独立应用 + 4 个共享包**，统一登录、独立构建、源码直链消费。

> 🔀 **单应用 or Monorepo？** 对构建体积不敏感、页面量小、追求快速开发部署 → 选**单应用版**（`release/single` 分支）；项目大页面多、对构建体积敏感 → 选 **Monorepo 多应用版**（`release/monorepo` 分支）。详细对比见 [docs/48](docs/48-单应用模式与Monorepo多应用能力对比.md)。

| 应用          | 入口（dev 端口）     | 能力                                                                                                                       |
| ------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/admin`  | `/workbench`（5174） | 中后台管理：default layout（侧栏+顶栏+多页签）+ user/reports/workbench 业务（[docs/07](docs/07-路由模块设计.md)）          |
| `apps/portal` | `/home`（5176）      | 门户企业官网：portal layout（顶部锚点导航），白名单公开访问                                                                |
| `apps/h5`     | `/h5-demo`（5177）   | H5 移动端：h5 layout + rem 适配（[docs/34](docs/34-H5布局与rem适配.md)）                                                   |
| `apps/big`    | `/big-demo`（5178）  | 数据大屏：big layout + scale 适配（[docs/35](docs/35-大屏布局与scale适配.md)）                                             |
| `apps/docs`   | `/demo`（5175）      | 组件示例文档：demo 模块全量 + DemoDocs 布局                                                                                |
| `apps/auth`   | `/login`（5179）     | 统一登录：跨应用重定向协议入口（登录/登出），其余应用未登录守卫整页跳此（[docs/43](docs/43-Monorepo结构与开发指引.md) §5） |

4 个共享包（`packages/config|mock|shared|ui`）经 workspace `workspace:*` 源码直链消费，不建 dist。结构详见 [docs/43](docs/43-Monorepo结构与开发指引.md)。⚠️ 复用注意：workspace `overrides` 把 vue 钉在 **beta**，且包依赖宿主装配契约（见各包 README「宿主装配契约」）——**本仓库不自荐外部复用**（无 npm 包发布，[docs/45](docs/45-仓库定位声明.md)），fork 借鉴时需一并知会宿主装配契约（[docs/43](docs/43-Monorepo结构与开发指引.md) §8）。

开源 MIT，版本策略与 fork 升级见 [docs/36](docs/36-Fork升级与版本策略.md)。

**设计原则**：

- **模块独立**：每个业务模块可独立开发、独立测试、独立部署
- **状态清晰**：全局 vs 模块状态边界明确，无交叉依赖
- **防御性 UI**：每个异步组件显式处理 Loading / Error / Empty
- **可 Mock**：不启动后端即可完整跑通业务流程
- **可扩展**：CSS / 状态 / UI 库都不锁定单一方案

---

## 🛠️ 技术栈

| 维度         | 选型                        | 版本                                                                                                  |
| ------------ | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| 核心框架     | Vue                         | catalog + overrides 双精确钉版 3.6.0-beta.17（2027-01-31 前回稳定线，版本单源见 pnpm-workspace.yaml） |
| 构建工具     | Vite                        | ^8.0.16                                                                                               |
| 语言         | TypeScript                  | ~6.0.0（strict 模式）                                                                                 |
| 包管理器     | pnpm                        | >=11.x（workspace + catalog 单版本源）                                                                |
| 编排构建     | Turborepo                   | ^2.11（`turbo run build/test` 拓扑序；CI 走 affected 只构建变更波及 app）                             |
| Node 要求    | -                           | >=22.18 或 >=24.12                                                                                    |
| UI 组件库    | Element Plus                | ^2.14.3                                                                                               |
| 原子化 CSS   | UnoCSS                      | ^66.7.5（兼容 SCSS/LESS/原生 CSS）                                                                    |
| 状态管理     | Pinia                       | ^3.0.4                                                                                                |
| 表格组件     | vxe-table                   | ^4.21.7（ProTable 双引擎：Element Plus / vxe-table 二选一，v3.5 起 Element Plus 为默认）              |
| 图表库       | ECharts                     | ^6.1.0（BaseChart 容器 + 主题/自适应，docs/28）                                                       |
| H5 组件库    | Vant                        | ^4.10.2（apps/h5 移动端 UI）                                                                          |
| 运行时校验   | zod                         | ^4.4.3（`requestValidated` 契约单源，docs/14）                                                        |
| 路由         | Vue Router                  | ^5.1.0                                                                                                |
| 国际化       | Vue I18n                    | ^11.4.6                                                                                               |
| 网络层       | Axios                       | ^1.18.1                                                                                               |
| 浏览器基线   | normalize.css               | ^8.0.1                                                                                                |
| 日期工具     | dayjs                       | ^1.11.21                                                                                              |
| API Mock     | vite-plugin-mock            | ^3.0.2                                                                                                |
| Cookie 工具  | js-cookie                   | ^3.0.8（仅非敏感偏好场景预留；凭证走 httpOnly cookie，JS 不可读写，严禁用其存 token）                 |
| 测试框架     | Vitest                      | ^4.1.9 + @vue/test-utils + jsdom                                                                      |
| 图标体系     | unplugin-icons              | ^24.0.0 + @iconify-json/ep + @iconify-json/tabler（编译期内联 SVG，见 docs/39）                       |
| Pinia 持久化 | pinia-plugin-persistedstate | ^4.7.1（仅 store 字段 pick 持久化）                                                                   |

---

## 🏗️ 架构设计

### 1. Feature-Sliced 风格 + 共享包分层（Monorepo）

```
共享包（packages/*，源码直链 workspace 消费）   应用内 Feature-Sliced（apps/*/src/）
├── @vv/config    vite 工厂 createViteConfig      ├── modules/<m>/（业务模块，独立自治）
├── @vv/mock      vite-plugin-mock 数据源          │   ├── views/ + routes/index.ts（自动注册）
├── @vv/shared    网络基建 + store + composables    │   └── components/ + store/ + apis/
│   ├── store/modules/（app/user/theme/dict barrel）├── layouts/（路由级布局，随 app）
│   ├── composables/（useAppRouter/useRequest/...）├── router/ + plugins/ + directives/
│   ├── router-guards/（守卫骨架 + isWhiteListed） └── 全局层 api/utils/enums/types/locales
│   ├── api/（http/cache/retry/token-refresh）         经别名指回 @vv/shared / @vv/ui
│   └── locales/ + directives/ + utils/ + enums/
└── @vv/ui       全局组件 + 弹窗族 composables
    ├── components/{common,ProTable,form-schema}/
    ├── composables/（useDialog/useConfirm/useLogout）
    └── assets/（icons + styles + bem）
```

> **分层范式**：共享逻辑下沉 `packages/*`（跨 app 复用），各 app `src/` 只保留模块/布局/路由/插件等 app 私有内容，全局层（api/utils/store/...）经别名 `@api`/`@utils`/`@store` 等指回共享包源码（单一来源 `@vv/config` 的 `createAppAliases`）。详见 [docs/43](docs/43-Monorepo结构与开发指引.md)。

### 2. 依赖方向铁律（Monorepo 边界，ESLint error 级强制）

| 方向                    | 允许                                                             | 禁止                                 |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `apps/*` → `packages/*` | ✅ workspace `workspace:*` 包名                                  | —                                    |
| `packages/*` 之间       | ✅ config 独立；shared 上游，mock/ui 并列下游（均只依赖 shared） | 反向依赖                             |
| `packages/*` → `apps/*` | —                                                                | ❌ app 私有别名/路径                 |
| `apps/<a>` → `apps/<b>` | —                                                                | ❌ 跨应用 import（走统一登录整页跳） |
| app 内 `modules/<m>`    | 本模块内 + 共享包                                                | 其他模块内部                         |

> 跨应用通信不 import，走统一登录协议整页跳转（[docs/43](docs/43-Monorepo结构与开发指引.md) §5）；ESLint `no-restricted-imports` 4 组规则 error 级兜底（P5-A 落地）。

### 3. 状态管理分层

- **共享 store**（`packages/shared/src/store/`，barrel 导出）：仅跨 app 复用
  - `app` / `user` / `theme` / `dict`（httpOnly cookie 会话模式，profile/permissions 内存态；persist key 带 `VITE_APP_ID` 前缀防同域多 app 串台）
  - 各 app 经 `export * from '@vv/shared/store'` re-export 消费
- **app 私有 store**：归 `apps/<a>/src/store/modules/`（如 admin `tags-view` 多页签），业务状态不污染共享层
- **Pinia Setup Store 风格** + `pinia-plugin-persistedstate` 仅 `pick` 字段持久化

### 4. 防御性 UI 三态

每个异步组件必须显式处理：

```vue
<AsyncState :loading="loading" :error="error" :is-empty="isEmpty" @retry="execute">
  <UserTable :rows="data ?? []" />
</AsyncState>
```

`useRequest` composable 自动提供 `{ data, loading, error, isEmpty, execute }` 三态封装。

### 5. 错误处理全局兜底（plugins/errorHandler 插件）

- **统一接管 3 类错误**：Vue 组件错误 / window 全局 JS 错误 / 未捕获 Promise 拒绝
- **dev/prod 智能**：`logToConsole` 默认 dev=true / prod=false
- **Sentry 扩展点**：`report(error, { source, extra })` 回调，生产环境对接日志服务
- **API 错误**（HTTP 状态码）：拦截器归一化 ApiError 并发错误事件（2026-10-27 事件化改造）——401 跳登录由续期链负责；业务错误（4xx/500/业务码）toast 兜底；网络级错误（0/502/503/504）聚合为全局 NetworkBanner 横幅节流去重；探测请求 `silent` 全程静默

```ts
// main.ts
import Plugins from '@plugins'
app.use(Plugins, {
  errorHandler: {
    report: (error, ctx) => Sentry.captureException(error, { tags: ctx }),
  },
})
```

---

## 🎯 目录设计原则

### 为什么按 Feature-Sliced 组织？

传统前端按技术层切分（`components/` `views/` `stores/` `api/`），导致**一个功能模块的代码散落在 4-5 个目录**——找东西要跳转多次、改动要跨目录、删除模块要清理多个文件夹。

Feature-Sliced 按**业务模块**切分，每个模块的页面、组件、状态、接口都在**同一个目录**里：

```
传统切分（按技术）            Feature-Sliced（按业务）
components/  ← Button.vue     modules/auth/
views/      ← Login.vue        ├── views/Login.vue
stores/     ← user.ts          ├── components/LoginForm.vue
api/        ← auth.ts          ├── store/index.ts
utils/      ← validate.ts      └── routes/index.ts（自动注册）
           ↑
         散落 4 处              ↑ 集中 1 处
```

### 这样组织带来什么好处？

#### 1. 模块高度内聚

- **改一个模块的所有改动集中在一个目录** → Code Review 看一个目录就懂全貌
- **删除模块 = 删除一个目录**（无残留）
- **新人接手** = 看 `modules/<m>/` 就能理解该业务的完整结构

#### 2. 依赖方向严格单向

```
       ┌─────────────────────────┐
       │      modules/            │  ← 业务模块（最高层）
       └──────────┬──────────────┘
                  ↓ 只能本模块向下
       ┌─────────────────────────┐
       │  components/common/      │  ← 通用组件
       │  api/  utils/  enums/    │
       │  directives/  plugins/   │  ← 模块化基础设施
       └──────────┬──────────────┘
                  ↓
       ┌─────────────────────────┐
       │  composables/  types/   │  ← 框架无关基础设施
       └─────────────────────────┘
```

**禁止规则**：

- `components/common/` / `directives/` / `plugins/` **不引用**任何 `modules/` 内容
- `modules/<m>/` **不直接 import** 其他 `modules/<m>/` 内部
- 模块间通信**只能**通过 `modules/<m>/index.ts` 暴露的对外接口

#### 3. 全局/模块双层状态管理

| 层       | 路径                          | 放什么                                                                                                                                                 | 不放什么        |
| -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 共享     | `packages/shared/src/store/`  | 跨 app 复用（barrel 导出）：`app`（UI 偏好）、`user`（登录态）、`theme`（主题）、`dict`（字典缓存）；admin 私有 `tags-view` 归 `apps/admin/src/store/` | 任何业务状态    |
| app 私有 | `apps/<a>/src/store/modules/` | 业务状态：列表筛选、表单临时态、详情缓存                                                                                                               | 跨 app 共享数据 |

#### 4. 技术栈替换零侵入

目录边界限定了每个技术决策的影响范围：

| 想做的事                      | 改的位置                                                                                 | 业务模块影响                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| Pinia → Redux                 | `packages/shared/src/store/`                                                             | 零（业务模块不直接 import 全局 store 内部）  |
| Element Plus → Ant Design Vue | `packages/ui/src/components/common/` + 各 app `main.ts`                                  | 零（业务模块只用 `common/` 封装）            |
| Axios → Fetch                 | `packages/shared/src/api/http.ts`                                                        | 零（业务模块只调 `api/modules/*.ts`）        |
| UnoCSS → Tailwind             | `uno.config.ts` + 全局样式                                                               | 零                                           |
| Vite 8 配置拆分               | `packages/config/src/*`（aliases/vendor-chunks/scss/server/proxy/postcss，工厂单点装配） | 各 app vite.config.ts 保持轻量入口（数十行） |
| v-inputDebounce 自定义实现    | `packages/shared/src/directives/_utils.ts`                                               | 零（业务模块只通过 v-inputDebounce 用）      |

#### 5. 并行开发友好

- 不同成员负责不同模块，几乎无 merge conflict
- 模块 owner 边界清晰（PR 审查范围一目了然）
- 离职交接 = 移交一个目录

#### 6. 测试边界清晰（与目录一一对应）

- **工具级单测**：`utils/dayjs.spec.ts`、`utils/storage.spec.ts`
- **Hook 测试**：`composables/useRequest.spec.ts`
- **组件级单测**：`components/common/AsyncState.spec.ts`
- **集成测测**：`components/global-plugin.spec.ts`、`router/auto-register.spec.ts`

---

## 📂 目录结构

```
vue3-vite-project/            # pnpm workspace + turbo@2（Monorepo）
├── apps/                     # 6 个独立应用（各自 dev/build/test 完整工程）
│   ├── admin/                # 中后台管理（端口 5174）：user/reports/workbench 主干业务
│   │                         # （错误页由共享层 packages/shared/src/router/fallback.ts 承载）
│   ├── auth/                 # 统一登录（端口 5179）：登录页 + 登出 + 跨应用重定向协议
│   ├── portal/               # 门户企业官网（端口 5176）：home + portal layout
│   ├── h5/                   # H5 移动端（端口 5177）：h5-demo + rem 适配
│   ├── big/                  # 数据大屏（端口 5178）：big-demo + scale 适配
│   └── docs/                 # 组件示例文档（端口 5175）：demo 模块 + DemoDocs 布局
│       └── src/              # app 私有：App.vue/main.ts + layouts/modules/plugins/router/store/views/styles
│                             # （styles/ = 端级样式骨架三件套，docs/49 §5；docs 无 layouts、big 无 plugins；
│                             #  全局层 api/utils/store/... 全在 packages/*）
├── packages/                 # 4 个共享包（workspace:* 源码直链消费，不建 dist）
│   ├── config/               # @vv/config：vite 工厂 createViteConfig（插件/别名/css/分包单点）
│   ├── mock/                 # @vv/mock：vite-plugin-mock 数据源
│   ├── shared/               # @vv/shared：网络层基建 + 全局 store + useAppRouter/useRequest/useAuth/useDict
│   └── ui/                   # @vv/ui：全局组件三目录 + 弹窗族（useDialog/useConfirm/useLogout）+ 图标/样式
├── scripts/                  # 工程脚本（check-routes/check-aliases/build-pages/dev-gateway/node-gateway/new-module…）
├── docs/                     # 项目规范文档（本文档体系）
├── .github/workflows/        # ci.yml（turbo affected）+ deploy.yml（build:pages 六应用聚合）
└── 配置文件                  # package.json / turbo.json / pnpm-workspace.yaml / eslint.config.mjs / tsconfig*.json
```

> 依赖方向铁律（CLAUDE.md §2.1）：`apps/* → packages/*`；包间 config 独立、shared 上游，mock/ui 并列下游（均只依赖 shared，单向）；apps 互不依赖（跨 app 走统一登录整页跳转协议，见 docs/43 §5）。单 app 使用场景只需取 `apps/admin` + `packages/*`。

---

## 🚀 开发指南

**常见任务速查**：

| 我要…                                   | 看这里                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 30 分钟跑通项目                         | [docs/10-新手指引.md](docs/10-新手指引.md)                                                                        |
| 新增业务模块                            | `pnpm new-module <kebab-name>` → [docs/07](docs/07-路由模块设计.md) §新增路由流程                                 |
| 做中后台表格/表单页                     | [docs/29-ProTable使用指南.md](docs/29-ProTable使用指南.md) / [docs/24-XForm使用指南.md](docs/24-XForm使用指南.md) |
| 加 H5 移动页面                          | [docs/34-H5布局与rem适配.md](docs/34-H5布局与rem适配.md) §1 快速上手                                              |
| 加大屏 / 拼接屏页面                     | [docs/35-大屏布局与scale适配.md](docs/35-大屏布局与scale适配.md) §5 接入步骤                                      |
| 发版 / fork 后跟进上游                  | [docs/36-Fork升级与版本策略.md](docs/36-Fork升级与版本策略.md)                                                    |
| 判断代码归属（utils/composable/store…） | [docs/18-代码组织决策表.md](docs/18-代码组织决策表.md) §2 决策矩阵                                                |

### 环境要求

| 工具    | 版本要求           |
| ------- | ------------------ |
| Node.js | >=22.18 或 >=24.12 |
| pnpm    | >=11.x 且 <13.x    |

### 快速开始

```bash
# 1. 克隆项目
git clone <your-repo-url> vue3-vite-project
cd vue3-vite-project

# 2. 安装依赖（postinstall 自动生成 admin 的 IDE 类型声明，约数秒属预期）
pnpm install

# 3. 免登录演示开关：取消 apps/admin/.env 末尾 `# VITE_DEMO_NO_AUTH=true` 的注释
#    （文件已在仓库内，自带引导行，取消注释即生效）

# 4. 启动开发服务器（新人推荐第一条；全量并行见下方进阶）
pnpm -C apps/admin dev
# 然后打开 http://localhost:5174 → 免登录直达 /workbench

# 进阶：全量 dev（turbo 并行 6 个 app，remote 菜单模式，端口 5174-5179；
# ⚠️ 6 app 共享 @vv/mock 源码，turbo 并行编译存在已知竞态，首推下方 dev:gateway）
pnpm dev
```

> **单 app dev 的 404 预期**：登录是跨应用特性（登录页在 `apps/auth`，admin 内已无 `/login` 路由）。`pnpm -C apps/admin dev`（local 菜单模式）只起 admin（5174），未登录时守卫整页跳 `/auth/login` 会 **404**（auth 是独立端口 5179 的 app，`VITE_AUTH_ORIGIN=/auth` 相对路径跨端口不可达）——属预期，配 `VITE_DEMO_NO_AUTH=true` 即免登录直达。按场景选访问路径：

| 场景                                      | 命令                                                                               | 访问                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 只改 admin 业务（免登录）                 | `pnpm -C apps/admin dev` + 取消 `apps/admin/.env` 中 `VITE_DEMO_NO_AUTH=true` 注释 | `localhost:5174/` → /workbench                                         |
| 测统一登录跨应用漫游                      | `pnpm dev:gateway`                                                                 | `localhost:8080/admin/`（未登录自动跳 `:8080/auth/login`，登录后回跳） |
| 单 app 独立调试（docs/portal 等公开应用） | `pnpm -C apps/<a> dev`                                                             | `localhost:<port>/`（docs 5175 等，白名单公开无需登录）                |

> 统一登录全链路必须经同域网关 `:8080`（node 网关按 path 前缀分流到对应 app）；详见 [docs/43](docs/43-Monorepo结构与开发指引.md) §5/§6 与 §9 排障。

### 常用脚本

> 完整定义见 `package.json:scripts`，本表是常用命令速查（按使用频率排序）。

| 命令                               | 用途                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm dev`                         | 全量 dev（turbo 并行 6 个 app，remote 菜单模式；admin 含 vite-plugin-vue-devtools）                                                  |
| `pnpm -C apps/<a> dev`             | 单 app dev（如 `pnpm -C apps/admin dev`；`dev:local` 切本地菜单模式）                                                                |
| `pnpm dev:gateway`                 | 同域网关 dev（单命令）：node 网关 :8080 + 6 app 以 `VITE_BASE=/<app>/` 串行起（见 docs/43 §6）                                       |
| `pnpm dev:gateway admin auth`      | 子集模式（2026-10-27）：网关 + 仅起指定 app——日常中后台开发省一半启动时间与内存；根 302 跳子集第一个（防 502）                       |
| `pnpm build`                       | 全量生产构建（turbo 拓扑序；各 app 内 `build-only` 生成声明 → `type-check:full` 全量门禁）                                           |
| `pnpm -C apps/<a> build-only`      | 单 app 仅 `vite build`（不含类型校验；调试构建产物用）                                                                               |
| `pnpm -C apps/<a> preview`         | 预览单 app 构建产物（本地起静态服务）                                                                                                |
| `pnpm build:pages`                 | gh-pages 六应用聚合构建（自动发现 `apps/*`，产物根 `dist/<app>/` + 落地导航页）                                                      |
| `pnpm build:prod`                  | 生产六应用聚合构建（`base=/<app>/` + history + remote 菜单 + 真实后端，产物根 `dist-prod/<app>/`，见部署节）                         |
| `pnpm analyze`                     | 生产构建 + 生成包体积分析报告（`dist/stats.html`，admin 口径）                                                                       |
| `pnpm test`                        | 全量单元测试（turbo 拓扑序，test 任务依赖上游 build）                                                                                |
| `pnpm -C apps/<a> test [path]`     | 单 app / 单文件测试（如 `pnpm -C apps/admin test src/utils/dayjs.spec.ts`；watch 模式 `pnpm -C apps/<a> test:watch`）                |
| `pnpm test:coverage`               | 测试覆盖率报告（含 HTML 报告，输出 `coverage/`；admin 口径）                                                                         |
| `pnpm test:ui`                     | 单元测试 UI 模式（Vitest UI 可视化；admin 口径）                                                                                     |
| `pnpm test:e2e`                    | Playwright 端到端测试（关键用户流程）                                                                                                |
| `pnpm test:e2e:install`            | 安装 Playwright 浏览器依赖（chromium + --with-deps）                                                                                 |
| `pnpm bench`                       | 跑基准测试（vitest bench，记录每次性能数据，admin 口径）                                                                             |
| `pnpm type-check`                  | TypeScript 类型检查（turbo 各 app `vue-tsc --build` 增量）                                                                           |
| `pnpm -C apps/<a> type-check:full` | TypeScript 类型检查（强制重建 .tsbuildinfo 缓存；单 app build 内第二步）                                                             |
| `pnpm check:routes`                | 路由一致性校验：whitelist ⊆ 实现 / 系统兜底 ⊆ whitelist / 注册表反向等 5 校验 + manifest 完整性收尾（pre-commit 强制 + CI 阶段强制） |
| `pnpm check:aliases`               | alias 单一来源（`packages/config/src/app-aliases.ts`）与 tsconfig paths 一致性校验（pre-commit 强制 + CI 阶段强制）                  |
| `pnpm check:mock-wiring`           | mock 双接线一致性校验（mock 源文件清单 × 各 app prodServer 手动 import，CI 阶段强制）                                                |
| `pnpm test:gateway`                | 网关单测（node:test，HTTP 转发 / WS 透传 / 302 / 404 / 502 smoke，node-gateway 12 + dev-gateway 6 共 18 用例）                       |
| `pnpm check:doc-currency`          | 文档与代码硬数据一致性校验（14 项锁定：13 项硬数据 + docs 文档数预算；CI 阶段强制）                                                  |
| `pnpm test:check-scripts`          | check 系脚本自证 spec（check-mock-wiring / check-routes / check-doc-currency / generate-tsconfig-paths / new-module；CI 阶段强制）   |
| `pnpm test:eslint-rules`           | 本地 ESLint 规则自证 spec（`local/package-contract`；CI 阶段强制）                                                                   |
| `pnpm generate:tsconfig-paths`     | 从 `packages/config/src/app-aliases.ts` 自动同步到各 app `tsconfig.app.json`（一致性由 `pnpm check:aliases` 校验守护，非钩子自动）   |
| `pnpm new-module <name>`           | 一键生成业务模块骨架（kebab-case 名 → 6 个骨架文件）                                                                                 |
| `pnpm new-app <name>`              | 一键生成可 dev/build/test 的最小公开 app（元数据单源 `app.manifest.json`，注册表/网关/ESLint 自动派生零手改）                        |
| `pnpm remove-module <name>`        | 一键移除业务模块（默认 dry-run + y/N 确认；CI / 管道传 `--force`）                                                                   |
| `pnpm lint`                        | ESLint 检查全项目                                                                                                                    |
| `pnpm lint:fix`                    | ESLint 自动修复                                                                                                                      |
| `pnpm format`                      | Prettier 格式化全项目                                                                                                                |
| `pnpm format:check`                | Prettier 检查（不修改；CI 用）                                                                                                       |
| `pnpm commit`                      | 交互式 commit（仅提交不推送）                                                                                                        |
| `pnpm push`                        | **推荐**：一站式提交并推送（add + cz + push）                                                                                        |
| `pnpm release`                     | **发布版本**：bump + CHANGELOG + tag + push（master/release/*）                                                                      |
| `pnpm release:dry`                 | 发布预览：dry-run 模式（0 副作用，任意分支）                                                                                         |

### Mock 数据

开发模式默认启用 vite-plugin-mock（由 `@vv/config` 工厂在 config 期按 `process.env.VITE_USE_MOCK !== 'false'` 控制——**shell env 生效、`.env` 无效**；用户 clone 后未建 `.env.development` 时默认开，与原行为一致），`packages/mock/src/` 目录按文件自动扫描（dev 模式不受 `packages/mock/src/index.ts` 聚合清单限制）：

| 模块         | 接口                                                                                | 默认账号       |
| ------------ | ----------------------------------------------------------------------------------- | -------------- |
| auth         | `/mock/auth/login`、`/mock/auth/profile`、`/mock/auth/logout`、`/mock/auth/refresh` | admin / 123456 |
| user         | `/mock/user/list`、`/mock/user/:id`                                                 | -              |
| menu（远程） | `/mock/menu`（远程菜单，remote 模式守卫调用）                                       | -              |
| dict         | `/mock/dict/:code`（字典，配合 `useDict`，见 docs/11）                              | -              |
| stream       | `/mock/ai/chat/stream`（SSE 流式，仅 dev 可用——prod mockjs 不拦 fetch，见 docs/13） | -              |
| pro-table/   | 11 个具名导出 `xxxRequestApi`（ProTable 直连数据源，无 XHR 依赖，pro 环境同样可用） | -              |

> `/mock/menu`（远程菜单）在 remote 模式下由守卫调用。已内置 mock（Home / UserList + Reports 隐藏菜单），无需额外配置即可跑通端到端流程。

**生产构建的 mock 接线（2026-10-20 新增）**：vite-plugin-mock@3.0.2 为纯 dev-server 插件（2.9.x 的 `prodEnabled` 已移除），`packages/mock/src/mockProdServer.ts` 通过 client 侧 `createProdMockServer` 手动接线 4 个模块（2 个 data 直引 menu/user + 2 组内联 prod 版 auth/dict）。挂接条件 `import.meta.env.PROD && VITE_USE_MOCK==='true'`（各 app `main.ts`，如 `apps/admin/src/main.ts`），常规生产构建整分支 tree-shake。配套 `VITE_DEMO_NO_AUTH=true` 演示模式：守卫跳过登录/权限校验，演示账号 Admin（admin/123456）全链路可点（gh-pages 线上 demo 方案）。**挂接时序硬约束**：必须在 `createApp` 后、`app.use(router)` 前 `await setupProdMockServer()`——router install 即触发初始导航，晚于 use 则守卫请求穿透拦截窗口。详见 [docs/22-mock使用规范.md](docs/22-mock使用规范.md) §15。

常规生产构建（`VITE_USE_MOCK` 未设或非 `'true'`）不启用 mock；联调真实后端时同时设 `VITE_USE_MOCK=false` + shell env `VITE_API_BASE_URL=<真实后端 URL>`（shell env 优先级最高，见下表），并使用 `pnpm build && pnpm preview` 验证生产路径。菜单加载方式仍由 `VITE_MENU_SOURCE` 控制。

### 路由架构（自动注册）

业务模块的路由**无需在 `apps/<a>/src/router/` 任何文件中手动 import**——在 `apps/<a>/src/modules/<feature>/routes/index.ts` 声明后，`auto-register.ts` 通过 Vite `import.meta.glob` 自动扫描并注册（每 app 独立扫描自身 `src/modules/**`）。

#### Layout 速选（先决定用哪个）

| Layout       | 组件（admin 内，其余 app 随迁各自 layout）        | 视觉特征                                                 | 适用场景                                 |
| ------------ | ------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| **default**  | `apps/admin/src/layouts/default/index.vue`        | 左侧 Sidebar + 顶 Header + TagsView                      | 业务页（首页 / 列表 / 表单）             |
| **blank**    | `apps/auth/src/layouts/blank/index.vue`           | 居中、无侧栏无顶栏                                       | 登录页 / 注册页 / 第三方回调（auth app） |
| **portal**   | `apps/portal/src/layouts/portal/index.vue`        | 顶部导航 + 内容区（无侧栏）                              | 门户 / 对外展示 / 公开站点首页           |
| **h5**       | `apps/h5/src/layouts/h5/index.vue`                | 移动端 rem 适配面板（宽屏限 540px 居中）                 | H5 移动端页面                            |
| **big**      | `apps/big/src/layouts/big/index.vue`              | 大屏 scale 等比缩放居中（meta.bigScreen 声明设计稿尺寸） | 数据大屏 / 拼接屏（1920/2560/4K/9000px） |
| **DemoDocs** | `apps/docs/src/modules/demo/layouts/DemoDocs.vue` | 组件示例文档站点（侧边导航 + demo 渲染区）               | docs app 组件示例文档专用                |

> ✅ Sidebar 菜单渲染已在 v3 实现：从 `router.getRoutes()` 自动派生 + 多级递归 + i18n + 折叠态联动。各 layout 已随 P3 抽离迁往对应 app（portal/h5/big），admin 仅留 default。新业务模块的菜单只需按 `modules/<m>/routes/index.ts` 声明路由即自动出现。布局随 app 归属见 [docs/43](docs/43-Monorepo结构与开发指引.md)。

#### 新增业务模块的 3 步流程（以 admin 为例，`pnpm new-module order` 一键生成骨架）

```ts
// 1. 写视图组件 apps/admin/src/modules/order/views/List.vue
<template><div>订单列表</div></template>

// 2. 声明路由 apps/admin/src/modules/order/routes/index.ts
const routes: RouteRecordRaw[] = [
  {
    path: '/order',
    component: () => import('@/layouts/default/index.vue'),  // ← 选 default（admin 内）
    children: [
      {
        path: 'list',
        name: 'OrderList',
        component: () => import('../views/List.vue'),
        meta: { title: '订单管理', icon: 'list', requiresAuth: true, permissions: ['order:view'] },
      },
    ],
  },
]

// 3. 完成 —— 路由自动可用（auto-register 扫描 routes/index.ts）
//    新增 app 用 pnpm new-module <name> --app <app>；其余 app 流程同形
```

#### 创建 blank layout 页面（auth app 登录页）

```ts
// auth 应用内（apps/auth/src/modules/auth/routes/index.ts）
{
  path: '/login',
  component: () => import('@/layouts/blank/index.vue'),  // ← auth app 的 blank
  children: [{
    path: '',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录', requiresAuth: false },
  }],
}
// 别忘了 apps/auth/src/router/whitelist.ts 加 'Login'
```

#### 自检

新增路由后跑 `pnpm check:routes` 自动验证 6 个应用的一致性（whitelist ⊆ 声明 / 双向 name 一致 / 系统路由必在白名单）。

> **更多模板**（动态参数 `:id` / 多级菜单嵌套 / i18n titleKey / v-auth 双层防护 / keepAlive / breadcrumb）：见 [`docs/07-路由模块设计.md`](docs/07-路由模块设计.md) §「新增路由的标准流程」。

> **默认菜单模式**：admin dev = `remote`（贴近生产，需 mock 接口），`pnpm -C apps/admin dev:local` 切到 `local`（无需接口）。
> **白名单**：跳过登录 + 权限校验，按**路由 name** 匹配（各 app 自己的 `src/router/whitelist.ts`）。
> **COMPONENT_REGISTRY**：从 `autoRegisteredRoutes` 递归提取 `(name, component)` 派生，remote 模式按 name 查找组件 loader。新增路由无需在多处同步。
> 详见 `docs/07-路由模块设计.md`。

### 样式管理（BEM + 双主题）

- **BEM 命名规范**：Block = `vv-block`，Element = `__element`，Modifier = `--modifier`，State = `is-{state}`（运行时由 `is()` 生成）
- **运行时工具**：`createNamespace('xxx')` 返回 `{ b, e, m, be, bm, em, bem, is }`，组件用 `const bem = createNamespace('header-bar')` + `:class="[bem.b(), bem.e('user')]"`
- **BEM 方法语义区分**（CLAUDE.md §3.2 #9 强约束）：
  - `bem.m('xxx')` → `vv-<block>--xxx`（block modifier，作用于整个组件，如卡片整体 `'shimmer'`）
  - `bem.em('elem', 'xxx')` → `vv-<block>__elem--xxx`（element modifier，作用于某个元素，如 `__row--first`）
  - 误用会导致 class 与 sass 嵌套选择器不匹配，整片样式失效
- **编译期 mixin**：`@vv/config` 工厂（`packages/config/src/scss.ts` 单源）通过 sass `additionalData` 把 `@use 'bem' as *`（裸模块名，经 loadPaths 解析到 @vv/ui 包内 bem.scss）自动注入到每个 `<style lang="scss">` 顶部，业务方**不要**重复 `@use`。直接 `@include b / e / m / is` 拼接即可。
- **双主题**：浅色 + 深色 + 跟随系统，切换 API `useTheme().toggleMode()`（Pinia store + localStorage 持久化）

```vue
<script setup lang="ts">
import { useTheme } from '@vv/shared'
const { isDark, toggleMode } = useTheme()
</script>

<template>
  <button @click="toggleMode">{{ isDark ? '☀️' : '🌙' }}</button>
</template>
```

> 详见 `docs/05-BEM样式规范.md` 与 `docs/06-主题管理规范.md`。

### 国际化

当前支持 `zh-CN`（默认）和 `en-US`，切换通过 `useAppStore().setLocale()`。

### 模块化范式（directives / plugins，归 @vv/shared）

新增全局自定义指令（`packages/shared/src/directives/`）：

```ts
// packages/shared/src/directives/xxx.d.ts — 类型定义
export type ElHTMLElement = HTMLElement
export interface XxxBinding { value: (...args: unknown[]) => void; arg?: string }

// packages/shared/src/directives/xxx.ts — install 模式实现
export default {
  install(app: App) {
    app.directive<ElHTMLElement, XxxBinding['value']>('xxx', {
      mounted(el, binding) { ... }
    })
  }
}
```

`directives/index.ts` 是 `import.meta.glob` 自动注册入口（自动跳过 `index.ts` / `_` 前缀内部工具 / `.d.ts` / `.spec.ts`）——新增指令丢文件进目录即可，无需改 index.ts、无需动 main.ts。

新增全局插件同形（install 模式），归 `packages/shared/src/plugins/`（参考 `errorHandler.ts`）；装配统一走 `createAppPlugins` 工厂，各 app `plugins/index.ts` 退化为一行薄封装（`export default createAppPlugins({ remAdaptation: true })`，仅 admin / h5 传参）。

各 app main.ts 经 `bootstrapApp` 工厂集中接入（装配顺序契约固化在工厂内）：

```ts
// apps/<a>/src/main.ts
import Directives from '@directives'
import Plugins from '@plugins'

await bootstrapApp({
  rootComponent: App,
  // ...router / pinia / i18n / globalComponents 等装配参数...
  directives: Directives,
  plugins: Plugins,
})
```

> 详见 [`docs/08-模块化架构总览.md`](docs/08-模块化架构总览.md)。

---

## 📐 代码规范

### 工具栈

- **ESLint 10** + flat config（`eslint.config.mjs`）+ Vue 官方推荐配置
- **Prettier 3.9** 统一格式
- 规则组合：`pluginVue['flat/essential']` + `@vue/eslint-config-typescript` + `@vue/eslint-config-prettier/skip-formatting`

### 常用脚本

| 命令                | 用途                   |
| ------------------- | ---------------------- |
| `pnpm lint`         | ESLint 检查（不修改）  |
| `pnpm lint:fix`     | ESLint 自动修复        |
| `pnpm format`       | Prettier 自动格式化    |
| `pnpm format:check` | Prettier 检查（CI 用） |

### 配置文件

| 文件                | 说明                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `eslint.config.mjs` | ESLint flat config（Vue/TS/Prettier 三层组合）                                                                           |
| `.prettierrc.json`  | Prettier 主配置（semi/singleQuote/printWidth 等）                                                                        |
| `.prettierignore`   | Prettier 忽略文件（dist、node_modules、coverage、`docs/superpowers`、`CHANGELOG.md`、生成物 `apps/*/tsconfig.app.json`） |

### 项目级规则覆盖

| 规则                                | 配置                      | 原因                                 |
| ----------------------------------- | ------------------------- | ------------------------------------ |
| `vue/multi-word-component-names`    | `off`                     | 保留 Header/Sidebar/Login 等简洁命名 |
| `@typescript-eslint/no-unused-vars` | `varsIgnorePattern: '^_'` | 允许 `_p` 等有意忽略的解构模式       |

### Prettier 风格

- `semi: false`（无分号）
- `singleQuote: true`（单引号）
- `trailingComma: "es5"`（兼容 ES5 的位置加尾逗号）
- `printWidth: 100`（每行最多 100 字符）
- `vueIndentScriptAndStyle: false`（Vue 的 `<script>` 和 `<style>` 不缩进）

### 与 Husky 集成

`.husky/pre-commit` 实跑 **2 步**（Monorepo 迁移期精简版，秒级不卡提交）：

| 序  | 命令                | 作用                                                              |
| --- | ------------------- | ----------------------------------------------------------------- |
| 1   | `pnpm lint-staged`  | 暂存区文件 prettier + eslint 自动修复（仅变更文件，不全库扫描）   |
| 2   | `pnpm check:routes` | 路由一致性检查（声明 / whitelist / 实际 routes 三者一致，防漏改） |

> 各项一致性 check（check:aliases / check:mock-wiring / check:doc-currency）均在 CI 阶段随 check:routes（whitelist / 系统兜底 / 注册表反向等 5 校验）一并执行（见 ci.yml），不在 pre-commit（本地秒级提交体验优先）。原单应用时期的 5 步 pre-commit 链见 docs/03-Git工作流工具链.md 历史节。

| Hook       | 命令                                                          | 作用                                                                                  |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| commit-msg | `sh scripts/check-commit-msg.sh` + `commitlint --edit`        | 拦截 commit message 的 AI 协作痕迹（宽拦 Co-Authored-By trailer / AI 署名）+ 提交规范 |
| pre-push   | `turbo run test --filter=[origin/master]...`（affected 子集） | 防止测试不通过的代码推送                                                              |

> 注：pre-push 只跑自 origin/master 以来变更的包（与 CI PR 模式同参数），**master 全量测试网由 CI 兜底**（ci.yml `turbo run build test` 无 filter）。紧急逃生：`git push --no-verify` 跳过本钩子。
> lint 未集成到 pre-commit 的**全量检查**（避免每次 commit 等待），开发期手动 `pnpm lint:fix`，CI 阶段跑 `pnpm lint`。

### Git 工作流

**推荐使用 `pnpm push` 一站式提交并推送**，封装在 `package.json:scripts.push`：

| 命令                               | 行为                                         | 适用场景                               |
| ---------------------------------- | -------------------------------------------- | -------------------------------------- |
| `pnpm push`                        | `git add .` + `cz`（交互式问答）+ `git push` | **推荐**：开发完成后一键提交并推送     |
| `pnpm commit`                      | `git add .` + `cz`                           | 仅需本地提交、暂不推送（如阶段性保存） |
| `git commit -m "..."` + `git push` | 传统两步                                     | 已写好完整 commit message 时           |

> `pnpm push` 仍受 husky `pre-commit`（lint-staged + check:routes）与 `pre-push`（affected 子集测试）约束，提交失败会被自动拦截。pre-push 只跑变更包，日常推送秒级返回；全量网在 CI。

---

## 📦 部署

### 生产构建

```bash
pnpm build
```

turbo 拓扑序全量构建 6 app + 4 包（各 app 内 `build-only` 生成声明 → `type-check:full` 门禁），产物在各 `apps/<a>/dist/`。聚合托管形态见下方「生产 Docker 部署」（`dist-prod/<app>/`）与 gh-pages 部署（`dist/<app>/`）。

### 环境变量

| 变量                     | 说明                                                                                                                                                                                                                                                                                                                 | 默认值                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `VITE_APP_TITLE`         | 应用标题首屏占位（各 app `apps/<a>/src/main.ts` 初始化；登录后由路由 `meta.title` 覆盖）                                                                                                                                                                                                                             | 企业中后台管理                             |
| `VITE_APP_ID`            | 应用标识（由各 app `app.manifest.json` 的 `name` 经 `@vv/config` 工厂 define 注入，无需手工配 env）：pinia persist 的 localStorage key 前缀（如 `admin:app-ui`），多 app 同域部署时隔离各 app 持久化数据                                                                                                             | 工厂注入；无注入场景（如单测）回落 `'app'` |
| `VITE_API_BASE_URL`      | API 基础 URL（`packages/shared/src/api/http.ts:126` `getAPIBaseURL()` 读取）。**优先级：shell env > `.env` 文件 > 工厂保底 `/api`**——mock 统一前缀方案（2026-10-26）下 6 app 的 `.env.development` 配 `/mock`（仅 dev 加载），Network 面板一眼区分 mock/真实响应；联调真实后端用 shell env 覆盖                      | 工厂保底 `/api`                            |
| `VITE_USE_MOCK`          | mock 数据开关（`@vv/config` 工厂 config 期 `process.env` 读取，`.env` 无效；`true`/未设=启用，`false`=关闭用于联调真后端）                                                                                                                                                                                           | dev 默认开启                               |
| `VITE_MENU_SOURCE`       | 菜单加载模式（`local` / `remote`，未设置时默认 `remote`）                                                                                                                                                                                                                                                            | `remote`                                   |
| `VITE_DEMO_NO_AUTH`      | 演示模式开关（prod + `VITE_USE_MOCK=true` 时生效）：守卫跳过登录/权限校验，演示账号 Admin（admin/123456）全链路可点；按钮级 v-auth 仍按真实 permissions 渲染                                                                                                                                                         | 不设 = 关闭                                |
| `VITE_HISTORY_MODE`      | 路由历史模式（`web` / `hash`，用于子路径或静态托管部署）                                                                                                                                                                                                                                                             | `web`                                      |
| `VITE_BASE`              | 路由部署基础路径（必须以 `/` 开头和结尾；多应用聚合构建时由 `scripts/build-pages.ts` 内 `REPO_PREFIX` 按 app 注入，见 docs/43 §7）                                                                                                                                                                                   | `/`                                        |
| `VITE_BUILD_ID`          | 版本检测 buildId 注入（`packages/config/src/version-check-vite.ts` 构建插件 `process.env` 读取；CI 注入 `git sha-run_attempt` 使产物可追溯并消同 commit 重跑相同 buildId，见 docs/44）                                                                                                                               | 不设 = 插件默认                            |
| `VITE_AUTH_ORIGIN`       | 统一登录重定向基址（`@vv/shared` redirect.ts 与各 app 守卫读取）：未登录整页跳 `${VITE_AUTH_ORIGIN}/login?redirect=...`，登出回跳同源；同域网关/子路径部署按实际前缀配置；**gh-pages 演示形态由 `scripts/build-pages.ts` 注入 `${REPO_PREFIX}/auth/#`**（`#` 尾巴承载 auth 的 hash 路由形态，否则退出/未登录跳 404） | `/auth`                                    |
| `VITE_STORAGE_NAMESPACE` | storage 命名空间（隔离多项目共用 localStorage）                                                                                                                                                                                                                                                                      | `vue3-vite-project`                        |
| `VITE_BRAND_COLOR`       | 业务品牌色（HEX，运行时同步注入 `--color-primary` 与 `--el-color-primary` 覆盖 Element Plus 默认蓝 `#409eff`；灯色阶为编译期字面量不联动，详见 [docs/06-主题管理规范.md](docs/06-主题管理规范.md)）                                                                                                                  | `#409eff`                                  |
| `VITE_QUIET_DEV`         | 关闭 dev 模式 GlobalComponents 自动注册徽章（专注调试时减少噪音，详见 `packages/ui/src/global-components.ts`）                                                                                                                                                                                                       | 不设 = 输出徽章                            |
| `VITE_BEM_PREFIX`        | BEM 类名前缀（同时影响 TS 端 `createNamespace` 与 SCSS `bem mixin`；改一处即全站类名同步切换，详见 `packages/shared/src/utils/bem.ts` + `packages/ui/src/styles/tools/_bem.scss`）                                                                                                                                   | `vv`                                       |

> 环境变量读取：项目内显式通过 `import.meta.env.VITE_XXX` 访问。`baseURL` / `storage namespace` 单一来源在 `packages/shared/src/api/http.ts` 和 `packages/shared/src/utils/storage.ts`，不在各业务模块分散。

### Nginx 配置示例

```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /var/www/vue3-vite-project/dist;
  index index.html;

  # SPA fallback（Vue Router history 模式）
  location / {
    try_files $uri $uri/ /index.html;
  }

  # API 反向代理（生产关闭 Mock 时使用）
  location /api/ {
    proxy_pass http://backend-service:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # 静态资源缓存（按目录差异化策略，匹配 dist/ 分目录产物）
  location ~* ^/js/.*\.js$ {
    expires 30d;
    add_header Cache-Control "public, immutable";  # JS 含 contenthash，长缓存
  }
  location ~* ^/css/.*\.css$ {
    expires 7d;
    add_header Cache-Control "public, immutable";   # CSS 主题常迭代，短缓存
  }
  location ~* ^/img/.*\.(png|jpg|jpeg|gif|svg|webp|ico)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";  # 图片独立 CDN 加速
  }
  location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";  # 兜底（根目录散落资源，理论上应为空）
  }

  # Gzip 压缩
  gzip on;
  gzip_types text/plain text/css application/javascript application/json;
}
```

### 生产 Docker 部署

生产形态 = 多阶段构建 6 app 聚合产物 + nginx 静态托管 + `/api` 反代真实后端（SSE 关缓冲）。路径语义与 dev 网关逐条对齐（`/` → 302 `/portal/`、`/<app>/` 静态 + SPA fallback、`/api/` 反代），统一登录协议同构。

```bash
# 一键构建并运行（compose 注入 API_UPSTREAM → nginx envsubst 渲染进配置）
docker compose -f docker-compose.prod.yml up --build
# 浏览器 http://localhost:8080/（302 → /portal/）
```

> ⚠️ **`--build` 不可省**（2026-10-27 实测踩坑）：compose 的 `up` 在镜像已存在时**直接复用旧镜像**——改代码后不带 `--build` 跑的仍是旧产物（现象：浏览器看到旧行为，疑似「缓存问题」实为镜像缓存）。日常重启容器用 `docker compose -f docker-compose.prod.yml up -d`，**改了代码必须 `up -d --build` 或先 `docker compose build`**。

| 文件                              | 职责                                                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`（根）                | 多阶段：`node:22-alpine` corepack(pnpm@12.11.2) + frozen-lockfile → `build-prod` → `nginx:1.27-alpine` 托管                        |
| `docker-compose.prod.yml`         | 生产编排：`build .` + `8080:80` + 注入 `API_UPSTREAM`（唯一按部署环境修改的变量）                                                  |
| `deploy/nginx.prod.conf.template` | 路径分发 + SPA fallback + `/api/` 反代模板（官方镜像 entrypoint envsubst，仅渲染容器 env 已定义变量）                              |
| `scripts/build-prod.ts`           | 生产聚合构建：6 app `base=/<app>/` + history + remote 菜单 + `VITE_USE_MOCK=false` + `VITE_API_BASE_URL=/api`（`pnpm build:prod`） |
| `.dockerignore`                   | 排除 node_modules / 各 dist / docs / .git                                                                                          |

前置：真实后端可达 `API_UPSTREAM`（默认 `http://host.docker.internal:8081` 指宿主机；服务器部署改内网服务名如 `http://backend:8080`）。`VITE_MENU_SOURCE=remote` 需后端菜单接口就绪——无后端时页面菜单为空属预期。

### CI/CD（GitHub Actions）

项目已内置两条真实 workflow（`.github/workflows/`）：

| Workflow     | 触发                                                 | 职责                                                                                                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`     | push / PR 至 master、develop（push 含 `feature/**`） | 质量门禁 12 step：Lint + test:eslint-rules + test:check-scripts + test:gateway + Build+Test（master 全量 showroom 分级 / PR affected）+ coverage gate + check:routes + check:aliases + check:doc-currency + check:mock-wiring + E2E                                                                   |
| `deploy.yml` | push 至 master / gh-pages + workflow_dispatch        | gh-pages 自动部署（单 job）：构建五开关（`VITE_HISTORY_MODE=hash` / `VITE_MENU_SOURCE=local` / `VITE_USE_MOCK=true` / `VITE_DEMO_NO_AUTH` / `VITE_BUILD_ID=git sha`；`VITE_BASE` 由 `scripts/build-pages.ts` 的 `REPO_PREFIX` 按 app 注入），发布到 `https://Mr-Super-X.github.io/vue3-vite-project/` |

> 一致性 checks 全部由 CI 执行（ci.yml）：check:routes（whitelist / 系统兜底 / 注册表反向等 5 校验）/ check:aliases / check:mock-wiring / check:doc-currency；本地可用同名 script 预跑。
> 首次启用需在仓库 Settings → Pages 把 Source 设为 "GitHub Actions"。设计文档：[docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md](docs/superpowers/specs/2026-10-20-gh-pages-deploy-design.md)。
> **分支保护建议**：Settings → Branches 为 master 开启保护（禁直推、必过 CI）——showroom 分级下（docs/big/h5 的 test 在 master push 被排除），直推 master 是三 showroom app 纯测试破坏的唯一静默通道，分支保护可将该通道关闭（/autoplan Round 2 R2-E4）。

如需对接自己的部署环境（对象存储 / CDN / 其它静态托管），以上「生产 Docker 部署」的 `Dockerfile` + `deploy/nginx.prod.conf.template` 即接入参考。

---

## 🧪 测试

```bash
pnpm test                           # 单次运行（CI 用；turbo 拓扑序全 app + 包）
pnpm -C apps/admin test:watch      # 开发用 watch（根无此 script，app 级提供）
pnpm test:coverage                 # 覆盖率报告（输出到 coverage/；admin 口径）
pnpm test:e2e                      # Playwright 端到端测试
pnpm bench                         # vitest bench 基准测试
```

测试文件与源码同级（`foo.ts` 对应 `foo.spec.ts`），按目录一一对应：

- `utils/` — dayjs、storage、bem、format、validate、safeAsync 等纯函数
- `composables/` — useRequest / useAuth / useDialog / useConfirm / useDict / useLogout / useAppRouter 等 8+ 个
- `components/common/` — AsyncState、BaseChart、DictSelect、DictTag、ErrorBoundary、AppDynamicIcon 等
- `components/ProTable/`、`components/form-schema/` — 引擎与 composer 全目录 spec
- `layouts/` — default/portal/h5/big 布局渲染层
- `modules/demo/` 等 — 各模块 views/components 行为级 smoke
- 集成层 — global-plugin、router/auto-register、build 脚本（`packages/mock` 目录无 spec，靠 type-check:full 与 dev 手测兜底）

覆盖率阈值（`apps/admin/vitest.config.ts` 实际值，渐进基线）：lines 34 / statements 35 / functions 20 / branches 31——脚手架阶段宽松起步，注释已规划 v4.0 提至 70/70/65/70、业务阶段再提 80。当前 232 个 spec 文件（`.spec.ts` 230 + `.spec.cjs`/`.spec.mjs` 各 1，含 `tests/e2e/` 的 7 个 playwright spec，非 e2e 225）+ Playwright e2e 14 条 test()（hello 1 / workbench-panels 1 / layout-scale 3 / protable-search-list 2 / protable-selection-batch 3 / cross-app-roaming 2 / rem-activation 2），详见 [docs/04-构建与测试工具.md](docs/04-构建与测试工具.md) §测试文件清单。

---

## 📚 相关文档

### 项目规范

| 文档                                   | 路径                                            | 说明                                                                                     |
| -------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 工具兼容性踩坑                         | `docs/01-工具兼容性问题踩坑记录.md`             | npm/pnpm/Node 兼容性问题 + 解决方案                                                      |
| 代码质量工具链                         | `docs/02-代码质量工具链.md`                     | ESLint 10 + Prettier 3.9 + lint-staged 17                                                |
| Git 工作流工具链                       | `docs/03-Git工作流工具链.md`                    | Husky + commitlint + cz-customizable                                                     |
| 构建与测试工具                         | `docs/04-构建与测试工具.md`                     | Vite 8 + Vitest 4 + UnoCSS 66 + alias 系统                                               |
| BEM 样式规范                           | `docs/05-BEM样式规范.md`                        | 命名约定 + 样式隔离三层防线 + mixin + 运行时工具                                         |
| 主题管理规范                           | `docs/06-主题管理规范.md`                       | 双主题架构 + CSS 变量速查 + useTheme API                                                 |
| 路由模块设计                           | `docs/07-路由模块设计.md`                       | 自动注册 + 白名单 + 远程菜单 + 3 步新增流程                                              |
| **模块化架构总览**                     | `docs/08-模块化架构总览.md`                     | 4 块公共范式（directives/plugins/components/utils）+ 扩展流程                            |
| 组件示例站点开发指引                   | `docs/09-组件示例站点开发指引.md`               | docs app 全量 demo 文档站，1 文件 1 demo + 自动 API 提取                                 |
| **新手指引**                           | `docs/10-新手指引.md`                           | 30 分钟 5 任务：clone → 加模块 → 加 API → 调常见问题                                     |
| 字典使用规范                           | `docs/11-字典使用规范.md`                       | 三层架构速查 + 业务侧用法 + 缓存策略 + 7 条常见坑                                        |
| Web Vitals 使用规范                    | `docs/12-web-vitals性能监控使用规范.md`         | LCP/INP/CLS/TTFB 采集 + 4 种上报端点接入示例                                             |
| **流式请求规范**                       | `docs/13-stream流式请求使用规范.md`             | SSE / NDJSON / auto 三格式 + 取消联动 + vs request 对比                                  |
| **Zod 校验规范**                       | `docs/14-zod请求参数校验使用规范.md`            | requestValidated + Zod schema + 失败行为 + 进阶用法                                      |
| **缓存/合并/分页适配**                 | `docs/15-请求层缓存-合并-分页适配使用规范.md`   | cache + merge + pageAdapter 三件套速查 + 决策表                                          |
| **Token 刷新与取消**                   | `docs/16-token自动刷新与全局取消使用规范.md`    | 401 自动 refresh + globalAbort + AbortController 工具三件套                              |
| **useRequest 三态**                    | `docs/17-useRequest使用规范.md`                 | VueUse 风格三态请求封装 + 与 AsyncState 组合 + 决策表                                    |
| 代码组织决策表                         | `docs/18-代码组织决策表.md`                     | utils / composable / store / api / plugin / directive 归属决策矩阵                       |
| Pinia store 使用规范                   | `docs/19-Pinia store使用规范.md`                | Setup Store 风格 + pick 持久化 + 模块边界                                                |
| 测试编写入门                           | `docs/20-测试编写入门.md`                       | Vitest 单测 + 覆盖率阈值 + AAA 模式                                                      |
| i18n 使用规范                          | `docs/21-i18n使用规范.md`                       | 多语言切换 + key 命名约定 + 按模块拆分                                                   |
| mock 使用规范                          | `docs/22-mock使用规范.md`                       | vite-plugin-mock + 自动扫描 + dev/prod 切换                                              |
| 权限设计                               | `docs/23-权限设计.md`                           | 权限模型 + useAuth + v-permission + v-auth 双层组合                                      |
| XForm 使用指南                         | `docs/24-XForm使用指南.md`                      | Schema DSL 动态表单 + 11 Props / 19 方法 + 多查询条件联动                                |
| XForm 架构与决策                       | `docs/25-XForm架构与决策记录.md`                | SchemaField 容错 + 反应式依赖追踪 + 错误降级                                             |
| 项目推荐说明                           | `docs/26-项目推荐说明.md`                       | 项目定位 + 适用场景 + 与同类脚手架差异 + 组件级杀手锏速览                                |
| **ProDialog 使用指南**                 | `docs/27-ProDialog使用指南.md`                  | 声明式 `<ProDialog>` + 命令式 `useDialog()` + 拖拽指令（v1.1 新增 `resizeMinToInitial`） |
| BaseChart 使用指南                     | `docs/28-BaseChart使用指南.md`                  | ECharts 容器 + 主题/自适应 + 数据更新策略                                                |
| **ProTable 使用指南**                  | `docs/29-ProTable使用指南.md`                   | 配置驱动表格（v3.4 `searchLayout` + 双引擎 + 4 大能力 + v3.1 自动高度/状态保持）         |
| RichTextEditor 指南                    | `docs/30-RichTextEditor使用指南.md`             | wangEditor V5 封装 + 双向 sanitize + required 自定义校验（见 docs/30 §常见坑）           |
| ProDialogForm 指南                     | `docs/31-ProDialogForm使用指南.md`              | ProDialog + XForm 命令式弹窗表单组合                                                     |
| 常用交互指令                           | `docs/32-常用交互指令.md`                       | v-copy / v-draggable / v-auth 等 6 个指令速查                                            |
| dev / dev:local 对比                   | `docs/33-pnpm-dev与dev-local模式对比.md`        | remote / local 两种菜单模式的选择与差异                                                  |
| H5 布局与 rem 适配                     | `docs/34-H5布局与rem适配.md`                    | h5 layout + 编译时 postcss-pxtorem + 运行时 rem 双层适配                                 |
| 大屏布局与 scale 适配                  | `docs/35-大屏布局与scale适配.md`                | big layout + transform: scale 等比缩放（1920/2560/4K/9000px 拼接屏）                     |
| Fork 升级与版本策略                    | `docs/36-Fork升级与版本策略.md`                 | 开源 MIT 后的版本口径 + fork 跟进上游策略                                                |
| h5-rem 适配决策记录                    | `docs/37-h5-rem适配决策记录.md`                 | H5 双层适配 ADR                                                                          |
| big-scale 适配决策记录                 | `docs/38-big-scale适配决策记录.md`              | 大屏 scale ADR                                                                           |
| 图标体系与使用规范                     | `docs/39-图标体系与使用规范.md`                 | unplugin-icons 双语法 + app 本地集合 + 去哪找图标                                        |
| gh-pages 自动部署                      | `docs/40-GitHubPages自动部署.md`                | push master 即发布线上 demo：workflow + 构建五开关 + 生产 mock 接线 + 排查               |
| 门户企业官网站点                       | `docs/41-门户企业官网站点.md`                   | /home 门面：文案单源 site.ts + 锚点导航三处同步 + 白名单公开约定                         |
| Monorepo 改造评估                      | `docs/42-Monorepo多应用改造评估.md`             | 单应用拆 6 app 的收益/成本评估与风险清单（R1-R9）                                        |
| **Monorepo 结构与开发指引**            | `docs/43-Monorepo结构与开发指引.md`             | 6 app + 4 包拓扑 / 端口表 / 新增应用流程 / 统一登录协议 / 同域网关 / CI-CD 形态          |
| 版本检测插件使用规范                   | `docs/44-版本检测插件使用规范.md`               | 轮询 version.json + ChunkLoadError 双机制 / onUpdate 回调注入 / CI 注入 git sha          |
| 仓库定位声明                           | `docs/45-仓库定位声明.md`                       | 单人维护 opinionated 底座裁决：做什么/不做什么/issue 边界                                |
| CI 门禁速查                            | `docs/46-CI门禁速查.md`                         | 13 门禁 × 触发条件/复跑命令/修复指引单页                                                 |
| 能力体验清单                           | `docs/47-能力体验清单.md`                       | 架构/能力/排障操作手册（会用 → 会修 → 会教），45 条可执行清单                            |
| **单应用模式与Monorepo多应用能力对比** | `docs/48-单应用模式与Monorepo多应用能力对比.md` | 双版逐项能力对比 + src/ 全目录归属映射 + 场景选型建议                                    |
| **样式分层架构规范**                   | `docs/49-样式分层架构规范.md`                   | 五层分层 + monorepo 映射 / tokens 源-镜像立场 / EP 覆盖三级 / 端级骨架归属与豁免登记     |

### 架构评估

| 文档                                  | 路径                                           | 说明                                                                 |
| ------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| **架构易用性评估（2026-07）**         | `docs/audit/2026-07-24-usability-review.md`    | 5 大模块（路由 / 状态 / API / UI / 工具 / 文档）DX 评估 + 优先级矩阵 |
| **架构易用性评估 v3（2026-07 增量）** | `docs/audit/2026-07-24-v3-usability-review.md` | v2 改进落地验证 + v3 新发现（同日增量审查）                          |
| **引擎专项审计（2026-10，四篇）**     | `docs/audit/2026-10-15-engine-audit-*.md`      | fixpatterns / protable / xform / summary 引擎层审计                  |

### 设计 / 计划（已归档）

历史设计与计划按月归档到 `docs/archive/`，仅作为时间线追溯；最新规范请直接读 `docs/01-48` 编号文档与 README 当前章节。

| 目录                          | 内容                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/archive/2026-07/`       | 2026-07 期间的设计 + 计划 + 调研（调研报告在目录根，如 `2026-07-22-unplugin-vue-router-survey.md`） |
| `docs/archive/2026-07/specs/` | 设计文档（按日期命名）                                                                              |
| `docs/archive/2026-07/plans/` | 实施计划（按日期命名）                                                                              |
| `docs/audit/`                 | 周期性架构评估报告（按日期命名）                                                                    |

### 变更日志

| 文档           | 路径       |
| -------------- | ---------- |
| `CHANGELOG.md` | 项目根目录 |
