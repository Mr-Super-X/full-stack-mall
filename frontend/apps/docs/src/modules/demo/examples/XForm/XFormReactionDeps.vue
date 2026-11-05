<script setup lang="ts">
/**
 * 演示 reaction.deps 的三个使用动机（与 XFormReactionAdvanced Section ① 区别：
 * Advanced 演示 deps 怎么用，本页演示 deps 为什么用）
 *
 * 三个动机对比：
 *   ① deps 切断无关字段触发：默认 deep watch 整棵 model → 任意字段变化都跑 reaction；
 *      声明 deps 后仅精确路径变化才触发，统计触发次数可见对比
 *   ② deps 切断循环联动：reaction 函数体修改自身依赖字段时，无 deps 会无限循环 →
 *      use-reaction 预算兜底 console.error；声明 deps 切断自触发
 *   ③ deps 路径声明（可读性）：同一段计算逻辑，无 deps 靠函数体内引用追踪（隐式），
 *      有 deps 显式列出依赖路径（推荐——重构安全 + 阅读一目了然）
 */
import { cloneDeep } from 'lodash-es'
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import { reactionDepsItems } from './configs/xform-demos-api'
import xFormSource from './XFormReactionDeps.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, copySchema, onReset } = useXFormDemo({
  name: 'reaction-deps',
  schema: () => schema.value,
})

const bem = createNamespace('demo-x-form-reaction-deps')

// 共享 model：perf / cycle / readability 三个命名空间，A/B 模式共用同一份数据
/** model 初始值快照 —— 切换 A/B 模式时还原，避免上次测试残留（runCount/loopCount 累计） */
const INITIAL_MODEL = {
  // ① 切断无关字段触发：与 perf.* 无关的「干扰字段」
  perf: { a: 1, b: 2, total: 0, runCount: 0 },
  distractor: { noise1: '', noise2: '', noise3: '' }, // 改动这些字段观察 reaction 是否被触发
  // ② 切断循环联动：reaction 函数内会自增 a
  cycle: { a: 0, result: 0, loopCount: 0 },
  // ③ 可读性：同一计算逻辑
  readable: { qty: 2, price: 50, sum: 0 },
}

const model = reactive(cloneDeep(INITIAL_MODEL))

/** 把 model 还原到初始快照 —— 顶层 Object.assign 触发响应式通知，让 UI 与 reaction watcher 同步感知 */
function resetModel(): void {
  Object.assign(model, cloneDeep(INITIAL_MODEL))
  // 顺手清 el-form 内部字段校验态（perf/cycle/readable 节点无 defaultValue，resetFields 不会动它们）
  formRef.value?.clearValidate()
}

// 全局开关：A 模式（无 deps）vs B 模式（写 deps）
const useDeps = ref(false)

// 切换 A/B 模式时自动重置 model，避免上次测试残留（runCount/loopCount 累计）
// flush: 'sync' —— 同步触发，让本次切换后的首次 setup sync runner 看到的是干净 model
watch(useDeps, resetModel)

// —— 反应式副作用函数（被 reaction._effect 调用；返回 undefined 让 isEqual 跳过写入） ——
// ① 总价 = a + b（无副作用，只是演示 deps 是否触发）
function recalcPerfTotal() {
  model.perf.total = model.perf.a + model.perf.b
  model.perf.runCount++
}
// ② 循环联动：reaction 内自增 a（无 deps 会无限触发；有 deps 切断自循环）
function cycleUpdate() {
  model.cycle.result = model.cycle.a * 2
  model.cycle.loopCount++
  // 无 deps 时这里再写 model.cycle.a 会触发自身 watch → 死循环
  // 有 deps 时即使写 a 也不会触发（deps 不含 result，但含 a?）
}
// ③ sum = qty * price
function recalcSum() {
  model.readable.sum = model.readable.qty * model.readable.price
}

/** schema computed：开关切换重计算 → XForm watch 重新注册 reaction（旧 stoppers 清理） */
const schema = computed<SchemaNode>(() => {
  const depKey = useDeps.value
  return {
    column: 1,
    children: [
      // —— ① deps 切断无关字段触发 ——
      {
        component: 'Card',
        props: { header: '① deps 切断无关字段触发（性能 + 精度）' },
        column: 4,
        row: { gutter: 16 },
        children: [
          {
            name: 'perf.a',
            label: 'A',
            component: 'InputNumber',
            props: { min: 0, controlsPosition: 'right' },
          },
          {
            name: 'perf.b',
            label: 'B',
            component: 'InputNumber',
            props: { min: 0, controlsPosition: 'right' },
          },
          {
            name: 'perf.total',
            label: 'A+B（自动）',
            component: 'InputNumber',
            props: { disabled: true, controlsPosition: 'right' },
            reaction: depKey
              ? // B 模式：仅监听 perf.a / perf.b 路径；distractor.* 变化不触发
                { deps: ['perf.a', 'perf.b'], _effect: recalcPerfTotal }
              : // A 模式：未声明 deps，deep watch 整棵 model → distractor.* 变化也会触发
                { _effect: recalcPerfTotal },
          },
          {
            name: 'distractor.noise1',
            label: '干扰字段 1',
            component: 'Input',
            props: { placeholder: 'A 模式下改动此处会让 ① 计数 +1' },
          },
        ],
      },
      // —— ② deps 切断循环联动 ——
      {
        component: 'Card',
        props: { header: '② deps 切断循环联动（reaction 写自身依赖字段）' },
        column: 2,
        row: { gutter: 16 },
        children: [
          {
            name: 'cycle.a',
            label: 'A（每次变化触发 reaction）',
            component: 'InputNumber',
            props: { controlsPosition: 'right' },
          },
          {
            name: 'cycle.result',
            label: 'A×2（reaction 计算结果）',
            component: 'InputNumber',
            props: { disabled: true, controlsPosition: 'right' },
            // ⚠️ 演示 A 模式循环：A 模式无 deps，reaction 跑 → 写 cycle.result → deep watch
            // 检测 result 变化 → 再次触发 reaction → 再次写 result → 死循环，
            // use-reaction 预算 MAX_CHAIN_PER_FLUSH=50 兜底 console.error 后跳过
            reaction: depKey
              ? { deps: ['cycle.a'], _effect: cycleUpdate }
              : { _effect: cycleUpdate },
          },
        ],
      },
      // —— ③ deps 路径声明（可读性） ——
      {
        component: 'Card',
        props: { header: '③ deps 路径声明（可读性 vs 隐式追踪）' },
        column: 2,
        row: { gutter: 16 },
        children: [
          {
            name: 'readable.qty',
            label: '数量',
            component: 'InputNumber',
            props: { min: 0, controlsPosition: 'right' },
          },
          {
            name: 'readable.price',
            label: '单价',
            component: 'InputNumber',
            props: { min: 0, precision: 2, controlsPosition: 'right' },
          },
          {
            name: 'readable.sum',
            label: '合计（自动）',
            component: 'InputNumber',
            props: { disabled: true, precision: 2, controlsPosition: 'right' },
            // 同一段计算逻辑：函数体内 m.readable.qty * m.readable.price
            // A 模式（无 deps）：依赖靠函数体内引用追踪，隐式——重构 m.qty 改名后自动失效
            // B 模式（deps）：依赖显式列出，重构安全 + 读者一眼看清依赖
            reaction: depKey
              ? {
                  deps: ['readable.qty', 'readable.price'],
                  _effect: recalcSum,
                }
              : { _effect: recalcSum },
          },
        ],
      },
    ],
  }
})

// formRef / copySchema 由 useXFormDemo 统一提供

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage.success('保存成功')
}

const tocItems = [
  { id: 'demo-deps', label: 'deps 三动机演示' },
  { id: 'api-deps', label: 'deps 字段速查' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="reaction.deps 三动机（为什么用 deps）"
    source="src/components/form-schema/composables/use-reaction.ts"
    :introductions="[
      'XFormReactionAdvanced Section ① 演示 deps 怎么用；本页单独讲 deps 为什么用——三个使用动机：',
      '① deps 切断无关字段触发：默认 deep watch 整棵 model，distractor.* 任意字段变化都跑 reaction；声明 deps 后仅精确路径触发；观察 runCount 次数差异',
      '② deps 切断循环联动：reaction 函数体写自身依赖字段时，无 deps 会无限循环触发——use-reaction 预算 MAX_CHAIN_PER_FLUSH=50 兜底 console.error；声明 deps 切断自触发',
      '③ deps 路径声明（可读性）：同一段计算逻辑，无 deps 靠函数体内引用追踪（隐式），有 deps 显式列出依赖（推荐：重构安全 + 阅读一目了然）',
      '顶部开关切换 A 模式（无 deps）/ B 模式（写 deps），schema 自动重新注册 reaction，旧 stoppers 清理。',
    ]"
  >
    <section id="demo-deps">
      <div :class="bem.e('controls')">
        <el-radio-group v-model="useDeps" size="large">
          <el-radio-button :value="false">A 模式：无 deps（深 watch）</el-radio-button>
          <el-radio-button :value="true">B 模式：写 deps（精确监听）</el-radio-button>
        </el-radio-group>
        <span :class="bem.e('hint')">切换时自动重置数据（避免 runCount / loopCount 累计）</span>
      </div>

      <DemoField label="三个动机对比（共享 model，开关切换 A/B）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('panels')">
          <div :class="bem.e('panel')">
            <strong>① 触发次数：</strong>
            {{ model.perf.runCount }}
            <div :class="bem.e('tip')">
              A 模式：改 distractor.noise1 也会 +1；B 模式：仅改 perf.a/perf.b 时 +1
            </div>
          </div>
          <div :class="bem.e('panel')">
            <strong>② 循环次数：</strong>
            {{ model.cycle.loopCount }}
            <div :class="bem.e('tip')">
              A 模式：改 cycle.a 会触发 ~50 次循环 + console.error；B 模式：仅 +1
            </div>
          </div>
          <div :class="bem.e('panel')">
            <strong>③ 合计：</strong>
            ¥{{ model.readable.sum }}
            <div :class="bem.e('tip')">
              A/B 模式表现一致（说明 deps 不是功能开关，而是性能与可读性优化）
            </div>
          </div>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
    <ApiTable title="reaction.deps 字段速查" :items="reactionDepsItems" anchor="api-deps" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-reaction-deps {
  &__controls {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #fef9c3;
    border-radius: 4px;
    border-left: 4px solid #eab308;
  }
  &__hint {
    font-size: 13px;
    color: #6b7280;
  }
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  &__panels {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }
  &__panel {
    padding: 8px 12px;
    background: #f0f9ff;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.7;
    strong {
      color: #2563eb;
      margin-right: 4px;
    }
  }
  &__tip {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
    line-height: 1.5;
  }
}
</style>
