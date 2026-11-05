<script setup lang="ts">
/**
 * 产品特性区（id=features）：3 卡线性图标布局。
 *
 * 设计：卡片标题/描述来自 `config/site.ts`（SITE_FEATURES）；
 * 图标是呈现细节，用编译期解析的静态 `<i-tabler-* />` 标签写在模板里（3 卡逐张展开），
 * 不进 config、不做运行时 name→组件映射（virtual:icons 在 vitest 不可解析，静态标签测试安全）。
 *
 * @see [`../config/site.ts`](../config/site.ts) SITE_FEATURES 数据单源
 * @group 业务模块：Home
 */
import { SITE_FEATURES, SITE_FEATURES_EYEBROW, SITE_FEATURES_HEADING } from '../config/site'

const bem = createNamespace('site-features')
</script>

<template>
  <section id="features" :class="bem.b()">
    <div :class="bem.e('inner')">
      <p :class="bem.e('eyebrow')">{{ SITE_FEATURES_EYEBROW }}</p>
      <h2 :class="bem.e('heading')">{{ SITE_FEATURES_HEADING }}</h2>
      <div :class="bem.e('grid')">
        <article :class="bem.e('card')">
          <i-tabler-chart-line :class="bem.e('icon')" aria-hidden="true" />
          <h3 :class="bem.e('title')">{{ SITE_FEATURES[0].title }}</h3>
          <p :class="bem.e('desc')">{{ SITE_FEATURES[0].desc }}</p>
        </article>
        <article :class="bem.e('card')">
          <i-tabler-shield-lock :class="bem.e('icon')" aria-hidden="true" />
          <h3 :class="bem.e('title')">{{ SITE_FEATURES[1].title }}</h3>
          <p :class="bem.e('desc')">{{ SITE_FEATURES[1].desc }}</p>
        </article>
        <article :class="bem.e('card')">
          <i-tabler-cloud-computing :class="bem.e('icon')" aria-hidden="true" />
          <h3 :class="bem.e('title')">{{ SITE_FEATURES[2].title }}</h3>
          <p :class="bem.e('desc')">{{ SITE_FEATURES[2].desc }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-features {
  // 与页面同色：白卡片直接浮于纸面（云灰分区节奏，取消白/浅灰分区带）
  background: var(--portal-bg);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 120px 24px;
  }

  &__eyebrow {
    font-size: 12.5px;
    letter-spacing: 3px;
    font-weight: 600;
    color: var(--portal-brand-deep);
    margin: 0 0 8px;
    text-align: center;
  }

  &__heading {
    font-size: 32px;
    font-weight: 700;
    color: var(--portal-ink);
    margin: 0 0 48px;
    text-align: center;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }

  &__card {
    background: var(--portal-bg-card);
    border: 1px solid var(--portal-line);
    border-radius: var(--radius-md);
    padding: 40px 32px;
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;

    // 状态响应式：静息零阴影，hover 浮起（DESIGN.md 状态响应 Rule）
    &:hover {
      border-color: var(--portal-line-strong);
      box-shadow: var(--shadow-md);
      transform: translateY(-3px);
    }
  }

  // icon 块：浅主底圆角块 + 深主图标（云灰品牌族点亮）
  &__icon {
    width: 42px;
    height: 42px;
    font-size: 22px;
    color: var(--portal-brand-deep);
    background: var(--portal-brand-soft);
    border-radius: var(--radius-sm);
    display: grid;
    place-items: center;
    margin-bottom: 20px;
  }

  &__title {
    font-size: 18px;
    font-weight: 600;
    color: var(--portal-ink);
    margin: 0 0 12px;
  }

  &__desc {
    font-size: 14px;
    line-height: 1.8;
    color: var(--portal-ink-2);
    margin: 0;
  }

  @media (max-width: 900px) {
    &__grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
