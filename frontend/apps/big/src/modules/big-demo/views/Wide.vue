<script setup lang="ts">
/**
 * big-demo 超宽示例：9000×1080 拼接屏（中间地图 + 两侧操作面板）。
 *
 * 布局：标题栏 100px + 内容区（左面板 1800 / 地图 flex:1 / 右面板 1800，间距 100，页边距 100）
 * 本页经路由 meta.bigScreen = { width: 9000, height: 1080 } 声明设计稿尺寸，
 * big layout 据此缩放；普通 1920 显示器打开时整体缩小预览（scale≈0.21），开发无需真拼接屏。
 *
 * 地图 option 在 ../config/china-map.ts（含 GeoJSON 注册副作用）；本页经动态 import() 加载该模块——
 * 159KB GeoJSON 退到二级 chunk，路由 chunk 秒载、页面壳先渲染，地图区先呈现加载/失败态
 * （/autoplan Phase 2 D-SC-1 五态示范的真实异步场景）；
 * 面板静态数据在 ../apis（WIDE_* 常量）；开关组交互在 ../components/SwitchGroup.vue。
 *
 * 字号尺度：本页 1:1 物理显示且观看距离远（5~15 米），字号按 1920 稿 ×1.5~1.8 取
 * （标题 56px、正文 22~30px），非按比例 4.7 倍（4.7 倍是等比缩放场景的算法，本页原生分辨率直出）。
 * 面板内容密度经 9000×1080 实测紧凑化（排行/按钮/指标压缩），保证三栏总高不溢出不裁剪。
 */
import type { EChartsOption } from 'echarts'
import { useClock } from '../composables/useClock'
// 模块内组件不在 unplugin-vue-components 全局注册范围（仅 components/common|ProTable|form-schema），需显式 import
import BigChart from '../components/BigChart.vue'
import PanelBox from '../components/PanelBox.vue'
import SwitchGroup from '../components/SwitchGroup.vue'
import { REGION_RANK, WIDE_ALARMS, WIDE_DIMENSIONS, WIDE_METRIC_GROUPS } from '../apis'

const bem = createNamespace('big-demo-wide')

// 实时时钟（模块 composable，scope 销毁自动清理）
const clock = useClock()

// ─── 地图二级懒加载（真实异步场景的五态示范载体）──────────────
// china-map.ts 含 159KB GeoJSON：动态 import 让路由 chunk 秒载、壳先渲染；
// 加载期/失败期在地图区就地呈现（不整页 loading），失败可重试。
// shallowRef 而非 ref：echarts option 大对象只需替换级响应式，避免深度代理开销
// （且 deep UnwrapRef 会把含索引签名的大对象类型变形，exactOptionalPropertyTypes 下传 prop 报错）
const mapOption = shallowRef<EChartsOption | null>(null)
const mapError = ref(false)

function loadMap(): void {
  mapError.value = false
  import('../config/china-map')
    .then((mod) => {
      mapOption.value = mod.chinaMapOption
    })
    .catch(() => {
      mapError.value = true
    })
}

onMounted(loadMap)

// ─── 面板交互状态（内联控件：不使用 teleport 弹层组件）────────
const activeDimension = ref<(typeof WIDE_DIMENSIONS)[number]>('按大区')

// 告警等级 → 类名后缀映射：WIDE_ALARMS 的 level 是中文（显示文本），
// CSS 类名须保持英文 kebab-case（中文类名不利于检索/协作，且无 BEM 英文惯例一致性）
const ALARM_LEVEL_CLASS: Record<string, string> = { 高: 'high', 中: 'mid', 低: 'low' }
</script>

<template>
  <div :class="bem.b()">
    <header :class="bem.e('header')">
      <h1 :class="bem.e('title')">全国运营指挥中心 · 拼接大屏</h1>
      <p :class="bem.e('clock')">{{ clock }}</p>
    </header>

    <main :class="bem.e('main')">
      <!-- 左操作面板 -->
      <aside :class="bem.e('side')">
        <PanelBox title="核心指标" :class="bem.e('block')">
          <dl :class="bem.e('metrics')">
            <div v-for="m in WIDE_METRIC_GROUPS" :key="m.label" :class="bem.e('metric')">
              <dt>{{ m.label }}</dt>
              <dd>{{ m.value }}</dd>
            </div>
          </dl>
        </PanelBox>
        <PanelBox title="区域排行" :class="[bem.e('block'), bem.em('block', 'grow')]">
          <ol :class="bem.e('ranks')">
            <li v-for="(r, i) in REGION_RANK" :key="r.name" :class="bem.e('rank')">
              <span :class="bem.e('rank-no')">{{ i + 1 }}</span>
              <span :class="bem.e('rank-name')">{{ r.name }}</span>
              <span :class="bem.e('rank-value')">{{ r.value.toLocaleString() }}</span>
            </li>
          </ol>
        </PanelBox>
        <PanelBox title="联动开关" :class="bem.e('block')">
          <SwitchGroup />
        </PanelBox>
      </aside>

      <!-- 中间地图（二级懒加载：壳先渲染，加载/失败态就地呈现） -->
      <section :class="bem.e('map')">
        <BigChart v-if="mapOption" :option="mapOption" />
        <div v-else-if="mapError" :class="bem.e('map-fallback')">
          <p :class="bem.e('map-fallback-text')">地图数据加载失败</p>
          <button type="button" :class="bem.e('map-retry')" @click="loadMap">重试</button>
        </div>
        <div v-else :class="bem.e('map-loading')">地图加载中…</div>
      </section>

      <!-- 右操作面板 -->
      <aside :class="bem.e('side')">
        <PanelBox title="分析维度" :class="bem.e('block')">
          <div :class="bem.e('dimensions')">
            <button
              v-for="d in WIDE_DIMENSIONS"
              :key="d"
              type="button"
              :class="[
                bem.e('dimension'),
                activeDimension === d ? bem.em('dimension', 'active') : '',
              ]"
              @click="activeDimension = d"
            >
              {{ d }}
            </button>
          </div>
        </PanelBox>
        <PanelBox title="实时告警" :class="[bem.e('block'), bem.em('block', 'grow')]">
          <ul :class="bem.e('alarms')">
            <li v-for="a in WIDE_ALARMS" :key="a.time + a.text">
              <span
                :class="[
                  bem.e('alarm-level'),
                  bem.em('alarm-level', ALARM_LEVEL_CLASS[a.level] ?? 'low'),
                ]"
              >
                {{ a.level }}
              </span>
              <span :class="bem.e('alarm-text')">{{ a.text }}</span>
              <span :class="bem.e('alarm-time')">{{ a.time }}</span>
            </li>
          </ul>
        </PanelBox>
      </aside>
    </main>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-big-demo-wide {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 9000px;
  height: 1080px;
  padding: 0 100px 60px;
  color: var(--big-text);
  background:
    radial-gradient(ellipse 4000px 600px at 50% -10%, rgba(var(--big-blue-rgb), 0.3), transparent),
    var(--big-bg-page);

  &__header {
    position: relative;
    flex: none;
    height: 100px;
    padding-top: 22px;
    text-align: center;
  }

  &__title {
    margin: 0;
    font-size: 56px;
    font-weight: 700;
    letter-spacing: 16px;
    background: linear-gradient(180deg, var(--big-title-from), var(--big-title-to));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &__clock {
    position: absolute;
    top: 40px;
    right: 0;
    margin: 0;
    font-size: 30px;
    color: var(--big-text-3);
    font-variant-numeric: tabular-nums;
  }

  // 9000 稿尺度覆盖（非 scoped 穿透用后代选择器，§3.2 #10）：
  // PanelBox 标题 18px 是 1920 稿尺度，本页正文 22~30px——不放大则标题比正文小、层级倒挂
  .#{$BEM_PREFIX}-panel-box__header {
    padding-bottom: 20px;
    font-size: 30px;
  }

  &__main {
    display: flex;
    flex: 1;
    gap: 100px;
    min-height: 0;
  }

  &__side {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 32px;
    width: 1800px;
  }

  &__block {
    // 内容自适应高度：均分（flex:1）会让内容少的面板被拉伸、内容多的溢出；
    // 剩余空间由 --grow 面板（区域排行/实时告警）吸收
    flex: none;

    &--grow {
      flex: 1;
      min-height: 0;
    }
  }

  &__map {
    flex: 1;
    min-width: 0;
  }

  &__map-loading,
  &__map-fallback {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 24px;
    color: var(--big-text-3);
    background: var(--big-mask-light);
    border: 1px dashed rgba(var(--big-blue-mid-rgb), 0.25);
    border-radius: 12px;
  }

  &__map-fallback-text {
    margin: 0;
    color: var(--el-color-danger);
  }

  &__map-retry {
    padding: 8px 32px;
    font-size: 20px;
    color: var(--el-color-white);
    cursor: pointer;
    background: rgba(var(--big-blue-light-rgb), 0.3);
    border: 1px solid var(--big-primary);
    border-radius: 6px;

    &:hover {
      background: rgba(var(--big-blue-light-rgb), 0.5);
    }
  }

  &__metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin: 0;
  }

  &__metric {
    dt {
      font-size: 20px;
      color: var(--big-text-2);
    }

    dd {
      margin: 4px 0 0;
      font-size: 32px;
      font-weight: 700;
      color: var(--big-primary);
      font-variant-numeric: tabular-nums;
    }
  }

  &__ranks {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  &__rank {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 6px 0;
    font-size: 22px;
  }

  &__rank-no {
    flex: none;
    width: 32px;
    height: 32px;
    font-size: 18px;
    line-height: 32px;
    text-align: center;
    color: var(--big-text-deep);
    background: var(--big-rank-active);
    border-radius: 8px;
  }

  &__rank-name {
    flex: 1;
    color: var(--big-text);
  }

  &__rank-value {
    flex: none;
    color: var(--big-text-2);
    font-variant-numeric: tabular-nums;
  }

  &__dimensions {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__dimension {
    padding: 10px 24px;
    font-size: 22px;
    color: var(--big-text);
    cursor: pointer;
    background: rgba(var(--big-blue-rgb), 0.12);
    border: 1px solid rgba(var(--big-blue-mid-rgb), 0.35);
    border-radius: 8px;

    &--active {
      color: var(--el-color-white);
      background: rgba(var(--big-blue-light-rgb), 0.35);
      border-color: var(--big-primary);
    }
  }

  &__alarms {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      font-size: 24px;
      border-bottom: 1px dashed var(--big-divider);
    }
  }

  &__alarm-level {
    flex: none;
    padding: 4px 14px;
    font-size: 22px;
    border-radius: 6px;

    &--high {
      color: var(--el-color-white);
      background: var(--big-state-danger);
    }

    &--mid {
      color: var(--big-text-deep);
      background: var(--big-state-warning);
    }

    &--low {
      color: var(--big-text-deep);
      background: var(--big-state-info);
    }
  }

  &__alarm-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__alarm-time {
    flex: none;
    color: var(--big-text-3);
    font-variant-numeric: tabular-nums;
  }
}
</style>
