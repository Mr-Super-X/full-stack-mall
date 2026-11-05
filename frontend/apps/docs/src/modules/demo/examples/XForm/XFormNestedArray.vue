<script setup lang="ts">
/**
 * 演示 嵌套 ArrayNode —— 外层 array 每行内嵌另一个 array
 *
 * 🠶 路径前缀化验证：见 docs/24-XForm使用指南.md §4.2
 *
 * 场景：订单列表 —— 每个订单（外层 array）含多个明细项（内层 array）。
 * 验证 el-form 校验路径正确前缀化为：
 *   orders[i].orderNo
 *   orders[i].items[j].product / qty / price
 *
 * 不变量：
 * 1. el-form-item 的 prop 属性必须含完整路径（含两层 [i] 索引）
 * 2. addItem / removeItem / moveItem 两条 array 独立操作
 * 3. validate() 失败时 errors[].keyPath 含两层索引（如 ['orders', 0, 'items', 1, 'product']）
 *
 * P0-3 修复背景：嵌套 array 场景下 rewriteNamePath 加防重复前缀逻辑
 * （见 @vv/ui/components/form-schema/composables/array-row-key.ts）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { xArray } from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import DemoField from '../../components/DemoField.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormNestedArray.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const { bem, formRef, copySchema } = useXFormDemo({
  name: 'nested-array',
  schema: () => schema,
  model: () => model,
})

// 商品字典（mock 远程接口）
const PRODUCT_OPTIONS = [
  { value: 'sku-001', label: 'Vue 3 实战', price: 89 },
  { value: 'sku-002', label: 'TypeScript 进阶', price: 69 },
  { value: 'sku-003', label: 'Vite 工程化', price: 59 },
  { value: 'sku-004', label: 'Element Plus 精讲', price: 79 },
]

/**
 * 内层 array itemSchema：订单明细项（商品 + 数量 + 单价）
 * 嵌套在外层 array 的 itemSchema.children 中，路径前缀化为 orders[i].items[j].xxx
 */
const orderDetailSchema: SchemaNode = {
  column: 3,
  row: { gutter: 12 },
  children: [
    {
      label: '商品',
      name: 'product',
      rules: [{ required: true, message: '请选择商品', trigger: 'change' }],
      component: 'Select',
      props: { placeholder: '请选择商品', clearable: true, options: PRODUCT_OPTIONS },
    },
    {
      label: '数量',
      name: 'qty',
      rules: [{ required: true, message: '请输入数量', trigger: 'blur' }],
      component: 'InputNumber',
      props: { min: 1, placeholder: '数量', controlsPosition: 'right' },
    },
    {
      label: '单价(元)',
      name: 'price',
      rules: [{ required: true, message: '请输入单价', trigger: 'blur' }],
      component: 'InputNumber',
      props: { min: 0, precision: 2, placeholder: '单价', controlsPosition: 'right' },
    },
  ],
}

/**
 * 外层 array itemSchema：单订单（订单号 + 内层明细 array）
 * 这里使用 xArray 嵌套写法：内层 array 是 itemSchema.children 的一个节点
 */
const orderItemSchema: SchemaNode = {
  column: 1,
  row: { gutter: 16 },
  children: [
    {
      label: '订单号',
      name: 'orderNo',
      rules: [{ required: true, message: '请输入订单号', trigger: 'blur' }],
      component: 'Input',
      props: { placeholder: '如：ORD-2026-001' },
    },
    // 嵌套 array：内层 array 节点作为 children 的字段
    // 路径前缀化后：orders[i].items[j].product / qty / price
    xArray('items')
      .label('订单明细')
      .title('明细项')
      .item(orderDetailSchema)
      .initialLength(1)
      .minItems(1)
      .maxItems(5)
      .labels({ add: '新增明细', remove: '删除', moveUp: '上移', moveDown: '下移' })
      .build(),
  ],
}

/** 顶层 schema：单个外层 ArrayNode */
const schema: SchemaNode = {
  children: [
    xArray('orders')
      .label('订单列表')
      .title('订单列表（含嵌套明细）')
      .item(orderItemSchema)
      .initialLength(1)
      .minItems(1)
      .maxItems(3)
      .labels({ add: '新增订单', remove: '删除', moveUp: '上移', moveDown: '下移' })
      .build(),
  ],
}

const model = reactive<Record<string, unknown>>({
  orders: [
    {
      orderNo: 'ORD-2026-001',
      items: [{ product: 'sku-001', qty: 2, price: 89 }],
    },
  ],
})

/** 格式化展示：每订单的总价 = sum(items[].qty * items[].price) */
const orderSummaries = computed(() => {
  const orders =
    (model.orders as
      | Array<{
          orderNo?: string
          items?: Array<{ qty?: number; price?: number }>
        }>
      | undefined) ?? []
  return orders.map((order, i) => {
    const subtotal = (order.items ?? []).reduce(
      (sum, it) => sum + Number(it.qty ?? 0) * Number(it.price ?? 0),
      0
    )
    return `${i + 1}. ${order.orderNo ?? '(无订单号)'} — 小计 ¥${subtotal.toFixed(2)}`
  })
})

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    // 验证 P0-3：errors[].keyPath 含两层 [i] 索引
    const detail = await formRef.value.validateDetail()
    const firstError = detail.errors[0]
    if (firstError) {
      ElMessage.error({
        message: `校验失败：${firstError.message}\n路径：${firstError.keyPath.join('.')}`,
        duration: 0,
        showClose: true,
      })
      return
    }
    ElMessage.error('校验失败，请检查必填项')
    return
  }
  ElMessage({
    message: '保存成功：\n' + JSON.stringify(model, null, 2),
    type: 'success',
    duration: 0,
    showClose: true,
  })
}

function onReset() {
  formRef.value?.resetFields()
}

/** 路径前缀化自检：渲染后 el-form-item 的 prop 应为 orders[0].items[0].product 等 */
function onCheckPath() {
  // getRef 是 XFormExpose 的合法公共方法（见 types/xform.ts:202）：
  //   getRef(key: string): ComponentPublicInstance | HTMLElement | null
  // 通过 getRef 拿到 el-form DOM，从 data-prop 属性读取 prop 路径
  const elForm = formRef.value?.getRef?.('elFormRef') as HTMLElement | undefined
  const formItems = elForm ? Array.from(elForm.querySelectorAll('.el-form-item')) : []
  const propPaths = formItems.map((fi) => (fi as HTMLElement).dataset.prop ?? '')
  ElMessage({
    message: `el-form-item prop 路径（前 5 个）：\n${propPaths.slice(0, 5).join('\n')}`,
    type: 'info',
    duration: 0,
    showClose: true,
  })
}

/**
 * 触发嵌套校验失败演示：清空必填字段后调 validateDetail()，弹窗完整展示 keyPath 数组
 * — 演示 errors[].keyPath 含两层数组下标（如 ['orders', 0, 'items', 1, 'product']）
 */
async function onValidateFail(): Promise<void> {
  if (!formRef.value) return
  // 故意清空必填字段，确保触发嵌套校验失败
  model.orders = [{ orderNo: '', items: [{ product: '', qty: undefined, price: undefined }] }]
  await nextTick()
  const detail = await formRef.value.validateDetail()
  const lines = detail.errors.map(
    (e, i) =>
      `${i + 1}. [${e.keyPath.map((k) => (typeof k === 'number' ? `[${k}]` : `'${k}'`)).join(', ')}] → ${e.message}`
  )
  ElMessage({
    message: `嵌套校验失败 ${detail.errors.length} 项：\n${lines.join('\n')}`,
    type: 'error',
    duration: 0,
    showClose: true,
  })
}

const tocItems = [
  { id: 'demo-nested-array', label: '嵌套 ArrayNode 演示' },
  { id: 'api-nested-array', label: '实现说明' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="嵌套 ArrayNode（外层 array 内嵌 array）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '1. 外层 array(orders) 每行含订单号 + 内层 array(items)，演示嵌套 array 场景',
      '2. 路径前缀化：内层字段实际 prop 为 orders[0].items[0].product（两层 [i] 索引）',
      '3. P0-3 修复：rewriteNamePath 加防重复前缀逻辑，避免嵌套 array 误用时重复前缀',
      '4. 「检查 prop 路径」按钮：渲染后从 el-form-item data-prop 读实际路径，验证前缀化正确',
      '5. 两条 array 独立 addItem/removeItem/moveItem，外层和内层互不干扰',
    ]"
  >
    <section id="demo-nested-array">
      <DemoField label="嵌套 array（订单 + 订单明细）" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('summary')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存并校验</el-button>
          <el-button type="danger" @click="onValidateFail">触发嵌套校验失败</el-button>
          <el-button @click="onCheckPath">检查 prop 路径</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <div :class="bem.e('state')">
          <div>订单小计：</div>
          <pre>{{ orderSummaries.join('\n') }}</pre>
        </div>
        <ModelPreview :model="model" />
      </DemoField>
    </section>

    <section id="api-nested-array">
      <DemoField label="实现说明" :code="xFormSource">
        <p>本 demo 验证 P0-3 嵌套 array 路径前缀化修复。</p>
        <p>
          关键点：
          <code>xArray('orders').item(orderItemSchema)</code>
          中
          <code>orderItemSchema.children</code>
          含一个嵌套
          <code>xArray('items').item(orderDetailSchema)</code>
          。
        </p>
        <p>
          渲染链路：外层 array (orders) 渲染时 → 内层 array 节点 (items) name 前缀化为
          <code>orders[0].items</code>
          → 内层 array 渲染时 →
          <code>orderDetailSchema.children</code>
          字段 name 前缀化为
          <code>orders[0].items[0].product</code>
          等。
        </p>
        <p>
          防重复前缀：
          <code>array-row-key.ts rewriteNamePath</code>
          检测若节点 name 已包含 prefix（如
          <code>orders[0].items</code>
          以
          <code>orders[0].items[</code>
          开头），则跳过再次加 prefix。
        </p>
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-nested-array {
  &__summary {
    display: flex;
    gap: 8px;
    margin: 16px 0;
  }

  &__state {
    margin-top: 16px;
    padding: 12px;
    background: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;

    pre {
      margin: 8px 0 0;
      font-family: var(--el-font-family-mono);
      white-space: pre-wrap;
    }
  }
}
</style>
