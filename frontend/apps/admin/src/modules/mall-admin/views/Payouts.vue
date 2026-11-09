<script setup lang="ts">
/**
 * 结算审批页（mall-admin 模块）：Payout 三步状态机 PENDING→CONFIRMED→PAID。
 *
 * 状态 Tab + el-table；操作列按状态显示：PENDING「初审通过」、CONFIRMED「确认打款」、PAID 无操作。
 * 金额列 hover 提示拆账恒等（应结+佣金=订单金额）。审批成功 reload 对齐真态；
 * 400（状态已变迁）错误 toast 且强制刷新，不留「幻觉成功」（Review Focus #6）。
 * 权限：路由 meta.permissions=['mall:admin']。
 */
defineOptions({ name: 'MallAdminPayouts' })

import { onMounted } from 'vue'
import type { TabsPaneContext } from 'element-plus'
import { usePayoutApproval } from '../index'
import type { AdminPayoutItem } from '../index'

const bem = createNamespace('mall-admin-payouts')

const { list, loading, status, load, confirm, pay } = usePayoutApproval()

const STATUS_TABS = [
  { label: '待初审', value: 'PENDING' },
  { label: '待打款', value: 'CONFIRMED' },
  { label: '已打款', value: 'PAID' },
]

function onTabClick(paneName: string | number): void {
  void load(String(paneName))
}

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

onMounted(() => {
  void load()
})
</script>

<template>
  <div :class="bem.b()">
    <el-tabs :model-value="status" @tab-click="(t: TabsPaneContext) => onTabClick(String(t.paneName))">
      <el-tab-pane v-for="t in STATUS_TABS" :key="t.value" :label="t.label" :name="t.value" />
    </el-tabs>

    <div v-if="loading" :class="bem.e('state')">
      <el-icon :size="28"><Loading /></el-icon>
      <p>加载中…</p>
    </div>

    <div v-else-if="list.length === 0" :class="bem.e('state')">
      <el-icon :size="28"><FolderOpened /></el-icon>
      <p>当前状态下暂无结算单</p>
    </div>

    <el-table v-else :data="list" :class="bem.e('table')" border stripe>
      <el-table-column label="结算单号" width="90">
        <template #default="{ row }">#{{ (row as AdminPayoutItem).id }}</template>
      </el-table-column>
      <el-table-column label="卖家 ID" width="90">
        <template #default="{ row }">{{ (row as AdminPayoutItem).sellerId }}</template>
      </el-table-column>
      <el-table-column label="订单行 ID" width="100">
        <template #default="{ row }">{{ (row as AdminPayoutItem).orderItemId }}</template>
      </el-table-column>
      <el-table-column label="应结金额" width="130">
        <template #default="{ row }">
          <span :title="splitHint(row as AdminPayoutItem)">
            {{ formatMoney((row as AdminPayoutItem).sellerAmount) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="平台佣金" width="130">
        <template #default="{ row }">
          <span :title="splitHint(row as AdminPayoutItem)">
            {{ formatMoney((row as AdminPayoutItem).commission) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag
            :type="
              (row as AdminPayoutItem).status === 'PAID'
                ? 'success'
                : (row as AdminPayoutItem).status === 'CONFIRMED'
                  ? 'warning'
                  : 'info'
            "
          >
            {{ (row as AdminPayoutItem).status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ (row as AdminPayoutItem).createTime }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
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
      </el-table-column>
    </el-table>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-admin-payouts {
  padding: 16px;

  &__state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 60px 0;
    color: var(--el-text-color-secondary);
  }

  &__table {
    width: 100%;
  }
}
</style>
