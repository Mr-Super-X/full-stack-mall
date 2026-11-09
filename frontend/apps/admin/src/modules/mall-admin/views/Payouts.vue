<script setup lang="ts">
/**
 * 结算审批页（mall-admin 模块）：Payout 三步状态机 PENDING→CONFIRMED→PAID。
 *
 * 表格用全局组件 ProTable（@vv/ui 自动注册，AGENTS.md「表格用 ProTable」既定模式）——
 * columns + request-api 声明式，内建 Loading/Error/Empty 三态，不用原生 el-table 手写三态。
 * 状态 Tab 在 ProTable 上方做外部筛选；操作列按状态显示：PENDING「初审通过」、CONFIRMED「确认打款」、PAID 无操作。
 * 金额列 hover 提示拆账恒等（应结+佣金=订单金额）。审批成功 reload 对齐真态；
 * 400（状态已变迁）错误 toast 且强制刷新，不留「幻觉成功」（Review Focus #6）。
 * 权限：路由 meta.permissions=['mall:admin']。
 */
defineOptions({ name: 'MallAdminPayouts' })

import type { ProColumn, ProTableResponse } from '@vv/ui/components/ProTable'
import { usePayoutApproval } from '../index'
import { adminPayoutApi } from '../apis/payouts'
import type { AdminPayoutItem } from '../index'

const bem = createNamespace('mall-admin-payouts')

const { status, confirm, pay } = usePayoutApproval()

const STATUS_TABS = [
  { label: '待初审', value: 'PENDING' },
  { label: '待打款', value: 'CONFIRMED' },
  { label: '已打款', value: 'PAID' },
]

/** 状态枚举 → 中文标签（后端返回英文枚举，表格渲染用中文；单一事实源 = STATUS_TABS） */
function statusLabel(status: string): string {
  return STATUS_TABS.find((t) => t.value === status)?.label ?? status
}

/** ProTable 数据源：按当前 status 拉结算单，包装为 ProTableResponse（纯列表无分页，total=长度）。
 *  状态切换经 v-model 双向绑定 status（绕开 el-tabs EpProp 严格类型摩擦），变化触发 request-api 重取。 */
async function requestApi(): Promise<ProTableResponse<AdminPayoutItem>> {
  const list = await adminPayoutApi.list(String(status.value))
  return { data: list, total: list.length, pageNum: 1, pageSize: list.length || 1 }
}

const columns: ProColumn<AdminPayoutItem>[] = [
  { prop: 'id', label: '结算单号', width: 90 },
  { prop: 'sellerId', label: '卖家 ID', width: 90 },
  { prop: 'orderItemId', label: '订单行 ID', width: 100 },
  { prop: 'sellerAmount', label: '应结金额', width: 130 },
  { prop: 'commission', label: '平台佣金', width: 130 },
  { prop: 'status', label: '状态', width: 110 },
  { prop: 'createTime', label: '创建时间', width: 170 },
  { prop: 'operation', label: '操作', width: 140, type: 'operation', fixed: 'right' },
]

function formatMoney(v: number): string {
  return `¥${v.toFixed(2)}`
}

/** 拆账恒等提示：应结 + 佣金 = 订单金额（hover 可读性） */
function splitHint(row: AdminPayoutItem): string {
  return `应结 ${formatMoney(row.sellerAmount)} + 佣金 ${formatMoney(row.commission)} = 订单金额`
}

async function onConfirm(row: AdminPayoutItem): Promise<void> {
  const ok = await useConfirm(`确认初审通过结算单 #${row.id}？`)
  if (!ok) return
  try {
    await confirm(row.id)
    ElMessage.success('已初审通过')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '初审失败')
  }
}

async function onPay(row: AdminPayoutItem): Promise<void> {
  const ok = await useConfirm(`确认打款给卖家 #${row.sellerId}（结算单 #${row.id}）？`)
  if (!ok) return
  try {
    await pay(row.id)
    ElMessage.success('已打款')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '打款失败')
  }
}
</script>

<template>
  <div :class="bem.b()">
    <!-- @ts-expect-error element-plus el-tabs v-model 的 EpProp 泛型与 string 状态在 Vue 3.6 beta SFC 模板里类型摩擦（运行时行为正确），对齐项目 RichTextEditor 对第三方库类型缺口的既定模式 -->
    <el-tabs v-model="status">
      <el-tab-pane v-for="t in STATUS_TABS" :key="t.value" :label="t.label" :name="t.value" />
    </el-tabs>

    <!-- :key=status：切 Tab 强制重挂载 ProTable，触发 onMounted 重新拉取当前状态的列表
         （ProTable 靠分页参数变化触发重取，不会因 request-api 闭包里的 status 变化自动刷新） -->
    <ProTable
      :key="status"
      :columns="columns"
      :request-api="requestApi"
      :pagination="false"
      row-key="id"
      :class="bem.e('table')"
    >
      <template #id="{ row }">#{{ (row as AdminPayoutItem).id }}</template>
      <template #sellerId="{ row }">{{ (row as AdminPayoutItem).sellerId }}</template>
      <template #orderItemId="{ row }">{{ (row as AdminPayoutItem).orderItemId }}</template>
      <template #sellerAmount="{ row }">
        <span :title="splitHint(row as AdminPayoutItem)">
          {{ formatMoney((row as AdminPayoutItem).sellerAmount) }}
        </span>
      </template>
      <template #commission="{ row }">
        <span :title="splitHint(row as AdminPayoutItem)">
          {{ formatMoney((row as AdminPayoutItem).commission) }}
        </span>
      </template>
      <template #status="{ row }">
        <el-tag
          :type="
            (row as AdminPayoutItem).status === 'PAID'
              ? 'success'
              : (row as AdminPayoutItem).status === 'CONFIRMED'
                ? 'warning'
                : 'info'
          "
        >
          {{ statusLabel((row as AdminPayoutItem).status) }}
        </el-tag>
      </template>

      <template #operation="{ row }">
        <el-button
          v-if="(row as AdminPayoutItem).status === 'PENDING'"
          size="small"
          type="primary"
          @click="onConfirm(row as AdminPayoutItem)"
        >
          初审通过
        </el-button>
        <el-button
          v-else-if="(row as AdminPayoutItem).status === 'CONFIRMED'"
          size="small"
          type="success"
          @click="onPay(row as AdminPayoutItem)"
        >
          确认打款
        </el-button>
        <span v-else>—</span>
      </template>
    </ProTable>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-admin-payouts {
  padding: 16px;

  &__table {
    width: 100%;
  }
}
</style>
