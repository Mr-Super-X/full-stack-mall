<script setup lang="tsx">
/**
 * ProTable 表格内嵌 demo —— 用户提出的真实痛点 #2
 *
 * 演示 4 个业务高频内嵌场景：
 * ① 展开行内嵌子表格：订单 → 商品明细（key-value 子表）
 * ② 展开行内嵌详情卡片：订单 → 收货人 / 电话 / 地址 / 备注
 * ③ 复杂单元格：订单号带状态点 + 金额带进度条 + 操作按钮组（多按钮）
 * ④ 展开行内嵌批量操作：点开展开行可勾选子项 → 一键退款 / 一键发货
 *
 * 技术要点：
 * - 展开行走 ProColumn type='expand'；展开列的 prop 名即插槽名（ElementTableBody 按 col.prop
 *   透传插槽，见 @vv/ui/components/ProTable/components/ElementTableBody.vue），本 demo prop='expand'
 *   → 消费方写 <template #expand="{ row }">
 * - 展开面板用函数式组件（props 传 row），模板内以 <ExpandPanel :row="row" /> 挂载——
 *   SFC <template> 由 Vue 模板编译器处理，不支持 JSX 花括号调用 VNode 函数
 * - 子表格复用 ElTable + ElTableColumn，不嵌 ProTable（避免嵌套请求/状态污染）
 * - 进度条用 ElProgress，状态点用纯 CSS 圆点（避免引入图标库）
 * - ⚠️ TSX 中 element 组件必须显式 import（ElButton/ElTable/...）：项目 EP 按需注册、无全局组件，
 *   kebab-case JSX 标签运行时走 resolveComponent 会解析失败（AutoImport 只自动补 ElXxx 标识符）
 * - 多按钮组 + Popconfirm 确认交互（删除等高风险操作）
 */
import { ElButton, ElMessage, ElPopconfirm, ElProgress, ElTable, ElTableColumn } from 'element-plus'
import { ArrowDown, View } from '@element-plus/icons-vue'
import type { ProColumn, ProTableExpose } from '@vv/ui/components/ProTable/index.ts'
import type { OrderItem, ExpandOrder } from '@mock/pro-table/expand'
import { expandRequestApi } from '@mock/pro-table/expand'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { expandColumnItems, expandSlotItems } from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-expand')

/* ───────────── 业务工具 ───────────── */

const STATUS_DOT: Record<string, string> = {
  已完成: 'success',
  待发货: 'warning',
  已取消: 'info',
  部分退款: 'danger',
}

function formatMoney(n: number): string {
  return `¥ ${n.toLocaleString('zh-CN')}`
}

/** 展开行勾选的子项（仅 demo ④ 用） */
const expandedItemCheck = ref<Record<string, string[]>>({})

function toggleItemCheck(orderNo: string, sku: string): void {
  const cur = expandedItemCheck.value[orderNo] ?? []
  const next = cur.includes(sku) ? cur.filter((s) => s !== sku) : [...cur, sku]
  expandedItemCheck.value = { ...expandedItemCheck.value, [orderNo]: next }
}

function isItemChecked(orderNo: string, sku: string): boolean {
  return (expandedItemCheck.value[orderNo] ?? []).includes(sku)
}

async function batchRefund(orderNo: string): Promise<void> {
  const skus = expandedItemCheck.value[orderNo] ?? []
  if (skus.length === 0) {
    ElMessage.warning('请先勾选要退款的子项')
    return
  }
  // 走 §1.5 useConfirm composable：取消 resolve false（vs ElMessageBox 原生 reject cancel 字符串）
  // 不再需要 .then/.catch try-catch，调用方一行 await 即可
  const ok = await useConfirm({
    title: '批量退款',
    content: `确认对订单 ${orderNo} 的 ${skus.length} 个子项发起退款？`,
    type: 'warning',
  })
  if (ok) {
    ElMessage.success(`已对 ${skus.length} 个子项发起退款`)
    expandedItemCheck.value = { ...expandedItemCheck.value, [orderNo]: [] }
  } else {
    ElMessage.info('已取消')
  }
}

/* ───────────── 列定义（覆盖 ③ 复杂单元格） ───────────── */

const columns: ProColumn[] = [
  // 关键：el-table expand 必须有 type='expand' 列触发（ProColumn.type 透传 ElTableColumn.type）；
  // prop 名即展开行插槽名（ElementTableBody 按 col.prop 透传插槽）→ 消费 #expand="{ row }"
  {
    prop: 'expand',
    label: '',
    type: 'expand',
    width: 48,
    tableProps: { type: 'expand' },
  },
  // 复杂单元格：订单号带状态点
  {
    prop: 'orderNo',
    label: '订单号',
    width: 180,
    render: ({ row }) => {
      const status = String(row.status)
      const dotType = STATUS_DOT[status] ?? 'info'
      return (
        <div class={bem.e('order-no')}>
          <span class={`${bem.e('status-dot')} ${bem.e(`status-dot-${dotType}`)}`} />
          <span class={bem.e('order-no-text')}>{String(row.orderNo)}</span>
        </div>
      )
    },
  },
  { prop: 'customer', label: '客户', width: 100 },
  // 复杂单元格：金额带进度条（已支付 / 总金额）
  {
    prop: 'amount',
    label: '金额',
    width: 200,
    /**
     * render 注意 row 容错 —— el-table 首次挂载时会先调一次 row-less render
     * （row = {}），若 row.amount / row.paid 是 undefined，Number(undefined) = NaN
     * → ElProgress.percentage 拿到 NaN → 触发 "custom validator check failed"
     * （ElProgress.percentage validator: val => val >= 0 && val <= 100，NaN 不在范围）
     *
     * 修复策略：检测到字段缺失时降级为纯文本渲染（不挂 ElProgress），等数据就位再正常渲染
     */
    render: ({ row }) => {
      // 容错：el-table 首次 mount 时 row 可能是空对象（无 amount/paid 字段）
      if (row.amount === undefined || row.paid === undefined) {
        return <span class={bem.e('amount-cell-loading')}>—</span>
      }
      const amount = Number(row.amount)
      const paid = Number(row.paid ?? 0)
      const percent =
        amount === 0 ? 0 : Math.max(0, Math.min(100, Math.round((paid / amount) * 100)))
      const progressColor =
        percent === 100
          ? '#67c23a' // 已付清：success 绿
          : percent === 0
            ? '#f56c6c' // 未支付：danger 红
            : percent < 50
              ? '#e6a23c' // 进度低：warning 黄
              : '#409eff' // 50~99%：主色蓝
      return (
        <div class={bem.e('amount-cell')}>
          <div class={bem.e('amount-top')}>
            <strong>{formatMoney(paid)}</strong>
            <span class={bem.e('amount-total')}>/ {formatMoney(amount)}</span>
          </div>
          <ElProgress percentage={percent} color={progressColor} strokeWidth={6} showText={false} />
        </div>
      )
    },
  },
  // 状态 tag（search: select 使「程序化搜索 status」可见可验证 —— 选项来自 enum）
  {
    prop: 'status',
    label: '状态',
    width: 110,
    tableProps: { align: 'center' },
    search: { el: 'select' },
    enum: [
      { label: '已完成', value: '已完成', tagType: 'success' },
      { label: '待发货', value: '待发货', tagType: 'warning' },
      { label: '已取消', value: '已取消', tagType: 'info' },
      { label: '部分退款', value: '部分退款', tagType: 'danger' },
    ],
  },
  // 多按钮组（带 Popconfirm 二次确认）
  {
    prop: 'operation',
    label: '操作',
    type: 'operation',
    width: 220,
    fixed: 'right',
    render: ({ row }) => (
      <div class={bem.e('op-btn-group')}>
        <ElButton link type="primary" size="small" onClick={() => handleView(row)}>
          查看
        </ElButton>
        <ElButton link type="warning" size="small" onClick={() => handleShip(row)}>
          发货
        </ElButton>
        <ElPopconfirm title={`确认取消订单 ${row.orderNo}？`} onConfirm={() => handleCancel(row)}>
          {{
            reference: () => (
              <ElButton link type="danger" size="small">
                取消
              </ElButton>
            ),
          }}
        </ElPopconfirm>
      </div>
    ),
  },
]

function handleView(row: Record<string, unknown>): void {
  ElMessage.info(`查看订单 ${(row as unknown as ExpandOrder).orderNo}`)
}
function handleShip(row: Record<string, unknown>): void {
  ElMessage.success(`订单 ${(row as unknown as ExpandOrder).orderNo} 已发货`)
}
function handleCancel(row: Record<string, unknown>): void {
  ElMessage.warning(`订单 ${(row as unknown as ExpandOrder).orderNo} 已取消`)
}

/* ───────────── Expose API 验证 ───────────── */

const ref0 = ref<ProTableExpose | null>(null)
async function refreshAll(): Promise<void> {
  await ref0.value?.refresh()
  ElMessage.success('已手动 refresh')
}

/* ───────────── 展开行渲染辅助 ───────────── */

/**
 * 展开行内容 —— 函数式组件（props 传 row），模板内以 <ExpandPanel :row="row" /> 挂载
 *
 * 为什么必须是组件而不能在模板里调函数（如 {_renderExpandPanel(row)}）：
 * SFC <template> 由 Vue 模板编译器处理（非 JSX），花括号不是合法插值语法，
 * 函数引用会被当纯文本输出；函数式组件则走标准 props → VNode 渲染管线。
 *
 * 综合演示 ① 子表格 + ② 详情卡片 + ④ 批量操作
 *
 * @see ElementTableBody.vue —— 按 col.prop='expand' 透传 <slot name="expand" :row>
 */
const ExpandPanel = (props: { row: Record<string, unknown> }) => {
  const r = props.row as unknown as ExpandOrder
  // 防御：el-table 首次挂载会对展开列做一次 row 占位渲染（row 无 items/details 字段），
  // 直接取 r.items.length 会抛 undefined.length 崩掉整个页面（ErrorBoundary 兜底）；
  // 占位渲染时降级为空数组/空对象，真实数据行渲染时字段齐全不受影响
  const items = Array.isArray(r.items) ? r.items : []
  const details = r.details ?? {}
  return (
    <div class={bem.e('expand-grid')}>
      {/* ① 子表格 */}
      <section class={bem.e('expand-section')}>
        <header class={bem.e('expand-header')}>
          <h5 class={bem.e('expand-title')}>商品明细（{items.length} 件）</h5>
        </header>
        <ElTable data={items} border size="small" class={bem.e('expand-child-table')}>
          <ElTableColumn prop="sku" label="SKU" width="100" />
          <ElTableColumn prop="name" label="商品名称" min-width="160" />
          <ElTableColumn prop="qty" label="数量" width="70" align="right" />
          <ElTableColumn
            prop="price"
            label="单价（元）"
            width="110"
            align="right"
            v-slots={{
              default: (scope: { row: OrderItem }) => (
                <span>{formatMoney(Number(scope.row.price))}</span>
              ),
            }}
          />
          <ElTableColumn
            label="小计（元）"
            width="110"
            align="right"
            v-slots={{
              default: (scope: { row: OrderItem }) => (
                <strong>{formatMoney(Number(scope.row.qty) * Number(scope.row.price))}</strong>
              ),
            }}
          />
        </ElTable>
      </section>

      {/* ② 详情卡片 + ④ 批量操作按钮 */}
      <section class={bem.e('expand-section')}>
        <header class={bem.e('expand-header')}>
          <h5 class={bem.e('expand-title')}>订单详情</h5>
          <div class={bem.e('expand-actions')}>
            <ElButton type="warning" size="small" onClick={() => batchRefund(r.orderNo)}>
              批量退款（已选 {expandedItemCheck.value[r.orderNo]?.length ?? 0}）
            </ElButton>
          </div>
        </header>
        <dl class={bem.e('detail-list')}>
          <div class={bem.e('detail-row')}>
            <dt>收货人</dt>
            <dd>{details.receiver}</dd>
          </div>
          <div class={bem.e('detail-row')}>
            <dt>电话</dt>
            <dd>{details.phone}</dd>
          </div>
          <div class={bem.e('detail-row')}>
            <dt>地址</dt>
            <dd>{details.address}</dd>
          </div>
          <div class={bem.e('detail-row')}>
            <dt>备注</dt>
            <dd>{details.remark}</dd>
          </div>
        </dl>
      </section>

      {/* ④ 勾选子项（演示「展开行内嵌批量操作」） */}
      <section class={bem.e('expand-section')}>
        <header class={bem.e('expand-header')}>
          <h5 class={bem.e('expand-title')}>子项勾选（用于批量退款）</h5>
        </header>
        <div class={bem.e('item-check-grid')}>
          {items.map((item) => (
            <label
              key={item.sku}
              class={[
                bem.e('item-check'),
                isItemChecked(r.orderNo, item.sku) ? bem.e('item-check--checked') : '',
              ]}
            >
              <input
                type="checkbox"
                name={`item-check-${item.sku}`}
                checked={isItemChecked(r.orderNo, item.sku)}
                onChange={() => toggleItemCheck(r.orderNo, item.sku)}
              />
              <span>
                {item.name}（{formatMoney(Number(item.price))} × {item.qty}）
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ───────────── TOC ───────────── */

const tocItems = [{ id: 'demo-expand', label: '① ② ③ ④ 综合演示' }]

useDocToc(tocItems)

/* ───────────── 代码片段 ───────────── */

const expandCode = `<template>
  <ProTable :columns="columns" :request-api="api" row-key="id">
    <!-- 展开行插槽名 = 展开列的 prop 名（ElementTableBody 按 col.prop 透传插槽） -->
    <template #expand="{ row }">
      <div class="my-detail-panel">
        <h4>订单明细（{{ row.orderNo }}）</h4>
        <el-table :data="row.items">
          <el-table-column prop="sku" label="SKU" />
          <el-table-column prop="name" label="商品" />
          <el-table-column prop="qty" label="数量" />
        </el-table>
      </div>
    </template>
  </ProTable>
</template>

<script setup lang="ts">

const columns = [
  // ← 关键：type='expand' 触发展开列；prop 名即展开行插槽名
  { prop: 'expand', label: '', type: 'expand', width: 48 },
  { prop: 'orderNo', label: '订单号' },
  { prop: 'customer', label: '客户' },
]
<\/script>`

const complexCellCode = `// 复杂单元格：金额带进度条
{
  prop: 'amount',
  label: '金额',
  render: ({ row }) => h('div', null, [
    h('strong', null, \`¥ \${row.paid}\`),
    h('el-progress', {
      percentage: Math.round(row.paid / row.amount * 100),
      status: row.paid === row.amount ? 'success' : 'warning',
    }),
  ]),
}`
</script>

<template>
  <DemoFrame
    title="ProTableExpand 表格内嵌"
    source="src/modules/demo/examples/ProTable/ProTableExpand.vue"
    :introductions="[
      '业务真实痛点：订单表点开要看商品明细，用户表点开要看详情，单元格内要塞进度条/状态点/多按钮。',
      '本 demo 覆盖 4 个高频场景：① 展开行内嵌子表格 ② 展开行内嵌详情卡片 ③ 复杂单元格 ④ 展开行内嵌批量操作。',
      '展开列 type=&quot;expand&quot;，展开行内容走与列 prop 同名的插槽（如 prop=&quot;expand&quot; → #expand=&quot;{ row }&quot;）。',
      '子表格复用 ElTable + ElTableColumn，不嵌 ProTable（避免嵌套请求/状态污染）。',
    ]"
  >
    <section :id="tocItems[0]!.id" :class="bem.b()">
      <DemoField label="① ② ③ ④：展开行子表 + 详情卡片 + 复杂单元格 + 批量操作" :code="expandCode">
        <p :class="bem.e('hint')">
          操作：点任意行左侧「▸」展开 →
          <strong>①</strong>
          上方「商品明细」子表格（SKU/名称/数量/单价/小计） +
          <strong>②</strong>
          下方「订单详情」卡片（收货人/电话/地址/备注） +
          <strong>④</strong>
          「批量退款」勾选子项后一键退款
        </p>
        <p :class="bem.e('hint')">
          <strong>③</strong>
          复杂单元格：订单号带状态点 · 金额带进度条 · 操作列多按钮组（含 Popconfirm 二次确认）
        </p>
        <el-button type="primary" :icon="ArrowDown" @click="refreshAll">手动 refresh</el-button>
        <el-button :icon="View" @click="ref0?.setSearchParams?.({ status: '部分退款' })">
          程序化搜索「部分退款」
        </el-button>
        <ProTable
          ref="ref0"
          :columns="columns"
          :request-api="expandRequestApi"
          table-key="demo-pro-table-expand"
          row-key="id"
          :page-size="5"
        >
          <!-- 展开行：综合 ① 子表格 + ② 详情卡片 + ④ 批量操作 -->
          <!-- 插槽名 = 展开列的 prop 名（ElementTableBody 按 col.prop 透传） -->
          <!-- ExpandPanel 为函数式组件，:row 传父表行数据 -->
          <template #expand="{ row }">
            <div :class="bem.e('expand-panel')">
              <ExpandPanel :row="row" />
            </div>
          </template>
        </ProTable>
      </DemoField>
    </section>

    <!-- ③ 复杂单元格代码片段 -->
    <section :class="bem.b()">
      <DemoField
        label="③ 复杂单元格代码片段（金额带进度条 + 订单号带状态点）"
        :code="complexCellCode"
      >
        <p :class="bem.e('hint')">
          上方 ProTable 已完整演示。下方代码片段演示核心写法（render 返回复杂 VNode 树）。
        </p>
      </DemoField>
    </section>

    <ApiTable title="expand 列字段（v3.1）" :items="expandColumnItems" anchor="api-expand-column" />
    <ApiTable title="expand 插槽与内嵌用法" :items="expandSlotItems" anchor="api-expand-slot" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-expand {
  padding: 16px;

  &__hint {
    margin: 0 0 12px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    font-size: 13px;
    color: var(--el-text-color-regular);

    strong {
      color: var(--el-color-primary);
      margin: 0 4px;
    }
  }

  /* ───────────── ③ 复杂单元格 ───────────── */

  &__order-no {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  &__status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &-success {
      background: var(--el-color-success);
      box-shadow: 0 0 0 2px var(--el-color-success-light-9);
    }
    &-warning {
      background: var(--el-color-warning);
      box-shadow: 0 0 0 2px var(--el-color-warning-light-9);
    }
    &-danger {
      background: var(--el-color-danger);
      box-shadow: 0 0 0 2px var(--el-color-danger-light-9);
    }
    &-info {
      background: var(--el-color-info);
      box-shadow: 0 0 0 2px var(--el-color-info-light-9);
    }
  }

  &__order-no-text {
    font-family: ui-monospace, 'Cascadia Code', Menlo, monospace;
    font-size: 13px;
  }

  &__amount-cell {
    width: 100%;
  }

  &__amount-top {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
    font-size: 13px;

    strong {
      font-weight: 600;
    }
  }

  &__amount-total {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  &__op-btn-group {
    display: flex;
    gap: 4px;
    justify-content: center;
    align-items: center;
  }

  /* ───────────── ①②④ 展开行内容 ───────────── */

  &__expand-panel {
    padding: 16px 24px;
    background: var(--el-fill-color-light);
  }

  &__expand-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  }

  /* 第三个 section（勾选子项）跨整行 */
  &__expand-section {
    min-width: 0;
    background: var(--el-bg-color);
    border-radius: 4px;
    padding: 12px 16px;

    &:last-child {
      grid-column: 1 / -1;
    }
  }

  &__expand-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  &__expand-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  &__expand-actions {
    display: flex;
    gap: 8px;
  }

  &__expand-child-table {
    width: 100%;
  }

  /* ─── ② 详情卡片（key-value） ─── */

  &__detail-list {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  &__detail-row {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 8px;
    font-size: 13px;

    dt {
      margin: 0;
      color: var(--el-text-color-secondary);
      font-weight: 500;
    }

    dd {
      margin: 0;
      color: var(--el-text-color-primary);
    }
  }

  /* ─── ④ 勾选子项（批量退款） ─── */

  &__item-check-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__item-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--el-fill-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;

    input[type='checkbox'] {
      cursor: pointer;
    }

    &--checked {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-5);
    }

    &:hover {
      border-color: var(--el-color-primary-light-5);
    }
  }
}
</style>
