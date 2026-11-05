<script setup lang="ts">
/**
 * withRetry（指数退避重试）演示页。
 *
 * 数据源：本地模拟请求工厂（可控失败序列），调用 @api/retry 的真实实现。
 *
 * 验证方法：
 * 1. 「网络抖动恢复」点执行：前 2 次失败、第 3 次成功，时间线展示每次 attempt 与真实退避间隔
 *    （baseDelay 200ms × backoff 2 → 间隔约 200ms / 400ms）。
 * 2. 「4xx vs 5xx 对照」分别点两个按钮：4xx 只 attempt 1 次（不重试），5xx attempt 3 次（重试至成功）。
 * 3. 「取消不重试」点执行：模拟 logout 的 canceled ApiError，attempt 1 次立即抛——不被退避延迟。
 */
import { withRetry, isIdempotent } from '@api/retry'
import { request } from '@api/http'
import { ApiError, isApiError } from '@api/types/error'
import ApiTable from '../components/ApiTable.vue'
import DemoField from '../components/DemoField.vue'
import DemoFrame from '../components/DemoFrame.vue'
import { useDocToc } from '../composables/useDocToc'
import { retryApiItems } from './api-demos-api'

const bem = createNamespace('demo-api-retry')

/** 仅 dev 有延迟瀑布；prod（mockjs 劫持）可演示但请求无延迟，计数/状态机正常 */
const isDev = import.meta.env.DEV

/** 每轮演示独立 nonce：mock 侧按 url 全串计数失败额度，换 nonce 即新一轮 */
function nonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 按业务码判定重试（对齐 withRetry 默认策略的分级语义）：
 * mock 层两形态错误码位置不同——dev（rawResponse 真 HTTP 状态）ApiError.code=HTTP status；
 * prod（mockjs 恒 HTTP 200）失败走业务码通道，ApiError 只有 code=body.code 无 status。
 * 以 code 判定使 dev / gh-pages 两环境演示行为一致。
 */
function demoShouldRetry(err: unknown): boolean {
  if (isApiError(err) && err.canceled) return false
  if (isApiError(err)) return err.code >= 500
  return true
}

const tocItems = [
  { id: 'demo-recover', label: '网络抖动恢复' },
  { id: 'demo-compare', label: '4xx vs 5xx 对照' },
  { id: 'demo-cancel', label: '取消不重试' },
  { id: 'api-retry', label: 'API 说明' },
]
useDocToc(tocItems)

interface AttemptEvent {
  attempt: number
  outcome: 'fail' | 'success'
  error?: string
  /** 距首次调用的真实毫秒（展示退避间隔） */
  at: number
}

// ── 演示 1：网络抖动恢复（mock 按 failTimes 前 2 次返 500，第 3 次成功） ──
const recoverRunning = ref(false)
const recoverLog = ref<AttemptEvent[]>([])

async function runRecover(): Promise<void> {
  if (recoverRunning.value) return
  recoverRunning.value = true
  recoverLog.value = []
  const startedAt = performance.now()
  const t = nonce()
  let call = 0
  try {
    await withRetry(
      async () => {
        call += 1
        const data = await request<string>({
          url: '/demo-net/retry',
          method: 'get',
          params: { failTimes: 2, status: 500, t },
          silent: true,
        })
        recoverLog.value.push({
          attempt: call,
          outcome: 'success',
          at: Math.round(performance.now() - startedAt),
        })
        return data
      },
      { retries: 2, baseDelay: 200, backoff: 2, shouldRetry: demoShouldRetry }
    )
  } catch (err) {
    recoverLog.value.push({
      attempt: call,
      outcome: 'fail',
      error: err instanceof Error ? err.message : String(err),
      at: Math.round(performance.now() - startedAt),
    })
  } finally {
    recoverRunning.value = false
  }
}

// 包装器：把每次 attempt 记入时间线（失败也记），供演示 2/3 复用
function loggingFn(log: Ref<AttemptEvent[]>, startedAt: number, impl: () => Promise<string>) {
  let attempt = 0
  return async (): Promise<string> => {
    attempt += 1
    try {
      const value = await impl()
      log.value.push({ attempt, outcome: 'success', at: Math.round(performance.now() - startedAt) })
      return value
    } catch (err) {
      log.value.push({
        attempt,
        outcome: 'fail',
        error: err instanceof Error ? err.message : String(err),
        at: Math.round(performance.now() - startedAt),
      })
      throw err
    }
  }
}

// ── 演示 2：4xx 不重试 vs 5xx 重试 ──
const compareRunning = ref<'4xx' | '5xx' | null>(null)
const compareLog = ref<AttemptEvent[]>([])

async function runCompare(kind: '4xx' | '5xx'): Promise<void> {
  if (compareRunning.value) return
  compareRunning.value = kind
  compareLog.value = []
  const startedAt = performance.now()
  const t = nonce()
  // mock 按 failTimes 先返指定状态码；status=400 → withRetry 不重试；500 → 重试后成功
  const impl = (): Promise<string> =>
    request<string>({
      url: '/demo-net/retry',
      method: 'get',
      params: { failTimes: 1, status: kind === '4xx' ? 400 : 500, t },
      silent: true,
    })
  try {
    await withRetry(loggingFn(compareLog, startedAt, impl), {
      retries: 2,
      baseDelay: 100,
      backoff: 2,
      shouldRetry: demoShouldRetry,
    })
  } catch {
    /* 4xx 路径必然抛：attempt 次数即演示点 */
  } finally {
    compareRunning.value = null
  }
}

// ── 演示 3：取消不重试（模拟 logout 的 canceled ApiError） ──
const cancelRunning = ref(false)
const cancelLog = ref<AttemptEvent[]>([])

async function runCancel(): Promise<void> {
  if (cancelRunning.value) return
  cancelRunning.value = true
  cancelLog.value = []
  const startedAt = performance.now()
  try {
    await withRetry(
      // 不经网络：演示点是重试策略对取消标记（canceled ApiError）的分支判定——
      // 对照上方真实请求演示，若取消被误重试会多出 3 次调用 + 700ms 退避延迟
      loggingFn(cancelLog, startedAt, async () => {
        throw new ApiError({ code: -1, message: 'The operation was aborted', canceled: true })
      }),
      { retries: 3, baseDelay: 100 }
    )
  } catch {
    /* 必然抛：演示点是 attempt=1（若被误重试会多 3 次 + 退避延迟 700ms） */
  } finally {
    cancelRunning.value = false
  }
}

// 幂等判定附录展示（GET 默认幂等 / POST 默认非幂等）
const idempotentCheck = computed(() => [
  { method: 'GET', result: isIdempotent('get') },
  { method: 'POST', result: isIdempotent('post') },
])
</script>

<template>
  <DemoFrame
    title="withRetry · 指数退避重试"
    source="packages/shared/src/api/retry.ts"
    :introductions="[
      '默认仅网络错误 / 5xx / 无 status 业务码重试；4xx 与主动取消（canceled）立即抛。',
      '退避公式：第 n 次重试延迟 = baseDelay × backoff^(n-1)，默认 300ms × 2。',
      '取消不重试的意义：logout / 组件卸载时不被退避 sleep 拖住约 1s。',
    ]"
  >
    <el-alert
      v-if="!isDev"
      type="info"
      :closable="false"
      title="生产模式（mockjs 劫持）：请求真实但无延迟瀑布，退避间隔/计数/状态机正常工作"
      :class="bem.e('env-alert')"
    />

    <section id="demo-recover" :class="bem.b()">
      <DemoField
        label="网络抖动恢复（前 2 次失败，第 3 次成功）"
        :code="`await withRetry(fetch, { retries: 2, baseDelay: 200, backoff: 2 })\n// 时间线 at 列：约 80 / 380 / 780ms（退避 200/400ms 生效）`"
      >
        <el-button type="primary" :disabled="recoverRunning" @click="runRecover">
          {{ recoverRunning ? '重试中…' : '执行（retries=2）' }}
        </el-button>
        <div v-if="recoverLog.length" :class="bem.e('timeline')">
          <div v-for="e in recoverLog" :key="e.attempt" :class="bem.e('event')">
            <el-tag :type="e.outcome === 'success' ? 'success' : 'danger'" size="small">
              attempt {{ e.attempt }} · {{ e.outcome }}
            </el-tag>
            <span :class="bem.e('at')">t+{{ e.at }}ms</span>
            <span v-if="e.error" :class="bem.e('err')">{{ e.error }}</span>
          </div>
        </div>
      </DemoField>
    </section>

    <section id="demo-compare" :class="bem.b()">
      <DemoField
        label="4xx 不重试 vs 5xx 重试"
        :code="`// 4xx：attempt 1 次即抛\n// 5xx：重试至成功（本例第 2 次成功）`"
      >
        <div :class="bem.e('controls')">
          <el-button
            type="danger"
            plain
            :disabled="compareRunning !== null"
            @click="runCompare('4xx')"
          >
            触发 400
          </el-button>
          <el-button
            type="warning"
            plain
            :disabled="compareRunning !== null"
            @click="runCompare('5xx')"
          >
            触发 500
          </el-button>
        </div>
        <div v-if="compareLog.length" :class="bem.e('timeline')">
          <div v-for="e in compareLog" :key="e.attempt" :class="bem.e('event')">
            <el-tag :type="e.outcome === 'success' ? 'success' : 'danger'" size="small">
              attempt {{ e.attempt }} · {{ e.outcome }}
            </el-tag>
            <span :class="bem.e('at')">t+{{ e.at }}ms</span>
            <span v-if="e.error" :class="bem.e('err')">{{ e.error }}</span>
          </div>
          <p :class="bem.e('summary')">
            共 attempt {{ compareLog.length }} 次（400 应为 1 次；500 应为 2 次）
          </p>
        </div>
      </DemoField>
    </section>

    <section id="demo-cancel" :class="bem.b()">
      <DemoField
        label="取消不重试（模拟 logout 场景）"
        :code="`new ApiError({ code: -1, message: 'aborted', canceled: true })\n// withRetry 默认策略：canceled → 立即抛，attempt 仅 1 次`"
      >
        <el-button type="info" :disabled="cancelRunning" @click="runCancel">
          {{ cancelRunning ? '执行中…' : '执行（retries=3）' }}
        </el-button>
        <div v-if="cancelLog.length" :class="bem.e('timeline')">
          <div v-for="e in cancelLog" :key="e.attempt" :class="bem.e('event')">
            <el-tag :type="e.outcome === 'success' ? 'success' : 'danger'" size="small">
              attempt {{ e.attempt }} · {{ e.outcome }}
            </el-tag>
            <span :class="bem.e('at')">t+{{ e.at }}ms</span>
          </div>
          <p :class="bem.e('summary')">
            attempt 共 {{ cancelLog.length }} 次且间隔 &lt;100ms——未被退避 sleep 拖住
          </p>
        </div>
      </DemoField>
    </section>

    <div :class="bem.e('idempotent')">
      <span :class="bem.e('idempotent-label')">幂等判定（isIdempotent）：</span>
      <template v-for="c in idempotentCheck" :key="c.method">
        <el-tag :type="c.result ? 'success' : 'info'" size="small" :class="bem.e('idempotent-tag')">
          {{ c.method }} → {{ c.result ? '幂等' : '非幂等' }}
        </el-tag>
      </template>
    </div>

    <ApiTable title="withRetry API" :items="retryApiItems" anchor="api-retry" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-api-retry {
  &__env-alert {
    margin-bottom: 16px;
  }

  &__controls {
    display: flex;
    gap: 12px;
  }

  &__timeline {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__event {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  &__at {
    color: var(--el-text-color-secondary);
    font-variant-numeric: tabular-nums;
  }

  &__err {
    color: var(--el-color-danger);
  }

  &__summary {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  &__idempotent {
    margin: 16px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__idempotent-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>
