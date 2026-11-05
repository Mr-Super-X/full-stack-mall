<script setup lang="ts">
/**
 * 全公开应用统一根壳（ElConfigProvider + ErrorBoundary + RouterView）。
 *
 * 背景（2026-10-23 重复性审查）：auth/portal/h5/big/docs 五个 app 的 App.vue 曾逐字
 * 同构（22 行 ×5，仅 JSDoc 的 app 名不同）——收敛为本组件后，各 app App.vue 退化为
 * `<AppShell />` 单行 + 各自语义 JSDoc（边界/裁剪说明留在各 app 文件）。
 *
 * admin 刻意不在此列：远程菜单骨架（AsyncState 三态遮挡）+ locale 跟随 appStore
 * 同步是 admin 独有编排，仍由 apps/admin/src/App.vue 自持。
 *
 * elementConfig 与 admin App.vue 同口径（locale zh-cn + size default + 按钮两字间距），
 * 保证各站从 admin 迁出后 Element Plus 渲染无视觉漂移；五个站均无语言切换入口，
 * 固定 zh-cn 是刻意决策（非遗漏）。
 *
 * ErrorBoundary / ElConfigProvider / RouterView 均为全局自动注册组件
 * （unplugin-vue-components 扫 @vv/ui + ElementPlusResolver + vue-router），
 * 本组件同样零 import 直接使用——AppShell 自身也在自动注册 dirs（components/common），
 * 各 app App.vue 模板直接用 <AppShell />。
 *
 * @group 应用壳
 */
import zhCn from 'element-plus/es/locale/lang/zh-cn'

// admin 侧经 computed<Record<string, unknown>> 声明规避 ElConfigProvider 的
// ConfigProviderContext 精确类型约束（element-plus 2.x 的 ExtractPropTypes 元组形态与
// 运行时值不等价）；本组件是静态对象，照抄该形态
const elementConfig: Record<string, unknown> = {
  locale: zhCn,
  size: 'default',
  button: { autoInsertSpace: true },
}
</script>

<template>
  <ElConfigProvider v-bind="elementConfig">
    <ErrorBoundary>
      <RouterView />
    </ErrorBoundary>
  </ElConfigProvider>
</template>
