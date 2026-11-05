<script setup lang="ts">
/**
 * 演示 SchemaNode.disabled(支持反应式)
 *
 * 场景：
 * 1. 静态 disabled：readonly 字段(只读,业务标识)
 * 2. 反应式 disabled：业务模式开关联动字段 disabled
 *   - 同意条款时,「不同意原因」禁用(同意了就不需要填原因)
 *   - 选「海运」时,「空运保价」禁用(海运不走保价)
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { xInput } from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { disabledItems } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormDisabled.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const bem = createNamespace('demo-x-form-disabled')

const { formRef, onReset, copySchema } = useXFormDemo({
  name: 'disabled',
  schema: () => schema,
  model: () => model,
})

const schema: SchemaNode = {
  children: [
    // 1. 静态 disabled —— 业务标识(用户名不可改,展示用)
    xInput('username')
      .label('用户名（静态 disabled，业务标识）')
      .prop('placeholder', 'admin')
      .disabled(true)
      .defaultValue('admin')
      .build() as SchemaNode,

    // 2. 反应式 disabled —— 同意条款联动「不同意原因」
    {
      label: '是否同意条款',
      name: 'agree',
      component: 'Switch',
    },
    {
      label: '不同意原因',
      name: 'reason',
      component: 'Input',
      props: { placeholder: '请说明不同意的理由', clearable: true },
      reaction: {
        // 同意条款时,"不同意原因"业务上无意义,禁用该字段
        disabled: (m: Record<string, unknown>) => Boolean(m.agree),
      },
    },

    // 3. 反应式 disabled —— 运输方式联动空运保价
    {
      label: '运输方式',
      name: 'shippingMode',
      component: 'Select',
      props: {
        placeholder: '请选择运输方式',
        clearable: true,
        options: [
          { value: 'sea', label: '海运' },
          { value: 'air', label: '空运' },
        ],
      },
    },
    {
      label: '空运保价金额',
      name: 'insuranceAmount',
      component: 'InputNumber',
      props: { min: 0, precision: 2, placeholder: '海运时不适用' },
      reaction: {
        // 选海运时,空运保价无意义,禁用
        disabled: (m: Record<string, unknown>) => m.shippingMode === 'sea',
      },
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  username: 'admin',
  agree: false,
  reason: '',
  shippingMode: '',
  insuranceAmount: 0,
})

// formRef / onReset / copySchema 由 useXFormDemo 统一提供

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败，请检查红字提示')
    return
  }
  ElMessage({
    message: '保存成功：\n' + JSON.stringify(model, null, 2),
    type: 'success',
    duration: 0,
    showClose: true,
  })
}

const tocItems = [
  { id: 'demo-disabled', label: '禁用状态演示' },
  { id: 'api-disabled', label: 'disabled 字段' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="disabled 字段状态（支持反应式）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      'SchemaNode disabled: ReactionValue<boolean> 字段,支持 3 种粒度:',
      '1. 静态 disabled：xInput(\'username\').disabled(true) — 字段始终禁用(如业务标识字段)',
      '2. 反应式 disabled：开关状态联动——「同意条款」=true 时,「不同意原因」字段禁用',
      '3. 反应式 disabled：业务模式联动——「海运」时,「空运保价金额」字段禁用',
      'disabled 字段由 el-form 自动跳过校验;model 中值仍保留,可正常提交',
    ]"
  >
    <section id="demo-disabled">
      <DemoField label="disabled 链式与反应式" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable title="disabled 字段" :items="disabledItems" anchor="api-disabled" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-disabled {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
