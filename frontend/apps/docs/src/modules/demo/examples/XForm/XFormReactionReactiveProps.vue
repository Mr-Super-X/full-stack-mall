<script setup lang="ts">
/**
 * ③ 反应式 props/rules/options 联动（度量单位 + 折扣等级）
 *
 * 拆出自 XFormReactionAdvanced —— 该文件原 427 行超过 §二 业务组件 ≤300 行上限。
 * 本节核心：单个 reaction 节点同时控制 label + props；use-reaction 是赋值非合并，
 * props 返回完整对象；rules 用 {{ fn }} 表达式与 reaction 协同。
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormReactionReactiveProps.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'
import {
  METRIC_OPTIONS,
  METRIC_LABEL,
  METRIC_MIN,
  METRIC_MAX,
  METRIC_PRECISION,
  METRIC_PLACEHOLDER,
  DISCOUNT_LEVEL_OPTIONS,
  DISCOUNT_RATE,
} from './configs/cascader-data'

const { formRef, bem, copySchema, onReset } = useXFormDemo({
  name: 'reaction-reactive-props',
  schema: () => schema,
})

const model = reactive({
  metric: 'weight' as 'weight' | 'volume' | 'count',
  value: 0,
  discountLevel: 'normal',
  discountRate: 1,
})

/** 反应式副作用：根据折扣等级查字典写入 model.discountRate */
function recalcDiscountRate() {
  model.discountRate = DISCOUNT_RATE[model.discountLevel] ?? 1
}

// 单个 reaction 节点同时控制 label + props；rules 用 {{ fn }} 表达式与 reaction 协同
const dynamicSchema: SchemaNode = {
  component: 'Card',
  props: { header: '③ 反应式 props/rules/options 动态切换（度量单位 + 折扣等级）' },
  column: 2,
  row: { gutter: 16 },
  children: [
    {
      name: 'metric',
      label: '度量单位',
      component: 'RadioGroup',
      props: { options: METRIC_OPTIONS },
    },
    {
      name: 'value',
      component: 'InputNumber',
      reaction: {
        label: (m: Record<string, unknown>) =>
          METRIC_LABEL[(m as { metric: 'weight' | 'volume' | 'count' }).metric],
        // reaction.props 整体函数：返回值整体覆盖 target.props（包含 controlsPosition 等静态字段）
        props: (m: Record<string, unknown>) => {
          const k = (m as { metric: 'weight' | 'volume' | 'count' }).metric
          return {
            min: METRIC_MIN[k],
            max: METRIC_MAX[k],
            precision: METRIC_PRECISION[k],
            placeholder: METRIC_PLACEHOLDER[k],
            controlsPosition: 'right' as const,
          }
        },
        // 反应式 rules：用 {{ fn }} 字符串形式（不在 node.rules 写字符串，会被当成命名引用查表）
        rules:
          "{{ (m) => (m.value > 0) ? [] : [{ required: true, message: '必须 > 0', trigger: 'blur' }] }}",
      },
    },
    {
      name: 'discountLevel',
      label: '折扣等级',
      component: 'Select',
      props: { options: DISCOUNT_LEVEL_OPTIONS, clearable: true, placeholder: '请选择折扣等级' },
    },
    {
      name: 'discountRate',
      label: '折扣率（自动）',
      component: 'InputNumber',
      props: { precision: 2, disabled: true, controlsPosition: 'right' },
      reaction: {
        deps: ['discountLevel'],
        _effect: recalcDiscountRate,
      },
    },
  ],
}

const schema: SchemaNode = {
  column: 1,
  children: [dynamicSchema],
}

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage.success('保存成功')
}

const tocItems = [{ id: 'demo-reactive-props', label: '反应式 props 联动' }]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="reaction 反应式 props / rules / options（度量单位 + 折扣等级）"
    source="src/components/form-schema/composables/use-reaction.ts"
    :introductions="[
      '③ 反应式 label / props / rules 联动：单个 reaction 节点同时改 label 和 props',
      'rules 用 {{ fn }} 表达式与 reaction 协同（不在 node.rules 写字符串，会被当成命名引用查表）',
      '切度量单位 → label / min / max / precision / placeholder 整体联动（reaction.props 整体覆盖）',
      '切折扣等级 → discountRate 字段反应式 _effect 计算（deps 精确监听 discountLevel）',
    ]"
  >
    <section id="demo-reactive-props">
      <DemoField label="反应式 props/rules/options 联动" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('panels')">
          <div :class="bem.e('panel')">
            <strong>当前度量单位：</strong>
            {{ model.metric }}（label / min / max 联动切换）
          </div>
          <div :class="bem.e('panel')">
            <strong>当前折扣率：</strong>
            {{ model.discountRate }}（{{ model.discountLevel }} 等级）
          </div>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-reaction-reactive-props {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  &__panels {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
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
}
</style>
