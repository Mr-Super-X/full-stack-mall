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

import { reactive, ref } from 'vue'
import type { ProColumn, ProTableResponse } from '@vv/ui/components/ProTable'
import { adminSeckillApi } from '../apis/seckill'
import type { AdminSeckillActivity, AdminSeckillCandidate } from '../apis/seckill'
import { useSeckillActivities } from '../composables/useSeckillActivities'

const bem = createNamespace('mall-admin-seckill')

const { status, create, cancel } = useSeckillActivities()

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

// ── 新建 dialog ──────────────────────────────────────────────
const createDialogVisible = ref(false)
const candidates = ref<AdminSeckillCandidate[]>([])
const createForm = reactive({
  productId: null as number | null,
  seckillPrice: '',
  seckillStock: '',
  timeRange: null as [Date, Date] | null,
})
const createSubmitting = ref(false)

async function openCreate(): Promise<void> {
  createDialogVisible.value = true
  if (candidates.value.length === 0) {
    try {
      candidates.value = await adminSeckillApi.candidates()
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : '候选商品加载失败')
    }
  }
}

async function onCreateSubmit(): Promise<void> {
  if (createSubmitting.value) return
  const productId = createForm.productId
  const price = Number(createForm.seckillPrice)
  const stock = Number(createForm.seckillStock)
  if (!productId) {
    ElMessage.error('请选择商品')
    return
  }
  if (!(price > 0)) {
    ElMessage.error('秒杀价必须大于 0')
    return
  }
  if (!Number.isInteger(stock) || stock < 1) {
    ElMessage.error('划拨库存至少 1 件')
    return
  }
  if (!createForm.timeRange || !createForm.timeRange[0] || !createForm.timeRange[1]) {
    ElMessage.error('请选择起止时间')
    return
  }
  createSubmitting.value = true
  try {
    await create({
      productId,
      seckillPrice: price,
      seckillStock: stock,
      startTime: createForm.timeRange[0].toISOString(),
      endTime: createForm.timeRange[1].toISOString(),
      limitPerUser: 1,
    })
    ElMessage.success('已创建（库存已划拨）')
    createDialogVisible.value = false
    createForm.productId = null
    createForm.seckillPrice = ''
    createForm.seckillStock = ''
    createForm.timeRange = null
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '创建失败')
  } finally {
    createSubmitting.value = false
  }
}

// ── 取消 ─────────────────────────────────────────────────────
async function onCancel(row: AdminSeckillActivity): Promise<void> {
  const confirmed = await useConfirm(`确认取消场次 #${row.id}？划拨库存将归还。`)
  if (!confirmed) return
  try {
    await cancel(row.id)
    ElMessage.success('已取消并归还库存')
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
      :key="status"
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

    <!-- 新建场次 dialog -->
    <el-dialog v-model="createDialogVisible" title="新建秒杀场次" width="480px">
      <el-form label-width="100px">
        <el-form-item label="商品" required>
          <!-- 原生 select：el-option 的 EpProp 泛型在 element-plus 2.14 + Vue 3.6.0-beta.17 下
               类型层不兼容（本项目首个 el-option 用法实证，模板 @ts-expect-error 无法稳定压制），
               运营低频场景原生 select 功能等价（候选量级小，无需 filterable） -->
          <select
            v-model.number="createForm.productId"
            :class="bem.e('select')"
          >
            <option :value="null" disabled>仅单 SKU 自营且有库存的商品</option>
            <option v-for="c in candidates" :key="c.productId" :value="c.productId">
              {{ c.title }}（可划拨 {{ c.stock }} 件 · ¥{{ c.price }}）
            </option>
          </select>
        </el-form-item>
        <el-form-item label="秒杀价" required>
          <el-input v-model="createForm.seckillPrice" type="number" placeholder="大于 0" />
        </el-form-item>
        <el-form-item label="划拨库存" required>
          <el-input v-model="createForm.seckillStock" type="number" placeholder="从商品库存划拨，≥1" />
        </el-form-item>
        <el-form-item label="起止时间" required>
          <el-date-picker
            v-model="createForm.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            :class="bem.e('picker')"
          />
        </el-form-item>
        <el-form-item label="限购">
          <span :class="bem.e('limit')">1 件（本期固定，放开限购是 v2 话题）</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="onCreateSubmit">创建</el-button>
      </template>
    </el-dialog>
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

  &__select {
    width: 100%;
  }

  &__picker {
    width: 100%;
  }

  &__limit {
    color: var(--el-text-color-secondary);
  }
}
</style>
