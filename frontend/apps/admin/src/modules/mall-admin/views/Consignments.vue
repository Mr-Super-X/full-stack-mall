<script setup lang="ts">
/**
 * 寄卖审核队列页（mall-admin 模块）。
 *
 * 表格用全局组件 ProTable（@vv/ui 自动注册，AGENTS.md「表格用 ProTable」既定模式）——
 * columns + request-api 声明式，内建 Loading/Error/Empty 三态与搜索区，不用原生 el-table 手写三态。
 * 状态 Tab 在 ProTable 上方做外部筛选（改变 status → 触发 request-api 重取）。
 * SUBMITTED 行可操作：「通过」开 dialog 填平台定价 + 佣金率；「驳回」填原因（useConfirm 二次确认）。
 * 权限：路由 meta.permissions=['mall:admin']（seller 登录后被 /403 拦，Review Focus #1）。
 */
defineOptions({ name: 'MallAdminConsignments' })

import { reactive, ref } from 'vue'
// ProColumn 类型：@vv/ui ProTable 组件配套列定义类型（组件本体自动注册，类型显式 import——CLAUDE.md §1.7）
import type { ProColumn, ProTableResponse } from '@vv/ui/components/ProTable'
import { useConsignmentReview } from '../index'
import { adminConsignmentApi } from '../apis/consignments'
import type { AdminConsignmentItem } from '../index'

const bem = createNamespace('mall-admin-consignments')

const { status, approve, reject } = useConsignmentReview()

const STATUS_TABS = [
  { label: '待审核', value: 'SUBMITTED' },
  { label: '已定价', value: 'PRICED' },
  { label: '已上架', value: 'LISTED' },
  { label: '已售出', value: 'SOLD' },
  { label: '已结算', value: 'SETTLED' },
  { label: '已驳回', value: 'REJECTED' },
]

/** ProTable 数据源：按当前 status 拉寄卖单，包装为 ProTableResponse（纯列表无分页，total=长度）。
 *  状态切换经 v-model 双向绑定 status（绕开 el-tabs EpProp 严格类型摩擦），变化触发 request-api 重取。 */
async function requestApi(): Promise<ProTableResponse<AdminConsignmentItem>> {
  const list = await adminConsignmentApi.list(String(status.value))
  return { data: list, total: list.length, pageNum: 1, pageSize: list.length || 1 }
}

const columns: ProColumn<AdminConsignmentItem>[] = [
  { prop: 'title', label: '商品', minWidth: 240 },
  { prop: 'expectedPrice', label: '期望价', width: 110 },
  { prop: 'platformPrice', label: '平台定价', width: 110 },
  { prop: 'commissionRate', label: '佣金率', width: 90 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'createTime', label: '提交时间', width: 170 },
  { prop: 'operation', label: '操作', width: 160, type: 'operation', fixed: 'right' },
]

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
      <template #title="{ row }">
        <div :class="bem.e('goods')">
          <img
            v-if="(row as AdminConsignmentItem).images?.length"
            :src="(row as AdminConsignmentItem).images![0]"
            :alt="(row as AdminConsignmentItem).title"
            :class="bem.e('thumb')"
          />
          <div :class="bem.e('thumb-placeholder')" v-else>无图</div>
          <div>
            <div :class="bem.e('goods-title')">{{ (row as AdminConsignmentItem).title }}</div>
            <div :class="bem.e('goods-meta')">
              {{ (row as AdminConsignmentItem).brand || '—' }} ·
              {{ (row as AdminConsignmentItem).conditionGrade }}
            </div>
          </div>
        </div>
      </template>

      <template #expectedPrice="{ row }">
        {{ formatMoney((row as AdminConsignmentItem).expectedPrice) }}
      </template>
      <template #platformPrice="{ row }">
        {{ formatMoney((row as AdminConsignmentItem).platformPrice) }}
      </template>
      <template #commissionRate="{ row }">
        {{
          (row as AdminConsignmentItem).commissionRate !== null
            ? `${(row as AdminConsignmentItem).commissionRate}%`
            : '—'
        }}
      </template>
      <template #status="{ row }">
        <el-tag
          :type="
            (row as AdminConsignmentItem).status === 'REJECTED'
              ? 'danger'
              : (row as AdminConsignmentItem).status === 'SUBMITTED'
                ? 'warning'
                : 'success'
          "
        >
          {{ (row as AdminConsignmentItem).status }}
        </el-tag>
      </template>

      <template #operation="{ row }">
        <template v-if="(row as AdminConsignmentItem).status === 'SUBMITTED'">
          <el-button size="small" type="primary" @click="openApprove(row as AdminConsignmentItem)">
            通过
          </el-button>
          <el-button size="small" type="danger" @click="openReject(row as AdminConsignmentItem)">
            驳回
          </el-button>
        </template>
        <span v-else>—</span>
      </template>
    </ProTable>

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

  &__goods-title {
    font-weight: 500;
    color: var(--el-text-color-primary);
    line-height: 1.4;
  }

  &__goods-meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
  }
}
</style>
