<script setup lang="ts">
/**
 * ProTable SearchForm + 列头筛选组合 demo（批 D 修复场景的浏览器验证入口）
 *
 * 与 ProTableServerFilter（纯列头筛选）/ ProTableSearchAdvanced（纯 SearchForm）的差异：
 * - 顶部 SearchForm 关键字搜索（orderNo / customer）与列头筛选（status / dept）共存
 * - 两者 AND 语义：搜索参数 + filterParamsAdapter 序列化结果合并入同一请求
 * - 批 D 修复点：reset 同时清搜索表单 / filterState / 列头筛选 UI，
 *   并补发 filter-change({})——快照面板随 reset 清空
 *
 * 验证步骤（重点观察「本次请求实际参数」面板——两通道条件如何 AND 合并）：
 * 1. 顶部订单号搜「FO-202601」→ 行 1 行；参数面板出现 orderNo + 分页参数
 * 2. 列头筛选 状态=已支付 → 行数减少，快照面板 {"status":["paid"]}；参数面板叠加 statusList
 * 3. 列头再筛 部门=技术部 → 快照合并 {"status":["paid"],"dept":["tech"]}；参数面板三条件并存（AND）
 * 4. 点「重置筛选」→ 参数面板只剩分页参数、快照面板 {}（批 D：reset 补发 filter-change 双清）
 * 5. 组合语义：搜索与筛选同时存在时，请求参数同时携带两组条件
 *
 * 路由：自动注册为 /demo/pro-table-search-filter
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

const bem = createNamespace('demo-pro-table-search-filter')

/** 当前全表筛选快照（filter-change 事件 payload；reset 补发 {} 后面板清空——批 D 验证点） */
const filterSnapshot = ref<Record<string, (string | number | boolean)[]>>({})

/**
 * 本次请求实际参数记录 —— 让「SearchForm 与列头筛选如何关联」可观察：
 * 两个通道的条件 AND 合并进同一请求的 params（orderNo/customer 来自 SearchForm；
 * statusList/deptList 来自列头筛选快照经 filterParamsAdapter 序列化）。每次请求触发即更新。
 */
const lastRequestParams = ref<Record<string, unknown> | null>(null)

async function searchFilterRequestApi(
  params: Record<string, unknown>
): ReturnType<typeof filterOrdersRequestApi> {
  lastRequestParams.value = { ...params }
  return filterOrdersRequestApi(params as never)
}

const statusFilters = [
  { text: '待支付', value: 'pending' },
  { text: '已支付', value: 'paid' },
  { text: '已发货', value: 'shipped' },
  { text: '已退款', value: 'refunded' },
]

const deptFilters = [
  { text: '技术部', value: 'tech' },
  { text: '市场部', value: 'marketing' },
  { text: '财务部', value: 'finance' },
  { text: '运营部', value: 'operations' },
]

/**
 * 列定义 —— SearchForm 字段（search 配置）与列头筛选（tableProps.filters）共存：
 * - orderNo / customer：仅 SearchForm 入口（关键字模糊搜索）
 * - status：SearchForm select + 列头 filters 双重入口（真实业务常见）
 * - dept：仅列头 filters 入口
 */
const columns: ProColumn<Order>[] = [
  {
    prop: 'orderNo',
    label: '订单号',
    width: 130,
    search: { el: 'input', debounce: 300 },
  },
  {
    prop: 'customer',
    label: '客户',
    minWidth: 140,
    search: { el: 'input' },
  },
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
    search: { el: 'select' },
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
  { prop: 'createDate', label: '创建日期', width: 120 },
  { prop: 'amount', label: '金额（元）', width: 120 },
]

const tocItems = [
  { id: 'demo-search-filter', label: '组合演示' },
  { id: 'api-search-filter-column', label: '列头筛选字段' },
  { id: 'api-search-filter-props', label: 'filterParamsAdapter' },
  { id: 'api-search-filter-expose', label: 'Expose API' },
]

useDocToc(tocItems)

const basicCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="searchFilterRequestApi"
    :filter-params-adapter="filterOrdersParamsAdapter"
    row-key="id"
    @filter-change="onFilterChange"
  />
</template>

// columns：SearchForm 字段（search 配置）+ 列头筛选（tableProps.filters）共存
const columns = [
  { prop: 'orderNo', search: { el: 'input', debounce: 300 } },   // 仅 SearchForm
  { prop: 'status', search: { el: 'select' },
    tableProps: { filters: statusFilters, filterMultiple: true } }, // 双重入口
  { prop: 'dept', tableProps: { filters: deptFilters, filterMultiple: true } }, // 仅列头
]

// 语义：搜索参数 + adapter 序列化结果 AND 合并入同一请求 params——
// 观察 demo 的「本次请求实际参数」面板可看到 orderNo + statusList + deptList 并存；
// reset 同时清两边 + 补发 filter-change({})（批 D）`
</script>

<template>
  <DemoFrame
    title="ProTableSearchFilter 搜索 + 列头筛选组合"
    source="src/components/ProTable/composables/useTable.ts"
    :introductions="[
      'SearchForm（顶部关键字搜索）与列头筛选（tableProps.filters）共存，AND 语义合并入同一请求。',
      'filter-change payload 为全表合并快照（EP 2.14 增量负载不外泄，批 D 修复点）。',
      'reset 同时清搜索表单 / filterState / 列头筛选 UI，并补发 filter-change({})——快照面板随 reset 清空。',
    ]"
  >
    <section id="demo-search-filter" :class="bem.b()">
      <DemoField label="基本用法（SearchForm + 列头筛选 + adapter + 事件监听）" :code="basicCode">
        <p :class="bem.e('hint')">
          两个筛选通道如何关联？
          <strong>看下方「本次请求实际参数」面板</strong>
          ：顶部 SearchForm 输入的 orderNo/customer 与列头筛选经 adapter 序列化的
          statusList/deptList，AND 合并进
          <strong>同一请求</strong>
          。验证：① 顶部订单号搜「FO-202601」→ 参数带 orderNo、行 1 行 ② 列头筛 状态=已支付 → 快照
          {"status":["paid"]}、参数叠加 statusList ③ 再筛 部门=技术部 → 快照合并两列、参数三条件并存
          ④ 点「重置筛选」→ 参数只剩分页、快照 {}
        </p>
        <ProTable
          :columns="columns"
          :request-api="searchFilterRequestApi"
          :filter-params-adapter="filterOrdersParamsAdapter"
          row-key="id"
          table-key="demo-search-filter"
          @filter-change="
            (filters: Record<string, (string | number | boolean)[]>) => (filterSnapshot = filters)
          "
        />
      </DemoField>

      <DemoField label="当前全表筛选快照（filter-change 事件 payload）" :code="''">
        <pre :class="bem.e('snapshot')">{{ JSON.stringify(filterSnapshot, null, 2) }}</pre>
      </DemoField>

      <DemoField label="本次请求实际参数（搜索 + 筛选 AND 合并入同一请求）" :code="''">
        <pre :class="bem.e('snapshot')">{{
          JSON.stringify(lastRequestParams, null, 2) ?? '（触发任意搜索/筛选/翻页后显示）'
        }}</pre>
      </DemoField>
    </section>

    <ApiTable title="列头筛选字段" :items="filterColumnItems" anchor="api-search-filter-column" />
    <ApiTable
      title="filterParamsAdapter Props"
      :items="filterPropsItems"
      anchor="api-search-filter-props"
    />
    <ApiTable
      title="Expose API（getFilterState + filter-change）"
      :items="filterExposeItems"
      anchor="api-search-filter-expose"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-search-filter {
  // 演示区 DOM 间隔（与兄弟 demo 对齐）
  & > * + * {
    margin-top: 16px;
  }

  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  // 筛选快照展示区：与 ServerFilter demo 同款风格
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
