<script setup lang="ts">
/**
 * 服务保障条（7 天无理由 / 顺丰包邮 / 正品保障）+ 品牌页脚。
 * 纯静态区块，无交互、无 props。
 */
const bem = createNamespace('mall-serve-footer')

const SERVE_ITEMS = [
  { icon: 'return', label: '7 天无理由' },
  { icon: 'truck', label: '顺丰包邮' },
  { icon: 'shield', label: '正品保障' },
] as const
</script>

<template>
  <div :class="bem.b()">
    <div :class="bem.e('serve')">
      <span v-for="s in SERVE_ITEMS" :key="s.label" :class="bem.e('s')">
        <svg :class="bem.e('sic')" aria-hidden="true"><use :href="`#mall-i-${s.icon}`" /></svg>
        {{ s.label }}
      </span>
    </div>
    <footer :class="bem.e('footer')">
      <div :class="bem.e('slogan')">拙衣 ZHUOYI — 素雅衣橱，日穿不腻</div>
      <div :class="bem.e('info')">客服 9:00 – 21:00 · 线下工作室 · 杭州西湖区天目里</div>
    </footer>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-serve-footer {
  &__serve {
    display: flex;
    justify-content: space-between;
    gap: 26px;
    margin-top: 159px;
    padding: 53px 53px 0;
    border-top: 1px solid var(--mall-line);
  }

  &__s {
    display: flex;
    align-items: center;
    gap: 18px;
    font-size: 28px;
    color: var(--mall-ink-2);
  }

  &__sic {
    flex: none;
    width: 40px;
    height: 40px;
    color: var(--mall-brand-deep);
  }

  &__footer {
    margin-top: 53px;
    padding: 0 53px 53px;
    text-align: center;
  }

  &__slogan {
    font-family: var(--mall-font-head);
    font-size: 31px;
    letter-spacing: 4px;
    color: var(--mall-ink-2);
  }

  &__info {
    margin-top: 13px;
    font-size: 28px;
    color: var(--mall-ink-3);
  }
}
</style>
