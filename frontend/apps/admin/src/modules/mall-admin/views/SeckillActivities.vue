<script setup lang="ts">
/**
 * 秒杀场次管理页（mall-admin 模块）。
 *
 * ProTable + 状态 Tab（:key 重挂载模式对齐 Consignments.vue——Tab 切换强制重取）。
 * 新建 dialog：商品下拉来自候选接口（仅单 SKU 自营有库存），限购固定 1 禁编辑（spec §3.1）。
 * PENDING 行「取消」（useConfirm 二次确认，归还划拨库存）。
 * 权限：路由 meta.permissions=['mall:admin']。
 */
defineOptions({ name: 'MallAdminSeckillActivities' })

import { nextTick, reactive, ref, watch } from 'vue'
import type { ProColumn, ProTableExpose, ProTableResponse } from '@vv/ui/components/ProTable'
// XForm 类型：@vv/ui form-schema 包内导出（demo 同款路径，带 .ts 后缀对齐模块解析约定）
import type { SchemaNode, XFormExpose } from '@vv/ui/components/form-schema/types.ts'
import { adminSeckillApi } from '../apis/seckill'
import type { AdminSeckillActivity, AdminSeckillCandidate } from '../apis/seckill'
import { useSeckillActivities } from '../composables/useSeckillActivities'

const bem = createNamespace('mall-admin-seckill')

const { status, create, cancel } = useSeckillActivities()

/** 表格刷新：cancel 成功后留当前页 refresh；create 成功后 reloadKey 重挂载回第 1 页（ProTable 未暴露 setPage） */
const tableRef = ref<ProTableExpose | null>(null)
const reloadKey = ref(0)

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待开始', value: 'PENDING' },
  { label: '进行中', value: 'ACTIVE' },
  { label: '已结束', value: 'ENDED' },
  { label: '已取消', value: 'CANCELLED' },
]

function statusLabel(s: string): string {
  return STATUS_TABS.find((t) => t.value === s)?.label ?? s
}

/** ProTable 数据源（分页参数由 ProTable 注入，键名 pageNum/pageSize 见 useTable.ts；status 经 :key 重挂载保证闭包新鲜） */
async function requestApi(p: Record<string, unknown>): Promise<ProTableResponse<AdminSeckillActivity>> {
  const res = await adminSeckillApi.page({
    status: status.value || undefined,
    page: Number(p['pageNum'] ?? 1),
    pageSize: Number(p['pageSize'] ?? 10),
  })
  return { data: res.list, total: res.total, pageNum: res.page, pageSize: res.pageSize }
}

const columns: ProColumn<AdminSeckillActivity>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'productTitle', label: '商品', minWidth: 220 },
  { prop: 'seckillPrice', label: '秒杀价', width: 110 },
  { prop: 'stock', label: '库存进度', width: 120 },
  { prop: 'startTime', label: '开始时间', width: 165 },
  { prop: 'endTime', label: '结束时间', width: 165 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'operation', label: '操作', width: 110, type: 'operation', fixed: 'right' },
]

// ── 新建 dialog（ProDialogForm 三件套：校验/loading/成功关窗内置；候选商品 asyncOptions；label 右对齐） ──
const createDialogVisible = ref(false)
const formRef = ref<XFormExpose | null>(null)

const schema: SchemaNode = {
  labelWidth: '90px',
  labelPosition: 'right',
  children: [
    {
      component: 'Select',
      name: 'productId',
      label: '商品',
      props: { placeholder: '仅单 SKU 自营且有库存的商品' },
      asyncOptions: {
        source: () => adminSeckillApi.candidates(),
        // transform 框架签名是 unknown[]（无法从 source 泛型推断），source 返回已确定为候选数组——as 收窄安全
        transform: (raw: unknown[]) =>
          (raw as AdminSeckillCandidate[]).map((c) => ({
            value: c.productId,
            label: `${c.title}（可划拨 ${c.stock} 件 · ¥${c.price}）`,
          })),
      },
      rules: [{ required: true, message: '请选择商品', trigger: 'change' }],
    },
    {
      component: 'InputNumber',
      name: 'seckillPrice',
      label: '秒杀价',
      props: { min: 0.01, precision: 2, controlsPosition: 'right', placeholder: '大于 0' },
      rules: [{ required: true, message: '请输入秒杀价', trigger: 'blur' }],
    },
    {
      component: 'InputNumber',
      name: 'seckillStock',
      label: '划拨库存',
      props: { min: 1, precision: 0, controlsPosition: 'right', placeholder: '≥1，从商品库存划拨' },
      rules: [{ required: true, message: '请输入划拨库存', trigger: 'blur' }],
    },
    {
      component: 'DatePicker',
      name: 'timeRange',
      label: '起止时间',
      // valueFormat 固定为本地 naive 字符串（YYYY-MM-DDTHH:mm:ss）——直接传后端 LocalDateTime，
      // 禁用 toISOString：UTC 转换会让场次窗口偏移浏览器时区小时数（终审 IMPORTANT 修复）
      props: {
        type: 'datetimerange',
        valueFormat: 'YYYY-MM-DDTHH:mm:ss',
        rangeSeparator: '至',
        startPlaceholder: '开始时间',
        endPlaceholder: '结束时间',
      },
      rules: [{ required: true, message: '请选择起止时间', trigger: 'change' }],
    },
  ],
}

const model = reactive<Record<string, unknown>>({
  productId: null,
  seckillPrice: undefined,
  seckillStock: undefined,
  timeRange: null,
})

function resetModel(): void {
  Object.assign(model, {
    productId: null,
    seckillPrice: undefined,
    seckillStock: undefined,
    timeRange: null,
  })
}

/** 打开即重置为干净表单（asyncOptions immediate 默认 true，打开时自动拉候选） */
watch(
  () => createDialogVisible.value,
  (v) => {
    if (!v) return
    resetModel()
    void nextTick(() => formRef.value?.clearValidate())
  }
)

function openCreate(): void {
  createDialogVisible.value = true
}

/** ProDialogForm 契约：resolve = 成功（自动关窗 + success），reject = 保持打开（submit-failed） */
async function onCreateSubmit(): Promise<void> {
  const range = model.timeRange as [string, string] | null
  if (!range || !range[0] || !range[1]) throw new Error('请选择起止时间')
  await create({
    productId: Number(model.productId),
    seckillPrice: Number(model.seckillPrice),
    seckillStock: Number(model.seckillStock),
    startTime: range[0],
    endTime: range[1],
    limitPerUser: 1,
  })
}

function onCreateSuccess(): void {
  ElMessage.success('已创建（库存已划拨）')
  reloadKey.value++ // 新场次按 id DESC 在首行，回第 1 页展示
  resetModel()
}

function onCreateFailed(err: unknown): void {
  ElMessage.error(err instanceof Error ? err.message : '创建失败')
}

// ── 取消 ─────────────────────────────────────────────────────
async function onCancel(row: AdminSeckillActivity): Promise<void> {
  const confirmed = await useConfirm(`确认取消场次 #${row.id}？划拨库存将归还。`)
  if (!confirmed) return
  try {
    await cancel(row.id)
    ElMessage.success('已取消并归还库存')
    tableRef.value?.refresh()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '取消失败')
  }
}
</script>

<template>
  <div :class="bem.b()">
    <div :class="bem.e('toolbar')">
      <!-- 状态筛选用原生按钮组：el-tabs 的 @ts-expect-error 压制依赖 vue-tsc 生成代码行映射（Consignments 实证不可复制），原生按钮零类型风险且符合 Operate 端克制风格 -->
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
      <el-button type="primary" :class="bem.e('create')" @click="openCreate">新建场次</el-button>
    </div>

    <ProTable
      ref="tableRef"
      :key="`${status}-${reloadKey}`"
      :columns="columns"
      :request-api="requestApi"
      row-key="id"
      :class="bem.e('table')"
    >
      <template #productTitle="{ row }">
        {{ (row as AdminSeckillActivity).productTitle ?? `商品 #${(row as AdminSeckillActivity).productId}` }}
      </template>
      <template #seckillPrice="{ row }">
        ¥{{ (row as AdminSeckillActivity).seckillPrice.toFixed(2) }}
      </template>
      <template #stock="{ row }">
        {{ (row as AdminSeckillActivity).soldCount }}/{{ (row as AdminSeckillActivity).seckillStock }}
      </template>
      <template #status="{ row }">
        <el-tag
          :type="
            (row as AdminSeckillActivity).status === 'ACTIVE'
              ? 'success'
              : (row as AdminSeckillActivity).status === 'PENDING'
                ? 'warning'
                : 'info'
          "
        >
          {{ statusLabel((row as AdminSeckillActivity).status) }}
        </el-tag>
      </template>
      <template #operation="{ row }">
        <el-button
          v-if="(row as AdminSeckillActivity).status === 'PENDING'"
          size="small"
          type="danger"
          @click="onCancel(row as AdminSeckillActivity)"
        >
          取消
        </el-button>
        <span v-else>—</span>
      </template>
    </ProTable>

    <!-- 新建场次：ProDialogForm 三件套；限购固定 1（spec §3.1）以默认插槽说明文字放在表单后 -->
    <ProDialogForm
      v-model="createDialogVisible"
      title="新建秒杀场次"
      width="480px"
      :schema="schema"
      :model="model"
      submit-button-text="创建"
      :on-submit="onCreateSubmit"
      @opened="formRef?.clearValidate()"
      @success="onCreateSuccess"
      @submit-failed="onCreateFailed"
    >
      <div :class="bem.e('limit')">每人限购 1 件（本期固定，放开限购是 v2 话题）</div>
    </ProDialogForm>
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-admin-seckill {
  padding: 16px;

  &__toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  &__tabs {
    display: flex;
    gap: 8px;
    flex: 1;
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

  &__limit {
    margin-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}
</style>
