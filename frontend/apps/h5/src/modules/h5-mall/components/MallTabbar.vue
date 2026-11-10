<script setup lang="ts">
// ref / onMounted / onUnmounted / createNamespace 由 unplugin-auto-import 注入（CLAUDE.md §1.6）
import { MALL_TABS } from '../config/mall'
import { BALL_R, PANEL, tabX } from '../composables/trampoline-geometry'
import { useTrampolineTabbar } from '../composables/useTrampolineTabbar'

/**
 * 底部 Tabbar（Trampoline Tabbar · 凹槽抛球交互动画）。
 * 几何与动画逐条实现 design/tabbar-animation-spec.md；配色走 spec §9 样式槽位
 * （本组件 BEM 根上映射 mall 陶土 token）。
 *
 * 坐标系裁决（读代码读不出的约定）：动画几何工作在 spec 362×88 设计稿坐标系，
 * 渲染层由 useTrampolineTabbar 整体 scale 适配容器宽——因此本组件 &lt;style&gt;
 * 禁止写几何 px（会被 postcss-pxtorem 转 rem，与 JS scale 双重缩放），
 * 全部几何尺寸经 :style 内联（pxtorem 不碰内联样式）。
 *
 * @see [`../composables/useTrampolineTabbar.ts`](../composables/useTrampolineTabbar.ts) 引擎编排
 * @see [`../design/tabbar-animation-spec.md`](../../design/tabbar-animation-spec.md) 动画规范
 */
const bem = createNamespace('mall-tabbar')

const props = defineProps<{
  /** 选中 key（v-model 受控；宿主页面切换/路由在父级接 change 语义） */
  modelValue: string
  cartCount: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 受控选中 key：外部（父组件 v-model）经 props 下行驱动引擎，点击选项经 emit 上行。
// 刻意不用 defineModel——Vue 3.6.0-beta.17 下 defineModel 的父→子下行同步不触发
// 子组件 watch/watchEffect（模板渲染正常），路由回写等外部变更无法驱动引擎
//（2026-11-09 浏览器实测，计划 08 验证清单第 2/3 项踩中）；props + toRef 为标准响应式通道。
const model = toRef(props, 'modelValue')

// reduced-motion：媒体查询可动态变化，降级走引擎 instantSelect 瞬时切换（用户裁决通过）；
// matchMedia 缺失环境（jsdom / 旧 WebView）降级为 null → 不降级动画
const mql =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null
const reducedMotion = ref(false)
function syncReduced(): void {
  reducedMotion.value = mql?.matches ?? false
}

const { wrapRef, innerStyle, panelD, ballTransform, iconYs, activeIndex, tapIndex } =
  useTrampolineTabbar(MALL_TABS, { modelValue: model, reducedMotion })

/** 标签 pop 重触发计数：changed 时 +1，label 节点重建自动重放 keyframes */
const popTick = ref(0)

function onTap(i: number): void {
  const tab = MALL_TABS[i]
  if (tapIndex(i) === 'changed' && tab) {
    emit('update:modelValue', tab.key)
    popTick.value += 1
  }
}

const badgeText = (n: number): string => (n > 99 ? '99+' : `${n}`)

// ─── 362 设计稿坐标系静态几何（一律 :style 内联，勿迁入 <style>）───
const BALL_SIZE = BALL_R * 2 // 52
const PANEL_DROP_SHADOW = 'drop-shadow(0 6px 16px rgba(60, 63, 60, 0.12))'
const BALL_BOX_SHADOW = '0 4px 10px rgba(60, 63, 60, 0.16), 0 1px 3px rgba(60, 63, 60, 0.1)'
const ICON_WRAP_GEO = {
  left: '50%',
  marginLeft: '-12px',
  // 命中区顶收到凹槽底上方 6px 后，图标视觉 y=66 不变（66 - TAB_HIT_TOP 36）
  top: '30px',
  width: '24px',
  height: '24px',
} as const
// 标签视觉 y=93 同理随命中区顶偏移折算（93 - 36）
const LABEL_GEO = { top: '57px', fontSize: '12.5px' } as const
// 角标几何参照 __ic（24px 图标）而非 tab 命中区：角标是 __ic 子节点，
// 相对图标定位才贴合右上角，且跟随抛球动画 translateY（钉在按钮上会脱离图标）
const BADGE_GEO = {
  top: '-4px',
  right: '-8px',
  minWidth: '16px',
  height: '16px',
  padding: '0 5px',
  fontSize: '11px',
  lineHeight: '16px',
  borderRadius: '8px',
} as const
const TAB_HIT_W = 73
// 命中区收进面板轮廓（y∈[36,134]）：顶=凹槽底上方 6px 不侵凹槽空白，底=面板底；
// 旧值 y∈[-4,142] 向上覆盖 tabbar 上方页面内容，向下戳出面板，易误触
const TAB_HIT_TOP = PANEL.e - 6
const TAB_HIT_H = PANEL.h + 10

function tabStyle(i: number): Record<string, string> {
  return {
    left: `${tabX(i, MALL_TABS.length) - TAB_HIT_W / 2}px`,
    top: `${TAB_HIT_TOP}px`,
    width: `${TAB_HIT_W}px`,
    height: `${TAB_HIT_H}px`,
  }
}

function iconWrapStyle(i: number): Record<string, string> {
  return { ...ICON_WRAP_GEO, transform: `translateY(${iconYs.value[i] ?? 0}px)` }
}

onMounted(() => {
  syncReduced()
  mql?.addEventListener('change', syncReduced)
})
onUnmounted(() => mql?.removeEventListener('change', syncReduced))
</script>

<template>
  <nav :class="bem.b()" aria-label="底部导航">
    <div ref="wrapRef" :class="bem.e('wrap')">
      <div :class="bem.e('inner')" :style="innerStyle">
        <svg
          :class="bem.e('panel')"
          :width="PANEL.w"
          :height="PANEL.e + PANEL.h + 4"
          :viewBox="`0 0 ${PANEL.w} ${PANEL.e + PANEL.h + 4}`"
          :style="{ filter: PANEL_DROP_SHADOW, willChange: 'filter' }"
          fill="none"
        >
          <!-- 面板轮廓每帧重建：顶边为凹槽/鼓包形变采样折线，底角标准圆弧（spec §3.1） -->
          <path :d="panelD" fill="var(--tb-panel)" stroke="var(--mall-line)" stroke-width="1" />
        </svg>
        <div
          :class="bem.e('ball')"
          :style="{
            width: `${BALL_SIZE}px`,
            height: `${BALL_SIZE}px`,
            boxShadow: BALL_BOX_SHADOW,
            transform: ballTransform,
          }"
          @click="onTap(activeIndex)"
        />
        <button
          v-for="(tab, i) in MALL_TABS"
          :key="tab.key"
          type="button"
          :class="[bem.e('tab'), bem.is('active', i === activeIndex)]"
          :style="tabStyle(i)"
          :aria-current="i === activeIndex ? 'page' : undefined"
          @click="onTap(i)"
        >
          <span :class="bem.e('ic')" :style="iconWrapStyle(i)">
            <svg :class="bem.e('tic')" :width="24" :height="24" aria-hidden="true">
              <use :href="`#mall-i-${tab.icon}`" />
            </svg>
            <span
              v-if="tab.key === 'bag' && cartCount > 0"
              :class="bem.e('cartn')"
              :style="BADGE_GEO"
            >
              {{ badgeText(cartCount) }}
            </span>
          </span>
          <span :key="popTick" :class="bem.e('label')" :style="LABEL_GEO">{{ tab.label }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<style lang="scss">
// ⚠ 本节禁止出现几何 px（362 坐标系尺寸全走 script 内联——pxtorem 会转 <style> 里的 px，
// 与 JS scale 形成双重缩放）；此处仅写定位、层级、配色槽位、动画关键帧（均与尺寸无关）。
.#{$BEM_PREFIX}-mall-tabbar {
  // spec §9 样式槽位 ← mall 陶土 token（球与面板同色，凹槽轮廓由 GAP 间隙 + 投影保证）
  --tb-panel: var(--mall-bg-card);
  --tb-ball: var(--mall-bg-card);
  --tb-accent: var(--mall-brand-deep);
  --tb-icon: var(--mall-ink-3);
  --tb-label: var(--mall-ink-3);

  position: fixed;
  bottom: 0;
  left: 50%;
  z-index: 60;
  width: 100%;
  // 稿 px → rem 面板宽（与 layouts/h5 限宽 min(视口, 540px) 对齐）
  max-width: 828px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  transform: translateX(-50%);

  &__wrap {
    position: relative;
    width: 100%;
  }

  &__inner {
    position: relative;
    margin: 0 auto;
    // spec §2.1：球越出容器上边界属预期效果，宿主布局不可截断
    transform-origin: top center;
    user-select: none;
    -webkit-user-select: none;
  }

  &__panel {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 20;
    overflow: visible;
    pointer-events: none;
  }

  &__ball {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 45;
    border-radius: 50%;
    background: var(--tb-ball);
    cursor: pointer;
    will-change: transform;
  }

  &__tab {
    position: absolute;
    z-index: 30;
    padding: 0;
    font: inherit;
    color: var(--tb-label);
    background: none;
    border: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;

    // 选中按钮整体高于球（z=45）：层叠上下文内 __ic 的 z-index 无法越过球，
    // 必须把 active 按钮自身提升（spec §1.2：选中图标 z=50 在球之上）
    &.is-active {
      z-index: 50;
    }
  }

  &__ic {
    position: absolute;
    z-index: 30;
    color: var(--tb-icon);
    transition: color 0.26s ease;
    will-change: transform;

    .#{$BEM_PREFIX}-mall-tabbar__tab.is-active & {
      color: var(--tb-accent);
    }
  }

  &__tic {
    display: block;
  }

  &__label {
    position: absolute;
    right: 0;
    left: 0;
    z-index: 30;
    text-align: center;
    letter-spacing: 0.2px;
    color: var(--tb-label);
    transition: color 0.26s ease;

    .#{$BEM_PREFIX}-mall-tabbar__tab.is-active & {
      color: var(--tb-accent);
      font-weight: 600;
      // 标签 pop（spec §7.2）：35% 处 scale(1.14) 回弹；节点重建自动重放，无需 reflow hack
      animation: vv-mall-tabbar-pop 0.42s cubic-bezier(0.34, 1.8, 0.5, 1);
    }
  }

  &__cartn {
    position: absolute;
    z-index: 55;
    text-align: center;
    font-variant-numeric: tabular-nums;
    color: var(--mall-on-brand);
    background: var(--mall-brand-deep);
  }
}

@keyframes vv-mall-tabbar-pop {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(1.14);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .#{$BEM_PREFIX}-mall-tabbar {
    &__ic,
    &__label {
      transition: none;
    }

    &__label {
      animation: none;
    }
  }
}
</style>
