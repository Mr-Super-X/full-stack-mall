<script setup lang="ts">
/**
 * XForm Tabs/Steps 视觉容器 demo —— children 即面板（PM 审查发现 9，Wave4-2）
 *
 * 对照参考仓场景命名（form/tabs-steps）—— 分步表单 / 多标签分组表单场景。
 *
 * 场景：活动创建 —— Tabs 分组（基础信息 / 高级设置）+ Steps 分步（填写 / 确认 / 完成）
 *
 * 关键特性：
 * 1. Tabs 容器：component 'Tabs'，children 每项 → ElTabPane（label 取 child.label）
 * 2. Steps 容器：component 'Steps'，children 每项 → ElStep
 * 3. 激活态绑定 model：
 *    - Tabs：props.modelValue + onTabChange 双向桥接 model.activeTab（schema 每次 render
 *      重求值，读 model.activeTab 最新值 → 响应式）
 *    - Steps：props.active + 外层「上一步 / 下一步」按钮改 model.activeStep
 * 4. 校验门控：Steps「下一步」前进前 validateField BASIC_FIELDS，失败则阻止推进
 *    —— 不在 Tabs 上加 beforeLeave（EP 初始渲染 + async 闭包有副作用，见 schema 注释）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormTabsSteps.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, copySchema, copyModel } = useXFormDemo({
  name: 'tabs-steps',
  schema: () => schema.value,
  model: () => model,
})

const model = reactive<Record<string, unknown>>({
  activeTab: 'basic',
  activeStep: 0,
  title: '',
  type: '',
  startDate: '',
  budget: null,
  description: '',
  notify: true,
})

/** Steps 当前激活 step（单独 number ref，避免 model Record<string, unknown> 取值 unknown 收窄成本） */
const activeStep = ref(0)
// 与 model.activeStep 保持同步（ModelPreview 展示用）
watch(
  activeStep,
  (v) => {
    model.activeStep = v
  },
  { immediate: true }
)

/**
 * Tabs 面板字段名清单 —— beforeLeave 校验门控按面板分组
 * （当前 demo 只门控 basic 面板；advanced 自由切换）
 */
const BASIC_FIELDS = ['title', 'type']

// ---- Tabs schema：children 即面板，label 显示在 tab 头 ----
// schema 是 computed：model.activeTab / activeStep 变化 → schema 重求值 → render 读到新 modelValue/active
const schema = computed<SchemaNode[]>(() => [
  {
    component: 'Tabs',
    // 激活态绑定 model.activeTab：modelValue 读 model 最新值 + onTabChange 写回
    // ⚠️ 不在 Tabs 加 beforeLeave 校验门控 —— EP beforeLeave 须同步返 false 才阻止，
    //    async 返 Promise 不阻止；且初始 mount 走 Promise 分支 + schema computed 重求值新闭包，
    //    会导致首个 tab 初始渲染异常（不选中基础信息面板）。校验门控放 Steps「下一步」按钮。
    props: {
      modelValue: model.activeTab,
      onTabChange: (name: string | number) => {
        model.activeTab = String(name)
      },
    },
    children: [
      {
        label: '基础信息',
        name: 'basic',
        column: 2,
        row: { gutter: 24 },
        children: [
          {
            label: '活动标题',
            name: 'title',
            component: 'Input',
            rules: [{ required: true, message: '请输入活动标题', trigger: 'blur' }],
            props: { placeholder: '必填（切走校验门控）' },
          },
          {
            label: '活动类型',
            name: 'type',
            component: 'Select',
            rules: [{ required: true, message: '请选择活动类型', trigger: 'change' }],
            props: {
              placeholder: '必选',
              options: ['线上', '线下', '混合'].map((t) => ({ value: t, label: t })),
            },
          },
          {
            label: '开始日期',
            name: 'startDate',
            component: 'DatePicker',
            props: { valueFormat: 'YYYY-MM-DD', placeholder: '非必填' },
          },
        ],
      },
      {
        label: '高级设置',
        name: 'advanced',
        column: 2,
        row: { gutter: 24 },
        children: [
          {
            label: '预算（元）',
            name: 'budget',
            component: 'InputNumber',
            props: { min: 0, placeholder: '可选' },
          },
          {
            label: '通知参与者',
            name: 'notify',
            component: 'Switch',
          },
          {
            label: '活动描述',
            name: 'description',
            component: 'Input',
            props: { type: 'textarea', rows: 3, placeholder: '可选' },
          },
        ],
      },
    ],
  } as unknown as SchemaNode,
  // Steps 容器：分步表单（active 绑定 activeStep，外层按钮驱动）
  {
    component: 'Steps',
    props: { active: activeStep.value, alignCenter: true, class: bem.e('steps') },
    children: [{ label: '填写' }, { label: '确认' }, { label: '完成' }],
  } as unknown as SchemaNode,
])

// ---- Steps 外层按钮驱动 activeStep ----
function prevStep() {
  if (activeStep.value > 0) activeStep.value--
}

async function nextStep() {
  // 第 1 步（index 0）→ 前进前校验 Tabs 里的字段
  if (activeStep.value === 0) {
    const ok = await formRef.value?.validateField(BASIC_FIELDS)
    if (!ok) {
      ElMessage.warning('请先完善基础信息')
      return
    }
  }
  if (activeStep.value < 2) activeStep.value++
}

const tocItems = [{ id: 'demo-tabs-steps', label: 'Tabs/Steps 演示' }]

useDocToc(tocItems)

/** 覆盖 useXFormDemo 的 onReset：除重置表单字段外，同步归零 Steps 进度 + Tabs 激活 tab */
function onResetAll(): void {
  formRef.value?.resetFields()
  activeStep.value = 0
  model.activeTab = 'basic'
}
</script>

<template>
  <DemoFrame
    title="Tabs / Steps 视觉容器（children 即面板）"
    source="src/components/form-schema/composables/render-tabs-steps-node.ts"
    :introductions="[
      'Tabs：component \'Tabs\'，children 每项 → ElTabPane，label 取 child.label。激活态绑定 model.activeTab（modelValue + onTabChange 双向桥接）。',
      '校验门控：Steps「下一步」前进前 validateField 基础字段，失败则阻止推进（Tabs 保持纯视觉切换）。',
      'Steps：component \'Steps\'，children 每项 → ElStep；active 绑定 model.activeStep，外层按钮驱动切换。',
      '两种容器均为纯视觉分组，与 Card 同级；面板内布局用 child.row/column 走栅格。',
    ]"
  >
    <section id="demo-tabs-steps">
      <DemoField label="Tabs / Steps 容器" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div class="mt-2">
          <el-button @click="prevStep" :disabled="activeStep === 0">上一步</el-button>
          <el-button @click="nextStep" type="primary" :disabled="activeStep === 2">
            下一步
          </el-button>
          <el-button @click="onResetAll">重置</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
          <el-button @click="copyModel">复制 model</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-tabs-steps {
  &__steps {
    margin-top: 24px;
  }
}

// 区分已完成（is-success）vs 当前激活（is-process）——EP 默认主题下两者视觉接近，
// 用户难区分「已完成」和「当前在哪一步」；给 is-process 图标加粗边框 + 光晕突出当前位置
// （EP 把 is-process class 加在 .el-step__head / .el-step__title，不在 .el-step 本身，
//  故选择器须命中 .el-step__head.is-process）
.#{$BEM_PREFIX}-demo-x-form-tabs-steps__steps .el-step__head.is-process {
  .el-step__icon {
    // EP 默认 .el-step__icon 有 border: 2px solid ...（实际 1.71px 计算值），需 !important 覆盖
    // （CLAUDE.md §4 #13 禁止 !important 的例外：覆盖第三方库默认样式时允许）
    border-width: 3px !important;
    border-color: var(--el-color-primary) !important;
    box-shadow: 0 0 0 4px var(--el-color-primary-light-7);
  }

  .el-step__line {
    background-color: var(--el-color-primary);
  }
}
</style>
