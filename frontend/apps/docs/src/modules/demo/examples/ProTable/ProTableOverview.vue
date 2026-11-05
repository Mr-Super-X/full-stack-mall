<script setup lang="tsx">
/**
 * ProTable 用法演示 + API 文档（半自动版，遵循 demo 模块规范）
 *
 * - name / type / required → 走 extractApi 自动从源码提取
 * - description → 手写字典
 *
 * 覆盖功能：
 *   1. columns 同时驱动表格列与搜索项
 *   2. 搜索 / 重置 / 展开收起
 *   3. enum 自动渲染 ElTag
 *   4. 多选跨页记忆（el-table reserve-selection）
 *   5. 工具栏：刷新 / 密度切换 / 列设置抽屉
 *   6. 自定义插槽（tableHeader / toolButton / operation / id）
 *   7. defineExpose 调用（refresh / reset / getSelectedRows）
 *   8. 多选勾选 / 清除勾选（getSelectedRows / clearSelection，v2.2-M1 验证入口）
 *
 * 路由：自动注册为 `/demo/pro-table-overview`
 */
import { ElButton, ElTag, ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import type { ProColumn } from '@vv/ui/components/ProTable/index.ts'
import type { ProTableExpose } from '@vv/ui/components/ProTable/types/index.ts'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import { useDocToc } from '../../composables/useDocToc'
import ApiTable from '../../components/ApiTable.vue'
import {
  overviewRequestApi,
  STATUS_OPTIONS,
  ROLE_OPTIONS,
  type OverviewUserRow,
} from './configs/projects-users'

const bem = createNamespace('demo-pro-table')

/* ───────────── 列定义 ───────────── */

const columns: ProColumn[] = [
  { prop: 'id', label: 'ID', width: 80, sortable: true },
  {
    prop: 'name',
    label: '姓名',
    minWidth: 120,
    sortable: true,
    search: { el: 'input', defaultValue: '', span: 6 },
  },
  { prop: 'age', label: '年龄', width: 80, sortable: true },
  {
    prop: 'status',
    label: '状态',
    width: 100,
    enum: [...STATUS_OPTIONS],
    search: { el: 'select', defaultValue: null, span: 6 },
  },
  {
    prop: 'role',
    label: '角色',
    width: 100,
    enum: ROLE_OPTIONS,
    search: { el: 'input', defaultValue: '', span: 6 },
  },
  { prop: 'createdAt', label: '创建时间', width: 180 },
  { prop: 'operation', label: '操作', type: 'operation', width: 160 },
]

/* ───────────── defineExpose（外部按钮触发） ───────────── */

const proTableRef = ref<ProTableExpose | null>(null)

async function handleRefresh(): Promise<void> {
  await proTableRef.value?.refresh()
  ElMessage.success('已 refresh')
}

async function handleReset(): Promise<void> {
  await proTableRef.value?.reset()
  ElMessage.success('已 reset（保留多选，附录 A #1）')
}

function handleViewDetail(row: Record<string, unknown>): void {
  ElMessage.info(`查看详情：${(row as OverviewUserRow).name}`)
}

function handleDelete(row: Record<string, unknown>): void {
  ElMessage.warning(`删除：${(row as OverviewUserRow).name}`)
}

/* ───────────── 多选（勾选 / 清除勾选，v2.2-M1 验证入口） ───────────── */

const selectionRef = ref<ProTableExpose | null>(null)

const selectionColumns: ProColumn[] = [
  {
    prop: '__selection',
    label: '',
    type: 'selection',
    width: 50,
    /** 跨页记忆：el-table reserve-selection（依赖 row-key；清选区用 expose 的 clearSelection） */
    tableProps: { reserveSelection: true },
  },
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', minWidth: 140 },
  { prop: 'role', label: '角色', width: 100, enum: ROLE_OPTIONS },
  { prop: 'createdAt', label: '创建时间', width: 180 },
]

/** 读取当前选区 —— 跨页勾选时返回所有页累计选中的行（reserve-selection 汇总） */
function handleGetSelected(): void {
  const rows = selectionRef.value?.getSelectedRows() ?? []
  if (rows.length === 0) {
    ElMessage.info('当前未选中任何行')
    return
  }
  const names = rows.map((r) => (r as OverviewUserRow).name).join('、')
  ElMessage.success(`已选中 ${rows.length} 行：${names}`)
}

/** v2.2-M1 验证点：clearSelection 除清空 selectedRows 外，同步清除 el-table UI 勾选态 */
function handleClearSelection(): void {
  selectionRef.value?.clearSelection()
  ElMessage.success('已清除勾选（selectedRows 与 UI 勾选同步清空）')
}

/* ───────────── toc 锚点 ───────────── */

const tocItems = [
  { id: 'demo-basic', label: '基础用法', level: 2 },
  { id: 'demo-enum', label: 'enum → ElTag', level: 2 },
  { id: 'demo-slots', label: '自定义插槽', level: 2 },
  { id: 'demo-render', label: '自定义渲染（col.render）', level: 2 },
  { id: 'demo-expose', label: 'defineExpose 调用', level: 2 },
  { id: 'demo-selection', label: '多选（勾选 / 清除勾选）', level: 2 },
  { id: 'demo-v2-capabilities', label: '四类能力切换', level: 2 },
  { id: 'api-props', label: 'Props', level: 2 },
  { id: 'api-slots', label: 'Slots', level: 2 },
  { id: 'api-expose', label: 'Expose', level: 2 },
  { id: 'api-columns', label: 'ProColumn 字段', level: 2 },
]

useDocToc(tocItems)

/* ───────────── API 文档 items（移到变量，避免模板字符串解析问题） ───────────── */

const propsItems = [
  {
    name: 'columns',
    type: 'ProColumn[]',
    required: true,
    default: '-',
    description: '列定义数组（同时驱动搜索项与表格列）',
  },
  {
    name: 'requestApi',
    type: 'fn',
    required: true,
    default: '-',
    description: '数据请求方法，返回 { data, total, pageNum, pageSize }',
  },
  {
    name: 'initParam',
    type: 'object',
    required: false,
    default: '{}',
    description: '固定查询参数（搜索时与表单值合并）',
  },
  {
    name: 'pagination',
    type: 'boolean | object',
    required: false,
    default: 'true',
    description: '是否显示分页（true / false / 透传 el-pagination props）',
  },
  {
    name: 'tableEngine',
    type: 'enum',
    required: false,
    default: 'element-plus',
    description:
      "表格引擎（值: 'element-plus' | 'vxe-table'；v2.1 起支持 vxe-table 引擎，动态按需加载，chunk 不进首屏；首次 mount 前设置，运行时修改需 reload）",
  },
  {
    name: 'tableKey',
    type: 'string',
    required: false,
    default: '-',
    description: 'localStorage 缓存列设置的 key（未传则不持久化）',
  },
  {
    name: 'rowKey',
    type: 'string',
    required: false,
    default: '-',
    description: '行 key 字段名（多选必填）',
  },
  { name: 'pageSize', type: 'number', required: false, default: '10', description: '初始每页大小' },
  {
    name: 'searchRows',
    type: 'number',
    required: false,
    default: '3',
    description: '搜索项默认显示行数（超出可展开）',
  },
  {
    name: 'density',
    type: 'enum',
    required: false,
    default: 'default',
    description: "默认密度（值: 'compact' | 'default' | 'loose'）",
  },
]

const slotsItems = [
  { name: 'tableHeader', description: '左上角标题 + 自定义按钮' },
  { name: 'toolButton', description: '工具栏右侧扩展按钮' },
  { name: '[prop]', description: '覆盖对应列单元格（如 #id、#operation）' },
  { name: 'operation', description: '操作列内容' },
  { name: 'search-[prop]', description: '覆盖对应搜索项' },
  { name: 'empty', description: '空状态自定义' },
  { name: 'expand', description: '展开行内容（el-table）' },
  { name: 'paginationLeft', description: '分页区左侧扩展' },
  { name: 'paginationRight', description: '分页区右侧扩展' },
]

const exposeItems = [
  { name: 'refresh', type: 'fn', description: '重新执行当前搜索条件' },
  {
    name: 'reset',
    type: 'fn',
    description: '重置搜索参数到 defaultValue + 清空分页 + 刷新（保留多选）',
  },
  { name: 'getSelectedRows', type: 'fn', description: '当前多选选中的行' },
  { name: 'clearSelection', type: 'fn', description: '清空所有选中' },
  { name: 'getSearchParams', type: 'fn', description: '当前搜索参数快照' },
  { name: 'setSearchParams', type: 'fn', description: '程序化修改搜索参数（回第 1 页 + 刷新）' },
  {
    name: 'element',
    type: 'ComponentPublicInstance | null',
    description: 'element-plus 表格实例（仅 element-plus 引擎）',
  },
  { name: 'engine', type: 'TableEngine', description: '当前激活的引擎（首次挂载锁定）' },
]

const columnsItems = [
  {
    name: 'prop',
    type: 'string',
    required: true,
    description: '字段名（v-for key + table column prop + search key）',
  },
  { name: 'label', type: 'string', required: true, description: '显示文本（表头 + 表单 label）' },
  {
    name: 'type',
    type: 'enum',
    description: "特殊列类型（值: 'index' | 'selection' | 'expand' | 'operation'）",
  },
  { name: 'search', type: 'SearchConfig', description: '搜索配置（缺省则该列不参与搜索）' },
  { name: 'enum', type: 'EnumProps[]', description: '字典映射（自动渲染 ElTag）' },
  { name: 'isFilterEnum', type: 'boolean', description: '是否从 useDict 异步字典过滤' },
  { name: 'render', type: 'fn', description: '自定义单元格渲染（返回 VNode）' },
  { name: 'tableProps', type: 'object', description: '透传给 ElTableColumn / VxeColumn' },
]

/* ───────────── 代码片段（DemoField code prop） ───────────── */

const basicCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="overviewRequestApi"
    table-key="demo"
    row-key="id"
  />
</template>

<script setup lang="tsx">
import type { ProColumn } from '@vv/ui/components/ProTable/index.ts'

const columns: ProColumn[] = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'name', label: '姓名', search: { el: 'input' } },
  { prop: 'status', label: '状态', enum: [{ label: '启用', value: 1 }] },
]
<\/script>`

const enumCode = `// enum 字段自动渲染为 ElTag
const STATUS = [
  { label: '启用', value: 1, tagType: 'success' },
  { label: '禁用', value: 0, tagType: 'info' },
]

// 在 columns 中引用
const columns = [
  { prop: 'status', label: '状态', enum: STATUS },
]`

const slotsCode = `<ProTable :columns="columns" :request-api="api">
  <template #tableHeader>
    <strong>自定义标题</strong>
  </template>
  <template #toolButton>
    <ElButton>自定义按钮</ElButton>
  </template>
  <template #operation="{ row }">
    <ElButton @click="onEdit(row)">编辑</ElButton>
  </template>
</ProTable>`

const exposeCode = `const proTableRef = ref<ProTableExpose>()

async function refresh() {
  await proTableRef.value?.refresh()
}

template: <ProTable ref="proTableRef" :columns="..." />`

const selectionCode = `// 列定义加一列 type: 'selection'（reserveSelection = 跨页记忆，需 row-key）
const columns: ProColumn[] = [
  { prop: '__selection', label: '', type: 'selection', width: 50,
    tableProps: { reserveSelection: true } },
  { prop: 'name', label: '姓名', minWidth: 140 },
]

// 外部按钮：读取选区 / 清除勾选
// v2.2-M1 起 clearSelection 同步清空 el-table UI 勾选态（修复只清数据不清 UI）
const rows = proTableRef.value?.getSelectedRows()
proTableRef.value?.clearSelection()`

/* ───────────── 自定义渲染（JSX / h()）演示 ───────────── */

/** 列定义：演示 col.render 三种用法
 *  1. JSX 渲染按钮组（操作列）
 *  2. JSX 条件渲染（年龄颜色 + 🎉）
 *  3. JSX 渲染复杂结构（角色 ElTag + 文字）
 * 注：本文件用 lang="tsx"（vue 3 JSX 编译，@vitejs/plugin-vue-jsx 已配） */
const renderColumns: ProColumn[] = [
  { prop: 'id', label: 'ID', width: 80 },
  {
    prop: 'name',
    label: '姓名（JSX + headerRender 演示）',
    minWidth: 180,
    /** headerRender：返回带 tooltip 的表头（spec §一 ProColumn.headerRender 字段） */
    headerRender: () => (
      <el-tooltip content="用户的真实姓名" placement="top">
        <span>
          姓名 <i style={{ color: '#409eff', cursor: 'help' }}>ⓘ</i>
        </span>
      </el-tooltip>
    ),
  },
  {
    prop: 'age',
    label: '年龄（JSX 自定义格式）',
    width: 140,
    /** JSX render：返回带条件颜色的 span */
    render: ({ row }) => (
      <span style={{ color: Number(row.age) >= 30 ? '#67c23a' : '#909399' }}>
        {row.age} 岁 {Number(row.age) >= 30 ? '🎉' : ''}
      </span>
    ),
  },
  {
    prop: 'role',
    label: '角色（JSX 多元素）',
    width: 200,
    /** JSX render：返回 ElTag + span 多元素 */
    render: ({ row }) => {
      const roleMap: Record<
        string,
        { label: string; type: 'primary' | 'success' | 'warning' | 'info' | 'danger' }
      > = {
        admin: { label: '管理员', type: 'danger' },
        editor: { label: '编辑', type: 'warning' },
        guest: { label: '访客', type: 'info' },
      }
      const r = roleMap[String(row.role)]
      return r ? (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <el-tag type={r.type} size="small">
            {r.label}
          </el-tag>
          <span style={{ color: '#909399', fontSize: '12px' }}>(动态)</span>
        </div>
      ) : (
        <span>{String(row.role)}</span>
      )
    },
  },
  {
    prop: 'createdAt',
    label: '创建时间（JSX 格式化）',
    width: 180,
    /** JSX render：返回格式化日期 + 条件颜色（3 天内绿色） */
    render: ({ row }) => {
      const date = new Date(String(row.createdAt))
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const isRecent = Date.now() - date.getTime() < 1000 * 60 * 60 * 24 * 3
      return (
        <span style={{ color: isRecent ? '#67c23a' : undefined }}>
          {y}-{m}-{d}
        </span>
      )
    },
  },
  {
    prop: 'operation',
    label: '操作（JSX 多按钮）',
    type: 'operation',
    width: 200,
    /** JSX render：返回多个 ElButton（按钮组） */
    render: ({ row }) => (
      <div style={{ display: 'flex', gap: '8px' }}>
        <el-button type="primary" link size="small" onClick={() => handleViewDetail(row)}>
          查看
        </el-button>
        <el-button
          type="warning"
          link
          size="small"
          onClick={() => ElMessage.info(`编辑 ${(row as OverviewUserRow).name}`)}
        >
          编辑
        </el-button>
        <el-button
          type="danger"
          link
          size="small"
          onClick={() => ElMessage.warning(`删除 ${(row as OverviewUserRow).name}`)}
        >
          删除
        </el-button>
      </div>
    ),
  },
]

const renderCode = `// 列定义：3 种 render 用法
const columns: ProColumn[] = [
  {
    prop: 'age',
    label: '年龄',
    render: ({ row }) => h('span', { style: { color: '#67c23a' } }, \`\${row.age} 岁\`),
  },
  {
    prop: 'role',
    label: '角色',
    render: ({ row }) => h(ElTag, { type: 'warning' }, () => '编辑'),
  },
  {
    prop: 'operation',
    label: '操作',
    render: ({ row }) =>
      h('div', null, [
        h(ElButton, { onClick: () => onView(row) }, () => '查看'),
        h(ElButton, { onClick: () => onEdit(row) }, () => '编辑'),
      ]),
  },
]`

/* ───────────── v2.0 能力切换面板（spec §八.3 / Task 12） ───────────── */

const capabilityConfig = ref({
  rowEdit: false,
  tree: false,
  cellSpan: false,
  rowDrag: false,
})

function setAllCapabilities(val: boolean): void {
  capabilityConfig.value = { rowEdit: val, tree: val, cellSpan: val, rowDrag: val }
}

const capabilityOverviewCode = `<template>
  <ProTable
    :columns="columns"
    :request-api="requestApi"
    :enable-row-edit="config.rowEdit"
    :enable-tree="config.tree"
    :enable-cell-span="config.cellSpan"
    :enable-row-drag="config.rowDrag"
  />
</template>`
</script>

<template>
  <DemoFrame
    title="ProTable 配置驱动表格"
    source="src/components/ProTable/ProTable.vue"
    :introductions="[
      '基于 columns schema 的配置驱动表格组件，同一 columns 数组同时驱动搜索项与表格列。',
      '下方演示：基础用法 / enum 自动渲染 ElTag / 自定义渲染（render） / 自定义插槽 / defineExpose 调用 / 多选勾选清除 / 四类能力一键切换。',
    ]"
  >
    <div :class="bem.e('start-here')">
      <strong>👀 先看这个 —— 7 个场景按推荐顺序浏览</strong>
      <p>
        <strong>① 基础</strong>
        （必看）—— columns 同时驱动搜索与表格
      </p>
      <p>
        <strong>② enum</strong>
        （必看）—— 字典自动渲染 ElTag
      </p>
      <p>
        <strong>③ render</strong>
        （进阶）—— JSX 自定义单元格渲染
      </p>
      <p>
        <strong>④ 插槽</strong>
        （进阶）—— tableHeader / toolButton / operation / id
      </p>
      <p>
        <strong>⑤ defineExpose</strong>
        （进阶）—— refresh / reset 外部调用
      </p>
      <p>
        <strong>⑥ 多选</strong>
        （进阶）—— 勾选 / 清除勾选 + 跨页记忆
      </p>
      <p>
        <strong>⑦ 4 类能力</strong>
        （参考）—— 行内编辑 / 树形 / 单元格合并 / 行拖拽一键开关
      </p>
    </div>

    <!-- 基础用法 -->
    <section id="demo-basic">
      <DemoField label="基础用法（columns 驱动搜索 + 表格）" :code="basicCode">
        <ProTable
          :columns="columns"
          :request-api="overviewRequestApi"
          table-key="demo-pro-table-basic"
          row-key="id"
          :page-size="5"
        >
          <template #operation="{ row }">
            <ElButton link type="primary" size="small" @click="handleViewDetail(row)">
              查看
            </ElButton>
          </template>
          <template #id="{ row }">
            <ElTag size="small">#{{ row.id }}</ElTag>
          </template>
        </ProTable>
      </DemoField>
    </section>

    <!-- enum 自动渲染 ElTag -->
    <section id="demo-enum">
      <DemoField label="enum 自动渲染 ElTag" :code="enumCode">
        <p :class="bem.e('hint')">
          <code>enum</code>
          字段自动渲染为 ElTag，搜索项自动生成下拉（见上方"基础用法"演示）。
        </p>
        <div :class="bem.e('tag-demo')">
          <ElTag v-for="opt in STATUS_OPTIONS" :key="String(opt.value)" :type="opt.tagType">
            {{ opt.label }} ({{ opt.value }})
          </ElTag>
        </div>
      </DemoField>
    </section>

    <!-- 自定义插槽 -->
    <!-- 自定义渲染（col.render） -->
    <section id="demo-render">
      <DemoField label="自定义渲染（render 函数返回 VNode）" :code="renderCode">
        <ProTable
          :columns="renderColumns"
          :request-api="overviewRequestApi"
          table-key="demo-pro-table-render"
          row-key="id"
          :page-size="5"
        />
      </DemoField>
    </section>

    <section id="demo-slots">
      <DemoField label="自定义插槽" :code="slotsCode">
        <ProTable
          :columns="columns"
          :request-api="overviewRequestApi"
          table-key="demo-pro-table-slots"
          row-key="id"
          :page-size="3"
        >
          <template #tableHeader>
            <strong>用户列表（自定义标题，演示 tableHeader 插槽）</strong>
          </template>
          <template #toolButton>
            <ElButton size="small">自定义按钮（演示 toolButton 插槽）</ElButton>
          </template>
          <template #operation="{ row }">
            <ElButton link type="primary" size="small" @click="handleViewDetail(row)">
              查看
            </ElButton>
            <ElButton link type="danger" size="small" @click="handleDelete(row)">删除</ElButton>
          </template>
          <template #id="{ row }">
            <ElTag size="small" type="warning">#{{ row.id }}</ElTag>
          </template>
        </ProTable>
      </DemoField>
    </section>

    <!-- defineExpose -->
    <section id="demo-expose">
      <DemoField label="defineExpose 调用（refresh / reset）" :code="exposeCode">
        <div :class="bem.e('actions')">
          <ElButton :icon="Refresh" type="primary" @click="handleRefresh">手动 refresh</ElButton>
          <ElButton :icon="Search" @click="handleReset">手动 reset</ElButton>
          <span :class="bem.e('msg')">外部按钮触发 ProTable 实例方法</span>
        </div>
        <ProTable
          ref="proTableRef"
          :columns="columns"
          :request-api="overviewRequestApi"
          table-key="demo-pro-table-expose"
          row-key="id"
          :page-size="3"
        >
          <template #id="{ row }">
            <ElTag size="small">#{{ row.id }}</ElTag>
          </template>
        </ProTable>
      </DemoField>
    </section>

    <!-- 多选（勾选 / 清除勾选） -->
    <section id="demo-selection">
      <DemoField label="多选（勾选 / 清除勾选，含跨页记忆）" :code="selectionCode">
        <div :class="bem.e('actions')">
          <ElButton type="primary" @click="handleGetSelected">获取选中行</ElButton>
          <ElButton @click="handleClearSelection">清除勾选</ElButton>
          <span :class="bem.e('msg')">勾选多行后点按钮验证；翻到第 2 页再勾选，可验跨页记忆</span>
        </div>
        <ProTable
          ref="selectionRef"
          :columns="selectionColumns"
          :request-api="overviewRequestApi"
          table-key="demo-pro-table-selection"
          row-key="id"
          :page-size="5"
        />
      </DemoField>
    </section>

    <!-- API 文档 -->
    <ApiTable title="ProTable Props" :items="propsItems" />
    <ApiTable title="ProTable Slots" :items="slotsItems" />
    <ApiTable title="ProTable Expose（ref）" :items="exposeItems" />
    <ApiTable title="ProColumn 关键字段" :items="columnsItems" />

    <!-- v2.0 能力切换面板（Task 12） -->
    <section id="demo-v2-capabilities">
      <DemoField
        label="四类能力一键切换（行内编辑 / 树形 / 单元格合并 / 行拖拽）"
        :code="capabilityOverviewCode"
      >
        <div :class="bem.e('capability-panel')">
          <ElSwitch v-model="capabilityConfig.rowEdit" active-text="行内编辑" />
          <ElSwitch v-model="capabilityConfig.tree" active-text="树形数据" />
          <ElSwitch v-model="capabilityConfig.cellSpan" active-text="单元格合并" />
          <ElSwitch v-model="capabilityConfig.rowDrag" active-text="行拖拽" />
          <ElButton size="small" @click="setAllCapabilities(true)">一键全开</ElButton>
          <ElButton size="small" @click="setAllCapabilities(false)">恢复默认</ElButton>
        </div>
        <p :class="bem.e('hint')">
          切换上方 4 个开关，下方表格实时启用对应能力。 详细场景见：
          <code>/demo/pro-table-row-edit</code>
          /
          <code>tree</code>
          /
          <code>cell-span</code>
          /
          <code>row-drag</code>
          。
        </p>
        <!--
            v3.5 末次审计 CRITICAL 修复：
            原版只有开关 UI + 代码片段，缺一个受开关控制的 ProTable 实例 → 开关看似无效果。
            现按 capabilityOverviewCode 真实渲染表格，开关变化时表格行为实时变化。
            tree 开关对 flat mock 数据（无 children 字段）视觉无变化是预期——树形需带 children 的数据。
          -->
        <ProTable
          :columns="columns"
          :request-api="overviewRequestApi"
          :enable-row-edit="capabilityConfig.rowEdit"
          :enable-tree="capabilityConfig.tree"
          :enable-cell-span="capabilityConfig.cellSpan"
          :enable-row-drag="capabilityConfig.rowDrag"
          table-key="demo-pro-table-overview-capabilities"
          row-key="id"
          :page-size="5"
        />
      </DemoField>
    </section>
  </DemoFrame>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table {
  padding: 16px;

  &__start-here {
    margin-bottom: 16px;
    padding: 12px 16px;
    background: var(--el-fill-color-light);
    border-radius: 4px;

    p {
      margin: 4px 0;
    }
  }

  &__hint {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  &__tag-demo {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: 4px;
  }

  &__actions {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__msg {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }

  &__capability-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 4px;
  }
}
</style>
