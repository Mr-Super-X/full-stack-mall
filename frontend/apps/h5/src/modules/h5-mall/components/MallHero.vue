<script setup lang="ts">
/**
 * 主推 Banner（陶土秋季主题）：眉题 + 主标题 + 副文案 + CTA，右侧为纯 SVG 装饰插画。
 * 入场渐显由父级 useReveal 统一挂 `.rv`（class 透传至本组件根元素）。
 * CTA 原型的 `#new`/`#topic` 锚点在路由化后为死链——统一 emit goList 由父级跳列表页。
 */
const bem = createNamespace('mall-hero')

const emit = defineEmits<{
  /** CTA 点击：父级跳商品列表页（H5MallList） */
  goList: []
}>()
</script>

<template>
  <section :class="bem.b()">
    <div :class="bem.e('eyebrow')">AUTUMN VOL.07 · 陶土色系</div>
    <h1 :class="bem.e('title')">
      陶土色的秋天，
      <br />
      穿一件暖
    </h1>
    <p :class="bem.e('desc')">手作质感棉麻，松弛有度的日常衣橱。</p>
    <div :class="bem.e('cta')">
      <a :class="bem.e('btn')" href="javascript:;" @click.prevent="emit('goList')">逛本季新品</a>
      <a :class="bem.e('more')" href="javascript:;" @click.prevent="emit('goList')">
        搭配灵感
        <svg :class="bem.e('moreic')" aria-hidden="true"><use href="#mall-i-arrow" /></svg>
      </a>
    </div>
    <svg :class="bem.e('art')" viewBox="0 0 200 170" aria-hidden="true">
      <circle cx="146" cy="64" r="52" fill="var(--mall-accent-soft)" />
      <g
        fill="none"
        stroke="var(--mall-brand-deep)"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M100 44v-6a7 7 0 1 0-7-7" />
        <path d="M100 44 42 76a4 4 0 0 0 2 7.5h112a4 4 0 0 0 2-7.5z" />
        <path d="M78 86v10M122 86v10" />
        <path d="M78 96h44l6 22c-17 8-39 8-56 0z" />
        <path d="M74 122 62 156c25 10 51 10 76 0l-12-34" />
      </g>
      <path d="M46 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="var(--mall-accent)" />
      <circle cx="168" cy="128" r="4" fill="var(--mall-brand)" />
    </svg>
  </section>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 521px;
  margin: 53px 53px 0;
  padding: 53px;
  overflow: hidden;
  background: var(--mall-brand-soft);
  border: 1px solid var(--mall-line);
  border-radius: var(--mall-r-lg);

  &__eyebrow {
    margin-bottom: 18px;
    font-size: 28px;
    letter-spacing: 9px;
    color: var(--mall-accent);
  }

  &__title {
    margin: 0;
    font-family: var(--mall-font-head);
    font-size: 75px;
    font-weight: 600;
    line-height: 1.32;
    letter-spacing: 2px;
    color: var(--mall-ink-1);
  }

  &__desc {
    max-width: 15em;
    margin: 26px 0 0;
    font-size: 31px;
    color: var(--mall-ink-2);
  }

  &__cta {
    display: flex;
    align-items: center;
    gap: 35px;
    margin-top: 53px;
  }

  &__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 93px;
    padding: 0 49px;
    font-size: 31px;
    letter-spacing: 4px;
    color: var(--mall-on-brand);
    background: var(--mall-brand-deep);
    border-radius: var(--mall-r-md);
    transition:
      transform var(--mall-dur) var(--mall-ease),
      opacity var(--mall-dur) var(--mall-ease);

    &:active {
      opacity: 0.92;
      transform: scale(0.97);
    }
  }

  &__more {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding-bottom: 4px;
    font-size: 30px;
    color: var(--mall-brand-deep);
    border-bottom: 1px solid var(--mall-line-strong);
  }

  &__moreic {
    width: 31px;
    height: 31px;
  }

  &__art {
    position: absolute;
    top: 50%;
    right: -31px;
    width: 380px;
    height: auto;
    pointer-events: none;
    opacity: 0.9;
    transform: translateY(-50%);
  }
}
</style>
