# 应用 Manifest 与 New-App 脚手架（P2）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让每个 app 的 `name/port/requiredRoutes` 只在自己的 `app.manifest.json` 维护一次——`createViteConfig` 从中派生 appId 与 dev 端口（删除 `appName`/`portOffset` 双写），`scripts/apps-registry.mjs` 改为同步发现 manifest 派生同形 `APPS`（保持消费方零改动），并提供 `pnpm new-app` 生成可 dev/build/test 的最小公开应用。

**Architecture:** app 本地 JSON manifest 为单源 → `packages/config` 新增 `.mjs` 读取器（Node/ESLint/Vite 均可同步加载）→ Vite 工厂内部读 manifest 取 appId+port → 注册表改为 `discoverAppManifests(apps/)` 按端口升序派生。`APPS` 形状（`{name,port,requiredRoutes}`）与端口升序不变，dev-gateway/node-gateway/Playwright/ESLint/check-routes 消费方业务逻辑零改动。

**Tech Stack:** Vite 8 工厂、Node ESM（`.mjs` 读取器，因 eslint.config.mjs 无 strip-types）、pnpm catalog、node:test、Vitest。

**Spec:** `docs/superpowers/specs/2026-10-27-app-manifest-scaffolding-design.md`（已批准）

**⚠️ 提交纪律：** 禁止擅自 commit。本计划 6 个 commit，每个经用户确认后执行。

---

## 背景速读（执行者零上下文假设）

- 现状双写：`apps/<a>/vite.config.ts` 传 `appName + portOffset` 给 `createViteConfig`（`packages/config/src/create-vite-config.ts:89,103-104,129,254`），端口实际是 `SERVER_DEFAULTS.port + portOffset`（`server.ts` 的 `SERVER_DEFAULTS.port` 即基座，admin offset 0 → 5174）；同时 `scripts/apps-registry.mjs:24-58` 手写同批 name/port/requiredRoutes。`check-routes.ts:75-99` 用正则锁死这两处一致。
- `apps-registry.mjs` 是 `.mjs` 纯 ESM（因 `eslint.config.mjs` 由 ESLint 直接加载、Node 无 `--experimental-strip-types` 读不了 .ts）；类型镜像在 `apps-registry.d.mts`。
- 消费 `APPS` 的 5 方：`dev-gateway.ts`、`node-gateway.ts`、`playwright.config.ts`、`eslint.config.mjs`、`check-routes.ts`——本计划保持它们 import 路径与 `APPS` 形状不变。
- 端口升序即 app 启动顺序：admin(5174)/docs(5175)/portal(5176)/h5(5177)/big(5178)/auth(5179)。`dev-gateway` 串行拉起依赖此序。
- `createViteConfig` 的 `appName` 现注入 `'import.meta.env.VITE_APP_ID'`（`create-vite-config.ts:227`）。
- `scripts/new-module.ts` 是脚手架参照（kebab 校验 `kebabToPascal`/正则、`existsSync/mkdirSync/writeFileSync`、ROOT=`resolve(import.meta.dirname,'..')`、结尾输出下一步建议）。

---

### Task 1: packages/config 新增 manifest 读取器（TDD）

**Files:**
- Create: `packages/config/src/app-manifest.mjs`
- Create: `packages/config/src/app-manifest.d.mts`
- Create: `packages/config/src/app-manifest.spec.ts`

- [ ] **Step 1: 写测试（Vitest，临时目录）**

创建 `packages/config/src/app-manifest.spec.ts`：

```ts
/**
 * app-manifest 读取器单测（P2 应用 manifest 单源）。
 * 用临时目录构造 manifest，覆盖：合法读取、字段校验、发现+端口排序、错误路径含文件名。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// .mjs 无类型声明，经 @ts-expect-error 引入（实现本任务 Step 2 提供）
// @ts-expect-error 纯 ESM 实现，类型由 app-manifest.d.mts 提供
import { readAppManifest, discoverAppManifests } from './app-manifest.mjs'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'app-manifest-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeManifest(appName: string, manifest: unknown) {
  const appDir = join(dir, appName)
  mkdirSync(appDir, { recursive: true })
  writeFileSync(join(appDir, 'app.manifest.json'), JSON.stringify(manifest))
}

describe('readAppManifest', () => {
  it('合法 manifest 返回 name/port/requiredRoutes', () => {
    writeManifest('admin', { name: 'admin', port: 5174, requiredRoutes: ['NotFound'] })
    expect(readAppManifest(join(dir, 'admin'))).toEqual({
      name: 'admin',
      port: 5174,
      requiredRoutes: ['NotFound'],
    })
  })
  it('缺 NotFound 报错且含文件路径', () => {
    writeManifest('x', { name: 'x', port: 5200, requiredRoutes: ['Home'] })
    expect(() => readAppManifest(join(dir, 'x'))).toThrow(/NotFound.*app\.manifest\.json/)
  })
  it('name 与目录不一致报错', () => {
    writeManifest('x', { name: 'y', port: 5200, requiredRoutes: ['NotFound'] })
    expect(() => readAppManifest(join(dir, 'x'))).toThrow(/目录名不一致/)
  })
  it('JSON 语法错报错含路径', () => {
    const appDir = join(dir, 'x')
    mkdirSync(appDir, { recursive: true })
    writeFileSync(join(appDir, 'app.manifest.json'), '{ bad json')
    expect(() => readAppManifest(appDir)).toThrow(/app\.manifest\.json/)
  })
})

describe('discoverAppManifests', () => {
  it('按 port 升序返回，忽略无 manifest 的目录', () => {
    writeManifest('auth', { name: 'auth', port: 5179, requiredRoutes: ['Login', 'NotFound'] })
    writeManifest('admin', { name: 'admin', port: 5174, requiredRoutes: ['NotFound'] })
    mkdirSync(join(dir, 'empty-dir'), { recursive: true })
    const apps = discoverAppManifests(dir)
    expect(apps.map((a) => a.name)).toEqual(['admin', 'auth'])
  })
  it('重复 port 报错', () => {
    writeManifest('a', { name: 'a', port: 5200, requiredRoutes: ['NotFound'] })
    writeManifest('b', { name: 'b', port: 5200, requiredRoutes: ['NotFound'] })
    expect(() => discoverAppManifests(dir)).toThrow(/重复.*port|port.*重复/)
  })
})
```

- [ ] **Step 2: 跑测试确认 RED**（`./app-manifest.mjs` 不存在）

Run: `pnpm -C packages/config exec vitest run src/app-manifest.spec.ts`
Expected: FAIL —— `Cannot find module './app-manifest.mjs'`。

- [ ] **Step 3: 写实现 `app-manifest.mjs`**

```js
/**
 * app.manifest.json 读取器（P2 应用 manifest 单源）。
 *
 * 为什么 .mjs：eslint.config.mjs 由 ESLint 直接加载、Node 无 --experimental-strip-types 读不了
 * .ts——与 apps-registry.mjs 同约束。类型由 app-manifest.d.mts 提供。
 *
 * 契约见 docs/superpowers/specs/2026-10-27-app-manifest-scaffolding-design.md §5。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const MANIFEST_FILE = 'app.manifest.json'

function fail(appDir, msg) {
  throw new Error(`[app-manifest] ${join(appDir, MANIFEST_FILE)}：${msg}`)
}

function validate(appDir, raw) {
  if (typeof raw !== 'object' || raw === null) fail(appDir, '须为 JSON 对象')
  const { name, port, requiredRoutes } = raw
  const dirName = appDir.split(/[\\/]/).pop()
  if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(name))
    fail(appDir, `name 须为 kebab-case，当前 ${JSON.stringify(name)}`)
  if (name !== dirName) fail(appDir, `name「${name}」与目录名「${dirName}」不一致`)
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    fail(appDir, `port 须为 1-65535 整数，当前 ${JSON.stringify(port)}`)
  if (!Array.isArray(requiredRoutes) || requiredRoutes.length === 0 ||
      !requiredRoutes.every((r) => typeof r === 'string'))
    fail(appDir, 'requiredRoutes 须为非空字符串数组')
  if (!requiredRoutes.includes('NotFound')) fail(appDir, 'requiredRoutes 必须包含 NotFound')
  return { name, port, requiredRoutes }
}

export function readAppManifest(appDir) {
  const file = join(appDir, MANIFEST_FILE)
  if (!existsSync(file)) fail(appDir, '文件不存在')
  let raw
  try {
    raw = JSON.parse(readFileSync(file, 'utf-8'))
  } catch (e) {
    fail(appDir, `JSON 语法错：${e.message}`)
  }
  return validate(appDir, raw)
}

export function discoverAppManifests(appsDir) {
  const apps = []
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const appDir = join(appsDir, entry.name)
    if (!existsSync(join(appDir, MANIFEST_FILE))) continue
    apps.push(readAppManifest(appDir))
  }
  const seen = new Map()
  for (const a of apps) {
    if (seen.has(a.port)) fail(appsDir, `重复 port ${a.port}（${seen.get(a.port)} 与 ${a.name}）`)
    seen.set(a.port, a.name)
  }
  return apps.sort((a, b) => a.port - b.port)
}
```

- [ ] **Step 4: 写类型声明 `app-manifest.d.mts`**

```ts
/** app-manifest.mjs 的类型镜像（与 apps-registry.d.mts 同先例，改字段时两处同步）。 */
export interface AppManifest {
  name: string
  port: number
  requiredRoutes: string[]
}
export function readAppManifest(appDir: string): AppManifest
export function discoverAppManifests(appsDir: string): AppManifest[]
```

- [ ] **Step 5: 跑测试确认 GREEN**

Run: `pnpm -C packages/config exec vitest run src/app-manifest.spec.ts`
Expected: PASS（8 例）。

- [ ] **Step 6: Commit（经用户确认）**

```bash
git add packages/config/src/app-manifest.mjs packages/config/src/app-manifest.d.mts packages/config/src/app-manifest.spec.ts
git commit -m "feat(config): app-manifest 读取器——app 元数据单源（name/port/requiredRoutes 校验+发现+端口升序）"
```

---

### Task 2: createViteConfig 改读 manifest（删 appName/portOffset 双写）

**Files:**
- Modify: `packages/config/src/create-vite-config.ts`
- Modify: `packages/config/src/index.ts`（导出新 reader）
- Modify: `packages/config/src/create-vite-config.spec.ts`（若断言 appName/portOffset，同步更新）

> 本任务**不动** 6 个 app 的 vite.config.ts（Task 3 一起迁，避免中间态红）。

- [ ] **Step 1: 改 create-vite-config.ts**

顶部 import 区加：

```ts
import { readAppManifest } from './app-manifest.mjs'
```

`AppViteOptions` 接口（`create-vite-config.ts:85-104`）：**删除** `appName: string`（第 89 行）与 `portOffset?: number`（第 103-104 行），在 `appRoot` 后加注释说明 appId/port 现来自 manifest。函数签名解构（`create-vite-config.ts:127-136`）同步删 `appName` 与 `portOffset = 0`。

函数体开头（`appRoot` 确定后）加 manifest 读取：

```ts
  const appRoot = ... // 现有
  // P2：appId 与 dev/HMR 端口自 app.manifest.json 单源派生（删 appName/portOffset 双写）
  const manifest = readAppManifest(appRoot)
  const appName = manifest.name
  const devPort = manifest.port
```

`create-vite-config.ts:254` 的 `port: SERVER_DEFAULTS.port + portOffset` 与 `:263-264` 的 `port/clientPort` 三处，改为 `port: devPort`（HMR 的 `clientPort` 同）。

> `import.meta.env.VITE_APP_ID` 注入（`:227`）的 `appName` 变量来源已改为 manifest.name，逻辑不变。

- [ ] **Step 2: create-vite-config.spec.ts 同步**

若 spec 有断言 `appName`/`portOffset` 的用例，改为：在 fixtures 目录放一个 `app.manifest.json`，断言 `VITE_APP_ID` 注入值与 server.port 来自 manifest。无相关用例则跳过。

- [ ] **Step 3: config 包自测**

Run: `pnpm -C packages/config test && pnpm -C packages/config type-check`
Expected: PASS（spec 更新后全绿；读 manifest 的 fixtures 需补 `app.manifest.json`）。

- [ ] **Step 4: Commit（经用户确认）**

```bash
git add packages/config/src/
git commit -m "feat(config): createViteConfig 改读 app.manifest.json——删除 appName/portOffset 双写

AppViteOptions 移除 appName/portOffset；appId 与 dev/HMR 端口自 manifest 派生。
6 app vite.config 迁移随下一任务（避免中间态红）。"
```

---

### Task 3: 6 个 app 建 manifest + 迁 vite.config

**Files:**
- Create: `apps/{admin,auth,big,docs,h5,portal}/app.manifest.json`
- Modify: `apps/{admin,auth,big,docs,h5,portal}/vite.config.ts`（删 `appName`/`portOffset`）

- [ ] **Step 1: 写 6 个 manifest（端口/路由对现注册表）**

`apps/admin/app.manifest.json`：

```json
{ "name": "admin", "port": 5174, "requiredRoutes": ["Forbidden", "NotFound", "ServerError"] }
```

`apps/auth/app.manifest.json`：

```json
{ "name": "auth", "port": 5179, "requiredRoutes": ["Login", "NotFound"] }
```

`apps/big/app.manifest.json`：`{ "name": "big", "port": 5178, "requiredRoutes": ["NotFound"] }`
`apps/docs/app.manifest.json`：`{ "name": "docs", "port": 5175, "requiredRoutes": ["NotFound"] }`
`apps/h5/app.manifest.json`：`{ "name": "h5", "port": 5177, "requiredRoutes": ["NotFound"] }`
`apps/portal/app.manifest.json`：`{ "name": "portal", "port": 5176, "requiredRoutes": ["NotFound"] }`

> requiredRoutes 逐字对现 `apps-registry.mjs` 对应条目（admin 三错误页、auth Login+NotFound、其余 NotFound）。

- [ ] **Step 2: 迁 6 个 vite.config.ts**

每个 app 的 `createViteConfig({...})` 调用：删 `appName: '<a>'` 行与 `portOffset: <n>` 行（若有）。admin 无 portOffset（offset 0）只需删 appName；其余 5 个删两行。`appRoot` 及其余参数保留。

- [ ] **Step 3: 验证 dev 端口仍对（任一 app 起 dev）**

Run: `pnpm -C apps/admin exec vite --port 5174 --strictPort`（后台，curl 5174 确认 200 后 kill）。
或更简：`pnpm dev:gateway admin`（此时注册表仍是旧手写 APPS，端口来自 manifest——admin 应起在 5174）。
Expected: admin 起在 5174。

- [ ] **Step 4: Commit（经用户确认）**

```bash
git add apps/*/app.manifest.json apps/*/vite.config.ts
git commit -m "feat(apps): 6 app 建 app.manifest.json 并迁 vite.config 删 appName/portOffset

元数据单源落 app 本地；vite.config 不再双写。端口/requiredRoutes 对现注册表零漂移。"
```

---

### Task 4: apps-registry.mjs 改派生 + check-routes 去端口锁死

**Files:**
- Modify: `scripts/apps-registry.mjs`
- Modify: `scripts/apps-registry.d.mts`
- Modify: `scripts/check-routes.ts`（`validatePortWiring` 改造）

- [ ] **Step 1: 改 apps-registry.mjs 为派生**

整体替换（保留头注，改为说明现派生自 manifest）：

```js
/**
 * App 注册表 —— Monorepo「App 名单」视图
 *
 * P2 起：数据单源是各 app 的 app.manifest.json（name/port/requiredRoutes），本模块经
 * packages/config 的 discoverAppManifests 同步派生同形 APPS（按 port 升序 = 启动顺序）。
 * 消费方（dev-gateway/node-gateway/playwright/eslint/check-routes）import 路径与 APPS
 * 形状不变，业务逻辑零改动。新增 app 只需建 apps/<name>/app.manifest.json。
 */
import { discoverAppManifests } from '../packages/config/src/app-manifest.mjs'

const __dirname = import.meta.dirname
export const APPS = discoverAppManifests(new URL('../apps/', import.meta.url).pathname)
```

> 验证 6 app 顺序：admin/docs/portal/h5/big/auth（端口升序）。

- [ ] **Step 2: 改 apps-registry.d.mts 复用类型**

```ts
import type { AppManifest } from '../packages/config/src/app-manifest.d.mts'
export type RegistryAppEntry = AppManifest
export const APPS: readonly RegistryAppEntry[]
```

- [ ] **Step 3: 改 check-routes.ts 的 validatePortWiring**

删除端口双写正则校验（manifest 已是单源，无双写可锁）。函数改为「manifest 完整性校验」：对每个含 `src/` 的 apps/<a> 目录，断言存在 `apps/<a>/app.manifest.json`（反向：有 manifest 但无 src 也报）。`SERVER_DEFAULTS` 若仅端口锁死用则删其 import。

替换 `validatePortWiring`（`check-routes.ts:75-99`）为：

```ts
/** manifest 完整性：apps/ 下每个含 src 的 app 必须登记 app.manifest.json（防静默失效）。 */
function validateManifestPresence(): string[] {
  const errors: string[] = []
  const appsDir = resolve(ROOT, 'apps')
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const appDir = join(appsDir, entry.name)
    const hasSrc = existsSync(join(appDir, 'src'))
    const hasManifest = existsSync(join(appDir, 'app.manifest.json'))
    if (hasSrc && !hasManifest)
      errors.push(`apps/${entry.name} 有 src 但缺 app.manifest.json（ESLint 边界/网关/路由校验将静默跳过它）`)
    if (!hasSrc && hasManifest)
      errors.push(`apps/${entry.name} 有 app.manifest.json 但无 src（孤儿 manifest）`)
  }
  return errors
}
```

> A-D 路由/白名单正则校验原样保留。

- [ ] **Step 4: 全量验证消费方零改动**

Run: `pnpm check:routes && pnpm test:gateway && pnpm lint`
Expected: 全 PASS——证明 dev-gateway/node-gateway/eslint/check-routes 对「派生 APPS」无感。

- [ ] **Step 5: Commit（经用户确认）**

```bash
git add scripts/apps-registry.mjs scripts/apps-registry.d.mts scripts/check-routes.ts
git commit -m "feat(scripts): apps-registry 改派生 app.manifest——消灭端口双写，check-routes 转 manifest 完整性校验

APPS 形状/端口升序不变，5 消费方业务逻辑零改动；新增 app 仅需建 manifest。"
```

---

### Task 5: new-app 脚手架

**Files:**
- Create: `scripts/new-app.ts`
- Create: `scripts/new-app.spec.ts`（node:test 临时目录）
- Create: `scripts/templates/app/`（最小公开 app 模板）
- Modify: `package.json`（根，加 `new-app` script）

> 模板文件较多，但每个都是最小骨架。脚本逻辑与模板渲染拆分，避免单文件超行限。

- [ ] **Step 1: 写 new-app.ts（CLI + 校验，不含模板内容）**

参照 `new-module.ts` 风格。核心逻辑：

```ts
#!/usr/bin/env node
// 应用脚手架：生成可 dev/build/test 的最小公开 app（P2）。
// 只写 apps/<name>/ 新目录，不改其他 app/CI/网关/注册表。用法：pnpm new-app <kebab-name>
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..')
const APPS_DIR = join(ROOT, 'apps')
const TEMPLATE_DIR = join(ROOT, 'scripts', 'templates', 'app')

function kebab(s: string): boolean { return /^[a-z][a-z0-9-]*$/.test(s) }

function nextPort(): number {
  const ports = readdirSync(APPS_DIR).filter(d => existsSync(join(APPS_DIR, d, 'app.manifest.json')))
    .map(d => readAppManifest(join(APPS_DIR, d)).port)
  return Math.max(...ports, 5173) + 1  // 5174 起，避免与网关 8080 冲突
}

// renderTemplates 从 TEMPLATE_DIR 读模板，替换 __APP_NAME__/__APP_PORT__/__ROUTE_NAME__ 占位符
// 到 apps/<name>/。预检：kebab、目录不存在、端口不冲突——全过后才写盘。
```

`renderTemplates` 单独一个函数（<80 行）：递归读 TEMPLATE_DIR，逐文件 `String.replaceAll('__APP_NAME__', name)` 等到目标路径。

- [ ] **Step 2: 写最小公开 app 模板（scripts/templates/app/）**

文件（每个都是可运行的最小骨架，占位符 `__APP_NAME__`/`__APP_PORT__`/`__ROUTE_NAME__`）：

- `app.manifest.json`：`{ "name": "__APP_NAME__", "port": __APP_PORT__, "requiredRoutes": ["NotFound"] }`
- `package.json`：name `@vv-app/__APP_NAME__`，scripts dev/build/test/type-check，deps 照现有 app 最小集（vue/vue-router/pinia/@vv/shared/@vv/ui，devDep @vv/config/typescript/vitest 等）
- `index.html`、`env.d.ts`、`uno.config.ts`（最小 presetUno）
- `vite.config.ts`：`createViteConfig({ appRoot })`（无 appName/portOffset，Task 2 已支持）
- `vitest.config.ts`：`createVitestConfig({ appRoot, viteConfig: defineConfig({}) })`
- `tsconfig.json` / `tsconfig.app.json`（照现有 app 最小，extends @vue/tsconfig 或自含）
- `src/main.ts`：`bootstrapApp`（参照现有 app main.ts 最小公开版）
- `src/App.vue`、`src/router/index.ts`（rootRedirect /home + NotFound 兜底 + 白名单全吸收）、`src/router/whitelist.ts`（公开全吸收）
- `src/modules/home/views/index.vue`（公开 Home）+ `src/modules/home/routes/index.ts`
- `src/views/NotFound.vue`

> 模板务必「生成即可 dev/build/test」——这是验收标准，不是半骨架。

- [ ] **Step 3: node:test 临时目录单测 new-app.spec.ts**

```ts
// 校验 kebab 拒绝、目录已存在不写、端口冲突抛错；在临时目录 renderTemplates 后
// 断言 manifest 可读、占位符全部替换（无 __APP_NAME__ 残留）、必需文件齐全。
// renderTemplates 设计为可注入 TEMPLATE_DIR/APPS_DIR，便于临时目录测试。
```

- [ ] **Step 4: 根 package.json 加 script + tsconfig.node include**

`package.json` scripts 加：`"new-app": "node --experimental-strip-types scripts/new-app.ts"`。
`tsconfig.node.json` include 加 `scripts/new-app.ts` 与 `scripts/templates/**`。

- [ ] **Step 5: 生成 smoke app 实测 dev/build/test 后删除**

在临时副本或真实 `apps/scaffold-smoke/` 跑 `pnpm new-app scaffold-smoke` → `pnpm install` 链接 → `pnpm -C apps/scaffold-smoke dev/build/test` → `pnpm check:routes`。全过后**按新建清单删除 `apps/scaffold-smoke/`**（不进最终变更集）。

- [ ] **Step 6: Commit（经用户确认，不含 smoke app）**

```bash
git add scripts/new-app.ts scripts/new-app.spec.ts scripts/templates/app/ package.json tsconfig.node.json
git commit -m "feat(scripts): new-app 脚手架——一条命令生成可 dev/build/test 的最小公开 app

生成器只写 apps/<name>/ 新目录（预检 kebab/目录存在/端口冲突全过后才写盘）；
模板含 manifest/vite/vitest/tsconfig/main/router/公开 home+NotFound。新增 app 零改注册表/CI。"
```

---

### Task 6: 文档 + 全量门禁 + 浏览器冒烟

**Files:**
- Modify: `docs/43-Monorepo结构与开发指引.md`（新增 app 流程改「建 manifest + pnpm new-app」）
- Modify: `README.md`（常用脚本加 new-app）
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 文档**

docs/43 §新增 app 一节改为：「`pnpm new-app <name>` → 生成即跑；端口自动分配；注册表/网关/ESLint 自动派生零手改」。README 常用脚本表加 `new-app`。

- [ ] **Step 2: 全量门禁**

```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build && pnpm check:routes && pnpm check:aliases && pnpm test:gateway
```
全须 PASS。

- [ ] **Step 3: 浏览器冒烟（保持兼容证明）**

`pnpm dev:gateway`（全量）→ CDP 验：启动顺序 5174→5179、根 302 → /portal/、各 app 前缀可达。`pnpm dev:gateway admin auth` 子集 → 根 302 → /admin/、登录回跳正常。

- [ ] **Step 4: Commit（经用户确认）**

```bash
git add docs/43-Monorepo结构与开发指引.md README.md CHANGELOG.md
git commit -m "docs: 新增应用流程改 manifest+new-app——单源零手改入档"
```

---

## Self-Review 记录（写计划时完成）

- **Spec 覆盖**：§5.1 manifest 字段→Task 1；§5.2 读取器 .mjs→Task 1；§5.3 发现/排序→Task 1 discover；§6.1 createViteConfig→Task 2；§6.2 注册表派生→Task 4；§6.3 check-routes→Task 4；§7 new-app→Task 5；Task 3 迁移衔接 2↔4。无缺口。
- **顺序正确性**：读取器(T1)先于工厂改(T2)先于迁移(T3)——工厂改时 fixtures 需 manifest，T1 已提供；T4 派生依赖 T3 的 6 manifest 已就位。
- **消费方零改动验证**：Task 4 Step 4 用 check:routes + test:gateway + lint 实证 5 消费方对派生 APPS 无感。
- **风险**：new-app 模板「生成即可跑」是硬验收（Task 5 Step 5 实测后删 smoke）；manifest 字段与现注册表逐字对（Task 3 Step 1）防端口/路由漂移。
