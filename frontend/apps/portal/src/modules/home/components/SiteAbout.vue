<script setup lang="ts">
/**
 * 关于与联系（id=about）：公司简介 + 三栏联系信息。
 *
 * @see [`../config/site.ts`](../config/site.ts) SITE_ABOUT 数据单源
 * @group 业务模块：Home
 */
import { SITE_ABOUT } from '../config/site'

const bem = createNamespace('site-about')
</script>

<template>
  <section id="about" :class="bem.b()">
    <div :class="bem.e('inner')">
      <div :class="bem.e('intro')">
        <h2 :class="bem.e('heading')">{{ SITE_ABOUT.heading }}</h2>
        <p v-for="(p, i) in SITE_ABOUT.paragraphs" :key="i" :class="bem.e('para')">{{ p }}</p>
      </div>
      <div :class="bem.e('contact')">
        <div v-for="c in SITE_ABOUT.contacts" :key="c.label" :class="bem.e('contact-item')">
          <div :class="bem.e('contact-label')">{{ c.label }}</div>
          <div :class="bem.e('contact-value')">{{ c.value }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-about {
  background: var(--portal-bg);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 120px 24px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
  }

  &__heading {
    font-size: 32px;
    font-weight: 700;
    color: var(--portal-ink);
    margin: 0 0 24px;
  }

  &__para {
    font-size: 15px;
    line-height: 1.9;
    color: var(--portal-ink-2);
    margin: 0 0 16px;
  }

  &__contact-item {
    border-top: 1px solid var(--portal-line);
    padding: 20px 0;

    &:last-child {
      border-bottom: 1px solid var(--portal-line);
    }

    // 状态响应：整行 hover 时联系值点亮为主色（云灰品牌族反馈）
    &:hover .#{$BEM_PREFIX}-site-about__contact-value {
      color: var(--portal-brand-deep);
    }
  }

  &__contact-label {
    font-size: 13px;
    color: var(--portal-ink-2);
    margin-bottom: 6px;
  }

  &__contact-value {
    font-size: 16px;
    color: var(--portal-ink);
    font-weight: 600;
  }

  @media (max-width: 900px) {
    &__inner {
      grid-template-columns: 1fr;
      gap: 40px;
    }
  }
}
</style>
