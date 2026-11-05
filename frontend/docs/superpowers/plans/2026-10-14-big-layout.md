# 大屏布局（big layout + big-demo 模块）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `layouts/big` 大屏布局与 `modules/big-demo` 示例模块——routes 配置 big layout 即获得 scale 大屏面板能力，适配 1920×1080 / 2560×1440 / 4K / 9000px 拼接屏，对其它视图零影响。

**Architecture:** transform: scale 整体等比缩放（设计稿尺寸经路由 `meta.bigScreen` 声明，缺省 1920×1080）；scale 运行时只作用于 big layout 自有容器 div（不碰 html/body）；demo 模块自包含（BigChart 薄封装 ECharts，`devicePixelRatio × scale` 防模糊）；9000×1080 超宽示例页为第二套设计稿尺寸的实证。

**Tech Stack:** Vue 3.5 `<script setup>` + TS + Pinia（本功能不需要 store）+ ECharts 6 + Vitest。

**设计稿（已确认）：** `docs/superpowers/specs/2026-10-14-big-layout-design.md`

**全局纪律（最高优先级，覆盖 skill 模板默认行为）：**
- **禁止擅自 git commit**——本计划不含 commit 步骤；全部任务完成后由用户统一决定提交
- BEM 强约束：`createNamespace('kebab-case')` 由 unplugin-auto-import 自动注入（禁止 import）；`<style lang="scss">` **无 scoped**；根选择器 `.#{$BEM_PREFIX}-<kebab-case>`；模板类名只经 `bem.b()/bem.e()/bem.m()/bem.em()` 拼装
- AutoImport：`ref/computed/watch/onMounted/onUnmounted/nextTick/provide/inject/readonly/useRoute` 等全局可用，**不写 import**；`RouterView` 模板直接用
- 严禁 `any`；异常处理不静默吞
- `src/` 写操作仅限本计划列出的文件（用户已批准 big layout + big-demo + whitelist + 文档同步范围）

---

## 文件结构总览

| 文件 | 职责 | 新建/修改 |
|------|------|-----------|
| `src/layouts/big/config/scale.ts` | scale 纯计算 + meta 收窄 + InjectionKey（纯 TS 类型级依赖 vue，运行时无依赖） | 新建 |
| `src/layouts/big/config/scale.spec.ts` | 计算逻辑单测 | 新建 |
| `src/layouts/big/index.vue` | 纯壳布局：深色全屏底 + scale 容器 + RouterView + provide | 新建 |
| `src/modules/big-demo/**` | 脚手架骨架（`pnpm new-module big-demo`）后覆写 | 新建 |
| `src/modules/big-demo/routes/index.ts` | 父路由挂 big layout + 两个子路由 | 覆写 |
| `src/modules/big-demo/views/Index.vue` | 1920×1080 标准大屏 | 覆写 |
| `src/modules/big-demo/views/Wide.vue` | 9000×1080 超宽大屏（中间地图+两侧面板） | 新建 |
| `src/modules/big-demo/components/PanelBox.vue` | 四角装饰边框面板 | 新建 |
| `src/modules/big-demo/components/KpiCard.vue` | 指标卡 | 新建 |
| `src/modules/big-demo/components/RankingList.vue` | 排名列表 | 新建 |
| `src/modules/big-demo/components/BigChart.vue` | ECharts 薄封装（devicePixelRatio×scale） | 新建 |
| `src/modules/big-demo/apis/index.ts` | mock 数据契约 + 静态数据 + 抖动函数 | 覆写 |
| `src/modules/big-demo/config/china.json` | 中国 GeoJSON（DataV GeoAtlas 下载内置） | 新建 |
| `src/router/whitelist.ts` | +2 行白名单 | 修改 |
| `docs/35-大屏布局与scale适配.md` | 使用指南 | 新建 |
| `CLAUDE.md` / `CHANGELOG.md` / `README.md` | 文档同步 | 修改 |

---

## Task 1: 脚手架生成 big-demo 模块

**Files:**
- Create: `src/modules/big-demo/`（脚手架产物）

- [ ] **Step 1: 运行脚手架**

Run: `pnpm new-module big-demo`
Expected: 生成 6 件套骨架（apis/index.ts、components/.gitkeep、index.ts、routes/index.ts、store/index.ts、views/Index.vue），输出成功提示

- [ ] **Step 2: 确认骨架文件存在**

Run: `ls src/modules/big-demo`
Expected: `apis  components  index.ts  routes  store  views`

- [ ] **Step 3: 确认路由校验当前状态（baseline）**

Run: `pnpm check:routes`
Expected: 通过或仅提示 big-demo 相关缺失（骨架 routes 的 name 取决于脚手架模板，后续 Task 4 覆写后必须通过）

---

## Task 2: scale 运行时（TDD 核心）

**Files:**
- Test: `src/layouts/big/config/scale.spec.ts`
- Create: `src/layouts/big/config/scale.ts`

**设计要点（先读）：**
- `computeBigScale` 纯函数：`scale = min(vw/dw, vh/dh)`，offset 为居中留白偏移
- `resolveBigScreenSize` 类型守卫：从 `route.meta`（索引签名类型 `unknown`）安全收窄 `bigScreen: { width, height }`，非法值回退默认
- 视口为 0（隐藏 iframe / 预渲染）时回退 scale=1 不塌陷（照 h5 rem.ts 的防御先例）
- `BIG_SCALE_STATE_KEY` 是 demo 组件 inject 当前 scale 的契约；type-only import vue（运行时零依赖，单测无障碍）

- [ ] **Step 1: 写失败测试**

创建 `src/layouts/big/config/scale.spec.ts`：

```ts
/**
 * big layout scale 运行时单测。
 *
 * 覆盖：四档目标视口（1920/2560/4K/9000×1080）的 scale 与居中偏移、
 * meta 收窄守卫（缺省/非法值回退）、视口为 0 的防御。
 */
import { describe, expect, it } from 'vitest'
import {
  BIG_SCALE_RESIZE_DELAY,
  DEFAULT_BIG_SCREEN_SIZE,
  computeBigScale,
  resolveBigScreenSize,
} from './scale'

describe('computeBigScale', () => {
  const design = { width: 1920, height: 1080 }

  it('1920×1080 视口 → scale=1 无偏移', () => {
    expect(computeBigScale(design, 1920, 1080)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })

  it('2560×1440 视口 → scale=4/3 等比放大', () => {
    const { scale, offsetX, offsetY } = computeBigScale(design, 2560, 1440)
    expect(scale).toBeCloseTo(4 / 3, 5)
    expect(offsetX).toBeCloseTo(0, 5)
    expect(offsetY).toBeCloseTo(0, 5)
  })

  it('3840×2160 (4K) 视口 → scale=2', () => {
    expect(computeBigScale(design, 3840, 2160).scale).toBe(2)
  })

  it('9000×1080 拼接屏视口 → 高度瓶颈 scale=1，两侧留白居中', () => {
    const { scale, offsetX, offsetY } = computeBigScale(design, 9000, 1080)
    expect(scale).toBe(1)
    expect(offsetX).toBe((9000 - 1920) / 2)
    expect(offsetY).toBe(0)
  })

  it('超宽设计稿 9000×1080 在 9000×1080 视口 → scale=1 恰好铺满', () => {
    const wide = { width: 9000, height: 1080 }
    expect(computeBigScale(wide, 9000, 1080)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })

  it('超宽设计稿在 1920 开发机视口 → 宽度瓶颈缩小预览', () => {
    const wide = { width: 9000, height: 1080 }
    const { scale, offsetY } = computeBigScale(wide, 1920, 1080)
    expect(scale).toBeCloseTo(1920 / 9000, 5)
    // 垂直居中：剩余高度均分
    expect(offsetY).toBeCloseTo((1080 - 1080 * (1920 / 9000)) / 2, 5)
  })

  it('视口为 0（隐藏 iframe/预渲染）→ 回退 scale=1 不塌陷', () => {
    expect(computeBigScale(design, 0, 0)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    expect(computeBigScale(design, 1920, 0).scale).toBe(1)
  })

  it('设计稿尺寸非法（0/负数）→ 回退默认 1920×1080', () => {
    const m = computeBigScale({ width: 0, height: -1 }, 1920, 1080)
    expect(m).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })
})

describe('resolveBigScreenSize', () => {
  it('meta 缺省 → 默认 1920×1080', () => {
    expect(resolveBigScreenSize({})).toEqual(DEFAULT_BIG_SCREEN_SIZE)
    expect(resolveBigScreenSize(undefined)).toEqual(DEFAULT_BIG_SCREEN_SIZE)
    expect(resolveBigScreenSize(null)).toEqual(DEFAULT_BIG_SCREEN_SIZE)
  })

  it('meta.bigScreen 合法 → 收窄为声明尺寸', () => {
    expect(resolveBigScreenSize({ bigScreen: { width: 9000, height: 1080 } })).toEqual({
      width: 9000,
      height: 1080,
    })
  })

  it.each([
    ['非对象', { bigScreen: '9000x1080' }],
    ['width 非数字', { bigScreen: { width: '9000', height: 1080 } }],
    ['width 为 0', { bigScreen: { width: 0, height: 1080 } }],
    ['height 为负', { bigScreen: { width: 9000, height: -1080 } }],
    ['NaN', { bigScreen: { width: Number.NaN, height: 1080 } }],
  ])('meta.bigScreen %s → 回退默认', (_label, meta) => {
    expect(resolveBigScreenSize(meta)).toEqual(DEFAULT_BIG_SCREEN_SIZE)
  })
})

describe('常量契约', () => {
  it('默认设计稿 = 1920×1080，防抖 150ms', () => {
    expect(DEFAULT_BIG_SCREEN_SIZE).toEqual({ width: 1920, height: 1080 })
    expect(BIG_SCALE_RESIZE_DELAY).toBe(150)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/layouts/big/config/scale.spec.ts`
Expected: FAIL（`Cannot find module './scale'`）

- [ ] **Step 3: 实现 scale.ts**

创建 `src/layouts/big/config/scale.ts`：

```ts
/**
 * big layout scale 运行时（纯计算层，运行时零 Vue 依赖，便于单测与 layout 自包含）。
 *
 * 与 h5 rem 适配的本质差异：
 *   - h5：改全局 html fontSize（模块级快照/恢复保证零残留）
 *   - big：只算数不碰 DOM——结果交给 index.vue 绑定到自有容器 style，
 *     容器随 layout 销毁，天然零残留，无需快照机制
 *
 * 设计稿尺寸契约：路由 meta.bigScreen = { width, height }（缺省 1920×1080），
 * 同 layout 内跳转（1920 页 ↔ 9000 页）由 index.vue watch meta 热切换。
 *
 * @see [`../index.vue`](../index.vue) 生命周期驱动方（onMounted/onUnmounted + watch meta）
 * @group 布局：Big
 */

import type { InjectionKey, Ref } from 'vue'

/** 大屏设计稿尺寸（px） */
export interface BigScreenDesignSize {
  width: number
  height: number
}

/** 默认设计稿尺寸：1920×1080（16:9，覆盖 1920/2560/4K 三档 16:9 视口） */
export const DEFAULT_BIG_SCREEN_SIZE: BigScreenDesignSize = { width: 1920, height: 1080 }

/** resize / pageshow 重算防抖间隔（ms） */
export const BIG_SCALE_RESIZE_DELAY = 150

/** scale 计算结果（含居中留白偏移，视口坐标系 px） */
export interface BigScaleMetrics {
  scale: number
  offsetX: number
  offsetY: number
}

/** provide 给大屏页面的完整状态（metrics + 生效的设计稿尺寸） */
export interface BigScaleState extends BigScaleMetrics {
  designWidth: number
  designHeight: number
}

/**
 * demo 组件（BigChart）inject 当前 scale 的契约。
 * 默认值见 BigChart（不在 big layout 内时 scale=1 回退，组件可独立预览）。
 */
export const BIG_SCALE_STATE_KEY: InjectionKey<Readonly<Ref<BigScaleState>>> =
  Symbol('big-scale-state')

/** 尺寸是否合法（正有限数） */
function isValidSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * 计算等比缩放与居中偏移。
 *
 * 算法：scale = min(vw/dw, vh/dh)——取较小者保证完整可见，剩余空间均分居中（留白）。
 * 防御：视口为 0（隐藏 iframe / 预渲染）回退 scale=1 保持现状，等 resize/pageshow 自愈；
 *       设计稿尺寸非法回退默认 1920×1080（调用方传错不应让整屏塌陷）。
 */
export function computeBigScale(
  design: BigScreenDesignSize,
  viewportWidth: number,
  viewportHeight: number,
): BigScaleMetrics {
  const dw = isValidSize(design.width) ? design.width : DEFAULT_BIG_SCREEN_SIZE.width
  const dh = isValidSize(design.height) ? design.height : DEFAULT_BIG_SCREEN_SIZE.height
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }
  const scale = Math.min(viewportWidth / dw, viewportHeight / dh)
  return {
    scale,
    offsetX: (viewportWidth - dw * scale) / 2,
    offsetY: (viewportHeight - dh * scale) / 2,
  }
}

/**
 * 从 route.meta 收窄 bigScreen 声明（RouteMeta 索引签名类型为 unknown，必须运行时守卫）。
 * 任何非法形态（非对象/非数字/非正数/NaN）一律回退默认 1920×1080。
 */
export function resolveBigScreenSize(meta: unknown): BigScreenDesignSize {
  if (typeof meta !== 'object' || meta === null) return DEFAULT_BIG_SCREEN_SIZE
  const raw = (meta as Record<string, unknown>).bigScreen
  if (typeof raw !== 'object' || raw === null) return DEFAULT_BIG_SCREEN_SIZE
  const { width, height } = raw as Record<string, unknown>
  if (isValidSize(width) && isValidSize(height)) return { width, height }
  return DEFAULT_BIG_SCREEN_SIZE
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/layouts/big/config/scale.spec.ts`
Expected: PASS（15 个用例全绿）

---

## Task 3: big layout 纯壳（index.vue）

**Files:**
- Create: `src/layouts/big/index.vue`

**设计要点：**
- `position: fixed; inset: 0` 脱离文档流铺满视口——避免 body 滚动条干扰视口计算
- transform 列表 `translate(x, y) scale(s)`：平移在前（视口坐标系，不被缩放）、缩放在后
- `watch(() => route.meta.bigScreen)` 立即重算（不防抖）；resize/pageshow 防抖 150ms（照 rem.ts 先例）
- `provide(BIG_SCALE_STATE_KEY, readonly(state))`——demo 的 BigChart 消费
- 样式写死 px 但本目录**不在** postcss-pxtorem 范围（只有 h5 前缀在），px 原样输出

- [ ] **Step 1: 创建 index.vue**

```vue
<script setup lang="ts">
/**
 * 大屏布局：数据面板基座（scale 等比缩放适配）。
 *
 * 消费方式（与 portal / default / h5 同构）：路由父记录 component 直挂本布局即获得能力——
 *   { path: '/big-demo', component: () => import('@/layouts/big/index.vue'), children: [...] }
 *
 * 能力模型：
 *   - 子页面样式按设计稿写死 px（默认 1920×1080；超宽页 meta.bigScreen 声明 9000×1080）
 *   - 运行时容器按 min(vw/dw, vh/dh) 等比缩放并居中（比例不符的空白为深色底）
 *   - 只缩放本布局自有容器 div，不碰 html/body——对 default / portal / h5 零残留
 *
 * 已知限制：容器内避免使用 teleport 到 body 的弹层组件（ElSelect 下拉等不随缩放），
 * 交互控件用内联形态（按钮/开关/滑块）。
 *
 * 注意：本布局不设计为被 keep-alive 缓存（项目 keep-alive 只作用于 default 内业务页）。
 *
 * @see [`./config/scale.ts`](./config/scale.ts) scale 纯计算 + meta 契约
 * @group 布局
 */
import {
  BIG_SCALE_RESIZE_DELAY,
  BIG_SCALE_STATE_KEY,
  computeBigScale,
  resolveBigScreenSize,
  type BigScaleState,
} from './config/scale'

// 运行时 BEM 命名空间：vv-big-layout
const bem = createNamespace('big-layout')

// vue-router（unplugin-auto-import 注入）
const route = useRoute()

/** 当前生效的缩放状态（meta 切换 / 视口变化时整体替换） */
const state = ref<BigScaleState>({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  designWidth: 1920,
  designHeight: 1080,
})

/** 立即按当前视口 + 路由 meta 重算 */
function recalc(): void {
  const design = resolveBigScreenSize(route.meta)
  const metrics = computeBigScale(design, window.innerWidth, window.innerHeight)
  state.value = { ...metrics, designWidth: design.width, designHeight: design.height }
}

let recalcTimer: ReturnType<typeof setTimeout> | undefined

/** resize / pageshow 走防抖（拖动窗口边缘时高频触发） */
function scheduleRecalc(): void {
  clearTimeout(recalcTimer)
  recalcTimer = setTimeout(recalc, BIG_SCALE_RESIZE_DELAY)
}

/** bfcache 恢复（pageshow persisted）时视口可能已变化，需重算 */
function onPageShow(event: PageTransitionEvent): void {
  if (event.persisted) scheduleRecalc()
}

// 同 layout 内跳转（1920 页 ↔ 9000 页）meta 变化 → 立即重算（不防抖，避免两页间闪烁中间态）
watch(() => route.meta.bigScreen, recalc)

onMounted(() => {
  recalc()
  window.addEventListener('resize', scheduleRecalc)
  window.addEventListener('pageshow', onPageShow)
})
onUnmounted(() => {
  clearTimeout(recalcTimer)
  window.removeEventListener('resize', scheduleRecalc)
  window.removeEventListener('pageshow', onPageShow)
})

// demo 组件（BigChart）消费：devicePixelRatio × scale 保持图表清晰
// provide / readonly 由 unplugin-auto-import 注入
provide(BIG_SCALE_STATE_KEY, readonly(state))

/**
 * 容器内联样式：尺寸写死设计稿 px，transform 平移（视口坐标）在前、缩放在后。
 * transform-origin: top left 是算法前提（offset 即缩放后左上角的目标位置）。
 */
const stageStyle = computed(() => ({
  width: `${state.value.designWidth}px`,
  height: `${state.value.designHeight}px`,
  transform: `translate(${state.value.offsetX}px, ${state.value.offsetY}px) scale(${state.value.scale})`,
}))
</script>

<template>
  <div :class="bem.b()">
    <div :class="bem.e('stage')" :style="stageStyle">
      <RouterView />
    </div>
  </div>
</template>

<style lang="scss">
// big layout 不走 postcss-pxtorem（仅 h5 前缀目录在转换范围），px 原样输出
.#{$BEM_PREFIX}-big-layout {
  position: fixed;
  inset: 0;
  overflow: hidden;
  // 深蓝黑底：比例不符时的留白填充色，与大屏深色科技风一致
  background: #02040a;

  &__stage {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
  }
}
</style>
```

- [ ] **Step 2: 类型校验**

Run: `pnpm type-check`
Expected: 无新增错误（增量校验）

---

## Task 4: big-demo 路由 + 白名单 + 占位视图

**Files:**
- Modify: `src/modules/big-demo/routes/index.ts`（覆写脚手架骨架）
- Modify: `src/modules/big-demo/views/Index.vue`（先占位，Task 9 填充）
- Create: `src/modules/big-demo/views/Wide.vue`（先占位，Task 10 填充）
- Modify: `src/router/whitelist.ts:33-41`（+2 行）

- [ ] **Step 1: 覆写 routes/index.ts**

```ts
/**
 * big-demo 模块路由（big layout 验收模块）。
 *
 * 自动注册：被 `src/router/auto-register.ts` 扫描到，无需手动 import。
 *
 * 设计：
 * - 父记录 component 挂 `@/layouts/big/index.vue` → 获得大屏面板能力（scale 适配自动激活）
 * - requiresAuth: false + 白名单（src/router/whitelist.ts）→ 免登录，演示厅直接打开
 * - 超宽页通过 meta.bigScreen 声明 9000×1080 设计稿尺寸（缺省 1920×1080）
 *
 * @see [`../views/Index.vue`](../views/Index.vue) 1920 标准大屏
 * @see [`../views/Wide.vue`](../views/Wide.vue) 9000×1080 超宽拼接屏示例
 * @group 业务模块：BigDemo
 */

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/big-demo',
    component: () => import('@/layouts/big/index.vue'),
    children: [
      {
        path: '',
        name: 'BigDemo',
        component: () => import('../views/Index.vue'),
        meta: {
          title: '数据大屏',
          requiresAuth: false,
        },
      },
      {
        path: 'wide',
        name: 'BigDemoWide',
        component: () => import('../views/Wide.vue'),
        meta: {
          title: '超宽拼接大屏',
          requiresAuth: false,
          bigScreen: { width: 9000, height: 1080 },
        },
      },
    ],
  },
]

export default routes
```

- [ ] **Step 2: 占位视图（Task 9/10 填充，先保证路由可用）**

覆写 `src/modules/big-demo/views/Index.vue`：

```vue
<script setup lang="ts">
// 占位（Task 9 填充为 1920 标准大屏）
const bem = createNamespace('big-demo')
</script>

<template>
  <div :class="bem.b()">big-demo 1920 占位</div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-big-demo {
  color: #fff;
}
</style>
```

创建 `src/modules/big-demo/views/Wide.vue`：

```vue
<script setup lang="ts">
// 占位（Task 10 填充为 9000×1080 超宽大屏）
const bem = createNamespace('big-demo-wide')
</script>

<template>
  <div :class="bem.b()">big-demo 9000×1080 占位</div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-big-demo-wide {
  color: #fff;
}
</style>
```

- [ ] **Step 3: 白名单 +2 行**

修改 `src/router/whitelist.ts` 字面量数组（在 `'H5Demo'` 行后追加）：

```ts
  'H5Demo', // H5 示例页（h5 layout 验收；免登录方便真机扫码预览）
  'BigDemo', // 数据大屏（big layout 验收；免登录方便演示厅直接打开）
  'BigDemoWide', // 超宽拼接大屏示例（9000×1080 设计稿）
```

- [ ] **Step 4: 路由一致性校验**

Run: `pnpm check:routes`
Expected: `✓ 所有路由检查通过`（BigDemo/BigDemoWide 在 whitelist 与 routes 双向一致）

- [ ] **Step 5: dev 冒烟（手动/浏览器任选）**

Run: `pnpm dev` 后访问 `/big-demo` 与 `/big-demo/wide`
Expected: 两页均免登录打开，占位文字可见，页面深色底

---

## Task 5: PanelBox 组件（四角装饰面板）

**Files:**
- Create: `src/modules/big-demo/components/PanelBox.vue`

**设计要点：** 大屏标志性「四角 L 形高光」用 4 个 `<i>` 角元素实现（比 8 重 background-gradient 写法可读性好）；内容走默认插槽。

- [ ] **Step 1: 创建组件**

```vue
<script setup lang="ts">
/**
 * 大屏装饰面板：四角 L 形高光 + 半透明深蓝底 + 标题栏。
 *
 * 四角用 4 个独立 <i> 元素（每角一个），比多重 background-gradient 写法可读性好；
 * 样式全部写死设计稿 px（big layout 的 scale 容器统一缩放，无需响应式）。
 */
interface Props {
  /** 面板标题（左上角） */
  title?: string
}
defineProps<Props>()

const bem = createNamespace('panel-box')
</script>

<template>
  <section :class="bem.b()">
    <i :class="[bem.e('corner'), bem.em('corner', 'lt')]" />
    <i :class="[bem.e('corner'), bem.em('corner', 'rt')]" />
    <i :class="[bem.e('corner'), bem.em('corner', 'lb')]" />
    <i :class="[bem.e('corner'), bem.em('corner', 'rb')]" />
    <header v-if="title" :class="bem.e('header')">{{ title }}</header>
    <div :class="bem.e('body')">
      <slot />
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-panel-box {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  padding: 16px 20px;
  background: rgba(13, 38, 76, 0.35);
  border: 1px solid rgba(62, 140, 255, 0.25);

  &__corner {
    position: absolute;
    width: 18px;
    height: 18px;
    // 角高光色：比边框亮一档，形成视觉焦点
    border-color: #4da3ff;
    border-style: solid;
    border-width: 0;
    pointer-events: none;

    &--lt {
      top: -1px;
      left: -1px;
      border-top-width: 2px;
      border-left-width: 2px;
    }

    &--rt {
      top: -1px;
      right: -1px;
      border-top-width: 2px;
      border-right-width: 2px;
    }

    &--lb {
      bottom: -1px;
      left: -1px;
      border-bottom-width: 2px;
      border-left-width: 2px;
    }

    &--rb {
      right: -1px;
      bottom: -1px;
      border-right-width: 2px;
      border-bottom-width: 2px;
    }
  }

  &__header {
    flex: none;
    padding-bottom: 12px;
    font-size: 18px;
    font-weight: 600;
    color: #d6e4ff;
    letter-spacing: 1px;
  }

  &__body {
    flex: 1;
    min-height: 0;
  }
}
</style>
```

- [ ] **Step 2: 类型校验**

Run: `pnpm type-check`
Expected: 无新增错误

---

## Task 6: KpiCard 组件

**Files:**
- Create: `src/modules/big-demo/components/KpiCard.vue`

```vue
<script setup lang="ts">
/**
 * 大屏指标卡：标签 + 数值 + 单位 + 同比趋势（红涨绿跌，A 股惯例）。
 */
interface Props {
  /** 指标名（如「今日交易额」） */
  label: string
  /** 指标值（已格式化字符串或数字） */
  value: string | number
  /** 单位（如「万元」「单」） */
  unit?: string
  /** 同比变化百分比（正=涨红，负=跌绿；不传则不显示趋势行） */
  trend?: number
}
const props = defineProps<Props>()

const bem = createNamespace('kpi-card')

const trendText = computed(() => {
  if (props.trend === undefined) return ''
  const sign = props.trend > 0 ? '+' : ''
  return `${sign}${props.trend}%`
})
const trendClass = computed(() => {
  if (props.trend === undefined) return ''
  return props.trend >= 0 ? bem.em('trend', 'up') : bem.em('trend', 'down')
})
</script>

<template>
  <div :class="bem.b()">
    <div :class="bem.e('label')">{{ label }}</div>
    <div :class="bem.e('value-row')">
      <span :class="bem.e('value')">{{ value }}</span>
      <span v-if="unit" :class="bem.e('unit')">{{ unit }}</span>
    </div>
    <div v-if="trend !== undefined" :class="trendClass">
      {{ trend >= 0 ? '▲' : '▼' }} {{ trendText }} 同比
    </div>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-kpi-card {
  box-sizing: border-box;
  padding: 16px 20px;
  background: rgba(13, 38, 76, 0.35);
  border: 1px solid rgba(62, 140, 255, 0.2);

  &__label {
    font-size: 16px;
    color: #8fa8d8;
  }

  &__value-row {
    display: flex;
    align-items: baseline;
    margin-top: 8px;
  }

  &__value {
    font-size: 36px;
    font-weight: 700;
    color: #4da3ff;
    font-variant-numeric: tabular-nums;
  }

  &__unit {
    margin-left: 6px;
    font-size: 14px;
    color: #8fa8d8;
  }

  &__trend {
    &--up {
      margin-top: 6px;
      font-size: 14px;
      color: #f56c6c;
    }

    &--down {
      margin-top: 6px;
      font-size: 14px;
      color: #2fd39a;
    }
  }
}
</style>
```

- [ ] **Step: 类型校验** — Run: `pnpm type-check`，Expected: 无新增错误

---

## Task 7: RankingList 组件

**Files:**
- Create: `src/modules/big-demo/components/RankingList.vue`

```vue
<script setup lang="ts">
/**
 * 大屏排名列表：序号（前三奖牌色）+ 名称 + 占比条形 + 数值。
 * 占比按列表内最大值归一化，纯展示无交互。
 */
export interface RankingItem {
  name: string
  value: number
}

interface Props {
  items: RankingItem[]
}
const props = defineProps<Props>()

const bem = createNamespace('ranking-list')

/** 归一化基数：列表最大值（全 0 / 空列表时回退 1 防除零） */
const maxValue = computed(() => Math.max(1, ...props.items.map((item) => item.value)))

function barWidth(value: number): string {
  return `${Math.round((value / maxValue.value) * 100)}%`
}

/** 前三名奖牌色（金/银/铜），其余统一深蓝 */
const MEDAL_COLORS = ['#f7c948', '#c0c8d8', '#d98e4a'] as const
function medalColor(index: number): string {
  return MEDAL_COLORS[index] ?? '#3a5a8c'
}
</script>

<template>
  <ol :class="bem.b()">
    <li v-for="(item, index) in items" :key="item.name" :class="bem.e('item')">
      <span :class="bem.e('rank')" :style="{ background: medalColor(index) }">{{ index + 1 }}</span>
      <span :class="bem.e('name')">{{ item.name }}</span>
      <span :class="bem.e('bar-track')">
        <span :class="bem.e('bar')" :style="{ width: barWidth(item.value) }" />
      </span>
      <span :class="bem.e('value')">{{ item.value.toLocaleString() }}</span>
    </li>
  </ol>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-ranking-list {
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: 16px;
  }

  &__rank {
    flex: none;
    width: 24px;
    height: 24px;
    font-size: 14px;
    line-height: 24px;
    text-align: center;
    color: #0a1830;
    border-radius: 4px;
  }

  &__name {
    flex: none;
    width: 96px;
    overflow: hidden;
    color: #d6e4ff;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__bar-track {
    flex: 1;
    height: 8px;
    overflow: hidden;
    background: rgba(62, 140, 255, 0.12);
    border-radius: 4px;
  }

  &__bar {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #2b6de0, #4da3ff);
    border-radius: 4px;
    transition: width 0.4s ease;
  }

  &__value {
    flex: none;
    width: 80px;
    text-align: right;
    color: #8fa8d8;
    font-variant-numeric: tabular-nums;
  }
}
</style>
```

- [ ] **Step: 类型校验** — Run: `pnpm type-check`，Expected: 无新增错误

---

## Task 8: BigChart 组件（ECharts 薄封装）

**Files:**
- Create: `src/modules/big-demo/components/BigChart.vue`

**核心机制（先读）：** scale 是 transform，不改变容器 CSS 尺寸（offsetWidth 恒为设计稿值）——所以**无需 resize 监听**；唯一模糊源是 canvas 位图放大 → init 时 `devicePixelRatio = window.devicePixelRatio × scale`；scale 变化时 dispose + 重建（devicePixelRatio 只能 init 指定）。

```vue
<script setup lang="ts">
/**
 * 大屏 ECharts 薄封装：防模糊 + 随 option 更新。
 *
 * 为什么不用公共 BaseChart：大屏 scale 场景需要 devicePixelRatio × scale 的初始化策略，
 * 属 big-demo 模块自治关注点，不动公共组件（§1.2 模块边界）。
 *
 * 机制说明：
 * - transform: scale 不改变容器 CSS 尺寸（offsetWidth 恒为设计稿值），无需 resize 监听
 * - canvas 位图会被视觉放大 scale 倍 → init 时 devicePixelRatio 乘 scale 补偿
 * - devicePixelRatio 只能 init 时指定 → scale 变化时 dispose + 重建（防抖与 layout 一致 150ms）
 */
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { BIG_SCALE_STATE_KEY, type BigScaleState } from '@/layouts/big/config/scale'

interface Props {
  /** 完整 ECharts option（深 watch 更新，notMerge 模式全量替换） */
  option: EChartsOption
}
const props = defineProps<Props>()

const bem = createNamespace('big-chart')

const containerRef = ref<HTMLElement>()
let chart: echarts.ECharts | undefined

/** 不在 big layout 内时的回退（scale=1，组件可独立预览/单测） */
const FALLBACK_STATE: Readonly<Ref<BigScaleState>> = readonly(
  ref({ scale: 1, offsetX: 0, offsetY: 0, designWidth: 1920, designHeight: 1080 })
)
const scaleState = inject(BIG_SCALE_STATE_KEY, FALLBACK_STATE)

/** 销毁并重建（scale 变化时调用，保证 devicePixelRatio 与当前缩放匹配） */
function renderChart(): void {
  if (!containerRef.value) return
  chart?.dispose()
  chart = echarts.init(containerRef.value, undefined, {
    devicePixelRatio: window.devicePixelRatio * scaleState.value.scale,
  })
  chart.setOption(props.option)
}

let rebuildTimer: ReturnType<typeof setTimeout> | undefined
function scheduleRebuild(): void {
  clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(renderChart, 150)
}

onMounted(renderChart)

// option 数据更新：不重建设例，notMerge 全量替换（demo 数据小，无增量合并必要）
watch(
  () => props.option,
  (next) => chart?.setOption(next, true),
  { deep: true }
)

// scale 变化（视口变化触发）：devicePixelRatio 只能 init 指定，必须重建
watch(() => scaleState.value.scale, scheduleRebuild)

onUnmounted(() => {
  clearTimeout(rebuildTimer)
  chart?.dispose()
  chart = undefined
})
</script>

<template>
  <div ref="containerRef" :class="bem.b()" />
</template>

<style lang="scss">
.#{$BEM_PREFIX}-big-chart {
  width: 100%;
  height: 100%;
}
</style>
```

- [ ] **Step: 类型校验** — Run: `pnpm type-check`，Expected: 无新增错误

---

## Task 9: mock 数据 + 1920 标准大屏（Index.vue）

**Files:**
- Modify: `src/modules/big-demo/apis/index.ts`（覆写脚手架骨架）
- Modify: `src/modules/big-demo/views/Index.vue`（覆写占位）

- [ ] **Step 1: 覆写 apis/index.ts（数据契约 + 静态 mock + 抖动函数）**

```ts
/**
 * big-demo 数据层：静态 mock（演示厅无外网，不依赖后端）。
 *
 * 实时感通过视图层 setInterval 调 jitterValue 周期性抖动数值模拟。
 */

/** KPI 指标项（KpiCard 的 props 形态） */
export interface BigKpi {
  label: string
  value: number
  unit?: string
  /** 同比百分比（正涨负跌） */
  trend?: number
}

/** 排名列表项 */
export interface BigRankItem {
  name: string
  value: number
}

/** 主趋势图（柱状 + 折线双轴共用月份轴） */
export interface BigTrend {
  months: string[]
  /** 交易额（柱，万元） */
  volume: number[]
  /** 增长率（线，%） */
  growth: number[]
}

/** 业务占比饼图项 */
export interface BigShareItem {
  name: string
  value: number
}

/** 实时滚动条目 */
export interface BigLiveItem {
  time: string
  text: string
}

export const OVERVIEW_KPIS: BigKpi[] = [
  { label: '今日交易额', value: 12860, unit: '万元', trend: 12.6 },
  { label: '今日订单量', value: 8942, unit: '单', trend: 8.3 },
  { label: '活跃用户', value: 56210, unit: '人', trend: -2.1 },
  { label: '转化率', value: 32, unit: '%', trend: 1.8 },
]

export const SIDE_KPIS: BigKpi[] = [
  { label: '在途工单', value: 326, unit: '件', trend: -5.2 },
  { label: '客诉率', value: 3, unit: '%', trend: -0.6 },
]

export const MAIN_TREND: BigTrend = {
  months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  volume: [820, 932, 901, 934, 1290, 1330, 1320, 1450, 1500, 1230, 1420, 1610],
  growth: [2.1, 13.7, -3.3, 3.7, 38.1, 3.1, -0.8, 9.8, 3.4, -18.0, 15.4, 13.4],
}

export const SHARE_DATA: BigShareItem[] = [
  { name: '线上商城', value: 42 },
  { name: '门店零售', value: 28 },
  { name: '渠道分销', value: 18 },
  { name: '大客户', value: 12 },
]

export const REGION_RANK: BigRankItem[] = [
  { name: '华东区', value: 4860 },
  { name: '华南区', value: 3920 },
  { name: '华北区', value: 3410 },
  { name: '西南区', value: 2380 },
  { name: '华中区', value: 1960 },
  { name: '东北区', value: 1120 },
]

export const LIVE_FEED: BigLiveItem[] = [
  { time: '10:24:16', text: '华东区新增大额订单 ¥128,000' },
  { time: '10:23:58', text: '华南区客诉工单已闭环' },
  { time: '10:22:41', text: '华北区库存周转率提升至 4.2' },
  { time: '10:21:09', text: '西南区新签渠道分销商 2 家' },
  { time: '10:19:33', text: '线上商城促销活动 UV 峰值 8.2w' },
]

/** 数值抖动：±5% 内随机波动（模拟实时数据跳动），返回四舍五入整数 */
export function jitterValue(base: number): number {
  return Math.round(base * (1 + (Math.random() - 0.5) * 0.1))
}
```

- [ ] **Step 2: 覆写 views/Index.vue（1920×1080 完整大屏）**

```vue
<script setup lang="ts">
/**
 * big-demo 首页：1920×1080 标准数据大屏。
 *
 * 布局（设计稿坐标系，样式写死 px 由 big layout scale 统一缩放）：
 *   标题栏 80px + 内容区 1000px（左栏 460 / 中央 940 / 右栏 460，间距 30，页边距 30）
 *
 * 实时感：setInterval 每 3s 抖动 KPI 数值（onUnmounted 清理）。
 * 顶部信息条显示当前 scale/视口，作为适配生效的直接证据（照 h5-demo 先例）。
 */
import type { EChartsOption } from 'echarts'
import { BIG_SCALE_STATE_KEY } from '@/layouts/big/config/scale'
import {
  LIVE_FEED,
  MAIN_TREND,
  OVERVIEW_KPIS,
  REGION_RANK,
  SHARE_DATA,
  SIDE_KPIS,
  jitterValue,
} from '../apis'
import type { RankingItem } from '../components/RankingList.vue'

const bem = createNamespace('big-demo')

/** 当前 scale（big layout provide；独立预览时回退 1）——顶部信息条展示用 */
const scaleState = inject(BIG_SCALE_STATE_KEY)

// ─── KPI 实时抖动 ──────────────────────────────────────────
const kpis = ref(OVERVIEW_KPIS.map((k) => ({ ...k })))
let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  ticker = setInterval(() => {
    kpis.value = kpis.value.map((k) => ({ ...k, value: jitterValue(k.value) }))
  }, 3000)
})
onUnmounted(() => clearInterval(ticker))

// ─── 时钟 ────────────────────────────────────────────────
const clock = ref('')
let clockTimer: ReturnType<typeof setInterval> | undefined
function refreshClock(): void {
  clock.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
}
onMounted(() => {
  refreshClock()
  clockTimer = setInterval(refreshClock, 1000)
})
onUnmounted(() => clearInterval(clockTimer))

// ─── 图表 option（静态配置 + mock 数据）────────────────────
const axisStyle = {
  axisLine: { lineStyle: { color: 'rgba(143, 168, 216, 0.4)' } },
  axisLabel: { color: '#8fa8d8', fontSize: 14 },
  splitLine: { lineStyle: { color: 'rgba(143, 168, 216, 0.12)' } },
} as const

const mainTrendOption: EChartsOption = {
  backgroundColor: 'transparent',
  grid: { left: 60, right: 60, top: 50, bottom: 40 },
  legend: { data: ['交易额', '增长率'], textStyle: { color: '#8fa8d8', fontSize: 14 }, top: 8 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: MAIN_TREND.months, ...axisStyle },
  yAxis: [
    { type: 'value', name: '万元', nameTextStyle: { color: '#8fa8d8' }, ...axisStyle },
    {
      type: 'value',
      name: '%',
      nameTextStyle: { color: '#8fa8d8' },
      ...axisStyle,
      splitLine: { show: false },
    },
  ],
  series: [
    {
      name: '交易额',
      type: 'bar',
      data: MAIN_TREND.volume,
      barWidth: 18,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: '#4da3ff' }, { offset: 1, color: '#1d4f9c' },
        ] },
      },
    },
    {
      name: '增长率',
      type: 'line',
      yAxisIndex: 1,
      data: MAIN_TREND.growth,
      smooth: true,
      symbolSize: 8,
      lineStyle: { width: 3, color: '#f7c948' },
      itemStyle: { color: '#f7c948' },
    },
  ],
}

const shareOption: EChartsOption = {
  backgroundColor: 'transparent',
  tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
  legend: {
    bottom: 0,
    textStyle: { color: '#8fa8d8', fontSize: 14 },
    itemWidth: 14,
    itemHeight: 14,
  },
  series: [
    {
      type: 'pie',
      radius: ['42%', '66%'],
      center: ['50%', '44%'],
      data: SHARE_DATA,
      label: { color: '#d6e4ff', fontSize: 14, formatter: '{b}\n{c}%' },
      itemStyle: {
        borderColor: '#06122b',
        borderWidth: 2,
      },
      color: ['#4da3ff', '#2fd39a', '#f7c948', '#b478ff'],
    },
  ],
}

const trendOption: EChartsOption = {
  backgroundColor: 'transparent',
  grid: { left: 60, right: 30, top: 30, bottom: 40 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: MAIN_TREND.months, ...axisStyle },
  yAxis: { type: 'value', ...axisStyle },
  series: [
    {
      type: 'line',
      data: MAIN_TREND.volume.map((v) => Math.round(v * 0.7)),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 3, color: '#2fd39a' },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: 'rgba(47, 211, 154, 0.35)' },
          { offset: 1, color: 'rgba(47, 211, 154, 0)' },
        ] },
      },
    },
  ],
}

const regionItems: RankingItem[] = REGION_RANK.map((r) => ({ ...r }))
</script>

<template>
  <div :class="bem.b()">
    <header :class="bem.e('header')">
      <h1 :class="bem.e('title')">集团经营数据大屏</h1>
      <p :class="bem.e('meta')">
        {{ clock }} · 视口 {{ viewportLabel }} · scale ×{{ scaleLabel }}
      </p>
    </header>

    <main :class="bem.e('main')">
      <!-- 左栏 -->
      <aside :class="[bem.e('col'), bem.em('col', 'left')]">
        <KpiCard
          v-for="kpi in SIDE_KPIS"
          :key="kpi.label"
          :label="kpi.label"
          :value="kpi.value"
          :unit="kpi.unit"
          :trend="kpi.trend"
        />
        <PanelBox title="业务占比" :class="bem.e('panel-grow')">
          <BigChart :option="shareOption" />
        </PanelBox>
      </aside>

      <!-- 中央区 -->
      <section :class="bem.e('center')">
        <div :class="bem.e('kpi-band')">
          <KpiCard
            v-for="kpi in kpis"
            :key="kpi.label"
            :label="kpi.label"
            :value="kpi.value.toLocaleString()"
            :unit="kpi.unit"
            :trend="kpi.trend"
          />
        </div>
        <PanelBox title="月度经营趋势" :class="bem.e('panel-main')">
          <BigChart :option="mainTrendOption" />
        </PanelBox>
        <PanelBox title="实时动态" :class="bem.e('panel-feed')">
          <ul :class="bem.e('feed')">
            <li v-for="item in LIVE_FEED" :key="item.time">
              <span :class="bem.e('feed-time')">{{ item.time }}</span>{{ item.text }}
            </li>
          </ul>
        </PanelBox>
      </section>

      <!-- 右栏 -->
      <aside :class="[bem.e('col'), bem.em('col', 'right')]">
        <PanelBox title="交易额走势" :class="bem.e('panel-trend')">
          <BigChart :option="trendOption" />
        </PanelBox>
        <PanelBox title="区域销售排行" :class="bem.e('panel-grow')">
          <RankingList :items="regionItems" />
        </PanelBox>
      </aside>
    </main>
  </div>
</template>

<script lang="ts">
// dayjs 为项目工具库（@/utils/dayjs 统一入口，见 utils/dayjs.ts）
import { dayjs } from '@/utils/dayjs'

export default {}
</script>

<style lang="scss">
.#{$BEM_PREFIX}-big-demo {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 1920px;
  height: 1080px;
  padding: 0 30px 30px;
  color: #d6e4ff;
  background:
    radial-gradient(ellipse 1200px 500px at 50% -10%, rgba(43, 109, 224, 0.25), transparent),
    #06122b;

  &__header {
    flex: none;
    height: 80px;
    padding-top: 14px;
    text-align: center;
  }

  &__title {
    margin: 0;
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 6px;
    background: linear-gradient(180deg, #ffffff, #7db4ff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &__meta {
    margin: 4px 0 0;
    font-size: 14px;
    color: #5f7bab;
  }

  &__main {
    display: flex;
    flex: 1;
    gap: 30px;
    min-height: 0;
  }

  &__col {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 460px;

    &--left,
    &--right {
      flex: none;
    }
  }

  &__center {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  &__kpi-band {
    display: grid;
    flex: none;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  &__panel-grow {
    flex: 1;
    min-height: 0;
  }

  &__panel-main {
    flex: 1.6;
    min-height: 0;
  }

  &__panel-feed {
    flex: 1;
    min-height: 0;
  }

  &__panel-trend {
    flex: none;
    height: 40%;
  }

  &__feed {
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
    font-size: 15px;
    color: #8fa8d8;

    li {
      padding: 6px 0;
      border-bottom: 1px dashed rgba(143, 168, 216, 0.15);
    }
  }

  &__feed-time {
    margin-right: 12px;
    color: #4da3ff;
    font-variant-numeric: tabular-nums;
  }
}
</style>
```

注意：上面的 `viewportLabel` / `scaleLabel` 需在 `<script setup>` 补充两个 computed（计划完整性，实施时直接包含）：

```ts
const viewportLabel = ref('')
function refreshViewport(): void {
  viewportLabel.value = `${window.innerWidth}×${window.innerHeight}`
}
onMounted(refreshViewport)
window_add: // 不需要——用 scaleState 变化驱动
const scaleLabel = computed(() => (scaleState?.value.scale ?? 1).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''))
```

实施修正（替代上面片段，直接采用此版本）：在 `<script setup>` 顶部 inject 后写：

```ts
const viewportLabel = ref('')
onMounted(() => {
  refreshViewport()
  window.addEventListener('resize', refreshViewport)
})
onUnmounted(() => window.removeEventListener('resize', refreshViewport))
function refreshViewport(): void {
  viewportLabel.value = `${window.innerWidth}×${window.innerHeight}`
}
/** scale 显示：保留 3 位小数的紧凑形态 */
const scaleLabel = computed(() => {
  const s = scaleState?.value.scale ?? 1
  return String(Math.round(s * 1000) / 1000)
})
```

> **双 `<script>` 说明**：`<script setup>` 之外再写一个普通 `<script>` 仅为 import dayjs（AutoImport 未覆盖第三方库）——也可以直接在 `<script setup>` 顶部 `import { dayjs } from '@/utils/dayjs'`（正确且更简单）。**实施时用后者**：删掉独立 `<script>` 块，在 `<script setup>` 顶部加 `import { dayjs } from '@/utils/dayjs'`。

- [ ] **Step 3: 检查 utils/dayjs 导出形态**

Run: `cat src/utils/dayjs.ts`（或 Grep `export`）
Expected: 确认导出的是 `dayjs` 命名导出还是 default——按实际形态 import（若为 default 则 `import dayjs from '@/utils/dayjs'`）

- [ ] **Step 4: 类型校验 + 单测**

Run: `pnpm type-check && pnpm test`
Expected: 无新增错误；全量单测绿

---

## Task 10: china.json + 9000 超宽大屏（Wide.vue）

**Files:**
- Create: `src/modules/big-demo/config/china.json`
- Modify: `src/modules/big-demo/views/Wide.vue`（覆写占位）

- [ ] **Step 1: 下载中国 GeoJSON（DataV GeoAtlas，一次性开发期操作，产物入仓库）**

Run: `mkdir -p src/modules/big-demo/config && curl -sL "https://geo.datav.aliyun.com/areas_v3/bound/100000.json" -o src/modules/big-demo/config/china.json`
Expected: 文件下载成功（全国轮廓含省界数据视源而定，100KB~1MB 均可接受）

验证 JSON 合法性：`node -e "const j=require('./src/modules/big-demo/config/china.json');console.log(j.type, j.features.length)"`
Expected: `FeatureCollection` + features 数量 > 0

若 `resolveJsonModule` 未开启导致 `import chinaJson from '../config/china.json'` 类型报错：检查 `tsconfig.app.json` 的 `compilerOptions.resolveJsonModule`（vite 模板默认开启）；若确未开启，改为运行时 fetch 不在本计划范围——停下来向用户申请修改 tsconfig.app.json（属工程配置变更）。

- [ ] **Step 2: 覆写 views/Wide.vue（9000×1080 超宽大屏）**

```vue
<script setup lang="ts">
/**
 * big-demo 超宽示例：9000×1080 拼接屏（中间地图 + 两侧操作面板）。
 *
 * 布局：标题栏 100px + 内容区（左面板 1800 / 地图 5000 / 右面板 1800，间距 100，页边距 100）
 * 本页经路由 meta.bigScreen = { width: 9000, height: 1080 } 声明设计稿尺寸，
 * big layout 据此缩放；普通 1920 显示器打开时整体缩小预览（scale≈0.21），开发无需真拼接屏。
 *
 * 地图：echarts geo + registerMap('big-china', 内置 GeoJSON)——演示厅无外网，GeoJSON 随包分发。
 */
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { dayjs } from '@/utils/dayjs'
import chinaGeoJson from '../config/china.json'
import { REGION_RANK } from '../apis'

const bem = createNamespace('big-demo-wide')

// GeoJSON 结构与 echarts 内部类型存在声明差异，收窄到 registerMap 入参类型（运行时为标准 GeoJSON）
echarts.registerMap('big-china', chinaGeoJson as unknown as Parameters<typeof echarts.registerMap>[1])

// ─── 时钟 ────────────────────────────────────────────────
const clock = ref('')
let clockTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  const refresh = (): void => {
    clock.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
  }
  refresh()
  clockTimer = setInterval(refresh, 1000)
})
onUnmounted(() => clearInterval(clockTimer))

// ─── 地图数据：大区中心城市涟漪点 + 飞线 ────────────────────
interface CityPoint {
  name: string
  value: [number, number, number] // [经度, 纬度, 指标值]
}
const CITY_POINTS: CityPoint[] = [
  { name: '上海', value: [121.47, 31.23, 4860] },
  { name: '深圳', value: [114.06, 22.55, 3920] },
  { name: '北京', value: [116.4, 39.9, 3410] },
  { name: '成都', value: [104.07, 30.57, 2380] },
  { name: '武汉', value: [114.3, 30.59, 1960] },
  { name: '沈阳', value: [123.43, 41.8, 1120] },
]
const FLIGHT_LINES = CITY_POINTS.slice(1).map((c) => ({
  coords: [CITY_POINTS[0].value.slice(0, 2), c.value.slice(0, 2)] as [number[], number[]],
}))

const mapOption: EChartsOption = {
  backgroundColor: 'transparent',
  geo: {
    map: 'big-china',
    roam: false,
    zoom: 1.05,
    label: { show: false },
    itemStyle: {
      areaColor: 'rgba(21, 56, 116, 0.55)',
      borderColor: '#3e8cff',
      borderWidth: 2,
      shadowColor: 'rgba(43, 109, 224, 0.6)',
      shadowBlur: 30,
    },
    emphasis: {
      label: { show: true, color: '#ffffff', fontSize: 28 },
      itemStyle: { areaColor: 'rgba(43, 109, 224, 0.8)' },
    },
  },
  series: [
    {
      name: '飞线',
      type: 'lines',
      coordinateSystem: 'geo',
      polyline: false,
      effect: { show: true, period: 5, trailLength: 0.4, symbol: 'arrow', symbolSize: 16, color: '#f7c948' },
      lineStyle: { color: '#4da3ff', width: 3, opacity: 0.5, curveness: 0.3 },
      data: FLIGHT_LINES,
    },
    {
      name: '区域中心',
      type: 'effectScatter',
      coordinateSystem: 'geo',
      rippleEffect: { brushType: 'stroke', scale: 6 },
      symbolSize: (val: unknown) => {
        const v = Array.isArray(val) ? Number(val[2]) : 0
        return Math.max(18, v / 150)
      },
      label: {
        show: true,
        position: 'right',
        formatter: '{b}',
        color: '#d6e4ff',
        fontSize: 30,
      },
      itemStyle: { color: '#4da3ff', shadowBlur: 20, shadowColor: '#4da3ff' },
      data: CITY_POINTS,
    },
  ],
}

// ─── 两侧操作面板（内联控件：不使用 teleport 弹层组件）────────
const ALARMS = [
  { level: '高', text: '华东区仓储周转低于阈值', time: '10:24' },
  { level: '中', text: '华南区客诉率环比上升 0.4%', time: '10:12' },
  { level: '中', text: '东北区物流时效超时 6 单', time: '09:58' },
  { level: '低', text: '西南区渠道库存预警', time: '09:31' },
] as const

const METRIC_GROUPS = [
  { label: '实时交易额', value: '¥ 12,860 万' },
  { label: '实时订单', value: '8,942 单' },
  { label: '在线终端', value: '3,412 台' },
  { label: '数据延迟', value: '< 2 s' },
] as const

const DIMENSIONS = ['按大区', '按渠道', '按品类', '按门店'] as const
const activeDimension = ref<(typeof DIMENSIONS)[number]>('按大区')

const SWITCHES = [
  { key: 'realtime', label: '实时数据推送' },
  { key: 'alarm', label: '告警联动' },
  { key: 'night', label: '夜间值守模式' },
] as const
const switchState = ref<Record<string, boolean>>({ realtime: true, alarm: true, night: false })
function toggleSwitch(key: string): void {
  switchState.value[key] = !switchState.value[key]
}

const regionItems = REGION_RANK.map((r) => ({ ...r }))
</script>

<template>
  <div :class="bem.b()">
    <header :class="bem.e('header')">
      <h1 :class="bem.e('title')">全国运营指挥中心 · 拼接大屏</h1>
      <p :class="bem.e('clock')">{{ clock }}</p>
    </header>

    <main :class="bem.e('main')">
      <!-- 左操作面板 -->
      <aside :class="bem.e('side')">
        <PanelBox title="核心指标" :class="bem.e('block')">
          <dl :class="bem.e('metrics')">
            <div v-for="m in METRIC_GROUPS" :key="m.label" :class="bem.e('metric')">
              <dt>{{ m.label }}</dt>
              <dd>{{ m.value }}</dd>
            </div>
          </dl>
        </PanelBox>
        <PanelBox title="区域排行" :class="bem.e('block')">
          <RankingList :items="regionItems" />
        </PanelBox>
        <PanelBox title="联动开关" :class="bem.e('block')">
          <div :class="bem.e('switches')">
            <button
              v-for="s in SWITCHES"
              :key="s.key"
              type="button"
              :class="[bem.e('switch'), switchState[s.key] ? bem.em('switch', 'on') : '']"
              @click="toggleSwitch(s.key)"
            >
              {{ s.label }} · {{ switchState[s.key] ? '开' : '关' }}
            </button>
          </div>
        </PanelBox>
      </aside>

      <!-- 中间地图 -->
      <section :class="bem.e('map')">
        <BigChart :option="mapOption" />
      </section>

      <!-- 右操作面板 -->
      <aside :class="bem.e('side')">
        <PanelBox title="分析维度" :class="bem.e('block')">
          <div :class="bem.e('dimensions')">
            <button
              v-for="d in DIMENSIONS"
              :key="d"
              type="button"
              :class="[bem.e('dimension'), activeDimension === d ? bem.em('dimension', 'active') : '']"
              @click="activeDimension = d"
            >
              {{ d }}
            </button>
          </div>
        </PanelBox>
        <PanelBox title="实时告警" :class="[bem.e('block'), bem.em('block', 'grow')]">
          <ul :class="bem.e('alarms')">
            <li v-for="a in ALARMS" :key="a.time + a.text">
              <span :class="[bem.e('alarm-level'), bem.em('alarm-level', a.level)]">{{ a.level }}</span>
              <span :class="bem.e('alarm-text')">{{ a.text }}</span>
              <span :class="bem.e('alarm-time')">{{ a.time }}</span>
            </li>
          </ul>
        </PanelBox>
      </aside>
    </main>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-big-demo-wide {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 9000px;
  height: 1080px;
  padding: 0 100px 60px;
  color: #d6e4ff;
  background:
    radial-gradient(ellipse 4000px 600px at 50% -10%, rgba(43, 109, 224, 0.3), transparent),
    #06122b;

  &__header {
    position: relative;
    flex: none;
    height: 100px;
    padding-top: 22px;
    text-align: center;
  }

  &__title {
    margin: 0;
    font-size: 56px;
    font-weight: 700;
    letter-spacing: 16px;
    background: linear-gradient(180deg, #ffffff, #7db4ff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &__clock {
    position: absolute;
    top: 40px;
    right: 0;
    margin: 0;
    font-size: 30px;
    color: #5f7bab;
    font-variant-numeric: tabular-nums;
  }

  &__main {
    display: flex;
    flex: 1;
    gap: 100px;
    min-height: 0;
  }

  &__side {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 40px;
    width: 1800px;
  }

  &__block {
    flex: none;

    &--grow {
      flex: 1;
      min-height: 0;
    }
  }

  &__map {
    flex: 1;
    min-width: 0;
  }

  &__metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin: 0;
  }

  &__metric {
    dt {
      font-size: 26px;
      color: #8fa8d8;
    }

    dd {
      margin: 8px 0 0;
      font-size: 44px;
      font-weight: 700;
      color: #4da3ff;
      font-variant-numeric: tabular-nums;
    }
  }

  &__switches,
  &__dimensions {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__switch,
  &__dimension {
    padding: 18px 28px;
    font-size: 28px;
    color: #d6e4ff;
    cursor: pointer;
    background: rgba(43, 109, 224, 0.12);
    border: 1px solid rgba(62, 140, 255, 0.35);
    border-radius: 8px;
  }

  &__switch--on,
  &__dimension--active {
    color: #ffffff;
    background: rgba(77, 163, 255, 0.35);
    border-color: #4da3ff;
  }

  &__alarms {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 16px 0;
      font-size: 26px;
      border-bottom: 1px dashed rgba(143, 168, 216, 0.15);
    }
  }

  &__alarm-level {
    flex: none;
    padding: 4px 14px;
    font-size: 22px;
    border-radius: 6px;

    &--高 {
      color: #fff;
      background: rgba(245, 108, 108, 0.85);
    }

    &--中 {
      color: #0a1830;
      background: rgba(247, 201, 72, 0.9);
    }

    &--低 {
      color: #0a1830;
      background: rgba(143, 168, 216, 0.75);
    }
  }

  &__alarm-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__alarm-time {
    flex: none;
    color: #5f7bab;
    font-variant-numeric: tabular-nums;
  }
}
</style>
```

> **字号说明**：9000×1080 设计稿在物理拼接屏上是 1:1 显示，但拼接屏观看距离远（5~15 米），字号按「1920 稿 × 1.5~1.8」尺度取（标题 56px、正文 26~30px），这是大屏行业惯例而非按比例 4.7 倍（4.7 倍是为等比缩放场景准备的，本页是原生分辨率直出）。

- [ ] **Step 3: 类型校验**

Run: `pnpm type-check`
Expected: 无新增错误（若 `import chinaGeoJson` 报 JSON 模块错误，回 Step 1 末尾的 tsconfig 分支处理）

- [ ] **Step 4: 全量单测**

Run: `pnpm test`
Expected: 全绿（含 Task 2 的 scale.spec.ts）

---

## Task 11: 浏览器四视口实测 + 其它布局回归

**Files:** 无（验证任务）

- [ ] **Step 1: 启动 dev**

Run: `pnpm dev`（后台）

- [ ] **Step 2: chrome-devtools MCP 逐视口截图核验**

| 视口 | 页面 | 核验点 |
|------|------|--------|
| 1920×1080 | `/big-demo` | 恰好铺满，三栏+标题完整，图表清晰 |
| 2560×1440 | `/big-demo` | 等比放大铺满，无留白无溢出 |
| 3840×2160 | `/big-demo` | scale=2，文字与图表均清晰（截图放大检查） |
| 9000×1080 | `/big-demo` | 高度撑满、两侧深色留白居中 |
| 1920×1080 | `/big-demo/wide` | 9000 设计稿整体缩小预览（scale≈0.21），三栏结构可辨 |
| 9000×1080 | `/big-demo/wide` | 恰好铺满：地图居中、两侧面板贴边 |

- [ ] **Step 3: 其它布局回归（零影响验证）**

| 页面 | 核验点 |
|------|--------|
| `/login` → 登录后 `/`（default） | 侧边栏/header 正常，无样式残留 |
| `/h5-demo` | rem 适配正常（html fontSize 生效），返回后恢复 |

- [ ] **Step 4: 同 layout 内跳转热切换**

`/big-demo` ↔ `/big-demo/wide` 互跳：视口不变时 scale 随 meta 立即切换（无中间态闪烁）。

---

## Task 12: Lint + 格式化 + 全量校验

- [ ] **Step 1:** `pnpm lint:fix` → 确认无 big 相关规则报错
- [ ] **Step 2:** `pnpm format` → 格式化新增文件
- [ ] **Step 3:** `pnpm type-check:full`（build 前全量）→ 绿
- [ ] **Step 4:** `pnpm test` → 全绿
- [ ] **Step 5:** `pnpm check:routes` → `✓ 所有路由检查通过`
- [ ] **Step 6:** `pnpm build` → 构建成功（验证生产构建无回归）

---

## Task 13: 文档同步

**Files:**
- Create: `docs/35-大屏布局与scale适配.md`
- Modify: `CLAUDE.md`（最近更新段 + §2.1 表格 layouts/modules 行）
- Modify: `CHANGELOG.md`（顶部新增条目）
- Modify: `README.md`（Layout 速选表）

- [ ] **Step 1: 新建 docs/35-大屏布局与scale适配.md**

内容大纲（照 docs/34 结构惯例）：
1. 能力概述：routes 配 big layout 即获得 scale 大屏能力（消费代码示例）
2. 适配原理：scale = min(vw/dw, vh/dh) + 居中留白；与 h5 rem 的差异对照表
3. 设计稿尺寸契约：`meta.bigScreen = { width, height }`，缺省 1920×1080；新尺寸接入步骤
4. 编写约束：样式写死设计稿 px、不走 rem；BEM 无 scoped
5. 已知限制：teleport 弹层组件不随缩放（用内联控件）；BigChart devicePixelRatio×scale 机制说明
6. 验证记录：四视口截图结论 + 零影响回归结论

- [ ] **Step 2: CLAUDE.md 更新**

- 顶部「最近更新」段新增 v2.1 条目（big layout + big-demo，指向 docs/35）
- §2.1 表格第 6 行 `layouts/` 职责：`default/blank/portal/h5` → `default/blank/portal/h5/big`
- §2.1 表格第 8 行 `modules/` 清单：追加 `big-demo`

- [ ] **Step 3: CHANGELOG.md 顶部新增条目**

```markdown
## [Unreleased]

### Added
- feat(layouts): 新增 big 大屏布局（scale 等比缩放，meta.bigScreen 设计稿契约）与 big-demo 示例模块（1920 标准屏 + 9000×1080 超宽拼接屏），适配 1920/2560/4K/拼接屏，详见 docs/35
```

- [ ] **Step 4: README.md Layout 速选表**

追加一行：`| big | 数据大屏/拼接屏 | scale 等比缩放（meta.bigScreen 声明设计稿） | docs/35 |`

- [ ] **Step 5: 文档一致性校验**

Run: `pnpm check:doc-currency`
Expected: 通过

---

## Self-Review 记录（计划落盘前已执行）

- **Spec 覆盖**：spec §2~§6 全部条目 → Task 1-13 一一对应；§7 实施顺序与 Task 顺序一致
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整代码
- **类型一致性**：`BigScaleState` / `BIG_SCALE_STATE_KEY` / `computeBigScale` / `resolveBigScreenSize` 在 scale.ts（Task 2）定义，index.vue（Task 3）与 BigChart.vue（Task 8）消费签名一致；`RankingItem` 从 RankingList.vue 导出，Index.vue import type 一致
- **已知实施注意点**：Task 9 Step 2 的 dayjs import 形态需先经 Step 3 确认（export 形态决定 import 写法）；Task 10 GeoJSON 类型收窄写法 `as unknown as Parameters<typeof echarts.registerMap>[1]`
