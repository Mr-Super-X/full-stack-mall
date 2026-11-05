<script setup lang="ts">
/**
 * AsyncState 用法演示 + API 文档（半自动版）
 *
 * - name / type / required → 走 extractApi 自动从源码提取
 * - description → 手写字典（TS 类型里没 doc，强行自动会"乱猜"）
 */
import asyncStateSource from '@vv/ui/components/common/AsyncState.vue?raw'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import ApiTable from '../components/ApiTable.vue'
import { useDocToc } from '../composables/useDocToc'
import { extractApi, type ApiItem, type SlotItem } from '../utils/extractApi'

const bem = createNamespace('demo-async-state')

type Mode = 'data' | 'loading' | 'error' | 'empty'

const mode = ref<Mode>('data')
const retryCount = ref(0)

const state = computed(() => {
  switch (mode.value) {
    case 'loading':
      return { loading: true, error: null, isEmpty: false }
    case 'error':
      return { loading: false, error: new Error('获取数据失败（模拟）'), isEmpty: false }
    case 'empty':
      return { loading: false, error: null, isEmpty: true }
    default:
      return { loading: false, error: null, isEmpty: false }
  }
})

function onRetry() {
  retryCount.value++
  mode.value = 'data'
}

// —— API 自动提取 + description 字典 merge ——
const api = extractApi(asyncStateSource)

const propDescriptions: Record<string, string> = {
  loading: '加载状态。true 时显示 loading 槽位内容或 Skeleton。',
  error: '错误对象。truthy 时显示 error 槽位降级 UI（带重试按钮）。',
  isEmpty: '空数据状态。true 时显示 empty 槽位内容或 el-empty。',
}

const eventDescriptions: Record<string, string> = {
  retry: '点击 error 状态下的"重试"按钮时触发。父组件可重新发起数据请求。',
}

const slotDescriptions: Record<string, string> = {
  default: '正常内容。loading/error/isEmpty 都为 false 时渲染。',
  loading: '自定义 loading UI（不传则用 el-skeleton 占位）。',
  error: '自定义 error UI（作用域插槽，可访问 error 和 retry 函数）。',
  empty: '自定义 empty UI（不传则用 el-empty）。',
}

function merge<T extends { name: string }>(
  items: T[],
  descMap: Record<string, string>
): (T & { description: string })[] {
  return items.map((it) => ({ ...it, description: descMap[it.name] ?? '—' }))
}

const propsItems = merge<ApiItem>(api.props, propDescriptions)
const eventsItems = merge<ApiItem>(api.events, eventDescriptions)
const slotsItems = merge<SlotItem & { type: string; default: string; required: boolean }>(
  api.slots.map((s) => ({
    ...s,
    type: s.scoped ? '作用域插槽' : '—',
    default: '—',
    required: false,
  })),
  slotDescriptions
)

const tocItems = [
  { id: 'demo-basic', label: '基础用法' },
  { id: 'api-props', label: 'Props' },
  { id: 'api-events', label: 'Events' },
  { id: 'api-slots', label: 'Slots' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="AsyncState 异步三态"
    source="src/components/common/AsyncState.vue"
    :introductions="[
      '通用异步三态组件，根据 loading / error / isEmpty 三个 props 自动渲染对应 UI。',
      'loading / error / empty 三种状态都支持插槽覆盖（slot 名同名），error 插槽可拿到 error 对象和 retry 函数。',
      '点击下方切换按钮模拟不同状态，error 状态点【重试】会触发 retry 事件。',
    ]"
  >
    <section id="demo-basic">
      <DemoField :code="asyncStateSource" label="被演示组件源码（AsyncState.vue）">
        <div :class="bem.e('controls')">
          <span>模拟状态：</span>
          <el-radio-group v-model="mode" size="small">
            <el-radio-button value="data">data</el-radio-button>
            <el-radio-button value="loading">loading</el-radio-button>
            <el-radio-button value="error">error</el-radio-button>
            <el-radio-button value="empty">empty</el-radio-button>
          </el-radio-group>
          <span :class="bem.e('retry')">已重试 {{ retryCount }} 次</span>
        </div>

        <AsyncState
          :loading="state.loading"
          :error="state.error"
          :is-empty="state.isEmpty"
          @retry="onRetry"
        >
          <ul :class="bem.e('data')">
            <li v-for="i in 3" :key="i">数据项 {{ i }}</li>
          </ul>

          <template #error="{ error, retry }">
            <el-result icon="error" :title="error.message">
              <template #extra>
                <el-button type="primary" @click="retry()">自定义重试</el-button>
              </template>
            </el-result>
          </template>
        </AsyncState>
      </DemoField>
    </section>

    <ApiTable title="Props" :items="propsItems" anchor="api-props" />
    <ApiTable title="Events" :items="eventsItems" anchor="api-events" />
    <ApiTable title="Slots" :items="slotsItems" anchor="api-slots" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-async-state {
  &__controls {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  &__retry {
    margin-left: auto;
    color: #999;
    font-size: 12px;
  }

  &__data {
    margin: 0;
    padding: 0 0 0 20px;
    line-height: 2;
  }
}
</style>
