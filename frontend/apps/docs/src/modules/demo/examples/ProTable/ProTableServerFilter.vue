<script setup lang="ts">
/**
 * ProTable 服务端筛选 demo（v3.5 PR2 新增）
 *
 * 演示能力：
 * - filterParamsAdapter 把全表筛选快照序列化为后端约定的 { statusList, deptList } 形态
 * - el-table column.tableProps.filters 声明列头筛选下拉（2 列启用：状态 / 部门）
 * - createDate / amount 列在业务侧常用「日期范围 / 金额范围」弹窗作为筛选入口，
 *   此类场景通常由业务方自行驱动，不一定走 el-table 原生 column.filters 协议——
 *   本 demo 用空数组占位列头位以演示 filterParamsAdapter 对此类字段仍能透传
 * - 筛选变化自动回第 1 页 + 触发请求（与 sortParamsAdapter 对称）
 * - 父级监听 filter-change 事件可做 URL 同步 / 埋点上报
 *
 * 验证步骤：
 * 1. 12 行订单，点击「状态」表头筛选下拉 → 选「已支付」「已发货」→ 表格行数减少
 * 2. Network 面板确认请求带 statusList=['paid','shipped'] 参数
 * 3. 同时选部门：filterParamsAdapter 把 dept 序列化为 deptList 入请求
 * 4. 点击「重置」按钮 → 筛选清空 + 回到默认页
 */
import type { ProColumn } from '@vv/ui/components/ProTable/types/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import {
  filterOrdersRequestApi,
  filterOrdersParamsAdapter,
  type Order,
} from '@mock/pro-table/filter-orders'
import {
  filterColumnItems,
  filterPropsItems,
  filterExposeItems,
} from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-server-filter')

/** 当前全表筛选快照（监听 filter-change 事件做埋点 / URL 同步演示） */
const filterSnapshot = ref<Record<string, (string | number | boolean)[]>>({})

/** 列头筛选下拉：状态（单列多选） */
const statusFilters = [
  { text: '待支付', value: 'pending' },
  { text: '已支付', value: 'paid' },
  { text: '已发货', value: 'shipped' },
  { text: '已退款', value: 'refunded' },
]

/** 列头筛选下拉：部门（单列多选） */
const deptFilters = [
  { text: '技术部', value: 'tech' },
  { text: '市场部', value: 'marketing' },
  { text: '财务部', value: 'finance' },
  { text: '运营部', value: 'operations' },
]

/**
 * 列定义 —— 2 列启用列头筛选下拉（tableProps.filters 协议）。
 * - status / dept：单列多选下拉（el-table 原生 column.filters）
 * - createDate / amount：业务方用 onChange + 表头按钮驱动「日期范围 / 金额范围」弹窗，
 *   此处用「点击列头筛选图标触发 dialog」示意（demo 简化省略 dialog 部分代码，
 *   重点展示 filterParamsAdapter 把全表快照合并入请求）。
 */
const columns: ProColumn<Order>[] = [
  { prop: 'orderNo', label: '订单号', width: 130 },
  { prop: 'customer', label: '客户', minWidth: 140 },
  {
    prop: 'status',
    label: '状态',
    width: 110,
    enum: [
      { label: '待支付', value: 'pending', tagType: 'warning' },
      { label: '已支付', value: 'paid', tagType: 'success' },
      { label: '已发货', value: 'shipped', tagType: 'info' },
      { label: '已退款', value: 'refunded', tagType: 'danger' },
    ],
    tableProps: { filters: statusFilters, filterMultiple: true },
  },
  {
    prop: 'dept',
    label: '部门',
    width: 100,
    enum: [
      { label: '技术部', value: 'tech', tagType: 'success' },
      { label: '市场部', value: 'marketing', tagType: 'warning' },
      { label: '财务部', value: 'finance', tagType: 'info' },
      { label: '运营部', value: 'operations', tagType: 'primary' },
    ],
    tableProps: { filters: deptFilters, filterMultiple: true },
  },
  { prop: 'createDate', label: '创建日期', width: 120, tableProps: { filters: [] } },
  { prop: 'amount', label: '金额（元）', width: 120 },
]

const tocItems = [
  { id: 'demo-server-filter', label: '能力演示' },
  { id: 'api-filter-column', label: 'ProColumn 列头筛选' },
  { id: 'api-filter-props', label: 'filterParamsAdapter' },
  { id: 'api-filter-expose', label: 'Expose API' },
]

useDocToc(tocItems)

const basicCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="filterOrdersRequestApi"
    :filter-params-adapter="filterOrdersParamsAdapter"
    row-key="id"
    @filter-change="onFilterChange"
  />
</template>

<script setup lang="ts">
const columns = [
  {
    prop: 'status', label: '状态',
    tableProps: {
      filters: [
        { text: '已支付', value: 'paid' },
        { text: '已发货', value: 'shipped' },
      ],
      filterMultiple: true, // 多选
    },
  },
  // ... 其他列
]

/**
 * filterParamsAdapter —— 把全表筛选快照序列化为后端约定键名
 */
const filterOrdersParamsAdapter = (filters) => ({
  statusList: filters.status,  // 状态多选 → statusList
  deptList: filters.dept,      // 部门多选 → deptList
  // ... 其他字段按业务约定
})

const onFilterChange = (filters) => {
  // URL 同步 / 埋点上报（避免 console 污染 DevTools——真实业务应调 Sentry / ElMessage 提示）
  /* 处理筛选快照：filters */
}
<\/script>`
</script>

<template>
  <DemoFrame
    title="ProTableServerFilter 服务端筛选"
    source="src/components/ProTable/composables/useTable.ts"
    :introductions="[
      'filterParamsAdapter: (filters) => params —— 把全表筛选快照序列化为后端约定键名。',
      '列头筛选下拉：ProColumn.tableProps.filters 声明（el-table 原生 column.filters 协议）。',
      '筛选变化自动回第 1 页 + 触发请求（与 sortParamsAdapter 对称）。',
      '父级监听 filter-change 事件可做 URL 同步 / 埋点 / 上报。',
      '虚拟滚动（el-table-v2）引擎暂不支持列头筛选，本 demo 走 element-plus v1 引擎。',
    ]"
  >
    <section id="demo-server-filter" :class="bem.b()">
      <DemoField
        label="基本用法（status/dept 列筛选 + adapter 序列化 + 事件监听）"
        :code="basicCode"
      >
        <ProTable
          :columns="columns"
          :request-api="filterOrdersRequestApi"
          :filter-params-adapter="filterOrdersParamsAdapter"
          row-key="id"
          @filter-change="
            (filters: Record<string, (string | number | boolean)[]>) => (filterSnapshot = filters)
          "
        />
      </DemoField>

      <DemoField label="当前全表筛选快照（filter-change 事件 payload）" :code="''">
        <pre :class="bem.e('snapshot')">{{ JSON.stringify(filterSnapshot, null, 2) }}</pre>
      </DemoField>
    </section>

    <ApiTable title="列头筛选字段" :items="filterColumnItems" anchor="api-filter-column" />
    <ApiTable
      title="filterParamsAdapter Props"
      :items="filterPropsItems"
      anchor="api-filter-props"
    />
    <ApiTable
      title="Expose API（getFilterState + filter-change）"
      :items="filterExposeItems"
      anchor="api-filter-expose"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-server-filter {
  // 演示区 DOM 间隔（与兄弟 demo 对齐）
  & > * + * {
    margin-top: 16px;
  }

  // 筛选快照展示区：与 DocLayout 文档风格一致（等宽字体 + 浅灰底 + 圆角）
  &__snapshot {
    padding: 12px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    background: var(--el-fill-color-lighter);
    color: var(--el-text-color-regular);
    font-family: var(--el-font-family-monospace, monospace);
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
