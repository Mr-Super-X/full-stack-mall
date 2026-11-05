<script setup lang="ts">
/**
 * 大屏装饰面板：四角 L 形高光 + 半透明深蓝底 + 可选标题栏。
 *
 * 四角用 4 个独立 <i> 元素（每角一个），比多重 background-gradient 单元素写法
 * 可读性更好，且各自定位互不影响。
 *
 * 样式全部写死设计稿 px：big layout 的 scale 容器统一等比缩放，
 * 本组件不在 postcss-pxtorem 转换范围，px 原样输出即可。
 *
 * 高度契约（消费侧必读）：组件根不写 height:100%——flex item 场景下
 * flex-basis 决定主轴尺寸，height:100% 会在 basis:auto 时劫持为父容器全高
 * （9000 页 flex:none 面板实测塌陷根因）。消费侧用 flex grow 比例 / grid 行 /
 * 固定 height 任一种提供确定高度；父链高度不确定时内容自适应。
 */
interface Props {
  /** 面板标题（左上角，不传则不渲染标题栏） */
  title?: string
}
defineProps<Props>()

const bem = createNamespace('panel-box')
</script>

<template>
  <section :class="bem.b()">
    <header v-if="title" :class="bem.e('header')">{{ title }}</header>
    <div :class="bem.e('body')">
      <slot />
    </div>
  </section>
</template>

<style lang="scss">
// 异星荧光森林语义：面板 = 群落分区——细线植物分支边框 + 底部根脉汇聚微亮区，无直角硬边框无四角高光
.#{$BEM_PREFIX}-panel-box {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 16px 20px;
  // 底部根脉汇聚微亮区（上部透明，向下渐亮）
  background: linear-gradient(
    180deg,
    transparent 30%,
    rgba(var(--big-panel-glow-cyan-rgb), 0.55) 100%
  );
  // 顶部细线：群落与夜壤的分界（1px 植物分支线）
  border-top: 1px solid rgba(var(--big-spore-cyan-rgb), 0.15);

  // 分支角须：左右两缘中点各一根水平细线，模拟植物分支节点
  &::before,
  &::after {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 1px;
    content: '';
    background: rgba(var(--big-spore-cyan-rgb), 0.25);
    transform: translateY(-50%);
  }

  &::before {
    left: 0;
  }

  &::after {
    right: 0;
  }

  &__header {
    flex: none;
    padding-bottom: 12px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 2px;
    color: var(--big-text);
    // 标题左侧孢子光点（小光晕装饰）
    border-bottom: 1px solid rgba(var(--big-spore-cyan-rgb), 0.08);
  }

  &__body {
    flex: 1;
    min-height: 0;
  }
}
</style>
