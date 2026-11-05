# 48 - 单应用模式与 Monorepo 多应用能力对比（v2.x → v3.x 选型参考）

> **读者定位**：正在评估是否采用本底座、或从单应用版（v2.x 及更早）升级/迁移的用户。
> **本文回答三个问题**：① 两个版本的能力差在哪？② 日常使用习惯要改什么？③ 我的场景该选哪种用法？
> **基线**：单应用时代最后状态（2026-10-21，v2.2.1 口径）vs 当前 Monorepo 版（v3.1.0+）。
> **核查方式**：目录级 git diff 全景 + src/ 全目录逐项归属比对 + 关键配置文件双版定点核实——结论可复算。

## 0. 一句话本质

单应用版 = **一个 src/、一个端口、一套路由表承载四种面板**；Monorepo 版 = **6 个独立应用（apps/\*）+ 4 个共享包（packages/\*），pnpm workspace + turbo 编排，统一登录走跨应用整页跳转协议**。四种面板能力本身全部保留，变的是「承载形态」和「日常操作入口」。

## 1. 仓库结构与定位

| 维度                | 单应用版（v2.x）                                                                                                         | Monorepo 版（v3.x）                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 拓扑                | 单 `src/`（16 个一级目录 Lockdown）                                                                                      | `apps/*` 6 应用 + `packages/*` 4 包 + `scripts/`                                                                                                                                                                                                                         |
| 编排                | 无（单 package.json）                                                                                                    | pnpm workspace（catalog 单版本源）+ turbo@2 拓扑序                                                                                                                                                                                                                       |
| 四面板形态          | 同一 app 内按路由挂 layout（default/portal/h5/big）                                                                      | 每面板一个独立 app：admin/portal/h5/big + auth（登录）+ docs（示例站）                                                                                                                                                                                                   |
| 共享代码            | `src/utils`、`src/composables`、`src/components/common` 等                                                               | 下沉 `@vv/shared`（网络层/store/composables/utils/locales/directives）、`@vv/ui`（组件三目录+弹窗族）、`@vv/config`（vite 工厂）、`@vv/mock`；**api 层连业务契约一起下沉**（`@vv/shared/api` 含 modules/{auth,dict,menu,user}，新增 `error-events.ts` 网络错误反馈事件） |
| 包消费方式          | 目录别名（`@utils`、`@store` 等 15+1 个别名）                                                                            | workspace `workspace:*` **源码直链，不建 dist**；包名 `@vv/*`                                                                                                                                                                                                            |
| 仓库定位            | 「四栖工程模板」                                                                                                         | 「四栖工程底座」（2026-10-28 裁决：单人维护 opinionated 底座，不做 npm 包发布/社区运营）                                                                                                                                                                                 |
| app 内 src 一级目录 | 14 个目录（api/assets/components/composables/directives/enums/layouts/locales/modules/plugins/router/store/types/utils） | **admin/src 收缩为 8 个目录**：api/assets/components/composables/directives/enums/locales/utils 八项全下沉 packages/*；剩 layouts/modules/plugins（薄壳）/router/store/types/views + styles（2026-11-02 端级样式骨架三件套，docs/49 §5）                                 |
| error 错误页        | `src/modules/error/` 独立模块                                                                                            | 拆分：`apps/admin/src/views/` 三视图（Forbidden/NotFound/ServerError）+ `@vv/ui` 共享 ErrorPage 组件统一 6 app 错误页                                                                                                                                                    |
| 根级工程文件        | `.env`/`.env.development`/`.env.production` + `index.html` + `mock/` + `src/` 均在根级                                   | 根级 env/index.html **消失**：每 app 自持 `.env*`（如 admin 三件）与 `index.html` ×6；`mock/` → packages/mock；根级新增 `Dockerfile` / `docker-compose.prod.yml` / `deploy/`（详见 §12）                                                                                 |

### 1.1 旧版 src/ 全目录归属映射表（逐项完整性核查）

> 核查方式：`git ls-tree -r` 双版对照 + 逐目录文件清单比对。结论：**16 项全部有明确归属，零能力丢失**。

| 旧版 `src/` 项                                                                            | 新版归属                                                                                                                                                           | 完整性证据                                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `App.vue`                                                                                 | 各 app 自持（6 份同构，三层职责不变）                                                                                                                              | admin 版逐行比对：仅 import 来源改包名                                                                    |
| `main.ts`                                                                                 | 各 app 自持（bootstrapApp 工厂化，见 §9）                                                                                                                          | 装配能力全保留                                                                                            |
| `api/`（12 基建 + types + modules×4）                                                     | `@vv/shared/api` 整体平移                                                                                                                                          | 逐目录清单一致；**新增 error-events.ts**                                                                  |
| `assets/styles/`（11 文件）                                                               | `@vv/ui/assets/styles/`                                                                                                                                            | 逐文件一致（reset/variables/theme/transition/element-overwrite/custom/mixins×3）                          |
| `assets/icons/`                                                                           | `@vv/ui/assets/icons/`（FileSystemIconLoader 路径随迁）                                                                                                            | 图标体系机制不变                                                                                          |
| `components/`（common + ProTable + form-schema）                                          | `@vv/ui/components/` 三目录原样                                                                                                                                    | 自动注册机制延续（§8）                                                                                    |
| `composables/`（8 个）                                                                    | 拆分：`@vv/shared`×5（useAppRouter/useRequest/useAuth/useDict/useTheme）+ `@vv/ui`×3（useDialog/useConfirm/useLogout）                                             | CLAUDE.md §1.6 注入清单对照一致                                                                           |
| `directives/`（6 指令 + _utils + index）                                                  | `@vv/shared/directives/`                                                                                                                                           | **逐文件名一致**（auth/buttonDebounce/copy/draggable/inputDebounce/permission）                           |
| `enums/`                                                                                  | `@vv/shared/enums/`（已入 barrel，`@enums` 别名零消费）                                                                                                            | 治理记录佐证                                                                                              |
| `layouts/`（5 套）                                                                        | 一一对应随 app：default→admin、blank→auth、portal→portal、h5→h5、big→big                                                                                           | 逐 app layouts/ 目录核实                                                                                  |
| `locales/`（zh-CN/en-US/index 3 文件）                                                    | `@vv/shared/locales/`                                                                                                                                              | 逐文件一致                                                                                                |
| `modules/auth`（7）                                                                       | `apps/auth/src/modules/`（7）                                                                                                                                      | 文件数一致                                                                                                |
| `modules/home`（13）                                                                      | `apps/portal/src/modules/`（13）                                                                                                                                   | 文件数一致                                                                                                |
| `modules/big-demo`（18）                                                                  | `apps/big/src/modules/`（18）                                                                                                                                      | 文件数一致                                                                                                |
| `modules/h5-demo`（6）                                                                    | `apps/h5/src/modules/`（7）                                                                                                                                        | +1（路由/索引微调，非丢失）                                                                               |
| `modules/demo`（145）                                                                     | `apps/docs/src/modules/`（146）                                                                                                                                    | +1（同上）                                                                                                |
| `modules/user + reports + workbench`（4+2+8=14）                                          | `apps/admin/src/modules/`（14）                                                                                                                                    | 文件数一致                                                                                                |
| `modules/error`（4）                                                                      | 拆分：`apps/admin/src/views/` 三视图 + 路由重组入 admin router                                                                                                     | 结构性重组（error 不再是模块而是视图），非能力丢失                                                        |
| `plugins/`（3 插件 + index）                                                              | `@vv/shared/plugins/` + **新增 versionCheck 第 4 件**                                                                                                              | createAppPlugins 工厂单源                                                                                 |
| `router/`（5+1 守卫 + auto-register/fallback/remote/config/helpers/types/error-boundary） | 拆分：`@vv/shared/router-guards`（login/permission/visibility/composable/whitelist）+ admin 私有（auth/remote-menu）+ 各 app 自持（auto-register/fallback/config） | 逐文件核实                                                                                                |
| `store/modules/`（app/user/theme/tags-view/dict + router）                                | `@vv/shared/store`×4 + admin 私有×2（tags-view/router）                                                                                                            | 见 §7                                                                                                     |
| `types/`                                                                                  | 各 app `src/types/`（auto-imports.d.ts / components.d.ts 每 app 独立生成）                                                                                         | 生成机制延续                                                                                              |
| `utils/`（10 文件）                                                                       | `@vv/shared/utils/`                                                                                                                                                | **逐文件名一致**（autoImport/bem/caseConvert/consoleBadge/dayjs/format/index/safeAsync/storage/validate） |

**src/ 时代没有的新增项**：packages/config 工厂族 / scripts 19 个新脚本 / apps-registry 注册表 / node-gateway + dev-gateway / error-events.ts / versionCheck 插件 / tests/e2e/gateway 漫游用例 / Dockerfile + deploy/ + docker-compose.prod.yml。
**真正拆除的**：根 `build/`（迁 @vv/config）、根 `mock/`（迁 packages/mock）、根 `src/` 本身、根级 env×3 与 index.html、scripts/vite-plugin-clean-mock.ts（迁 @vv/config）、docker-compose dev 网关（被 node 网关替代）。

## 2. 启动与访问方式（日常最高频变化）

| 习惯            | 单应用版                                                                     | Monorepo 版                                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日常启动        | `pnpm dev` → **localhost:5174**                                              | **`pnpm dev:gateway`** → **localhost:8080**（node 网关 + 6 app 同起同退）；⚠️ `pnpm dev` 仍在但 turbo 并行 6 app 有 mock 共享竞态，非首选                                              |
| 只开发中后台    | `pnpm dev`（唯一选择，全量起）                                               | `pnpm dev:gateway admin auth`（子集模式，省一半启动时间）；或 `pnpm dev:admin` 单 app 快捷                                                                                             |
| local 菜单模式  | `pnpm dev:local`                                                             | 保留，app 级：`pnpm -C apps/admin dev:local`                                                                                                                                           |
| 登录入口        | `http://localhost:5174/login`（app 内路由）                                  | `http://localhost:8080/auth/login`（独立 auth app，整页跳转协议）                                                                                                                      |
| 访问各面板      | 同端口切路径：`5174/workbench`、`5174/home`、`5174/h5-demo`、`5174/big-demo` | 网关路径前缀：`8080/admin/`、`8080/portal/`、`8080/h5/`、`8080/big/`、`8080/docs/`；根路径 302 → `/portal/`                                                                            |
| 直连单 app 端口 | 5174 就是全部                                                                | 5174-5179 每 app 独立端口（`app.manifest.json` 单源 + `strictPort` 锁死）；**单起 admin 时未登录跳 `/auth/login` 404 属预期**（/auth 在 5179，跨端口不可达，统一登录必须走 8080 网关） |
| HMR             | 单端口天然可用                                                               | 网关下 WS 透传 + `server.hmr` clientPort 固定 app 自身端口（已内置修复）                                                                                                               |

## 3. 命令体系对比

### 3.1 根级新增（monorepo 独有）

| 命令                                            | 用途                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev:gateway [apps...]`                    | node 网关 :8080 + 指定/全部 app 一体化启动（替代已删除的 docker-compose dev 方案） |
| `pnpm dev:admin` ~ `dev:docs`                   | 6 个单 app dev 快捷                                                                |
| `pnpm new-app <name>`                           | 一键生成可 dev/build/test 的最小公开 app（端口自动分配，注册表/CI 零手改）         |
| `pnpm build:pages`                              | gh-pages 六应用聚合构建（`dist/<app>/` + 落地页）                                  |
| `pnpm build:prod`                               | 生产六应用聚合构建（`dist-prod/<app>/`，base=/<app>/ + history + 真实后端）        |
| `pnpm test:gateway`                             | node 网关 HTTP/WS/302/502 smoke（node:test，已入 CI）                              |
| `pnpm check:mock-wiring`                        | mock 双接线一致性校验（CI 阻断）                                                   |
| `pnpm test:check-scripts` / `test:eslint-rules` | 工程脚本与本地 ESLint 规则自身的测试                                               |
| `pnpm generate:declarations` / `postinstall`    | 声明生成与新鲜度检查                                                               |

### 3.2 下沉到 app 级（根级消失，改用 `pnpm -C apps/<a> <cmd>`）

| 单应用版根命令         | monorepo 等价                                                        |
| ---------------------- | -------------------------------------------------------------------- |
| `pnpm preview`         | `pnpm -C apps/<a> preview`                                           |
| `pnpm build-only`      | `pnpm -C apps/<a> build-only`                                        |
| `pnpm test:watch`      | app 级                                                               |
| `pnpm type-check:full` | `pnpm -C apps/<a> type-check:full`（根 `pnpm build` 内部仍含此门禁） |
| `pnpm test <path>`     | `pnpm -C apps/admin test <path>`                                     |

### 3.3 保留但语义变化

| 命令                                         | 旧语义                                   | 新语义                                                                           |
| -------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm dev`                                   | 起唯一 dev server                        | turbo 并行起 6 app（有 mock 竞态，日常不推荐）                                   |
| `pnpm build`                                 | 单应用构建 + 类型门禁                    | turbo 拓扑序 6 app + 4 包全量构建                                                |
| `pnpm test`                                  | 单 vitest                                | turbo 拓扑序全 workspace（test 依赖 ^build）                                     |
| `pnpm new-module <name>`                     | 生成到 `src/modules/`                    | 默认生成到 `apps/admin/src/modules/`，`--app <a>` 可指定其他 app，任意目录可执行 |
| `pnpm check:routes`                          | 单应用路由一致性                         | 6 app 逐个校验 + 端口双写锁死 + 注册表反向校验 + nginx 模板对账                  |
| `pnpm check:aliases`                         | 校验 `build/aliases.ts` ↔ tsconfig paths | 校验 `packages/config/src/app-aliases.ts` ↔ 各 app tsconfig paths                |
| `pnpm analyze` / `test:coverage` / `test:ui` | 全项目口径                               | admin 口径收容                                                                   |
| `pnpm test:e2e`                              | 单 baseURL Playwright                    | 按 app 分组 playwright projects，跨 app 流程走 8080 网关                         |

### 3.4 工程脚本规模（scripts/ 目录）

scripts/ 从 **8 → 26 个文件**。新增：apps-registry（注册表单源）/ dev-gateway / node-gateway / build-pages / build-prod / new-app / check-mock-wiring / generate-declarations / 多个脚本自带 spec（check-routes / check-doc-currency / new-module / new-app / dev-gateway / node-gateway 等）/ eslint-rules/ 子目录（本地规则源码）/ templates/（脚手架模板）。移除：vite-plugin-clean-mock.ts（迁入 `@vv/config` 为 clean-mock-bundled.ts）。**脚本自带 spec 成为新文化**（`test:check-scripts` 50+ 例）。

## 4. 环境变量变化

| 变量                                                                                                                                                | 单应用版                                                          | Monorepo 版                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `VITE_BASE`                                                                                                                                         | 默认 `/`                                                          | 每 app 独立：`/<app>/`（由 manifest/工厂按 app 注入）                                          |
| `VITE_AUTH_ORIGIN`                                                                                                                                  | 不存在（登录是 app 内路由）                                       | **新增**：守卫重定向基址，生产缺省 `/auth`，跨 app 整页跳转核心                                |
| `VITE_APP_ID`                                                                                                                                       | 不存在                                                            | **新增**：app 标识，persist key 前缀防同域多 app localStorage 串台                             |
| `VITE_BUILD_ID`                                                                                                                                     | 不存在                                                            | **新增**：versionCheck 版本检测用（git sha + 构建时间）                                        |
| `VITE_API_BASE_URL`                                                                                                                                 | `src/api/http.ts` 读取                                            | 不变（工厂统一默认值），网关 dev 下 `/api/` 由网关反代 admin                                   |
| 其余（`VITE_USE_MOCK`/`VITE_MENU_SOURCE`/`VITE_DEMO_NO_AUTH`/`VITE_HISTORY_MODE`/`VITE_STORAGE_NAMESPACE`/`VITE_BRAND_COLOR`/`VITE_BEM_PREFIX` 等） | —                                                                 | **全部保留，语义不变**（build:pages 由脚本按 app 注入演示五开关）                              |
| **env 文件载体**                                                                                                                                    | 根级 `.env` / `.env.development` / `.env.production` 三份全局共享 | **每 app 自持**（如 admin 三件、auth 两件）——改某 app 的 env 不影响其他 app；根级 env 文件消失 |

## 5. 登录、会话与跨应用通信

| 维度              | 单应用版                                              | Monorepo 版                                                                                             |
| ----------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 登录页            | `src/modules/auth` 的 `/login`，同 app 内 router.push | 独立 `apps/auth`，`/auth/login?redirect=<完整 URL>`                                                     |
| 未登录跳转        | router.push('/login')                                 | **`window.location.href` 整页跳** `${VITE_AUTH_ORIGIN}/login?redirect=...`（各 app 无共享 router 实例） |
| 登录成功回跳      | 路由内 redirect 参数                                  | 校验 redirect 同域同源前缀（防开放重定向）→ 整页回跳；无 redirect 按角色落 /admin 或 /portal            |
| 登出              | useLogout app 内跳登录页                              | useLogout → 清会话 → 整页跳 auth 出口                                                                   |
| 会话漫游          | 天然同域（只有一个 app）                              | httpOnly cookie host-only，同 origin path 部署下漫游；dev 由 8080 网关复现                              |
| 跨模块/跨应用通信 | `modules/<m>/index.ts` 对外接口                       | app 内不变；**跨 app 禁止 import，只走整页跳转协议**                                                    |

## 6. 路由与模块开发习惯

| 维度         | 单应用版                                                                                             | Monorepo 版                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 模块位置     | `src/modules/<m>/`                                                                                   | `apps/<a>/src/modules/<m>/`（app 内 Feature-Sliced 结构原样保留）                                                                                                                          |
| 路由自动注册 | 唯一 `src/router/auto-register.ts` glob 全模块                                                       | 每 app 自己的 auto-register（glob 本 app modules）；RouteName 联合类型仍全局唯一，check-routes 聚合 6 app                                                                                  |
| 白名单       | 单一 whitelist.ts                                                                                    | 每 app 私有白名单（机制不变：公开访问仍只能按 name 加白名单）                                                                                                                              |
| 远程菜单     | 全局能力                                                                                             | **admin 私有**（useRouterStore 归 `apps/admin/src/store/modules/router.ts`）                                                                                                               |
| 路由守卫     | 5 守卫集中 `src/router/guards/`（auth / login / permission / visibility / composable + remote-menu） | **拆分归属**：login/permission/visibility/composable + whitelist → `@vv/shared/router-guards` 共享骨架；auth（登录编排）+ remote-menu → admin 私有；auto-register/fallback/remote 随各 app |
| 布局         | 5 套 layout 同仓按 meta 切换                                                                         | layout 随 app 归属（default→admin、portal→portal、h5→h5、big→big、blank→auth），布局自包含原则不变                                                                                         |
| 新增模块     | `pnpm new-module` → src/modules                                                                      | 同命令，默认落 admin；骨架带 requiresAuth 教学注释                                                                                                                                         |

## 7. 状态管理

| Store                     | 单应用版                                           | Monorepo 版                                                                    |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| app / user / theme / dict | `src/store/modules/`，单 barrel                    | 下沉 `packages/shared/src/store/`，各 app 经 `@vv/shared/store` re-export 消费 |
| tags-view（多页签）       | 全局 barrel 之一                                   | **归 admin 私有**（多页签是 default layout 私有特性）                          |
| 持久化 key                | 裸 store id（`VITE_STORAGE_NAMESPACE` 隔离多项目） | 追加 `VITE_APP_ID` 前缀（防同域 6 app 互相覆盖 localStorage）                  |
| pinia 实例                | 单实例                                             | 每 app 独立 `createPinia()`（pinia 是 shared 的 peerDependency）               |

## 8. 组件 / Composable / 工具的消费方式（写代码习惯变化）

| 场景                | 单应用版                                                 | Monorepo 版                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AutoImport 来源     | `'@/composables'` 等 app 内路径                          | **包名注入**：`{ from: '@vv/shared', imports: [...] }` / `@vv/ui` 包路径；dts 每 app 独立生成                                                                                                          |
| 全局组件            | unplugin 扫 `src/components` 三目录                      | unplugin **跨包**扫 `@vv/ui` 包源码三目录 + app 私有 `src/components/`；模板直接 `<ProTable />` 规则不变                                                                                               |
| 别名                | 15+1 个别名（`@utils/@store/@api/@components`...）自由用 | app 内 `@/` 永久保留；**跨包消费首选 `@vv/shared` 根 barrel**；`@utils/*` 等深层别名 = 过渡态遗留（新代码禁止，存量已三批 codemod 收敛）；`@components/*` 已全量收敛为 `@vv/ui/components/**` 显式路径 |
| packages/* 内写代码 | 不存在包的概念                                           | **禁止用 AutoImport**，一律显式 import（含 vue/pinia 高频 API），ESLint `local/package-contract` error 级兜底                                                                                          |
| useTheme 等低频 API | AutoImport 注入                                          | 不再注入，显式 `import { useTheme } from '@vv/shared'`                                                                                                                                                 |

## 9. 装配层工厂化（工程配置写法变化）⭐

monorepo 后每个 app 的装配文件从「手抄序列」变为「工厂声明」——这是写代码习惯的深层变化：

| 文件               | 单应用版                                                                                                                                        | Monorepo 版                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.ts`          | ~90 行手动装配（brandColor → title → assertNoMockInProd → createApp → prod-mock → 6×app.use → setDialogAppContext → mount，顺序契约靠注释维护） | **声明式 `bootstrapApp({...})` 工厂**（@vv/shared）：6 app main.ts 只剩差异参数（rootComponent/router/pinia/i18n/title/plugins/loadMockServer/setup），顺序契约固化在工厂 JSDoc              |
| 样式基线四件套     | main.ts 手写 `import 'normalize.css' / 'virtual:uno.css' / '@/assets/styles/index.scss'`                                                        | 一行 `import '@vv/ui/app-styles'`（单源下沉；2026-11-03 起含 EP dark/css-vars）                                                                                                              |
| `vite.config.ts`   | 260 行自装配（vue/jsx/devtools/UnoCSS/AutoImport/Components/Icons/mock/visualizer 全列）                                                        | **~40 行工厂调用**：`createViteConfig({ appRoot, h5Rem, extraPlugins })`；devtools/visualizer 仅 admin 以 extraPlugins 私有装配                                                              |
| 根 `build/` 目录   | aliases/postcss/proxy/scss/server/vendor-chunks 六模块 + 各自 spec                                                                              | **目录消亡**，整体迁为 `@vv/config` 包（aliases.ts → app-aliases.ts；新增 app-manifest / clean-mock-bundled / version-check-vite）                                                           |
| `vitest.config.ts` | 根单文件 `mergeConfig(viteConfig)` 手写                                                                                                         | `createVitestConfig({ appRoot, viteConfig, coverage })` 工厂，每 app/包独立配置文件                                                                                                          |
| `plugins/` 装配    | `src/plugins/` 实体实现 + index.ts 手写注册                                                                                                     | 实现下沉 `@vv/shared/plugins` + **`createAppPlugins` 工厂**；各 app plugins/ 退化为薄封装壳（仅保持相对 import 路径兼容）；**versionCheck 成为第四件套**                                     |
| UnoCSS 配置        | 根 `uno.config.ts` ×1（含 demo 排除扫描豁免）                                                                                                   | 每 app 各一份 ×6（demo 豁免随 apps/docs 走）                                                                                                                                                 |
| **tsconfig 体系**  | 根三件套 references：tsconfig.node + tsconfig.app + tsconfig.vitest                                                                             | 每 app/包自持有 tsconfig 对（app+vitest）+ `@vv/config` 导出 tsconfig.base.json 被 extends；根 tsconfig references 聚合 node + admin + config（类型门禁走 turbo 各包独立 `vue-tsc --build`） |

**习惯影响**：新增 app 不再抄写 90 行装配序列，工厂参数即契约；改全局装配只动工厂单点。

## 10. Mock 体系

| 维度      | 单应用版                          | Monorepo 版                                                                                |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| 位置      | 根 `mock/`                        | `packages/mock/src/`（@vv/mock 包，单一出口）                                              |
| dev 接线  | vite.config 直接 viteMockServe    | 各 app vite 经工厂指向包内 mockPath；`/api/`、`/mock/` 网关统一反代 admin（mock 最全）     |
| prod 接线 | `mock/mockProdServer.ts` 手动接线 | 同机制保留，挪入包内；新增 `check:mock-wiring` CI 门禁防双接线漂移                         |
| 已知风险  | 无                                | turbo 并行 dev 的 bundled 临时文件竞态（已内置 mtime 门槛 + dev:gateway 启动预清双重修复） |

## 11. 测试与质量门禁

| 维度                | 单应用版                                                                                  | Monorepo 版                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单测配置            | 单 vitest.config 手写                                                                     | `createVitestConfig` 工厂派生（见 §9），每 app/包独立配置，turbo 拓扑跑；根 test:coverage/test:ui 收容 admin 口径                                                                         |
| **覆盖率阈值**      | 50/48/45/50（业务全在 src/）                                                              | **admin 重锚定为 34/20/31/35**——业务大头下沉 packages/* 后 admin src 只剩装配壳+views，旧阈值失义；职责降级为「防 CI 倒退」基线，回升靠测试审计专项                                       |
| e2e                 | 单 baseURL，tests/e2e 扁平结构（hello/four-panels/protable×2）                            | tests/e2e 按 app 分目录（admin/big/docs/h5）+ **`gateway/` 跨应用漫游用例**（cross-app-roaming，monorepo 独有的统一登录 e2e 验证）+ playwright projects 分组（迁移曾丢 3 个 spec 已补回） |
| **pre-commit 钩子** | 5 步链：generate:tsconfig-paths → lint-staged → type-check → check:aliases → check:routes | **2 步链：lint-staged + check:routes**——type-check / check:aliases 后移至根 turbo / CI；**提交更快，但类型错误本地不再拦截**                                                              |
| CI                  | 单应用 lint/build/test                                                                    | **turbo affected**：PR 只构建变更波及 app，`.turbo` 缓存接 actions/cache；master 全量                                                                                                     |
| 门禁数量            | check:routes / check:aliases / check:doc-currency（13 项） 等                             | 新增 check:mock-wiring、端口锁死、注册表反向校验、nginx 模板对账、local/package-contract、test:gateway、文档预算冻结（第 14 项）；docs/46 有 13 门禁速查                                  |
| ESLint 边界         | 模块边界铁律靠规范 + review                                                               | **机械强制**：apps↔packages 方向、跨 app 禁止、包间单向，全部 error 级规则                                                                                                                |

## 12. 部署

| 维度          | 单应用版                 | Monorepo 版                                                                                                                                                                         |
| ------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gh-pages 演示 | 单 app hash 模式直发     | `build:pages` 六应用聚合：`dist/<app>/` 子目录 + 落地导航页（绕开 Pages 单 404.html 限制）                                                                                          |
| 生产部署      | 无内置方案（自行 nginx） | **新增完整链路**：根 Dockerfile 多阶段 + docker-compose.prod.yml + `deploy/nginx.prod.conf.template`（API_UPSTREAM envsubst 反代真实后端，SSE 关缓冲），路径语义与 dev 网关逐条对齐 |
| 版本检测      | 无                       | **新增 versionCheck**：轮询 version.json 比对 buildId + ChunkLoadError 白屏兜底，工厂默认装配 6 app 零改动                                                                          |

## 13. 治理与协作

| 维度          | 单应用版                                     | Monorepo 版                                                                                                                                                                               |
| ------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lockdown 对象 | `src/` 一级目录清单                          | workspace 两级拓扑 + 各 app 内部 src 结构（§2），修改申请模板不变                                                                                                                         |
| 退役机制      | 无                                           | §2.6：门禁退役准则 / app keep-kill 复审 / 文档预算冻结                                                                                                                                    |
| 依赖版本      | 单 package.json 平铺（Vue `^3.5.38` 稳定线） | pnpm-workspace.yaml **catalog 单版本源** + overrides 钉版；**Vue 跨越至 3.6.0-beta.17 精确钉版**（catalog + overrides 双钉全部 @vue/* 子包，2027-01-31 前须回稳定线——平台级 beta 风险项） |
| 文档体系      | docs 根级编号文档 ~39 篇                     | **48 篇**（新增 42 评估/43 monorepo 指引/44 versionCheck/45 仓库定位/46 CI 门禁速查/47 能力清单/48 本文档）；**文档数量本身成为 CI 冻结对象**（check-doc-currency 第 14 项预算机制）      |
| 决策记录      | CHANGELOG                                    | 曾试 DECISIONS.md 机检台账，当日退役（裁决：治理税归 AI，人工维护税归零）                                                                                                                 |

## 14. 完全没变的能力（平移清单）

四栖面板全部业务能力原样保留：ProTable 双引擎（EP/vxe）/ ProDialog / ProDialogForm / XForm / RichTextEditor / AsyncState 三态 / 弹窗族（useDialog/useConfirm/useLogout）/ 指令族（v-auth/v-copy/v-draggable/防抖）/ 字典 useDict / 主题 useTheme / i18n / 图标体系（unplugin-icons 双语法）/ BEM 规范（vv 前缀 + $BEM_PREFIX）/ rem 适配（h5）/ scale 适配（big）/ 错误边界三件套 / httpOnly cookie 会话 / pinia pick 持久化 / new-module/remove-module / commitlint + cz / release 发版流。

逐项核实过的保留项：mock/pro-table **11 个具名数据源**（big-data/employee/expand/filter-orders/grouped-employees/orders/org-chart/sort-orders/style-override/summary-orders/tasks）/ `VITE_QUIET_DEV` 控制台徽章（@vv/ui global-components）/ webVitals 性能采集（下沉 shared/plugins，web-vitals catalog 化）/ ElementPlusResolver `importStyle: 'css'` 按需注入 / 样式资产 11 文件（reset/variables/theme/transition/element-overwrite/custom + mixins×3 完整平移 @vv/ui）/ api 基建 14 个模块文件 + types 目录（cache/cancel/error-events/global-abort/http/http-errors/mock-guard/page-adapter/request-id/request-merger/retry/stream/token-refresh/validator 完整平移 @vv/shared）/ App.vue 三层职责（ElConfigProvider + ErrorBoundary + AsyncState 骨架屏）/ README.en.md 英文门面（已同步 monorepo 口径与定位声明）/ `VITE_USE_MOCK` 等环境变量语义（见 §4）。

## 15. 使用习惯迁移速查（旧肌肉记忆 → 新动作）

| 你以前…                                  | 现在…                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev` 然后开 5174                   | `pnpm dev:gateway` 然后开 **8080**                                      |
| 改完代码直接 `localhost:5174/login` 登录 | `localhost:8080/auth/login`（或任一面板未登录自动整页跳过去）           |
| `pnpm test src/xxx.spec.ts`              | `pnpm -C apps/admin test src/xxx.spec.ts`                               |
| 在 `src/modules/` 下 new-module          | 同命令，默认落 `apps/admin/src/modules/`                                |
| `import { x } from '@utils/y'`           | `import { x } from '@vv/shared'`（barrel）                              |
| 引用组件目录 `@components/ProTable`      | `@vv/ui/components/ProTable/index.ts` 显式路径（或模板直接用不 import） |
| 加端口/加应用要改一堆配置                | 改 `app.manifest.json` 一处（或 `pnpm new-app` 全自动）                 |
| 直连 5174 调 mock                        | 走 8080 的 `/api/` 或 `/mock/`（网关反代 admin）                        |
| 单 app 构建部署                          | `build:pages`（演示）/ `build:prod` + Dockerfile（生产）                |

## 16. 选型建议

**分支对照**（两种形态在仓库中以 git 分支承载，clone 后切换分支即用）：

| 你的场景                                        | 推荐形态                       | 对应分支           |
| ----------------------------------------------- | ------------------------------ | ------------------ |
| 对构建体积不敏感、页面量小、追求快速开发部署    | 单应用版（v2.x 形态）          | `release/single`   |
| 项目大页面多、对构建体积敏感（按 app 独立构建） | Monorepo 多应用版（v3.x 形态） | `release/monorepo` |

| 你的场景               | 建议                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 从零开始的新项目       | 直接用当前 Monorepo 版；先读 [docs/10 新手指引](10-新手指引.md) 跑通，再按 §2/§15 建立日常习惯                           |
| 只想要一个中后台 app   | 取 `apps/admin` + `packages/*` 即可（包与 app 间仅 workspace 链接耦合，详见 [docs/43](43-Monorepo结构与开发指引.md) §8） |
| 从单应用版（v2.x）升级 | 重点看 §2（启动入口变化）、§5（登录协议变化）、§8/§9（写代码方式变化）、§15（习惯速查）                                  |
| 评估是否采用本底座     | 看 §0/§1 判断形态匹配度，§1.1 确认能力完整性，§14 确认业务能力清单；注意 §13 的 Vue beta 钉版风险项                      |
| 想了解某一面板细节     | admin → docs/07；portal → docs/41；h5 → docs/34；big → docs/35；docs 站 → docs/09；统一登录 → docs/43 §5                 |

**相关文档**：[docs/42-Monorepo多应用改造评估](42-Monorepo多应用改造评估.md)（拆分前的收益/成本/风险论证）、[docs/43-Monorepo结构与开发指引](43-Monorepo结构与开发指引.md)（当前版日常开发入口）、[docs/47-能力体验清单](47-能力体验清单.md)（当前版全能力操作手册）。
