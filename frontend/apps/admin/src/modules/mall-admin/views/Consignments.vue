<script setup lang="ts">
/**
 * 寄卖审核队列页（mall-admin 模块）。
 *
 * 状态 Tab 筛选 + el-table 展示寄卖单；SUBMITTED 行可操作：
 * 「通过」开 dialog 填平台定价 + 佣金率；「驳回」填原因（useConfirm 二次确认）。
 * 审核成功自动 reload 对齐真态；错误 toast 可见（不静默吞错）。
 * 权限：路由 meta.permissions=['mall:admin']（seller 登录后被 /403 拦，Review Focus #1）。
 */
defineOptions({ name: 'MallAdminConsignments' })

import { onMounted, reactive, ref } from 'vue'
import type { TabsPaneContext } from 'element-plus'
import { useConsignmentReview } from '../index'
import type { AdminConsignmentItem } from '../index'

const bem = createNamespace('mall-admin-consignments')

const { list, loading, status, load, approve, reject } = useConsignmentReview()

const STATUS_TABS = [
  { label: '待审核', value: 'SUBMITTED' },
  { label: '已定价', value: 'PRICED' },
  { label: '已上架', value: 'LISTED' },
  { label: '已售出', value: 'SOLD' },
  { label: '已结算', value: 'SETTLED' },
  { label: '已驳回', value: 'REJECTED' },
]

function onTabClick(paneName: string | number): void {
  void load(String(paneName))
}

// ── 通过 dialog ──────────────────────────────────────────────
const approveDialogVisible = ref(false)
const approveTarget = ref<AdminConsignmentItem | null>(null)
const approveForm = reactive({ platformPrice: '', commissionRate: '' })
const approveSubmitting = ref(false)

function openApprove(row: AdminConsignmentItem): void {
  approveTarget.value = row
  approveForm.platformPrice = row.expectedPrice ? String(row.expectedPrice) : ''
  approveForm.commissionRate = '15'
  approveDialogVisible.value = true
}

async function onApproveSubmit(): Promise<void> {
  if (!approveTarget.value || approveSubmitting.value) return
  const price = Number(approveForm.platformPrice)
  const rate = Number(approveForm.commissionRate)
  if (!(price > 0)) {
    ElMessage.error('平台定价必须大于 0')
    return
  }
  if (!(rate > 0 && rate <= 100)) {
    ElMessage.error('佣金率必须在 0-100 之间')
    return
  }
  approveSubmitting.value = true
  try {
    await approve(approveTarget.value.id, price, rate)
    ElMessage.success('已通过并定价')
    approveDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '审核失败')
  } finally {
    approveSubmitting.value = false
  }
}

// ── 驳回 dialog ──────────────────────────────────────────────
const rejectDialogVisible = ref(false)
const rejectTarget = ref<AdminConsignmentItem | null>(null)
const rejectReason = ref('')
const rejectSubmitting = ref(false)

function openReject(row: AdminConsignmentItem): void {
  rejectTarget.value = row
  rejectReason.value = ''
  rejectDialogVisible.value = true
}

async function onRejectSubmit(): Promise<void> {
  if (!rejectTarget.value || rejectSubmitting.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    ElMessage.error('请填写驳回原因')
    return
  }
  // useConfirm 函数形态：调用即弹窗，返回 Promise<boolean>（取消 resolve false，无须 try/catch）
  const confirmed = await useConfirm(`确认驳回「${rejectTarget.value.title}」？`)
  if (!confirmed) return
  rejectSubmitting.value = true
  try {
    await reject(rejectTarget.value.id, reason)
    ElMessage.success('已驳回')
    rejectDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '驳回失败')
  } finally {
    rejectSubmitting.value = false
  }
}

function formatMoney(v: number | null): string {
  return v === null ? '—' : `¥${v.toFixed(2)}`
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
      <p>当前状态下暂无寄卖单</p>
    </div>

    <el-table v-else :data="list" :class="bem.e('table')" border stripe>
      <el-table-column label="商品" min-width="240">
        <template #default="{ row }">
          <div :class="bem.e('goods')">
            <img
              v-if="row.images && row.images.length"
              :src="row.images[0]"
              :alt="row.title"
              :class="bem.e('thumb')"
            />
            <div :class="bem.e('thumb-placeholder')" v-else>无图</div>
            <div>
              <div :class="bem.e('title')">{{ row.title }}</div>
              <div :class="bem.e('meta')">{{ row.brand || '—' }} · {{ row.conditionGrade }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="期望价" width="110">
        <template #default="{ row }">{{ formatMoney(row.expectedPrice) }}</template>
      </el-table-column>
      <el-table-column label="平台定价" width="110">
        <template #default="{ row }">{{ formatMoney(row.platformPrice) }}</template>
      </el-table-column>
      <el-table-column label="佣金率" width="90">
        <template #default="{ row }">
          {{ row.commissionRate !== null ? `${row.commissionRate}%` : '—' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'REJECTED' ? 'danger' : row.status === 'SUBMITTED' ? 'warning' : 'success'">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" width="170">
        <template #default="{ row }">{{ row.createTime }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <template v-if="(row as AdminConsignmentItem).status === 'SUBMITTED'">
            <el-button size="small" type="primary" @click="openApprove(row as AdminConsignmentItem)">通过</el-button>
            <el-button size="small" type="danger" @click="openReject(row as AdminConsignmentItem)">驳回</el-button>
          </template>
          <span v-else>—</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 通过 dialog -->
    <el-dialog v-model="approveDialogVisible" title="审核通过并定价" width="420px">
      <el-form label-width="90px">
        <el-form-item label="平台定价" required>
          <el-input v-model="approveForm.platformPrice" type="number" placeholder="大于 0" />
        </el-form-item>
        <el-form-item label="佣金率 %" required>
          <el-input v-model="approveForm.commissionRate" type="number" placeholder="0-100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="approveSubmitting" @click="onApproveSubmit">确认通过</el-button>
      </template>
    </el-dialog>

    <!-- 驳回 dialog -->
    <el-dialog v-model="rejectDialogVisible" title="驳回寄卖单" width="420px">
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="3"
        placeholder="请填写驳回原因（必填）"
        maxlength="200"
        show-word-limit
      />
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejectSubmitting" @click="onRejectSubmit">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-admin-consignments {
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

  &__goods {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
  }

  &__thumb-placeholder {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color);
    color: var(--el-text-color-secondary);
    font-size: 12px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  &__title {
    font-weight: 500;
    color: var(--el-text-color-primary);
    line-height: 1.4;
  }

  &__meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
  }
}
</style>
