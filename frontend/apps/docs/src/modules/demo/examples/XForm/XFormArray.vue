<script setup lang="ts">
/**
 * 演示 ArrayNode（数组容器）
 *
 * 🠶 行内字段隐藏（如折叠未启用行）：见 docs/24-XForm使用指南.md §4.2
 *
 * 场景：订单明细 — 多行项目（商品 + 数量 + 单价 + 小计），支持：
 * 1. 行内 addItem / removeItem / moveItem（上移/下移）
 * 2. minItems / maxItems 边界按钮禁用
 * 3. 行内子 schema 嵌套渲染（row + column 栅格）
 * 4. 小计 = 数量 × 单价（在模板里展示,model 中存储原值）
 */
import { ElMessage } from 'element-plus'
import type { SchemaNode } from '@vv/ui/components/form-schema/types.ts'
import { xArray } from '@vv/ui/components/form-schema/builders.ts'
import { useXFormDemo } from '../../composables/useXFormDemo'
import ApiTable from '../../components/ApiTable.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import { arrayItems } from './configs/xform-demos-api'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import xFormSource from './XFormArray.vue?raw'
import ModelPreview from '../../components/ModelPreview.vue'

const bem = createNamespace('demo-x-form-array')

const { formRef, onReset, copySchema } = useXFormDemo({
  name: 'array',
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

/** 单行 schema：商品 + 数量 + 单价 三个字段并排（4/8/8 列宽） */
const orderItemSchema: SchemaNode = {
  column: 3,
  row: { gutter: 12 },
  children: [
    {
      label: '商品',
      name: 'product',
      // 数组项的 required 规则必须显式提供 message —— async-validator 默认会用 prop 路径
      // 拼出 "items[0].product is required" 这种英文路径错误,用户体验差
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

/** 顶层 schema：单个 ArrayNode */
const schema: SchemaNode = {
  children: [
    xArray('items')
      .label('订单明细')
      .title('订单明细')
      .item(orderItemSchema)
      .initialLength(1)
      .minItems(1)
      .maxItems(5)
      .labels({ add: '新增明细', remove: '删除', moveUp: '上移', moveDown: '下移' })
      .build(),
  ],
}

const model = reactive<Record<string, unknown>>({
  items: [{ product: 'sku-001', qty: 1, price: 89 }],
})

/** 每行小计（展示用,不在 schema 内） */
const subtotals = computed(() => {
  const arr = (model.items as Array<{ qty?: number; price?: number }> | undefined) ?? []
  return arr.map((it) => (Number(it.qty ?? 0) * Number(it.price ?? 0)).toFixed(2))
})

/** 总计 */
const grandTotal = computed(() => subtotals.value.reduce((sum, s) => sum + Number(s), 0).toFixed(2))

async function onSave() {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) {
    ElMessage.error('校验失败，请检查必填项')
    return
  }
  ElMessage({
    message: '保存成功：\n' + JSON.stringify({ ...model, grandTotal: grandTotal.value }, null, 2),
    type: 'success',
    duration: 0,
    showClose: true,
  })
}

const tocItems = [
  { id: 'demo-array', label: '订单明细演示' },
  { id: 'api-array', label: 'ArrayNodeConfig' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="数组节点 ArrayNode（订单明细）"
    source="src/components/form-schema/XForm.vue"
    :introductions="[
      '演示 kind: array 容器节点：',
      '1. 每行 itemSchema 是一份「商品 + 数量 + 单价」的子 schema，套到 model.items 的每个数组元素',
      '2. 行末按钮支持 上移 / 下移 / 删除，顶部「新增明细」追加行',
      '3. minItems: 1 限制删除按钮（最后一行禁用），maxItems: 5 限制新增按钮（达上限禁用）',
      '4. 字段名自动重写为 items[0].qty 形式,el-form 按嵌套路径校验',
      '5. 小计与总计在模板里 computed 展示(不污染 schema)',
    ]"
  >
    <section id="demo-array">
      <DemoField label="数组节点" :code="xFormSource">
        <XForm ref="formRef" :schema="schema" :model="model" />
        <div :class="bem.e('summary')">
          <el-button @click="onReset">重置</el-button>
          <el-button type="primary" @click="onSave">保存</el-button>
          <el-button @click="copySchema">复制 schema</el-button>
        </div>
        <!-- 总计独立 block 显示：与操作按钮区分视觉层级，强提示聚合结果 -->
        <div :class="bem.e('total-bar')">
          <span :class="bem.e('total-label')">总计</span>
          <strong :class="bem.e('total-value')">¥{{ grandTotal }}</strong>
        </div>
        <div :class="bem.e('state')">
          <div>model.items（{{ Array.isArray(model.items) ? model.items.length : 0 }} 行）</div>
          <ModelPreview :model="model" />
          <div>小计：{{ subtotals.join(' / ') }}（元）</div>
        </div>
        <p :class="bem.e('hint')">
          <strong>边界演示步骤 4：</strong>
          点 5 次「新增明细」→ 第 6 次按钮变为 disabled（maxItems=5 触发上限）。 再点 5 次「删除」→
          第 5 次删除按钮 disabled（minItems=1 触发下限）：
          <code>
            点 4 次「删除明细」→ 第 5 次删除按钮 disabled（minItems=1 触发下限，无法删除最后一行）
          </code>
          ——这是最常见的边界场景，先验证此再验证 maxItems 上限。
        </p>
      </DemoField>
    </section>

    <ApiTable title="ArrayNodeConfig" :items="arrayItems" anchor="api-array" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-x-form-array {
  &__summary {
    margin-top: 16px;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__total {
    margin-left: auto;
    font-size: 14px;

    strong {
      color: #409eff;
      font-size: 18px;
      margin-left: 4px;
    }
  }

  /* 总计独立 block：与上方按钮区分视觉层级，强提示聚合结果 */
  &__total-bar {
    margin-top: 12px;
    padding: 10px 16px;
    background: linear-gradient(90deg, #ecf5ff 0%, #f0f9ff 100%);
    border-left: 3px solid var(--el-color-primary);
    border-radius: 4px;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  &__total-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    font-weight: 500;
  }

  &__total-value {
    color: var(--el-color-primary);
    font-size: 22px;
    font-weight: 600;
    font-family: ui-monospace, 'Cascadia Code', Menlo, monospace;
  }

  &__state {
    margin-top: 16px;
    font-size: 12px;
    color: #909399;
  }
}
</style>
