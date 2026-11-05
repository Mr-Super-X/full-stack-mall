<script setup lang="ts">
/**
 * ErrorBoundary 用法演示 + API 文档（半自动版）
 *
 * 关键设计：BoomChild 用 props.shouldThrow 控制抛错（不闭包 ref），
 * ErrorBoundary 的 "恢复" 按钮 emit('reset')，demo 父组件同步清 shouldThrow。
 */
import errorBoundarySource from '@vv/ui/components/common/ErrorBoundary.vue?raw'
import DemoFrame from '../components/DemoFrame.vue'
import DemoField from '../components/DemoField.vue'
import ApiTable from '../components/ApiTable.vue'
import { useDocToc } from '../composables/useDocToc'
import { extractApi } from '../utils/extractApi'

const bem = createNamespace('demo-error-boundary')

// 父组件的 ref 故意不与 BoomChild 的 prop 同名（避免 ESLint
// vue/no-mutating-props 把 ref 误判为 prop 赋值）。
const errorTrigger = ref(false)

const BoomChild = defineComponent({
  props: {
    shouldThrow: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      if (props.shouldThrow) {
        throw new Error('子组件渲染时故意抛错（演示用）')
      }
      return h('p', { class: bem.e('ok') }, '✅ 子组件正常渲染')
    }
  },
})

// —— API 自动提取 + description 字典 merge ——
const api = extractApi(errorBoundarySource)

const eventDescriptions: Record<string, string> = {
  reset:
    '点击降级 UI 中的"恢复"按钮时触发。父组件可同步清理触发错误的开关（如 props.shouldThrow）。',
}

const slotDescriptions: Record<string, string> = {
  default: '包裹的业务组件。无错误时正常渲染；抛错时整个 slot 被降级 UI 替换。',
}

// ErrorBoundary 没有 props，ApiTable 不渲染该表
const eventItems = api.events.map((e) => ({
  ...e,
  description: eventDescriptions[e.name] ?? '—',
}))
const slotItems = api.slots.map((s) => ({
  ...s,
  type: s.scoped ? '作用域插槽' : '—',
  default: '—',
  required: false,
  description: slotDescriptions[s.name] ?? '—',
}))

const tocItems = [
  { id: 'demo-basic', label: '基础用法' },
  { id: 'api-events', label: 'Events' },
  { id: 'api-slots', label: 'Slots' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ErrorBoundary 错误边界"
    source="src/components/common/ErrorBoundary.vue"
    :introductions="[
      '基于 onErrorCaptured 实现的错误边界。',
      '包裹业务组件后，子组件渲染抛错时不会白屏，而是显示降级 UI + 恢复按钮。',
      '恢复按钮会 emit(reset) 事件，demo 父组件同步清掉触发开关，BoomChild 重新挂载后正常显示。',
    ]"
  >
    <section id="demo-basic">
      <DemoField :code="errorBoundarySource" label="被演示组件源码（ErrorBoundary.vue）">
        <div :class="bem.e('controls')">
          <el-button type="danger" :disabled="errorTrigger" @click="errorTrigger = true">
            触发子组件错误
          </el-button>
        </div>

        <ErrorBoundary @reset="errorTrigger = false">
          <BoomChild :should-throw="errorTrigger" />
        </ErrorBoundary>
      </DemoField>
    </section>

    <ApiTable title="Events" :items="eventItems" anchor="api-events" />
    <ApiTable title="Slots" :items="slotItems" anchor="api-slots" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-error-boundary {
  &__controls {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__ok {
    margin: 0;
    color: #67c23a;
    font-size: 14px;
  }
}
</style>
