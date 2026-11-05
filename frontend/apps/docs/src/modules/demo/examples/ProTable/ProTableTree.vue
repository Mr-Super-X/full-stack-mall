<script setup lang="ts">
/**
 * ProTable 树形数据 demo（spec §五.2 / §八.3）
 *
 * 演示能力：
 * - 4 层组织架构懒加载（公司 → 部门 → 小组 → 员工）
 * - defaultExpandDepth=1 默认展开第 1 层
 * - 点击展开按钮触发 loadChildren（200ms mock 延迟）
 * - 搜索命中路径自动展开（祖先节点）
 *
 * 验证步骤：
 * 1. 默认显示「示例公司」+ 展开「研发部」「市场部」
 * 2. 点击「研发部」→ 加载「前端组」「后端组」
 * 3. 点击「前端组」→ 显示「张三」「李四」
 * 4. 搜索「张三」→ 自动展开命中路径
 */
import type { ProColumn } from '@vv/ui/components/ProTable/types/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import { useDocToc } from '../../composables/useDocToc'
import { orgChartRequestApi, loadOrgChildren } from '@mock/pro-table/org-chart'
import { treeConfigItems, treeExposeItems } from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-tree')

const columns: ProColumn[] = [
  // v2.2：展开开关内联在树列（随层级缩进），无需再借 type:'expand' 列的 el-table 自带 icon
  { prop: 'name', label: '组织名称', tree: { indentSize: 20 } },
  { prop: 'hasChildren', label: '有子节点' },
]

const treeConfig = {
  loadChildren: (row: Record<string, unknown>) => loadOrgChildren(row as never),
  defaultExpandDepth: 1,
  rowKey: 'id',
}

const tocItems = [
  { id: 'demo-tree', label: '能力演示' },
  { id: 'api-tree-config', label: 'TreeConfig 字段' },
  { id: 'api-tree-expose', label: 'Expose API' },
]

useDocToc(tocItems)

const basicCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="requestApi"
    :enable-tree="treeConfig"
    row-key="id"
  />
</template>

<script setup lang="ts">
const columns = [
  { prop: 'name', label: '名称', tree: { indentSize: 20 } }
]

const treeConfig = {
  loadChildren: async (row) => {
    // 异步返回子节点
    return await fetchChildren(row.id)
  },
  defaultExpandDepth: 1,  // 默认展开第 1 层
  rowKey: 'id'
}
<\/script>`
</script>

<template>
  <DemoFrame
    title="ProTableTree 树形数据"
    source="src/components/ProTable/composables/useTreeData.ts"
    :introductions="[
      '基于 useTreeData composable 实现的树形表格：懒加载 + 默认展开深度 + 搜索命中路径自动展开。',
      '下方演示 4 层组织架构：点击展开触发 loadChildren（200ms mock 延迟），搜索命中自动展开祖先。',
      'vxe-table 引擎不支持树形能力（启动时 console.warn 并忽略），仅 element-plus 引擎生效。',
    ]"
  >
    <section id="demo-tree" :class="bem.b()">
      <DemoField label="基本用法（懒加载 + 默认展开）" :code="basicCode">
        <ProTable
          :columns="columns"
          :request-api="orgChartRequestApi"
          :enable-tree="treeConfig"
          row-key="id"
        />
      </DemoField>
    </section>

    <ApiTable title="TreeConfig 字段" :items="treeConfigItems" anchor="api-tree-config" />
    <ApiTable
      title="Expose API（expandNode/collapseNode/refreshChildren）"
      :items="treeExposeItems"
      anchor="api-tree-expose"
    />
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-tree {
  // BEM 命名空间（暂无自定义样式）
}
</style>
