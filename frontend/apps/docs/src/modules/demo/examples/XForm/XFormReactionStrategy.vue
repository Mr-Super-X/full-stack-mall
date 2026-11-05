<script setup lang="ts">
/**
 * XFormReactionStrategy —— 对比演示 reaction.strategy 三种调度策略
 *
 * 三种策略对比（ReactionConfig.strategy + delay）：
 *   ① sync（默认）：依赖变化立即同步执行 —— 连续输入 N 字符 → reaction 跑 N 次
 *   ② debounce(delay)：依赖停止变化 delay ms 后执行一次 —— 连续输入 N 字符 → reaction 跑 1 次
 *   ③ throttle(delay)：delay ms 内最多执行一次 —— 连续输入 N 字符 → reaction 跑 ~N/(delay ms) 次
 *
 * 演示方式：三个独立 Input 字段共享 model，每次 reaction 被调度时通过 hidden 函数
 * 作为副作用入口（返回 false 不参与显隐联动，仅用于计数器 +1）。
 * 计数器必须写到 model 外部 ref —— 写到 model 内会被 deep watch 监听自身写入造成死循环
 * （参考 XFormReaction.vue 的 searchCallCount 写法）。
 *
 * 实现要点（use-reaction.ts）：
 *   - reactionConfig 必须含「动态值」才会进入 watch 路径（第 106 行 hasDynamic 判定）
 *   - 含函数值 → 注册 watch(source, runner)，按 strategy 选 debounce / throttle / 同步包装
 *   - strategy 默认 'sync'；debounce/throttle 仅在 delay > 0 时生效
 */
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'
import { reactionStrategyItems } from './configs/xform-demos-api'

const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'reaction-strategy',
  schema: () => schema,
})

// 触发计数器 —— 写到 model 外部 ref，避免被 reaction 的 deep watch 监听自写造成死循环
const syncCount = ref(0)
const debounceCount = ref(0)
const throttleCount = ref(0)

const schema: SchemaNode = {
  column: 1,
  children: [
    {
      component: 'Card',
      props: { header: 'sync（默认）—— 依赖变化立即同步执行' },
      column: 1,
      children: [
        {
          component: 'Input',
          name: 'inputSync',
          label: 'sync 输入',
          props: { placeholder: '连续输入字符观察触发次数', clearable: true },
          reaction: {
            // hidden 函数作为副作用入口：每次 reaction 被调度时 +1，返回 false 让字段始终显示
            // （reaction 函数体可写 model 或外部 ref，本例写外部 ref）
            hidden: () => {
              syncCount.value++
              return false
            },
            strategy: 'sync',
            deps: ['inputSync'],
          },
        },
      ],
    },
    {
      component: 'Card',
      props: { header: 'debounce 300ms —— 停止变化 300ms 后执行一次' },
      column: 1,
      children: [
        {
          component: 'Input',
          name: 'inputDebounce',
          label: 'debounce 300ms 输入',
          props: { placeholder: '连续输入字符观察触发次数', clearable: true },
          reaction: {
            hidden: () => {
              debounceCount.value++
              return false
            },
            strategy: 'debounce',
            delay: 300,
            deps: ['inputDebounce'],
          },
        },
      ],
    },
    {
      component: 'Card',
      props: { header: 'throttle 300ms —— 300ms 内最多执行一次' },
      column: 1,
      children: [
        {
          component: 'Input',
          name: 'inputThrottle',
          label: 'throttle 300ms 输入',
          props: { placeholder: '连续输入字符观察触发次数', clearable: true },
          reaction: {
            hidden: () => {
              throttleCount.value++
              return false
            },
            strategy: 'throttle',
            delay: 300,
            deps: ['inputThrottle'],
          },
        },
      ],
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  inputSync: '',
  inputDebounce: '',
  inputThrottle: '',
})

/** 同步重置三个计数 + 调用 formRef.resetFields 清空输入框 */
function resetAll(): void {
  syncCount.value = 0
  debounceCount.value = 0
  throttleCount.value = 0
  formRef.value?.resetFields()
}

const syncCode = `{
  component: 'Input',
  name: 'inputSync',
  reaction: {
    hidden: () => {
      syncCount.value++   // 副作用入口：每次被调度 +1
      return false        // 不参与显隐联动
    },
    strategy: 'sync',     // 默认值；可省略
    deps: ['inputSync'],  // 精确监听避免无关字段触发
  },
}`

const debounceCode = `{
  component: 'Input',
  name: 'inputDebounce',
  reaction: {
    hidden: () => {
      debounceCount.value++
      return false
    },
    strategy: 'debounce', // 依赖停止变化 delay ms 后执行一次
    delay: 300,
    deps: ['inputDebounce'],
  },
}`

const throttleCode = `{
  component: 'Input',
  name: 'inputThrottle',
  reaction: {
    hidden: () => {
      throttleCount.value++
      return false
    },
    strategy: 'throttle', // delay ms 内最多执行一次
    delay: 300,
    deps: ['inputThrottle'],
  },
}`

/** strategy 三策略对比 —— 完整 schema（含 3 个 Card 段） */
const strategyCode = `{
  column: 1,
  children: [
    {
      component: 'Card',
      props: { header: 'sync（默认）—— 依赖变化立即执行' },
      children: [{ component: 'Input', name: 'inputSync', reaction: { /* sync */ } }],
    },
    {
      component: 'Card',
      props: { header: 'debounce 300ms —— 停止变化后执行一次' },
      children: [{ component: 'Input', name: 'inputDebounce', reaction: { /* debounce */ } }],
    },
    {
      component: 'Card',
      props: { header: 'throttle 300ms —— 300ms 内最多执行一次' },
      children: [{ component: 'Input', name: 'inputThrottle', reaction: { /* throttle */ } }],
    },
  ],
}`

/** 三策略写法合并 —— 用 `---` 分隔，单个 DemoField 展示 */
const strategyCodeCombined = `// ① sync 策略（默认）—— 依赖变化立即同步执行
${syncCode}

// ② debounce 300ms 策略 —— 依赖停止变化后执行一次
${debounceCode}

// ③ throttle 300ms 策略 —— 300ms 内最多执行一次
${throttleCode}`

const tocItems = [
  { id: 'demo-strategy', label: '三策略对比' },
  { id: 'api-reaction-strategy', label: 'reaction.strategy 速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="reaction.strategy 三种调度策略对比"
    source="src/components/form-schema/composables/use-reaction.ts"
    :introductions="[
      'ReactionConfig 的 strategy 字段决定 reaction 函数的调度时机，本 demo 对比三种策略的行为差异：',
      '① sync（默认）：依赖变化立即同步执行 —— 连续输入 5 字符 → reaction 跑 5 次',
      '② debounce(300ms)：依赖停止变化 300ms 后执行一次 —— 连续输入 5 字符 → reaction 跑 1 次',
      '③ throttle(300ms)：300ms 内最多执行一次 —— 连续输入 5 字符 → reaction 跑 1~2 次',
      '计数器必须写到 model 外部 ref —— 写到 model 内会被 deep watch 监听自身写入造成死循环',
      '三个 DemoField 区块分别展示 sync / debounce / throttle 三种写法',
    ]"
  >
    <section id="demo-strategy">
      <DemoField label="strategy 三策略对比（sync / debounce / throttle）" :code="strategyCode">
        <div :class="bem.e('hint')">
          在三个输入框中连续输入字符（例如「abcdef」），观察下方的计数器差异： sync ≈
          字符数，debounce = 1，throttle ≈ 字符数 / (delay ms)
        </div>
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="resetAll">重置计数 + 表单</el-button>
          <el-button @click="onReset">仅重置表单</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('counters')">
          <div :class="bem.e('counter')">
            <strong>sync 触发次数：</strong>
            <span :class="bem.e('num')">{{ syncCount }}</span>
            <div :class="bem.e('tip')">每输入一字符立即 +1</div>
          </div>
          <div :class="bem.e('counter')">
            <strong>debounce 触发次数：</strong>
            <span :class="bem.e('num')">{{ debounceCount }}</span>
            <div :class="bem.e('tip')">连续输入 → 停止 300ms 后 +1</div>
          </div>
          <div :class="bem.e('counter')">
            <strong>throttle 触发次数：</strong>
            <span :class="bem.e('num')">{{ throttleCount }}</span>
            <div :class="bem.e('tip')">300ms 内最多 +1</div>
          </div>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <h3>三种 strategy 写法对比</h3>
    <DemoField label="sync / debounce / throttle 三种写法对比" :code="strategyCodeCombined" />
  </DemoFrame>

  <ApiTable
    title="reaction.strategy 调度策略"
    :items="reactionStrategyItems"
    anchor="api-reaction-strategy"
  />
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-reaction-strategy {
  &__hint {
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #fef9c3;
    border-radius: 4px;
    border-left: 4px solid #eab308;
    font-size: 13px;
    line-height: 1.7;
    color: #6b7280;
  }
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  &__counters {
    margin-top: 16px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }
  &__counter {
    padding: 12px 16px;
    background: #ecf5ff;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.7;

    strong {
      color: #409eff;
      margin-right: 4px;
    }
  }
  &__num {
    color: #f56c6c;
    font-weight: 600;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  &__tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }
}
</style>
