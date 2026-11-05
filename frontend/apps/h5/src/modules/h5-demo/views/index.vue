<script setup lang="ts">
/**
 * h5-demo 首页：rem 适配验收演示。
 *
 * 全部样式直接写 828 设计稿标注的 px（所见即所得），
 * 构建时 postcss-pxtorem 自动转 rem（见 build/postcss.ts）。
 * 顶部信息条实时显示 html fontSize 与视口宽，作为缩放生效的直接证据。
 */
const bem = createNamespace('h5-demo')

/** 实时指标：html fontSize 计算值 + 视口宽度（验收缩放的直接证据） */
const rootFontSize = ref('')
const viewportWidth = ref(0)

function refreshMetrics(): void {
  rootFontSize.value = getComputedStyle(document.documentElement).fontSize
  viewportWidth.value = window.innerWidth
}

// html fontSize 由 layouts/h5/config/rem.ts 激活与重算（防抖 300ms）。
// 用 MutationObserver 订阅 html style 属性变化（而非定时器猜测重算时机）：
// fontSize 真正写入时读数必然准确，与 rem.ts 的防抖周期零耦合。
// resize 监听兜底视口宽读数（宽屏间切换 fontSize 恒为 54px，不触发 style 变更）
let observer: MutationObserver | undefined

onMounted(() => {
  // 父级 h5 layout 在 setup 顶层同步激活 activateRem（首帧渲染前 html fontSize 已生效），
  // 挂载时直读已准确；nextTick + MutationObserver 双保险兜 resize 重算的时序
  nextTick(refreshMetrics)
  observer = new MutationObserver(refreshMetrics)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
  window.addEventListener('resize', refreshMetrics)
})
onUnmounted(() => {
  observer?.disconnect()
  window.removeEventListener('resize', refreshMetrics)
})
</script>

<template>
  <div :class="bem.b()">
    <header :class="bem.e('header')">
      <h1 :class="bem.e('title')">H5 REM 适配演示</h1>
      <p :class="bem.e('meta')">
        html fontSize: {{ rootFontSize }} · 视口宽: {{ viewportWidth }}px · 设计稿: 828px
      </p>
    </header>

    <section :class="bem.e('card')">
      <h2 :class="bem.e('card-title')">px → rem 自动转换（字号阶梯）</h2>
      <p :class="bem.e('text-lg')">28px 标题字号（设计稿标注值）</p>
      <p :class="bem.e('text-md')">24px 正文字号</p>
      <p :class="bem.e('text-sm')">20px 辅助字号</p>
    </section>

    <section :class="bem.e('card')">
      <h2 :class="bem.e('card-title')">200px 宽卡片（828 稿）</h2>
      <div :class="bem.e('box-width')">宽 200px → 375 屏渲染 ≈ 90.6px</div>
    </section>

    <section :class="bem.e('card')">
      <h2 :class="bem.e('card-title')">1px 边框对照</h2>
      <div :class="[bem.e('box-border'), bem.em('box-border', 'hairline')]">
        border: 1px（&lt; minPixelValue 2，不转换，物理 1px 细线）
      </div>
      <div :class="[bem.e('box-border'), bem.em('box-border', 'scaled')]">
        border: 2px（转 rem，随屏宽缩放）
      </div>
    </section>

    <footer :class="bem.e('footer')">
      宽屏（&gt;540px）打开时页面限宽居中；返回后台布局自动恢复。
    </footer>
  </div>
</template>

<style lang="scss">
// 本文件在 postcss-pxtorem 转换范围内（src/modules/h5-demo/），直接写 828 设计稿 px
.#{$BEM_PREFIX}-h5-demo {
  min-height: 100vh;
  // 100dvh 渐进增强：规避 iOS Safari 地址栏收缩溢出（与 layouts/h5 同策略）
  min-height: 100dvh;
  padding: 24px;

  &__header {
    padding: 32px 0 16px;
    text-align: center;
  }

  &__title {
    margin: 0 0 12px;
    font-size: 36px;
    font-weight: 600;
    color: var(--h5-text);
  }

  &__meta {
    margin: 0;
    font-size: 20px;
    color: var(--h5-text-2);
  }

  &__card {
    margin-bottom: 24px;
    padding: 28px;
    background: var(--h5-card-bg);
    border-radius: 16px;
    box-shadow: 0 4px 16px var(--h5-shadow-card);
  }

  &__card-title {
    margin: 0 0 20px;
    font-size: 26px;
    font-weight: 600;
    color: var(--h5-text-title);
  }

  &__text-lg {
    margin: 0 0 8px;
    font-size: 28px;
  }

  &__text-md {
    margin: 0 0 8px;
    font-size: 24px;
  }

  &__text-sm {
    margin: 0;
    font-size: 20px;
    color: var(--h5-text-2);
  }

  &__box-width {
    width: 200px;
    padding: 16px;
    font-size: 20px;
    color: var(--el-color-white);
    background: var(--color-primary);
    border-radius: 8px;
    text-align: center;
  }

  &__box-border {
    margin-bottom: 16px;
    padding: 20px;
    font-size: 20px;
    color: var(--h5-text-2);
    border-radius: 8px;

    &--hairline {
      border: 1px solid var(--h5-line);
    }

    &--scaled {
      border: 2px solid var(--color-primary);
    }
  }

  &__footer {
    padding: 16px 0 32px;
    font-size: 20px;
    color: var(--h5-text-2);
    text-align: center;
  }
}
</style>
