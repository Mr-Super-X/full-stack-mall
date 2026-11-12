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
// ProColumn/ProTableExpose 类型：@vv/ui ProTable 配套类型（组件本体自动注册，类型显式 import——CLAUDE.md §1.7）
import type { ProColumn, ProTableExpose, ProTableResponse } from '@vv/ui/components/ProTable'
// XForm 类型：@vv/ui form-schema 包内导出（demo 同款路径，带 .ts 后缀对齐模块解析约定）
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import { useConsignmentReview } from '../index'
import { adminConsignmentApi } from '../apis/consignments'
import type { AdminConsignmentItem } from '../index'

const bem = createNamespace('mall-admin-consignments')

const { status, approve, reject } = useConsignmentReview()

/** 表格刷新：列表数据由 ProTable request-api 自管，审核成功后经实例 refresh 对齐真态（行状态已变迁） */
const tableRef = ref<ProTableExpose | null>(null)

const STATUS_TABS = [
  { label: '待审核', value: 'SUBMITTED' },
  { label: '已定价', value: 'PRICED' },
  { label: '已上架', value: 'LISTED' },
  { label: '已售出', value: 'SOLD' },
  { label: '已结算', value: 'SETTLED' },
  { label: '已驳回', value: 'REJECTED' },
]

/** 状态枚举 → 中文标签（后端返回英文枚举，表格渲染用中文；单一事实源 = STATUS_TABS，不另建映射表） */
function statusLabel(status: string): string {
  return STATUS_TABS.find((t) => t.value === status)?.label ?? status
}

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

// ── 通过 dialog（ProDialogForm：校验/loading/成功关窗内置；label 右对齐） ──
const approveDialogVisible = ref(false)
const approveTarget = ref<AdminConsignmentItem | null>(null)
const approveFormRef = ref<XFormExpose | null>(null)

const approveSchema: SchemaNode = {
  labelWidth: '100px',
  labelPosition: 'right',
  children: [
    {
      component: 'InputNumber',
      name: 'platformPrice',
      label: '平台定价',
      props: { min: 0.01, precision: 2, controlsPosition: 'right', placeholder: '大于 0' },
      rules: [{ required: true, message: '请输入大于 0 的平台定价', trigger: 'blur' }],
    },
    {
      component: 'InputNumber',
      name: 'commissionRate',
      label: '佣金率 %',
      props: { min: 1, max: 100, controlsPosition: 'right', placeholder: '1-100' },
      rules: [{ required: true, message: '请输入 1-100 的佣金率', trigger: 'blur' }],
    },
  ],
}

const approveModel = reactive<Record<string, unknown>>({
  platformPrice: undefined,
  commissionRate: undefined,
})

function openApprove(row: AdminConsignmentItem): void {
  approveTarget.value = row
  // 回填卖家期望价 + 默认佣金率 15%（原手写表单同语义）
  approveModel.platformPrice = row.expectedPrice ?? undefined
  approveModel.commissionRate = 15
  approveDialogVisible.value = true
}

async function onApproveSubmit(): Promise<void> {
  if (!approveTarget.value) throw new Error('审核目标缺失')
  await approve(
    approveTarget.value.id,
    Number(approveModel.platformPrice),
    Number(approveModel.commissionRate)
  )
}

function onApproveSuccess(): void {
  ElMessage.success('已通过并定价')
  tableRef.value?.refresh()
}

function onApproveFailed(err: unknown): void {
  ElMessage.error(err instanceof Error ? err.message : '审核失败')
}

// ── 驳回 dialog（footer 自定义：useConfirm 二次确认插在 validate 与 API 之间） ──
const rejectDialogVisible = ref(false)
const rejectTarget = ref<AdminConsignmentItem | null>(null)
const rejectSubmitting = ref(false)
const rejectFormRef = ref<XFormExpose | null>(null)

const rejectSchema: SchemaNode = {
  labelWidth: '90px',
  labelPosition: 'right',
  children: [
    {
      component: 'InputTextArea',
      name: 'rejectReason',
      label: '驳回原因',
      props: { rows: 3, maxlength: 200, showWordLimit: true, placeholder: '请填写驳回原因' },
      rules: [{ required: true, message: '请填写驳回原因', trigger: 'blur' }],
    },
  ],
}

const rejectModel = reactive<Record<string, unknown>>({ rejectReason: '' })

function openReject(row: AdminConsignmentItem): void {
  rejectTarget.value = row
  rejectModel.rejectReason = ''
  rejectDialogVisible.value = true
}

async function onRejectClick(): Promise<void> {
  if (!rejectTarget.value || rejectSubmitting.value) return
  const valid = await rejectFormRef.value?.validate()
  if (!valid) return
  // useConfirm 函数形态：调用即弹窗，返回 Promise<boolean>（取消 resolve false，无须 try/catch）
  const confirmed = await useConfirm(`确认驳回「${rejectTarget.value.title}」？`)
  if (!confirmed) return
  rejectSubmitting.value = true
  try {
    await reject(rejectTarget.value.id, String(rejectModel.rejectReason ?? '').trim())
    ElMessage.success('已驳回')
    tableRef.value?.refresh()
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
    <!-- 状态筛选用原生按钮组：el-tabs 的 @ts-expect-error 压制依赖 vue-tsc 生成代码行映射（本页曾实证失败），原生按钮零类型风险（SeckillActivities.vue 既定模式） -->
    <div :class="bem.e('tabs')">
      <button
        v-for="t in STATUS_TABS"
        :key="t.value"
        type="button"
        :class="[bem.e('tab'), bem.is('active', status === t.value)]"
        @click="status = t.value"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- :key=status：切 Tab 强制重挂载 ProTable，触发 onMounted 重新拉取当前状态的列表
         （ProTable 靠分页参数变化触发重取，不会因 request-api 闭包里的 status 变化自动刷新） -->
    <ProTable
      ref="tableRef"
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
          {{ statusLabel((row as AdminConsignmentItem).status) }}
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

    <!-- 通过 dialog：@opened 清校验残留（dialog 懒挂载，opened 后 formRef 必可用） -->
    <ProDialogForm
      v-model="approveDialogVisible"
      title="审核通过并定价"
      width="420px"
      :schema="approveSchema"
      :model="approveModel"
      submit-button-text="确认通过"
      :on-submit="onApproveSubmit"
      @opened="approveFormRef?.clearValidate()"
      @success="onApproveSuccess"
      @submit-failed="onApproveFailed"
    />

    <!-- 驳回 dialog：footer 自定义（validate → useConfirm → API，loading 手动） -->
    <ProDialogForm
      v-model="rejectDialogVisible"
      title="驳回寄卖单"
      width="420px"
      :schema="rejectSchema"
      :model="rejectModel"
      :on-submit="async () => { throw new Error('footer 自定义流程，不走内置 submit') }"
      @opened="rejectFormRef?.clearValidate()"
    >
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="rejectSubmitting" @click="onRejectClick">
          确认驳回
        </el-button>
      </template>
    </ProDialogForm>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-admin-consignments {
  padding: 16px;

  &__tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  &__tab {
    padding: 8px 16px;
    font: inherit;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
    cursor: pointer;

    &.is-active {
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary);
    }
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
