# Monorepo 全量迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Feature-Sliced 单体拆为 `packages（4 共享包）+ apps（6 应用）`，pnpm workspace + Turborepo 编排，统一登录独立为 auth 应用，每阶段可验证可回退。

**Architecture:** P0 先把 `src/` 整体迁入 `apps/admin` 保证主干常绿；P1 按依赖拓扑抽 `@vv/config → @vv/mock → @vv/shared → @vv/ui` 四个源码直消费包（不构建 dist），admin 改经工厂消费；P2–P4 把 docs/portal/h5/big/auth 五个应用逐个从 admin 摘出；P5 重写工具链脚本、CI、部署与治理文档。

**Tech Stack:** pnpm workspace（catalog）+ turbo@2.11 + Vite 8 + vue-tsc 3 + Vitest 4 + Playwright 1.63。

**Spec:** [`docs/superpowers/specs/2026-10-21-monorepo-migration-design.md`](../specs/2026-10-21-monorepo-migration-design.md)（决策 D1–D8、风险 R1–R9、耦合点 C1–C14 沿用其编号）

**关键执行约定：**
- 每个 Task 完成并验证后 commit，msg 用中文（`feat/refactor/chore/docs` 前缀）；
- 任一验证命令失败 → 停止修复，禁止跳步；
- 阶段门禁 = 该 Phase 全部 Task 的验证命令全绿 + `pnpm -C apps/admin build` 产物基线不回归（常规 prod 36 chunk/4.0M 量级）。

---

## 文件结构总图（终态，P5 完成时）

```
apps/{auth,portal,admin,big,h5,docs}/    # 各自 index.html / vite.config.ts / src/{main.ts,router,modules,...}
packages/{config,shared,ui,mock}/        # @vv/* 源码直消费包
根：pnpm-workspace.yaml / turbo.json / package.json / vitest.playwright 等编排配置
```

---

## Phase P0 — Workspace 骨架（0.5 天）

### Task P0-1：创建 workspace 骨架文件

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: `package.json`（根，瘦身+编排脚本）
- Create: `apps/admin/package.json`

- [ ] **Step 1: `pnpm-workspace.yaml`（全量内容）**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
catalog:
  vue: '^3.5.38'
  vue-router: '^5.1.0'
  pinia: '^3.0.4'
  element-plus: '^2.14.3'
  axios: '^1.18.1'
  dayjs: '^1.11.21'
  vue-i18n: '^11.4.6'
```

- [ ] **Step 2: `turbo.json`（全量内容）**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": { "persistent": true, "cache": false },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "type-check": {},
    "lint": {}
  }
}
```

- [ ] **Step 3: 根 `package.json` 改造** — 保留全部 dependencies/devDependencies 原位不动（P1 再收敛），仅改以下字段：

```jsonc
{
  "name": "vue3-vite-workspace",
  "private": true,
  "scripts": {
    "preinstall": "npx only-allow pnpm",
    "dev": "turbo run dev",
    "dev:local": "pnpm -C apps/admin dev:local",
    "build": "turbo run build",
    "test": "turbo run test",
    "type-check": "turbo run type-check",
    // 以下脚本在 Task P0-2 改为 apps/admin 路径感知，命令名不变
    "check:routes": "node --experimental-strip-types scripts/check-routes.ts",
    "check:aliases": "node --experimental-strip-types scripts/check-aliases.ts",
    "check:doc-currency": "node --experimental-strip-types scripts/check-doc-currency.ts",
    "new-module": "node --experimental-strip-types scripts/new-module.ts",
    "remove-module": "node --experimental-strip-types scripts/remove-module.ts",
    "analyze": "cross-env ANALYZE=true pnpm -C apps/admin build-only",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test:e2e": "playwright test",
    "test:e2e:install": "playwright install --with-deps chromium",
    "bench": "pnpm -C apps/admin bench",
    "commit": "git add . && cz",
    "push": "git add . && cz && git push",
    "release": "release-it",
    "release:dry": "release-it --dry-run",
    "commitlint": "commitlint --edit",
    "prepare": "husky"
  }
}
```

- [ ] **Step 4: `apps/admin/package.json`（全量内容）**

```json
{
  "name": "@vv-app/admin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:local": "cross-env VITE_MENU_SOURCE=local vite",
    "build": "run-s \"build-only {@}\" \"type-check:full\" --",
    "build-only": "vite build",
    "type-check": "vue-tsc --build",
    "type-check:full": "vue-tsc --build --force",
    "test": "vitest run",
    "test:watch": "vitest",
    "bench": "vitest bench --run --reporter=basic",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 5: 验证**

Run: `pnpm install`
Expected: 生成 `pnpm-lock.yaml`（或更新既有 lockfile），无 ERESOLVE 错误。

### Task P0-2：目录迁移 + 引用修正

**Files:**
- Move: `src/` → `apps/admin/src/`，`index.html` → `apps/admin/index.html`，`vite.config.ts` → `apps/admin/vite.config.ts`，`vitest.config.ts` → `apps/admin/vitest.config.ts`，`uno.config.ts` → `apps/admin/uno.config.ts`，`env.d.ts` → `apps/admin/env.d.ts`，`.env*`（3 个）→ `apps/admin/`，`public/` → `apps/admin/public/`，`tsconfig.app.json` + `tsconfig.app.base.json` + `tsconfig.vitest.json` → `apps/admin/`
- Modify: `tsconfig.json`（references 路径）、`apps/admin/vite.config.ts`（相对 import）、`playwright.config.ts`（webServer 命令）、`scripts/check-routes.ts` + `scripts/new-module.ts` + `scripts/remove-module.ts`（MODULES_DIR/ROUTER_DIR 常量）

- [ ] **Step 1: 批量 git mv（保留历史）**

```bash
mkdir -p apps/admin && git mv src apps/admin/src && git mv index.html apps/admin/index.html && \
git mv vite.config.ts apps/admin/vite.config.ts && git mv vitest.config.ts apps/admin/vitest.config.ts && \
git mv uno.config.ts apps/admin/uno.config.ts && git mv env.d.ts apps/admin/env.d.ts && \
git mv public apps/admin/public && \
git mv tsconfig.app.json tsconfig.app.base.json tsconfig.vitest.json apps/admin/
```

`.env`、`.env.development`、`.env.production` 未被 git 跟踪则直接 `mv`（git mv 会报 not under version control）。

- [ ] **Step 2: 根 `tsconfig.json` references 改指**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./apps/admin/tsconfig.app.json" },
    { "path": "./apps/admin/tsconfig.vitest.json" }
  ]
}
```

- [ ] **Step 3: `apps/admin/vite.config.ts` 修正两处相对 import + main.ts 的 mock 挂接路径**

```ts
// 原：import { cleanMockBundled } from './scripts/vite-plugin-clean-mock'
import { cleanMockBundled } from '../../scripts/vite-plugin-clean-mock'
// 原：import { ... } from './build'
import { ... } from '../../build'
```

```ts
// apps/admin/src/main.ts（P0 期间 mock/ 仍在仓库根，P1-2 再改 @vv/mock）
// 原：await import('../mock/mockProdServer')
await import('../../mock/mockProdServer')
```

`vitest.config.ts` 与 `vite.config.ts` 同目录，import './vite.config' 不变。

- [ ] **Step 4: `playwright.config.ts` webServer 命令**

```ts
command: 'pnpm -C apps/admin dev:local',
```

- [ ] **Step 5: 三个脚本的路径常量**（各自文件顶部）：

```ts
// scripts/check-routes.ts（约 26-27 行）
const ROUTER_DIR = resolve(ROOT, 'apps/admin/src/router')
const MODULES_DIR = resolve(ROOT, 'apps/admin/src/modules')
// scripts/new-module.ts / remove-module.ts：同理把 'src/modules' 改为 'apps/admin/src/modules'，
// RouteName/types 目标路径同步改 'apps/admin/src/types'
```

- [ ] **Step 6: 根 `tsconfig.node.json`** — include 中的 `vite.config.ts`/`vitest.config.ts` 等条目改为 `apps/admin/vite.config.ts`、`apps/admin/vitest.config.ts`（读原文件全量替换）。

- [ ] **Step 7: 验证基线**

```bash
pnpm install && pnpm dev:local   # 5174 端口启动，浏览器手动看首页
pnpm test                        # 全绿
pnpm check:routes                # 通过
pnpm -C apps/admin build         # 产物 ≈36 chunk/4.0M（与 CLAUDE.md v2.2.1 基线一致）
VITE_USE_MOCK=true pnpm -C apps/admin build-only   # prod-mock 挂接冒烟（main.ts 动态 import 路径正确）
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "refactor(monorepo): P0 workspace 骨架，src 整体迁入 apps/admin"
```

---

## Phase P1 — 共享包抽包（8~12 天，关键路径）

> **别名策略（对 spec D4 的执行细化，已在评审会声明）**：P1 不做 660 文件 import codemod，改为**别名重定向**——16 个别名名不动，vite/tsconfig 中把全局层别名指向 packages/* 源码；`@vv/*` 包名同时存在（package.json + exports），供 unplugin `from:` 与 ESLint 边界使用。P5 视情况再做包名 codemod 收紧。

### Task P1-1：@vv/config 配置工厂包

**Files:**
- Move: `build/{scss,vendor-chunks,server,proxy,postcss}.ts` → `packages/config/src/`
- Create: `packages/config/package.json`、`packages/config/tsconfig.json`、`packages/config/src/index.ts`、`packages/config/src/create-vite-config.ts`、`packages/config/src/app-aliases.ts`、`packages/config/tsconfig.base.json`
- Delete: `build/aliases.ts`（由 app-aliases.ts 取代）、`build/scripts/generate-tsconfig-paths.ts`（退役，根 package.json 删对应 script）
- Modify: `apps/admin/vite.config.ts`（改工厂消费）、`apps/admin/tsconfig.app.json`（paths 简化）

- [ ] **Step 1: 包骨架**

`packages/config/package.json`：

```json
{
  "name": "@vv/config",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts", "./*": "./src/*" },
  "scripts": { "type-check": "vue-tsc --build" },
  "devDependencies": { "typescript": "~6.0.0" }
}
```

`packages/config/tsconfig.json` extends 见 Step 4 的 tsconfig.base.json。

- [ ] **Step 2: git mv 五个配置模块** 并按原 barrel 建 `packages/config/src/index.ts`：

```bash
mkdir -p packages/config/src && git mv build/scss.ts build/vendor-chunks.ts build/server.ts build/proxy.ts build/postcss.ts packages/config/src/
git mv scripts/vite-plugin-clean-mock.ts packages/config/src/clean-mock-bundled.ts
```

```ts
// packages/config/src/index.ts
export * from './scss'
export * from './vendor-chunks'
export * from './server'
export * from './proxy'
export * from './postcss'
export * from './app-aliases'
export * from './create-vite-config'
```

- [ ] **Step 3: `packages/config/src/app-aliases.ts`（全量，取代 build/aliases.ts）**

```ts
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const UI_DIR = fileURLToPath(new URL('../../ui/src', import.meta.url))
const SHARED_DIR = fileURLToPath(new URL('../../shared/src', import.meta.url))
const MOCK_DIR = fileURLToPath(new URL('../../mock/src', import.meta.url))

/**
 * 生成某 app 的 resolve.alias（单一来源）。
 * 包间一律映射到 @vv/* 包源码；app 私有别名（@/、@modules、@layouts、@router、@plugins）指向 app 自身 src。
 */
export function createAppAliases(appRoot: string): Record<string, string> {
  return {
    '@': path.join(appRoot, 'src'),
    '@api': path.join(SHARED_DIR, 'api'),
    '@composables': path.join(SHARED_DIR, 'composables'),
    '@directives': path.join(SHARED_DIR, 'directives'),
    '@enums': path.join(SHARED_DIR, 'enums'),
    '@locales': path.join(SHARED_DIR, 'locales'),
    '@store': path.join(SHARED_DIR, 'store'),
    '@types': path.join(SHARED_DIR, 'types'),
    '@utils': path.join(SHARED_DIR, 'utils'),
    '@components': path.join(UI_DIR, 'components'),
    '@assets': path.join(UI_DIR, 'assets'),
    '@mock': MOCK_DIR,
    // app 私有
    '@modules': path.join(appRoot, 'src/modules'),
    '@layouts': path.join(appRoot, 'src/layouts'),
    '@router': path.join(appRoot, 'src/router'),
    '@plugins': path.join(appRoot, 'src/plugins'),
  }
}
```

- [ ] **Step 4: `packages/config/tsconfig.base.json`（全量）+ `packages/config/src/create-vite-config.ts`（全量工厂）**

tsconfig.base.json：

```json
{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "moduleResolution": "bundler"
  }
}
```

create-vite-config.ts（把现 `apps/admin/vite.config.ts` 的 plugins/css/build/server 逻辑参数化；scss additionalData 的 bem 路径用绝对路径指向 ui 包——**先读 `packages/config/src/scss.ts` 原 additionalData 形态，把其中 bem 的引用路径替换为** `fileURLToPath(new URL('../../ui/src/assets/styles/mixins/bem.scss', import.meta.url))`；若 sass 拒绝绝对路径 @use，则退化为 `preprocessorOptions.scss.loadPaths: [uiStylesDir]` 并在 additionalData 去掉 @use 前缀——这是 R7 的指定回退）：

```ts
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import { defineConfig, type PluginOption } from 'vite'
import { viteMockServe } from 'vite-plugin-mock'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { VENDOR_CHUNKS, SERVER_DEFAULTS, SCSS_PREPROCESSOR_OPTIONS, createAppAliases } from './index'
import { createPostcssPlugins } from './postcss'
import { cleanMockBundled } from './clean-mock-bundled'

const UI_DIR = fileURLToPath(new URL('../../ui/src', import.meta.url))

export interface AppViteOptions {
  appRoot: string          // apps/<name> 绝对路径
  appName: string          // VITE_APP_ID 注入值（持久化 key 前缀，见 D6）
  base?: string            // 默认 '/'；子路径部署传 '/<app>/'
  mockPath?: string        // 传则启用 viteMockServe + cleanMockBundled（指向 @vv/mock 包）
  portOffset?: number      // dev 端口 = SERVER_DEFAULTS.port + offset（admin=0 → 5174，docs=1…）
  h5Rem?: boolean          // true 时 postcss-pxtorem 仅作用于本 app src（P3-2 启用）
  extraPlugins?: PluginOption[]
}

export function createViteConfig({ appRoot, appName, base = '/', mockPath, portOffset = 0, h5Rem = false, extraPlugins = [] }: AppViteOptions) {
  return defineConfig({
    base,
    plugins: [
      vue(), vueJsx(), UnoCSS(),
      AutoImport({
        imports: [
          'vue', 'vue-router', 'pinia',
          { from: '@vv/shared', imports: ['useAppRouter', 'useAuth', 'useLogout', 'useRequest', 'useDict', 'useDialog', 'useConfirm', 'useTheme'] },
          { from: '@vv/shared/utils/bem', imports: ['createNamespace'] },
        ],
        resolvers: [ElementPlusResolver({ importStyle: 'css' })],
        dts: path.join(appRoot, 'src/types/auto-imports.d.ts'),
      }),
      Icons({
        compiler: 'vue3',
        customCollections: {
          app: FileSystemIconLoader(path.join(UI_DIR, 'assets/icons'), (svg) =>
            svg.replace(/fill="(?!none")[^"]*"/g, 'fill="currentColor"')
               .replace(/stroke="(?!none")[^"]*"/g, 'stroke="currentColor"')),
        },
      }),
      Components({
        resolvers: [ElementPlusResolver({ importStyle: 'css' }), IconsResolver({ prefix: 'i', enabledCollections: ['ep', 'tabler'], customCollections: ['app'] })],
        dirs: [path.join(UI_DIR, 'components/common'), path.join(UI_DIR, 'components/ProTable'), path.join(UI_DIR, 'components/form-schema'), path.join(appRoot, 'src/components')].filter(Boolean),
        deep: true,
        dts: path.join(appRoot, 'src/types/components.d.ts'),
      }),
      ...(mockPath
        ? [
            viteMockServe({ mockPath, enable: process.env.VITE_USE_MOCK !== 'false', watchFiles: true }),
            cleanMockBundled(),
          ]
        : []),
      ...extraPlugins,
    ],
    define: { 'import.meta.env.VITE_APP_ID': JSON.stringify(appName) },
    server: { ...SERVER_DEFAULTS, port: SERVER_DEFAULTS.port + portOffset },
    resolve: { alias: createAppAliases(appRoot) },
    css: { postcss: { plugins: createPostcssPlugins({ appRoot, enableRem: h5Rem }) }, preprocessorOptions: { scss: SCSS_PREPROCESSOR_OPTIONS, less: { javascriptEnabled: true } } },
    build: {
      target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1000,
      rollupOptions: {
        treeshake: true,
        output: {
          entryFileNames: 'js/[name]-[hash].js', chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames(assetInfo) {
            const assetName = assetInfo.names[0] ?? ''
            if (assetName.endsWith('.css')) return 'css/[name]-[hash][extname]'
            const IMG_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif', '.tiff', '.apng']
            if (IMG_EXTENSIONS.some((ext) => assetName.endsWith(ext))) return 'img/[name]-[hash][extname]'
            return 'assets/[name]-[hash][extname]'
          },
          manualChunks(id) { if (!id.includes('node_modules')) return undefined; for (const { name, patterns } of VENDOR_CHUNKS) { if (patterns.some((p) => id.includes(p))) return name } return 'vendor-utils' },
        },
      },
    },
  })
}
```

（`createPostcssPlugins`：把现 `build/postcss.ts` 的常量导出函数化——`enableRem=false` 返回 `[]`；`true` 时 pxtorem 的 include 过滤从「`src/layouts/h5` + `src/modules/h5-*` 前缀」改为参数化匹配 `${appRoot}/src` 下的文件。原 `POSTCSS_PLUGINS` 常量导出删除，包内 `postcss.spec.ts` 同步改测函数形态。）

- [ ] **Step 5: admin 消费 + tsconfig paths 简化**

`apps/admin/vite.config.ts` 全文替换为：

```ts
import { fileURLToPath } from 'node:url'
import vueDevTools from 'vite-plugin-vue-devtools'
import { visualizer } from 'rollup-plugin-visualizer'
import { createViteConfig } from '@vv/config'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

export default createViteConfig({
  appRoot,
  appName: 'admin',
  mockPath: fileURLToPath(new URL('../../packages/mock/src', import.meta.url)),
  extraPlugins: [
    vueDevTools(),
    ...(process.env.ANALYZE === 'true'
      ? [visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: 'treemap' })]
      : []),
  ],
})
```

`apps/admin/tsconfig.app.json` 的 `compilerOptions.paths` 改为：

```json
{ "paths": { "@/*": ["./src/*"] } }
```

（TS 对 `@vv/*` 的解析经 package.json exports + moduleResolution bundler；vite 别名负责运行时。）

- [ ] **Step 6: 退役两个脚本**

`git rm build/aliases.ts build/scripts/generate-tsconfig-paths.ts build/aliases.spec.ts build/index.ts`（index.ts barrel 已迁入包内；根 `package.json` 删 `generate:tsconfig-paths` script；`scripts/check-aliases.ts` 暂改为打印 deprecation 直接 exit 0——P5 重写）。

- [ ] **Step 7: 验证** `pnpm -C apps/admin dev:local` 可起、`pnpm test` 绿、`pnpm -C apps/admin build` 基线不回归。

- [ ] **Step 8: Commit** `refactor(monorepo): P1-1 抽出 @vv/config vite 工厂包`

### Task P1-2：@vv/mock 包

**Files:** Move `mock/` → `packages/mock/src/`；Create `packages/mock/package.json`；Modify `packages/mock/src/_utils.ts` 等内部相对 import（相对路径不变，仅深度可能变——mv 保持目录层级则零改动）、`apps/admin/src/main.ts` 中 `import('../mock/mockProdServer')` → `import('@vv/mock/mockProdServer')`（Vite 别名 @mock 指 src，故写 `@mock/mockProdServer`）。

- [ ] **Step 1:** `git mv mock packages/mock-tmp && mkdir -p packages/mock && git mv packages/mock-tmp/* packages/mock/src/ 2>/dev/null || true`（用两段式避免 src 嵌套错乱；然后 `rmdir packages/mock-tmp`）。
- [ ] **Step 2:** `packages/mock/package.json`：`{ "name": "@vv/mock", "private": true, "type": "module", "exports": { ".": "./src/index.ts", "./*": "./src/*" } }`。
- [ ] **Step 3:** 全局搜索替换 `from '../mock/` / `import('../mock/` → `@mock/`（仅 apps/admin/src/main.ts 一处 + mockProdServer 内部自引用若干，逐个改成相对 `./`）。
- [ ] **Step 4:** 验证 dev 登录流程走 mock 正常（auth rawResponse 已知限制用 dev 中间件验证）。Commit `refactor(monorepo): P1-2 抽出 @vv/mock 包`

### Task P1-3：@vv/shared 包（utils/enums/types/api/composables/directives/locales + 4 store）

**Files:** Move 上述 8 目录 + `store/modules/{app,user,theme,dict}.ts` → `packages/shared/src/`；`store/modules/tags-view.ts` → `apps/admin/src/store/modules/tags-view.ts`；`store/index.ts` barrel 拆两半（shared 导出 4 store；admin 自有 store barrel 新建 `apps/admin/src/store/index.ts` 只导出 tags-view + re-export shared）；Create `packages/shared/package.json`（peers: vue/pinia/vue-router/axios/vue-i18n/element-plus/catalog 版本）；Modify `apps/admin/src/main.ts`、`router/index.ts` 等引用 `@/store` 的文件（tags-view 引用路径）；store persisted key 前缀。

- [ ] **Step 1:** 批量 git mv：

```bash
mkdir -p packages/shared/src
git mv apps/admin/src/utils apps/admin/src/enums apps/admin/src/types apps/admin/src/api \
       apps/admin/src/composables apps/admin/src/directives apps/admin/src/locales \
       packages/shared/src/
mkdir -p packages/shared/src/store/modules apps/admin/src/store/modules
git mv apps/admin/src/store/modules/app.ts apps/admin/src/store/modules/user.ts \
       apps/admin/src/store/modules/theme.ts apps/admin/src/store/modules/dict.ts \
       packages/shared/src/store/modules/
git mv apps/admin/src/store/modules/tags-view.ts apps/admin/src/store/modules/
```

`packages/shared/src/store/index.ts` = 原 barrel 去掉 tags-view 行。

- [ ] **Step 2:** `packages/shared/package.json`：

```json
{
  "name": "@vv/shared", "private": true, "type": "module",
  "exports": { ".": "./src/index.ts", "./*": "./src/*" },
  "peerDependencies": {
    "vue": "catalog:", "vue-router": "catalog:", "pinia": "catalog:",
    "axios": "catalog:", "vue-i18n": "catalog:", "element-plus": "catalog:"
  }
}
```

并在 `packages/shared/src/index.ts` 建 barrel（utils/enums/composables/directives 按原 components/index.ts 的 autoImport 模式导出；store 显式 `export * from './store'`）。

- [ ] **Step 3: shared store barrel** — 新建 `packages/shared/src/store/index.ts`：原 barrel 的 5 个导出去掉 `tags-view`，即 `export * from './modules/app'`、`user`、`theme`、`dict` 四行。admin 自有 store barrel — `apps/admin/src/store/index.ts`：

```ts
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
export default pinia
export * from '@vv/shared/store'           // app/user/theme/dict
export * from './modules/tags-view'        // admin 私有
```

- [ ] **Step 4:** persisted key 前缀（D6/R8）— 4 个 store 的 `persist` 选项 key 改为模板串：

```ts
const appId = import.meta.env.VITE_APP_ID ?? 'app'
// persist: { key: `${appId}:theme`, pick: [...] }
```

（全局替换 4 处 key 定义；`VITE_APP_ID` 由工厂 define 注入，Task P1-1 Step 4 已含。）

- [ ] **Step 5:** 修 import 断点：`apps/admin/src/router/index.ts` 的 `@/store/modules/tags-view` → `./store/modules/tags-view` 或 `@/store`（barrel 已含）；`src/main.ts` 的 `@/store` 不变（barrel）；`useLogout/useConfirm` 等内部对 store 的引用经别名 @store → shared，零改动。**执行 `pnpm -C apps/admin type-check:full` 逐个清零报错。**

- [ ] **Step 6: 守卫骨架与白名单判定迁 shared**（spec §2.2：守卫骨架→shared；编排 `auth.ts` 与 `remote-menu.ts` 留 admin——远程菜单 admin 私有）：

```bash
mkdir -p packages/shared/src/router-guards
git mv apps/admin/src/router/guards/composable.ts apps/admin/src/router/guards/login.ts \
       apps/admin/src/router/guards/visibility.ts apps/admin/src/router/guards/permission.ts \
       packages/shared/src/router-guards/
```

- 包内 4 个守卫对 store 的引用从 `@/store/...` 改包内相对路径 `../store/modules/...`（包内自引用不用别名，避免解析环）。
- `whitelist.ts` 拆分：新建 `packages/shared/src/router-guards/whitelist.ts` 只留判定函数 `export function isWhiteListed(toName: unknown, whitelist: ReadonlySet<string>): boolean`；`apps/admin/src/router/whitelist.ts` 保留 `ROUTE_WHITE_LIST` 数据 + 一行包装 `export const isAdminWhiteListed = (n: unknown): boolean => isWhiteListed(n, ROUTE_WHITE_LIST)`。
- admin 编排 `guards/auth.ts` 的 import 同步改指 shared；`pnpm -C apps/admin type-check:full` 清零。

- [ ] **Step 7:** Commit `refactor(monorepo): P1-3 抽出 @vv/shared（含守卫骨架），tags-view 归位 admin`

### Task P1-4：@vv/ui 包

**Files:** Move `apps/admin/src/components/{common,ProTable,form-schema}` + `apps/admin/src/assets` + `apps/admin/src/styles`（若存在）→ `packages/ui/src/`；`apps/admin/src/components/index.ts` → `packages/ui/src/global-components.ts`（改导出工厂）；Create `packages/ui/package.json`；Modify `apps/admin/src/main.ts`（`import GlobalComponents from '@components'` → `import { createGlobalComponents } from '@vv/ui'`；样式 import 改 `@assets/styles/index.scss` 经别名指 ui 包，零改动）。

- [ ] **Step 1:** 批量 git mv + `packages/ui/package.json`（`{ "name": "@vv/ui", "exports": { ".": "./src/index.ts", "./global-components": "./src/global-components.ts", "./*": "./src/*" } }`，peers 同 shared + echarts/vxe-table/lodash-es）。
- [ ] **Step 2:** `packages/ui/src/global-components.ts` — 把原 install 插件改为工厂（内部 `import.meta.glob('./common/**/*.{vue,Vue}', { eager: true })` 相对包内路径；R2 验证点）：

```ts
export function createGlobalComponents() {
  return { install(app: App) { /* 原 install 函数体原样 */ } }
}
```

- [ ] **Step 3:** `packages/ui/src/index.ts` barrel：`export * from './global-components'` + ProTable/form-schema 的既有 barrel（原 `src/components` 下若有 index 级导出一并迁）。
- [ ] **Step 4:** `apps/admin/src/main.ts`：`app.use(createGlobalComponents())`；其余 `@components` 别名引用统一改（grep 清点，预计仅 main.ts 与少量 spec）。
- [ ] **Step 5: 根 vitest workspace + 包内测试配置**（spec 散落到 4 个包后需要统一测试入口）：

根 `vitest.workspace.ts`（全量）：

```ts
export default ['apps/*', 'packages/*']
```

`packages/{ui,shared}/vitest.config.ts`（同形态，全量）：

```ts
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { createAppAliases } from '@vv/config'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: createAppAliases(fileURLToPath(new URL('.', import.meta.url))) },
  test: { environment: 'jsdom', globals: true },
})
```

- 4 个包的 package.json 各加 `"test": "vitest run"`（packages/{config,mock} 用默认 node 环境，无需 vitest.config）。
- ui 包内 spec 的 `'@/utils/...'` import 改为 `'@utils/...'`（别名已指 shared）；根 `pnpm test`（turbo 聚合）全绿。

- [ ] **Step 6: IDE 验证点（R2/§1.7）**：dev 启动后 IDE hover 模板中 `<ProTable />` 应显示完整 DefineComponent 签名（components.d.ts 已生成到 apps/admin/src/types）；若只显示 import 字样 → 启动 fallback：dirs 参数不变、把 components.d.ts 改为 ui 包预生成版本由 app tsconfig include（记录在案再启用）。
- [ ] **Step 7:** Commit `refactor(monorepo): P1-4 抽出 @vv/ui，createGlobalComponents 工厂化`

### Task P1-5：路由 auto-register 相对 glob 验证 + P1 总门禁

- [ ] **Step 1:** `apps/admin/src/router/auto-register.ts` 的 glob 改为 `import.meta.glob('../modules/**/routes/index.ts', { eager: true })`（主方案）；dev 启动 + `pnpm check:routes` 验证路由数与迁移前一致（登录页/首页/404 手动点一遍）。失败则回退绝对字面量 `/src/modules/**`（若 app root 即 apps/admin 则语义等同现状），记录决策。
- [ ] **Step 2:** 全门禁：根 `pnpm lint` + `turbo run build test type-check` + 产物基线 + `pnpm test:e2e` 冒烟（登录→首页→退出）。
- [ ] **Step 3:** Commit `refactor(monorepo): P1 完成，共享包四件套落地`

---

## Phase P2 — docs 应用抽离（2~3 天）

### Task P2-1：apps/docs 骨架

**Files:** Create `apps/docs/{package.json,index.html,env.d.ts,vite.config.ts,tsconfig.app.json,src/main.ts,src/App.vue 简化版,src/router/{index.ts,auto-register.ts,fallback.ts,whitelist.ts},public/}`；Move `apps/admin/src/modules/demo` → `apps/docs/src/modules/demo`（含 routes/components/composables/config/examples/docs/layouts 全量）。

- [ ] **Step 1:** `apps/docs/package.json` 同 admin 形态（name `@vv-app/docs`）；`vite.config.ts`：

```ts
import { fileURLToPath } from 'node:url'
import { createViteConfig } from '@vv/config'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

export default createViteConfig({
  appRoot,
  appName: 'docs',
  portOffset: 1,
  base: process.env.VITE_BASE ?? '/',
  mockPath: fileURLToPath(new URL('../../packages/mock/src', import.meta.url)),
})
```

- [ ] **Step 2:** docs 的 main.ts 裁剪：无远程菜单、无 tags-view、保留 brandColor/title/prod-mock 挂接；`setDialogAppContext` 保留（demo 内 useDialog/useConfirm 在用）。骨架自带最小 fallback 404 视图（10 行内联组件——error 模块视图归 admin 不可复用）与 `vitest.config.ts`（形态同 packages/{ui,shared}）；docs 的 router 只注册自身 modules + fallback，**不挂登录守卫**（docs 全公开，whitelist 直通）。
- [ ] **Step 3:** whitelist：demo 相关 name（`demoWhitelistNames` 及 Home 等公开名）从 `apps/admin/src/router/whitelist.ts` 摘除，迁入 docs 的 whitelist；`isDemoRoutesEnabled` 门控代码随 routes 文件迁走并简化为「docs 应用内始终注册」。
- [ ] **Step 4:** admin 摘除：删 `apps/admin/src/modules/demo` 后跑 type-check，清除残留 import（grep `@modules/demo` / `@/modules/demo`）。
- [ ] **Step 5:** 验证：docs dev 起（新端口 5175，SERVER_DEFAULTS 的 strictPort 需加 app 端口偏移——在工厂 createViteConfig 增 `portOffset?: number`，docs 传 1）；docs build 产物正常；admin 基线不回归（chunk 数应**下降**）。
- [ ] **Step 6:** Commit `feat(monorepo): P2 demo 文档站独立为 apps/docs`

### Task P2-2：双应用部署聚合脚本

- [ ] **Step 1:** 根 `scripts/build-pages.ts`（新增）：依次 `pnpm -C apps/<a> build-only --base=/vue3-vite-project/<a>/`（a ∈ admin,docs，env 注入 hash + local 菜单 + mock + DEMO_NO_AUTH），产物复制到 `dist/<a>/`，生成 `dist/index.html` 落地导航页（6 入口，先写 2 个占位链接）。
- [ ] **Step 2:** 本地模拟 CI 构建（Git Bash 需 `MSYS2_ARG_CONV_EXCL='*'`——见记忆库 gh-pages 坑）验证两 app 可同站访问。
- [ ] **Step 3:** Commit `feat(monorepo): P2 Pages 双应用聚合构建脚本`

---

## Phase P3 — portal / h5 / big 三应用并行抽离（2~3 天）

> 三个 Task 相互独立，可派 3 个子代理并行执行（每个 Task 结构相同：建骨架 → 迁移 → admin 摘除 → 验证）。

### Task P3-1：apps/portal（modules/home + portal layout）

- [ ] Step 1: 骨架（`@vv-app/portal`，portOffset 2，无 mock 依赖也可选开）。
- [ ] Step 2: git mv `apps/admin/src/modules/home` → `apps/docs`…→ `apps/portal/src/modules/home`；`apps/admin/src/layouts/portal` → `apps/portal/src/layouts/portal`；home 的 index.ts/config 同迁。
- [ ] Step 3: whitelist 摘除 Home 相关迁入 portal；admin type-check 清零残留。
- [ ] Step 4: 验证 portal dev/build + admin 基线。Commit `feat(monorepo): P3 门户独立为 apps/portal`

### Task P3-2：apps/h5（modules/h5-demo + h5 layout + postcss 规则）

- [ ] Step 1: 骨架（`@vv-app/h5`，portOffset 3）。工厂增加 `h5Rem?: boolean` 选项——true 时 POSTCSS_PLUGINS 生效（现有 build/postcss.ts 按目录前缀过滤，迁包后改为按 app 开关过滤，`include` 指向本 app src）。
- [ ] Step 2: git mv modules/h5-demo + layouts/h5 → apps/h5 对应位；remAdaptation 插件由 h5 的 main.ts 装配。
- [ ] Step 3: 验证 h5 dev（postcss-pxtorem 转换生效：检查产物 rem 单位）+ admin 基线。Commit `feat(monorepo): P3 h5 独立为 apps/h5`

### Task P3-3：apps/big（modules/big-demo + big layout）

- [ ] Step 1: 骨架（`@vv-app/big`，portOffset 4，工厂选项 `bigScreen` 透传 meta 无需特殊配置——scale 运行时在 layout 内）。
- [ ] Step 2: git mv modules/big-demo + layouts/big → apps/big；验证 /big-demo 与 /big-demo/wide 两路由渲染 + scale 适配实测 1920 窗口。
- [ ] Step 3: admin 基线回归。Commit `feat(monorepo): P3 大屏独立为 apps/big`

---

## Phase P4 — auth 独立 + 统一登录（3~5 天）

### Task P4-1：apps/auth 与跨应用登录协议（D1）

**Files:** Create `apps/auth` 骨架；Move `apps/admin/src/modules/auth` + `apps/admin/src/layouts/blank` → apps/auth；Modify `packages/shared/src/router-guards/login.ts`（或对应守卫文件，先读现状）、`useAppRouter`/`useLogout`、新建 `packages/shared/src/auth/redirect.ts`。

- [ ] **Step 1:** 骨架（`@vv-app/auth`，portOffset 5）；auth 模块全量迁入（含 styles 下两个 `@use '@/assets/styles/mixins/bem'` scss——经 @assets 别名直指 ui 包，零改动）。
- [ ] **Step 2:** `packages/shared/src/auth/redirect.ts`（全量）：

```ts
/** 跨应用整页跳转（D1：跨 app 无共享 router 实例，必须整页） */
export function redirectToAuthLogin(redirect: string): never {
  const authOrigin = import.meta.env.VITE_AUTH_ORIGIN ?? '/auth'
  const safe = redirect.startsWith('/') ? redirect : '/'
  window.location.href = `${authOrigin}/login?redirect=${encodeURIComponent(safe)}`
  throw new Error('AUTH_REDIRECTING') // 中断当前守卫链（不会被渲染，整页已发起）
}
/** auth 登录成功后回跳（校验同源前缀，防开放重定向） */
export function resolvePostLoginRedirect(fallback = '/admin/'): string {
  const raw = new URLSearchParams(window.location.search).get('redirect')
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return fallback
}
```

- [ ] **Step 3:** `checkLoginState`（现位于 shared 的 router guards——P1 迁入）改造：未登录时不再 router.push('/login')，改为 `redirectToAuthLogin(router.currentRoute.value.fullPath)`（apps/auth 自身的白名单内路由除外——auth app 用自有守卫，只挂白名单+可见性两段）。
- [ ] **Step 4:** auth 登录页成功回调改 `window.location.href = resolvePostLoginRedirect()`；登出（useLogout）跨 app 语义 = 清会话后 `window.location.href = ${VITE_AUTH_ORIGIN}/logout` 或直接 `location.assign('/')`（portal 落点）。
- [ ] **Step 5:** admin 摘除 auth 模块与 blank layout；`ROUTE_WHITE_LIST` 摘除 Login 等（Login 归 auth）；admin type-check 清零。
- [ ] **Step 6:** **统一登录联调（R1 验证）**：docker-compose 未就绪前，用「同域 path 预览」验证——`pnpm -C apps/auth build-only --base=/auth/ && pnpm -C apps/admin build-only --base=/admin/`，用任意静态服务器挂 dist 合并目录，访问 /admin/ 未登录 → 跳 /auth/login?redirect=… → 登录 → 回跳 /admin/。同时验证 hash 模式两 app 链路。
- [ ] **Step 7:** Commit `feat(monorepo): P4 统一登录独立 auth 应用与跨应用重定向协议`

### Task P4-2：admin 收敛验收

- [ ] Step 1: admin 此时只剩 user/reports/workbench/error + default layout + tags-view + 远程菜单——人工走查四模块页面 + 多页签 + 权限指令。
- [ ] Step 2: `pnpm test:e2e` 全量。Commit `chore(monorepo): P4 admin 收敛完成`

---

## Phase P5 — 工具链治理（5~8 天）

### Task P5-1：脚本多包重写

- [ ] `scripts/check-routes.ts`：`MODULES_DIR` 改扫 `apps/*/src/modules`，whitelist 聚合各 app whitelist 文件（各 app 一份，路径常量化），四校验语义不变。
- [ ] `scripts/new-module.ts`/`remove-module.ts`：加 `--app <name>` 参数（默认 admin），目标路径 `apps/<name>/src/modules`。
- [ ] `scripts/check-doc-currency.ts`：硬数据锁清单按新路径重建（13 项逐一改指 apps/packages 路径，新增 6 app 的 dev 端口/构建产物数两项）。
- [ ] `scripts/check-aliases.ts`：重写为 ESLint 边界规则的脚本版——校验 `packages/**` 不得 import `@modules/@layouts/@router/@plugins`（app 私有别名反向依赖检测）。
- [ ] 验证四脚本绿。Commit `refactor(monorepo): P5 工程脚本多包感知重写`

### Task P5-2：ESLint 边界 + 仓库级配置

- [ ] `eslint.config.mjs`：新增规则组——`packages/**` 禁 import `@modules/*/@layouts/*/@router/*/@plugins/*`；`apps/*/**` 禁 import 其他 app 路径（`../<other-app>/`）。
- [ ] `pnpm lint` 全绿。Commit `chore(monorepo): P5 ESLint 包边界规则`

### Task P5-3：CI 与部署

- [ ] `.github/workflows/ci.yml`：lint 保持根 `pnpm lint`（全仓一次）；其余 steps 改 `pnpm exec turbo run test type-check build`（PR 场景加 `--filter=[origin/master]` affected，turbo 自动跳过无变更 app）；actions/cache 缓存 pnpm store + turbo 本地缓存目录 `.turbo`。
- [ ] `.github/workflows/deploy.yml`：build step 改 `node --experimental-strip-types scripts/build-pages.ts`（6 app 全量，产出 dist/ + 落地页），Pages 发布整目录。
- [ ] 本地跑通 build-pages 全量（MSYS2_ARG_CONV_EXCL 坑注意）。Commit `ci(monorepo): P5 turbo affected 与六应用 Pages 聚合部署`

### Task P5-4：本地同域网关（V5）

- [ ] `docker-compose.yml` + `docker/nginx.dev.conf`（全量按 spec §4.3：6 个 location 反代 host.docker.internal:5171-5176，proxy_pass 无 URI 保留前缀；端口映射 8080）。
- [ ] 工厂 createViteConfig 增加 `portOffset`（P2 已引入）定稿 6 端口表写进 docs。
- [ ] 验证：docker compose up + turbo run dev → localhost:8080 下统一登录漫游（R1 最终验收）。Commit `feat(monorepo): P5 docker 本地同域网关`

### Task P5-5：治理文档收尾

- [ ] `CLAUDE.md`：§2 Lockdown 改写为 apps/packages 治理（边界引用 §5-2 规则）；§1.6 AutoImport 表改包名；§目录结构重写。
- [ ] `docs/`：07/09/18/39/40/41/42 等路径引用批量更新；新增《43-Monorepo 结构与开发指引》；README 重写 Monorepo 章节。
- [ ] `pnpm check:doc-currency` 绿。Commit `docs(monorepo): P5 治理文档与开发指引`

---

## Self-Review 记录（对照 spec）

| Spec 要求 | 落点 | 状态 |
|-----------|------|------|
| D1 统一登录 | P4-1（redirect.ts 全代码 + 联调） | ✅ |
| D2 Pages 聚合 | P2-2（先行 2 app）+ P5-3（6 app） | ✅ |
| D3 源码直消费/unplugin | P1-1 工厂（dirs 四目录跨包）+ P1-4 | ✅ |
| D4 包名/别名 | P1 别名重定向（评审会声明的细化）+ P5-2 边界 | ✅（细化见 P1 头部说明） |
| D5 auto-register | P1-5 双方案验证 | ✅ |
| §2.2 守卫骨架→shared | P1-3 Step 6（4 守卫 + 白名单判定函数；编排/远程菜单留 admin） | ✅ |
| D6 store 分层/持久化前缀 | P1-3 Step 4 | ✅ |
| D7 main.ts 装配 | P1-3/P1-4 迁移中保持序列，helpers 留原文件原位（shared 内） | ✅ |
| D8 mock 双接线收敛 | P1-2 | ✅ |
| R7 sass 绝对路径 | P1-1 Step 4 指定回退 | ✅ |
| V5 本地同域 | P5-4 | ✅ |
| 验收标准 §8 | 各 Phase 门禁 + P4-2/P5-3/P5-4 联调 | ✅ |
