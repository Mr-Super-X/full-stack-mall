# BaseChart 图表组件使用指南

> **文档版本**：v1.0.0 | **最后更新**：2026-09-17
> **依赖版本**：ECharts 6.x（独立打包进 `vendor-charts` chunk，见 `docs/04` §v2.0）
> **源码位置**：`packages/ui/src/components/common/BaseChart.vue`
> **演示站**：`apps/docs/src/modules/demo/examples/BaseChart/`（5 个 demo，详见 §11）

---

## 📋 概述

`BaseChart` 是项目内的**通用 ECharts 容器组件**，封装了图表实例的创建、销毁、自适应 resize、主题切换、loading 状态等高频需求。

**适用场景**：

- 仪表盘 / 数据看板的柱状图、折线图、饼图等可视化
- 与 `el-table` / `el-card` 等容器搭配使用
- 弹窗 / 侧栏 / 折叠面板等动态容器尺寸场景

**与直接使用 ECharts 的差异**：

| 维度          | 直接 `echarts.init()`          | `<BaseChart>`                       |
| ------------- | ------------------------------ | ----------------------------------- |
| 响应式 resize | 需手写 ResizeObserver + 防抖   | **内置**（150ms trailing debounce） |
| 主题切换      | 需 destroy + init              | **内置**（监听 prop 自动销毁重建）  |
| 加载态        | 需手写 showLoading/hideLoading | **内置**（`loading` prop）          |
| 内存泄漏      | 易遗漏 dispose / disconnect    | **强制** onBeforeUnmount 三步清理   |
| tooltip 卡住  | setOption 默认 merge 旧状态    | **强制 notMerge: true** 避免残留    |

---

## 1. 基础用法

### 1.1 Props

| Prop         | 类型                | 默认值      | 说明                                                                   |
| ------------ | ------------------- | ----------- | ---------------------------------------------------------------------- |
| `option`     | `EChartsCoreOption` | 必填        | ECharts 配置项；变更时通过 `notMerge: true` **整体替换**               |
| `loading`    | `boolean`           | `false`     | 是否显示内置 Loading 动画（底层 `showLoading()` / `hideLoading()`）    |
| `theme`      | `string \| object`  | `undefined` | 主题名称（需先 `echarts.registerTheme`）或主题对象                     |
| `autoResize` | `boolean`           | `true`      | 是否监听容器尺寸变化自动 resize（侧栏折叠 / 弹窗拉伸场景建议保持开启） |

### 1.2 Events

BaseChart **不暴露自定义事件**——所有 ECharts 原生事件（`click` / `mouseover` / `legendselectchanged` 等）通过 `defineExpose.getInstance()` 获取实例后绑定：

```ts
const chartRef = ref()
onMounted(() => {
  chartRef.value?.getInstance()?.on('click', (params) => {
    console.log('数据点击：', params)
  })
})
```

### 1.3 Slots

无 — BaseChart 仅渲染 `<div class="vv-base-chart">` 作为 ECharts 挂载点，图表内容由 ECharts 自身 DOM 控制。

---

## 2. 设计要点（防止被「善意重构」破坏）

> 这 5 点是 BaseChart 的核心设计决策，每一点都有具体坑支撑，改动前请先读 `packages/ui/src/components/common/BaseChart.vue` 文件头 JSDoc。

| #   | 决策                                    | 为什么这样做                                                                                     |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **`shallowRef` 持有 ECharts 实例**      | ECharts 实例含大量方法、循环引用与 Canvas 句柄，深度响应式既无必要又拖性能                       |
| 2   | **ResizeObserver 替代 `window.resize`** | 侧栏折叠 / 弹窗拉伸场景下，容器尺寸变化与 `window` 解耦，必须观察容器自身                        |
| 3   | **`setOption` 强制 `notMerge: true`**   | 避免新旧 series / legend / tooltip 状态合并残留，否则切换数据集时旧 series 的 tooltip 卡住不消失 |
| 4   | **主题变更需销毁重建**                  | ECharts 主题仅 `init` 时生效，**没有** `setTheme` API                                            |
| 5   | **`onBeforeUnmount` 三步清理**          | 定时器 → ResizeObserver → ECharts 实例，缺一不可（详见 §5.3）                                    |

---

## 3. 实例方法（defineExpose）

通过 `ref` 获取实例后可调用：

| 方法                             | 说明                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `getInstance(): ECharts \| null` | 获取 ECharts 原生实例，用于绑定事件 / 调用 `dispatchAction` / `getOption` 等                  |
| `resize(): void`                 | 手动触发重绘（容器尺寸外部已变但 ResizeObserver 未触发的兜底入口，如动画结束 / 字体加载完成） |
| `clear(): void`                  | 清空图表内容，**保留实例本身**（与 `dispose` 不同——dispose 会销毁实例，后续需重新 `init`）    |

```ts
import BaseChart from '@vv/ui/components/common/BaseChart.vue'

const chartRef = ref<InstanceType<typeof BaseChart>>()

// 兜底 resize：某个父容器动画结束后尺寸稳定，但 ResizeObserver 已在动画帧触发完
nextTick(() => chartRef.value?.resize())
```

---

## 4. 高级用法

### 4.1 事件绑定

```vue
<template>
  <BaseChart ref="chartRef" :option="option" />
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const chartRef = ref()
const option = computed(() => ({/* ... */}))

let clickHandler: ((p: unknown) => void) | null = null

onMounted(() => {
  const instance = chartRef.value?.getInstance()
  if (!instance) return
  clickHandler = (params) => console.log('click', params)
  instance.on('click', clickHandler)
})

onBeforeUnmount(() => {
  // 重要：组件已 dispose 但 instance 仍持有 listener，必须显式 off
  const instance = chartRef.value?.getInstance()
  if (instance && clickHandler) instance.off('click', clickHandler)
})
</script>
```

### 4.2 主题切换

```ts
// main.ts 或独立 theme 模块
import * as echarts from 'echarts'
import darkTheme from './echarts-theme-dark.json'
echarts.registerTheme('dark', darkTheme)
```

```vue
<BaseChart :theme="isDark ? 'dark' : undefined" :option="option" />
```

> 切换 `theme` prop 会触发 BaseChart 内部销毁并重建实例（ECharts 无 `setTheme` API）。

### 4.3 loading 状态

```vue
<template>
  <BaseChart :option="option" :loading="loading" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRequest } from '@vv/shared' // 或由 AutoImport 自动注入，免 import
import { dashboardApi } from '@api/modules/dashboard'

const loading = ref(false)
const option = computed(() => /* ... */)

const { data } = useRequest(() => dashboardApi.getTrend(), {
  onBefore: () => (loading.value = true),
  onFinally: () => (loading.value = false),
})
</script>
```

### 4.4 手动 resize 兜底

部分场景容器尺寸由 Web Animations API / CSS transition 驱动，ResizeObserver 在动画帧可能错漏：

```ts
// 父容器 transition 结束后手动调用
chartRef.value?.resize()
```

### 4.5 多图表组合（Dashboard）

```vue
<template>
  <el-row :gutter="16">
    <el-col :span="12"><BaseChart :option="trendOpt" /></el-col>
    <el-col :span="12"><BaseChart :option="pieOpt" /></el-col>
  </el-row>
</template>
```

> ResizeObserver 是**每个 BaseChart 实例一份**，不会互相影响——但多个实例同时 resize 时 GPU 重绘压力会叠加，注意控制单页面图表数量（≤ 8 个）。

---

## 5. 容器要求与常见踩坑

### 5.1 父容器必须有明确高度

ECharts 通过容器的 `clientWidth` / `clientHeight` 初始化画布，父容器塌缩为 0 时会报 `Canvas width/height 0` 警告。BaseChart 已加 `min-height: 1px` 兜底，但业务容器仍需给出合理高度：

```scss
.chart-wrap {
  width: 100%;
  height: 320px; // 或 50vh / calc(100vh - 200px)
}
```

```vue
<div class="chart-wrap">
  <BaseChart :option="opt" />
</div>
```

### 5.2 折叠态容器场景

`el-collapse-item` / `el-drawer` 等折叠态下容器 `display: none`，展开后需手动 `resize`（`autoResize: true` 会自动处理，但首屏展开可能需 `nextTick`）：

```ts
import { useEventListener } from '@vueuse/core'

useEventListener('transitionend', () => {
  chartRef.value?.resize()
})
```

### 5.3 onBeforeUnmount 三步清理顺序

```ts
onBeforeUnmount(() => {
  // 1. 清防抖定时器 → 卸载后定时器仍会触发 resize（实例已 dispose → 静默失败）
  teardownResize()
  // 2. disconnect ResizeObserver → 释放对 DOM 节点的强引用
  // 3. dispose ECharts → 同步移除所有事件监听器并释放 canvas
  instance.value?.dispose()
  instance.value = null
})
```

**顺序错了会内存泄漏**：先 dispose 再 disconnect → ResizeObserver 仍持有 DOM 引用；先 disconnect 不 dispose → canvas 句柄未释放。

---

## 6. 性能与防抖

- **ResizeObserver 60Hz 触发 → 150ms trailing debounce → 单次 `resize`**，对中后台 60Hz 屏足够平滑且节省 GPU 重绘
- **shallowRef 避免深度代理**：ECharts 实例含循环引用，深响应式会拖慢 watch 链路
- **`notMerge: true` 避免深度 diff**：图表切换时直接替换，避免 merge 旧 series 的 tooltip / legend 状态

> 高频动画场景（实时数据 > 30 FPS）建议关闭 `autoResize` 并在数据更新间隔（如 1s）外手动 `resize` 一次。

---

## 7. 已知限制

| #   | 限制                                                                               | 应对方式                                     |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | 实例共享需谨慎：父组件 dispose 后，所有持有 `getInstance()` 返回值的子代码立即失效 | 业务代码不要跨组件缓存 instance              |
| 2   | 自定义主题需先 `echarts.registerTheme`                                             | 在 main.ts / theme 模块集中注册              |
| 3   | 主题切换会重建实例，已绑定的事件 listener 丢失                                     | 重新绑定，或用 `instance.on` 全局监听        |
| 4   | 不支持 SSR（ECharts 强依赖 DOM 与 Canvas）                                         | SPA 项目不受影响                             |
| 5   | 大量图表同屏（> 8）会触发 GPU 重绘压力                                             | 用 `v-show` 控制可见性，避免 `v-if` 销毁重建 |

---

## 8. 测试覆盖

| 文件                                                  | 覆盖范围                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/components/common/BaseChart.spec.ts` | 基础渲染 / option 切换 / loading 切换 / theme 重建 / autoResize 切换 / resize 兜底 / clear vs dispose 差异 |

完整 demo：`apps/docs/src/modules/demo/examples/`（如已有对应示例，可在此处追加链接）。

---

## 9. 速查

```vue
<!-- 最小可运行 -->
<template>
  <div style="height: 320px">
    <BaseChart :option="option" />
  </div>
</template>

<script setup lang="ts">
const option = {
  xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [120, 200, 150] }],
}
</script>
```

```ts
// 手动 resize
chartRef.value?.resize()

// 获取实例绑定事件
chartRef.value?.getInstance()?.on('click', handler)
```

---

## 10. 相关文档

- 组件源码：`packages/ui/src/components/common/BaseChart.vue`
- ECharts 官方文档：https://echarts.apache.org/zh/index.html
- 类型导出：`echarts` 包 `EChartsCoreOption`
- 主题注册：`echarts.registerTheme`
- 包体积分析：`docs/04-构建与测试工具.md` §Vendor Chunk（含 `vendor-charts`）

---

## 11. 示例索引（5 个 demo + 1 个主入口）

在线演示站点：`pnpm dev` → `/demo`（左侧「BaseChart 图表」分组），路由 = `/demo/base-chart-<kebab-case>`。所有 demo 源码位于 `apps/docs/src/modules/demo/examples/BaseChart/`（5 个 `.vue` 文件）。

| 路由                           | 内容                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `/demo/base-chart-overview`    | **主 demo**：BaseChart 用法总览（props / events / 三态） |
| `/demo/base-chart-dashboard`   | Dashboard 综合示例（多图表组合 + 主题切换）              |
| `/demo/base-chart-real-time`   | 实时数据（定时刷新 + 性能验证）                          |
| `/demo/base-chart-sale-funnel` | 销售漏斗图（特定图表类型 demo）                          |
| `/demo/base-chart-in-dialog`   | BaseChart 嵌入 ProDialog（弹窗内图表）                   |

> **主 demo 入口**：`/demo/base-chart-overview`（对应 `BaseChartOverview.vue`）—— 查阅 props/events/三态的入口。其余 4 个 demo 按「综合 → 实时 → 特定图型 → 嵌入场景」分组。
