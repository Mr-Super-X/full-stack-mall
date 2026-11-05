# 生产页面版本检测插件 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增可插拔版本检测插件（runtime Vue 插件 + 构建期 vite 插件），6 app 经 `createAppPlugins` 工厂默认装配后拥有「轮询 version.json + ChunkLoadError 兜底」双机制检测能力。

**Architecture:** runtime 插件进 `packages/shared/src/plugins/versionCheck.ts`（纯函数层 + Vue 插件薄装配，零 UI 依赖，回调注入）；构建插件进 `packages/config/src/version-check-vite.ts`（`closeBundle` 写 `version.json`）；两侧分别接入 `createAppPlugins` / `createViteConfig` 工厂，6 app 零改动。

**Tech Stack:** Vue 3 App 插件形态 / vite Plugin API / vitest（fake timers + mock fetch）/ `node:fs`

**Spec:** `docs/superpowers/specs/2026-10-28-version-check-plugin-design.md`

**Spec 修订记录（写计划时发现，已同步改 spec）：**
1. docs 序号 45 → **44**（仓库现有最大 docs/43）
2. `onUpdate` 签名由 `{ oldId: string; newId: string }` 放宽为 `VersionInfo`（含 `source: 'poll' | 'chunk-error'` + 可空 id）——chunk-error 兜底回落 onUpdate 时本无版本信息，原签名类型不诚实

**⚠️ Git 纪律：** 项目 CLAUDE.md §二 #7 禁止擅自 commit。每个任务末尾的 commit 步骤**必须经用户明确批准后执行**；未批准则跳过 commit 继续下一任务。

**项目约定速查（执行者必读）：**
- 包内相对导入必须带 `.ts` 扩展名（Node 原生 ESM 不补全）
- runtime 插件范式参照 `packages/shared/src/plugins/webVitals.ts`（default export `{ install }` + 具名导出纯函数供测试）
- vite 插件范式参照 `packages/config/src/clean-mock-bundled.ts`（`name: 'vv:xxx'`）
- spec 风格参照 `packages/shared/src/plugins/remAdaptation.spec.ts`（直接 import，无 AutoImport）
- 测试命令：`pnpm -C packages/<p> vitest run <相对路径>`（pnpm 将未知命令转发 node_modules/.bin）

---

### Task 1: 构建期 vite 插件 `version-check-vite.ts`

**Files:**
- Create: `packages/config/src/version-check-vite.ts`
- Test: `packages/config/src/version-check-vite.spec.ts`

- [ ] **Step 1: 写失败测试**

创建 `packages/config/src/version-check-vite.spec.ts`：

```ts
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ResolvedConfig } from 'vite'
import { createVersionPayload, versionCheckVitePlugin } from './version-check-vite'

describe('packages/config version-check-vite — version.json 生成', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'vv-version-check-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.VITE_BUILD_ID
  })

  /** 按 vite 真实调用序模拟：configResolved 存 outDir → closeBundle 写文件 */
  function runCloseBundle(outDir: string): void {
    const plugin = versionCheckVitePlugin()
    expect(plugin.apply).toBe('build')
    plugin.configResolved?.({ build: { outDir } } as unknown as ResolvedConfig)
    if (typeof plugin.closeBundle === 'function') {
      plugin.closeBundle()
    }
  }

  it('closeBundle 往 outDir 写 version.json（schema：buildId + builtAt）', () => {
    runCloseBundle(tmpDir)
    const parsed = JSON.parse(readFileSync(join(tmpDir, 'version.json'), 'utf-8'))
    expect(typeof parsed.buildId).toBe('string')
    expect(parsed.buildId.length).toBeGreaterThan(0)
    expect(typeof parsed.builtAt).toBe('string')
    expect(Number.isNaN(Date.parse(parsed.builtAt))).toBe(false)
  })

  it('VITE_BUILD_ID 注入时优先采用（CI 注入 git sha 路径）', () => {
    process.env.VITE_BUILD_ID = 'ci-sha-abc123'
    runCloseBundle(tmpDir)
    const parsed = JSON.parse(readFileSync(join(tmpDir, 'version.json'), 'utf-8'))
    expect(parsed.buildId).toBe('ci-sha-abc123')
  })

  it('createVersionPayload：显式入参优先于环境变量', () => {
    process.env.VITE_BUILD_ID = 'env-sha'
    expect(createVersionPayload('explicit-id').buildId).toBe('explicit-id')
  })

  it('createVersionPayload：未注入时兜底格式非空', () => {
    const payload = createVersionPayload()
    expect(typeof payload.buildId).toBe('string')
    expect(payload.buildId.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm -C packages/config vitest run src/version-check-vite.spec.ts
```

预期：FAIL（`Failed to resolve import "./version-check-vite"` 或模块不存在）。

- [ ] **Step 3: 写最小实现**

创建 `packages/config/src/version-check-vite.ts`：

```ts
/**
 * Vite 插件：构建期生成 version.json（版本检测插件的构建侧，@vv/config 单源）。
 *
 * 文件角色：versionCheck runtime 插件（packages/shared/src/plugins/versionCheck.ts）
 * 的构建侧配套——runtime 定时轮询 version.json 比对 buildId，本插件在 build 的
 * closeBundle 钩子往 outDir（与 index.html 同级）写该文件。
 *
 * 设计要点：
 *   - apply: 'build' —— dev serve 不触发（HMR 即热更新，dev server 无 version.json；
 *     runtime 侧 dev 默认也不启动轮询，enabled 强制开启时 fetch 404 静默跳过）
 *   - buildId 来源优先级：显式入参 > process.env.VITE_BUILD_ID（CI 注入 git sha
 *     可追溯）> 兜底 `Date.now().toString(36) + random`（本地构建唯一）
 *   - 不经 rollup asset pipeline（assetFileNames 会把 .json 归 assets/）——
 *     closeBundle 直接 writeFileSync 到 outDir 根，保证与 index.html 同级的固定 URL
 *
 * @see [`packages/shared/src/plugins/versionCheck.ts`](../../shared/src/plugins/versionCheck.ts) runtime 轮询消费方
 * @group 插件：版本检测（构建侧）
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

/** version.json 载荷（runtime parseVersionPayload 消费同 schema） */
export interface VersionPayload {
  buildId: string
  builtAt: string
}

/**
 * 构造 version.json 载荷。纯函数独立导出供测试直调（hook 装配只是包装）。
 *
 * @param explicitBuildId - 显式 buildId（最高优先级，测试/特殊构建用）
 * @returns buildId + ISO 时间戳
 */
export function createVersionPayload(explicitBuildId?: string): VersionPayload {
  return {
    buildId:
      explicitBuildId ??
      process.env.VITE_BUILD_ID ??
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    builtAt: new Date().toISOString(),
  }
}

/**
 * 创建 version-check vite 插件：closeBundle 时把 version.json 写到 outDir 根。
 *
 * @example createViteConfig 内装配（工厂单点，6 app 零改动）
 */
export function versionCheckVitePlugin(): Plugin {
  let outDir = 'dist'

  return {
    name: 'vv:version-check',
    apply: 'build',
    configResolved(config: ResolvedConfig) {
      // config.build.outDir 可能是相对路径（相对 app cwd），resolve 成绝对路径
      outDir = resolve(config.build.outDir)
    },
    closeBundle() {
      const payload = createVersionPayload()
      writeFileSync(resolve(outDir, 'version.json'), JSON.stringify(payload, null, 2))
    },
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm -C packages/config vitest run src/version-check-vite.spec.ts
```

预期：4 用例全 PASS。

- [ ] **Step 5: 包级全量测试确认无回归**

```bash
pnpm -C packages/config test
```

预期：全绿（含本包既有 postcss/proxy/scss/vendor-chunks/app-manifest 等 spec）。

- [ ] **Step 6: Commit（需用户批准）**

```bash
git add packages/config/src/version-check-vite.ts packages/config/src/version-check-vite.spec.ts
git commit -m "feat(config): version-check 构建插件——closeBundle 生成 version.json（buildId + builtAt）"
```

---

### Task 2: runtime 纯函数层（versionCheck.ts 核心逻辑）

**Files:**
- Create: `packages/shared/src/plugins/versionCheck.ts`（本任务先写纯函数 + 类型，default export 占位在 Task 3 补全）
- Test: `packages/shared/src/plugins/versionCheck.spec.ts`

- [ ] **Step 1: 写失败测试**

创建 `packages/shared/src/plugins/versionCheck.spec.ts`（本任务覆盖纯函数 + poller；install 装配用例在 Task 3 追加到本文件）：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_INTERVAL_MS,
  createVersionPoller,
  isChunkLoadErrorMessage,
  parseVersionPayload,
  shouldEnable,
} from './versionCheck.ts'

/** 构造 mock fetch：返回固定 buildId 的 version.json 响应 */
const makeFetch = (buildId: string, ok = true) =>
  vi.fn(
    async () =>
      ({
        ok,
        text: async () => JSON.stringify({ buildId, builtAt: '2026-10-28T00:00:00.000Z' }),
      }) as unknown as Response
  )

describe('versionCheck — shouldEnable（dev 默认禁用裁决）', () => {
  it('DEV=true 缺省不启用（HMR 即热更新）', () => {
    expect(shouldEnable(true, undefined)).toBe(false)
  })

  it('DEV=true + enabled:true 强制启用（dev 调试路径）', () => {
    expect(shouldEnable(true, { enabled: true })).toBe(true)
  })

  it('DEV=false 缺省启用（prod 默认开）', () => {
    expect(shouldEnable(false, undefined)).toBe(true)
  })

  it('enabled:false 任何环境禁用', () => {
    expect(shouldEnable(false, { enabled: false })).toBe(false)
  })
})

describe('versionCheck — isChunkLoadErrorMessage（4 种浏览器 message 形态）', () => {
  it.each([
    ['ChunkLoadError（webpack 风格）', 'ChunkLoadError: Loading chunk 123 failed'],
    [
      'Failed to fetch dynamically imported module（vite/原生 ESM）',
      'TypeError: Failed to fetch dynamically imported module: https://x/js/index-a.js',
    ],
    [
      'Importing a module script failed（Safari）',
      'Importing a module script failed.',
    ],
    [
      'error loading dynamically imported module（Firefox）',
      'error loading dynamically imported module: ./js/index-b.js',
    ],
  ])('匹配 %s', (_label, msg) => {
    expect(isChunkLoadErrorMessage(msg)).toBe(true)
  })

  it('不匹配普通错误（不误报）', () => {
    expect(isChunkLoadErrorMessage('TypeError: Cannot read properties of undefined')).toBe(false)
    expect(isChunkLoadErrorMessage('')).toBe(false)
  })
})

describe('versionCheck — parseVersionPayload', () => {
  it('合法载荷返回 buildId', () => {
    expect(parseVersionPayload('{"buildId":"abc","builtAt":"2026-10-28T00:00:00Z"}')).toBe('abc')
  })

  it('JSON 非法返回 null（静默跳过）', () => {
    expect(parseVersionPayload('not-json')).toBeNull()
  })

  it('缺 buildId 字段返回 null', () => {
    expect(parseVersionPayload('{"builtAt":"2026-10-28T00:00:00Z"}')).toBeNull()
  })

  it('buildId 非字符串返回 null', () => {
    expect(parseVersionPayload('{"buildId":123}')).toBeNull()
  })
})

describe('versionCheck — createVersionPoller（fake timers）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makePoller = (buildId: string, onUpdate = vi.fn()) => {
    const fetchImpl = makeFetch(buildId)
    const poller = createVersionPoller({
      path: '/admin/version.json',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate,
      fetchImpl,
    })
    return { poller, fetchImpl, onUpdate }
  }

  it('首次 poll 建立基线，不调 onUpdate', async () => {
    const { poller, onUpdate } = makePoller('v1')
    await poller.pollOnce()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(poller.getBaseline()).toBe('v1')
  })

  it('基线相同不调；buildId 变化触发 onUpdate（source=poll，基线同步更新）', async () => {
    const onUpdate = vi.fn()
    const fetchImpl = makeFetch('v1')
    const poller = createVersionPoller({
      path: '/p',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate,
      fetchImpl,
    })
    await poller.pollOnce()
    await poller.pollOnce()
    expect(onUpdate).not.toHaveBeenCalled()

    fetchImpl.mockImplementation(async () => ({
      ok: true,
      text: async () => JSON.stringify({ buildId: 'v2' }),
    }) as unknown as Response)
    await poller.pollOnce()
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({ oldId: 'v1', newId: 'v2', source: 'poll' })
    expect(poller.getBaseline()).toBe('v2')

    // 基线已更新：同 newId 不再触发
    await poller.pollOnce()
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('start 后定时器按 intervalMs 自动轮询', async () => {
    const { poller, fetchImpl } = makePoller('v1')
    poller.start()
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    poller.stop()
  })

  it('自定义 intervalMs 生效', async () => {
    const fetchImpl = makeFetch('v1')
    const poller = createVersionPoller({
      path: '/p',
      intervalMs: 1000,
      onUpdate: vi.fn(),
      fetchImpl,
    })
    poller.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    poller.stop()
  })

  it('fetch reject 静默不抛（网络抖动等下一轮）', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    const poller = createVersionPoller({
      path: '/p',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate: vi.fn(),
      fetchImpl,
    })
    await expect(poller.pollOnce()).resolves.toBeUndefined()
  })

  it('res.ok=false 静默跳过（404 等）', async () => {
    const fetchImpl = makeFetch('v1', false)
    const p2 = createVersionPoller({
      path: '/p',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate: vi.fn(),
      fetchImpl,
    })
    await p2.pollOnce()
    expect(p2.getBaseline()).toBeNull()
  })

  it('请求带 cache:no-store 与 cache-busting query（防 gh-pages CDN 缓存）', async () => {
    const fetchImpl = makeFetch('v1')
    const poller = createVersionPoller({
      path: '/admin/version.json',
      intervalMs: DEFAULT_INTERVAL_MS,
      onUpdate: vi.fn(),
      fetchImpl,
    })
    await poller.pollOnce()
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url.startsWith('/admin/version.json?_t=')).toBe(true)
    expect(init.cache).toBe('no-store')
  })

  it('stop 后定时器不再触发', async () => {
    const { poller, fetchImpl } = makePoller('v1')
    poller.start()
    poller.stop()
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 3)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm -C packages/shared vitest run src/plugins/versionCheck.spec.ts
```

预期：FAIL（模块 `./versionCheck.ts` 不存在）。

- [ ] **Step 3: 写最小实现**

创建 `packages/shared/src/plugins/versionCheck.ts`（本任务先含类型 + 纯函数 + poller；Task 3 在文件末尾追加 default export 插件对象）：

```ts
/**
 * 版本检测插件（@vv/shared 单源）——生产页面资源更新检测。
 *
 * 文件角色：可插拔 Vue 插件，与 errorHandler / webVitals / remAdaptation 同体系
 * （createAppPlugins 工厂第 4 装配项，6 app 默认拥有）。双机制：
 *   - 主动轮询：定时 fetch version.json（构建侧 version-check-vite 插件生成，
 *     见 packages/config/src/version-check-vite.ts）比对 buildId
 *   - 被动兜底：ChunkLoadError 监听（轮询间隔内用户刚好点到已被新版本删除的
 *     懒加载 chunk 的场景）
 *
 * 设计要点：
 *   - 零 UI 依赖（@vv/shared 不引入 Element Plus）：通知经 onUpdate 回调注入，
 *     与 webVitals 的 options.report 同范式
 *   - 纯函数层（shouldEnable / isChunkLoadErrorMessage / parseVersionPayload /
 *     createVersionPoller）独立导出供单测；default export 只是薄装配
 *   - 基线存模块级变量，不落 localStorage——避免基线跨版本残留致「永远不提示」
 *   - dev 默认不启动（HMR 即热更新；enabled:true 可强制调试）
 *   - 全部错误静默降级（网络抖动 / 404 / 解析失败均不抛），绝不影响业务
 *
 * @see [`../../config/src/version-check-vite.ts`](../../config/src/version-check-vite.ts) 构建侧 version.json 生成
 * @see [`./index.ts`](./index.ts) createAppPlugins 装配入口
 * @group 插件：版本检测
 */
import type { App } from 'vue'

/** onUpdate 回调载荷（chunk-error 触发时无版本信息，id 可空） */
export interface VersionInfo {
  /** 旧版本基线；chunk-error 触发时为 null */
  oldId: string | null
  /** 新版本 buildId；chunk-error 时为 null */
  newId: string | null
  /** 触发源：轮询比对 / chunk 懒加载失败兜底 */
  source: 'poll' | 'chunk-error'
}

/** 版本检测插件 options（PluginsOptions.versionCheck 透传入） */
export interface VersionCheckOptions {
  /** 轮询间隔（ms）。缺省 5min */
  intervalMs?: number
  /**
   * 发现版本更新时回调（业务注入通知实现，如 ElNotification）。
   * 缺省 noop；dev 模式缺省 console.warn。
   * chunk-error 兜底缺省也回落到此回调（source: 'chunk-error'，id 为 null）
   */
  onUpdate?: (info: VersionInfo) => void
  /** ChunkLoadError 兜底独立回调。缺省回落到 onUpdate */
  onChunkError?: (err: Error) => void
  /** 强制启用（dev 模式调试用；prod 无需传） */
  enabled?: boolean
  /** version.json 请求路径。缺省 `${import.meta.env.BASE_URL}version.json` */
  path?: string
}

/** 缺省轮询间隔：5min（后台系统发版频率低，平衡及时性与负载） */
export const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

/**
 * 启用裁决：DEV 缺省关闭（HMR 即热更新，dev server 无 version.json），
 * enabled:true 强制开（dev 调试路径）、enabled:false 强制关。
 * 抽成纯函数以便测试（install 传入 import.meta.env.DEV）。
 */
export function shouldEnable(dev: boolean, options?: VersionCheckOptions): boolean {
  if (options?.enabled === true) return true
  if (options?.enabled === false) return false
  return !dev
}

/** ChunkLoadError 4 种浏览器 message 形态（i 标志忽略大小写） */
const CHUNK_ERROR_RE =
  /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

/** 判断错误 message 是否 chunk 懒加载失败（兜底监听匹配用） */
export function isChunkLoadErrorMessage(message: string): boolean {
  return CHUNK_ERROR_RE.test(message)
}

/**
 * 解析 version.json 响应体：合法返回 buildId，任何异常（JSON 非法 / 缺字段 /
 * 非字符串）返回 null——调用方视 null 为「本次无效，等下一轮」，不抛错。
 */
export function parseVersionPayload(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) return null
    const buildId = (parsed as Record<string, unknown>).buildId
    return typeof buildId === 'string' && buildId.length > 0 ? buildId : null
  } catch {
    return null
  }
}

/** createVersionPoller 入参（fetchImpl 注入点：install 传全局 fetch，测试传 mock） */
export interface PollerOptions {
  /** version.json 请求路径（不含 cache-busting query） */
  path: string
  intervalMs: number
  onUpdate: (info: VersionInfo) => void
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>
}

/** 轮询器句柄（install 持有；测试直调 pollOnce 免定时器） */
export interface VersionPoller {
  start: () => void
  stop: () => void
  /** 单次轮询（visible 恢复时立即补一次也用） */
  pollOnce: () => Promise<void>
  /** 当前基线（测试断言用） */
  getBaseline: () => string | null
}

/**
 * 创建轮询器：基线首次建立 → 后续比对 buildId，变化即 onUpdate 并同步基线
 * （防同一新版本重复触发）。全部错误静默（try-catch 包裹），网络层永不抛。
 */
export function createVersionPoller(opts: PollerOptions): VersionPoller {
  let baseline: string | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  async function pollOnce(): Promise<void> {
    try {
      const res = await opts.fetchImpl(`${opts.path}?_t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const buildId = parseVersionPayload(await res.text())
      if (buildId === null) return
      if (baseline === null) {
        baseline = buildId
        return
      }
      if (buildId !== baseline) {
        const oldId = baseline
        baseline = buildId
        opts.onUpdate({ oldId, newId: buildId, source: 'poll' })
      }
    } catch {
      // 网络抖动 / 中间件异常：本次跳过，等下一轮
    }
  }

  return {
    start() {
      if (timer !== null) return
      timer = setInterval(() => {
        void pollOnce()
      }, opts.intervalMs)
    },
    stop() {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    },
    pollOnce,
    getBaseline: () => baseline,
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm -C packages/shared vitest run src/plugins/versionCheck.spec.ts
```

预期：21 用例全 PASS（4 shouldEnable + 5 chunk-error-message + 4 parse + 8 poller）。

- [ ] **Step 5: Commit（需用户批准）**

```bash
git add packages/shared/src/plugins/versionCheck.ts packages/shared/src/plugins/versionCheck.spec.ts
git commit -m "feat(shared): versionCheck 纯函数层——shouldEnable/CHUNK_ERROR 匹配/载荷解析/轮询器"
```

---

### Task 3: Vue 插件装配（default export install）

**Files:**
- Modify: `packages/shared/src/plugins/versionCheck.ts`（文件末尾追加 default export）
- Test: `packages/shared/src/plugins/versionCheck.spec.ts`（追加 install describe 块）

- [ ] **Step 1: 写失败测试**

在 `packages/shared/src/plugins/versionCheck.spec.ts` 的 import 区追加：

```ts
import versionCheckPlugin from './versionCheck.ts'
```

文件末尾追加：

```ts
describe('versionCheck — install 装配', () => {
  const installOptions = {
    path: '/admin/version.json',
    intervalMs: 1000,
    fetchImpl: makeFetch('v1'),
  }

  it('DEV 缺省不启动轮询（advance 后 fetch 未调）', async () => {
    vi.useFakeTimers()
    const fetchImpl = makeFetch('v1')
    // vitest 下 import.meta.env.DEV === true，等价于 dev 缺省路径
    versionCheckPlugin.install({} as App, { ...installOptions, fetchImpl })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchImpl).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('enabled:true 启动 + install 立即采基线一次', async () => {
    vi.useFakeTimers()
    const fetchImpl = makeFetch('v1')
    const onUpdate = vi.fn()
    versionCheckPlugin.install({} as App, {
      ...installOptions,
      fetchImpl,
      enabled: true,
      onUpdate,
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    // 基线已建：同 buildId 的下一轮不触发
    await vi.advanceTimersByTimeAsync(1000)
    expect(onUpdate).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('chunk-error 兜底：ErrorEvent 匹配 4 形态之一时触发 onChunkError', () => {
    const onChunkError = vi.fn()
    versionCheckPlugin.install({} as App, { enabled: true, onChunkError })
    window.dispatchEvent(new ErrorEvent('error', { message: 'ChunkLoadError: Loading chunk 9 failed' }))
    expect(onChunkError).toHaveBeenCalledTimes(1)
    expect(onChunkError.mock.calls[0]![0]).toBeInstanceOf(Error)
  })

  it('chunk-error 兜底：普通错误不误报', () => {
    const onChunkError = vi.fn()
    versionCheckPlugin.install({} as App, { enabled: true, onChunkError })
    window.dispatchEvent(new ErrorEvent('error', { message: 'TypeError: unrelated' }))
    expect(onChunkError).not.toHaveBeenCalled()
  })

  it('unhandledrejection：reason 为 chunk 加载失败 Error 时触发', () => {
    const onChunkError = vi.fn()
    versionCheckPlugin.install({} as App, { enabled: true, onChunkError })
    const err = new Error('Failed to fetch dynamically imported module: ./js/x.js')
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { reason: err, promise: Promise.resolve() }))
    expect(onChunkError).toHaveBeenCalledTimes(1)
  })

  it('onChunkError 缺省回落 onUpdate（source=chunk-error，id 为 null）', () => {
    const onUpdate = vi.fn()
    versionCheckPlugin.install({} as App, { enabled: true, onUpdate })
    window.dispatchEvent(new ErrorEvent('error', { message: 'ChunkLoadError: failed' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({
      oldId: null,
      newId: null,
      source: 'chunk-error',
    })
  })
})
```

同时把 import 区顶部改为：

```ts
import type { App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

（`App` 类型 + fake timers 已在文件内 import；install 用例复用顶层 makeFetch。）

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm -C packages/shared vitest run src/plugins/versionCheck.spec.ts
```

预期：新增 6 install 用例 FAIL（`versionCheckPlugin` 无 default export / install 未定义）。

- [ ] **Step 3: 写最小实现**

在 `packages/shared/src/plugins/versionCheck.ts` 末尾追加：

```ts
/** 默认 onUpdate：dev console.warn，prod noop（与 webVitals defaultReporter 同风格） */
function defaultOnUpdate(info: VersionInfo): void {
  if (!import.meta.env.DEV) return
  console.warn('[VersionCheck] 检测到资源更新：', info)
}

export default {
  /**
   * Vue 插件 install：装配轮询器 + visibilitychange 节能 + ChunkLoadError 兜底。
   *
   * @example 业务注入通知（ElNotification 等）经 main.ts 的 PluginsOptions.versionCheck 传入
   */
  install(_app: App, options: VersionCheckOptions = {}): void {
    if (!shouldEnable(import.meta.env.DEV, options)) return

    const onUpdate = options.onUpdate ?? defaultOnUpdate
    const poller = createVersionPoller({
      path: options.path ?? `${import.meta.env.BASE_URL}version.json`,
      intervalMs: options.intervalMs ?? DEFAULT_INTERVAL_MS,
      onUpdate,
      fetchImpl: fetch,
    })

    // 页面 hidden 暂停定时器、visible 恢复并立即补一次（后台 tab 不浪费请求）
    const onVisibility = (): void => {
      if (document.hidden) {
        poller.stop()
      } else {
        poller.start()
        void poller.pollOnce()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // ChunkLoadError 兜底：懒加载 chunk 被新版本删除 → 路由跳转 404 时提示刷新。
    // 双监听（error + unhandledrejection）覆盖 4 种浏览器 message 形态；
    // 回调自身异常吞掉，兜底层永不抛。
    const chunkHandler = options.onChunkError ?? ((err: Error) => onUpdate({
      oldId: null,
      newId: null,
      source: 'chunk-error',
    }))
    const onWindowError = (event: ErrorEvent): void => {
      try {
        const msg = event.message ?? ''
        if (isChunkLoadErrorMessage(msg)) {
          chunkHandler(event.error instanceof Error ? event.error : new Error(msg))
        }
      } catch {
        /* 兜底层自身异常吞掉 */
      }
    }
    const onRejection = (event: PromiseRejectionEvent): void => {
      try {
        const reason: unknown = event.reason
        if (reason instanceof Error && isChunkLoadErrorMessage(reason.message)) {
          chunkHandler(reason)
        }
      } catch {
        /* 兜底层自身异常吞掉 */
      }
    }
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onRejection)

    poller.start()
    void poller.pollOnce()
  },
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm -C packages/shared vitest run src/plugins/versionCheck.spec.ts
```

预期：27 用例全 PASS（Task 2 的 21 + install 装配 6）。

- [ ] **Step 5: Commit（需用户批准）**

```bash
git add packages/shared/src/plugins/versionCheck.ts packages/shared/src/plugins/versionCheck.spec.ts
git commit -m "feat(shared): versionCheck Vue 插件装配——install 启停轮询 + visibilitychange + ChunkLoadError 兜底"
```

---

### Task 4: `createAppPlugins` 工厂接线

**Files:**
- Modify: `packages/shared/src/plugins/errorHandler.d.ts`（PluginsOptions 加 versionCheck 项）
- Modify: `packages/shared/src/plugins/index.ts`（工厂第 4 装配项）
- Test: `packages/shared/src/plugins/index.spec.ts`（mock versionCheck + 3 新断言）

- [ ] **Step 1: 写失败测试**

改 `packages/shared/src/plugins/index.spec.ts`：

mock 区加：

```ts
const { mockErrorHandlerInstall, mockWebVitalsInstall, mockRemInstall, mockVersionCheckInstall } = vi.hoisted(() => ({
  mockErrorHandlerInstall: vi.fn(),
  mockWebVitalsInstall: vi.fn(),
  mockRemInstall: vi.fn(),
  mockVersionCheckInstall: vi.fn(),
}))

vi.mock('./versionCheck.ts', () => ({ default: { install: mockVersionCheckInstall } }))
```

beforeEach 加 `mockVersionCheckInstall.mockReset()`。

既有第一个用例「缺省装配 errorHandler + webVitals，不装配 remAdaptation」追加断言：

```ts
expect(mockVersionCheckInstall).toHaveBeenCalledTimes(1)
```

文件末尾追加两个用例：

```ts
it('缺省装配 versionCheck（工厂第 4 项，6 app 零改动拥有）', () => {
  const app = makeApp()
  createAppPlugins().install(app, {})
  expect(mockVersionCheckInstall).toHaveBeenCalledTimes(1)
})

it('options.versionCheck === false 关闭 versionCheck', () => {
  const app = makeApp()
  createAppPlugins().install(app, { versionCheck: false })
  expect(mockVersionCheckInstall).not.toHaveBeenCalled()
})

it('options.versionCheck 对象透传到插件 install', () => {
  const app = makeApp()
  const opts = { onUpdate: vi.fn() }
  createAppPlugins().install(app, { versionCheck: opts })
  expect(mockVersionCheckInstall).toHaveBeenCalledWith(app, opts)
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm -C packages/shared vitest run src/plugins/index.spec.ts
```

预期：FAIL（`versionCheck` 不在 PluginsOptions 类型 / 工厂未装配）。

- [ ] **Step 3: 写最小实现**

`packages/shared/src/plugins/errorHandler.d.ts`：import 区加 `import type { VersionCheckOptions } from './versionCheck.ts'`；`PluginsOptions` 接口末尾加：

```ts
  /** 版本检测（轮询 version.json + ChunkLoadError 兜底）；不传则按 app 环境默认启用
   *  （dev 关闭 / prod 开启），传 false 完全关闭 */
  versionCheck?: VersionCheckOptions | false
```

`packages/shared/src/plugins/index.ts`：import 区加 `import versionCheckPlugin from './versionCheck.ts'`；install 内 remAdaptation 装配块之后加：

```ts
      // 4. 版本检测（默认启用；传 false 可关）——轮询 version.json 比对 buildId +
      //    ChunkLoadError 兜底；dev 模式默认不启动（HMR 即热更新）
      if (options.versionCheck !== false) {
        app.use(versionCheckPlugin, options.versionCheck)
      }
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm -C packages/shared vitest run src/plugins/index.spec.ts
```

预期：7 用例全 PASS（原 4 + 新 3；既有「缺省装配」用例因新断言变 5 断言）。

- [ ] **Step 5: 包级全量测试确认无回归**

```bash
pnpm -C packages/shared test
```

预期：全绿。

- [ ] **Step 6: Commit（需用户批准）**

```bash
git add packages/shared/src/plugins/errorHandler.d.ts packages/shared/src/plugins/index.ts packages/shared/src/plugins/index.spec.ts
git commit -m "feat(shared): createAppPlugins 装配 versionCheck——6 app 零改动默认拥有版本检测"
```

---

### Task 5: `createViteConfig` 工厂接线 + 真实构建验证

**Files:**
- Modify: `packages/config/src/create-vite-config.ts`（插件数组装配）

- [ ] **Step 1: 修改 create-vite-config.ts**

import 区（`import { cleanMockBundled } from './clean-mock-bundled.ts'` 之后）加：

```ts
import { versionCheckVitePlugin } from './version-check-vite.ts'
```

plugins 数组 `...extraPlugins` 之前加：

```ts
      // 版本检测（构建侧）：build 时往 outDir 写 version.json（runtime 轮询消费，见
      // packages/shared/src/plugins/versionCheck.ts）；apply: 'build'，dev serve 零开销
      versionCheckVitePlugin(),
```

- [ ] **Step 2: 类型 + lint 校验**

```bash
pnpm -C packages/config exec vue-tsc --build --force
pnpm lint
```

预期：零错误。（config 包若无独立 type-check 脚本，用根 `pnpm type-check` 亦可。）

- [ ] **Step 3: 真实构建验证 version.json 生成**

```bash
pnpm -C apps/admin build-only
```

预期：构建成功后 `apps/admin/dist/version.json` 存在，内容形如：

```json
{
  "buildId": "m3x...k2",
  "builtAt": "2026-10-28T..."
}
```

验证命令（Git Bash）：

```bash
cat apps/admin/dist/version.json
```

- [ ] **Step 4: 聚合构建兼容核验（gh-pages 路径）**

```bash
pnpm build:pages
```

预期：成功后 `dist/<app>/version.json` 6 份各自存在（admin/auth/portal/h5/big/docs），互不覆盖：

```bash
ls dist/*/version.json
```

预期输出 6 行。

- [ ] **Step 5: Commit（需用户批准）**

```bash
git add packages/config/src/create-vite-config.ts
git commit -m "feat(config): createViteConfig 装配 version-check 插件——build 产物自动带 version.json"
```

---

### Task 6: 文档 + CHANGELOG + README

**Files:**
- Create: `docs/44-版本检测插件使用规范.md`
- Modify: `CHANGELOG.md`（「未发布」区新增 feat 节）
- Modify: `README.md`（顶部最近更新 + §相关文档表）

- [ ] **Step 1: 写 docs/44**

创建 `docs/44-版本检测插件使用规范.md`：

```markdown
# 版本检测插件使用规范（docs/44）

> 生产页面资源更新检测——可插拔 Vue 插件（runtime）+ vite 插件（构建侧）。
> 设计稿：docs/superpowers/specs/2026-10-28-version-check-plugin-design.md

## 1. 机制

| 侧 | 文件 | 职责 |
|---|------|------|
| 构建 | `packages/config/src/version-check-vite.ts` | `closeBundle` 往 outDir 写 `version.json`（`{ buildId, builtAt }`） |
| 运行 | `packages/shared/src/plugins/versionCheck.ts` | 轮询 `version.json` 比对 buildId + `ChunkLoadError` 兜底监听 |

- **轮询**：默认 5min（`intervalMs` 可配），`cache: 'no-store'` + cache-busting query 防 CDN 缓存；`document.hidden` 暂停、`visible` 恢复并立即补一次
- **兜底**：`window error` + `unhandledrejection` 双监听，匹配 4 种浏览器 ChunkLoadError message 形态
- **dev 默认禁用**（HMR 即热更新）；`enabled: true` 可强制调试
- **6 app 零改动默认装配**：`createAppPlugins` 工厂第 4 项 + `createViteConfig` 自动装配构建插件

## 2. 接入（业务注入通知）

`apps/<a>/src/main.ts`：

```ts
app.use(appPlugins, {
  versionCheck: {
    onUpdate: ({ source }) => {
      ElNotification({
        title: '系统更新',
        message: source === 'poll' ? '新版本已发布，请刷新页面' : '页面资源已过期，请刷新',
        type: 'info',
        duration: 0, // 不自动关闭，等用户手动刷新
      })
    },
  },
})
```

## 3. Options 速查

| 字段 | 缺省 | 说明 |
|------|------|------|
| `intervalMs` | `300000`（5min） | 轮询间隔 |
| `onUpdate` | dev console.warn / prod noop | 版本更新回调（chunk-error 缺省也回落此回调，`source: 'chunk-error'`，id 为 null） |
| `onChunkError` | 回落 `onUpdate` | chunk 懒加载失败独立回调 |
| `enabled` | dev false / prod true | 强制开关（dev 调试用） |
| `path` | `${BASE_URL}version.json` | 多 base 部署自动适配 |
| —— 关闭 | `versionCheck: false` | 传入 `PluginsOptions.versionCheck = false` 完全关闭 |

## 4. CI 注入 git sha（推荐）

构建时注入 `VITE_BUILD_ID` 使 buildId 可追溯：

```yaml
# .github/workflows/*.yml build 步骤
env:
  VITE_BUILD_ID: ${{ github.sha }}
```

缺省兜底为 `Date.now().toString(36) + random`（本地构建唯一）。

## 5. 排障

| 现象 | 排查 |
|------|------|
| 生产环境从不提示 | ① `dist/<app>/version.json` 是否存在 ② Network 面板轮询 URL 是否 200 ③ `onUpdate` 是否注入 |
| dev 模式想验证 | `enabled: true` + dev server 需先跑一次 `build` 生成 version.json 并拷贝到 dev 服务根（或配 `path` 指向已构建产物） |
| gh-pages 上 404 | base 前缀是否正确（`path` 缺省读 `import.meta.env.BASE_URL`，多 app 自动适配） |
```

- [ ] **Step 2: CHANGELOG「未发布」区新增 feat 节**

读 `CHANGELOG.md` 顶部确认「未发布」区格式，在其 feat 列表追加（格式与既有条目一致）：

```markdown
- 版本检测插件（可插拔）：`@vv/shared` `versionCheck` runtime 插件（轮询 `version.json` 比对 buildId + `ChunkLoadError` 兜底监听，零 UI 依赖回调注入）+ `@vv/config` `version-check-vite` 构建插件（`closeBundle` 生成 `version.json`）；`createAppPlugins` / `createViteConfig` 工厂默认装配，6 app 零改动拥有检测能力（docs/44）
```

- [ ] **Step 3: README 同步**

1. 顶部「最近更新」区加一行（格式仿既有「上轮同步」行）：

```markdown
> 本轮同步（2026-10-28）：可插拔版本检测插件——`createAppPlugins` 工厂第 4 项 `versionCheck`（轮询 version.json + ChunkLoadError 兜底，回调注入零 UI 依赖）+ `createViteConfig` 构建侧自动装配 `version.json`，6 app 零改动拥有生产资源更新检测能力，详见 [docs/44](docs/44-版本检测插件使用规范.md) 与 [CHANGELOG.md](CHANGELOG.md)。
```

2. §相关文档「项目规范」表末尾追加行：

```markdown
| 版本检测插件使用规范        | `docs/44-版本检测插件使用规范.md`             | 轮询 version.json + ChunkLoadError 双机制 / onUpdate 回调注入 / CI 注入 git sha          |
```

- [ ] **Step 4: 文档一致性校验（CI 门禁同源）**

```bash
pnpm check:doc-currency
```

预期：PASS（若脚本硬数据清单未覆盖本插件属正常——只锁 13 项硬数据）。

- [ ] **Step 5: Commit（需用户批准）**

```bash
git add docs/44-版本检测插件使用规范.md CHANGELOG.md README.md
git commit -m "docs: 版本检测插件使用规范（docs/44）+ CHANGELOG/README 同步"
```

---

### Task 7: 全量验证门禁

- [ ] **Step 1: 全量测试**

```bash
pnpm test
```

预期：turbo 拓扑序全绿（6 app + 4 包）。

- [ ] **Step 2: 类型 + lint**

```bash
pnpm type-check
pnpm lint
```

预期：零错误。

- [ ] **Step 3: 全量构建（含类型门禁）**

```bash
pnpm build
```

预期：6 app 构建成功。

- [ ] **Step 4: 产物终验**

```bash
ls dist-prod/*/version.json 2>/dev/null || ls dist/*/version.json
```

预期：6 份 version.json 各自存在。（`pnpm build` 产物根依 build 配置；若目录不同，以实际 outDir 为准逐一核验 6 app。）

- [ ] **Step 5: 合规简报**

对照 spec §11 输出合规自查表 + workspace 写操作清单（§2.5 要求）：

```
【workspace 写操作清单】
新增：packages/config/src/version-check-vite.ts(+spec)
      packages/shared/src/plugins/versionCheck.ts(+spec)
      docs/44-版本检测插件使用规范.md
      docs/superpowers/specs/2026-10-28-version-check-plugin-design.md
      docs/superpowers/plans/2026-10-28-version-check-plugin.md
修改：packages/shared/src/plugins/index.ts / errorHandler.d.ts / index.spec.ts
      packages/config/src/create-vite-config.ts
      CHANGELOG.md / README.md
删除：无
```

---

## Self-Review 记录（写计划时已执行）

1. **Spec 覆盖**：§3 文件清单 → Task 1-6 全覆盖；§4 数据流 → Task 1（构建）+ Task 2/3（运行）；§5/§6 契约与默认值 → Task 2（纯函数 + poller）+ Task 3（install 装配 + defaultOnUpdate）；§7 错误矩阵 → Task 2 spec（reject / !ok / parse 失败 / 缺字段）+ Task 3（兜底 try-catch）；§8 测试矩阵 → Task 1/2/3/4 spec；§9 文档 → Task 6；§10 验证门禁 → Task 5 Step 3-4 + Task 7。**无缺口。**
2. **占位符扫描**：每步含完整代码与精确命令，无 TBD/「类似 Task N」/「适当处理」。✅
3. **类型一致性**：`VersionCheckOptions` / `VersionInfo` / `DEFAULT_INTERVAL_MS` / `createVersionPoller` / `shouldEnable` / `isChunkLoadErrorMessage` / `parseVersionPayload` / `versionCheckVitePlugin` / `createVersionPayload` / `PluginsOptions.versionCheck` 跨任务命名一致；poller 入参 `fetchImpl` 在 Task 2 定义、Task 3 install 传 `fetch`、spec installOptions 注入 mock，链路闭合。✅
