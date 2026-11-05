# 共享包自包含与依赖契约（P0）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `packages/*` 的生产源码摆脱对宿主 AutoImport 的运行时依赖（先 `@vv/shared`），并把包依赖声明与 `@vv/*` 方向铁律纳入本地 ESLint 机械检查。

**Architecture:** 两条独立可回退的变更集——P0-A（本地 ESLint 规则 + packages manifest 补齐）与 P0-B（shared 生产源码显式导入 → 全局声明瘦身 → Vitest 去 AutoImport）。`apps/*` 的 AutoImport DX 完全保留；`@vv/ui` 的注入式源码与 `optimizeDeps.exclude` 本批不动。

**Tech Stack:** ESLint 10 flat config（本地规则 + RuleTester）、node:test、pnpm catalog、vue-tsc、Vitest 4。

**Spec:** `docs/superpowers/specs/2026-10-27-shared-package-self-containment-design.md`（已批准）

**⚠️ 提交纪律：** 项目规则禁止擅自 `git commit`。每个 Task 末尾的提交步骤须经用户确认后执行。

---

## 背景速读（执行者零上下文假设）

- Monorepo：pnpm workspace + turbo；`packages/shared` 是**源码直链包**（exports 直指 `./src/*.ts`，不建 dist）。
- shared 生产源码当前**故意不写**部分 import——`ref/computed/watch/defineStore/storeToRefs/watchEffect/ElMessage` 等由宿主 vite 的 `unplugin-auto-import` 转换期注入；包独立测试靠 `packages/shared/vitest.config.ts` 再装一套同样插件，类型靠 `src/types/auto-globals.d.ts` 手工全局声明闭合。
- 本计划把 shared 改为标准显式 import。apps 侧工厂（`packages/config/src/create-vite-config.ts`）的 AutoImport/Components/optimizeDeps.exclude **一律不动**。
- 已验证事实（2026-10-27）：
  - `element-plus/es/components/message/style/css.mjs` 在 node_modules 实测存在，CSS 副作用 import 写法有效。
  - `auto-globals.d.ts` 声明的 `useRouter` 在 shared 生产源码中**无人使用**，迁移后自然消失。
  - `packages/shared/src/types/sortablejs.d.ts` 是纯 ambient（`declare module` 无 import 语句），不触发新规则。
  - ESLint flat config 的 `files-to-lint` 只匹配 `**/*.{ts,mts,tsx,vue}`——`.mjs` 规则文件本身不被 lint，属预期。

## 文件结构总览

| 动作 | 路径 | 职责 |
| --- | --- | --- |
| 新建 | `scripts/eslint-rules/package-contract.mjs` | 本地规则：依赖声明 + @vv/* 方向检查 |
| 新建 | `scripts/eslint-rules/package-contract.spec.mjs` | RuleTester 单测（node:test 直跑） |
| 修改 | `eslint.config.mjs` | 注册规则（packages/** error 级） |
| 修改 | `package.json`（根） | 新增 `test:eslint-rules` 脚本；两个依赖条目改 catalog |
| 修改 | `.github/workflows/ci.yml` | Lint 步骤后挂规则单测 |
| 修改 | `pnpm-workspace.yaml` | catalog 补 `@element-plus/icons-vue` / `normalize.css` |
| 修改 | `packages/{config,ui,shared}/package.json` | 补齐直接依赖声明 |
| 修改 | `packages/shared/src/**` 12 个生产文件 | 显式 import（清单见 Task 4/5） |
| 新建 | `packages/shared/src/types/persistence-types.d.ts` | 仅保留 pinia-plugin-persistedstate 模块增强 |
| 删除 | `packages/shared/src/types/auto-globals.d.ts` | 伪运行时全局声明退役 |
| 修改 | `packages/ui/tsconfig.json`、`packages/mock/tsconfig.json` | 换引新声明文件 |
| 修改 | `packages/shared/vitest.config.ts` | 移除 AutoImport / ElementPlusResolver |
| 修改 | `CLAUDE.md`、`packages/shared/README.md`、`CHANGELOG.md` | 新约定入档 |

---

## Task 1: 本地 ESLint 规则 package-contract（TDD：先测试）

**Files:**
- Create: `scripts/eslint-rules/package-contract.spec.mjs`
- Create: `scripts/eslint-rules/package-contract.mjs`

规则语义（先读懂再写测试）：

1. 只检查 `packages/<pkg>/` 内文件的**静态 import / re-export（`export ... from`）/ 字面量动态 import**。
2. 包名提取：`@scope/name/rest` → `@scope/name`；`name/rest` → `name`。
3. 跳过：相对路径（`.` 开头）、绝对路径、`node:` builtins、`virtual:*`、项目既定别名（`@/` 与 `@api/@assets/@components/@composables/@directives/@enums/@layouts/@locales/@mock/@modules/@plugins/@router/@store/@utils` 及其子路径）。
4. 自引用合法（`@vv/shared` 文件 import `@vv/shared/...`）。
5. `@vv/*` 方向铁律：shared/config 不允许依赖任何 @vv 包；ui/mock 只允许 `@vv/shared`。未知 `@vv/*` 包名报错。
6. 声明检查：`dependencies` / `peerDependencies` 恒合法；`devDependencies` 仅当「纯类型导入（`import type` / `export type`）」或「文件是 spec/test/`.d.ts`/vite|vitest.config」时合法。

- [ ] **Step 1: 写失败的测试文件**

创建 `scripts/eslint-rules/package-contract.spec.mjs`：

```js
/**
 * package-contract 规则单测（node:test + ESLint RuleTester）。
 *
 * 运行：pnpm test:eslint-rules（根 package.json，node --test 直跑——scripts 非 workspace
 * 包，不经 turbo/vitest；与同目录 node-gateway.spec.ts 的 test:gateway 同形态）。
 *
 * 用例全部锚定稳定事实（真实 packages/<pkg>/package.json），不依赖「尚未补齐的声明」——
 * 未声明用例统一用虚构包名 left-pad-xyz-not-declared，保证规则测试与 manifest 修复解耦。
 */
import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import rule from './package-contract.mjs'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})

ruleTester.run('package-contract', rule, {
  valid: [
    // ui → shared：方向合法且 ui dependencies 已声明 @vv/shared
    {
      filename: 'packages/ui/src/components/common/X.ts',
      code: "import { useAuth } from '@vv/shared'",
    },
    // 生产源码的纯类型导入允许 devDependencies（mock 的 vite-plugin-mock 只在 devDeps）
    {
      filename: 'packages/mock/src/auth.ts',
      code: "import type { MockMethod } from 'vite-plugin-mock'",
    },
    // spec 文件允许 devDependencies（vitest 在 ui devDeps）
    {
      filename: 'packages/ui/src/composables/useConfirm.spec.ts',
      code: "import { describe } from 'vitest'",
    },
    // 自引用合法（shared spec 经包名引用自身测试工具）
    {
      filename: 'packages/shared/src/auth/redirect.spec.ts',
      code: "import { installFakeLocation } from '@vv/shared/test-utils/fakeLocation'",
    },
    // 相对路径 / node builtins / 虚拟模块 / 项目既定别名：不是 npm 包，跳过
    { filename: 'packages/ui/src/components/common/X.ts', code: "import { a } from '../x'" },
    { filename: 'packages/config/src/proxy.ts', code: "import path from 'node:path'" },
    { filename: 'packages/shared/src/app-styles.ts', code: "import 'virtual:uno.css'" },
    { filename: 'packages/ui/src/composables/useLogout.spec.ts', code: "import i18n from '@locales'" },
    // 已声明的外部包（element-plus 在 ui peerDependencies）
    {
      filename: 'packages/ui/src/components/common/X.ts',
      code: "import { ElMessage } from 'element-plus'",
    },
    // 非字面量动态 import 无法静态判定，跳过
    { filename: 'packages/ui/src/components/common/X.ts', code: 'const m = await import(name)' },
  ],
  invalid: [
    // 方向违规：shared → ui
    {
      filename: 'packages/shared/src/x.ts',
      code: "import { useDialog } from '@vv/ui/composables/useDialog'",
      errors: [{ messageId: 'forbiddenDirection' }],
    },
    // 方向违规：ui 只允许 → shared，→ mock 禁止
    {
      filename: 'packages/ui/src/x.ts',
      code: "import { something } from '@vv/mock'",
      errors: [{ messageId: 'forbiddenDirection' }],
    },
    // 未知 @vv 包（不在方向表）
    {
      filename: 'packages/ui/src/x.ts',
      code: "import { x } from '@vv/unknown'",
      errors: [{ messageId: 'unknownVvPackage' }],
    },
    // 未声明外部包（生产值导入）
    {
      filename: 'packages/ui/src/x.ts',
      code: "import leftPad from 'left-pad-xyz-not-declared'",
      errors: [{ messageId: 'undeclared' }],
    },
    // 生产值导入不允许落 devDependencies（vite-plugin-mock 仅在 mock devDeps）
    {
      filename: 'packages/mock/src/x.ts',
      code: "import { setupDevMockServer } from 'vite-plugin-mock'",
      errors: [{ messageId: 'undeclared' }],
    },
    // 字面量动态 import 同样检查
    {
      filename: 'packages/ui/src/x.ts',
      code: "const m = await import('left-pad-xyz-not-declared')",
      errors: [{ messageId: 'undeclared' }],
    },
    // re-export 同样检查
    {
      filename: 'packages/ui/src/x.ts',
      code: "export { x } from 'left-pad-xyz-not-declared'",
      errors: [{ messageId: 'undeclared' }],
    },
  ],
})
```

- [ ] **Step 2: 运行测试确认失败**

> **执行记录（2026-10-27 实测偏差）**：两处计划外修正——① 注释内 `packages/*/package.json` 的 `*/` 提前闭合块注释（已改为 `packages/<pkg>/`）；② `import type` 用例需 TS parser，但 pnpm 严格模式下 `@typescript-eslint/parser` 根不可达、宿主链逐跳 require 亦失败，且该包纯 exports 无 main（目录 require 不适用）——spec 改为「`.pnpm` 存储版本无关前缀定位 + 读 package.json exports 入口 + createRequire 绝对路径加载」（见 spec 文件头注）。

Run: `node --test scripts/eslint-rules/package-contract.spec.mjs`
Expected: FAIL —— `Cannot find module './package-contract.mjs'`（实现文件尚不存在）。

- [ ] **Step 3: 写规则实现**

创建 `scripts/eslint-rules/package-contract.mjs`：

```js
/**
 * packages/* 依赖契约检查（本地 ESLint 规则，error 级）。
 *
 * 检查对象：packages/<pkg>/ 下 .ts/.mts/.tsx/.vue 的静态 import、re-export（export ... from）
 * 与字面量动态 import。
 *
 * 契约：
 * 1. 生产源码的值导入必须声明在 dependencies / peerDependencies；纯类型导入与
 *    spec/test/.d.ts/vite|vitest.config 文件允许落在 devDependencies
 *    （类型在编译期擦除，不构成运行时依赖）
 * 2. @vv/* 方向铁律：mock → shared、ui → shared；shared/config 不依赖任何 @vv 包；
 *    自引用（@vv/x 内部 import '@vv/x/...'）合法
 * 3. 相对路径 / node builtins / virtual:* / 项目既定别名不是 npm 包，跳过
 *
 * 为什么不引新依赖：规则只需「说明符 → 包名 → 读所属包 manifest」三步，Node 内置足够。
 */
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])

/** @vv/* 允许方向：键 = 当前包，值 = 允许依赖的 @vv/* 集合（新增包必须先登记） */
const VV_DIRECTION = {
  '@vv/shared': new Set(),
  '@vv/config': new Set(),
  '@vv/ui': new Set(['@vv/shared']),
  '@vv/mock': new Set(['@vv/shared']),
}

/** 项目既定别名（CLAUDE.md §1.6.2 既有例外）——不是 npm 包名 */
const ALIAS_PREFIXES = [
  '@api',
  '@assets',
  '@components',
  '@composables',
  '@directives',
  '@enums',
  '@layouts',
  '@locales',
  '@mock',
  '@modules',
  '@plugins',
  '@router',
  '@store',
  '@utils',
]

/** spec / 测试 / 声明 / 配置文件：允许消费 devDependencies */
const DEV_OK_PATTERN = /\.(spec|test)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$|(?:vite|vitest)\.config\.[cm]?[jt]s$/

const manifestCache = new Map()

function isProjectAlias(spec) {
  if (spec.startsWith('@/')) return true
  return ALIAS_PREFIXES.some((alias) => spec === alias || spec.startsWith(`${alias}/`))
}

function packageNameOf(spec) {
  const segs = spec.split('/')
  return spec.startsWith('@') ? `${segs[0]}/${segs[1]}` : segs[0]
}

/** 从文件路径定位所属 packages/<name>/ 并读取其 package.json（带缓存；读不到返回 null → 规则静默跳过） */
function locatePackage(filename) {
  const parts = path.resolve(filename).split(path.sep)
  const idx = parts.lastIndexOf('packages')
  if (idx === -1 || idx >= parts.length - 1) return null
  const dir = parts.slice(0, idx + 2).join(path.sep)
  if (!manifestCache.has(dir)) {
    try {
      manifestCache.set(dir, JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')))
    } catch {
      manifestCache.set(dir, null)
    }
  }
  const manifest = manifestCache.get(dir)
  return manifest ? { dirName: parts[idx + 1], manifest } : null
}

/** 返回声明所在字段名；未声明返回 null。allowDev 时 devDependencies 也算合法 */
function declaredField(manifest, pkgName, allowDev) {
  if (manifest.dependencies?.[pkgName]) return 'dependencies'
  if (manifest.peerDependencies?.[pkgName]) return 'peerDependencies'
  if (allowDev && manifest.devDependencies?.[pkgName]) return 'devDependencies'
  return null
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'packages/* 依赖声明与 @vv/* 包间方向契约' },
    schema: [],
    messages: {
      undeclared:
        "包 '{{pkgName}}' 未声明：packages/{{dirName}}/package.json 的 dependencies / peerDependencies{{devHint}} 中均不存在",
      forbiddenDirection:
        "packages/{{dirName}} 禁止依赖 '{{pkgName}}'（@vv/* 方向铁律：mock → shared、ui → shared，其余组合禁止）",
      unknownVvPackage: "'{{pkgName}}' 不在 @vv/* 方向表（VV_DIRECTION）——新增包须先在本规则登记方向",
    },
  },
  create(context) {
    const pkg = locatePackage(context.physicalFilename ?? context.filename)
    if (!pkg) return {}
    const ownName = pkg.manifest.name
    const allowDevByFile = DEV_OK_PATTERN.test(context.filename)

    function check(spec, node, isTypeImport) {
      if (typeof spec !== 'string') return
      if (spec.startsWith('.') || path.isAbsolute(spec) || spec.startsWith('virtual:')) return
      if (spec.startsWith('node:') || BUILTINS.has(spec)) return
      if (isProjectAlias(spec)) return
      const pkgName = packageNameOf(spec)
      if (pkgName === ownName) return
      if (pkgName.startsWith('@vv/')) {
        if (!(pkgName in VV_DIRECTION)) {
          context.report({ node, messageId: 'unknownVvPackage', data: { pkgName } })
          return
        }
        if (!VV_DIRECTION[ownName]?.has(pkgName)) {
          context.report({ node, messageId: 'forbiddenDirection', data: { pkgName, dirName: pkg.dirName } })
          return
        }
      }
      const allowDev = allowDevByFile || isTypeImport
      if (!declaredField(pkg.manifest, pkgName, allowDev)) {
        context.report({
          node,
          messageId: 'undeclared',
          data: { pkgName, dirName: pkg.dirName, devHint: allowDev ? ' / devDependencies' : '' },
        })
      }
    }

    return {
      ImportDeclaration(node) {
        check(node.source.value, node.source, node.importKind === 'type')
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source.value, node.source, node.exportKind === 'type')
      },
      ExportAllDeclaration(node) {
        check(node.source.value, node.source, node.exportKind === 'type')
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal') check(node.source.value, node.source, false)
      },
    }
  },
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test scripts/eslint-rules/package-contract.spec.mjs`
Expected: PASS（17 个用例全绿）。

- [ ] **Step 5: 提交（须经用户确认）**

```bash
git add scripts/eslint-rules/package-contract.mjs scripts/eslint-rules/package-contract.spec.mjs
git commit -m "test(eslint): 新增 package-contract 本地规则（依赖声明 + @vv/* 方向铁律）及 RuleTester 单测"
```

---

## Task 2: 接线规则（eslint.config + 脚本 + CI），以 lint RED 暴露存量缺口

**Files:**
- Modify: `eslint.config.mjs`（顶部 import 区 + `app/boundary-packages` 配置块之后）
- Modify: `package.json`（根，scripts 段）
- Modify: `.github/workflows/ci.yml`（Lint 步骤之后）

- [ ] **Step 1: eslint.config.mjs 注册规则**

文件顶部 import 区（现有第 6 行 `import { APPS } from './scripts/apps-registry.mjs'` 之后）追加：

```js
import packageContract from './scripts/eslint-rules/package-contract.mjs'
```

在 `name: 'app/boundary-packages'` 配置块**之后**插入新配置块：

```js
  // packages/* 依赖契约（P0 共享包自包含）：包消费的每个 npm 包必须在自身 package.json
  // 声明（dependencies/peerDependencies；类型导入与 spec/config 文件允许 devDependencies），
  // @vv/* 方向铁律（mock → shared、ui → shared）机械检查，防包间反向依赖漂移
  {
    name: 'app/package-contract',
    files: ['packages/**/*.{ts,mts,tsx,vue}'],
    plugins: { local: { rules: { 'package-contract': packageContract } } },
    rules: { 'local/package-contract': 'error' },
  },
```

- [ ] **Step 2: 根 package.json 加测试脚本**

在 `"test:gateway"` 一行之后插入：

```json
    "test:eslint-rules": "node --test scripts/eslint-rules/package-contract.spec.mjs",
```

- [ ] **Step 3: ci.yml 挂规则单测**

在 `- name: Lint` 步骤（`run: pnpm lint`）之后插入：

```yaml
      - name: Test local ESLint rules
        # scripts/eslint-rules 非 workspace 包、不经 turbo——node --test 直跑（同 test:gateway 形态）
        run: pnpm test:eslint-rules
```

- [ ] **Step 4: 运行 `pnpm lint`，确认 RED 且失败项全部在预期清单内**

Run: `pnpm lint`
Expected: FAIL，且 `local/package-contract` 报错**仅**覆盖以下缺口（均将在 Task 3 修复）：

| 包 | 未声明依赖 | 消费文件（示例） |
| --- | --- | --- |
| `@vv/config` | `vite` | `create-vite-config.ts` / `proxy.ts` / `clean-mock-bundled.ts` |
| `@vv/config` | `vitest` | `create-vitest-config.ts`（生产代码 import `vitest/config`） |
| `@vv/config` | `unocss` | `create-vite-config.ts`（`unocss/vite`） |
| `@vv/ui` | `vue-i18n` | `composables/useLogout.ts`、`components/common/NetworkBanner.vue` |
| `@vv/ui` | `@element-plus/icons-vue` | ProTable / ProDialog / build-slots 等多个组件 |
| `@vv/shared` | `normalize.css` | `app-styles.ts` |
| `@vv/shared` | `zod` | `api/validator.ts`（type）+ `api/validator.spec.ts`（spec 值导入） |

若出现清单**之外**的报错 → 停下来核对是否规则误报（检查 alias 跳过表 / DEV_OK_PATTERN），不得直接改业务代码压规则。

> **执行记录（2026-10-27 实测）**：RED 共 60 处，清单外发现 3 类，均为真实缺口/规则盲区，已修正规则并扩充 Task 3 清单：
>
> 1. `@vue/test-utils` ×36（ui 35 + shared 1，均 spec 文件）——测试工具未在包级 devDeps 声明（此前靠根 node_modules 向上查找兜底）。Task 3 追加：ui/shared devDeps 补 `@vue/test-utils`。
> 2. `vitest-axe` ×2（ui spec）——同上。Task 3 追加：ui devDeps 补 `vitest-axe`。
> 3. `packages/ui/vitest.config.ts` import `@vv/config` 被判方向违规——**规则盲区**：vite/vitest.config 是 Node 构建装配层（不进浏览器产物），消费 @vv/config 工厂属既定合法形态。规则修正：config 文件豁免方向检查（声明检查保留；spec/test 文件不豁免），spec 追加 2 个锁定用例（共 19 例）。
> 4. 规则 GREEN 复查再修正一轮（共 21 例）：`bench/*.bench.ts` 与 `test-utils/` 目录（vitest bench/fakeLocation）同属测试基建，DEV_OK_PATTERN 扩充放行 devDeps；存量问题顺带修复——`dist-prod/` 构建产物未被 ESLint 忽略致 6.9 万条产物噪音淹没 lint（ignores 补 `**/dist-prod/**`，与 Task 3 manifest 无关，属 build:prod 特性遗漏）。

- [ ] **Step 5: 提交（须经用户确认）**

```bash
git add eslint.config.mjs package.json .github/workflows/ci.yml
git commit -m "ci(lint): package-contract 规则接入 pnpm lint 与 CI（当前暴露 7 项存量声明缺口）"
```

---

## Task 3: 补齐 packages manifest 声明（lint RED → GREEN）

**Files:**
- Modify: `pnpm-workspace.yaml`（catalog 段）
- Modify: `package.json`（根，dependencies 段两个条目）
- Modify: `packages/config/package.json`
- Modify: `packages/ui/package.json`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: catalog 单版本源补两条**

`pnpm-workspace.yaml` 的 `catalog:` 段追加（保持现有缩进与排序位置即可）：

```yaml
  '@element-plus/icons-vue': '^2.3.2'
  normalize.css: '^8.0.1'
```

- [ ] **Step 2: 根 package.json 两条目切到 catalog**

`dependencies` 段：

```json
-    "@element-plus/icons-vue": "^2.3.2",
+    "@element-plus/icons-vue": "catalog:",
```
```json
-    "normalize.css": "^8.0.1",
+    "normalize.css": "catalog:",
```

- [ ] **Step 3: packages/config/package.json 补工厂宿主依赖**

`peerDependencies` 段追加（vite/vitest/unocss 为工厂公开入口直接消费；两个 iconify 集合由工厂默认启用但仅在用到 i-* 图标时才被解析，声明为可选 peer）：

```json
    "vite": "^8.0.16",
    "vitest": "^4.1.9",
    "unocss": "^66.7.5",
    "@iconify-json/ep": "^1.2.4",
    "@iconify-json/tabler": "^1.2.42"
```

`peerDependencies` 段之后新增：

```json
  "peerDependenciesMeta": {
    "@iconify-json/ep": { "optional": true },
    "@iconify-json/tabler": { "optional": true }
  },
```

（`vitest` 同时保留在 devDependencies——peer 声明宿主契约，devDep 供本包自测，两者职责不同。）

- [ ] **Step 4: packages/ui/package.json 补两条**

`peerDependencies` 段追加：

```json
    "vue-i18n": "catalog:",
    "@element-plus/icons-vue": "catalog:"
```

- [ ] **Step 5: packages/shared/package.json 补两条**

`peerDependencies` 段追加：

```json
    "normalize.css": "catalog:",
```

`devDependencies` 段追加（zod 当前仅 validator 类型 + spec 消费，运行时 peer 待 P1 auth schema 落地时再加）：

```json
    "zod": "catalog:",
```

- [ ] **Step 6: 安装 + lint 转绿**

Run: `pnpm install && pnpm lint`
Expected: `pnpm install` 更新 lockfile 成功；`pnpm lint` PASS（Task 2 的 7 类缺口全部消除）。

- [ ] **Step 7: 提交（须经用户确认）**

```bash
git add pnpm-workspace.yaml package.json pnpm-lock.yaml packages/config/package.json packages/ui/package.json packages/shared/package.json
git commit -m "fix(packages): 补齐 config/ui/shared 直接依赖声明（vite/vitest/unocss/vue-i18n/icons/normalize.css/zod），icons 与 normalize.css 收敛 catalog 单版本源"
```

---

## Task 4: shared 显式导入第一批——composables（5 文件）

**Files:**
- Modify: `packages/shared/src/composables/useRequest.ts:1`
- Modify: `packages/shared/src/composables/useDict.ts:41`
- Modify: `packages/shared/src/composables/useAuth.ts:19`
- Modify: `packages/shared/src/composables/useAppRouter.ts:24-31`
- Modify: `packages/shared/src/composables/useTheme.ts:39`

> 约定：值 import 与类型 import 分行；新行插入在既有 import 块内，不重排既有行。`typeof ElMessage !== 'undefined'` 守卫**保留不动**（行为零变化优先；简化与否由 spec 另行裁决）。

- [ ] **Step 1: useRequest.ts**

第 1 行 `import type { Ref, ComputedRef, WatchSource } from 'vue'` **上方**插入：

```ts
import { computed, ref, watch } from 'vue'
```

- [ ] **Step 2: useDict.ts**

第 41 行 `import type { Ref } from 'vue'` 上方插入：

```ts
import { computed } from 'vue'
```

- [ ] **Step 3: useAuth.ts**

第 19 行 `import { useUserStore } from '../store/modules/user.ts'` 上方插入：

```ts
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
```

- [ ] **Step 4: useAppRouter.ts**

第 24 行 `import { getAppRouter } from '../app-router.ts'` 上方插入：

```ts
import { ElMessage } from 'element-plus'
// 显式 import 不经 AutoImport resolver 的 importStyle 注入，消息样式须自行携带
import 'element-plus/es/components/message/style/css'
```

并把第 26 行的过时注释 `// ElMessage 由 unplugin-auto-import 注入（importStyle 自动带样式，勿显式 import）` 整行替换为：

```ts
// ElMessage 显式 import（packages 生产源码不依赖宿主 AutoImport，见 shared README「宿主装配契约」）
```

- [ ] **Step 5: useTheme.ts**

第 39 行 `import { useThemeStore } from '../store/modules/theme.ts'` 上方插入：

```ts
import { storeToRefs } from 'pinia'
```

- [ ] **Step 6: 验证本批**

Run: `pnpm -C packages/shared type-check && pnpm -C packages/shared test`
Expected: PASS（auto-globals 声明与 AutoImport 仍在，显式 import 与注入并存期不冲突——unplugin-auto-import 对已声明标识符不重复注入）。

- [ ] **Step 7: 提交（须经用户确认）**

```bash
git add packages/shared/src/composables/
git commit -m "refactor(shared): composables 5 文件改显式 import（vue/pinia/element-plus），解除对宿主 AutoImport 的运行时依赖"
```

---

## Task 5: shared 显式导入第二批——store / directives / http / copy（8 文件）

**Files:**
- Modify: `packages/shared/src/store/modules/app.ts`（头注之后、`export type LayoutMode` 之前）
- Modify: `packages/shared/src/store/modules/user.ts:16`
- Modify: `packages/shared/src/store/modules/dict.ts:22`
- Modify: `packages/shared/src/store/modules/theme.ts`（头注之后、`export type ThemeMode` 之前）
- Modify: `packages/shared/src/directives/auth.ts:21`
- Modify: `packages/shared/src/directives/permission.ts:24`
- Modify: `packages/shared/src/api/http.ts:24-30`
- Modify: `packages/shared/src/directives/copy.ts:31`

- [ ] **Step 1: store/modules/app.ts**

头注 `*/` 之后、`/** 布局模式...` 之前插入（该文件当前无 import 块）：

```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
```

- [ ] **Step 2: store/modules/user.ts**

第 16 行 `import { authApi, ...` 上方插入：

```ts
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
```

- [ ] **Step 3: store/modules/dict.ts**

第 22 行 `import { dictApi } ...` 上方插入：

```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
```

- [ ] **Step 4: store/modules/theme.ts**

头注之后、第 20 行 `export type ThemeMode` 之前插入（该文件当前无 import 块）：

```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'
```

- [ ] **Step 5: directives/auth.ts**

第 21 行 `import type { App } from 'vue'` 上方插入：

```ts
import { watchEffect } from 'vue'
```

- [ ] **Step 6: directives/permission.ts**

第 24 行 `import type { App } from 'vue'` 上方插入：

```ts
import { watchEffect } from 'vue'
```

- [ ] **Step 7: api/http.ts**

axios import 块（`} from 'axios'`）之后、`import { BusinessCode } ...` 之前插入：

```ts
import { ElMessage } from 'element-plus'
// 显式 import 不经 AutoImport resolver 的 importStyle 注入，消息样式须自行携带
import 'element-plus/es/components/message/style/css'
```

并把第 30 行的过时注释 `// ElMessage 由 unplugin-auto-import 注入（importStyle 自动带样式，勿显式 import）` 整行替换为：

```ts
// ElMessage 显式 import（packages 生产源码不依赖宿主 AutoImport，见 shared README「宿主装配契约」）
```

- [ ] **Step 8: directives/copy.ts**

第 31 行 `import { ElMessage } from 'element-plus'` 之后插入：

```ts
// 与 http.ts / useAppRouter.ts 同约定：显式 import 须自行携带消息样式
import 'element-plus/es/components/message/style/css'
```

- [ ] **Step 9: 验证本批**

Run: `pnpm -C packages/shared type-check && pnpm -C packages/shared test`
Expected: PASS。

- [ ] **Step 10: 提交（须经用户确认）**

```bash
git add packages/shared/src/store/modules/ packages/shared/src/directives/ packages/shared/src/api/http.ts
git commit -m "refactor(shared): store/directives/http 显式导入补齐，ElMessage 三入口统一携带 message 样式"
```

---

## Task 6: 全局声明瘦身——auto-globals.d.ts → persistence-types.d.ts（权威完整性校验）

**Files:**
- Create: `packages/shared/src/types/persistence-types.d.ts`
- Delete: `packages/shared/src/types/auto-globals.d.ts`
- Modify: `packages/ui/tsconfig.json:8`
- Modify: `packages/mock/tsconfig.json:3-6`

> 本任务是「显式导入是否完整」的权威判定点：删掉全局声明后，任何漏网的裸标识符都会被 vue-tsc 以 `TS2304: Cannot find name` 精确报出（含文件与行号）。

- [ ] **Step 1: 新建 persistence-types.d.ts**

```ts
/**
 * pinia-plugin-persistedstate 模块增强（DefineSetupStoreOptions.persist 选项类型）。
 *
 * store/modules/{app,theme}.ts 的 persist 选项类型依赖本增强。本文件只承载类型增强——
 * shared 生产源码已全量显式 import（P0），不再有任何「运行时全局变量」声明。
 * 原 auto-globals.d.ts 的伪全局（ref/defineStore/ElMessage 等）已随显式导入迁移退役。
 */
import 'pinia-plugin-persistedstate'

export {}
```

- [ ] **Step 2: 删除 auto-globals.d.ts**

删除 `packages/shared/src/types/auto-globals.d.ts`（git 可追溯，直接删）。

- [ ] **Step 3: packages/ui/tsconfig.json**

`include` 数组中 `"../shared/src/types/auto-globals.d.ts"` 替换为：

```json
    "../shared/src/types/persistence-types.d.ts"
```

- [ ] **Step 4: packages/mock/tsconfig.json**

同样把 include 里的 `"../shared/src/types/auto-globals.d.ts"` 替换为 `"../shared/src/types/persistence-types.d.ts"`，并将第 3-5 行注释中「env.d.ts / auto-globals.d.ts 与 packages/ui/tsconfig.json 同先例……auto-import 注入标识符的全局声明（源码按宿主装配契约书写，见 shared README）才能类型通过」改写为：

```json
  // env.d.ts / persistence-types.d.ts 与 packages/ui/tsconfig.json 同先例：mock 经包名消费
  // @vv/shared 契约类型，shared 源码需要 vite/client 的 ImportMeta 增强 + pinia persistedstate
  // 的 persist 选项类型增强才能类型通过（shared 源码已全量显式 import，无全局声明依赖）
```

- [ ] **Step 5: 全量类型检查（权威判定）**

Run: `pnpm type-check`
Expected: PASS。若出现 `TS2304: Cannot find name 'xxx'` → 按报错文件行号补对应显式 import（唯一允许的修复方式），禁止把名字加回全局声明；全部补完重跑至绿。

- [ ] **Step 6: 提交（须经用户确认）**

```bash
git add packages/shared/src/types/ packages/ui/tsconfig.json packages/mock/tsconfig.json
git commit -m "refactor(shared): auto-globals 全局声明退役，仅保留 persistedstate 模块增强（persistence-types.d.ts）"
```

---

## Task 7: shared Vitest 去 AutoImport（运行时自包含的证明）

**Files:**
- Modify: `packages/shared/vitest.config.ts`
- Modify: `packages/shared/package.json`（devDependencies 删两行）

- [ ] **Step 1: 重写 vitest.config.ts**

整体替换为：

```ts
/**
 * @vv/shared 单测配置（vitest）
 *
 * P0（2026-10-27）起：包源码全量显式 import，测试不再需要 AutoImport 插件补齐
 * 自由变量——本配置只剩环境 + 根路径，是「shared 运行时自包含」的权威证明：
 * 本配置变绿 = 任何宿主（不限 Vite 装配形态）都能跑通 shared 的逻辑测试。
 *
 * - environment: jsdom —— storage / 指令 / store spec 需要 DOM（localStorage 等）
 * - 别名不需要：包内一律相对路径（不依赖 vite alias）；新写 import 带 .ts 扩展名
 *   （Node 原生 ESM 语义不补全），存量无扩展名写法逐步收敛
 */
import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    root: fileURLToPath(new URL('./', import.meta.url)),
    globals: true,
    exclude: [...configDefaults.exclude],
  },
})
```

- [ ] **Step 2: shared package.json 摘除两个 devDependencies**

从 `devDependencies` 删除：

```json
    "unplugin-auto-import": "^21.0.0",
    "unplugin-vue-components": "^32.1.0"
```

- [ ] **Step 3: 安装 + 测试**

Run: `pnpm install && pnpm -C packages/shared test`
Expected: PASS（全量 spec 在无 AutoImport 环境下通过）。若有 `ReferenceError: xxx is not defined` → 说明 Task 4/5 漏了裸标识符（type-only 全局不会触发运行时错误，故 type-check 绿 ≠ 本步必然绿），回到对应文件补 import，禁止把插件装回来。

- [ ] **Step 4: 提交（须经用户确认）**

```bash
git add packages/shared/vitest.config.ts packages/shared/package.json pnpm-lock.yaml
git commit -m "test(shared): vitest 配置摘除 AutoImport/ElementPlusResolver——shared 运行时自包含落地"
```

---

## Task 8: 文档入档（CLAUDE.md / shared README / CHANGELOG）

**Files:**
- Modify: `CLAUDE.md`（§1.6.2 之后新增 §1.6.3）
- Modify: `packages/shared/README.md`（「宿主装配契约」①②两节改写）
- Modify: `CHANGELOG.md`（`## 未发布` 区顶部新增条目）

- [ ] **Step 1: CLAUDE.md 新增 §1.6.3**

在 §1.6.2 表格之后（「---」分隔线之前）插入：

```markdown
### 1.6.3 包源码自包含约定（packages/* 生产源码不使用 AutoImport）

> 2026-10-27 P0 起：AutoImport 隐式注入只停留在**最终宿主（apps/*）**，不穿过包边界。

- `apps/*`：维持 §1.6 全部 AutoImport 规则不变（业务 DX 优先）
- `packages/*` 生产源码：**一律显式 import**（含 vue/pinia/vue-router 高频 API 与 ElMessage 等），不依赖宿主转换才能运行；ElMessage 等组件的显式 import 须同时携带样式副作用（`element-plus/es/components/message/style/css`）
- 依赖可见性：packages/* 消费的每个 npm 包必须声明在自身 package.json——本地规则 `local/package-contract`（error 级，`pnpm lint` + CI 机械检查）兜底，含 @vv/* 方向铁律（mock → shared、ui → shared）
- `packages/ui` 存量注入式源码与其 `src/types/auto-globals.d.ts` 暂保留，收敛为独立批次（本约定对 ui 为新代码约束先行）
```

- [ ] **Step 2: shared README 契约改写**

把 `## 宿主装配契约（前置条件，缺一不可）` 下的 `### ① unplugin-auto-import 按清单注入（运行时生死线）` 整节替换为：

```markdown
### ① 生产源码零注入依赖（2026-10-27 P0 起）

包内生产源码**全量显式 import**——不再依赖宿主 `unplugin-auto-import` 补齐自由变量；
包级 Vitest 配置（`vitest.config.ts`）已无该插件，测试通过即运行时自包含的权威证明。
宿主只需具备：Vue3 + Vite（`import.meta.env` 体系）+ 下方依赖清单。
```

把 `### ② optimizeDeps.exclude 逐条点名 @vv/*（dev 生死线）` 一节标题改为 `### ② optimizeDeps.exclude（存量防退化，待验证收敛）`，并在节首追加一行：

```markdown
> P0 后 shared 源码已无注入式自由变量，本条对 shared 属**存量防退化配置**；
> @vv/ui 仍是注入式源码（未迁移），整条 exclude 保留。待真实 dev 冷启动验证后另行评估删减。
```

- [ ] **Step 3: CHANGELOG 条目**

在 `## 未发布` 之下、现有第一条目之上插入：

```markdown
### ♻️ Refactor | 共享包自包含 P0：shared 显式导入 + packages 依赖契约机械检查（2026-10-27）

> 背景：shared 生产源码依赖宿主 AutoImport 补齐 `ref/defineStore/ElMessage` 等自由变量——包「能 import」但「不能独立运行」，包测试要复制一套宿主插件装配、类型要靠手工全局声明闭合、dev 预构建要靠 optimizeDeps.exclude 特殊豁免。换宿主/冷启动排障成本高。

- **P0-B 显式导入**：shared 12 个生产文件（5 composables + 4 store + 2 directives + http）补标准显式 import；`auto-globals.d.ts` 伪运行时全局退役，仅保留 `persistence-types.d.ts`（persistedstate 模块增强）；`vitest.config.ts` 摘除 AutoImport/ElementPlusResolver——包测试零宿主插件依赖
- **ElMessage 样式随行**：http.ts / useAppRouter.ts / copy.ts 三入口显式携带 `element-plus/es/components/message/style/css`（显式 import 不经 resolver importStyle 注入，防提示样式静默退化）
- **P0-A 依赖契约**：新增本地规则 `local/package-contract`（error 级）——packages/* 值导入必须在自身 manifest 声明、类型导入/spec 允许 devDeps、@vv/* 方向铁律（mock → shared、ui → shared）机械检查；补齐 config（vite/vitest/unocss + 可选 iconify peers）/ ui（vue-i18n、@element-plus/icons-vue）/ shared（normalize.css、zod devDep）声明；icons 与 normalize.css 收敛 catalog 单版本源
- **边界不变**：apps/* 的 AutoImport DX 全保留；@vv/ui 注入式源码与 optimizeDeps.exclude 本批不动（后续独立批次）
- **验证**：`pnpm test:eslint-rules` 17 用例绿；`pnpm lint` / `pnpm type-check` / `pnpm test` / `pnpm build` 全绿；shared 包测试在无 AutoImport 配置下通过
- **手动验证步骤**：`pnpm dev:gateway admin auth` → ① 登录成功/失败提示样式正常；② 触发路由错误 toast（跳未注册 name）样式正常；③ v-copy 复制提示样式正常；④ 会话过期提示正常
```

- [ ] **Step 4: 提交（须经用户确认）**

```bash
git add CLAUDE.md packages/shared/README.md CHANGELOG.md
git commit -m "docs: 包源码自包含约定入档（CLAUDE.md §1.6.3 + shared README 契约改写 + CHANGELOG）"
```

---

## Task 9: 全量门禁 + 浏览器冒烟

**Files:** 无新增修改（纯验证）。

- [ ] **Step 1: 自动门禁全量跑**

依次运行，全部须 PASS：

```bash
pnpm test:eslint-rules
pnpm lint
pnpm type-check
pnpm test
pnpm build
pnpm check:routes
pnpm check:aliases
pnpm test:gateway
```

- [ ] **Step 2: 浏览器冒烟（给用户的手动验证步骤）**

```bash
pnpm dev:gateway admin auth
```

1. 打开 `http://localhost:8080/admin/`，未登录跳 `/auth/login`，用 `admin / 123456` 登录成功回跳。
2. 登录失败（错误密码）→ ElMessage 错误提示**样式正常**（有边框/底色/图标，非裸文本）。
3. 会话过期场景（DevTools 删 cookie 后刷新受保护页）→ 「登录已过期」提示样式正常。
4. 找一处 v-copy 按钮复制 → 成功提示样式正常。
5. 终端 dev server 无 `ReferenceError` / 预构建报错；浏览器 console 无红色报错。

- [ ] **Step 3: 观察项记录（不修改）**

`packages/config/src/create-vite-config.ts` 的 `optimizeDeps.exclude` 本批保留。若 Step 2 全过且无异常，在会话内向用户汇报「shared 条目或可在后续批次删减」的观察结论即可，**不动配置**。

---

## Self-Review 记录（写计划时完成）

- **Spec 覆盖**：§5.1→Task 4/5；§5.2→Task 4 Step 4 / Task 5 Step 7-8；§5.3→Task 6；§5.4→Task 7；§5.5→Task 3；§5.6→Task 1/2；§5.7→Task 9 Step 3；§7 验证→Task 9；文档→Task 8。无缺口。
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码；所有命令含预期输出。
- **类型一致性**：规则 messageId（undeclared/forbiddenDirection/unknownVvPackage）在实现与测试中一致；`VV_DIRECTION` 键名两文件一致；脚本名 `test:eslint-rules` 在 Task 1/2/8/9 一致。
- **顺序正确性**：规则先于 manifest 修复接线（RED→GREEN 证明规则有效）；显式导入先于全局声明删除（type-check 权威兜底）；AutoImport 摘除在最后（运行时兜底）。
