<script setup lang="ts">
/**
 * requestStream（SSE 流式请求）演示页。
 *
 * 数据源：packages/mock/src/stream.ts 的 SSE mock（/mock/ai/chat/stream）——
 * rawResponse 挂起式逐 chunk 推送（dev-only，gh-pages 的 mockjs 不拦 fetch，演示降级）。
 *
 * 演示点：
 * 1. 发起流式请求 → onMessage 逐 chunk 累积渲染（打字机效果）
 * 2. handle.cancel() 主动终止（停止生成按钮）→ onMessage 不再触发
 * 3. onError 容错（单行脏数据不断流；连接失败可重试）
 * 4. 组件卸载自动 cancel（路由切走不泄漏连接）
 *
 * requestStream 不在 AutoImport 注入清单（CLAUDE.md §1.6 仅注入 4 个高频 composable），
 * 须显式 import；api 层运行时导出走 `@api/*` 别名（shared barrel 刻意不聚合 ./api，
 * 头注：http.ts 模块加载即建 axios 实例——同约定，见 CLAUDE.md §1.6.2 既定例外）。
 */
import { requestStream, type StreamHandle } from '@api/stream'
import DemoFrame from '../components/DemoFrame.vue'

const bem = createNamespace('demo-stream-request')

/** SSE 消息体契约（与 packages/mock/src/stream.ts 推送的 JSON 同构） */
interface ChatChunk {
  content: string
}

const prompt = ref('介绍一下你们的数据平台')
const output = ref('')
const streaming = ref(false)
const errorMsg = ref('')

/** 当前流句柄：cancel 用；组件卸载兜底取消 */
let handle: StreamHandle | null = null

function send(): void {
  const text = prompt.value.trim()
  if (!text || streaming.value) return
  output.value = ''
  errorMsg.value = ''
  streaming.value = true
  handle = requestStream<ChatChunk>({
    // url 不带前缀：与 axios 业务请求同约定（http.ts baseURL 统一注入——mock 模式
    // VITE_API_BASE_URL=/mock，viteMockServe 的 mock 路由注册在 /mock/* 下）——stream.ts
    // 内部拼 `${VITE_API_BASE_URL}${url}`，多写前缀会成 /mock/mock/... 404（2026-10-26 实测踩坑）
    url: '/ai/chat/stream',
    method: 'POST',
    body: { prompt: text },
    format: 'sse',
    onMessage: (chunk) => {
      output.value += chunk.content
    },
    onError: (err) => {
      // 单行解析失败也会触发（流不中断）；连接级错误时 done 随后 resolve
      errorMsg.value = err instanceof Error ? err.message : String(err)
    },
  })
  // done 永远 resolve（错误走 onError 双通道，不 reject）——统一在 done 复位 streaming
  void handle.done.then(() => {
    streaming.value = false
    handle = null
  })
}

function stop(): void {
  handle?.cancel()
}

// 组件卸载：取消未完结的流（ AbortController 联动，防路由切走后连接悬挂 ）
onUnmounted(() => {
  handle?.cancel()
})
</script>

<template>
  <DemoFrame
    title="requestStream · SSE 流式请求"
    source="packages/shared/src/api/stream.ts"
    :introductions="[
      '基于 fetch + ReadableStream 的流式请求（不走 axios）：POST /mock/ai/chat/stream 由 mock 挂起式逐 chunk 推送',
      '打字机效果 = onMessage 逐 chunk 累积；点「停止生成」调 handle.cancel() 立即终止（onMessage 不再触发）',
      '数据源 packages/mock/src/stream.ts：rawResponse 挂起 await 模拟 SSE（dev-only；gh-pages 的 mockjs 不拦 fetch，流演示不可用）',
    ]"
  >
    <div :class="bem.b()">
      <div :class="bem.e('input-row')">
        <el-input
          v-model="prompt"
          :class="bem.e('input')"
          placeholder="输入 prompt，回车或点发送发起流式请求"
          :disabled="streaming"
          @keyup.enter="send"
        />
        <el-button v-if="!streaming" type="primary" :disabled="!prompt.trim()" @click="send">
          发送
        </el-button>
        <el-button v-else type="danger" @click="stop">停止生成</el-button>
      </div>

      <div :class="[bem.e('output'), streaming && bem.m('streaming'), errorMsg && bem.m('error')]">
        <template v-if="output">
          <pre :class="bem.e('text')">{{ output }}</pre>
          <span v-if="streaming" :class="bem.e('cursor')" aria-hidden="true">▌</span>
        </template>
        <p v-else-if="streaming" :class="bem.e('placeholder')">等待首个 chunk…</p>
        <p v-else :class="bem.e('placeholder')">流式输出将在此累积渲染</p>
      </div>

      <div v-if="errorMsg" :class="bem.e('error-bar')">
        <span :class="bem.e('error-text')">{{ errorMsg }}</span>
        <el-button size="small" @click="send">重试</el-button>
      </div>
    </div>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-stream-request {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__input-row {
    display: flex;
    gap: 12px;
  }

  &__input {
    flex: 1;
  }

  &__output {
    min-height: 180px;
    padding: 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-fill-color-light);
    white-space: pre-wrap;

    &--streaming {
      border-color: var(--el-color-primary);
    }

    &--error {
      border-color: var(--el-color-danger);
    }
  }

  &__text {
    margin: 0;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.8;
    color: var(--el-text-color-primary);
    white-space: pre-wrap;
    word-break: break-word;
    display: inline;
  }

  &__cursor {
    color: var(--el-color-primary);
    animation: vv-demo-stream-request-blink 0.8s step-end infinite;
  }

  &__placeholder {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  &__error-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--el-color-danger-light-9);
  }

  &__error-text {
    flex: 1;
    color: var(--el-color-danger);
    font-size: 13px;
  }
}

@keyframes vv-demo-stream-request-blink {
  50% {
    opacity: 0;
  }
}
</style>
