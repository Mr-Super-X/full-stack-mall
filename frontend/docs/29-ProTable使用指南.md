# ProTable 配置驱动表格使用指南

> **文档版本**：v3.4.0 | **最后更新**：2026-09-17
> **覆盖版本**：v2.0（含 v2.1 vxe-table 引擎 + 服务端排序）
> **源码位置**：`packages/ui/src/components/ProTable/`
> **demo 站**：`/demo/pro-table-overview`（25 个演示：24 个能力 demo + 主入口，完整清单见 §16 示例索引）

---

## 📋 概述

`ProTable` 是项目内**配置驱动的企业级表格组件**，目标是替代传统「template 手写 + script 写状态 + 写一堆 watch」的散点式表格写法。

**3 大特色**：

| 特色                    | 体现                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **配置驱动**            | 一份 `columns` 同时驱动表头 + 表格列 + 搜索表单 + 列设置                                                |
| **双引擎**              | `element-plus`（默认）+ `vxe-table`（v2.1 动态加载），自动回退                                          |
| **17 composables 编排** | 核心 `useSearch` / `useColumns` / `useTable` / `useTableCapabilities` + 13 个能力/引擎/事件 composables |
| **4 大能力**            | v2.0 新增：行内编辑 / 树形 / 单元格合并 / 行拖拽（按需启用）                                            |
| **三态闭环**            | 与 `AsyncState` / `useRequest` 配合，loading/error/empty 完整处理                                       |

**适用场景**：

- 中后台列表页（搜索 + 分页 + 多选 + 排序）
- 需要服务端排序 / 服务端筛选的「重表格」页面
- 树形数据展示（如组织架构、菜单管理）
- 单元格合并的报表类需求
- 需要行内编辑的快速录入场景

---

## 1. 基础用法

### 1.1 最小可运行

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import ProTable from '@vv/ui/components/ProTable/ProTable.vue' // 或由 unplugin 自动注册，模板免 import
import type { ProColumn } from '@vv/ui/components/ProTable/types'
import { userApi } from '@api/modules/user'

interface UserRow {
  id: number
  username: string
  status: 'active' | 'disabled'
  createTime: string
}

const searchParams = reactive({})

const columns: ProColumn<UserRow>[] = [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'username', label: '账号', search: { el: 'input' } },
  {
    prop: 'status',
    label: '状态',
    enum: [
      { label: '启用', value: 'active', tagType: 'success' },
      { label: '禁用', value: 'disabled', tagType: 'danger' },
    ],
    search: { el: 'select' },
  },
  { prop: 'createTime', label: '创建时间', width: 180 },
]

async function requestApi(params: Record<string, unknown>) {
  const { data } = await userApi.getList(params)
  return {
    data: data.list,
    total: data.total,
    pageNum: params.pageNum as number,
    pageSize: params.pageSize as number,
  }
}
</script>

<template>
  <ProTable :columns="columns" :request-api="requestApi" row-key="id" />
</template>
```

### 1.2 Props 表（v2.0）

| Prop                   | 类型                                                         | 默认值           | 说明                                                                     |
| ---------------------- | ------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------ |
| `columns`              | `ProColumn<T>[]`                                             | 必填             | 列定义（驱动表头 + 表格 + 搜索 + 列设置）                                |
| `requestApi`           | `ProTableRequestApi<T>`                                      | 必填             | 数据请求方法（必填）                                                     |
| `initParam`            | `Record<string, unknown>`                                    | `{}`             | 固定查询参数（与搜索值合并）                                             |
| `dataCallback`         | `(data: T[]) => T[]`                                         | `undefined`      | 数据后处理（拿到 result 之后）                                           |
| `requestError`         | `(error: unknown) => void`                                   | `undefined`      | 请求错误回调                                                             |
| `pagination`           | `boolean \| Record<string, unknown>`                         | `true`           | 是否显示分页 / 透传分页 props                                            |
| `sortParamsAdapter`    | `(state: SortState<T>) => Record`                            | 缺省约定         | 排序参数序列化（默认 `{ orderByColumn, isAsc }`）                        |
| `filterParamsAdapter`  | `(filters: FilterValuesMap) => Record<string, unknown>`      | 缺省直传         | 服务端筛选参数序列化（v3.5 PR2 新增；详见 §3.5）                         |
| `responseAdapter`      | `(raw: unknown) => ProTableResponse<T>`                      | 缺省直通         | 响应结构适配（非约定后端用）                                             |
| `tableEngine`          | `'element-plus' \| 'vxe-table'`                              | `'element-plus'` | 表格引擎（首次 mount 锁定）                                              |
| `tableKey`             | `string`                                                     | `undefined`      | localStorage 持久化列设置的 key                                          |
| `rowKey`               | `string`                                                     | 必填（多选）     | 行 key 字段名                                                            |
| `pageSize`             | `number`                                                     | `10`             | 初始每页大小                                                             |
| `searchRows`           | `number`                                                     | `3`              | 搜索项默认显示行数（超出可展开）                                         |
| `density`              | `'compact' \| 'default' \| 'loose'`                          | `'default'`      | 表格密度                                                                 |
| `enableRowEdit`        | `boolean \| RowEditConfig`                                   | `false`          | 行内编辑（v2.0）                                                         |
| `enableTree`           | `boolean \| TreeConfig`                                      | `false`          | 树形数据（v2.0）                                                         |
| `enableCellSpan`       | `boolean \| CellSpanConfig`                                  | `false`          | 单元格合并（v2.0）                                                       |
| `enableRowDrag`        | `boolean \| RowDragConfig`                                   | `false`          | 行拖拽排序（v2.0）                                                       |
| `enableSummary`        | `boolean \| SummaryConfig`                                   | `false`          | 客户端汇总行（v3.0：按列聚合 `sum` / `avg` / `count` / `max` / `min`）   |
| `virtualized`          | `boolean \| VirtualScrollConfig`                             | `false`          | 虚拟滚动（v3.0：10 万行 × 10 列流畅渲染；强隔离与其他能力 warn + 忽略）  |
| `autoHeight`           | `boolean \| AutoHeightConfig`                                | `false`          | 表格区自动撑满视口剩余高度（v3.1；与 `virtualized` 同开被忽略）          |
| `statePersist`         | `boolean`                                                    | `false`          | 路由级持久化搜索/分页/排序状态（v3.1；需配合 `tableKey`，F5 刷新不恢复） |
| `columnResize`         | `boolean`                                                    | `false`          | 表头列边框可拖动调宽（v3.0.1；`virtualized` 分支不支持）                 |
| `searchDisplay`        | `(params) => Record<string, boolean>`                        | `undefined`      | 搜索字段联动显隐（v3.2：返回 `false` 的字段彻底隐藏）                    |
| `searchLayout`         | `'auto' \| 'flat' \| 'collapse' \| 'flat-large' \| 'drawer'` | `'auto'`         | 搜索区布局档位强制指定（v3.4：替代纯字段数自动判定）                     |
| `showSelectedTags`     | `boolean`                                                    | `true`           | 搜索区与表格之间显示「已选条件」tag 回显（v3.2）                         |
| `expandedStatePersist` | `boolean`                                                    | `false`          | 展开/收起状态持久化到 localStorage（v3.2；需配合 `tableKey`）            |
| `toolbar`              | `ToolbarAction<T>[]`                                         | `undefined`      | 工具栏配置式按钮（2026-09-18：权限/确认/折叠由组件代管，见 §9）          |
| `selectionBarActions`  | `ToolbarAction<T>[]`                                         | `undefined`      | 批量操作条按钮（选中行 > 0 时浮出，见 §9.3）                             |
| `maxVisibleActions`    | `number`                                                     | `3`              | 工具栏直出按钮上限，超出折叠进「更多」下拉（见 §9.1）                    |

### 1.3 defineExpose（v2.0）

```ts
interface ProTableExpose<T> {
  // —— 基础 ——
  refresh(): Promise<void>
  reset(): Promise<void>
  getSelectedRows(): T[]
  clearSelection(): void
  getSearchParams(): Record<string, unknown>
  setSearchParams(params: Record<string, unknown>): Promise<void>
  element: Ref<ComponentPublicInstance | null>
  engine: TableEngine
  getSortState(): SortState<T> | null
  getFilterState(): FilterValuesMap // v3.5 PR2 新增；返回当前所有筛选列的 value 数组

  // —— 行内编辑（v2.0） ——
  startEdit(rowKey: string | number): void
  cancelEdit(rowKey?: string | number): void
  saveEdit(rowKey?: string | number): Promise<boolean>

  // —— 树形（v2.0） ——
  expandNode(rowKey: string | number, expanded?: boolean): void
  collapseNode(rowKey: string | number): void
  refreshChildren(rowKey: string | number): Promise<void>

  // —— 行拖拽（v2.0） ——
  setRowOrder(newOrder: T[]): void
}
```

### 1.4 Events（v3.5 PR2 起完整披露）

ProTable 通过 `defineEmits` 暴露 3 个对外事件，**v3.5 PR2 起 vxe/element-plus 双引擎均触发**（此前 PR1 之前部分事件仅在 element-plus 引擎下触发）：

| Event             | Payload 类型                                      | 触发时机                                                                                                              | 适用场景                                                                                                           |
| ----------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `sort-change`     | `SortState<T> \| null`                            | 排序列变化（点表头排序按钮）；`null` 表示无排序；**仅 `sortable: 'custom'` 列触发**（客户端排序列变化不 emit）        | 监听服务端排序 → 自定义请求参数                                                                                    |
| `filter-change`   | `Record<string, (string \| number \| boolean)[]>` | 任意筛选列值变化（**payload 恒为 merge 后全表快照**，与 `getFilterState()` 同形态；**v3.5 PR2 起 vxe 引擎同样支持**） | 服务端筛选的请求参数构造；状态回显（无 `filterParamsAdapter` 时 payload 为 el-table 客户端筛选快照，仅供 UI 联动） |
| `engine-fallback` | `string`（降级原因）                              | 引擎自动降级（如 vxe + 树形 + 行拖拽三者冲突 → 退化为 element-plus）                                                  | 上报降级事件用于监控                                                                                               |

> **内部转发事件（非公共契约）**：`expand-toggle` 是 ProTable 内部转发 `VxeTableBody` 的树形展开/折叠事件（v3.5 PR1-B 起），业务方**无需**也**不应**监听。如需程序化展开/折叠树节点，请用 `defineExpose` 的 `expandNode(rowKey, expanded?)` / `collapseNode(rowKey)` 方法（见 §1.3）。该事件不出现在本表，避免与 ProTable 自身 emit 的公共事件混淆。

**示例：监听服务端筛选**

```vue
<ProTable
  :columns="columns"
  :request-api="fetchUsers"
  :filter-params-adapter="adaptFilters"
  @filter-change="(f) => console.log('当前筛选：', f)"
/>
```

**Payload 子类型**：

```ts
type FilterValue = string | number | boolean // 单个筛选值
type FilterValuesMap = Record<string, FilterValue[]> // { 列字段名: 值数组 }
type FilterParamsAdapter = (filters: FilterValuesMap) => Record<string, unknown>
```

> **设计取舍**：`FilterValue` 刻意排除 `null` / `undefined` —— 多选筛选时以「空数组」表达「无筛选」，与 `FilterParamsAdapter` 输出 `Record<string, unknown>` 解耦，让消费方自由映射到后端协议（如 `value.join(',')` 或 `value: undefined`）。

### 1.5 Slots（v3.5 起完整披露）

| Slot                                                      | 用途                                                                | 典型场景                        |
| --------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------- |
| `tableHeader`                                             | 表格上方自定义区域（透传给 TableHeader 组件）                       | 加导出按钮 / 自定义标题         |
| `toolButton`                                              | 工具栏按钮区域                                                      | 加自定义按钮                    |
| **`empty`**                                               | **空状态占位**（data 为空数组时显示；替换 Element Plus 默认空插画） | 自定义空态文案 / 引导按钮       |
| **`paginationLeft`**                                      | **分页器左侧**                                                      | 显示「共 X 条」                 |
| **`paginationRight`**                                     | **分页器右侧**                                                      | 加批量操作按钮 / 自定义分页扩展 |
| `operation` / `expand` / `search-[prop]` / `selectionBar` | 业务插槽透传（§2.5 / §4.2 / §9.3 已述）                             | 业务自定义                      |

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ProTable from '@vv/ui/components/ProTable/ProTable.vue' // 取 defineExpose 类型（InstanceType）需显式 import

const tableRef = ref<InstanceType<typeof ProTable>>()

async function handleExport() {
  const rows = tableRef.value?.getSelectedRows() ?? []
  if (rows.length === 0) return ElMessage.warning('请先勾选')
  await exportApi(rows)
}

async function handleProgrammaticSearch() {
  await tableRef.value?.setSearchParams({ status: 'active' })
}
</script>
```

---

## 2. 列定义 `ProColumn`

`columns` 是 ProTable 的核心入口，**一份配置驱动 4 个区域**（表头 / 表格 / 搜索 / 列设置）。

### 2.1 字段表

| 字段               | 类型                                                | 说明                                                                                  |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `prop`             | `keyof T \| string`                                 | 字段名（v-for key + column prop + search 表单 key）                                   |
| `label`            | `string`                                            | 显示文本（表头 + form label）                                                         |
| `type`             | `'index' \| 'selection' \| 'expand' \| 'operation'` | 特殊列（序号 / 多选 / 展开 / 操作）                                                   |
| `width`            | `number \| string`                                  | 列宽                                                                                  |
| `minWidth`         | `number \| string`                                  | 最小列宽                                                                              |
| `fixed`            | `'left' \| 'right'`                                 | 固定列                                                                                |
| `sortable`         | `boolean \| 'custom'`                               | 是否可排序（`true` 客户端；`'custom'` 服务端，M2 触发请求）                           |
| `hidden`           | `boolean \| Ref<boolean>`                           | 是否隐藏（支持响应式，列设置抽屉切换）                                                |
| `search`           | `SearchConfig`                                      | 搜索项配置（缺省则该列不参与搜索区）                                                  |
| `enum`             | `EnumProps[]`                                       | 字典映射（自动渲染 ElTag + 搜索下拉）                                                 |
| `headerRender`     | `(scope) => VNode`                                  | 自定义表头渲染（`h()` 或 JSX）                                                        |
| `render`           | `(scope) => VNode`                                  | 自定义单元格渲染                                                                      |
| `tableProps`       | `Record<string, unknown>`                           | 透传给 ElTableColumn 的 props                                                         |
| `vxeProps`         | `Record<string, unknown>`                           | 透传给 VxeColumn 的 props（仅 vxe 引擎生效）                                          |
| `edit`             | `ColumnEditConfig`                                  | 行内编辑配置（不声明 = 只读）                                                         |
| `tree`             | `ColumnTreeConfig`                                  | 树形列声明（仅一列生效，默认第一列）                                                  |
| `span`             | `ColumnSpanConfig`                                  | 单元格合并配置（不声明 = 不参与）                                                     |
| `draggable`        | `boolean`                                           | 该列是否参与行拖拽（默认 false）                                                      |
| `children`         | `ProColumn<T>[]`                                    | 子列（v3.0：多级表头分组；持久化按扁平 `prop` 维度处理）                              |
| `formatter`        | `ColumnFormatter<T>`                                | 单元格格式化（v3.1：函数 \| 预设 `'dateTime'`/`'amount'`/`'percent'`/`'boolTag'` 等） |
| `reserveSelection` | `boolean`                                           | 多选跨页保持选中（v3.1：仅 `type='selection'` 列生效，需配 `rowKey`）                 |

> **search 配置 v3.2 扩展**：`level`（`Basic`/`Advanced` 层级）/ `debounce`（输入防抖毫秒）/ `searchTrigger`（`change`/`enter`）/ `onChange`（字段联动清空）/ `lazyEnum`（字典懒加载）/ `collapsed`（per-field 折叠控制）—— 详见 §4.4/§4.5/§4.6。

### 2.2 枚举自动渲染（`enum` 字段）

`enum` 字段会让该列自动用 ElTag 渲染（颜色按 `tagType`），搜索区自动渲染为 select：

```ts
{
  prop: 'status',
  label: '状态',
  enum: [
    { label: '启用', value: 'active', tagType: 'success' },
    { label: '禁用', value: 'disabled', tagType: 'danger' },
    { label: '审核中', value: 'pending', tagType: 'warning' },
  ],
  search: { el: 'select' }, // 自动渲染为下拉
}
```

### 2.3 自定义渲染（`render`）

```vue
<script setup lang="ts">
import { h } from 'vue'
import { ElButton } from 'element-plus'

const columns: ProColumn<UserRow>[] = [
  {
    prop: 'username',
    label: '账号',
    render: ({ row }) =>
      h(ElButton, { link: true, onClick: () => viewDetail(row.id) }, () => row.username),
  },
]
</script>
```

**作用域参数**：

```ts
interface RenderScope<T> {
  row: T // 当前行数据
  column: ProColumn<T> // 当前列定义
  $index: number // 行索引
}
```

`headerRender` 作用域类似：`{ column, $index }`。

### 2.4 搜索配置（`search` 字段）

```ts
{
  prop: 'createTime',
  label: '创建时间',
  search: {
    el: 'date-picker',          // 控件类型
    props: { type: 'daterange', valueFormat: 'YYYY-MM-DD' }, // 透传给控件
    defaultValue: [],            // reset 时恢复
    span: 8,                    // el-col 占位（默认 6，4 列布局）
    order: 1,                   // 排序权重
    slot: 'custom-createTime',  // 自定义插槽名（spec §7）
  },
}
```

**支持的 `el` 类型**：

| `el` 值        | 渲染控件        |
| -------------- | --------------- |
| `input`        | el-input        |
| `select`       | el-select       |
| `date-picker`  | el-date-picker  |
| `tree-select`  | el-tree-select  |
| `cascader`     | el-cascader     |
| `input-number` | el-input-number |

### 2.5 特殊列 `type`

| `type`      | 行为                                               |
| ----------- | -------------------------------------------------- |
| `index`     | 序号列（自动计算 `$index + 1`）                    |
| `selection` | 多选列（必须配 `rowKey`）                          |
| `expand`    | 展开列（与 `expand` 插槽配合）                     |
| `operation` | 操作列（与 `operation` 插槽配合，默认靠右 + 固定） |

```vue
<template>
  <ProTable :columns="columns" :request-api="requestApi" row-key="id">
    <template #operation="{ row }">
      <el-button link type="primary" @click="edit(row)">编辑</el-button>
      <el-button link type="danger" @click="remove(row)">删除</el-button>
    </template>
    <template #expand="{ row }">
      <p>详情：{{ row.description }}</p>
    </template>
  </ProTable>
</template>
```

---

## 3. 数据请求与响应适配

### 3.1 `requestApi` 必填

```ts
type ProTableRequestApi<T> = (params: Record<string, unknown>) => Promise<ProTableResponse<T>>

interface ProTableResponse<T> {
  data: T[]
  total: number
  pageNum: number
  pageSize: number
}
```

`params` 是合并后的搜索参数（含 `pageNum` / `pageSize` / 各列搜索值 / `initParam`）。

### 3.2 默认响应约定

后端约定响应为 `{ data: T[], total, pageNum, pageSize }` 时，`requestApi` 可直接返回约定结构：

```ts
async function requestApi(params) {
  return {
    data: result.list,
    total: result.total,
    pageNum: params.pageNum as number,
    pageSize: params.pageSize as number,
  }
}
```

### 3.3 `responseAdapter` 适配非约定后端

```ts
// 后端返回 { items: [...], pagination: { total: 100, page: 1, pageSize: 10 } }
async function rawRequestApi(params) {
  return await orderApi.getList(params) // 类型侧 cast 一次
}

const adaptedRequestApi = (params: Record<string, unknown>) =>
  rawRequestApi(params).then(
    responseAdapter({
      raw => ({
        data: raw.items,
        total: raw.pagination.total,
        pageNum: raw.pagination.page,
        pageSize: raw.pagination.pageSize,
      })
    })
  )
```

> 映射结果结构非法（`data` 非数组 / `total` 非数字）时 `console.error` + 抛错（经 `useRequest` 错误通道进入 error 态）。

### 3.4 `dataCallback` 数据后处理

```ts
<ProTable
  :columns="columns"
  :request-api="requestApi"
  :data-callback="rows => rows.filter(r => r.status !== 'deleted')"
  row-key="id"
/>
```

---

## 3.5 服务端筛选（`filterParamsAdapter`）— v3.5 PR2

列头筛选（`ProColumn.tableProps.filters` 声明，element-plus 原生 column.filters 协议）默认走客户端筛选；声明 `filterParamsAdapter` 后筛选条件序列化为请求参数，走后端过滤：

```ts
<ProTable
  :columns="columns"
  :request-api="requestApi"
  :filter-params-adapter="filters => ({ statusList: filters.status, deptList: filters.dept })"
  row-key="id"
/>
```

**协议要点**：

- 入参 `FilterValuesMap`：全表筛选快照（`{ [列 field]: 选中值数组 }`）；返回对象并入请求 params（与 `sortParamsAdapter` 同层对称）。
- 触发时机：列头筛选 UI 操作 → `filter-change` → 合并进 filterState → 回第 1 页 + 触发请求。
- merge 语义（hotfix-2）：element-plus 2.14.x 的 `filter-change` 可能仅携带变化列 —— useTable 按列 merge 保留未变化列；空数组 = 用户清空该列（delete 语义，不残留空键）。
- 无 adapter 缺省行为：不传 `filterParamsAdapter` 时 el-table 客户端筛选默认值继续生效，`filterState` 仅作 UI 记忆 + `getFilterState()` 快照，不入请求。
- 双引擎协议对齐：vxe 引擎的 filter-change 是单列触发（payload 含 property/values），VxeTableBody 经 localFilterMap 合并成全表快照形态 emit —— 与 el-table 协议一致，消费方写法不依赖引擎选择。
- reset 复位：搜索区「重置」同步清空 filterState + 双引擎列头筛选 UI（el-table `clearFilter()` / vxe `clearFilter()`），旧筛选条件不会「复活」；并补发一次 `filter-change`（payload 为清空后的 `{}`），父级靠事件维护的筛选快照 / 埋点随 reset 回同步。
- 事件与快照：`filter-change` 事件 payload 为变化后的全表快照（父级可监听做 URL 同步 / 埋点）；`getFilterState()` expose 返回当前合并态。

完整示例见 `apps/docs/src/modules/demo/examples/ProTable/ProTableServerFilter.vue`（`/demo/pro-table-server-filter`）。

---

## 4. 搜索表单（自动渲染）

`columns` 中声明 `search` 的列会自动出现在 `<SearchForm>`（默认 3 行，超出可展开）。

### 4.1 显隐搜索区

若 `columns` 中没有任何 `search` 字段，搜索区自动不渲染。

### 4.2 自定义插槽

```vue
<template>
  <ProTable :columns="columns" :request-api="requestApi" row-key="id">
    <template #search-createTime="{ searchParams, updateParams }">
      <el-date-picker
        v-model="searchParams.createTime"
        type="daterange"
        @change="(v) => updateParams({ createTime: v })"
      />
    </template>
  </ProTable>
</template>
```

插槽命名规范：`search-<prop>`（kebab-case）。

### 4.3 程序化触发搜索

```ts
const tableRef = ref<InstanceType<typeof ProTable>>()

// 修改搜索参数并触发搜索 + 回到第 1 页
await tableRef.value?.setSearchParams({ status: 'active' })

// 重置搜索参数 + 分页 + 刷新（保留多选）
await tableRef.value?.reset()
```

> **三种入口的分页语义差异（D#18 披露）**：搜索按钮（`search()`）与 SelectedTags「清除单个/全部条件」**保留当前页**（仅重置搜索值后刷新）；`setSearchParams()` 与「重置」按钮**回到第 1 页**。差异理由：搜索按钮视为「同条件下换页查看」，重置视为「全新查询」。需要清条件回第 1 页时请用 `reset()`。

### 4.4 searchLayout：搜索区布局档位（v3.4）

替代「按字段数自动判定」档位（≤3 flat / 4-8 collapse / >8 flat-large）。真实业务两类场景不适配：① 宽屏页面想平铺更多字段却被强制折叠；② `searchDisplay` 联动使字段数动态变化时档位抖动。

```vue
<!-- 宽屏 6 字段强制全平铺 -->
<ProTable :columns="columns" :request-api="requestApi" search-layout="flat" />

<!-- searchDisplay 联动时锁定档位，避免布局抖动 -->
<ProTable :columns="columns" :request-api="requestApi" search-layout="collapse" />
```

| 值                        | 行为                                                     |
| ------------------------- | -------------------------------------------------------- |
| `'auto'`（默认）          | 维持原自动行为（≤3 flat / 4-8 collapse / >8 flat-large） |
| `'flat'` / `'flat-large'` | 全部平铺，无展开/收起按钮                                |
| `'collapse'`              | 强制折叠，始终显示展开/收起按钮                          |
| `'drawer'`                | 强制高级筛选抽屉形态                                     |

> **优先级**：存在 `search.level='advanced'` 字段时无论本配置为何都走 `drawer` 档（advanced 字段必须可达）。

### 4.5 searchDisplay：字段联动显隐（v3.2）

```vue
<ProTable
  :columns="columns"
  :request-api="requestApi"
  :search-display="
    (params) => ({
      refundReason: params.status === 'refunded',
      paymentTime: params.status === 'paid',
    })
  "
/>
```

- 返回 `false` 的字段**彻底隐藏**（不进入主表单，也不进入高级筛选抽屉）
- 函数应保持纯函数性（无副作用），内部按 reactive 自动追踪依赖

### 4.6 已选条件回显 + 展开状态持久化（v3.2）

```vue
<!-- 显示已选条件 tag（默认开启：搜索后忘了自己筛了什么，回显 + 一键清除） -->
<ProTable :columns="columns" :request-api="requestApi" />

<!-- 关闭回显 -->
<ProTable :columns="columns" :request-api="requestApi" :show-selected-tags="false" />

<!-- 展开/收起状态持久化到 localStorage（需配合 tableKey） -->
<ProTable :columns="columns" :request-api="requestApi" table-key="orders" expanded-state-persist />
```

`search.level='advanced'` + `showSelectedTags` 联动时，已选高级条件也会以 tag 形式回显在搜索区与表格之间。

---

## 5. 分页 + 服务端排序（M2）

### 5.1 分页配置

```ts
// 简单开关
<ProTable pagination :columns="columns" :request-api="requestApi" />

// 透传分页 props
<ProTable
  :pagination="{ layout: 'total, sizes, prev, pager, next, jumper', background: true }"
  :columns="columns"
  :request-api="requestApi"
/>

// 关闭分页
<ProTable :pagination="false" :columns="columns" :request-api="requestApi" />
```

### 5.2 服务端排序

`sortable: 'custom'` 列声明会触发 `sort-change` 事件 → ProTable 内部回第 1 页 + 重新请求，同时通过 `sort-change` 事件向外 emit 当前排序状态：

```ts
const columns: ProColumn<OrderRow>[] = [
  { prop: 'amount', label: '金额', sortable: 'custom' },
  { prop: 'createTime', label: '时间', sortable: 'custom' },
]

<ProTable
  :columns="columns"
  :request-api="requestApi"
  @sort-change="(s) => console.log('服务端排序状态：', s)"
/>
```

默认 `sortParamsAdapter` 输出 `{ orderByColumn: prop, isAsc: 'asc' | 'desc' }`。后端约定不同时覆盖：

```ts
<ProTable
  :columns="columns"
  :request-api="requestApi"
  :sort-params-adapter="(state) => ({ sortBy: state.prop, sortOrder: state.order })"
/>
```

> 客户端排序（`sortable: true`）维持 element-plus 原生行为，**不**触发请求。

---

## 6. 双引擎架构（element-plus / vxe-table）

### 6.1 引擎决策

```vue
<ProTable table-engine="element-plus" :columns="..." :request-api="..." />
<ProTable table-engine="vxe-table" :columns="..." :request-api="..." />
```

引擎在**首次 mount 前**锁定，运行时修改 `tableEngine` prop 无效（需 reload）。

### 6.2 何时用哪个

| 引擎           | 适用场景                                                                              |
| -------------- | ------------------------------------------------------------------------------------- |
| `element-plus` | 默认；与 Element Plus 主题深度集成；功能完整（编辑/树形/合并/拖拽均支持）             |
| `vxe-table`    | 大数据量（> 1 万行虚拟滚动）；需 vxe 特有能力（如虚拟树 / 复杂合并 / 单元格编辑内嵌） |

### 6.3 引擎回退机制

vxe-table 模块是动态加载（`import('vxe-table')`），加载失败时 ProTable 内部会自动回退 element-plus：

```ts
// ProTable.vue 内部
function handleEngineFallback() {
  engineRef.value = 'element-plus'
}
```

回退完成后 `engine` expose 返回 `'element-plus'`，业务代码无需关心。

### 6.4 vxe 引擎能力对等矩阵

v3.5 PR1-B 起 vxe-table 引擎已补齐树形 / 行拖拽 / 单元格合并 / 行内编辑四大能力，与 element-plus 引擎基本对等（virtualized 引擎仍为能力受限分支）：

| 能力             | element-plus | vxe-table                                  | virtualized（el-table-v2） |
| ---------------- | ------------ | ------------------------------------------ | -------------------------- |
| 树形             | ✓            | ✓（tree-config + toggle-tree-expand 回流） | ✗                          |
| 行拖拽           | ✓            | ✓（sortablejs 挂 vxe tbody）               | ✗                          |
| 单元格合并       | ✓            | ✓（spanMethod / cellClassName 已接线）     | ✗                          |
| 行内编辑         | ✓            | ✓（EditCell 分支齐备）                     | ✗                          |
| 列头筛选         | ✓            | ✓（v3.5 PR2 翻译层与 el 协议对齐）         | ✗                          |
| 多选跨页 reserve | ✓            | ✓（checkbox-config.reserve + 镜像回同步）  | ✗（selection 列忽略）      |

**已知观察项**：vxe + 树形 + 行拖拽三者同开时，sortablejs 与展开行 DOM 变化的兼容性尚在观察（console.debug 提示）——如遇拖拽错位，树形 / 拖拽二选一或向维护方反馈。

---

## 7. v2.0 新增四大能力

### 7.1 行内编辑 `enableRowEdit`

```ts
const columns: ProColumn<UserRow>[] = [
  {
    prop: 'username',
    label: '账号',
    edit: {
      el: 'input',
      rules: { required: true, message: '账号不能为空' },
      editable: true, // 或 Ref<boolean>
    },
  },
]

<ProTable :columns="columns" :request-api="requestApi" :enable-row-edit="{
  onSave: async (row, changes) => {
    await userApi.update(row.id, changes)
    return true
  },
}" />
```

**开启双击编辑**：

```vue
<template #tableHeader>
  <el-button @click="tableRef?.startEdit(rowKey)">编辑选中行</el-button>
</template>
```

### 7.2 树形数据 `enableTree`

```ts
<ProTable
  :columns="columns"
  :request-api="requestApi"
  :enable-tree="{
    loadChildren: async (row) => await menuApi.getChildren(row.id),
    childrenKey: 'subMenus',
    defaultExpandDepth: 2,
    rowKey: 'id',
  }"
/>
```

```vue
<script setup lang="ts">
const tableRef = ref<InstanceType<typeof ProTable>>()
tableRef.value?.expandNode('org-1', true) // 展开 org-1
tableRef.value?.refreshChildren('org-1') // 重新加载 org-1 子节点
</script>
```

> **树形 + 编辑互斥**：v2.0 与编辑共存时，编辑仅作用于叶子节点；`enable-tree` 加 `exclusive: true` 可禁用编辑按钮。

### 7.3 单元格合并 `enableCellSpan`

```ts
{
  prop: 'date',
  label: '日期',
  span: { direction: 'row' }, // 相同 date 合并行
}

<ProTable :columns="columns" :request-api="requestApi" :enable-cell-span="{
  maxMergeSpan: 100, // 安全上限（防止意外合并整列）
}" />
```

```ts
// 自定义合并规则
{
  prop: 'category',
  label: '类别',
  span: {
    direction: 'row',
    judge: (a, b) => a.category === b.category && a.month === b.month,
  },
}
```

### 7.4 行拖拽排序 `enableRowDrag`

```ts
<ProTable :columns="columns" :request-api="requestApi" :enable-row-drag="{
  handle: '__all__', // 或 '.__drag-handle' 指定手柄
  onSortChange: async (newOrder) => {
    await sortApi.update(newOrder.map(r => r.id))
    return true // 返回 true 表示服务端已处理；false 表示本地乐观更新
  },
}" />
```

`draggable: true` 列配置参与拖拽（默认 false）：

```ts
{ prop: 'sort', label: '拖拽', width: 60, draggable: true }
```

### 7.5 客户端汇总 `enableSummary`（v3.0）

```ts
<ProTable :columns="columns" :request-api="requestApi" :enable-summary="{
  aggregate: 'sum', // 'sum' | 'avg' | 'count' | 'max' | 'min' —— 全局聚合方式
  label: '合计',     // 汇总行首列显示文案
}" />
```

或按列单独配置：

```ts
{
  prop: 'amount', label: '金额',
  summary: { aggregate: 'sum', formatter: (v) => `¥${v.toFixed(2)}` },
}
```

**`SummaryAggregate` 子类型**（v3.0 起；聚合方式枚举）：

| 值        | 含义                     | 适用列类型             |
| --------- | ------------------------ | ---------------------- |
| `'sum'`   | 求和                     | number                 |
| `'avg'`   | 平均值                   | number                 |
| `'count'` | 非空行数（不依赖列类型） | any                    |
| `'max'`   | 最大值                   | number / date / string |
| `'min'`   | 最小值                   | number / date / string |

> **设计取舍**：`SummaryAggregate` 仅覆盖 5 种最常用聚合；自定义聚合（如中位数、分位数）可在列级 `summary.formatter` 内联实现，避免过度抽象。

---

## 8. 列设置与密度

### 8.1 列设置抽屉

`<TableHeader>` 包含列设置按钮，点击打开抽屉：

- 显示 / 隐藏列
- 调整列固定方向（左 / 右 / 不固定）
- 顺序调整（如启用）

### 8.2 持久化

```ts
<ProTable
  table-key="user-list"  // 落盘 key 形如 vue3-vite-project:user-list:columns（@vv/shared Local 封装自动加 VITE_STORAGE_NAMESPACE 前缀）
  :columns="columns"
  :request-api="requestApi"
/>
```

未传 `tableKey` 则不持久化（刷新页面恢复默认）。

### 8.3 密度切换

```ts
<ProTable density="compact" :columns="columns" :request-api="requestApi" />
// 'compact' | 'default' | 'loose'
```

`<TableHeader>` 提供密度切换：触发钮与刷新/全屏同为 circle icon 按钮，点击弹出三档下拉菜单（紧凑 / 默认 / 宽松，当前档带 ✓）。vxe 引擎切密度会触发 `recalculate` 重算行高（vxe 行高变量有缓存，data-density 变更不会自动重测）。

---

## 9. 工具栏与批量操作（2026-09-18）

真实业务页面的「新增 / 批量 / 导入 / 导出」按钮由两层能力承载：**配置式工具栏**（`toolbar` prop）+ **批量操作条**（`selectionBarActions` prop / `#selectionBar` slot）。设计 spec：`docs/superpowers/specs/2026-09-18-pro-table-toolbar-design.md`。

### 9.1 配置式工具栏 toolbar

```ts
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

<ProTable :columns="cols" :request-api="api" row-key="id"
  :toolbar="toolbar" :max-visible-actions="3" />
```

渲染管线（`<ToolbarRenderer>`）：perm 权限过滤（`useAuth`）→ `hidden` 计算 → `maxVisibleActions` 截断折叠「更多」下拉 → `confirm` 二次确认包装（`useConfirm`）→ `onClick(ctx)`。`children` 子项拍平参与折叠计数；`onClick` 返回 Promise 未结算期间按钮锁定防重入。

### 9.2 ToolbarAction 字段

| 字段       | 类型                                                                     | 说明                                                                     |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `label`    | `string`                                                                 | 按钮文案（必填）                                                         |
| `type`     | `'primary' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'default'` | EP 按钮类型                                                              |
| `icon`     | `Component`                                                              | EP 图标组件                                                              |
| `perm`     | `string \| string[]`                                                     | 权限编码（AND 语义，无权限不渲染）                                       |
| `confirm`  | `ToolbarConfirm`                                                         | 二次确认：`string` 或 `{ content, title?, danger?, confirmButtonText? }` |
| `disabled` | `boolean \| ((ctx: ToolbarCtx<T>) => boolean)`                           | 禁用（支持 ctx 函数联动，如未选中禁用导出）                              |
| `hidden`   | `boolean \| ((ctx: ToolbarCtx<T>) => boolean)`                           | 隐藏（同 disabled，但整按钮不渲染）                                      |
| `loading`  | `boolean`                                                                | 外部控制 loading 态                                                      |
| `onClick`  | `(ctx: ToolbarCtx<T>) => void \| Promise<void>`                          | 点击行为（必填；返回 Promise 期间自动锁定）                              |
| `children` | `ToolbarAction<T>[]`                                                     | 子动作（拍平参与折叠计数，不渲染多级菜单）                               |

`ToolbarCtx<T>` 作用域（同时下发到 `#tableHeader` / `#toolButton` slot）：

```ts
interface ToolbarCtx<T> {
  selectedRows: T[] // 当前选中行
  selectedCount: number // 选中数（快捷字段）
  loading: boolean // 表格请求中
  refresh: () => Promise<void> // 刷新表格
}
```

### 9.3 批量操作条 selectionBar

选中行 > 0 时浮出（`role="status"` + `aria-live="polite"`，进场动画），与工具栏解耦。双通道：

```vue
<!-- 通道 1：配置式（与 toolbar 同构 API） -->
<ProTable
  :selection-bar-actions="[
    {
      label: '批量删除',
      type: 'danger',
      confirm: { content: '确定删除选中的项目吗？', danger: true, confirmButtonText: '删除' },
      onClick: async ({ selectedRows, refresh }) => {
        await batchDeleteApi(selectedRows.map((r) => r.id))
        await refresh() // 删除后刷新表格
      },
    },
  ]"
/>

<!-- 通道 2：#selectionBar slot 完全接管（优先于配置） -->
<template #selectionBar="{ selectedRows, clearSelection }">
  <span>自定义批量区：{{ selectedRows.length }} 行</span>
  <ElButton size="small" type="danger" @click="clearSelection">清除选中</ElButton>
</template>
```

slot 作用域比 `ToolbarCtx` 多一个 `clearSelection: () => void`。启用前提：列定义含 selection 列 + `rowKey`（如 `{ prop: '__selection', label: '', type: 'selection', width: 45 }`）。`autoHeight` 模式会扣除批量条高度（`selectors.selectionBar`）。

### 9.4 slot 作用域增强（向后兼容）

`#tableHeader` / `#toolButton` slot 下发完整 `ToolbarCtx`——原无参 slot 用法不受影响，新用法可读取选中数/触发刷新：

```vue
<template #tableHeader="{ selectedCount }">
  <ElTag type="primary">已选 {{ selectedCount }} 项</ElTag>
</template>
```

### 9.5 CSV 导入导出（零依赖 utils）

```ts
import {
  exportCsv,
  importCsv,
  parseCsvText,
  type CsvColumn,
} from '@vv/ui/components/ProTable/utils'

// 导出：BOM 防 Excel 中文乱码 + RFC4180 引号转义（含逗号/换行字段安全往返）
const res = await projectRequestApi({ pageNum: 1, pageSize: 1000 }) // 全量拉取归业务
exportCsv(res.data, {
  filename: '项目台账.csv', // 缺省 export-<timestamp>.csv
  columns: [
    { prop: 'title', label: '项目' },
    // value：自定义取值（枚举翻译 / 金额格式化 / 字段拼接）
    { prop: 'done', label: '状态', value: (r) => (r.done ? '已完成' : '进行中') },
  ],
})

// 导入：File → 引号感知状态机解析 → 表头列名映射 prop
const rows = await importCsv(file, { columns }) // Record<string, unknown>[]，值均为 string
```

职责边界（设计 D7）：utils 只负责「行数据 ↔ 文件」；**分页全量拉取、类型转换、逐行校验、提交后端、错误明细回显全部归业务层**。`.xlsx` 明确不做（spec 非目标），需要时另立项。

---

## 10. 异步三态

ProTable 内部已与 `<AsyncState>` 集成：

```vue
<!-- ProTable 内部模板 -->
<AsyncState
  :loading="initialLoading"
  :error="table.error.value"
  :is-empty="isEmpty()"
  @retry="table.refresh"
>
  <!-- ElementTableBody 或 VxeTableBody -->
</AsyncState>
```

**首次加载 vs 后续刷新**（关键设计）：

- **首次加载中**（`initialLoading = true`）：显示 skeleton
- **后续刷新中**（`table.loading.value = true && hasTableMounted = true`）：保留表格实例，展示旧数据
- **错误态**：显示错误提示 + 重试按钮
- **空数据**（`!loading && !error && data.length === 0`）：显示空状态占位

为什么这样？ElTable 实例反复重建会丢失多选选区（`reserve-selection`）、展开行等交互态。ProTable 通过 `hasTableMounted` 标志位避免非必要的重建。

---

## 11. 决策表

| 场景                            | 推荐                                        |
| ------------------------------- | ------------------------------------------- |
| 简单列表 + 搜索 + 分页          | ProTable + `sortable: 'custom'`（如需排序） |
| 服务端排序 / 服务端筛选         | ProTable + `sortable: 'custom'`             |
| 树形数据展示                    | ProTable + `enableTree`                     |
| 单元格合并（报表）              | ProTable + `enableCellSpan`                 |
| 行内编辑（快速录入）            | ProTable + `enableRowEdit`                  |
| 行拖拽排序（拖动调整顺序）      | ProTable + `enableRowDrag`                  |
| 大数据量（> 1 万行虚拟滚动）    | ProTable + `tableEngine: 'vxe-table'`       |
| 简单的两列表格（< 10 列无搜索） | 直接用 `<el-table>`，不必上 ProTable        |
| 复杂表单 + 字段联动             | 用 XForm（`docs/24-XForm使用指南.md`）      |

---

## 12. 已知限制

| #   | 限制                                                                                                         | 应对方式                                       |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| 1   | 引擎运行时切换不支持（首次 mount 锁定）                                                                      | reload 页面 / 重新挂载                         |
| 2   | 树形 + 编辑互斥（编辑仅作用于叶子节点；`exclusive: true` 禁用编辑按钮）                                      | 二选一                                         |
| 3   | vxe + 树形 + 行拖拽三者同开时拖拽柄与展开行 DOM 可能错位（console.debug 提示，兼容性观察中）                 | 树形 / 拖拽二选一或反馈                        |
| 4   | vxe 行高变量有缓存，密度切换后需手动 `recalculate()`                                                         | ProTable 内部已自动处理                        |
| 5   | `responseAdapter` 映射非法结构会抛错                                                                         | `console.error` + 走 error 态                  |
| 6   | `setSearchParams` 会回到第 1 页（如不要回到第 1 页，先 `getSearchParams` 再手动 setState）                   | 自定义场景                                     |
| 7   | 多选 + 跨页记忆依赖 `rowKey`，未配会清不掉选区                                                               | 业务必填 `rowKey`                              |
| 8   | virtualized（el-table-v2）引擎不支持多选 / 列头筛选 / 树形 / 汇总 / 合并 / 展开 / 拖拽（命中即 warn + 忽略） | 需要这些能力请用 element-plus / vxe-table 引擎 |

---

## 13. 测试覆盖

| 目录/文件                                                    | 覆盖范围                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `composables/`（17 个 composable，20 个 spec）               | useSearch / useColumns / useTable（请求/分页/排序/筛选/持久化恢复）/ useCellSpan / useRowDrag / useRowEdit / useTreeData / useSummary / useStatePersist / useVirtualScroll / useEngineFallback / useProTableEvents / useTableCapabilities / useAutoHeight / useFullscreen / useTableEngineDom 等 |
| `components/`（13 个 spec）                                  | VxeTableBody（引擎加载/事件翻译/筛选/选区清理）/ ElementTableBody / ElementTableV2Body（虚拟滚动）/ SearchForm / SelectedTags / SelectionBar / ToolbarRenderer / ColSetting / EditCell / CellContent / GroupedHeader / SummaryRow / TableHeader                                                  |
| `adapters/`（5 个 spec）                                     | vxe-column 列映射 / cell-format 格式化预设 / cell-render / row-drag-adapter / tree-adapter                                                                                                                                                                                                       |
| `utils/`（2 个 spec）                                        | exportCsv（BOM/RFC4180）/ importCsv（引号感知解析）                                                                                                                                                                                                                                              |
| `types/__tests__/`（1 个 spec）                              | protable-types（类型契约快照）                                                                                                                                                                                                                                                                   |
| `styles/`（1 个 spec）                                       | _a11y（可访问性断言）                                                                                                                                                                                                                                                                            |
| 根目录（2 个 spec）                                          | ProTable.integration（端到端 mount 全链路）/ ProTable.engine（引擎分支与回退）                                                                                                                                                                                                                   |
| `apps/docs/src/modules/demo/examples/ProTable/ProTable*.vue` | 25 个 demo 覆盖所有主路径 + 各能力边界（详见 §16 示例索引）                                                                                                                                                                                                                                      |

完整 demo 站：25 个 demo 路径（`/demo/pro-table-*`，auto-import 自动注册，完整清单见 §16）。

---

## 14. 速查

```vue
<!-- 最小 -->
<ProTable :columns="cols" :request-api="api" row-key="id" />

<!-- 带搜索 + 多选 + 编辑 -->
<ProTable
  :columns="cols"
  :request-api="api"
  row-key="id"
  table-key="my-list"
  :enable-row-edit="{ onSave: handleSave }"
/>

<!-- 树形 + 服务端排序 -->
<ProTable
  :columns="cols"
  :request-api="api"
  :enable-tree="{ loadChildren: api.getChildren, rowKey: 'id' }"
  :sort-params-adapter="(s) => ({ sortBy: s.prop, sortOrder: s.order })"
/>
```

```ts
// 程序化控制
const tableRef = ref<InstanceType<typeof ProTable>>()
await tableRef.value?.refresh()
await tableRef.value?.setSearchParams({ status: 'active' })
const rows = tableRef.value?.getSelectedRows()
```

---

## 15. 相关文档

- 组件源码：`packages/ui/src/components/ProTable/ProTable.vue`
- 类型导出：`packages/ui/src/components/ProTable/types/index.ts`
- composables：`packages/ui/src/components/ProTable/composables/`
- 引擎适配：`packages/ui/src/components/ProTable/adapters/`
- Demo 站：`apps/docs/src/modules/demo/examples/ProTable/`（25 个 demo，详见 §16）
- Element Plus Table 文档：https://element-plus.org/zh-CN/component/table.html
- vxe-table 文档：https://vxetable.cn/
- 设计 spec：`docs/superpowers/specs/2026-09-07-protable-design.md` + `2026-09-08-protable-v2.1-vxe-engine-design.md`

---

## 16. 示例索引（25 个 demo，含主入口）

在线演示站点：`pnpm dev` → `/demo`（左侧「ProTable 企业级表格」分组），路由 = `/demo/pro-table-<kebab-case>`。所有 demo 源码位于 `apps/docs/src/modules/demo/examples/ProTable/`（25 个 `.vue` 文件）。

| 路由                              | 内容                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| `/demo/pro-table-overview`        | **主 demo**：Props 完整用法 + 实例方法演示（对应 `ProTableOverview.vue`） |
| `/demo/pro-table-engine-compare`  | element-plus vs vxe-table 双引擎并排对比（表格 + 格式化 + 排序）          |
| `/demo/pro-table-search-advanced` | v3.2 多查询条件：basic/advanced 抽屉 + searchLayout + 已选回显            |
| `/demo/pro-table-virtual-scroll`  | v3.0.1 虚拟滚动（10 万行 × 10 列 + 固定列）                               |
| `/demo/pro-table-auto-height`     | v3.1 自动高度（撑满视口剩余空间）                                         |
| `/demo/pro-table-state-persist`   | v3.1 状态保持（路由切换恢复搜索/分页/排序）                               |
| `/demo/pro-table-column-resize`   | 列宽拖拽（`columnResize`）                                                |
| `/demo/pro-table-formatter`       | v3.1 内置格式化器（dateTime/amount/percent/boolTag）+ 自定义函数          |
| `/demo/pro-table-server-sort`     | 服务端排序（`sortable: 'custom'` + `sortParamsAdapter`）                  |
| `/demo/pro-table-server-filter`   | v3.5 PR2 服务端筛选（列头筛选 + `filterParamsAdapter` + filter-change）   |
| `/demo/pro-table-search-filter`   | SearchForm + 列头筛选组合（AND 合并 + reset 双清 + 快照面板）             |
| `/demo/pro-table-async-state`     | 三态实战（loading / empty / error 手动切换 + 重试）                       |
| `/demo/pro-table-row-edit`        | 行内编辑（`enableRowEdit` 完整生命周期）                                  |
| `/demo/pro-table-row-select`      | 单选列 / 多选列 / 跨页保持选中 / `getSelectedRows`/`clearSelection`       |
| `/demo/pro-table-vxe-row-select`  | vxe 引擎行选择（radio/selection/reserveSelection 跨页 + clearSelection）  |
| `/demo/pro-table-row-drag`        | 行拖拽排序（`enableRowDrag` + `setRowOrder`）                             |
| `/demo/pro-table-expand`          | 展开行（`type: 'expand'` + `expand` 插槽）                                |
| `/demo/pro-table-tree`            | 树形数据（`enableTree` + 懒加载 + 展开折叠）                              |
| `/demo/pro-table-cell-span`       | 单元格合并（`enableCellSpan` + `judge` 函数）                             |
| `/demo/pro-table-summary`         | 客户端汇总行（`enableSummary` + sum/avg/count/max/min）                   |
| `/demo/pro-table-grouped-header`  | 多级表头（`children` 子列）                                               |
| `/demo/pro-table-operation`       | 操作列下拉收纳（`ElDropdown`）+ 表头 Tooltip（`headerRender`）            |
| `/demo/pro-table-style-override`  | 样式覆盖（BEM 命名空间 + 主题切换）                                       |
| `/demo/pro-table-header-actions`  | 工具栏与批量操作（toolbar 配置式 API + SelectionBar 双通道，2026-09-18）  |
| `/demo/pro-table-import-export`   | CSV 导入导出（零依赖 utils：BOM + RFC4180 + 表头映射，2026-09-18）        |

> **主 demo 入口**：`/demo/pro-table-overview`（对应 `ProTableOverview.vue`）—— 查阅全部 prop、事件、实例方法的入口。其余 24 个 demo 按「基础 → 引擎 → 搜索 → 虚拟化 → 编辑 → 选择/拖拽/展开 → 树形/合并/汇总 → 工具栏/批量 → 导入导出 → 样式」分组覆盖各能力边界。
>
> **配套 mock**：`packages/mock/src/pro-table/`（11 个具名导出 `xxxRequestApi` 文件，组件直连数据源无 XHR 依赖；big-data.ts 为 10 万行 × 10 列含固定列的大数据场景）。
