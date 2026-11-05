<script setup lang="ts">
/**
 * H5 布局：移动端面板基座（rem 适配）。
 *
 * 消费方式（与 portal / default 同构）：路由父记录 component 直挂本布局即获得能力——
 *   { path: '/h5-demo', component: () => import('@/layouts/h5/index.vue'), children: [...] }
 *
 * 能力来源：
 *   - 编译时：本目录（src/layouts/h5/）与 src/modules/h5-xxx/（h5- 前缀模块）下的样式写 px，
 *     postcss-pxtorem 自动转 rem（见 build/postcss.ts）
 *   - 运行时：setup 顶层激活 html fontSize 动态计算（首帧渲染前生效，无 FOUC；宽屏限 540px 居中），
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

// setup 顶层即激活 rem（activateRem 首次应用同步写 html fontSize，纯 DOM 操作零 Vue 依赖、
// 无 SSR 顾虑，与 big layout setup 顶层初始化同策略）：保证组件首帧渲染前 fontSize 已生效，
// 消除"浏览器默认 16px → 激活值"的跳变（FOUC）。
// 重复挂载安全：activateRem 自带幂等（先恢复快照再激活，见 ./config/rem.ts）
activateRem()
onUnmounted(deactivateRem)
</script>

<template>
  <div :class="bem.b()">
    <RouterView />
  </div>
</template>

<style lang="scss">
// 非 scoped：h5-tokens 提供的 CSS 变量需对 h5-demo 子组件可见（同 portal/big-tokens 模式）
@use './styles/h5-tokens.scss' as *;

// 本文件在 postcss-pxtorem 转换范围内（src/layouts/h5/），直接写 828 设计稿 px 即可
.#{$BEM_PREFIX}-h5-layout {
  min-height: 100vh;
  // 100dvh 渐进增强：规避 iOS Safari 地址栏收缩导致的 100vh 溢出（与 default 布局同策略）
  min-height: 100dvh;
  background: var(--h5-bg);
}
</style>
