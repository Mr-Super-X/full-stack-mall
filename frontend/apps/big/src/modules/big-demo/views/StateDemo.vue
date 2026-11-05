<script setup lang="ts">
/**
 * big-demo 五态示范页：异步数据在大屏场景下的五种呈现形态。
 *
 * 为什么需要本页（/autoplan Phase 2 D-SC-1）：big-demo 是模板门面，此前五个示例页
 * 无任何状态示范——消费者照抄即得"裸奔页面"。中后台场景用公共 AsyncState（白底三态），
 * 大屏是深色写死 px 场景，五态形态在此集中示范：成功 / 加载中 / 错误 / 空 / 断连
 *（断连为 AsyncState 之外的扩展态：大屏常驻轮询/长连接中断必须显式提示，不能静默冻结）。
 *
 * 交互：切换器直达任一态；"重试 / 重新连接"按钮走「loading 800ms → success」
 * 模拟真实异步时序（setTimeout 在 onUnmounted 清理）。
 *
 * 设计稿 1920×1080（big layout 缺省尺寸，无需 meta.bigScreen）。
 */
const bem = createNamespace('big-demo-state')

type DemoState = 'success' | 'loading' | 'error' | 'empty' | 'offline'

const current = ref<DemoState>('success')

const STATE_LABELS: Record<DemoState, string> = {
  success: '成功',
  loading: '加载中',
  error: '错误',
  empty: '空数据',
  offline: '断连',
}

/** 重试 / 重连模拟真实时序：先回加载态，800ms 后成功 */
let recoverTimer: ReturnType<typeof setTimeout> | undefined
function simulateRecover(): void {
  clearTimeout(recoverTimer)
  current.value = 'loading'
  recoverTimer = setTimeout(() => {
    current.value = 'success'
  }, 800)
}

onUnmounted(() => clearTimeout(recoverTimer))

/** 每态的教学说明：该态何时出现 + 形态设计要点（消费者照抄时的心智依据） */
const STATE_NOTES: Record<DemoState, string> = {
  success: '数据就绪。右上角时间戳帮助现场人员判断数据新鲜度（大屏常驻页必备）。',
  loading: '请求中。骨架块与真实数据卡同尺寸同栅格，加载完成不跳动（防 CLS）。',
  error: '请求失败。保留数据区位置 + 就地重试，不把整屏打成错误页。',
  empty: '请求成功但无数据。形态必须与 loading 明显区分，避免被误读为"还在转"。',
  offline: '轮询 / 长连接中断。大屏常驻页需显式断连提示而非静默冻结在旧数据上。',
}

const kpis = [
  { label: '今日交易额', value: '1,284 万', unit: 'CNY' },
  { label: '订单总量', value: '8,416', unit: '单' },
  { label: '在线设备', value: '3,209', unit: '台' },
]
const updatedAt = '14:32:08'
</script>

<template>
  <div :class="bem.b()">
    <header :class="bem.e('header')">
      <h1 :class="bem.e('title')">异步数据五态示范</h1>
      <div :class="bem.e('switcher')" role="tablist" aria-label="状态切换">
        <button
          v-for="(label, key) in STATE_LABELS"
          :key="key"
          type="button"
          role="tab"
          :aria-selected="current === key"
          :class="[bem.e('tab'), current === key ? bem.em('tab', 'active') : '']"
          @click="current = key as DemoState"
        >
          {{ label }}
        </button>
      </div>
    </header>

    <main :class="bem.e('stage')">
      <!-- 成功：数据就绪 + 时间戳 -->
      <template v-if="current === 'success'">
        <div :class="bem.e('kpis')">
          <dl v-for="k in kpis" :key="k.label" :class="bem.e('kpi')">
            <dt>{{ k.label }}</dt>
            <dd>
              {{ k.value }}
              <small>{{ k.unit }}</small>
            </dd>
          </dl>
        </div>
        <p :class="bem.e('updated')">数据更新于 {{ updatedAt }}</p>
      </template>

      <!-- 加载中：同尺寸骨架块，防布局跳动 -->
      <div v-else-if="current === 'loading'" :class="bem.e('kpis')">
        <div v-for="i in 3" :key="i" :class="bem.e('skeleton')"></div>
      </div>

      <!-- 错误：就地重试 -->
      <div v-else-if="current === 'error'" :class="[bem.e('notice'), bem.em('notice', 'error')]">
        <p :class="bem.e('notice-title')">数据加载失败</p>
        <p :class="bem.e('notice-desc')">接口超时（GET /mock/big-demo/kpis）</p>
        <button type="button" :class="bem.e('notice-btn')" @click="simulateRecover">重试</button>
      </div>

      <!-- 空数据：与 loading 形态明确区分 -->
      <div v-else-if="current === 'empty'" :class="[bem.e('notice'), bem.em('notice', 'empty')]">
        <p :class="bem.e('notice-title')">暂无数据</p>
        <p :class="bem.e('notice-desc')">今日尚未产生交易记录</p>
      </div>

      <!-- 断连：长连接/轮询中断显式提示 -->
      <div v-else :class="[bem.e('notice'), bem.em('notice', 'offline')]">
        <p :class="bem.e('notice-title')">连接已断开</p>
        <p :class="bem.e('notice-desc')">实时数据流中断 12s · 展示最后一次快照</p>
        <button type="button" :class="bem.e('notice-btn')" @click="simulateRecover">
          重新连接
        </button>
      </div>
    </main>

    <footer :class="bem.e('note')">
      <strong>{{ STATE_LABELS[current] }}态 ——</strong>
      {{ STATE_NOTES[current] }}
    </footer>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-big-demo-state {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 1920px;
  height: 1080px;
  padding: 0 60px 40px;
  color: var(--big-text);
  background:
    radial-gradient(ellipse 1200px 500px at 50% -10%, rgba(var(--big-blue-rgb), 0.25), transparent),
    var(--big-bg-page);

  &__header {
    flex: none;
    padding-top: 24px;
    text-align: center;
  }

  &__title {
    margin: 0 0 20px;
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 6px;
    background: linear-gradient(180deg, var(--big-title-from), var(--big-title-to));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &__switcher {
    display: flex;
    gap: 16px;
    justify-content: center;
  }

  &__tab {
    padding: 8px 28px;
    font-size: 18px;
    color: var(--big-text-2);
    cursor: pointer;
    background: rgba(var(--big-blue-rgb), 0.1);
    border: 1px solid rgba(var(--big-blue-mid-rgb), 0.3);
    border-radius: 6px;

    &--active {
      color: var(--el-color-white);
      background: rgba(var(--big-blue-light-rgb), 0.35);
      border-color: var(--big-primary);
    }
  }

  &__stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    margin-top: 24px;
    padding: 40px;
    background: var(--big-mask);
    border: 1px solid rgba(var(--big-blue-mid-rgb), 0.18);
    border-radius: 12px;
  }

  &__kpis {
    display: grid;
    grid-template-columns: repeat(3, 420px);
    gap: 32px;
    width: 100%;
    justify-content: center;
  }

  &__kpi {
    margin: 0;
    padding: 32px;
    background: rgba(var(--big-blue-rgb), 0.08);
    border: 1px solid rgba(var(--big-blue-mid-rgb), 0.25);
    border-radius: 10px;

    dt {
      font-size: 20px;
      color: var(--big-text-2);
    }

    dd {
      margin: 12px 0 0;
      font-size: 44px;
      font-weight: 700;
      color: var(--big-primary);
      font-variant-numeric: tabular-nums;

      small {
        margin-left: 8px;
        font-size: 18px;
        font-weight: 400;
        color: var(--big-text-3);
      }
    }
  }

  // 骨架块与 KPI 卡同尺寸同栅格（420px 宽 × 同 padding），加载完成零跳动
  &__skeleton {
    height: 154px;
    background: linear-gradient(
      90deg,
      rgba(var(--big-blue-light-rgb), 0.06) 25%,
      rgba(var(--big-blue-light-rgb), 0.16) 50%,
      rgba(var(--big-blue-light-rgb), 0.06) 75%
    );
    background-size: 200% 100%;
    border: 1px solid rgba(var(--big-blue-mid-rgb), 0.15);
    border-radius: 10px;
    animation: vv-state-demo-shimmer 1.4s linear infinite;
  }

  &__updated {
    margin: 24px 0 0;
    font-size: 16px;
    color: var(--big-text-3);
    font-variant-numeric: tabular-nums;
  }

  &__notice {
    text-align: center;

    &-title {
      margin: 0;
      font-size: 32px;
      font-weight: 600;
    }

    &-desc {
      margin: 12px 0 24px;
      font-size: 18px;
      color: var(--big-text-2);
    }

    &-btn {
      padding: 10px 36px;
      font-size: 18px;
      color: var(--el-color-white);
      cursor: pointer;
      background: rgba(var(--big-blue-light-rgb), 0.3);
      border: 1px solid var(--big-primary);
      border-radius: 6px;

      &:hover {
        background: rgba(var(--big-blue-light-rgb), 0.5);
      }
    }

    // 错误态：红色系
    &--error &__notice-title {
      color: var(--el-color-danger);
    }

    // 断连态：黄色系，与错误态视觉区分（中断 ≠ 失败）
    &--offline &__notice-title {
      color: var(--big-medal-gold);
    }

    // 空态：中性灰蓝
    &--empty &__notice-title {
      color: var(--big-text-2);
    }
  }

  &__note {
    flex: none;
    margin-top: 24px;
    padding: 16px 24px;
    font-size: 17px;
    line-height: 1.7;
    color: var(--big-text-2);
    background: var(--big-mask-light);
    border-left: 3px solid var(--big-primary);
    border-radius: 0 8px 8px 0;

    strong {
      color: var(--big-text);
    }
  }
}

@keyframes vv-state-demo-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
