<script setup lang="ts">
/**
 * ProTable 工具栏 / 批量操作条 demo —— toolbar 配置式 API + slot 作用域（2026-09-18 设计落地）
 *
 * 演示能力：
 * - toolbar 配置：新增（primary）/ 导出选中（ctx 联动禁用）/ 更多折叠（maxVisibleActions=3）
 * - selectionBarActions：批量删除（danger + confirm 二次确认）/ 批量完成（async onClick + refresh）
 * - slot 双通道：#tableHeader 作用域读 selectedCount；#selectionBar 完全接管批量区
 *
 * 验证步骤：
 * 1. 点「新增项目」→ 提示（业务接线位）
 * 2. 勾选 2 行 → 工具栏「导出选中」由禁用变可用；批量条浮出「已选 2 项」
 * 3. 点批量条「批量删除」→ 弹二次确认 → 确定后提示 + 表格刷新
 * 4. toolbar 只直出 3 个按钮，「列设置」收进「更多」下拉
 * 5. 第二表格：#tableHeader slot 显示实时选中数；#selectionBar slot 完全自定义批量区
 *
 * 路由：自动注册为 /demo/pro-table-header-actions
 */
import { ElButton, ElMessage, ElTag } from 'element-plus'
import { Download } from '@element-plus/icons-vue' // 显式 import（§1.6.1 来源注释）
import type { ProColumn, ToolbarAction } from '@vv/ui/components/ProTable/index.ts'
import { exportCsv } from '@vv/ui/components/ProTable/utils/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { toolbarActionItems, toolbarPropsItems } from './configs/protable-demos-api'
import { projectRequestApi, type ProjectRow } from './configs/projects'

const bem = createNamespace('demo-pro-table-header-actions')

const columns: ProColumn<ProjectRow>[] = [
  { prop: '__selection', label: '', type: 'selection', width: 45 },
  { prop: 'id', label: 'ID', width: 70 },
  { prop: 'title', label: '项目', minWidth: 140 },
  { prop: 'amount', label: '金额', width: 140, formatter: 'amount' },
  { prop: 'createdAt', label: '创建时间', width: 170, formatter: 'dateTime' },
]

/** 工具栏配置 —— 4 个 action 演示 maxVisibleActions=3 折叠；禁用/确认/ctx 全链路 */
const toolbar: ToolbarAction<ProjectRow>[] = [
  {
    label: '新增项目',
    type: 'primary',
    onClick: () => {
      ElMessage.success('打开新增弹窗（业务接线位）')
    },
  },
  {
    label: '导出选中',
    icon: Download,
    // ctx 联动：未选中禁用（selectedCount === 0 时按钮灰置）
    disabled: ({ selectedCount }) => selectedCount === 0,
    onClick: ({ selectedRows }) => {
      exportCsv(selectedRows as unknown as Record<string, unknown>[], {
        filename: '选中项目.csv',
        columns: [
          { prop: 'title', label: '项目' },
          { prop: 'amount', label: '金额' },
        ],
      })
      ElMessage.success(`已导出 ${selectedRows.length} 行（CSV 下载已触发）`)
    },
  },
  {
    label: '刷新',
    onClick: async ({ refresh }) => {
      await refresh()
      ElMessage.success('已刷新')
    },
  },
  {
    label: '归档',
    // 第 4 个 action：超出 maxVisibleActions=3，折叠进「更多」下拉
    onClick: () => {
      ElMessage.info('归档（mock）')
    },
  },
]

/** 批量条配置 —— danger + confirm + async onClick 完成后 refresh */
const selectionBarActions: ToolbarAction<ProjectRow>[] = [
  {
    label: '批量删除',
    type: 'danger',
    confirm: {
      content: '确定删除选中的项目吗？删除后不可恢复。',
      title: '批量删除',
      danger: true,
      confirmButtonText: '删除',
    },
    onClick: async ({ selectedRows, refresh }) => {
      ElMessage.success(`已删除 ${selectedRows.length} 项（mock，实际调批量删除 API）`)
      await refresh()
    },
  },
  {
    label: '批量完成',
    onClick: ({ selectedRows }) => {
      ElMessage.success(`已完成 ${selectedRows.length} 项（mock）`)
    },
  },
]

const configCode = `<ProTable
  :columns="columns"
  :request-api="requestApi"
  row-key="id"
  :toolbar="toolbar"
  :selection-bar-actions="selectionBarActions"
  :max-visible-actions="3"
/>

// toolbar 配置：权限/危险确认/折叠组件代管
const toolbar: ToolbarAction<ProjectRow>[] = [
  { label: '新增项目', type: 'primary', onClick: () => openCreateDialog() },
  {
    label: '导出选中',
    icon: Download,
    disabled: ({ selectedCount }) => selectedCount === 0,  // ctx 联动禁用
    onClick: ({ selectedRows }) => exportCsv(...),
  },
  { label: '刷新', onClick: async ({ refresh }) => { await refresh() } },
  { label: '归档', onClick: () => archive() },  // 第 4 个 → 折叠进「更多」
]

const selectionBarActions: ToolbarAction<ProjectRow>[] = [
  {
    label: '批量删除',
    type: 'danger',
    confirm: { content: '确定删除选中的项目吗？', danger: true, confirmButtonText: '删除' },
    onClick: async ({ selectedRows, refresh }) => {
      await batchDeleteApi(selectedRows.map(r => r.id))
      await refresh()  // 删除后刷新表格
    },
  },
]`

const slotCode = `<ProTable :columns="columns" :request-api="requestApi" row-key="id">
  <!-- slot 作用域下发 ToolbarCtx：selectedRows / selectedCount / loading / refresh -->
  <template #tableHeader="{ selectedCount }">
    <ElTag type="primary">已选 {{ selectedCount }} 项</ElTag>
  </template>

  <!-- #selectionBar slot 完全接管批量区（优先于 selectionBarActions 配置） -->
  <template #selectionBar="{ selectedRows, clearSelection }">
    <span>自定义批量区：{{ selectedRows.length }} 行</span>
    <ElButton size="small" type="danger" @click="clearSelection">清除选中</ElButton>
  </template>
</ProTable>`

const tocItems = [
  { id: 'demo-toolbar-config', label: 'toolbar 配置式 + selectionBarActions' },
  { id: 'demo-toolbar-slot', label: 'slot 作用域与完全接管' },
  { id: 'api-toolbar-action', label: 'ToolbarAction 字段' },
  { id: 'api-toolbar-props', label: '新增 props' },
]

useDocToc(tocItems)
</script>

<template>
  <DemoFrame
    title="ProTableHeaderActions 工具栏与批量操作（toolbar 配置式 API）"
    source="src/components/ProTable/components/ToolbarRenderer.vue"
    :introductions="[
      '配置式 toolbar：权限（perm）/ 二次确认（confirm）/ 折叠收纳（maxVisibleActions）由组件代管，业务只写行为。',
      '选中行 > 0 时浮出批量操作条：selectionBarActions 配置或 #selectionBar slot 完全接管（slot 优先）。',
      '#tableHeader / #toolButton slot 作用域下发 ToolbarCtx（selectedRows/selectedCount/loading/refresh），向后兼容。',
    ]"
  >
    <section :class="bem.b()">
      <DemoField
        id="demo-toolbar-config"
        label="配置式：toolbar + selectionBarActions（禁用联动 / 危险确认 / 折叠）"
        :code="configCode"
      >
        <p :class="bem.e('hint')">
          验证：① 未勾选时「导出选中」灰置 → 勾选 2 行变可用 ② 批量条浮出「已选 N 项」③
          「批量删除」弹确认框（确认按钮红色）④ toolbar 第 4 个按钮「归档」收进「更多」
        </p>
        <ProTable
          :columns="columns"
          :request-api="projectRequestApi"
          table-key="demo-header-actions"
          row-key="id"
          :page-size="5"
          :toolbar="toolbar"
          :selection-bar-actions="selectionBarActions"
          :max-visible-actions="3"
        />
      </DemoField>

      <DemoField
        id="demo-toolbar-slot"
        label="slot 通道：作用域读选中数 + #selectionBar 完全接管"
        :code="slotCode"
      >
        <p :class="bem.e('hint')">
          验证：① #tableHeader 的 ElTag 随勾选实时更新 ② 勾选后批量区显示「自定义批量区：N 行」 ③
          点「清除选中」批量条消失
        </p>
        <ProTable
          :columns="columns"
          :request-api="projectRequestApi"
          table-key="demo-header-actions-slot"
          row-key="id"
          :page-size="5"
        >
          <template #tableHeader="{ selectedCount }">
            <ElTag type="primary">已选 {{ selectedCount }} 项</ElTag>
          </template>
          <template #selectionBar="{ selectedRows, clearSelection }">
            <span :class="bem.e('custom-bar')">自定义批量区：{{ selectedRows.length }} 行</span>
            <ElButton size="small" type="danger" @click="clearSelection">清除选中</ElButton>
          </template>
        </ProTable>
      </DemoField>
    </section>

    <ApiTable
      title="ToolbarAction 字段（2026-09-18）"
      :items="toolbarActionItems"
      anchor="api-toolbar-action"
    />
    <ApiTable title="新增 props" :items="toolbarPropsItems" anchor="api-toolbar-props" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-header-actions {
  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }

  &__custom-bar {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}
</style>
