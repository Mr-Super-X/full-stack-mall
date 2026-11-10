<script setup lang="ts">
/** 编辑专题：单卡图文（kicker + 标题 + 简介 + 期号印章）。“阅读专题”点击跳商品列表页 */
const bem = createNamespace('mall-topic')

defineProps<{
  topic: {
    readonly kicker: string
    readonly title: string
    readonly desc: string
    readonly meta: string
    readonly artText: string
  }
}>()

const emit = defineEmits<{
  /** 点「阅读专题」：父级跳商品列表页（H5MallList） */
  goList: []
}>()
</script>

<template>
  <section :class="bem.b()">
    <div :class="bem.e('card')">
      <div :class="bem.e('txt')">
        <span :class="bem.e('kicker')">
          <i :class="bem.e('kickerdot')" aria-hidden="true" />
          {{ topic.kicker }}
        </span>
        <h3 :class="bem.e('title')">{{ topic.title }}</h3>
        <p :class="bem.e('desc')">{{ topic.desc }}</p>
        <div :class="bem.e('meta')">{{ topic.meta }}</div>
        <a :class="bem.e('more')" href="javascript:;" @click.prevent="emit('goList')">
          阅读专题
          <svg :class="bem.e('moreic')" aria-hidden="true"><use href="#mall-i-arrow" /></svg>
        </a>
      </div>
      <div :class="bem.e('art')" aria-hidden="true">
        <b>{{ topic.artText }}</b>
      </div>
    </div>
  </section>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-mall/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-mall-topic {
  margin-top: 159px;

  &__card {
    display: flex;
    align-items: center;
    gap: 53px;
    margin: 0 53px;
    padding: 53px;
    background: var(--mall-bg-card);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-md);
  }

  &__txt {
    flex: 1;
    min-width: 0;
  }

  &__kicker {
    display: inline-flex;
    align-items: center;
    gap: 13px;
    margin-bottom: 18px;
    font-size: 28px;
    letter-spacing: 4px;
    color: var(--mall-accent);
  }

  &__kickerdot {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--mall-accent);
  }

  &__title {
    margin: 0;
    font-family: var(--mall-font-head);
    font-size: 42px;
    font-weight: 600;
    line-height: 1.5;
    letter-spacing: 2px;
    color: var(--mall-ink-1);
  }

  &__desc {
    margin: 26px 0 0;
    font-size: 30px;
    color: var(--mall-ink-2);
  }

  &__meta {
    margin-top: 26px;
    font-size: 28px;
    color: var(--mall-ink-3);
  }

  &__more {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    margin-top: 26px;
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
    position: relative;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 212px;
    height: 212px;
    background: var(--mall-brand-soft);
    border: 1px solid var(--mall-line);
    border-radius: var(--mall-r-sm);

    // 内描边框（源 HTML ::after 双框印章效果）
    &::after {
      position: absolute;
      inset: 13px;
      content: '';
      border: 1px solid var(--mall-line-strong);
      border-radius: 11px;
    }

    b {
      font-family: var(--mall-font-head);
      font-size: 57px;
      font-weight: 600;
      letter-spacing: 4px;
      color: var(--mall-brand-deep);
    }
  }
}
</style>
