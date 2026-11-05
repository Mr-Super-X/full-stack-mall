<script setup lang="ts">
/**
 * ProTable v3.0 客户端汇总行 demo（5a）
 *
 * 演示能力：
 * - 4 种聚合函数（sum / avg / count / max / min）
 * - 自定义 formatter（金额前缀 ¥）
 * - 整行 label 自定义（默认"合计"）
 *
 * 验证步骤：
 * 1. 表格底部显示「本页合计」行，第一列 label + 数量合计 + 平均单价 + 最高折扣
 * 2. 翻页 → 汇总行随当前页数据重算
 * 3. 翻到第 2 页（10 行后 11-20 行）→ 数量合计、平均单价变化（与第 1 页不同）
 */
import type { ProColumn, ProTableExpose } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { summaryOrdersRequestApi } from '@mock/pro-table/summary-orders'
import { summaryConfigItems, summaryColumnItems } from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-summary')

/**
 * 本地 Order interface 与 mock 模块独立：mock 模块（@mock/pro-table/summary-orders）
 * 未导出 Order 类型（mock 仅暴露 requestApi 返回 Record<string, unknown>[]），
 * 为 ProColumn<Order> 泛式强类型推导 + 业务可读性，按需保留独立 interface。
 * 不要反向去 mock 模块加 Order 类型导出（会破坏 mock 与其他 demo 共享的「字段弱类型」契约）。
 */
interface Order {
  id: number
  product: string
  quantity: number
  price: number
  discount: number
}

const columns: ProColumn<Order>[] = [
  { prop: 'id', label: '订单号', width: 100 },
  { prop: 'product', label: '商品名称', minWidth: 160 },
  { prop: 'quantity', label: '数量', width: 100, tableProps: { align: 'right' as const } },
  {
    prop: 'price',
    label: '单价',
    width: 120,
    tableProps: { align: 'right' as const },
    enum: [
      { label: '低价', value: 50, tagType: 'info' as const },
      { label: '中价', value: 100, tagType: 'warning' as const },
      { label: '高价', value: 150, tagType: 'danger' as const },
    ],
  },
  { prop: 'discount', label: '折扣', width: 120, tableProps: { align: 'right' as const } },
]

const tableRef = ref<ProTableExpose | null>(null)

async function handleRefresh(): Promise<void> {
  await tableRef.value?.refresh()
}

/* ───────────── 代码片段（DemoField 高亮展示） ───────────── */

const basicCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="requestApi"
    :enable-summary="{
      label: '本页合计',
      columns: {
        quantity: { aggregate: 'sum' },
        price: { aggregate: 'avg' },
        discount: { aggregate: 'max' },
      },
    }"
  />
</template>`

/* ───────────── 目录导航 ───────────── */

const tocItems = [
  { id: 'demo-summary', label: '能力演示' },
  { id: 'api-summary-config', label: 'enableSummary 配置' },
  { id: 'api-summary-column', label: 'ColumnSummaryConfig 字段' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableSummary 客户端汇总行"
    source="src/components/ProTable/composables/useSummary.ts"
    :introductions="[
      '基于 useSummary composable 实现的客户端聚合：sum/avg/count/max/min 五种聚合，data 变化自动重算。',
      '下方演示：本页合计（quantity sum + price avg + discount max）+ 自定义 formatter（金额前缀 ¥）。',
      '配套 ProTableProps.enableSummary 声明汇总配置，columns[prop].summary 或独立 config.columns 控制列级聚合。',
    ]"
  >
    <section id="demo-summary" :class="bem.b()">
      <DemoField label="基本用法" :code="basicCode">
        <ProTable
          ref="tableRef"
          :columns="columns"
          :request-api="summaryOrdersRequestApi"
          table-key="demo-pro-table-summary"
          row-key="id"
          :enable-summary="{
            label: '本页合计',
            columns: {
              quantity: { aggregate: 'sum', label: '数量合计' },
              price: {
                aggregate: 'avg',
                label: '平均单价',
                formatter: (v) => `¥${v.toFixed(2)}`,
              },
              discount: { aggregate: 'max', label: '最高折扣' },
            },
          }"
        />
        <div :class="bem.e('actions')">
          <el-button type="primary" @click="handleRefresh">刷新（验证 data 变化重算）</el-button>
        </div>
      </DemoField>
    </section>

    <ApiTable title="enableSummary 配置" :items="summaryConfigItems" anchor="api-summary-config" />
    <ApiTable
      title="ColumnSummaryConfig 字段"
      :items="summaryColumnItems"
      anchor="api-summary-column"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-summary {
  &__actions {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
}
</style>
