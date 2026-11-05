<script setup lang="ts">
/**
 * ProTable 行拖拽 demo（spec §五.4 / §八.3）
 *
 * 演示能力：
 * - 拖拽手柄列（draggable: true）触发 sortablejs
 * - 业务拦截（onSortChange 弹确认框）
 * - 跨层拖拽拦截（树形模式 crossLevelDrag=false）
 *
 * 验证步骤：
 * 1. 4 行任务显示，首列有拖拽手柄
 * 2. 拖拽第 1 行到第 3 位 → 弹确认框
 * 3. 点「确定」→ 数据顺序变化；点「取消」→ 顺序不变
 */
import type { ProColumn } from '@vv/ui/components/ProTable/types/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { tasksRequestApi } from '@mock/pro-table/tasks'
import {
  rowDragColumnItems,
  rowDragConfigItems,
  rowDragExposeItems,
} from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-row-drag')

const columns: ProColumn[] = [
  { prop: '__drag__', label: '拖拽', draggable: true, width: 60 },
  { prop: 'title', label: '任务' },
  { prop: 'priority', label: '优先级' },
]

const dragConfig = {
  handle: '__drag__',
  // useConfirm 取消 resolve false、确认 resolve true；与 ElMessageBox 原生 reject cancel 字符串不同
  // （v3.5 §1.5 全项目规范：业务侧统一 useConfirm，避开 Uncaught (in promise) cancel 噪音）
  onSortChange: async (_newOrder: Record<string, unknown>[]) => {
    return await useConfirm({ title: '提示', content: '确认调整任务顺序？' })
  },
}

const tocItems = [
  { id: 'demo-row-drag', label: '能力演示' },
  { id: 'api-row-drag-column', label: 'ProColumn.draggable' },
  { id: 'api-row-drag-config', label: 'RowDragConfig' },
  { id: 'api-row-drag-expose', label: 'Expose API' },
]

useDocToc(tocItems)

const basicCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="requestApi"
    :enable-row-drag="dragConfig"
    row-key="id"
  />
</template>

<script setup lang="ts">
const columns = [
  { prop: '__drag__', label: '拖拽', draggable: true },  // 拖拽手柄列
  { prop: 'title', label: '任务' }
]

const dragConfig = {
  handle: '__drag__',
  onSortChange: async (newOrder) => {
    // 业务拦截：返回 false 回滚，Promise 等待异步确认
    return await confirmWithUser(newOrder)
  }
}
<\/script>`
</script>

<template>
  <DemoFrame
    title="ProTableRowDrag 行拖拽排序"
    source="src/components/ProTable/composables/useRowDrag.ts"
    :introductions="[
      '基于 useRowDrag composable 绑定 sortablejs 到 el-table tbody。',
      '业务拦截点：onSortChange 返回 false 阻止更新 / 返回 Promise 等待异步确认。',
      '树形模式下自动启用跨层拖拽拦截（crossLevelDrag=false）。',
    ]"
  >
    <section id="demo-row-drag" :class="bem.b()">
      <DemoField label="基本用法（手柄列 + 业务拦截）" :code="basicCode">
        <ProTable
          :columns="columns"
          :request-api="tasksRequestApi"
          :enable-row-drag="dragConfig"
          row-key="id"
        />
      </DemoField>
    </section>

    <ApiTable
      title="ProColumn.draggable 字段"
      :items="rowDragColumnItems"
      anchor="api-row-drag-column"
    />
    <ApiTable title="RowDragConfig 配置" :items="rowDragConfigItems" anchor="api-row-drag-config" />
    <ApiTable
      title="Expose API（setRowOrder）"
      :items="rowDragExposeItems"
      anchor="api-row-drag-expose"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-row-drag {
  // BEM 命名空间
}
</style>
