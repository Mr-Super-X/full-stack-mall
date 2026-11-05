# Monorepo 全量迁移设计稿

> **状态**：已批准（2026-10-21，用户拍板全量范围 + pnpm/Turborepo + feature/monorepo 分支 + apps/docs 独立 + 本地同域复现）
> **前置评估**：[`docs/42-Monorepo多应用改造评估.md`](../../../42-Monorepo多应用改造评估.md)（耦合点 C1-C14、风险 R1-R6 沿用其编号）
> **基线分支**：`feature/monorepo` @ 338f295（== feature/engine-optimization）
> **目标**：把 Feature-Sliced 单体拆为 `packages（4 个共享包）+ apps（6 个应用）`，统一登录为独立 auth 应用，pnpm workspace + Turborepo 编排，每阶段可验证可回退。

---

## 1. 已确认决策清单

| # | 决策点 | 结论 |
|---|--------|------|
| V1 | 拆分范围 | 全量 6 app：auth（统一登录）/ portal / admin / big / h5 / docs |
| V2 | 编排工具 | pnpm workspace（catalog 单版本源）+ turbo@2.11 |
| V3 | 实验分支 | `feature/monorepo`，从 feature/engine-optimization HEAD 切出 |
| V4 | demo 文档站 | 独立为 `apps/docs`（不留在 admin） |
| V5 | dev 统一登录 | 附带 docker-compose + nginx 本地同域复现（P5 增强项） |
| V6 | src/ Lockdown | 本分支内放宽（用户指令批准），治理条款随 P5 改写 |

## 2. 目标结构

```
vue3-vite-project/
├── pnpm-workspace.yaml          # packages: [apps/*, packages/*] + catalog
├── turbo.json                   # dev/build/lint/test/typecheck 任务图
├── package.json                 # 根：私有，devDeps（eslint/vitest/playwright/turbo）+ 全局脚本
├── pnpm-lock.yaml               # 单 lockfile
├── packages/
│   ├── config/                  @vv/config
│   │   └── src/                 vite 工厂 createViteConfig(appOptions) + tsconfig.base.json
│   ├── shared/                  @vv/shared
│   │   └── src/                 utils/ enums/ types/ api/ composables/ directives/
│   │                            store/（app/user/theme/dict）locales/ helpers（brandColor 等）
│   ├── ui/                      @vv/ui
│   │   └── src/                 components/{common,ProTable,form-schema}/ assets/icons/
│   │                            styles/ + createGlobalComponents() 插件
│   └── mock/                    @vv/mock
│       └── src/                 mock 数据模块/ _utils/ mockProdServer（双接线唯一出口）
└── apps/
    ├── auth/                    统一登录：modules/auth 迁来 + blank layout + 自有守卫
    ├── portal/                  门户：modules/home + portal layout（白名单公开）
    ├── admin/                   中后台：modules/{user,reports,workbench,error} + default layout
    │                            + tags-view store（多页签私有）+ 远程菜单
    ├── big/                     大屏：modules/big-demo + big layout
    ├── h5/                      移动端：modules/h5-demo + h5 layout + pxtorem 规则
    └── docs/                    文档站：modules/demo 全量（145 文件，含自有 layouts/composables）
```

### 2.1 现有模块 → 应用归属表（**终态**；迁移期全部内容先汇聚 apps/admin，见 §5-P0）

| 现有 `src/modules/*` | 去向 | 布局 | 公开性 |
|----------------------|------|------|--------|
| auth | apps/auth | blank | 公开（白名单） |
| home | apps/portal | portal | 公开（白名单） |
| user / reports / workbench / error | apps/admin | default | 登录后 |
| big-demo | apps/big | big | 公开（演示） |
| h5-demo | apps/h5 | h5 | 公开（演示） |
| demo | apps/docs | 自带 DemoDocs/DocLayout | 公开（VITE_DEMO_NO_AUTH） |

### 2.2 全局层 → 包归属表

| 现有 `src/*` | 去向包 | 说明 |
|--------------|--------|------|
| utils/ enums/ types/ | @vv/shared | 纯函数与类型原样迁移 |
| api/（http/cache/retry/token-refresh + modules/） | @vv/shared | 网络基建；VITE_API_BASE_URL 等 env 约定不变 |
| composables/（8 个） | @vv/shared | AutoImport 改从包名注入（见 D3） |
| directives/ | @vv/shared | 以 Vue 插件形式导出 |
| store/modules/{app,user,theme,dict} | @vv/shared | 跨 app 会话/UI/主题/字典基建 |
| store/modules/tags-view | apps/admin | 多页签是 default layout 私有特性 |
| locales/ | @vv/shared | 文案全集；各 app 按需 tree-shake |
| components/{common,ProTable,form-schema}/ | @vv/ui | 源码直消费，**不构建 dist**（§3-D3） |
| assets/icons/ + assets/styles/ | @vv/ui | FileSystemIconLoader 路径随包迁移 |
| layouts/ | 各 apps/* | 布局自包含原则不变（CLAUDE.md §1.2 精神延续） |
| router/（guards/whitelist/remote-menu/auto-register） | 拆三分 | 守卫骨架→@vv/shared；auto-register/白名单→各 app；远程菜单→admin |
| mock/ | @vv/mock | 双接线收敛为单一包出口（化解 C5） |
| build/ | packages/config | aliases.ts 退役（D4），其余 config 模块迁入 |

## 3. 关键设计决策

### D1 统一登录会话模型（化解 C6 / R1）

**生产拓扑：单域 path 部署**（同 origin，host-only httpOnly cookie 即可漫游，无需 Domain 属性）：

```
https://example.com/
├── /auth/*   → auth 应用（/auth/login、/auth/logout）
├── /portal/* → portal 应用
├── /admin/*  → admin 应用
├── /big/*    → big 应用
├── /h5/*     → h5 应用
└── /docs/*   → docs 应用
```

- **守卫协议**：各 app 守卫检测到无会话（Session.get('auth') 缺失或 profile 拉取 401）→ `window.location.href = /auth/login?redirect=<encodeURIComponent(当前完整 URL)>`。跨 app 边界用整页跳转而非 router.push（不同 app 无共享 router 实例）。
- **auth 登录成功**：校验 redirect 参数必须为同域同源前缀（防开放重定向），然后 `window.location.href = redirect`；无 redirect 时按角色落 /admin 或 /portal。
- **nginx 示例**（生产与本地 docker-compose 复用同一语义）：

```nginx
location /admin/ { alias /srv/www/admin/; try_files $uri /admin/index.html; }
location = /     { return 302 /portal/; }
```

- **登出**：auth 提供 /auth/logout 清会话后跳 /portal；useLogout 跨 app 语义不变（跳 auth 出口）。

### D2 演示部署（gh-pages 多 app 聚合）

- 每 app 独立构建：`base=/vue3-vite-project/<app>/` + **hash 模式**（Pages 无 SPA fallback，沿用现有 VITE_HISTORY_MODE 机制）。
- 聚合发布：各 app dist 内容复制为发布根下的 `<app>/` 子目录 + 手工 `index.html` 落地导航页（链接 6 个入口）。单 Pages 站点承载，**绕开"仅一个 404.html"限制**（评估 R3 化解）。
- 生产部署仍用 web history 模式，由每 app `.env.production` 控制；Pages 构建时由 deploy.yml 注入 `VITE_HISTORY_MODE=hash` 覆盖（Vite env 优先级：进程 env > .env 文件），两者互不污染。

### D3 组件与 AutoImport 机制（化解 C2 / C3）

- **源码直消费**：@vv/ui 不建 dist，`package.json` 以 `exports` 指源码：

```json
{ "name": "@vv/ui", "exports": { ".": "./src/index.ts", "./*": "./src/*" } }
```

- **unplugin dirs 跨包扫描**：各 app vite 配置（经 @vv/config 工厂拼好）：

```ts
Components({
  dirs: [
    fileURLToPath(new URL('../../packages/ui/src/components/common', import.meta.url)),
    fileURLToPath(new URL('../../packages/ui/src/components/ProTable', import.meta.url)),
    fileURLToPath(new URL('../../packages/ui/src/components/form-schema', import.meta.url)),
    'src/components', // app 自有
  ],
  deep: true,
  dts: 'src/types/components.d.ts', // 每 app 独立生成
})
```

- **GlobalComponents 插件**：`src/components/index.ts` 改造为 @vv/ui 导出的 `createGlobalComponents()`（`import.meta.glob` 相对包内路径，pnpm 符号链接下可解析；若 deep 扫描异常则 fallback 为显式 barrel，P1 验证点）。
- **AutoImport 包名注入**：`{ from: '@vv/shared', imports: ['useAppRouter', 'useRequest', ...] }`——unplugin 走 node 解析到 workspace 包；dts 每 app 生成到 `apps/<a>/src/types/auto-imports.d.ts`。
- **IDE 智能提示风险**：跨包 GlobalComponents 类型合并依赖各 app 自己的 components.d.ts，§1.7 强约束在新结构下以「包名 + dts 每 app 生成」延续，P1 必须实测 hover 验证。

### D4 包间引用与别名体系（化解 C3 / C11）

- **包间一律包名**：`@vv/shared`、`@vv/ui` 等 + workspace 协议 `"@vv/shared": "workspace:*"`。
- **app 内保留 `@/`** 指自身 src（既有心智与 660 文件内的模块内引用不变，回归面最小）。
- **catalog 单版本源**：vue / element-plus / pinia / vue-router 等版本在 `pnpm-workspace.yaml` 的 `catalog:` 集中声明，各 app 用 `"catalog:"` 引用；允许个别 app 显式覆写版本（技术栈分叉逃生门）。
- **退役**：`build/aliases.ts` 的 15+1 别名缩减为每 app 单一 `@/`；`generate:tsconfig-paths` 脚本删除；`check:aliases` 改为校验「import 面只允许 @vv/* 包名 + @/」（ESLint no-restricted-imports 兜底 + 脚本双重）。
- **tsconfig**：@vv/config 导出 `tsconfig.base.json`（含 vue-tsc 严格项 noUncheckedIndexedAccess 等）；各 app tsconfig extends 它 + 自己的 paths。

### D5 路由自动注册（化解 C1）

- 每 app 持有 `src/router/auto-register.ts`。**主方案：相对字面量** `import.meta.glob('../modules/**/routes/index.ts', { eager: true })`（以 `src/router/auto-register.ts` 所在目录为基，指向本 app 的 `src/modules/**`）。**回退方案**：Vite 8 对相对 glob 的 eager 语义若与预期不符，则改用 `import.meta.glob('/src/modules/**/routes/index.ts')` 式绝对字面量（各 app root 独立，语义与现状完全一致）——P1 首个验证点，定稿后全 app 复制同一形态。
- `COMPONENT_REGISTRY` 随 app 私有（远程菜单仅 admin 使用）。
- **RouteName 联合类型**：仍全局唯一（约定不变），`check-routes` 聚合 6 app 校验。

### D6 状态管理分层

| Store | 归属 | 持久化 | 跨 app |
|-------|------|--------|--------|
| app / theme | @vv/shared | pick 持久化（layout/locale、mode/primaryColor） | ✅ 每 app 独立 pinia 实例，localStorage key 建议加 app 前缀防串台（如 `vv-admin:`） |
| user / dict | @vv/shared | 内存态 / 5min TTL | ✅ 同上 |
| tags-view | apps/admin | 不持久化（现状保留） | ❌ admin 私有 |

- pinia 为 @vv/shared 的 peerDependencies；各 app main.ts 自行 `createPinia()` + persistedstate 插件。
- **持久化 key 前缀**：迁移时把 persistedstate 的 key 从裸 store id 改为 `<app>:<store>`，防止同域多 app 互相覆盖（新增决策，P2 实施）。

### D7 main.ts 装配序列（化解 C8）

- 各 app 保留自己的 main.ts（模板用户单 app 复制时自包含），但三步敏感逻辑抽 @vv/shared helpers：`injectBrandColor()` / `initDocumentTitle()` / `assertNoMockInProd()`。
- prod mock 挂接（`VITE_USE_MOCK==='true'` 时 await setupProdMockServer）由各 app 从 @vv/mock 导入，**app.use(router) 前**的强约束注释随代码迁移保留。
- `setDialogAppContext(app)` 不变（useDialog 上下文）。

### D8 mock 包（化解 C5）

- @vv/mock 单一出口：`mock/index.ts`（dev 聚合）+ `mockProdServer.ts`（prod 接线）同包维护，消灭"删文件三处同步"现状。
- 各 app vite `viteMockServe({ mockPath: fileURLToPath(new URL('../../packages/mock/src', import.meta.url)) })`。
- gh-pages 演示：apps/docs 等仍用 `VITE_USE_MOCK=true` 客户端劫持，机制不变。

## 4. 会话与部署详设

### 4.1 生产部署

- 同域 path 前缀（§3-D1），nginx 分流；cookie host-only（同 origin 无需 Domain）。
- 各 app `.env.production`：`VITE_BASE=/<app>/`、`VITE_HISTORY_MODE=web`、`VITE_AUTH_ORIGIN=/auth`（守卫重定向基址，env 化便于环境切换）。

### 4.2 gh-pages 演示（deploy.yml 重写）

- matrix/循环构建 6 app → `dist/auth`、`dist/portal`… → 加落地页 `dist/index.html`（6 入口链接）→ Pages。
- env 四开关沿用（VITE_MENU_SOURCE=local、VITE_USE_MOCK=true、VITE_DEMO_NO_AUTH=true、hash）。

### 4.3 本地同域复现（V5，P5 交付）

```yaml
# docker-compose.yml（根）：nginx :8080 反代 6 个 vite dev server
services:
  gateway:
    image: nginx:alpine
    ports: ["8080:80"]
    volumes: ["./docker/nginx.dev.conf:/etc/nginx/conf.d/default.conf:ro"]
  # apps 的 dev server 在宿主机 turbo run dev 起，nginx 经 host.docker.internal 反代
```

- 每 app dev 以 `vite --base=/<app>/` 启动（base 经 @vv/config 按 app 名注入）；nginx 反代**保留前缀**（无尾斜杠路径改写，因为 vite dev 以 base 前缀接请求）：

```nginx
# docker/nginx.dev.conf（端口为示例，P5 定稿；host.docker.internal 指向宿主机 dev server）
location /admin/ { proxy_pass http://host.docker.internal:5171; }  # 注意：无 URI 部分 = 保留原始路径
```

- 浏览器只访问 `localhost:8080` → 同 origin → cookie 漫游 → 统一登录 dev 可验。

## 5. 迁移计划（每阶段独立可验证、可 revert）

| 阶段 | 内容 | 验证标准 | 预估 |
|------|------|----------|------|
| **P0 骨架** | pnpm-workspace + turbo.json + 根 package.json 瘦身；`git mv` 把现 `src/` **整体迁入 apps/admin/src**（9 模块 + 5 布局 + 完整 router/store 全在 admin，保证任意时刻主干可构建）；packages/ 建 4 个空壳；其余 5 app 为可启动最小占位 | `pnpm install` 通、admin dev/build/test/typecheck 与迁移前一致（基线对比）、git 历史保留 | 0.5 天 |
| **P1 抽包** | 按依赖拓扑 mock→config→shared→ui 迁移；admin 暂承载全部业务，但全局层改从 @vv/* 消费；vite.config 改走 createViteConfig 工厂；unplugin/auto-import 链路打通 | admin dev/build/test/typecheck 全绿；IDE hover（§1.7）抽测通过 | 8~12 天 |
| **P2 docs 抽离** | modules/demo → apps/docs（含 layouts/DemoDocs/DocLayout、composables、config、examples、docs 文案）；docs 独立 dev/build | docs 单独可跑、路由白名单生效、gh-pages 双 app 聚合部署成功 | 2~3 天 |
| **P3 三小 app** | portal / h5 / big 并行抽离（各自 1 个模块 + 1 套布局） | 各 app dev/build/test 绿；e2e 冒烟 | 2~3 天 |
| **P4 auth + admin 收敛** | modules/auth → apps/auth（统一登录落地 + 跨 app 重定向协议）；user/reports/workbench/error 归位 admin；tags-view 归 admin；持久化 key 加 app 前缀 | 统一登录全链路（auth→admin→登出→portal）；admin 回归绿 | 3~5 天 |
| **P5 工具链治理** | 6 脚本多包重写；check-doc-currency 硬数据锁重建；ci.yml 改 turbo affected；deploy.yml 6 app 聚合；docker-compose 同域复现；CLAUDE.md §2 改写 + 41 份文档路径更新 | CI 绿、Pages 6 app 可访问、本地 8080 同域登录漫游、文档一致 | 5~8 天 |

**关键路径**：P1 抽包（unplugin/别名/双注册三处机制重写）。P2–P4 因模块边界早已切好，主要成本是搬运与验证。

## 6. 测试策略

- **单测**：vitest 根配置统一跑 `packages/*/src/**/*.spec.ts` + `apps/*/src/**/*.spec.ts`，alias 直接指 workspace 源码（不建 dist 的直接收益）；覆盖率门槛 50+ 保持。
- **e2e**：playwright projects per app（baseURL = 各 dev server 端口或 8080 网关）；跨 app 关键流程（登录→admin→登出）走 8080 网关 project。
- **每阶段门禁**：`turbo run lint test typecheck build` 全绿才算阶段完成（P0 除外）。

## 7. 风险清单（继承评估文档 R1–R6，新增 R7–R9）

| # | 风险 | 缓解 |
|---|------|------|
| R1 | 会话跨域 | D1 同域 path 部署化解；dev 由 4.3 网关复现 |
| R2 | unplugin 跨包扫描/GlobalComponents 类型 | D3 源码直消费 + P1 设专项验证点；fallback 显式 barrel |
| R3 | Pages 多 app 部署 | D2 子目录 + 落地页 |
| R4 | 脚本重写期门禁失效 | 旧脚本在 P5 前保留可用（双跑比对输出） |
| R5 | 模板受众收窄 | 本分支实验性质；单 app 使用文档保留"只取 apps/admin + packages 即可"说明 |
| R6 | 迁移期长分支 | 每阶段独立 commit 批次，用户逐批审；必要时按 P 阶段 PR |
| R7 | pnpm 符号链接下 sass additionalData 跨包 `@use` 路径 | @vv/config 工厂内 additionalData 用绝对路径注入 bem.scss |
| R8 | 持久化 key 冲突（同域多 app 共享 localStorage） | D6 加 app 前缀；P2 实施时写迁移说明 |
| R9 | vite dev 对 workspace TS 源码包的预构建边界 | optimizeDeps.exclude 视 P1 实测补；vue-tsc 用 bundler resolution |

## 8. 验收标准（Definition of Done）

1. 6 app 各自 `dev / build / test / typecheck` 全绿；`turbo run build` 拓扑序一次通过。
2. 统一登录全链路：直接访问 /admin/xxx 未登录 → /auth/login → 登录 → 跳回原地址 → 登出回门户。
3. gh-pages 演示站 6 入口可访问，docs 站点渲染正常。
4. `localhost:8080` 网关下同域漫游与生产行为一致。
5. CI（turbo affected）绿；`check-routes`/`check:aliases`（新语义）绿。
6. CLAUDE.md（§1/§2/§4）与相关 docs 同步改写，`check-doc-currency` 重建后绿。

## 9. 明确不做的（YAGNI 清单）

- 不构建 @vv/* 的 dist（源码直消费）；未来要发 npm 时再补 build 配置。
- 不做子域名部署方案（path 部署已满足，子域需 Cookie Domain + CORS，复杂度无收益）。
- 不做 Nx 迁移/Turborepo 远程缓存（本地缓存够用，远程缓存需托管服务）。
- 不重写 ProTable/form-schema 内部实现（原样搬迁）。
- 不动 mock 数据内容本身（只搬位置）。
