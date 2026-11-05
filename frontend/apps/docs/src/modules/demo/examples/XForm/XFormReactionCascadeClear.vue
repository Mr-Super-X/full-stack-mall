<script setup lang="ts">
/**
 * ② 跨字段级联清空（省/市/区 + 商品/型号）
 *
 * 拆出自 XFormReactionAdvanced —— 该文件原 427 行超过 §二 业务组件 ≤300 行上限。
 * 本节核心：上级 on.change 闭包清空下级；下级 reaction.props 按上级值查字典动态切 options。
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormReactionCascadeClear.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'
import {
  PROVINCES,
  CITIES_BY_PROVINCE,
  DISTRICTS_BY_CITY,
  ITEM_TYPES,
  MODELS_BY_TYPE,
} from './configs/cascader-data'

const { formRef, bem, copySchema, onReset } = useXFormDemo({
  name: 'reaction-cascade-clear',
  schema: () => schema,
})

const model = reactive({
  province: '',
  city: '',
  district: '',
  itemType: '',
  model: '',
  clearCount: 0,
})

const cascadeSchema: SchemaNode = {
  component: 'Card',
  props: { header: '② 跨字段级联清空（省/市/区 + 商品/型号）' },
  column: 3,
  row: { gutter: 16 },
  children: [
    {
      name: 'province',
      label: '省份',
      component: 'Select',
      props: { options: PROVINCES, clearable: true, placeholder: '请选择省份' },
      on: {
        change: () => {
          model.city = ''
          model.district = ''
          model.clearCount++
        },
      },
    },
    {
      name: 'city',
      label: '城市',
      component: 'Select',
      props: { clearable: true, placeholder: '请选择城市' },
      // reaction.props 整体函数：use-reaction 求值后整体覆盖 target.props
      reaction: {
        props: (m: Record<string, unknown>) => ({
          options: CITIES_BY_PROVINCE[(m as { province: string }).province] ?? [],
        }),
      },
      on: {
        change: () => {
          model.district = ''
        },
      },
    },
    {
      name: 'district',
      label: '区/县',
      component: 'Select',
      props: { clearable: true, placeholder: '请选择区/县' },
      reaction: {
        props: (m: Record<string, unknown>) => ({
          options: DISTRICTS_BY_CITY[(m as { city: string }).city] ?? [],
        }),
      },
    },
    {
      name: 'itemType',
      label: '商品类型',
      component: 'Select',
      props: { options: ITEM_TYPES, clearable: true, placeholder: '请选择商品类型' },
      on: {
        change: () => {
          model.model = ''
          model.clearCount++
        },
      },
    },
    {
      name: 'model',
      label: '型号',
      component: 'Select',
      props: { clearable: true, placeholder: '请选择型号' },
      reaction: {
        props: (m: Record<string, unknown>) => ({
          options: MODELS_BY_TYPE[(m as { itemType: string }).itemType] ?? [],
        }),
      },
    },
  ],
}

const schema: SchemaNode = {
  column: 1,
  children: [cascadeSchema],
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

const tocItems = [{ id: 'demo-cascade-clear', label: '级联清空演示' }]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="reaction 级联清空（省/市/区 + 商品/型号）"
    source="src/components/form-schema/composables/use-reaction.ts"
    :introductions="[
      '② 跨字段级联清空：上级字段 on.change 闭包清空下级',
      '下级 reaction.props 按上级值查字典动态切 options（PROVINCES → CITIES_BY_PROVINCE → DISTRICTS_BY_CITY）',
      '商品类型 → 型号链路演示 reaction.props 的动态切 options',
      'clearCount 计数器：每次切上级字段 +1，证明清空逻辑被触发',
    ]"
  >
    <section id="demo-cascade-clear">
      <DemoField label="跨字段级联清空" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('panels')">
          <div :class="bem.e('panel')">
            <strong>级联清空次数：</strong>
            {{ model.clearCount }}
          </div>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-reaction-cascade-clear {
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
