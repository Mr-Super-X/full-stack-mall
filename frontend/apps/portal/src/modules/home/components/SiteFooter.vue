<script setup lang="ts">
/**
 * 官网页脚：黑底收束 + 品牌行 + 锚点链接组 + ICP 占位（站点唯一深色区）。
 *
 * @see [`../config/site.ts`](../config/site.ts) SITE_FOOTER / SITE_BRAND 数据单源
 * @group 业务模块：Home
 */
import { SITE_BRAND, SITE_FOOTER } from '../config/site'

const bem = createNamespace('site-footer')
</script>

<template>
  <footer :class="bem.b()">
    <div :class="bem.e('inner')">
      <div :class="bem.e('brand')">
        <span :class="bem.e('name')">{{ SITE_BRAND.name }}</span>
        <span :class="bem.e('slogan')">{{ SITE_BRAND.slogan }}</span>
      </div>
      <nav :class="bem.e('links')" aria-label="页脚导航">
        <a v-for="l in SITE_FOOTER.links" :key="l.label" :href="l.anchor" :class="bem.e('link')">
          {{ l.label }}
        </a>
      </nav>
      <div :class="bem.e('meta')">
        <span :class="bem.e('icp')">{{ SITE_FOOTER.icp }}</span>
        <span :class="bem.e('copy')">© 2026 {{ SITE_BRAND.nameEn }}</span>
      </div>
    </div>
  </footer>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-footer {
  // 深底不随主题反转：云灰 bg-inverse 柔和深灰（原 var(--portal-ink) 在 dark 下反转成浅色，属既有缺陷，一并修复）
  background: var(--portal-bg-inverse);
  color: var(--portal-on-solid);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 64px 24px 32px;
  }

  &__brand {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 32px;
  }

  &__name {
    font-size: 20px;
    font-weight: 700;
  }

  &__slogan {
    font-size: 13px;
    color: var(--portal-on-ink-2);
  }

  &__links {
    display: flex;
    gap: 24px;
    padding: 24px 0;
    border-top: 1px solid var(--portal-on-line);
  }

  &__link {
    font-size: 14px;
    color: var(--portal-on-ink);
    text-decoration: none;

    &:hover {
      color: var(--portal-on-solid);
    }
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--portal-on-ink-3);
  }
}
</style>
