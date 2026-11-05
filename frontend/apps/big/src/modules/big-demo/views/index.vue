<script setup lang="ts">
/**
 * big-demo 首页：1920×1080 数据大屏（异星荧光森林视觉世界）。
 *
 * 布局（设计稿坐标系，样式写死 px 由 big layout scale 统一缩放）：
 *   标题栏 80px + 内容区（左栏 460 / 中央 flex:1 / 右栏 460，间距 30，页边距 30）
 *
 * 视觉（2026-11-03 重设计）：数据如活物——KPI 是四株光晕主株（青/丁香交替，
 * 焦点株独享白 bloom），面板为群落分区（细线分支边框），根脉网络 SVG 自底部
 * 向各面板分支脉动，孢子光点散布全屏。
 *
 * 实时感：setInterval 每 3s 抖动 KPI 数值（onUnmounted 清理）。
 * 标题栏副行常驻时钟；视口与 scale 适配指标默认折叠（点击展开）——
 * 验收证据保留但不抢首屏视觉（/autoplan Phase 2 T5）。
 */
import { BIG_SCALE_STATE_KEY } from '@/layouts/big/config/scale'
import { LIVE_FEED, OVERVIEW_KPIS, REGION_RANK, SIDE_KPIS, jitterValue } from '../apis'
import { mainTrendOption, shareOption, trendOption } from '../config/charts'
import { useClock } from '../composables/useClock'
// 模块内组件不在 unplugin-vue-components 全局注册范围（仅 components/common|ProTable|form-schema），需显式 import
import BigChart from '../components/BigChart.vue'
import KpiCard from '../components/KpiCard.vue'
import PanelBox from '../components/PanelBox.vue'
import RankingList from '../components/RankingList.vue'
import type { RankingItem } from '../components/RankingList.vue'

const bem = createNamespace('big-demo')

/** 当前 scale（big layout provide；独立预览时回退 1）——标题栏副行展示用 */
// inject 为 vue 依赖注入（AutoImport 注入）；key 契约见 @/layouts/big/config/scale.ts
const scaleState = inject(BIG_SCALE_STATE_KEY)

// ─── 视口与 scale 指标（验收缩放生效的直接证据）────────────────
const viewportLabel = ref('')
function refreshViewport(): void {
  viewportLabel.value = `${window.innerWidth}×${window.innerHeight}`
}
/** scale 显示：保留 3 位小数的紧凑形态 */
const scaleLabel = computed(() => {
  const s = scaleState?.value.scale ?? 1
  return String(Math.round(s * 1000) / 1000)
})

/** 适配指标折叠态：默认收起（验收证据不抢首屏视觉），点击展开 */
const showMetrics = ref(false)

// ─── KPI 实时抖动 ──────────────────────────────────────────
const kpis = ref(OVERVIEW_KPIS.map((k) => ({ ...k })))
let ticker: ReturnType<typeof setInterval> | undefined

// KPI 株光晕变体：按序 青→丁香→青→焦点（最后一株为焦点白 bloom）
const KPI_VARIANTS = ['cyan', 'lilac', 'cyan', 'focus'] as const

// 实时时钟（模块 composable，scope 销毁自动清理）
const clock = useClock()

onMounted(() => {
  refreshViewport()
  window.addEventListener('resize', refreshViewport)

  ticker = setInterval(() => {
    // 基于基准值抖动（而非当前值复利）：±5% 围绕基准跳动，
    // 避免长时间运行后数值无界漂移失真（演示厅长跑场景）
    kpis.value = OVERVIEW_KPIS.map((k) => ({ ...k, value: jitterValue(k.value) }))
  }, 3000)
})
onUnmounted(() => {
  window.removeEventListener('resize', refreshViewport)
  clearInterval(ticker)
})

const regionItems: RankingItem[] = REGION_RANK.map((r) => ({ ...r }))

// ─── 孢子光点散布（装饰层，确定性伪随机——SSR 安全、无 hydration 漂移）─────
interface SporeDot {
  x: number
  y: number
  size: number
  color: 'cyan' | 'lilac'
  opacity: number
}
const SPORE_DOTS: SporeDot[] = Array.from({ length: 28 }, (_, i) => ({
  x: (i * 137.5) % 1920, // 黄金角散布
  y: (i * 89.3) % 1080,
  size: 1 + (i % 3), // 1-3px
  color: i % 3 === 0 ? ('lilac' as const) : ('cyan' as const),
  opacity: i % 3 === 0 ? 0.7 : i % 3 === 1 ? 0.4 : 0.2,
}))
</script>

<template>
  <div :class="bem.b()">
    <!-- 根脉网络（装饰底层，absolute 相对本视图定位） -->
    <svg
      :class="bem.e('root-veins')"
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
      aria-hidden="true"
    >
      <path
        d="M 0 1080 Q 480 900 960 920 T 1920 880"
        fill="none"
        stroke="var(--big-root-vein)"
        stroke-width="1"
      />
      <path
        d="M 0 1080 Q 400 1000 700 980 T 1200 1000"
        fill="none"
        stroke="var(--big-root-vein)"
        stroke-width="1"
      />
      <path
        d="M 960 920 Q 1200 850 1500 830 T 1920 800"
        fill="none"
        stroke="var(--big-root-vein)"
        stroke-width="1"
      />
      <!-- 脉动亮边：根脉主干微亮 -->
      <path
        d="M 0 1080 Q 480 900 960 920 T 1920 880"
        fill="none"
        stroke="rgba(var(--big-spore-cyan-rgb), 0.08)"
        stroke-width="3"
      />
    </svg>

    <!-- 孢子光点散布（装饰层） -->
    <div :class="bem.e('spores')" aria-hidden="true">
      <i
        v-for="(dot, i) in SPORE_DOTS"
        :key="i"
        :class="bem.e('spore')"
        :style="{
          left: `${dot.x}px`,
          top: `${dot.y}px`,
          width: `${dot.size}px`,
          height: `${dot.size}px`,
          opacity: dot.opacity,
          background:
            dot.color === 'cyan'
              ? 'rgba(var(--big-spore-cyan-rgb), 1)'
              : 'rgba(var(--big-spore-lilac-rgb), 1)',
        }"
      />
    </div>

    <header :class="bem.e('header')">
      <h1 :class="bem.e('title')">集团经营数据大屏</h1>
      <p :class="bem.e('meta')">
        {{ clock }}
        <button
          type="button"
          :class="bem.e('metrics-toggle')"
          :aria-expanded="showMetrics"
          @click="showMetrics = !showMetrics"
        >
          适配指标 {{ showMetrics ? '▾' : '▸' }}
        </button>
        <span v-if="showMetrics">视口 {{ viewportLabel }} · scale ×{{ scaleLabel }}</span>
      </p>
    </header>

    <main :class="bem.e('main')">
      <!-- 左栏 -->
      <aside :class="[bem.e('col'), bem.em('col', 'left')]">
        <KpiCard
          v-for="(kpi, i) in SIDE_KPIS"
          :key="kpi.label"
          :label="kpi.label"
          :value="kpi.value"
          :unit="kpi.unit"
          :trend="kpi.trend"
          :variant="i % 2 === 0 ? 'cyan' : 'lilac'"
        />
        <PanelBox title="业务占比" :class="bem.e('panel-grow')">
          <BigChart :option="shareOption" />
        </PanelBox>
      </aside>

      <!-- 中央区 -->
      <section :class="bem.e('center')">
        <div :class="bem.e('kpi-band')">
          <KpiCard
            v-for="(kpi, i) in kpis"
            :key="kpi.label"
            :label="kpi.label"
            :value="kpi.value.toLocaleString()"
            :unit="kpi.unit"
            :trend="kpi.trend"
            :variant="KPI_VARIANTS[i % KPI_VARIANTS.length]"
          />
        </div>
        <PanelBox title="月度经营趋势" :class="bem.e('panel-main')">
          <BigChart :option="mainTrendOption" />
        </PanelBox>
        <PanelBox title="实时动态" :class="bem.e('panel-feed')">
          <ul :class="bem.e('feed')">
            <li v-for="item in LIVE_FEED" :key="item.time">
              <span :class="bem.e('feed-time')">{{ item.time }}</span>
              {{ item.text }}
            </li>
          </ul>
        </PanelBox>
      </section>

      <!-- 右栏 -->
      <aside :class="[bem.e('col'), bem.em('col', 'right')]">
        <PanelBox title="交易额走势" :class="bem.e('panel-trend')">
          <BigChart :option="trendOption" />
        </PanelBox>
        <PanelBox title="区域销售排行" :class="bem.e('panel-grow')">
          <RankingList :items="regionItems" />
        </PanelBox>
      </aside>
    </main>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-big-demo {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 1920px;
  height: 1080px;
  padding: 0 30px 30px;
  overflow: hidden;
  color: var(--big-text);
  // 夜壤底：近黑壤土（森林世界不用顶部径向光晕，用孢子散布照明）
  background: var(--big-bg-layout);

  // ====== 根脉网络（装饰底层） ======
  &__root-veins {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  // ====== 孢子光点散布 ======
  &__spores {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }

  &__spore {
    position: absolute;
    border-radius: 50%;
  }

  &__header {
    position: relative;
    z-index: 1;
    flex: none;
    height: 80px;
    padding-top: 14px;
    text-align: center;
  }

  // 森林世界不用渐变标题——极细字重 + 光晕阴影即层级
  &__title {
    margin: 0;
    font-size: 34px;
    font-weight: 300;
    letter-spacing: 8px;
    color: var(--big-text);
    text-shadow: 0 0 24px rgba(var(--big-spore-cyan-rgb), 0.35);
  }

  &__meta {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
    margin: 4px 0 0;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--big-text-3);
  }

  &__metrics-toggle {
    padding: 0 6px;
    font-size: 12px;
    color: var(--big-text-2);
    cursor: pointer;
    background: transparent;
    border: 1px solid rgba(var(--big-spore-cyan-rgb), 0.2);
    border-radius: 0;
    transition: color 0.2s ease;

    &:hover {
      color: var(--big-text);
      border-color: rgba(var(--big-spore-cyan-rgb), 0.45);
    }
  }

  &__main {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1;
    gap: 30px;
    min-height: 0;
  }

  &__col {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 460px;

    &--left,
    &--right {
      flex: none;
    }
  }

  &__center {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  &__kpi-band {
    display: grid;
    flex: none;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  &__panel-grow {
    flex: 1;
    min-height: 0;
  }

  &__panel-main {
    flex: 1.6;
    min-height: 0;
  }

  &__panel-feed {
    flex: 1;
    min-height: 0;
  }

  &__panel-trend {
    flex: none;
    height: 40%;
  }

  &__feed {
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
    font-size: 14px;
    color: var(--big-text-2);

    li {
      padding: 6px 0;
      border-bottom: 1px dashed rgba(var(--big-spore-cyan-rgb), 0.1);
    }
  }

  &__feed-time {
    margin-right: 12px;
    color: var(--big-text-2);
    font-variant-numeric: tabular-nums;
  }
}
</style>
