<script setup lang="ts">
/**
 * 自营商品管理页（mall-admin 模块）。
 *
 * ProTable + 状态 Tab + 关键词搜索（:key 重挂载模式对齐 SeckillActivities.vue——
 * 筛选变化强制重取）。新建/编辑表单拆为组件（dialog 壳 + 校验在组件内，
 * 提交由本页调 composable，成功反馈经 defineExpose/visible 回控）——页面本体限容器 ≤300 行。
 * 行内「上架/下架」：下架 useConfirm 二次确认，后端挂载未结束秒杀活动会拒绝（400 文案透传）。
 * 类目树复用 C 端匿名接口 GET /mall/product/category/tree，本页加载一次传给两个 dialog。
 * 权限：路由 meta.permissions=['mall:admin']。
 */
defineOptions({ name: 'MallAdminProducts' })

import { computed, onMounted, ref } from 'vue'
// ProColumn/ProTableExpose 类型：@vv/ui ProTable 配套类型（组件本体自动注册，类型显式 import——CLAUDE.md §1.7）
import type { ProColumn, ProTableExpose, ProTableResponse } from '@vv/ui/components/ProTable'
import { request } from '@api/http'
import type { AdminProduct, CategoryTreeNode } from '../apis/products'
import { adminProductApi } from '../apis/products'
import { useProductManage } from '../composables/useProductManage'
import ProductCreateDialog from '../components/ProductCreateDialog.vue'
import ProductEditDialog from '../components/ProductEditDialog.vue'

const bem = createNamespace('mall-admin-products')

const { status, keyword, update } = useProductManage()

/** 表格刷新：列表数据由 ProTable request-api 自管，写操作成功后经实例 refresh 对齐真态（保持当前分页） */
const tableRef = ref<ProTableExpose | null>(null)
/** 新建后回第 1 页：ProTable 未暴露 setPage，用 key 重挂载回首页（与 Consignments :key 重挂载同哲学） */
const reloadKey = ref(0)

const STATUS_TABS = [
  { label: '全部', value: '' as const },
  { label: '上架中', value: 1 },
  { label: '已下架', value: 0 },
]

/** 已生效的搜索词（回车/清空才重查；:key 绑定它触发 ProTable 重挂载） */
const appliedKeyword = ref('')

/** ProTable 数据源（分页参数由 ProTable 注入；status/keyword 经 :key 重挂载保证闭包新鲜） */
async function requestApi(p: Record<string, unknown>): Promise<ProTableResponse<AdminProduct>> {
  const res = await adminProductApi.page({
    status: status.value === '' ? undefined : status.value,
    keyword: appliedKeyword.value || undefined,
    page: Number(p['pageNum'] ?? 1),
    pageSize: Number(p['pageSize'] ?? 10),
  })
  return { data: res.list, total: res.total, pageNum: res.page, pageSize: res.pageSize }
}

function applySearch(): void {
  appliedKeyword.value = keyword.value.trim()
}

// ── 类目树（表格回填名称 + 两个 dialog 选择器共用数据源） ──
const categoryTree = ref<CategoryTreeNode[]>([])

const categoryNameMap = computed(() => {
  const map = new Map<number, string>()
  const walk = (nodes: CategoryTreeNode[]): void => {
    for (const n of nodes) {
      map.set(n.id, n.name)
      if (n.children) walk(n.children)
    }
  }
  walk(categoryTree.value)
  return map
})

onMounted(async () => {
  try {
    categoryTree.value = await request<CategoryTreeNode[]>({
      url: '/mall/product/category/tree',
      method: 'get',
    })
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '类目加载失败')
  }
})

/** 规格摘要：数量/总库存/最低价（行级展示，模板不内联聚合逻辑） */
function summarizeItems(items: AdminProduct['items']): string {
  if (items.length === 0) return '无规格'
  const totalStock = items.reduce((s, i) => s + i.stock, 0)
  const minPrice = Math.min(...items.map((i) => i.price))
  return `${items.length} 规格 · 库存 ${totalStock} · ¥${minPrice.toFixed(2)} 起`
}

const columns: ProColumn<AdminProduct>[] = [
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'name', label: '商品', minWidth: 200 },
  { prop: 'categoryId', label: '类目', width: 110 },
  { prop: 'items', label: '规格/库存/价', width: 210 },
  { prop: 'sales', label: '销量', width: 80 },
  { prop: 'status', label: '状态', width: 90 },
  { prop: 'createTime', label: '创建时间', width: 165 },
  { prop: 'operation', label: '操作', width: 170, type: 'operation', fixed: 'right' },
]

// ── 新建 dialog（ProDialogForm：校验/loading/成功关窗内置，@success 后刷新回第 1 页） ──
const createDialogVisible = ref(false)

function onCreateSuccess(): void {
  ElMessage.success('已创建并上架')
  reloadKey.value++ // 新商品按 id DESC 在首行，回第 1 页展示
}

// ── 编辑 dialog（成功留在当前页刷新） ──────────────────────────
const editDialogVisible = ref(false)
const editTarget = ref<AdminProduct | null>(null)

function openEdit(row: AdminProduct): void {
  editTarget.value = row
  editDialogVisible.value = true
}

function onEditSuccess(): void {
  ElMessage.success('已保存')
  tableRef.value?.refresh()
}

// ── 上/下架 ─────────────────────────────────────────────────
async function onToggleStatus(row: AdminProduct): Promise<void> {
  if (row.status === 1) {
    const confirmed = await useConfirm(
      `确认下架「${row.name}」？挂载未结束秒杀活动的商品无法下架。`
    )
    if (!confirmed) return
  }
  try {
    await update(row.id, { status: row.status === 1 ? 0 : 1 })
    ElMessage.success(row.status === 1 ? '已下架' : '已上架')
    tableRef.value?.refresh()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '操作失败')
  }
}
</script>

<template>
  <div :class="bem.b()">
    <div :class="bem.e('toolbar')">
      <div :class="bem.e('tabs')">
        <button
          v-for="t in STATUS_TABS"
          :key="String(t.value)"
          type="button"
          :class="[bem.e('tab'), bem.is('active', status === t.value)]"
          @click="status = t.value"
        >
          {{ t.label }}
        </button>
        <el-input
          v-model="keyword"
          :class="bem.e('search')"
          placeholder="按名称搜索，回车确认"
          clearable
          @keyup.enter="applySearch"
          @clear="applySearch"
        />
      </div>
      <el-button type="primary" :class="bem.e('create')" @click="createDialogVisible = true">
        新建商品
      </el-button>
    </div>

    <ProTable
      ref="tableRef"
      :key="`${status}-${appliedKeyword}-${reloadKey}`"
      :columns="columns"
      :request-api="requestApi"
      row-key="id"
      :class="bem.e('table')"
    >
      <template #categoryId="{ row }">
        {{ categoryNameMap.get((row as AdminProduct).categoryId) ?? `类目 #${(row as AdminProduct).categoryId}` }}
      </template>
      <template #items="{ row }">
        {{ summarizeItems((row as AdminProduct).items) }}
      </template>
      <template #status="{ row }">
        <el-tag :type="(row as AdminProduct).status === 1 ? 'success' : 'info'">
          {{ (row as AdminProduct).status === 1 ? '上架中' : '已下架' }}
        </el-tag>
      </template>
      <template #operation="{ row }">
        <el-button size="small" @click="openEdit(row as AdminProduct)">编辑</el-button>
        <el-button
          size="small"
          :type="(row as AdminProduct).status === 1 ? 'danger' : 'success'"
          @click="onToggleStatus(row as AdminProduct)"
        >
          {{ (row as AdminProduct).status === 1 ? '下架' : '上架' }}
        </el-button>
      </template>
    </ProTable>

    <ProductCreateDialog
      v-model:visible="createDialogVisible"
      :category-tree="categoryTree"
      @success="onCreateSuccess"
    />
    <ProductEditDialog
      v-model:visible="editDialogVisible"
      :product="editTarget"
      :category-tree="categoryTree"
      @success="onEditSuccess"
    />
  </div>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-mall-admin-products {
  padding: 16px;

  &__toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
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

  &__search {
    width: 240px;
    margin-left: 12px;
  }

  &__table {
    width: 100%;
  }
}
</style>
