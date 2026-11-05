<script setup lang="ts">
/**
 * ① 计算字段 + deps 精确监听（购物车小计）
 *
 * 拆出自 XFormReactionAdvanced —— 该文件原 427 行超过 §二 业务组件 ≤300 行上限。
 * 本节核心：reaction 函数体闭包写 model + deps 精确监听 3 个字段切断自触发。
 *
 * 与 XFormReactionDeps 的区别：Deps 讲解动机（为什么用 deps），
 * 本节演示业务用法（数量×单价×折扣=折后价）。
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormReactionCalcField.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, copySchema, onReset } = useXFormDemo({
  name: 'reaction-calc-field',
  schema: () => schema,
})

const model = reactive({ qty: 1, price: 100, discount: 1, total: 100, calcCount: 0 })

/** 副作用：写入 total + 计数；返回 undefined → use-reaction 的 isEqual 比较跳过写入节点字段 */
function recalcTotal() {
  model.total = Number((model.qty * model.price * model.discount).toFixed(2))
  model.calcCount++
}

// deps 精确监听 qty/price/discount → 闭包副作用写 model.total；deps 不含 total/count → 无自触发
const calcSchema: SchemaNode = {
  component: 'Card',
  props: { header: '① 计算字段 + deps 精确监听（购物车小计）' },
  column: 4,
  row: { gutter: 16 },
  children: [
    {
      name: 'qty',
      label: '数量',
      component: 'InputNumber',
      props: { min: 1, controlsPosition: 'right' },
    },
    {
      name: 'price',
      label: '单价',
      component: 'InputNumber',
      props: { min: 0, precision: 2, controlsPosition: 'right' },
    },
    {
      name: 'discount',
      label: '折扣',
      component: 'InputNumber',
      props: { min: 0, max: 1, step: 0.1, precision: 1, controlsPosition: 'right' },
    },
    {
      name: 'total',
      label: '折后价（自动）',
      component: 'InputNumber',
      props: { precision: 2, disabled: true, controlsPosition: 'right' },
      reaction: {
        deps: ['qty', 'price', 'discount'],
        _effect: recalcTotal,
      },
    },
  ],
}

const schema: SchemaNode = {
  column: 1,
  children: [calcSchema],
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

const tocItems = [{ id: 'demo-calc-field', label: '计算字段演示' }]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="reaction 计算字段（数量×单价×折扣=折后价）"
    source="src/components/form-schema/composables/use-reaction.ts"
    :introductions="[
      '① deps 精确监听 + 反应式闭包写 model：数量×单价×折扣=折后价',
      'reaction 函数体副作用写 model.total + 自增 calcCount（写 null 自动禁用字段）',
      'deps 精确监听 qty/price/discount → 改其他字段不会 +1',
      '反应式 _effect 函数体闭包写 model，返回 undefined → use-reaction 跳过写入节点字段',
    ]"
  >
    <section id="demo-calc-field">
      <DemoField label="计算字段 + deps 精确监听" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('panels')">
          <div :class="bem.e('panel')">
            <strong>计算次数：</strong>
            {{ model.calcCount }}（应只在 qty/price/discount 变化时 +1）
          </div>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-reaction-calc-field {
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
