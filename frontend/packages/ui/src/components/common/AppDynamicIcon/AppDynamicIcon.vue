<script setup lang="ts">
import { resolveAppIcon, type AppIconName } from './registry.ts'

// BEM 工具（createNamespace）由 unplugin-auto-import 自动注入，详见 CLAUDE.md §3
const bem = createNamespace('app-dynamic-icon')

interface AppDynamicIconProps {
  /**
   * 图标名（集合:图标 语法），合法取值 = 注册表 key 联合（AppIconName），写错 vue-tsc 直接报错。
   * 本组件仅用于**装饰性**图标（已内置 aria-hidden）；语义图标请用静态 i-标签 + aria-label 自建可访问名。
   */
  name: AppIconName
  /** 图标尺寸（px），不传则跟随 SVG 默认 1.2em（unplugin-icons scale 默认值） */
  size?: number | string
}

const props = defineProps<AppDynamicIconProps>()

// 查表渲染：图标组件在编译期内联 SVG，运行时只是按名字取组件引用（零网络请求）
const iconComponent = computed(() => resolveAppIcon(props.name))

// size 未传时不能绑 undefined——v-bind 遇 undefined 会「移除」SVG 属性，
// 把编译产物自带的 width/height="1.2em" 默认尺寸清掉，导致 SVG 在 flex 上下文塌陷为 0 尺寸不可见。
// 因此不传 size 时整体不绑定 width/height，保留编译产物默认（2026-10-20 demo 实测回归修复）。
const sizeAttrs = computed(() =>
  props.size === undefined ? {} : { width: props.size, height: props.size }
)
</script>

<template>
  <!-- 装饰性图标默认 aria-hidden，避免屏幕阅读器朗读无意义内容 -->
  <component :is="iconComponent" :class="bem.b()" v-bind="sizeAttrs" aria-hidden="true" />
</template>

<style lang="scss">
.#{$BEM_PREFIX}-app-dynamic-icon {
  // 注意：本类直接落在 SVG 根上（component :is 无包裹壳），勿加 display: flex/inline-flex——
  // 会让 SVG 成为 flex item，无显式尺寸时按内容宽塌陷为 0（path 不参与布局），图标隐身
  vertical-align: -0.15em;
}
</style>
