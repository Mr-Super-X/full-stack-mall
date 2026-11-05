<script setup lang="ts">
/**
 * ④ 数组行内嵌 reaction（采购明细行内联动）
 *
 * 拆出自 XFormReactionAdvanced —— 该文件原 427 行超过 §二 业务组件 ≤300 行上限。
 * 本节核心：行内 deps 用相对路径（'qty' 而非 'array.rows.0.qty'），
 * use-reaction 用 lodash get 在行内 model 子树生效。
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormReactionArrayRow.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { formRef, bem, copySchema, onReset } = useXFormDemo({
  name: 'reaction-array-row',
  schema: () => schema,
})

interface RowItem {
  name: string
  qty: number
  price: number
  taxed: boolean
  taxRate: number
  subtotal: number
}

const model = reactive({
  arrayRows: [
    { name: '商品 A', qty: 1, price: 100, taxed: false, taxRate: 0.13, subtotal: 100 },
    { name: '商品 B', qty: 2, price: 50, taxed: true, taxRate: 0.06, subtotal: 106 },
  ] as RowItem[],
})

/** 行小计副作用：applyReactionFields 处理 _effect 字段时调用 (raw)(model)，
 * 副作用同步发生。model 是行 model（render-array-node.ts:113 传入 row），
 * 直接写 m.subtotal —— 真正的行级封装，不依赖外部根 model 引用 */
function recalcRowSubtotal(m: RowItem) {
  m.subtotal = Number((m.qty * m.price * (m.taxed ? 1 + m.taxRate : 1)).toFixed(2))
}

const arraySchema: SchemaNode = {
  component: 'Card',
  props: { header: '④ 数组行内嵌 reaction（采购明细行内联动）' },
  column: 1,
  children: [
    {
      kind: 'array',
      name: 'arrayRows',
      label: '采购明细',
      array: {
        initialLength: 2,
        itemSchema: {
          column: 6,
          row: { gutter: 12 },
          children: [
            { name: 'name', label: '商品', component: 'Input', props: { clearable: true } },
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
            { name: 'taxed', label: '含税', component: 'Switch' },
            {
              name: 'taxRate',
              label: '税率',
              component: 'InputNumber',
              props: { min: 0, max: 1, step: 0.01, precision: 2, controlsPosition: 'right' },
              reaction: {
                hidden: (m: Record<string, unknown>) => !(m as { taxed: boolean }).taxed,
              },
            },
            {
              name: 'subtotal',
              label: '小计',
              component: 'InputNumber',
              props: { precision: 2, disabled: true, controlsPosition: 'right' },
              reaction: {
                // XForm 引擎补 array row 行级 reaction model 上下文后（render-array-node.ts:113
                // renderRow 内独立调 applyReactions(rewritten, row, ...)），
                // 行内相对 deps（'qty' / 'price' / 'taxed' / 'taxRate'）在行 model 子树生效，
                // 无需硬编码 arrayRows.<rowIndex>.* 路径。
                // 引擎层修复覆盖任意行数（push/splice/move 后新行自动注册行级 watcher）。
                // _effect 副作用遍历全行重算 —— 行级 watcher 只在该行字段变化时触发，但
                // 全行遍历保留「任一行变化都重算全部 subtotal」语义，与生产一致
                deps: ['qty', 'price', 'taxed', 'taxRate'],
                _effect: recalcRowSubtotal,
              },
            },
          ],
        },
      },
    },
  ],
}

const schema: SchemaNode = {
  column: 1,
  children: [arraySchema],
}

/** ④ 行小计总和（展示用） */
const grandSubtotal = computed(() =>
  model.arrayRows.reduce((s, r) => s + (r.subtotal || 0), 0).toFixed(2)
)

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败')
    return
  }
  ElMessage.success('保存成功')
}

const tocItems = [{ id: 'demo-array-row', label: '数组行内嵌 reaction' }]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="reaction 数组行内嵌（采购明细行内联动）"
    source="src/components/form-schema/composables/use-reaction.ts"
    :introductions="[
      '④ 数组行内嵌 reaction：行内 deps 用相对路径（不写 array.rows.0.qty）',
      'use-reaction 用 lodash get 在行 model 子树自动解析相对依赖',
      '每行数量×单价×单价(税率) = 小计，「含税」切换显示/隐藏税率并参与计算',
      '行内 reaction 改 subtotal → grandSubtotal 自动汇总',
    ]"
  >
    <section id="demo-array-row">
      <DemoField label="数组行内嵌 reaction" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">校验</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('panels')">
          <div :class="bem.e('panel')">
            <strong>采购小计合计：</strong>
            ¥{{ grandSubtotal }}
          </div>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-reaction-array-row {
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
