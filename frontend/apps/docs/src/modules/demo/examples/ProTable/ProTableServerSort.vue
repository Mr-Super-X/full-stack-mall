<script setup lang="ts">
/**
 * ProTable 服务端排序 demo（M2 新增）
 *
 * 演示能力：
 * - ProColumn.sortable: 'custom' → 点击表头触发服务端排序（参数 orderByColumn/isAsc）
 * - 泛型列定义 ProColumn<Order> —— render/枚举类型安全（M1）
 * - 排序变化回第 1 页；第三击清除排序
 * - 默认参数序列化已满足本 demo 后端约定（orderByColumn/isAsc），未使用 sortParamsAdapter
 *
 * 验证步骤：
 * 1. 12 行订单，点击「金额」表头 → 升序；再点 → 降序；三击 → 恢复
 * 2. Network 面板确认请求带 orderByColumn=amount&isAsc=asc|desc
 * 3. 翻页到第 2 页后点排序 → 自动回第 1 页
 *
 * 关于 sortParamsAdapter：
 * 默认约定是「单列排序 + orderByColumn + isAsc」三参数（多数后端已能满足）。
 * 当后端约定不同（多列排序 / 自定义键名 / 嵌套字段路径）时，通过 sortParamsAdapter 改序列化形态，
 * 用法与 filterParamsAdapter 对称。本 demo 后端直接吃默认约定，无需额外 adapter。
 * 如需演示多列排序 / 自定义键名，可参考 filterParamsAdapter 写法。
 */
import type { ProColumn } from '@vv/ui/components/ProTable/types/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import {
  sortOrdersRequestApi,
  sortOrdersResponseAdapter,
  type Order,
} from '@mock/pro-table/sort-orders'
import { sortColumnItems, sortPropsItems, sortExposeItems } from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-server-sort')

const columns: ProColumn<Order>[] = [
  { prop: 'orderNo', label: '订单号', sortable: 'custom', minWidth: 140 },
  { prop: 'customer', label: '客户', search: { el: 'input' }, minWidth: 160 },
  { prop: 'amount', label: '金额（元）', sortable: 'custom', width: 120 },
  {
    prop: 'status',
    label: '状态',
    enum: [
      { label: '待支付', value: 'pending', tagType: 'warning' },
      { label: '已支付', value: 'paid', tagType: 'success' },
      { label: '已发货', value: 'shipped' },
    ],
  },
]

const tocItems = [
  { id: 'demo-server-sort', label: '能力演示' },
  { id: 'api-sort-column', label: 'ProColumn.sortable' },
  { id: 'api-sort-props', label: '排序 Props' },
  { id: 'api-sort-expose', label: 'Expose API' },
]

useDocToc(tocItems)

const basicCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="sortOrdersRequestApi"
    :response-adapter="sortOrdersResponseAdapter"
    row-key="id"
  />
</template>

<script setup lang="ts">
const columns: ProColumn<Order>[] = [
  { prop: 'orderNo', label: '订单号', sortable: 'custom' },
  { prop: 'customer', label: '客户', search: { el: 'input' } },
  { prop: 'amount', label: '金额', sortable: 'custom' }  // 服务端排序列
]
// 后端返回 { records, totalCount }，经 responseAdapter 映射为约定结构
const sortOrdersResponseAdapter = (raw) => ({
  data: raw.records,
  total: raw.totalCount,
  pageNum: 1,
  pageSize: 10,
})
<\/script>`
</script>

<template>
  <DemoFrame
    title="ProTableServerSort 服务端排序"
    source="src/components/ProTable/composables/useTable.ts"
    :introductions="[
      'sortable: \'custom\' 的列表头点击后，排序参数随请求发给后端（默认 orderByColumn/isAsc）。',
      '排序变化自动回第 1 页；第三击清除排序（el-table 原生三连点语义）。',
      '后端约定不同可用 sortParamsAdapter 改序列化形态（本 demo 未启用：默认约定已满足）。',
      '本 demo 后端返回 { records, totalCount }，经 responseAdapter 映射为约定结构。',
    ]"
  >
    <section id="demo-server-sort" :class="bem.b()">
      <DemoField label="基本用法（服务端排序 + 泛型列定义 + 响应适配）" :code="basicCode">
        <ProTable
          :columns="columns"
          :request-api="sortOrdersRequestApi"
          :response-adapter="sortOrdersResponseAdapter"
          row-key="id"
        />
      </DemoField>
    </section>

    <ApiTable title="ProColumn.sortable 字段" :items="sortColumnItems" anchor="api-sort-column" />
    <ApiTable title="排序相关 Props" :items="sortPropsItems" anchor="api-sort-props" />
    <ApiTable
      title="Expose API（getSortState）"
      :items="sortExposeItems"
      anchor="api-sort-expose"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-server-sort {
  // BEM 命名空间
}
</style>
