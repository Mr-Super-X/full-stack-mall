<script setup lang="ts">
/**
 * 官网 Hero 首屏（id=hero）：左文案 + 右线条 SVG 产品示意图。
 *
 * 设计：
 * - 文案来自 `config/site.ts`（SITE_HERO）；两个 CTA 均 goAuthLogin——P4 起整页跳
 *   apps/auth 统一登录（项目无注册页，见 site.ts 注释）
 * - 右侧示意图为内联 SVG（折线 + 柱状 + 网格，单色 stroke），仅此处使用故不独立成文件
 * - 入场动画 fade-up（≤0.6s 递增 delay）；prefers-reduced-motion 时关闭（a11y）
 *
 * @see [`../config/site.ts`](../config/site.ts) SITE_HERO 文案单源
 * @group 业务模块：Home
 */
import { redirectToAuthLogin } from '@vv/shared'
import { SITE_HERO } from '../config/site'

const bem = createNamespace('site-hero')

/**
 * 跳统一登录应用（apps/auth）：整页 location.href（跨 app 无共享 router 实例），
 * 回跳地址取当前路径；AUTH_REDIRECTING 中断信号吞掉（整页已发起，勿误报 errorHandler）
 */
function goAuthLogin(): void {
  try {
    redirectToAuthLogin(window.location.pathname)
  } catch {
    // 中断信号，非错误
  }
}

/** SVG 示意图横向网格线 y 坐标（viewBox 内部坐标；提为常量避免模板数组字面量每轮渲染重建） */
const GRID_LINES = [100, 150, 200, 250, 300]
</script>

<template>
  <section id="hero" :class="bem.b()">
    <div :class="bem.e('inner')">
      <div :class="bem.e('copy')">
        <p :class="bem.e('kicker')">{{ SITE_HERO.kicker }}</p>
        <h1 :class="bem.e('title')">
          {{ SITE_HERO.titleLines[0] }}
          <br />
          {{ SITE_HERO.titleLines[1] }}
        </h1>
        <p :class="bem.e('subtitle')">{{ SITE_HERO.subtitle }}</p>
        <div :class="bem.e('actions')">
          <button type="button" :class="[bem.e('btn'), bem.m('primary')]" @click="goAuthLogin">
            {{ SITE_HERO.primaryCta.label }}
          </button>
          <button type="button" :class="[bem.e('btn'), bem.m('ghost')]" @click="goAuthLogin">
            {{ SITE_HERO.secondaryCta.label }}
          </button>
        </div>
      </div>

      <svg :class="bem.e('art')" viewBox="0 0 480 360" role="img" aria-label="数据面板示意图">
        <rect
          x="8"
          y="8"
          width="464"
          height="344"
          rx="10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <line x1="8" y1="52" x2="472" y2="52" stroke="currentColor" stroke-width="1" />
        <circle cx="32" cy="30" r="5" fill="currentColor" />
        <rect x="48" y="24" width="96" height="12" rx="6" fill="currentColor" opacity=".25" />
        <g stroke="currentColor" stroke-width="0.5" opacity=".15">
          <line v-for="y in GRID_LINES" :key="y" x1="32" :y1="y" x2="448" :y2="y" />
        </g>
        <g fill="currentColor" opacity=".2">
          <rect x="60" y="220" width="28" height="80" />
          <rect x="104" y="180" width="28" height="120" />
          <rect x="148" y="240" width="28" height="60" />
          <rect x="192" y="150" width="28" height="150" />
          <rect x="236" y="200" width="28" height="100" />
        </g>
        <polyline
          points="60,200 130,150 200,180 270,110 340,140 410,80"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <g>
          <circle cx="270" cy="110" r="4.5" :class="bem.e('art-dot')" />
          <circle cx="410" cy="80" r="4.5" :class="bem.e('art-dot')" />
        </g>
      </svg>
    </div>
  </section>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-site-hero {
  background: var(--portal-bg);

  &__inner {
    max-width: var(--portal-max-width);
    margin: 0 auto;
    padding: 120px 24px;
    min-height: calc(100vh - var(--portal-header-h));
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 64px;
    box-sizing: border-box;
  }

  // 眉题：浅主底 pill + 深主字（云灰品牌族点亮，面积克制）
  &__kicker {
    display: inline-block;
    font-size: 12.5px;
    letter-spacing: 2px;
    color: var(--portal-brand-deep);
    background: var(--portal-brand-soft);
    border-radius: 999px;
    padding: 6px 16px;
    margin: 0 0 24px;
  }

  &__title {
    font-size: clamp(36px, 5vw, 56px);
    line-height: 1.2;
    font-weight: 700;
    color: var(--portal-ink);
    margin: 0 0 24px;
  }

  &__subtitle {
    font-size: 17px;
    line-height: 1.8;
    color: var(--portal-ink-2);
    margin: 0 0 40px;
    max-width: 30em;
  }

  &__actions {
    display: flex;
    gap: 16px;
  }

  &__btn {
    height: 46px;
    padding: 0 28px;
    font-size: 15px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      filter 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;

    // 实心按钮：brand 底（亮面 #5e6d7c / dark #5e7488，白字对比均 ≥4.5，见 tokens 用法契约）
    &--primary {
      background: var(--portal-brand);
      color: var(--portal-on-solid);
      border: 1px solid var(--portal-brand);

      &:hover {
        filter: brightness(1.12);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }
    }

    // 浅色按钮：浅主底 + 深主字（云灰浅色按钮契约）
    &--ghost {
      background: var(--portal-brand-soft);
      color: var(--portal-brand-deep);
      border: 1px solid var(--portal-brand-soft);

      &:hover {
        filter: brightness(0.97);
        transform: translateY(-1px);
      }
    }
  }

  &__art {
    width: 100%;
    height: auto;
    color: var(--portal-brand);

    // 折线顶点圆点点睛（面积 ≤10%，云灰点缀族）
    &-dot {
      fill: var(--portal-accent);
    }
  }

  // 入场动画（全站唯一动效，克制）：文案子元素递增 delay
  &__copy > * {
    animation: #{$BEM_PREFIX}-hero-fade-up 0.6s ease both;
  }

  &__copy > *:nth-child(2) {
    animation-delay: 0.08s;
  }

  &__copy > *:nth-child(3) {
    animation-delay: 0.16s;
  }

  &__copy > *:nth-child(4) {
    animation-delay: 0.24s;
  }

  &__art {
    animation: #{$BEM_PREFIX}-hero-fade-up 0.6s 0.2s ease both;
  }

  @media (prefers-reduced-motion: reduce) {
    &__copy > *,
    &__art {
      animation: none;
    }
  }

  @media (max-width: 900px) {
    &__inner {
      grid-template-columns: 1fr;
      gap: 48px;
      padding: 64px 24px;
    }
  }
}

@keyframes #{$BEM_PREFIX}-hero-fade-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
