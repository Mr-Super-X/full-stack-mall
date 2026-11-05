<script setup lang="ts">
/**
 * ProTable 单元格合并 demo（spec §五.3 / §八.3）
 *
 * 演示能力：
 * - 同列相邻值相等自动纵向合并（默认行为，direction: 'row'）
 * - 自定义 judge 函数（按业务规则合并）
 * - 跨列合并（colspan > 1，通过 row._spanTarget 字段标记）
 * - 合并上限 maxMergeSpan（防单列合并成 1 行的 UX 灾难）
 *
 * 验证步骤：
 * - Demo 1：商品 + 状态列按相邻值相等自动合并（rowspan）
 * - Demo 2：金额 ≥ 10000 的订单「订单号 + 商品」列横向合并（colspan=2）
 * - Demo 3：金额范围（>=10000 标记为"高金额"）自定义 judge 合并
 */
import type { ProColumn } from '@vv/ui/components/ProTable/types/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { ordersRequestApi } from '@mock/pro-table/orders'
import { cellSpanColumnItems, cellSpanConfigItems } from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-cell-span')

/* ───────────── Demo 1：行合并（默认行为） ───────────── */

const rowSpanColumns: ProColumn[] = [
  { prop: 'orderNo', label: '订单号' },
  { prop: 'product', label: '商品', span: { direction: 'row' } },
  { prop: 'qty', label: '数量' },
  { prop: 'status', label: '状态', span: { direction: 'row' } },
]

const rowSpanCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="requestApi"
    :enable-cell-span="true"
    row-key="id"
  />
</template>

<script setup lang="ts">
const columns = [
  { prop: 'orderNo', label: '订单号' },
  // span.direction='row' → 同列相邻值相等自动纵向合并
  { prop: 'product', label: '商品', span: { direction: 'row' } },
  { prop: 'status', label: '状态', span: { direction: 'row' } }
]
<\/script>`

/* ───────────── Demo 2：列合并（_spanTarget + colspan） ───────────── */

// 包装 mock：每行带 amount（随机分布）+ _spanTarget（高金额订单触发合并）
// 业务判定：amount > 10000 视为高金额 → orderNo 列横向合并到 product
async function loadOrdersWithColSpan(): Promise<{
  data: Record<string, unknown>[]
  total: number
  pageNum: number
  pageSize: number
}> {
  const res = await ordersRequestApi({} as Record<string, unknown>)
  const data = res.data.map((row) => {
    // 随机分布金额：5000~20000 之间，避开 10000 临界值 ±500 让高/低金额分层明确
    const amount = Math.round(5000 + Math.random() * 15000)
    const isHighAmount = amount > 10000
    return {
      ...row,
      amount,
      // 高金额订单合并 orderNo+product 为 1 列（_spanTarget='orderNo' → orderNo 列 colspan=2）
      ...(isHighAmount ? { _spanTarget: 'orderNo' } : {}),
    }
  })
  return { ...res, data }
}

const colSpanColumns: ProColumn[] = [
  { prop: 'orderNo', label: '订单号+金额', width: 100, span: { direction: 'column' } }, // ← 接受 colspan
  { prop: 'product', label: '商品' },
  { prop: 'qty', label: '数量' },
  { prop: 'status', label: '状态' },
]

const colSpanCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="loadWithColSpan"
    :enable-cell-span="true"
    row-key="id"
  />
</template>

<script setup lang="ts">
// data 改造：row._spanTarget = 'orderNo' → orderNo 列展示为 colspan=2（合并到 product 列）
const ordersWithColSpan = (data) => data.map((row, i) => ({
  ...row,
  ...(i % 2 === 0 ? { _spanTarget: 'orderNo' } : {})
}))
<\/script>`

/* ───────────── Demo 3：自定义 judge（按业务规则合并） ───────────── */

// judge：amount >= 10000 视为「高金额」，相邻高金额合并
function amountJudge(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return (Number(a['amount']) ?? 0) >= 10000 && (Number(b['amount']) ?? 0) >= 10000
}

const customJudgeColumns: ProColumn[] = [
  { prop: 'orderNo', label: '订单号' },
  { prop: 'product', label: '商品' },
  { prop: 'amount', label: '金额', span: { direction: 'row', judge: amountJudge } },
  { prop: 'status', label: '状态' },
]

const customJudgeCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="requestApi"
    :enable-cell-span="true"
    row-key="id"
  />
</template>

<script setup lang="ts">
// span.judge 自定义合并规则（这里是「金额 >= 10000 视为高金额，相邻合并」）
const columns = [
  { prop: 'product', label: '商品' },
  { prop: 'amount', label: '金额', span: {
    direction: 'row',
    judge: (a, b) => a.amount >= 10000 && b.amount >= 10000
  } },
]
<\/script>`

// 包装 mock 同样加 amount —— 数据设计让 ≥10000 相邻成对
async function loadOrdersWithAmount(): Promise<{
  data: Record<string, unknown>[]
  total: number
  pageNum: number
  pageSize: number
}> {
  const res = await ordersRequestApi({} as Record<string, unknown>)
  // 让 ORD002+ORD003 相邻都是 ≥10000 → 合并为一组
  const data = res.data.map((row, i) => ({
    ...row,
    amount: [15000, 12000, 18000, 8000, 20000, 5000][i] ?? 10000,
  }))
  return { ...res, data }
}

/* ───────────── 目录 ───────────── */

const tocItems = [
  { id: 'demo-cell-span-row', label: '行合并（rowspan）' },
  { id: 'demo-cell-span-col', label: '列合并（colspan）' },
  { id: 'demo-cell-span-judge', label: '自定义 judge 合并' },
  { id: 'api-cell-span-column', label: 'ProColumn.span 字段' },
  { id: 'api-cell-span-config', label: 'CellSpanConfig 配置' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableCellSpan 单元格合并"
    source="src/components/ProTable/composables/useCellSpan.ts"
    :introductions="[
      '基于 useCellSpan composable 包装 element-plus spanMethod 协议。',
      '三种合并模式：① 同列相邻值自动纵向合并 ② 自定义 judge 判定合并 ③ 跨列合并（_spanTarget 标记）。',
      '下方 3 个 demo 分别演示：行合并、列合并、自定义 judge。',
    ]"
  >
    <!-- Demo 1：行合并 -->
    <section id="demo-cell-span-row" :class="bem.b()">
      <DemoField label="① 行合并（span.direction='row'，相邻同值自动合并）" :code="rowSpanCode">
        <div :class="bem.e('row-merge-legend')">
          🔵 蓝色左边框 = rowspan 锚点单元格（被合并的起始格）
        </div>
        <ProTable
          :columns="rowSpanColumns"
          :request-api="ordersRequestApi"
          :enable-cell-span="true"
          row-key="id"
          :page-size="12"
        />
      </DemoField>
    </section>

    <!-- Demo 2：列合并（高金额订单才合并） -->
    <section id="demo-cell-span-col" :class="bem.b()">
      <DemoField
        label="② 列合并（span.direction='column' + row._spanTarget 字段标记）"
        :code="colSpanCode"
      >
        <div :class="bem.e('col-merge-legend')">
          🟢 绿色上边框 = colspan 锚点单元格（订单号 + 商品 合并为 1 列）
          <br />
          注：只有高金额订单（≥ 10000）会触发合并
        </div>
        <ProTable
          :columns="colSpanColumns"
          :request-api="loadOrdersWithColSpan"
          :enable-cell-span="true"
          row-key="id"
          :page-size="12"
        />
      </DemoField>
    </section>

    <!-- Demo 3：自定义 judge -->
    <section id="demo-cell-span-judge" :class="bem.b()">
      <DemoField
        label="③ 自定义 judge（span.judge：金额 ≥ 10000 视为高金额合并）"
        :code="customJudgeCode"
      >
        <div :class="bem.e('judge-merge-legend')">
          🟠 橙色左边框 = 自定义 judge 合并的起始格
          <br />
          注：amount ≥ 10000 的相邻订单会被合并（如 ORD002+ORD003 均为 ≥10000）
        </div>
        <ProTable
          :columns="customJudgeColumns"
          :request-api="loadOrdersWithAmount"
          :enable-cell-span="true"
          row-key="id"
          :page-size="12"
        />
      </DemoField>
    </section>

    <ApiTable
      title="ProColumn.span 字段"
      :items="cellSpanColumnItems"
      anchor="api-cell-span-column"
    />
    <ApiTable
      title="CellSpanConfig 配置（maxMergeSpan 等）"
      :items="cellSpanConfigItems"
      anchor="api-cell-span-config"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-cell-span {
  // ─── 行合并 demo 视觉标记（蓝色边框 = rowspan） ───
  &#{&}__row-merge-legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    padding: 4px 10px;
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: 4px;
    color: var(--el-color-primary);
    font-size: 12px;
  }

  // ─── 列合并 demo 视觉标记（绿色边框 = colspan） ───
  &#{&}__col-merge-legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    padding: 4px 10px;
    background: var(--el-color-success-light-9);
    border: 1px solid var(--el-color-success-light-5);
    border-radius: 4px;
    color: var(--el-color-success);
    font-size: 12px;
  }

  // ─── 自定义 judge demo 视觉标记（橙色边框） ───
  &#{&}__judge-merge-legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    padding: 4px 10px;
    background: var(--el-color-warning-light-9);
    border: 1px solid var(--el-color-warning-light-5);
    border-radius: 4px;
    color: var(--el-color-warning);
    font-size: 12px;
  }

  // ─── 合并单元格 cell 边框 + 背景（v2.0 用 cellClassName 标记） ───
  // 行合并（rowspan > 1 的 anchor cell）：蓝色边框 + 浅蓝背景
  .el-table td.is-merge-rowspan {
    border-left: 4px solid var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
  }
  // 列合并（colspan > 1 的 anchor cell）：绿色边框 + 浅绿背景
  .el-table td.is-merge-colspan {
    border-top: 4px solid var(--el-color-success);
    background-color: var(--el-color-success-light-9);
  }
  // 自定义 judge 合并：橙色边框 + 浅橙背景（叠加在 is-merge-rowspan 上）
  .el-table td.is-merge-rowspan.is-merge-judge {
    border-left-color: var(--el-color-warning);
    background-color: var(--el-color-warning-light-9);
  }
}
</style>
