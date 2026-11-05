<script setup lang="ts">
/**
 * 数组行内 crossValidator（A1 修复场景的浏览器验证入口）—— 采购申请明细行内校验
 *
 * 场景：每行「申请数量 qty 不得超库存余量 stock、不得超本行上限 maxQty」。
 * 这是纯校验场景（数量是用户输入的，不是计算字段）——改 stock/maxQty 只会让
 * qty 标红/消红，不会自动改 qty 的值（值联动是 reaction 的职责，见 XFormReactionArrayRow）。
 *
 * 行内 crossValidator 的 dependsOn 写相对路径（['stock'] / ['maxQty']），XForm 按行加
 * items[i] 前缀解析；同时反向触发：改库存余量/上限 → 该行数量自动重算红字。
 *
 * 修复背景（docs/audit/2026-10-15-engine-audit-summary.md 批 A1）：
 * 修复前行内相对 dependsOn 双路径失效——反向触发恒不触发、批量路径取到顶层字段。
 * 本 demo 是修复前的验证盲区（"数组+cross"组合 demo 长期为 0）。
 *
 * 验证步骤（每步观察「申请数量」的红字变化）：
 * 1. 初始 数量 5 ≤ 库存 8 且 ≤ 上限 20 → 无红字
 * 2. 数量改 10 → 失焦后红字「不能超库存余量 8」（正向 trigger 路径）
 * 3. 库存改 20 → 不点保存，红字自动消失（反向触发：10 ≤ 20 ✓）
 * 4. 上限改 8 → 红字自动出现「不能超本行上限 8」（反向触发：10 > 8）
 * 5. 数量改 6 → 失焦红消（6 ≤ 8 且 ≤ 8）
 * 6. 点「保存」→ 批量 cross 校验通过（A1 批量路径）
 *
 * 路由：自动注册为 /demo/xform-array-cross-field
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { xArray } from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'
import { arrayCrossItems } from './configs/xform-demos-api'
import xFormSource from './XFormArrayCrossField.vue?raw'

const { formRef, bem, onReset, copySchema } = useXFormDemo({
  name: 'array-cross-field',
  schema: () => schema,
  model: () => model,
})

const MATERIAL_OPTIONS = [
  { value: 'mat-001', label: '不锈钢板' },
  { value: 'mat-002', label: '铝合金型材' },
  { value: 'mat-003', label: '铜线缆' },
]

/**
 * 行内校验规则：dependsOn 相对路径 + 多依赖
 *
 * - dependsOn: ['stock'] / ['maxQty'] 指同 row 的字段（行内相对优先），
 *   不是顶层 model.stock（顶层绝对回退仅在行内无此字段时生效）
 * - cross 规则由 XForm 自有机制接管，compileRules 不再透传 el-form
 *   （audit 2026-10-15 遗留 P1 已根治，无需 type 声明规避 async-validator 默认 string）
 */
const purchaseItemSchema: SchemaNode = {
  column: 4,
  row: { gutter: 12 },
  children: [
    {
      label: '物料',
      name: 'material',
      rules: [{ required: true, message: '请选择物料', trigger: 'change' }],
      component: 'Select',
      props: { placeholder: '请选择物料', clearable: true, options: MATERIAL_OPTIONS },
    },
    {
      label: '申请数量',
      name: 'qty',
      component: 'InputNumber',
      props: { min: 1, placeholder: '数量', controlsPosition: 'right' },
      rules: [
        { required: true, message: '请输入申请数量', trigger: 'blur' },
        {
          dependsOn: ['stock'],
          trigger: 'change',
          crossValidator: (value: unknown, stock: unknown) =>
            !stock || Number(value) <= Number(stock) || `不能超库存余量 ${stock}`,
        },
        {
          dependsOn: ['maxQty'],
          trigger: 'change',
          crossValidator: (value: unknown, maxQty: unknown) =>
            !maxQty || Number(value) <= Number(maxQty) || `不能超本行上限 ${maxQty}`,
        },
      ],
    },
    {
      label: '库存余量',
      name: 'stock',
      rules: [{ required: true, message: '请输入库存余量', trigger: 'blur' }],
      component: 'InputNumber',
      props: { min: 0, placeholder: '库存', controlsPosition: 'right' },
    },
    {
      label: '本行上限',
      name: 'maxQty',
      rules: [{ required: true, message: '请输入本行上限', trigger: 'blur' }],
      component: 'InputNumber',
      props: { min: 1, placeholder: '上限', controlsPosition: 'right' },
    },
  ],
}

const schema: SchemaNode = {
  children: [
    xArray('rows')
      .label('采购申请明细')
      .title('采购申请明细（每行校验：申请数量 ≤ 库存余量 且 ≤ 本行上限）')
      .item(purchaseItemSchema)
      .initialLength(1)
      .minItems(1)
      .maxItems(5)
      .labels({ add: '新增明细', remove: '删除' })
      .build(),
  ],
}

const model = reactive<Record<string, unknown>>({
  rows: [{ material: 'mat-001', qty: 5, stock: 8, maxQty: 20 }],
})

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败：存在超库存/超上限的行')
    return
  }
  ElMessage.success('保存成功（批量 cross 校验通过）')
}

const tocItems = [
  { id: 'demo-array-cross', label: '数组行内 cross 校验' },
  { id: 'api-array-cross', label: '行内 cross 语义' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="数组行内跨字段校验（行内相对 dependsOn + 反向触发）"
    source="src/components/form-schema/composables/use-validate.ts"
    :introductions="[
      '纯校验场景：申请数量是输入值不是计算值 —— 改库存/上限只会让数量标红或消红，不会改数量的值（值联动见 /demo/xform-reaction-array-row）。',
      'dependsOn 写行内相对路径（[\'stock\', \'maxQty\']）——XForm 按行加 items[i] 前缀解析，取到同一行的字段。',
      '反向触发：改库存/上限 → 该行数量自动重算红字，无需失焦；保存时全部行批量校验（validate 会 await）。',
    ]"
  >
    <section id="demo-array-cross">
      <DemoField label="采购申请明细（数量 ≤ 库存 且 ≤ 上限）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('actions')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <p :class="bem.e('hint')">
          验证（每步看「申请数量」红字）：① 初始 5 ≤ 8 且 ≤ 20 无红字 ② 数量改 10 →
          失焦红字（>库存）③ 库存改 20 → 自动消红（反向）④ 上限改 8 → 自动标红（>上限）⑤ 数量改 6 →
          红消 ⑥ 保存 → 批量通过
        </p>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <ApiTable
      title="行内 cross 语义（A1 修复点）"
      :items="arrayCrossItems"
      anchor="api-array-cross"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-array-cross-field {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  &__hint {
    margin: 12px 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }
}
</style>
