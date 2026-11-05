<script setup lang="ts">
/**
 * runConcurrent（并发请求调度器）演示页 —— 大文件分片上传场景。
 *
 * 数据源：本地模拟分片上传（可控延迟 + 失败注入），调用 @api/concurrent 的真实实现。
 *
 * 验证方法：
 * 1. 「并发分片上传」调 limit 滑块（1~6），点开始：分片格按 limit 个一批变蓝（running），
 *    完成变绿，进度条随 onProgress 推进；峰值并发数 = limit。
 * 2. 「失败不中断对照」点开始：第 5 个分片必失败（红），其余分片继续完成，
 *    结果面板显示 rejected 保因且索引保序。
 * 3. 「异构并行组合」点执行：三个不同耗时的模拟接口并行拉取，完成顺序乱但结果按输入顺序排列。
 * 4. 上传中点「取消」：闸门关闭，未领取分片不再启动，整体 reject。
 */
import { runConcurrent } from '@api/concurrent'
import type { ConcurrentTaskResult } from '@api/concurrent'
import { request } from '@api/http'
import ApiTable from '../components/ApiTable.vue'
import DemoField from '../components/DemoField.vue'
import DemoFrame from '../components/DemoFrame.vue'
import { useDocToc } from '../composables/useDocToc'
import { concurrentApiItems } from './api-demos-api'

const bem = createNamespace('demo-api-concurrent')

/** dev 走 viteMockServe 延迟接口（Network 瀑布）；prod（mockjs 劫持）无延迟但功能可用 */
const isDev = import.meta.env.DEV

/** 异构演示文案引用：与 packages/mock/src/net-tools.ts 的接口延迟对齐 */
const MERGE_LATENCY = 60
const RETRY_LATENCY = 80

const tocItems = [
  { id: 'demo-upload', label: '并发分片上传' },
  { id: 'demo-fail', label: '失败不中断对照' },
  { id: 'demo-hetero', label: '异构并行组合' },
  { id: 'api-concurrent', label: 'API 说明' },
]
useDocToc(tocItems)

// ── 演示 1/2：分片上传（failIndex >= 0 时注入该分片必失败） ──
const SHARD_COUNT = 12
interface ShardState {
  status: 'idle' | 'running' | 'done' | 'failed'
}
const limit = ref(3)
const uploading = ref(false)
const progress = ref(0)
const shards = ref<ShardState[]>([])
const lastError = ref('')
let activeCtrl: AbortController | null = null

function resetShards(): void {
  shards.value = Array.from({ length: SHARD_COUNT }, () => ({ status: 'idle' }))
  progress.value = 0
  lastError.value = ''
}

async function startUpload(failIndex = -1): Promise<void> {
  if (uploading.value) return
  resetShards()
  uploading.value = true
  const ctrl = new AbortController()
  activeCtrl = ctrl

  const items = Array.from({ length: SHARD_COUNT }, (_, i) => i)
  try {
    const results = await runConcurrent(items, uploadShard(failIndex), {
      limit: limit.value,
      signal: ctrl.signal,
      onProgress: (done, total) => {
        progress.value = Math.round((done / total) * 100)
      },
    })
    results.forEach((r, i) => {
      if (r.status === 'rejected') shards.value[i]!.status = 'failed'
    })
    if (failIndex >= 0) lastError.value = `分片 ${failIndex} 失败（模拟网络错误），其余分片正常完成`
  } catch {
    // 取消路径：末道闸门 reject，把仍在 running 的格子复位
    shards.value.forEach((s) => {
      if (s.status === 'running') s.status = 'idle'
    })
    lastError.value = '已取消：闸门关闭，未领取的分片不再启动'
  } finally {
    uploading.value = false
    activeCtrl = null
  }
}

/** 真实分片上传：POST /mock/demo-net/shard（300~700ms 随机延迟，Network 面板可见瀑布） */
function uploadShard(failIndex: number) {
  return async (index: number): Promise<number> => {
    shards.value[index]!.status = 'running'
    try {
      const data = await request<{ index: number }>({
        url: '/demo-net/shard',
        method: 'post',
        data: { index, fail: index === failIndex },
        // 静默：失败由 runConcurrent 记 rejected 并标注状态格，不经全局 toast
        silent: true,
      })
      shards.value[index]!.status = 'done'
      return data.index
    } catch {
      shards.value[index]!.status = 'failed'
      throw new Error(`分片 ${index} 网络错误`)
    }
  }
}

function cancelUpload(): void {
  activeCtrl?.abort()
}

// ── 演示 3：异构并行组合 ──
const heteroRunning = ref(false)
const heteroResults = ref<Array<ConcurrentTaskResult<string>>>([])

async function runHetero(): Promise<void> {
  if (heteroRunning.value) return
  heteroRunning.value = true
  heteroResults.value = []
  // 三个形态各异的真实请求：延迟天然不同（merge 60ms / retry 80ms / shard 300~700ms），
  // 完成顺序必乱（merge → retry → shard），结果按输入索引保序
  const thunks: ReadonlyArray<() => Promise<string>> = [
    () =>
      request<{ count: number }>({ url: '/demo-net/merge', method: 'get', silent: true }).then(
        (d) => `配置字典（${MERGE_LATENCY}ms 接口）count=${d.count}`
      ),
    () =>
      request<string>({
        url: '/demo-net/retry',
        method: 'get',
        params: { failTimes: 0 },
        silent: true,
      }).then((d) => `用户信息（${RETRY_LATENCY}ms 接口）${d}`),
    () =>
      request<{ index: number }>({
        url: '/demo-net/shard',
        method: 'post',
        data: { index: 99 },
        silent: true,
      }).then((d) => `订单统计（300~700ms 随机延迟接口）shard=${d.index}`),
  ]
  try {
    heteroResults.value = await runConcurrent(thunks, (t) => t(), { limit: 3 })
  } finally {
    heteroRunning.value = false
  }
}

resetShards()
</script>

<template>
  <DemoFrame
    title="runConcurrent · 并发请求调度"
    source="packages/shared/src/api/concurrent.ts"
    :introductions="[
      'worker-pool 并发闸门：任务按输入索引顺序启动，结果数组保序返回，limit 控制同时执行的请求数。',
      '典型场景是大文件分片上传：12 个分片 limit=3 时，始终最多 3 个分片在传。',
      '单分片失败不中断队列（记 rejected 保因），取消时关闭闸门——未领取的任务不再执行。',
    ]"
  >
    <el-alert
      v-if="!isDev"
      type="info"
      :closable="false"
      title="生产模式（mockjs 劫持）：请求真实但无延迟瀑布，分片状态/进度/取消/失败不中断正常工作"
      :class="bem.e('env-alert')"
    />

    <section id="demo-upload" :class="bem.b()">
      <DemoField
        label="并发分片上传（12 分片）"
        :code="`runConcurrent(chunks, (c) => upload(c), {\n  limit: 3,\n  onProgress: (done, total) => progress = done / total,\n})`"
      >
        <div :class="bem.e('controls')">
          <span :class="bem.e('limit-label')">limit = {{ limit }}</span>
          <el-slider
            v-model="limit"
            :min="1"
            :max="6"
            :disabled="uploading"
            :class="bem.e('slider')"
          />
          <el-button v-if="!uploading" type="primary" @click="startUpload()">开始上传</el-button>
          <el-button v-else type="danger" @click="cancelUpload">取消</el-button>
        </div>
        <el-progress :percentage="progress" :class="bem.e('progress')" />
        <div :class="bem.e('shards')">
          <div
            v-for="(s, i) in shards"
            :key="i"
            :class="[bem.e('shard'), bem.em('shard', s.status)]"
          >
            {{ i }}
          </div>
        </div>
        <p v-if="lastError" :class="bem.e('tip')">{{ lastError }}</p>
      </DemoField>
    </section>

    <section id="demo-fail" :class="bem.b()">
      <DemoField
        label="失败不中断对照（分片 5 必失败）"
        :code="`const results = await runConcurrent(chunks, upload) // 分片5抛错\nresults[5].status === 'rejected' // 保因\nresults.filter(rejected) // 仅分片5，其余 fulfilled`"
      >
        <el-button type="warning" :disabled="uploading" @click="startUpload(5)">
          开始（注入分片 5 失败）
        </el-button>
      </DemoField>
    </section>

    <section id="demo-hetero" :class="bem.b()">
      <DemoField
        label="异构并行组合（非分片场景）"
        :code="`const thunks = [fetchProfile, fetchDict, fetchStats]\nconst results = await runConcurrent(thunks, (t) => t(), { limit: 3 })`"
      >
        <el-button type="primary" plain :disabled="heteroRunning" @click="runHetero">
          {{ heteroRunning ? '并行拉取中…' : '并行拉取三个接口' }}
        </el-button>
        <div v-if="heteroResults.length" :class="bem.e('hetero-list')">
          <div v-for="r in heteroResults" :key="r.index" :class="bem.e('hetero-item')">
            <el-tag :type="r.status === 'fulfilled' ? 'success' : 'danger'" size="small">
              {{ r.status }}
            </el-tag>
            <span>{{ r.status === 'fulfilled' ? r.value : r.reason }}</span>
          </div>
        </div>
      </DemoField>
    </section>

    <ApiTable title="runConcurrent API" :items="concurrentApiItems" anchor="api-concurrent" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-api-concurrent {
  &__env-alert {
    margin-bottom: 16px;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  &__limit-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  &__slider {
    width: 200px;
  }

  &__progress {
    margin-top: 12px;
  }

  &__shards {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__shard {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 12px;
    background: var(--el-fill-color);
    color: var(--el-text-color-secondary);
    transition: background 0.2s;

    &--running {
      background: var(--el-color-primary-light-7);
      color: var(--el-color-primary);
    }

    &--done {
      background: var(--el-color-success-light-8);
      color: var(--el-color-success);
    }

    &--failed {
      background: var(--el-color-danger-light-8);
      color: var(--el-color-danger);
    }
  }

  &__tip {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--el-color-warning);
  }

  &__hetero-list {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__hetero-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
}
</style>
