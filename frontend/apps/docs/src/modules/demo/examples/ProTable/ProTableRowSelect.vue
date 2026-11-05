<script setup lang="ts">
/**
 * ProTable v3.1 行选择 demo —— radio 单选列 + reserveSelection 多选跨页
 *
 * 演示能力：
 * - radio 单选列（type:'radio'）：el 引擎自绘 ElRadio / vxe 引擎内置 radio 列，
 *   选中收敛统一选中区，getSelectedRows() 返回单行数组
 * - 单选跨页保持：选中态存于 useTable 选中区，翻页不被重置
 * - reserveSelection 多选跨页（v3.1 一等字段）：替代 tableProps 透传写法，跨页累计勾选
 *
 * 验证步骤：
 * 1. 点 radio 选中一行 → 点「读取 radio 选中」提示单行
 * 2. 翻到第 2 页再翻回 → 单选选中态保持
 * 3. 第 1 页勾 2 行 → 第 2 页勾 1 行 → 「读取跨页勾选」提示累计 3 行
 *
 * 路由：自动注册为 /demo/pro-table-row-select
 */
import { ElButton, ElMessage } from 'element-plus'
import type { ProColumn, ProTableExpose } from '@vv/ui/components/ProTable/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { radioColumnItems, reserveSelectionColumnItems } from './configs/protable-demos-api'
import { projectRequestApi, type ProjectRow } from './configs/projects'

const bem = createNamespace('demo-pro-table-row-select')

const radioColumns: ProColumn<ProjectRow>[] = [
  { prop: '__radio', label: '', type: 'radio', width: 50 },
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 150 },
  { prop: 'amount', label: '金额', width: 140, formatter: 'amount' },
]

const reserveColumns: ProColumn<ProjectRow>[] = [
  { prop: '__selection', label: '', type: 'selection', width: 45, reserveSelection: true },
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 150 },
  { prop: 'progress', label: '进度', width: 130, formatter: 'percent' },
]

const radioRef = ref<ProTableExpose | null>(null)
const reserveRef = ref<ProTableExpose | null>(null)

/** 单选读取：选中收敛统一选中区（单元素数组），与多选 getSelectedRows 同构 */
function handleGetRadio(): void {
  const rows = radioRef.value?.getSelectedRows() ?? []
  if (rows.length === 0) {
    ElMessage.info('请先选中一行（radio 单选列）')
    return
  }
  ElMessage.success(`radio 选中：${(rows[0] as ProjectRow).title}（共 ${rows.length} 行）`)
}

function handleGetReserve(): void {
  const rows = reserveRef.value?.getSelectedRows() ?? []
  if (rows.length === 0) {
    ElMessage.info('当前未勾选任何行')
    return
  }
  ElMessage.success(
    `跨页累计勾选 ${rows.length} 行：${rows.map((r) => (r as ProjectRow).title).join('、')}`
  )
}

const radioCode = `// 单选列：v3.1 新增 type:'radio'（el 引擎自绘 ElRadio / vxe 引擎内置 radio 列）
{ prop: '__radio', label: '', type: 'radio', width: 45 }

// 读取/清除与多选同构：选中收敛统一选中区
proTableRef.value?.getSelectedRows()  // 单选返回单行数组
proTableRef.value?.clearSelection()   // 清除选中`

const reserveCode = `// 多选跨页保持：v3.1 一等字段（替代 tableProps: { reserveSelection: true } 透传）
{ prop: '__selection', label: '', type: 'selection', width: 45, reserveSelection: true }

// 需配合 row-key：跨页累计勾选由选中区天然支持
<ProTable row-key="id" :columns="columns" :request-api="requestApi" />`

const tocItems = [
  { id: 'demo-radio', label: 'radio 单选列' },
  { id: 'demo-reserve', label: 'reserveSelection 跨页多选' },
  { id: 'api-radio-column', label: 'radio 列字段' },
  { id: 'api-reserve-selection', label: 'reserveSelection 字段' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableRowSelect 行选择（单选 / 跨页多选）"
    source="src/components/ProTable/components/ElementTableBody.vue"
    :introductions="[
      'radio 单选列与 reserveSelection 跨页多选：选中都收敛 ProTable 统一选中区。',
      '上方演示单选（含跨页保持），下方演示跨页多选累计勾选。',
    ]"
  >
    <section :class="bem.b()">
      <DemoField id="demo-radio" label="radio 单选列（跨页保持）" :code="radioCode">
        <p :class="bem.e('hint')">
          验证：① 点 radio 选中一行 → 点「读取 radio 选中」提示单行 ② 翻到第 2 页再翻回 →
          选中态保持（选中收敛统一选中区，不被分页重置）
        </p>
        <div :class="bem.e('actions')">
          <ElButton type="primary" size="small" @click="handleGetRadio">读取 radio 选中</ElButton>
        </div>
        <ProTable
          ref="radioRef"
          :columns="radioColumns"
          :request-api="projectRequestApi"
          table-key="demo-v31-radio"
          row-key="id"
          :page-size="5"
        />
      </DemoField>

      <DemoField
        id="demo-reserve"
        label="reserveSelection 多选跨页（一等字段）"
        :code="reserveCode"
      >
        <p :class="bem.e('hint')">
          验证：第 1 页勾 2 行 → 翻第 2 页勾 1 行 → 点「读取跨页勾选」提示累计 3 行（v3.1
          起列上直接写 reserveSelection，替代 tableProps 透传）
        </p>
        <div :class="bem.e('actions')">
          <ElButton type="primary" size="small" @click="handleGetReserve">读取跨页勾选</ElButton>
        </div>
        <ProTable
          ref="reserveRef"
          :columns="reserveColumns"
          :request-api="projectRequestApi"
          table-key="demo-v31-reserve"
          row-key="id"
          :page-size="5"
        />
      </DemoField>
    </section>

    <ApiTable
      title="radio 单选列字段（v3.1）"
      :items="radioColumnItems"
      anchor="api-radio-column"
    />
    <ApiTable
      title="reserveSelection 字段（v3.1）"
      :items="reserveSelectionColumnItems"
      anchor="api-reserve-selection"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-row-select {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
}
</style>
