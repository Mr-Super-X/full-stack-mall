<script setup lang="ts">
/**
 * ProTable 引擎对比 demo（v2.1 新增）
 *
 * 演示能力：
 * - tableEngine="vxe-table" 切换 vxe-table 渲染引擎（JS/CSS 动态按需加载）
 * - 同一份 columns / requestApi / responseAdapter 双引擎并排渲染，验证能力对齐
 * - vxe 引擎加载失败自动回退 element-plus（engine-fallback）
 *
 * 验证步骤：
 * 1. 左侧 el-table / 右侧 vxe-table 均正常渲染 12 行订单（分页各 10 行）
 * 2. 点两侧「金额」表头 → 均触发服务端排序（Network 带 orderByColumn=amount）
 * 3. 勾选两侧复选框 → selection-change 行集合一致（vxe 分支合并 checkbox-change/checkbox-all）
 *
 * 引擎能力说明（v3.5 PR1-B 后双引擎对齐）：
 * - 排序：双引擎均支持（已演示步骤 2）
 * - 多选：双引擎均支持（已演示步骤 3）
 * - 树形：双引擎均支持（v3.5 PR1-B 后 vxe 引擎补齐，参见 demo-tree-drag-compare 演示）
 * - 行拖拽：双引擎均支持（v3.5 PR1-B 后 vxe 引擎补齐）
 * - vxe 引擎加载失败自动回退 element-plus（engine-fallback）
 */
import type { ProColumn } from '@vv/ui/components/ProTable/types/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import {
  sortOrdersRequestApi,
  sortOrdersResponseAdapter,
  type Order,
} from '@mock/pro-table/sort-orders'
import { orgChartRequestApi, loadOrgChildren } from '@mock/pro-table/org-chart'
import {
  engineColumnItems,
  engineMatrixItems,
  enginePropsItems,
} from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-engine-compare')

/** 双引擎共用同一份列定义：多选 + 服务端排序 + 枚举 tag + 搜索 */
const columns: ProColumn<Order>[] = [
  { prop: 'orderNo', label: '订单号', sortable: 'custom', minWidth: 140 },
  { prop: 'customer', label: '客户', search: { el: 'input' }, minWidth: 160 },
  { prop: 'amount', label: '金额（元）', sortable: 'custom', width: 120 },
  {
    prop: 'status',
    label: '状态',
    enum: [
      { label: '待支付', value: 'pending', tagType: 'warning' },
      { label: '已支付', value: 'paid', tagType: 'success' },
      { label: '已发货', value: 'shipped' },
    ],
  },
]

/**
 * v3.5 PR1-B：树形 + 行拖拽双引擎对照列定义（组织架构 mock）
 * 复用 ProTableTree.vue 的 org-chart mock，验证双引擎树形 + 拖拽能力对等
 */
const treeDragColumns: ProColumn[] = [
  { prop: 'name', label: '组织名称', tree: { indentSize: 20 }, draggable: true },
  { prop: 'hasChildren', label: '有子节点', width: 100 },
]

const treeConfig = {
  loadChildren: (row: Record<string, unknown>) => loadOrgChildren(row as never),
  defaultExpandDepth: 1,
  rowKey: 'id',
}

const tocItems = [
  { id: 'demo-engine-compare', label: '能力演示' },
  { id: 'demo-tree-drag-compare', label: '树形 + 拖拽双引擎对照' },
  { id: 'api-engine-props', label: '引擎 Props' },
  { id: 'api-engine-column', label: 'ProColumn.vxeProps' },
  { id: 'api-engine-matrix', label: 'vxe 能力矩阵' },
]

useDocToc(tocItems)

const engineCode = `<template>
  <!-- 默认引擎 element-plus；vxe-table 首次 mount 时动态加载（JS + CSS 按需注入） -->
  <ProTable table-engine="vxe-table" :columns="columns" :request-api="sortOrdersRequestApi" />
</template>

<script setup lang="ts">
// vxe 列属性透传（仅 vxe 引擎生效；补充不覆盖 ProTable 派生值）
const columns: ProColumn<Order>[] = [
  { prop: 'amount', label: '金额', sortable: 'custom', vxeProps: { align: 'right' } },
]
<\/script>`

const treeDragCode = `<template>
  <!-- v3.5 PR1-B：树形 + 行拖拽能力双引擎对等 -->
  <ProTable
    :columns="treeDragColumns"
    :request-api="orgChartRequestApi"
    :enable-tree="treeConfig"
    :enable-row-drag="{ handle: '__all__' }"
    row-key="id"
  />
</template>

<script setup lang="ts">
const treeDragColumns = [
  { prop: 'name', label: '组织名称', tree: { indentSize: 20 }, draggable: true },
  { prop: 'hasChildren', label: '有子节点', width: 100 },
]
const treeConfig = {
  loadChildren: async (row) => await loadOrgChildren(row),
  defaultExpandDepth: 1,
  rowKey: 'id',
}
<\/script>`
</script>

<template>
  <DemoFrame
    title="ProTableEngineCompare 引擎对比"
    source="src/components/ProTable/components/VxeTableBody.vue"
    :introductions="[
      'tableEngine 切换渲染引擎：element-plus（默认）/ vxe-table（动态按需加载）。',
      'vxe-table 引擎按需动态加载，chunk 不进首屏；加载失败自动回退 element-plus。',
      '同一份 columns / requestApi 双引擎并排，验证列映射与事件适配（sort / selection）。',
      'v3.5 PR1-B 起 vxe 引擎也支持树形 + 行拖拽，与 element-plus 引擎能力对等。',
    ]"
  >
    <section id="demo-engine-compare" :class="bem.b()">
      <DemoField label="双引擎并排（同一份 columns / mock 接口）" :code="engineCode">
        <div :class="bem.e('grid')">
          <div :class="bem.e('pane')">
            <h4 :class="bem.e('engine-title')">element-plus（默认引擎）</h4>
            <ProTable
              :columns="columns"
              :request-api="sortOrdersRequestApi"
              :response-adapter="sortOrdersResponseAdapter"
              row-key="id"
            />
          </div>
          <div :class="bem.e('pane')">
            <h4 :class="bem.e('engine-title')">vxe-table 引擎</h4>
            <ProTable
              table-engine="vxe-table"
              :columns="columns"
              :request-api="sortOrdersRequestApi"
              :response-adapter="sortOrdersResponseAdapter"
              row-key="id"
            />
          </div>
        </div>
      </DemoField>
    </section>

    <!-- v3.5 PR1-B：树形 + 行拖拽双引擎对照演示 -->
    <section id="demo-tree-drag-compare" :class="bem.b()">
      <DemoField label="树形 + 行拖拽 双引擎对照（v3.5 PR1-B 补齐）" :code="treeDragCode">
        <div :class="bem.e('grid')">
          <div :class="bem.e('pane')">
            <h4 :class="bem.e('engine-title')">element-plus（默认引擎）</h4>
            <ProTable
              :columns="treeDragColumns"
              :request-api="orgChartRequestApi"
              :enable-tree="treeConfig"
              :enable-row-drag="{ handle: '__all__' }"
              row-key="id"
            />
          </div>
          <div :class="bem.e('pane')">
            <h4 :class="bem.e('engine-title')">vxe-table 引擎</h4>
            <ProTable
              table-engine="vxe-table"
              :columns="treeDragColumns"
              :request-api="orgChartRequestApi"
              :enable-tree="treeConfig"
              :enable-row-drag="{ handle: '__all__' }"
              row-key="id"
            />
          </div>
        </div>
      </DemoField>
    </section>

    <ApiTable title="引擎 Props" :items="enginePropsItems" anchor="api-engine-props" />
    <ApiTable
      title="ProColumn.vxeProps 字段"
      :items="engineColumnItems"
      anchor="api-engine-column"
    />
    <ApiTable title="vxe 引擎能力矩阵" :items="engineMatrixItems" anchor="api-engine-matrix" />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-engine-compare {
  &__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;

    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  }

  &__pane {
    min-width: 0;
  }

  &__engine-title {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}
</style>
