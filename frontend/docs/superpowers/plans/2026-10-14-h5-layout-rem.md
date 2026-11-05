# H5 Layout + REM 适配 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** routes 中父记录挂 `@/layouts/h5/index.vue` 即获得 H5 面板能力；h5 目录下样式写 px，postcss-pxtorem 编译时自动转 rem，运行时按屏宽动态计算 html fontSize（宽屏限 540px 居中，离开 h5 布局自动恢复）。

**Architecture:** 双轨制——编译时 `build/postcss.ts`（postcss-pxtorem，exclude 函数限定 `src/layouts/h5/` + `src/modules/h5-*/`）；运行时 `src/layouts/h5/config/rem.ts`（纯 TS activate/deactivate）由 h5 layout 生命周期驱动，`src/plugins/remAdaptation.ts` 薄插件只做 viewport meta 幂等确保。

**Tech Stack:** Vue 3.5 / Vite 8 / postcss-pxtorem 6.1.0（已装）/ vitest（jsdom 全局环境）/ pnpm

**Spec:** `docs/superpowers/specs/2026-10-14-h5-layout-rem-design.md`

**提交纪律（项目规则覆盖默认流程）：** 全局 CLAUDE.md 禁止擅自 git commit——各 Task 末尾为「汇报点」（停下汇报变更，由用户决定提交时机），不自动 commit。

---

### Task 1: build/postcss.ts —— 编译时 px→rem 配置（TDD）

**Files:**
- Create: `build/postcss.ts`
- Test: `build/postcss.spec.ts`

**已验证的 API 事实（v6.1.0 源码 + @types 6.1.0）：**
- `import pxtorem from 'postcss-pxtorem'`（CJS `export =` + esModuleInterop）
- defaults 无 `include` 选项、`exclude: null`（非 README 声称的 /node_modules/i）→ 作用域隔离必须用 exclude 函数
- `exclude?: string | RegExp | ((file: string) => boolean)`（@types 确认函数形态合法）
- `minPixelValue: 2` 语义：`pixels < 2` 不转（源码 `index.js:51` `if (pixels < minPixelValue) return m`）
- 默认 propList 只转 font 系 4 属性 → 必须显式 `propList: ['*']`

- [ ] **Step 1: 写失败测试** `build/postcss.spec.ts`

```ts
import { describe, expect, it } from 'vitest'
import { H5_DESIGN_WIDTH, H5_REM_ROOT_VALUE, isH5RemTarget, POSTCSS_PLUGINS } from './postcss'

describe('build/postcss — h5 rem 转换配置', () => {
  it('rootValue = 设计稿宽度 / 10（828 稿 → 82.8）', () => {
    expect(H5_DESIGN_WIDTH).toBe(828)
    expect(H5_REM_ROOT_VALUE).toBe(82.8)
  })

  it.each([
    ['win 反斜杠 h5 layout', 'D:\\proj\\src\\layouts\\h5\\index.vue', true],
    ['posix h5 layout', '/proj/src/layouts/h5/index.vue', true],
    ['win h5-demo 模块', 'D:\\proj\\src\\modules\\h5-demo\\views\\Index.vue', true],
    ['posix h5 前缀模块（未来扩展）', '/proj/src/modules/h5-mall/views/Index.vue', true],
    ['default layout 不命中', 'D:\\proj\\src\\layouts\\default\\index.vue', false],
    ['portal layout 不命中', '/proj/src/layouts/portal/index.vue', false],
    ['普通模块不命中', '/proj/src/modules/user/views/List.vue', false],
    ['非 h5 前缀模块不命中', '/proj/src/modules/demo/views/Index.vue', false],
    ['空字符串不命中', '', false],
  ])('isH5RemTarget: %s', (_label, filePath, expected) => {
    expect(isH5RemTarget(filePath)).toBe(expected)
  })

  it('POSTCSS_PLUGINS 含且仅含 postcss-pxtorem 插件对象', () => {
    expect(POSTCSS_PLUGINS).toHaveLength(1)
    expect(POSTCSS_PLUGINS[0]).toMatchObject({ postcssPlugin: 'postcss-pxtorem' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test build/postcss.spec.ts`
Expected: FAIL（`Cannot find module './postcss'`）

- [ ] **Step 3: 实现** `build/postcss.ts`

```ts
/**
 * PostCSS 配置（单一来源）—— 当前唯一插件是 h5 rem 适配（postcss-pxtorem）。
 *
 * 换算约定（所见即所得）：设计稿标注多少 px，样式就写多少 px。
 *   编译时：X px → X / 82.8 rem（rootValue = 设计稿宽 / 10）
 *   运行时：1rem = min(视口宽, 540) / 10 px（见 src/layouts/h5/config/rem.ts）
 *   渲染值 = X × min(视口宽,540) / 828 px —— 任意屏宽下等比缩放
 *
 * 作用域隔离（关键）：
 *   postcss-pxtorem v6.1.0 源码实测无 include 选项（README 过时），
 *   且 exclude 默认为 null 而非 /node_modules/i —— 不配 exclude 会全量转换！
 *   故用 exclude 函数反向判定实现 include 语义：只有 src/layouts/h5/ 与
 *   src/modules/h5-*​/ 内的样式被转换，后台（default）/ 门户（portal）/ element-plus 零污染。
 *   正则必须兼容 Windows 反斜杠路径（vite 在 win 下 input.file 为 D:\...\src\...）。
 *
 * @group 工程配置：PostCSS
 */
import pxtorem from 'postcss-pxtorem'

/** h5 设计稿宽度（828 稿 → rootValue 82.8；将来换 750 稿只改这一行） */
export const H5_DESIGN_WIDTH = 828
export const H5_REM_ROOT_VALUE = H5_DESIGN_WIDTH / 10

/**
 * 路径是否属于 h5 rem 转换范围。
 * 约定：h5 业务模块以 `h5-` 前缀命名（如 h5-demo / h5-mall），新增模块零配置接入。
 */
export function isH5RemTarget(filePath: string): boolean {
  return (
    /src[\\/]layouts[\\/]h5[\\/]/.test(filePath) ||
    /src[\\/]modules[\\/]h5-[^\\/]+[\\/]/.test(filePath)
  )
}

export const POSTCSS_PLUGINS = [
  pxtorem({
    rootValue: H5_REM_ROOT_VALUE,
    propList: ['*'], // 源码默认只转 font 系 4 属性，必须显式全开
    minPixelValue: 2, // 小于 2px 不转 → 1px 边框保持物理 1px 细线
    mediaQuery: false,
    // exclude 函数反向判定 = include 语义；filePath 防御空值（无来源样式保守不转换）
    exclude: (filePath: string) => !filePath || !isH5RemTarget(filePath),
  }),
]
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test build/postcss.spec.ts`
Expected: PASS（12 个用例）

- [ ] **汇报点**：新增 2 文件（build/postcss.ts + spec），postcss-pxtorem + @types 已在设计阶段安装。

---

### Task 2: vite.config.ts + build/index.ts 接线

**Files:**
- Modify: `build/index.ts`（追加一行）
- Modify: `vite.config.ts`（import 加 POSTCSS_PLUGINS + css 加 postcss 字段）

- [ ] **Step 1: `build/index.ts` barrel 追加**

在 `export * from './scss'` 后追加一行：

```ts
export * from './postcss'
```

- [ ] **Step 2: `vite.config.ts` 接入**

import 块改为（追加 `POSTCSS_PLUGINS`）：

```ts
import {
  resolveSrcDirAliases,
  VENDOR_CHUNKS,
  createProxyConfig,
  SERVER_DEFAULTS,
  SCSS_PREPROCESSOR_OPTIONS,
  POSTCSS_PLUGINS,
} from './build'
```

`css:` 字段改为（在 preprocessorOptions 前加 postcss；inline 配置后 vite 不再查找 postcss.config，项目无此文件无冲突）：

```ts
  css: {
    // h5 rem 适配（postcss-pxtorem）：仅转换 src/layouts/h5/ 与 src/modules/h5-*/（见 build/postcss.ts）
    postcss: { plugins: POSTCSS_PLUGINS },
    preprocessorOptions: {
      scss: SCSS_PREPROCESSOR_OPTIONS,
      less: { javascriptEnabled: true },
    },
  },
```

- [ ] **Step 3: 类型校验**

Run: `pnpm type-check:full`
Expected: PASS（Plugin 类型与 vite AcceptedPlugin 兼容；@types/postcss-pxtorem 提供声明）

- [ ] **汇报点**：修改 2 文件。此时转换管线已接通，但还没有 h5 目录的样式可转——Task 6/7 后才有实际效果。

---

### Task 3: src/plugins/remAdaptation.ts —— viewport 幂等插件（TDD）

**Files:**
- Create: `src/plugins/remAdaptation.ts`
- Test: `src/plugins/remAdaptation.spec.ts`

- [ ] **Step 1: 写失败测试** `src/plugins/remAdaptation.spec.ts`

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import remAdaptation, { ensureViewportMeta } from './remAdaptation'

describe('plugins/remAdaptation — viewport meta 幂等确保', () => {
  beforeEach(() => {
    document.querySelectorAll('meta[name="viewport"]').forEach((el) => el.remove())
  })

  it('无 viewport meta 时创建，content 与 index.html 约定一致', () => {
    ensureViewportMeta()
    const meta = document.querySelector('meta[name="viewport"]')
    expect(meta).not.toBeNull()
    expect(meta?.getAttribute('content')).toBe(
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    )
  })

  it('已有 viewport meta 时幂等（重复调用不重复创建）', () => {
    ensureViewportMeta()
    ensureViewportMeta()
    expect(document.querySelectorAll('meta[name="viewport"]')).toHaveLength(1)
  })

  it('install 调用 ensureViewportMeta（插件形态）', () => {
    remAdaptation.install({} as never)
    expect(document.querySelectorAll('meta[name="viewport"]')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/plugins/remAdaptation.spec.ts`
Expected: FAIL（`Cannot find module './remAdaptation'`）

- [ ] **Step 3: 实现** `src/plugins/remAdaptation.ts`

```ts
/**
 * REM 适配插件（H5 移动端面板能力的一部分）。
 *
 * 职责边界（为何这么薄）：
 *   - 本插件只做「viewport meta 幂等确保」这一件全局一次性的事。
 *   - html fontSize 动态计算 / 宽屏限宽 / resize 监听**故意不在 install 执行**——
 *     本 SPA 多布局共存（default / portal / h5），install 时全局设置会泄漏：
 *     从 h5 页返回后台时 html 内联 width/margin 残留会挤压 default 布局。
 *     激活/恢复由 `src/layouts/h5/config/rem.ts` 承担，绑定 h5 layout 组件生命周期
 *     （onMounted 激活 / onUnmounted 恢复），路由挂 h5 layout 即获得能力。
 *
 * @see [`src/layouts/h5/config/rem.ts`](../layouts/h5/config/rem.ts) fontSize 激活/恢复
 * @see [`./index.ts`](./index.ts) 插件统一注册入口
 * @group 插件：REM 适配
 */

import type { App } from 'vue'

/** 与 index.html 静态声明保持一致（重复创建是冗余，幂等检查跳过） */
const VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'

/**
 * 确保 viewport meta 存在（幂等）。
 * index.html 已静态声明时跳过；插件被其他入口 HTML 复用时兜底创建。
 */
export function ensureViewportMeta(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('meta[name="viewport"]')) return
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'viewport')
  meta.setAttribute('content', VIEWPORT_CONTENT)
  document.head.appendChild(meta)
}

export default {
  /** Vue 插件 install：仅确保 viewport meta。无可配项（关闭走 plugins/index.ts 的 false 开关） */
  install(_app: App): void {
    ensureViewportMeta()
  },
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/plugins/remAdaptation.spec.ts`
Expected: PASS（3 个用例）

- [ ] **汇报点**：新增 2 文件。

---

### Task 4: plugins 接线（index.ts + errorHandler.d.ts）

**Files:**
- Modify: `src/plugins/index.ts`
- Modify: `src/plugins/errorHandler.d.ts`（PluginsOptions 加关闭开关）

- [ ] **Step 1: `src/plugins/errorHandler.d.ts` 的 `PluginsOptions` 追加字段**

```ts
export interface PluginsOptions {
  errorHandler?: ErrorHandlerOptions | false
  /** Web Vitals 上报（不传则默认 dev console.log / prod noop；传 false 完全关闭） */
  webVitals?: WebVitalsOptions | false
  /** REM 适配（H5）：viewport meta 幂等确保；传 false 完全关闭。fontSize 激活归 layouts/h5 */
  remAdaptation?: false
}
```

- [ ] **Step 2: `src/plugins/index.ts` 注册**

import 区追加：

```ts
import remAdaptation from './remAdaptation'
```

install 函数体内「3. 未来扩展点」注释替换为：

```ts
  // 3. REM 适配（H5）：viewport meta 幂等确保（默认启用；传 false 可关闭）
  //    html fontSize 激活/恢复不在此处 —— 由 layouts/h5 组件生命周期驱动（见 remAdaptation.ts 头注释）
  if (options.remAdaptation !== false) {
    app.use(remAdaptation)
  }
```

- [ ] **Step 3: 跑测试 + 类型校验**

Run: `pnpm test src/plugins` && `pnpm type-check:full`
Expected: PASS（现有 errorHandler/webVitals spec 不受影响）

- [ ] **汇报点**：修改 2 文件。main.ts 的 `app.use(Plugins)` 无 options → remAdaptation 默认启用。

---

### Task 5: src/layouts/h5/config/rem.ts —— 运行时核心（TDD）

**Files:**
- Create: `src/layouts/h5/config/rem.ts`
- Test: `src/layouts/h5/config/rem.spec.ts`

**对参考代码的第三处完善**：用 `window.innerWidth` 而非 `documentElement.clientWidth` 计算——`clientWidth` 在设置 `html.style.width = 540px` 后会返回 540（元素自身宽度），宽屏 resize 回窄屏时读到残留值导致 fontSize 错误；`innerWidth` 永远是视口宽度。

- [ ] **Step 1: 写失败测试** `src/layouts/h5/config/rem.spec.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateRem, deactivateRem, H5_REM_MAX_WIDTH } from './rem'

function mockViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
}

function firePageShow(persisted: boolean): void {
  const event = new Event('pageshow') as PageTransitionEvent
  Object.defineProperty(event, 'persisted', { value: persisted })
  window.dispatchEvent(event)
}

describe('layouts/h5/config/rem — rem 运行时激活与恢复', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    deactivateRem() // 复位模块级状态（用例间隔离）
    document.documentElement.style.cssText = ''
  })

  afterEach(() => {
    deactivateRem()
    vi.useRealTimers()
  })

  it('375 屏：fontSize = 37.5px，不限宽', () => {
    mockViewportWidth(375)
    activateRem()
    const style = document.documentElement.style
    expect(style.fontSize).toBe('37.5px')
    expect(style.width).toBe('')
    expect(style.margin).toBe('')
  })

  it('1024 屏：限 540px 居中，fontSize = 54px', () => {
    mockViewportWidth(1024)
    activateRem()
    const style = document.documentElement.style
    expect(style.fontSize).toBe('54px')
    expect(style.width).toBe('540px')
    expect(style.margin).toBe('0 auto')
  })

  it('deactivate 恢复进入前的内联样式', () => {
    document.documentElement.style.fontSize = '16px' // 模拟进入前已有值
    mockViewportWidth(375)
    activateRem()
    deactivateRem()
    expect(document.documentElement.style.fontSize).toBe('16px')
  })

  it('resize 防抖 300ms 后重算', () => {
    mockViewportWidth(375)
    activateRem()
    mockViewportWidth(414)
    window.dispatchEvent(new Event('resize'))
    expect(document.documentElement.style.fontSize).toBe('37.5px') // 防抖窗口内不变
    vi.advanceTimersByTime(300)
    expect(document.documentElement.style.fontSize).toBe('41.4px')
  })

  it('宽屏 resize 回窄屏：清理限宽内联样式', () => {
    mockViewportWidth(1024)
    activateRem()
    expect(document.documentElement.style.width).toBe('540px')
    mockViewportWidth(375)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(300)
    expect(document.documentElement.style.width).toBe('')
    expect(document.documentElement.style.fontSize).toBe('37.5px')
  })

  it('pageshow persisted=true（bfcache 恢复）重算', () => {
    mockViewportWidth(375)
    activateRem()
    mockViewportWidth(414)
    firePageShow(true)
    vi.advanceTimersByTime(300)
    expect(document.documentElement.style.fontSize).toBe('41.4px')
  })

  it('重复 activate 幂等：deactivate 后监听彻底移除', () => {
    mockViewportWidth(375)
    activateRem()
    activateRem()
    deactivateRem()
    expect(document.documentElement.style.fontSize).toBe('')
    mockViewportWidth(500)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(500)
    expect(document.documentElement.style.fontSize).toBe('') // 监听已移除，不再响应
  })

  it('H5_REM_MAX_WIDTH 常量为 540', () => {
    expect(H5_REM_MAX_WIDTH).toBe(540)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/layouts/h5/config/rem.spec.ts`
Expected: FAIL（`Cannot find module './rem'`）

- [ ] **Step 3: 实现** `src/layouts/h5/config/rem.ts`

```ts
/**
 * h5 rem 运行时适配（纯 TS，无 Vue 依赖，便于单测与 layout 自包含）。
 *
 * 激活/恢复模型：activateRem() 保存进入前 html 内联样式并接管，deactivateRem()
 * 原样写回——离开 h5 布局后对 default / portal 零残留。
 *
 * 为何用 window.innerWidth 而非 documentElement.clientWidth（参考代码的坑）：
 *   clientWidth 是 html 元素自身宽度，宽屏限宽（html.style.width = 540px）生效后
 *   读到的恒为 540 —— 从宽屏 resize 回窄屏时读到残留值，fontSize 计算错误。
 *   innerWidth 永远是视口宽度，不受 html 内联 width 影响。
 *
 * @see [`../index.vue`](../index.vue) 生命周期驱动方（onMounted/onUnmounted）
 * @see [`build/postcss.ts`](../../../../build/postcss.ts) 编译时 px→rem 换算约定
 * @group 布局：H5
 */

/** 宽屏限宽阈值（px）：视口宽超过此值时页面限宽居中 */
export const H5_REM_MAX_WIDTH = 540
/** resize / pageshow 重算防抖间隔（ms） */
export const H5_REM_RESIZE_DELAY = 300
/** rem 换算除数：1rem = 生效宽度 / 10（与 build/postcss.ts 的 rootValue = 设计稿宽/10 配套） */
const REM_DIVISOR = 10

/** 进入 h5 前的 html 内联样式快照（deactivate 时原样写回） */
interface HtmlInlineSnapshot {
  fontSize: string
  width: string
  margin: string
}

let snapshot: HtmlInlineSnapshot | null = null
let recalcTimer: ReturnType<typeof setTimeout> | undefined

/** 按当前视口宽重算并应用 html fontSize / 限宽居中 */
function applyRootMetrics(): void {
  const html = document.documentElement
  const viewportWidth = window.innerWidth
  const effectiveWidth = Math.min(viewportWidth, H5_REM_MAX_WIDTH)
  html.style.fontSize = `${effectiveWidth / REM_DIVISOR}px`

  if (viewportWidth > H5_REM_MAX_WIDTH) {
    html.style.width = `${H5_REM_MAX_WIDTH}px`
    html.style.margin = '0 auto'
  } else {
    // 宽屏 resize 回窄屏时必须清掉限宽内联，否则页面被锁在 540px
    html.style.width = ''
    html.style.margin = ''
  }
}

function scheduleRecalc(): void {
  clearTimeout(recalcTimer)
  recalcTimer = setTimeout(applyRootMetrics, H5_REM_RESIZE_DELAY)
}

/** bfcache 恢复（pageshow persisted）时视口可能已变化，需重算 */
function onPageShow(event: PageTransitionEvent): void {
  if (event.persisted) scheduleRecalc()
}

/** 激活 rem 适配：保存快照 → 立即计算 → 挂监听。重复调用幂等（先恢复旧状态再激活） */
export function activateRem(): void {
  if (snapshot !== null) deactivateRem()
  const html = document.documentElement
  snapshot = {
    fontSize: html.style.fontSize,
    width: html.style.width,
    margin: html.style.margin,
  }
  applyRootMetrics()
  window.addEventListener('resize', scheduleRecalc)
  window.addEventListener('pageshow', onPageShow)
}

/** 停用 rem 适配：写回快照、移除监听、清防抖定时器。未激活时调用为空操作 */
export function deactivateRem(): void {
  if (snapshot === null) return
  const html = document.documentElement
  html.style.fontSize = snapshot.fontSize
  html.style.width = snapshot.width
  html.style.margin = snapshot.margin
  snapshot = null
  clearTimeout(recalcTimer)
  window.removeEventListener('resize', scheduleRecalc)
  window.removeEventListener('pageshow', onPageShow)
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/layouts/h5/config/rem.spec.ts`
Expected: PASS（8 个用例）

- [ ] **汇报点**：新增 2 文件。

---

### Task 6: src/layouts/h5/index.vue —— 布局壳

**Files:**
- Create: `src/layouts/h5/index.vue`

BEM 规范逐条对照（CLAUDE.md §3）：`createNamespace` 自动注入不写 import；kebab-case `'h5-layout'`；`<style lang="scss">` 无 scoped；根选择器 `.#{$BEM_PREFIX}-h5-layout`。

- [ ] **Step 1: 创建 `src/layouts/h5/index.vue`**

```vue
<script setup lang="ts">
/**
 * H5 布局：移动端面板基座（rem 适配）。
 *
 * 消费方式（与 portal / default 同构）：路由父记录 component 直挂本布局即获得能力——
 *   { path: '/h5-demo', component: () => import('@/layouts/h5/index.vue'), children: [...] }
 *
 * 能力来源：
 *   - 编译时：本目录（src/layouts/h5/）与 src/modules/h5-*​/ 下的样式写 px，
 *     postcss-pxtorem 自动转 rem（见 build/postcss.ts）
 *   - 运行时：onMounted 激活 html fontSize 动态计算（宽屏限 540px 居中），
 *     onUnmounted 恢复进入前状态——对 default / portal 布局零残留（见 ./config/rem.ts）
 *
 * 注意：本布局不设计为被 keep-alive 缓存（项目 keep-alive 只作用于 default 内业务页）。
 *
 * @see [`./config/rem.ts`](./config/rem.ts) rem 激活/恢复
 * @group 布局
 */
import { activateRem, deactivateRem } from './config/rem'

// 运行时 BEM 命名空间：vv-h5-layout
const bem = createNamespace('h5-layout')

onMounted(activateRem)
onUnmounted(deactivateRem)
</script>

<template>
  <div :class="bem.b()">
    <RouterView />
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/layouts/h5/），直接写 828 设计稿 px 即可
.#{$BEM_PREFIX}-h5-layout {
  min-height: 100vh;
  background: #f7f8fa;
}
</style>
```

- [ ] **Step 2: 类型校验 + lint**

Run: `pnpm type-check:full` && `pnpm lint`
Expected: PASS

- [ ] **汇报点**：新增 1 文件。

---

### Task 7: src/modules/h5-demo —— 示例模块（脚手架 + 改造 + 白名单）

**Files:**
- Create（脚手架生成）: `src/modules/h5-demo/`（views/routes/store/apis/index.ts/components/.gitkeep）
- Modify（改造）: `src/modules/h5-demo/routes/index.ts`、`src/modules/h5-demo/views/Index.vue`
- Modify: `src/router/whitelist.ts`

- [ ] **Step 1: 跑脚手架**（CLAUDE.md §4 #2 强制）

Run: `pnpm new-module h5-demo`
Expected: 生成 6 个骨架文件，输出成功清单

- [ ] **Step 2: 改造 `src/modules/h5-demo/routes/index.ts`**（Write 覆写脚手架产物）

```ts
/**
 * h5-demo 模块路由（h5 布局验收模块）。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计：
 * - 父记录 component 挂 `@/layouts/h5/index.vue` → 获得 H5 面板能力（rem 适配自动激活/恢复）
 * - requiresAuth: false + 白名单（src/router/whitelist.ts）→ 免登录，方便手机扫码真机预览
 * - 本模块路径在 postcss-pxtorem 转换范围（src/modules/h5-* 前缀约定），
 *   视图样式直接写 828 设计稿 px，构建时自动转 rem
 *
 * @see [`../views/Index.vue`](../views/Index.vue) rem 适配演示页
 * @group 业务模块：H5Demo
 */

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/h5-demo',
    component: () => import('@/layouts/h5/index.vue'),
    children: [
      {
        path: '',
        name: 'H5Demo',
        component: () => import('../views/Index.vue'),
        meta: {
          title: 'H5 示例',
          requiresAuth: false,
        },
      },
    ],
  },
]

export default routes
```

- [ ] **Step 3: 改造 `src/modules/h5-demo/views/Index.vue`**（Write 覆写脚手架产物）

```vue
<script setup lang="ts">
/**
 * h5-demo 首页：rem 适配验收演示。
 *
 * 全部样式直接写 828 设计稿标注的 px（所见即所得），
 * 构建时 postcss-pxtorem 自动转 rem（见 build/postcss.ts）。
 * 顶部信息条实时显示 html fontSize 与视口宽，作为缩放生效的直接证据。
 */
const bem = createNamespace('h5-demo')

/** 实时指标：html fontSize 计算值 + 视口宽度（验收缩放的直接证据） */
const rootFontSize = ref('')
const viewportWidth = ref(0)

function refreshMetrics(): void {
  rootFontSize.value = getComputedStyle(document.documentElement).fontSize
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  refreshMetrics()
  window.addEventListener('resize', refreshMetrics)
})
onUnmounted(() => {
  window.removeEventListener('resize', refreshMetrics)
})
</script>

<template>
  <div :class="bem.b()">
    <header :class="bem.e('header')">
      <h1 :class="bem.e('title')">H5 REM 适配演示</h1>
      <p :class="bem.e('meta')">
        html fontSize: {{ rootFontSize }} · 视口宽: {{ viewportWidth }}px · 设计稿: 828px
      </p>
    </header>

    <section :class="bem.e('card')">
      <h2 :class="bem.e('card-title')">px → rem 自动转换（字号阶梯）</h2>
      <p :class="bem.e('text-lg')">28px 标题字号（设计稿标注值）</p>
      <p :class="bem.e('text-md')">24px 正文字号</p>
      <p :class="bem.e('text-sm')">20px 辅助字号</p>
    </section>

    <section :class="bem.e('card')">
      <h2 :class="bem.e('card-title')">200px 宽卡片（828 稿）</h2>
      <div :class="bem.e('box-width')">宽 200px → 375 屏渲染 ≈ 90.6px</div>
    </section>

    <section :class="bem.e('card')">
      <h2 :class="bem.e('card-title')">1px 边框对照</h2>
      <div :class="[bem.e('box-border'), bem.em('box-border', 'hairline')]">
        border: 1px（&lt; minPixelValue 2，不转换，物理 1px 细线）
      </div>
      <div :class="[bem.e('box-border'), bem.em('box-border', 'scaled')]">
        border: 2px（转 rem，随屏宽缩放）
      </div>
    </section>

    <footer :class="bem.e('footer')">
      宽屏（&gt;540px）打开时页面限宽居中；返回后台布局自动恢复。
    </footer>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-demo/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-h5-demo {
  min-height: 100vh;
  padding: 24px;

  &__header {
    padding: 32px 0 16px;
    text-align: center;
  }

  &__title {
    margin: 0 0 12px;
    font-size: 36px;
    font-weight: 600;
    color: #1a1a1a;
  }

  &__meta {
    margin: 0;
    font-size: 20px;
    color: #969799;
  }

  &__card {
    margin-bottom: 24px;
    padding: 28px;
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }

  &__card-title {
    margin: 0 0 20px;
    font-size: 26px;
    font-weight: 600;
    color: #323233;
  }

  &__text-lg {
    margin: 0 0 8px;
    font-size: 28px;
  }

  &__text-md {
    margin: 0 0 8px;
    font-size: 24px;
  }

  &__text-sm {
    margin: 0;
    font-size: 20px;
    color: #646566;
  }

  &__box-width {
    width: 200px;
    padding: 16px;
    font-size: 20px;
    color: #ffffff;
    background: var(--color-primary, #409eff);
    border-radius: 8px;
    text-align: center;
  }

  &__box-border {
    margin-bottom: 16px;
    padding: 20px;
    font-size: 20px;
    color: #646566;
    border-radius: 8px;

    &--hairline {
      border: 1px solid #ebedf0;
    }

    &--scaled {
      border: 2px solid var(--color-primary, #409eff);
    }
  }

  &__footer {
    padding: 16px 0 32px;
    font-size: 20px;
    color: #969799;
    text-align: center;
  }
}
</style>
```

- [ ] **Step 4: `src/router/whitelist.ts` 白名单字面量数组追加**

在 `'ServerError', // 500 页面` 行后追加：

```ts
  'H5Demo', // H5 示例页（h5 layout 验收；免登录方便真机扫码预览）
```

- [ ] **Step 5: 路由一致性校验**

Run: `pnpm check:routes`
Expected: PASS（H5Demo 在白名单且在实际 routes 中，满足 whitelist ⊆ routes）

- [ ] **Step 6: 类型校验 + lint + 全量单测**

Run: `pnpm type-check:full` && `pnpm lint` && `pnpm test`
Expected: 全部 PASS

- [ ] **汇报点**：脚手架生成 6 文件 + 改造 2 + 白名单 1。store/apis/index.ts 等骨架保留原样（演示标准模块结构，本示例不发请求）。

---

### Task 8: 文档同步

**Files:**
- Create: `docs/34-H5布局与rem适配.md`
- Modify: `README.md`（§Layout 速选表，394-400 行附近）
- Modify: `docs/07-路由模块设计.md`（§Layout 选择速查，289-304 行附近）
- Modify: `CLAUDE.md`（§2.1 表 #6 + 顶部版本段）
- Modify: `CHANGELOG.md`（顶部「未发布」下追加）

- [ ] **Step 1: 新建 `docs/34-H5布局与rem适配.md`**

````markdown
# H5 布局与 REM 适配使用指南

> 适用：移动端 H5 页面开发。routes 挂 h5 layout 即获得 rem 适配能力，样式直接写设计稿 px。

## 1. 快速上手

```ts
// src/modules/h5-xxx/routes/index.ts
const routes: RouteRecordRaw[] = [
  {
    path: '/h5-xxx',
    component: () => import('@/layouts/h5/index.vue'), // ← 获得 H5 面板能力
    children: [{ path: '', name: 'H5Xxx', component: () => import('../views/Index.vue') }],
  },
]
```

```scss
// h5 范围内的组件样式：直接写 828 设计稿标注的 px，构建时自动转 rem
.#{$BEM_PREFIX}-h5-xxx {
  &__card {
    width: 200px; // 编译后 2.4155rem；375 屏渲染 90.6px（200×375/828）
    font-size: 28px;
  }
}
```

**转换范围（只有这两类路径被转换）：**
- `src/layouts/h5/`（布局自身）
- `src/modules/h5-*/`（**约定：h5 业务模块以 `h5-` 前缀命名**，新增模块零配置接入）

后台（default）/ 门户（portal）/ element-plus 样式零污染。

## 2. 换算公式

| 阶段 | 规则 | 配置位置 |
|------|------|----------|
| 编译时 | `X px → X / 82.8 rem`（rootValue = 设计稿宽/10） | `build/postcss.ts` `H5_DESIGN_WIDTH = 828` |
| 运行时 | `1rem = min(视口宽, 540) / 10 px` | `src/layouts/h5/config/rem.ts` `H5_REM_MAX_WIDTH = 540` |

换 750 设计稿：只改 `build/postcss.ts` 的 `H5_DESIGN_WIDTH = 750` 一行，业务代码零改动。

## 3. 已知限制（必读）

| # | 限制 | 原因 | 应对 |
|---|------|------|------|
| 1 | 内联样式 `:style` / JS 计算的 px 不转换 | postcss 只处理样式表 | 动态尺寸在 JS 侧自行按 `设计稿px × 视口宽/828` 换算 |
| 2 | Element Plus 组件样式不缩放 | node_modules 不在转换范围 | h5 页用原生元素 + BEM（参考 h5-demo）；EP 复杂组件勿用于 h5 |
| 3 | UnoCSS 原子类（`w-4` 等）按 16px 基准生成 rem | uno 不在转换范围且 rem 基准假设 16px | **h5 模块内禁用 uno rem 原子类**，只写 BEM scss px |
| 4 | 媒体查询参数 px 不转换 | `mediaQuery: false` | h5 不需要响应式断点（rem 本身即适配） |
| 5 | keyframes 内 px 会被转换 | postcss-pxtorem walkDecls 全量 | 通常正是期望行为；需豁免的选择器加 `build/postcss.ts` 的 `selectorBlackList` |
| 6 | 1px 边框不转换 | `minPixelValue: 2` | 特性而非缺陷——保持物理 1px 细线 |

## 4. 运行时行为

| 场景 | 行为 |
|------|------|
| 进入 h5 路由 | h5 layout onMounted → 激活 fontSize 计算 + resize/pageshow 监听（防抖 300ms） |
| 离开 h5 路由 | onUnmounted → 恢复进入前 html 内联样式 + 移除监听（对后台零残留） |
| 宽屏（>540px） | 页面限 540px 居中，fontSize 按 54px 计算 |
| 宽屏拖回窄屏 | 限宽内联样式自动清理（用 window.innerWidth 计算，不受 html 限宽影响） |

## 5. 验收示例

`pnpm dev` 后访问 `/h5-demo`（免登录）：Chrome DevTools 设备模拟 iPhone SE（375px）
观察卡片/字号等比缩放；拖宽视口超过 540px 观察居中；跳回 `/workbench` 后台布局无残留。
````

- [ ] **Step 2: `README.md` §Layout 速选表追加行**（表格在 `#### Layout 速选（先决定用哪个）` 下，portal 行之后）

```markdown
| **h5**      | `@/layouts/h5/index.vue`      | 移动端 rem 适配面板（宽屏限 540px 居中） | H5 移动端页面                 |
```

- [ ] **Step 3: `docs/07-路由模块设计.md` §Layout 选择速查**

- 「本项目提供 3 套」→「本项目提供 4 套」
- portal 行后追加：

```markdown
| **h5**      | `@/layouts/h5/index.vue`      | 移动端 rem 适配面板（写 px 自动转 rem，宽屏限 540px 居中） | H5 移动端页面 | 通常 true（白名单） |
```

- 「典型搭配」列表追加：`- H5 移动端页：`/h5-demo` → `h5` + 加白名单（详见 docs/34）`

- [ ] **Step 4: `CLAUDE.md` 两处**

- §2.1 基线快照表 #6 layouts 行：`（default`/`blank`/`portal`）` → `（`default`/`blank`/`portal`/`h5`）`
- 顶部「最近更新」按既有格式追加 v2.0.0 版本段（新增 h5 layout + rem 适配 + postcss-pxtorem 编译时转换，范围 `src/layouts/h5`/`src/modules/h5-*`）

- [ ] **Step 5: `CHANGELOG.md` 顶部「## 未发布」下追加**

```markdown
### ✨ Feature | 新增 h5 layout + rem 适配（H5 移动端面板能力）

- routes 父记录挂 `@/layouts/h5/index.vue` 即获得 H5 面板能力（与 portal/default 同构）
- 编译时：`build/postcss.ts`（postcss-pxtorem）仅转换 `src/layouts/h5/` 与 `src/modules/h5-*/`（h5- 前缀约定），rootValue=82.8（828 设计稿/10），样式直接写设计稿 px
- 运行时：`src/layouts/h5/config/rem.ts` 按 `min(视口宽,540)/10` 动态计算 html fontSize，宽屏限 540px 居中；激活/恢复绑定 h5 layout 生命周期，离开对后台零残留
- 插件：`src/plugins/remAdaptation.ts` viewport meta 幂等确保（PluginsOptions.remAdaptation 可关闭）
- 示例：`src/modules/h5-demo`（`/h5-demo` 免登录白名单，含字号阶梯/200px 卡片/1px 边框对照演示）
- 文档：`docs/34-H5布局与rem适配.md`；单测：postcss/remAdaptation/rem 三个 spec 共 23 用例
```

- [ ] **Step 6: 文档硬数据校验**

Run: `pnpm check:doc-currency`
Expected: PASS（若脚本对 docs 序号或布局表有硬校验，按报错补齐）

- [ ] **汇报点**：新增 1 文档 + 修改 4 文档。

---

### Task 9: 全量验证闭环

- [ ] **Step 1: 静态检查全绿**

Run: `pnpm test` && `pnpm type-check:full` && `pnpm lint` && `pnpm check:routes`
Expected: 全部 PASS

- [ ] **Step 2: 构建产物验证转换范围**

Run: `pnpm build`，然后对 dist 产物 grep：
- h5-demo 的类（如 `vv-h5-demo`）应为 rem 值（如 `2.4155rem`）
- default/portal 的样式（如 `vv-portal-layout`）应仍为 px

Expected: h5 范围是 rem，其余保持 px（编译时隔离生效）

- [ ] **Step 3: 浏览器实测**（chrome-devtools MCP，`pnpm dev` 后台运行）

| 场景 | 操作 | 预期 |
|------|------|------|
| 移动端缩放 | 375×667 视口访问 `/h5-demo` | 信息条显示 fontSize=37.5px；200px 卡片渲染宽 ≈90.6px |
| 宽屏居中 | 1280 视口访问 `/h5-demo` | fontSize=54px；页面限 540px 居中 |
| 布局隔离 | `/h5-demo` → 登录后跳 `/workbench` | html 内联 fontSize/width/margin 已清空；后台布局无残留 |
| 后台不受影响 | `/workbench` 量侧栏宽度 | 与接入前一致（px 未被转换） |

- [ ] **Step 4: 合规简报**

输出：src/ 写操作清单（§2.5）+ BEM 核查清单（§3.4）+ 自检清单通过情况 + 手动验证步骤。询问用户是否提交（禁止擅自 git commit）。

---

## Self-Review 记录

- **Spec 覆盖**：spec §4 文件清单 11 项 ↔ Task 1-8 全覆盖；§8 测试 3 spec ↔ Task 1/3/5；§9 验收 ↔ Task 9。✓
- **类型一致性**：`activateRem`/`deactivateRem`（Task 5 定义 → Task 6 消费）、`isH5RemTarget`/`POSTCSS_PLUGINS`/`H5_REM_ROOT_VALUE`（Task 1 定义 → spec + Task 2 消费）、`ensureViewportMeta`（Task 3 定义 → Task 4 注册）、`H5_REM_MAX_WIDTH`（Task 5 导出 → spec 断言）。✓
- **API 风险**：postcss-pxtorem 无 include（源码实测）→ 用 exclude 函数；minPixelValue 语义 `pixels < 2` 不转 → spec/测试/演示页一致（1px 不转、2px 转）。✓
