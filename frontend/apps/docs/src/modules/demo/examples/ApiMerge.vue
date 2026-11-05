<script setup lang="ts">
/**
 * withMerge（时间窗请求合并）演示页。
 *
 * 数据源：本地模拟请求工厂（计数 + 可控延迟），调用 @api/request-merger 的真实实现。
 *
 * 验证方法：
 * 1. 「窗口内连点合并」1 秒内连点 3 次：实际只发 1 次请求（计数=1），三个结果共享同一 Promise。
 * 2. 「窗口过后重新发起」等 300ms（超过 50ms 窗口）再点：计数 +1 = 2 次。
 * 3. 「key 归一化对照」：不同 Date 参数 → 不同 key 不合并；FormData 负载 → mergeKey 返回 null 退化为不合并。
 */
import { mergeKey, withMerge, _resetMerger } from '@api/request-merger'
import type { MergeableConfig } from '@api/request-merger'
import { request } from '@api/http'
import ApiTable from '../components/ApiTable.vue'
import DemoField from '../components/DemoField.vue'
import DemoFrame from '../components/DemoFrame.vue'
import { useDocToc } from '../composables/useDocToc'
import { mergeApiItems } from './api-demos-api'

const bem = createNamespace('demo-api-merge')

/** 仅 dev 可用：mock 接口（rawResponse 延迟）仅 viteMockServe 提供 */
const isDev = import.meta.env.DEV

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const tocItems = [
  { id: 'demo-window', label: '窗口内合并与重发' },
  { id: 'demo-key', label: 'key 归一化对照' },
  { id: 'api-merge', label: 'API 说明' },
]
useDocToc(tocItems)

// 每轮演示前清桶，避免上一轮残留影响计数
onUnmounted(() => _resetMerger())

// ── 演示 1/2：窗口内合并 + 窗口过后重发（服务端真实计数，Network 面板可查） ──
const windowLog = ref<string[]>([])

const mergedFetch = withMerge((config: MergeableConfig) =>
  request<{ count: number }>({ silent: true, ...config })
)

/** 归零服务端计数：裸 request 不合并；独立 nonce 防缓存 */
function resetServerCount(): Promise<{ count: number }> {
  return request({
    url: '/demo-net/merge',
    method: 'get',
    params: { reset: 1, t: nonce() },
    silent: true,
  })
}

async function burstClick(): Promise<void> {
  await resetServerCount()
  windowLog.value = ['连续触发 3 次同参请求…']
  const cfg: MergeableConfig = { url: '/demo-net/merge', method: 'get', params: { t: 'burst' } }
  const [r1, r2, r3] = await Promise.all([mergedFetch(cfg), mergedFetch(cfg), mergedFetch(cfg)])
  windowLog.value.push(
    `3 次结果共享同一响应（服务端 count 同源）：${r1.count} / ${r2.count} / ${r3.count}`
  )
  windowLog.value.push('实际请求 1 次——另 2 次在 withMerge 层共享 Promise，未到达服务端')
}

async function clickAfterWindow(): Promise<void> {
  windowLog.value.push('等待 300ms（超过 50ms 合并窗口）…')
  await sleep(300)
  // 同 key（同 params）但窗口已过 → 桶已清，重新发起真实请求
  const cfg: MergeableConfig = { url: '/demo-net/merge', method: 'get', params: { t: 'burst' } }
  const r = await mergedFetch(cfg)
  windowLog.value.push(`窗口过后重新发起：服务端 count=${r.count}（归零后累计）`)
}

// ── 演示 3：key 归一化对照 ──
const keyChecks = ref<Array<{ label: string; merged: boolean; detail: string }>>([])

function checkKeys(): void {
  const dateA = mergeKey({
    url: '/report',
    method: 'get',
    params: { start: new Date('2026-01-01') },
  })
  const dateB = mergeKey({
    url: '/report',
    method: 'get',
    params: { start: new Date('2026-06-01') },
  })
  const fd = new FormData()
  fd.append('file', new Blob(['x']))
  const formKey = mergeKey({ url: '/upload', method: 'post', data: fd })

  keyChecks.value = [
    {
      label: '不同 Date 参数',
      merged: dateA !== dateB,
      detail:
        dateA !== dateB ? 'key 不同 → 正确不合并（Date 按时间戳归一化）' : 'key 相同 → 错误合并！',
    },
    {
      label: 'FormData 负载',
      merged: formKey === null,
      detail:
        formKey === null ? 'mergeKey 返回 null → 退化为不合并' : `key=${formKey} → 有误合并风险！`,
    },
  ]
}
</script>

<template>
  <DemoFrame
    title="withMerge · 时间窗请求合并"
    source="packages/shared/src/api/request-merger.ts"
    :introductions="[
      '时间窗内同 key（method + url + params + data 归一化）请求共享同一 Promise，默认只对 GET/HEAD 生效。',
      '默认窗口 50ms 且从首个请求 settle 起算；窗口内失败结果同样被共享（缓存失败语义）。',
      '调用方自传的 AbortSignal 经 linkAbort 链接保留：任一中止都会中断底层请求。',
    ]"
  >
    <el-alert
      v-if="!isDev"
      type="info"
      :closable="false"
      title="生产模式（mockjs 劫持）：请求真实但无延迟瀑布，服务端计数/窗口合并去重正常工作"
      :class="bem.e('env-alert')"
    />

    <section id="demo-window" :class="bem.b()">
      <DemoField
        label="窗口内连点合并 + 窗口过后重新发起"
        :code="`const mergedFetch = withMerge(request)\n// 1 秒内并发 3 次同参 GET → 实际只发 1 次\nawait Promise.all([mergedFetch(cfg), mergedFetch(cfg), mergedFetch(cfg)])\n// 等 300ms（> 50ms 窗口）再发 → 重新发起，计数 +1`"
      >
        <div :class="bem.e('controls')">
          <el-button type="primary" @click="burstClick">连点合并（并发 3 次）</el-button>
          <el-button plain @click="clickAfterWindow">窗口过后再发</el-button>
        </div>
        <div v-if="windowLog.length" :class="bem.e('log')">
          <p v-for="(line, i) in windowLog" :key="i" :class="bem.e('log-line')">{{ line }}</p>
        </div>
      </DemoField>
    </section>

    <section id="demo-key" :class="bem.b()">
      <DemoField
        label="key 归一化对照（Date / FormData）"
        :code="`mergeKey({ params: { start: new Date('2026-01-01') } }) // ≠ 06-01 的 key\nmergeKey({ data: formData }) // → null（不可归一化 → 不合并）`"
      >
        <el-button type="primary" plain @click="checkKeys">执行对照</el-button>
        <div v-if="keyChecks.length" :class="bem.e('log')">
          <div v-for="c in keyChecks" :key="c.label" :class="bem.e('check-item')">
            <el-tag :type="c.merged ? 'success' : 'danger'" size="small">
              {{ c.label }}
            </el-tag>
            <span>{{ c.detail }}</span>
          </div>
        </div>
      </DemoField>
    </section>

    <ApiTable title="withMerge API" :items="mergeApiItems" anchor="api-merge" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-api-merge {
  &__env-alert {
    margin-bottom: 16px;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__log {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--el-fill-color-light);
  }

  &__log-line {
    margin: 4px 0;
    font-size: 13px;
    line-height: 1.6;
    word-break: break-all;
  }

  &__check-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0;
    font-size: 13px;
  }
}
</style>
