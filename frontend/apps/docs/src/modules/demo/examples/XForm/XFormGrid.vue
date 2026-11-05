<script setup lang="ts">
/**
 * 栅格布局专项 demo —— 三种配置方式对照，快速理解区别
 *
 * 场景：订单录入（同一组字段用三种栅格配置渲染，切换查看布局差异）
 *
 * 1. column 统一分配：每行固定 N 列，所有字段等宽（span = 24 / N），最简配置
 * 2. row + col.span 自定义：节点级自由分配列宽（6 + 6 + 12、12 + 12 等任意组合）
 * 3. 布局容器节点：无 name 的节点带 row / column → 渲染为纯栅格容器，分区组织字段
 *
 * ⚠️ 混用限制：顶层 column 会把节点锁进固定 span 的 ElCol，
 * 节点级 col.span 无法突破半宽 —— 需要不等宽布局时用「row + col.span」组合。
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ModelPreview from '../../components/ModelPreview.vue'
import { gridItems } from './configs/xform-demos-api'
import xFormSource from './XFormGrid.vue?raw'

const { bem, formRef, onReset } = useXFormDemo({
  name: 'grid',
  schema: () => currentSchema.value,
})

const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'shipped', label: '已发货' },
  { value: 'done', label: '已完成' },
]

/** 公共字段（不含栅格配置）——三种模式复用同一组字段 */
function makeFields(): SchemaNode[] {
  return [
    {
      label: '订单号',
      name: 'orderNo',
      component: 'Input',
      props: { placeholder: '如 ORD-202401', clearable: true },
      rules: [{ required: true, message: '请输入订单号', trigger: 'blur' }],
    },
    {
      label: '订单状态',
      name: 'status',
      component: 'Select',
      props: { placeholder: '请选择状态', clearable: true, options: ORDER_STATUS_OPTIONS },
    },
    {
      label: '订单金额',
      name: 'amount',
      component: 'InputNumber',
      props: { min: 0, controlsPosition: 'right', placeholder: '金额' },
    },
    {
      label: '下单日期',
      name: 'date',
      component: 'DatePicker',
      props: { valueFormat: 'YYYY-MM-DD', placeholder: '选择日期' },
    },
    {
      label: '备注',
      name: 'remark',
      component: 'Input',
      props: { type: 'textarea', rows: 2, placeholder: '备注信息' },
    },
  ]
}

/** 按字段名给节点分配 col.span（模式 2 用） */
function withColSpans(fields: SchemaNode[], spans: Record<string, number>): SchemaNode[] {
  return fields.map((f) => {
    const span = f.name !== undefined ? spans[f.name] : undefined
    return span !== undefined ? { ...f, col: { span } } : f
  })
}

// —— 模式 1：column 统一分配（等宽 3 列） ——
const columnSchema: SchemaNode = {
  column: 3,
  row: { gutter: 24 },
  children: makeFields(),
}

// —— 模式 2：row + 节点级 col.span（自由分配列宽） ——
const rowColSchema: SchemaNode = {
  row: { gutter: 24 },
  children: withColSpans(makeFields(), {
    orderNo: 6, // 行 1：6 + 6 + 12（窄 + 窄 + 宽）
    status: 6,
    amount: 12,
    date: 12, // 行 2：12 + 12（等宽）
    remark: 12,
  }),
}

// —— 模式 3：布局容器节点（无 name 容器分区组织） ——
const containerSchema: SchemaNode = {
  children: [
    {
      // 无 component 无 name 的纯布局容器 → 渲染为 ElRow + ElCol 分区
      column: 2,
      row: { gutter: 24 },
      children: makeFields().slice(0, 2),
    },
    {
      column: 3,
      row: { gutter: 24 },
      children: makeFields().slice(2),
    },
  ],
}

const activeKey = ref<'column' | 'row-col' | 'container'>('column')

/** 各模式独立 model，切换互不污染 */
const models: Record<typeof activeKey.value, Record<string, unknown>> = {
  column: reactive({ orderNo: '', status: '', amount: undefined, date: '', remark: '' }),
  'row-col': reactive({ orderNo: '', status: '', amount: undefined, date: '', remark: '' }),
  container: reactive({ orderNo: '', status: '', amount: undefined, date: '', remark: '' }),
}

const currentSchema = computed<SchemaNode>(() => {
  if (activeKey.value === 'row-col') return rowColSchema
  if (activeKey.value === 'container') return containerSchema
  return columnSchema
})

/** 各模式的布局说明（切换时显示） */
const MODE_HINTS: Record<typeof activeKey.value, string> = {
  column:
    'column: 3 —— 每行固定 3 列，所有字段等宽（span = 24 / 3 = 8）。写法最简单，适合字段宽度无差异的表单。',
  'row-col':
    'row: { gutter: 24 } + 节点级 col.span —— 第一行 6 + 6 + 12（窄窄宽），第二行 12 + 12。列宽自由组合（0-24 任意分配），适合主次字段混排。',
  container:
    '无 name 的节点带 row / column —— 渲染为纯栅格容器：上面 2 列分区放订单号 + 状态，下面 3 列分区放金额 + 日期 + 备注。适合按业务块分区组织长表单。',
}

const tocItems = [
  { id: 'demo-grid', label: '栅格配置对照' },
  { id: 'api-grid', label: '栅格配置速查' },
]

useDocToc(tocItems)

/** 校验当前激活模式的表单（formRef 由 :key="activeKey" 在切换时强制重建） */
function onSaveGrid() {
  formRef.value
    ?.validate()
    .then((valid) => {
      if (valid) {
        ElMessage.success(`校验通过：${activeKey.value} 模式表单有效`)
      } else {
        ElMessage.error('校验失败，请检查红字字段')
      }
    })
    .catch(() => {
      ElMessage.error('校验异常')
    })
}
</script>

<template>
  <DemoFrame
    title="栅格布局（column / row + col.span / 布局容器）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '三种栅格配置方式对照，同一组字段渲染效果差异一目了然。',
      'column：等宽 N 列，最简配置；row + col.span：列宽自由组合；布局容器节点：按业务块分区。',
      '注意：顶层 column 与节点级 col.span 混用无效（节点被锁进固定 span 的 ElCol），需要不等宽时用 row + col.span。',
    ]"
  >
    <section id="demo-grid">
      <DemoField label="三种栅格配置对照（切换查看）" :code="xFormSource">
        <div :class="bem.e('actions')">
          <el-radio-group v-model="activeKey" size="small">
            <el-radio-button value="column">column 统一分配</el-radio-button>
            <el-radio-button value="row-col">row + col.span</el-radio-button>
            <el-radio-button value="container">布局容器节点</el-radio-button>
          </el-radio-group>
        </div>
        <div :class="bem.e('hint')">{{ MODE_HINTS[activeKey] }}</div>
        <XForm ref="formRef" :key="activeKey" :schema="currentSchema" :model="models[activeKey]" />
        <div :class="bem.e('form-actions')">
          <el-button @click="onReset">重置字段</el-button>
          <el-button type="primary" @click="onSaveGrid">校验/保存</el-button>
        </div>
        <ModelPreview
          :model="models[activeKey]"
          :summary="`查看完整 model（JSON，${activeKey}）`"
        />
      </DemoField>
    </section>

    <ApiTable title="栅格配置速查" :items="gridItems" anchor="api-grid" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-grid {
  &__actions {
    margin-bottom: 12px;
  }

  &__form-actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  &__hint {
    margin-bottom: 16px;
    padding: 8px 12px;
    border-radius: 4px;
    background: #f5f7fa;
    font-size: 13px;
    color: #606266;
  }
}
</style>
