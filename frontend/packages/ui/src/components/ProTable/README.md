# ProTable 组件

> 配置驱动的企业级表格组件（Element Plus / vxe-table 双引擎）。参考 vue-element-plus-admin 的 ProTable 设计哲学。

## 安装

依赖已包含：

- `element-plus`（项目基础 UI 库）
- `sortablejs ^1.15.7`（列设置拖拽）
- `vxe-table ^4.21.7`（vxe-table 引擎，v2.1 交付；动态按需加载，chunk 不进首屏）

## 基础用法

```vue
<script setup lang="ts">
import { ProTable, type ProColumn } from '@/components/ProTable'

const columns: ProColumn[] = [
  {
    prop: 'name',
    label: '名称',
    search: { el: 'input', defaultValue: '' },
  },
  {
    prop: 'status',
    label: '状态',
    enum: [
      { label: '启用', value: 1, tagType: 'success' },
      { label: '禁用', value: 0, tagType: 'info' },
    ],
  },
  { prop: 'operation', label: '操作', type: 'operation' },
]

async function requestApi(params: Record<string, unknown>) {
  return await api.user.list(params)
}
</script>

<template>
  <ProTable :columns="columns" :request-api="requestApi" row-key="id" />
</template>
```

## 完整 API

详见 [`./types/index.ts`](./types/index.ts) 类型定义。

## 泛型（M1）

```ts
interface User {
  id: number
  name: string
  status: 0 | 1
}

const columns: ProColumn<User>[] = [
  {
    prop: 'name', // IDE 自动补全 'id' | 'name' | 'status'
    label: '名称',
    render: ({ row }) => h('span', row.name), // row: User，类型精确
  },
]
```

不传泛型时默认 `Record<string, unknown>`，存量代码零改动。

## 服务端排序（M2）

```ts
const columns: ProColumn<Order>[] = [
  { prop: 'amount', label: '金额', sortable: 'custom' }, // 点击表头 → 请求带 orderByColumn/isAsc
]
// 后端约定不同可改序列化：
<ProTable :sort-params-adapter="(s) => ({ sortBy: s.prop, sortOrder: s.order })" ... />
```

`sortable: true` 仍是 el-table 客户端排序；`sort-change` 事件与 `getSortState()` 暴露可用。

## 响应结构适配（M3）

后端返回非 `{ data, total, pageNum, pageSize }` 时：

```ts
<ProTable
  :request-api="rawApi as ProTableRequestApi<Order>"
  :response-adapter="(raw) => {
    const r = raw as { records: Order[]; totalCount: number }
    return { data: r.records, total: r.totalCount, pageNum: 1, pageSize: 10 }
  }"
  ...
/>
```

适配结果结构非法（data 非数组 / total 非数字）会 console.error 并进入错误态（AsyncState 展示 + 重试）。

## 引擎（v2.1 交付 vxe-table）

`table-engine` 支持双引擎，默认 `element-plus`：

```vue
<!-- element-plus 引擎（默认） -->
<ProTable :columns="columns" :request-api="requestApi" />

<!-- vxe-table 引擎：首次 mount 动态加载（JS + CSS 按需注入，chunk 不进首屏）；
     加载失败自动回退 element-plus 并 console.warn -->
<ProTable :columns="columns" :request-api="requestApi" table-engine="vxe-table" />
```

> 注意：引擎 prop 仅在首次 mount 前生效，运行时修改需 reload（spec 决策 4）。

### vxe 引擎能力矩阵（v3.5 PR1-B 补齐后）

| 能力           | element-plus | vxe-table                                             |
| -------------- | ------------ | ----------------------------------------------------- |
| 多选 selection | ✅           | ✅（checkbox-change/all 合并）                        |
| 服务端排序     | ✅           | ✅（同一 sortParamsAdapter 协议）                     |
| 行内编辑       | ✅           | ✅                                                    |
| 单元格合并     | ✅           | ✅                                                    |
| 树形数据       | ✅           | ✅（v3.5 PR1-B 补齐，vxeTreeAdapter + tree-config）   |
| 行拖拽排序     | ✅           | ✅（v3.5 PR1-B 补齐，vxeRowDragAdapter + sortablejs） |

> **vxe + 树形 + 行拖拽 同时启用会触发 console.warn**：sortablejs 与 vxe tree-node 行结构冲突，行拖拽自动退化（树形仍生效）。业务方按需取舍。

### ProColumn.vxeProps

仅 vxe 引擎生效，透传 VxeColumn props。定位为**补充不覆盖**——与 ProTable 派生字段（field/title/sortable 等）冲突时以派生值为准：

```ts
const columns: ProColumn<Order>[] = [
  { prop: 'amount', label: '金额', sortable: 'custom', vxeProps: { align: 'right' } },
]
```

引擎并排对比见 demo：`modules/demo/examples/ProTable/ProTableEngineCompare.vue`。

## 插槽系统

| 插槽                                 | 说明                    |
| ------------------------------------ | ----------------------- |
| `tableHeader`                        | 左上角标题 + 自定义按钮 |
| `toolButton`                         | 工具栏右侧扩展按钮      |
| `[prop]`                             | 覆盖对应列单元格        |
| `operation`                          | 操作列内容              |
| `search-[prop]`                      | 覆盖对应搜索项          |
| `empty`                              | 空状态自定义            |
| `expand`                             | 展开行内容              |
| `paginationLeft` / `paginationRight` | 分页区扩展              |

## 更多信息

- 架构：[`./ARCHITECTURE.md`](./ARCHITECTURE.md)
- 维护：[`./CONTRIBUTING.md`](./CONTRIBUTING.md)
- Spec：[`../../../docs/superpowers/specs/2026-09-07-protable-design.md`](../../../docs/superpowers/specs/2026-09-07-protable-design.md)
- Plan：[`../../../docs/superpowers/plans/2026-09-07-protable-impl.md`](../../../docs/superpowers/plans/2026-09-07-protable-impl.md)
- v3.0 重构：[`../../../docs/superpowers/plans/2026-09-14-protable-v3-refactor.md`](../../../docs/superpowers/plans/2026-09-14-protable-v3-refactor.md)

## 常见 TypeScript 陷阱（v3.0 L5）

### 1. ProTableProps\<T\> 透传到非泛型组件

T 未解析时 `ProColumn<T>` 双向均不可赋值（TS **bivariance** 仅对具体类型生效）。

**v3.5 PR3 处理**：6 个子组件（SearchForm / TableHeader / ColSetting / ElementTableBody / ElementTableV2Body / VxeTableBody）
统一加 `<script setup lang="ts" generic="T extends object = Record<string, unknown>">`，
并把 `asViewColumn` / `asViewColumns` cast 函数移除。ProTable.vue 模板直接传 typed columns
（`columns.searchColumns` / `columns.allColumns.value` / `columns.sortedColumns.value`）给子组件，
generic 透传到子组件的 T 默认 Record<string, unknown> 视角。bivariance 让 ProColumn<T> 自动满足 ProColumn<T> 默认 Record 视角。

剩余 2 处不可避免 cast：

- `props as unknown as ProTableProps<T>`：withDefaults 返回的 `LooseRequired<__VLS_Props>` 与 `ProTableProps<T>` 不严格等价，composable 入口需 cast 收敛（PR3 收口后保留唯一一处）
- SelectedTags / VxeTableBody.columns prop type 仍为 `ProColumn[]`（不绑 T）：vue-tsc 模板推导对 generic 子组件 prop type 的 T 标注与父组件的 T 是两个独立 generic 参数，
  类型不兼容；保留 ProColumn[] 默认 Record 视角让 ProTable.vue 传 typed columns 时兼容

### 2. `useColumns` 内部 cast 集中点

`useColumns.ts:148-153`（toggleVisible）的 cast 原因：

- `Ref<ProColumn[]>.value` 经 `UnwrapRef` 把 `hidden` 的 `Ref<boolean>` 解成 boolean
- `exactOptionalPropertyTypes` 排除 undefined
- 还原为 `ProColumn<T>` 类型后按公开声明赋值

### 3. Vue reactive 自动解包陷阱（C2 修复）

访问 `allColumns.value[i].hidden` 时，reactive 代理自动解包 `Ref<boolean>` / `computed` → boolean primitive。
**运行时 typeof 永远只能拿到 'boolean'**，无法区分"静态 boolean" vs "动态 Ref"。

**正确做法**（参考 `useColumns.ts:91-95`）：在 setup 时基于**原始 props.columns** 记录静态列集合
（按 prop 查找），不依赖运行时 typeof 判断。

### 4. exactOptionalPropertyTypes 兼容

项目开启 `exactOptionalPropertyTypes: true`，传 `{ tableKey: undefined }` 给 `{ tableKey?: string }`
参数会 TS 2379 报错。

**正确做法**（参考 `useTable.ts:148-152`）：

```ts
// ❌ 报错
assertValidResponse(adapted, { tableKey: props.tableKey })

// ✅ 条件构造
assertValidResponse(adapted, props.tableKey ? { tableKey: props.tableKey } : {})
```

## v3.5 变更摘要（A11y 改造 + E2E + vxe 引擎补齐）

> 目标：让 ProTable 通过 WCAG 2.1 AA 合规审查 + E2E 测试覆盖关键用户路径（搜索→列表→选中→批量操作）+ 双引擎能力对等（树形 + 行拖拽）。

### A11y 三层结构

| 层级       | 元素                              | ARIA 属性                                                                      |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------ |
| 根容器     | `ProTable.vue` 根 div             | `role="grid"` + `aria-label="数据表格"` + `aria-rowcount` + `aria-busy`        |
| 工具栏     | `TableHeader.vue` 工具栏容器      | `role="toolbar"` + `aria-label="表格工具栏"`                                   |
| 工具栏按钮 | 刷新 / 全屏 / 列设置 / 密度切换   | `aria-label` + `aria-expanded`（列设置）+ `aria-haspopup`（密度下拉，EP 注入） |
| 搜索区     | `SearchForm.vue` 根 div           | `role="search"` + `aria-label="表格筛选"`                                      |
| 搜索区按钮 | 搜索 / 重置 / 高级筛选 / 展开收起 | `aria-label` + `aria-expanded`（折叠按钮）                                     |
| 已选条件区 | `SelectedTags.vue` 根 div         | `role="region"` + `aria-label="当前已选筛选条件"`                              |
| 批量操作条 | `SelectionBar.vue` 根 div         | `role="status"` + `aria-live="polite"`（已 N 项自动朗读）                      |
| 编辑态     | `EditCell.vue` sr-only span       | `aria-live="polite"`（进入编辑态播报）                                         |

### 13 处 aria-label 清单

| #   | 组件         | 元素          | aria-label                                                  |
| --- | ------------ | ------------- | ----------------------------------------------------------- |
| 1   | ProTable     | 根 div        | `数据表格` / `数据表格（全屏）`                             |
| 2   | SearchForm   | 搜索按钮      | `搜索`                                                      |
| 3   | SearchForm   | 重置按钮      | `重置筛选`                                                  |
| 4   | SearchForm   | 高级筛选按钮  | `打开高级筛选`                                              |
| 5   | SearchForm   | 展开/收起按钮 | `展开搜索条件` / `收起搜索条件`                             |
| 6   | SelectedTags | tag × 按钮    | `清除筛选条件 ${label}`                                     |
| 7   | SelectedTags | 清除全部      | `清除全部筛选条件`                                          |
| 8   | TableHeader  | 刷新按钮      | `刷新表格`                                                  |
| 9   | TableHeader  | 全屏按钮      | `进入全屏` / `退出全屏`                                     |
| 10  | TableHeader  | 密度触发钮    | `切换表格密度`（菜单项：`切换表格密度为${紧凑/默认/宽松}`） |
| 11  | TableHeader  | 列设置按钮    | `打开列设置`                                                |
| 12  | ColSetting   | checkbox      | `显示/隐藏 ${label}`                                        |
| 13  | ColSetting   | 置顶按钮      | `置顶 ${label}`                                             |
| 14  | SelectionBar | 清除按钮      | `清除选择`                                                  |

### 键盘可达修复

- **SelectedTags × 按钮**：EP 内置 `closable` 按钮已可 Tab 聚焦；增加 `aria-label` 让屏幕阅读器朗读字段名
- **ColSetting**：保留 sortablejs 拖拽，旁加 `aria-label` 让键盘用户了解「置顶」按钮意图
- **TableHeader 工具栏**：4 个 icon 按钮全部带 `aria-label`，鼠标 hover 与 Tab 焦点体验一致
- **EditCell 编辑态**：进入编辑时插入 sr-only span + `aria-live="polite"`，盲用户感知「我现在处于编辑态」

### prefers-reduced-motion 全局

`styles/_a11y.scss` 加 `@media (prefers-reduced-motion: reduce)` 规则，把 ProTable 子树内所有 `animation-duration` / `transition-duration` 抑制到 `0.01ms`，用户开启系统级「减弱动效」偏好时所有过渡立即生效。

### 颜色对比度审计

`vitest-axe` 集成（`tests/` 直接调用 `axe(wrapper.element)`），裁剪掉 EP + jsdom 触发的结构性误报规则（region / aria-required-children / label）后，CI 阶段确保未来变更不会引入新的 ARIA / color-contrast violations。

### E2E 关键路径（Playwright）

`tests/e2e/protable/` 新增 2 个 spec 覆盖关键用户路径：

| Spec                      | 覆盖路径                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `search-list.spec.ts`     | 打开 demo → 填搜索框 → 行数减少 → 清空 → 恢复                                       |
| `selection-batch.spec.ts` | 打开 demo → 勾选 3 行 → SelectionBar 出现 + `已选 3 项` + `aria-live=polite` → 清除 |

**CI 准备**：

```bash
pnpm test:e2e:install   # 首次下载 Chromium（约 100MB）
pnpm dev                # 后台启动 dev server
pnpm test:e2e           # 跑 E2E（baseURL=http://localhost:5174）
```

## v3.5 变更摘要（vxe 引擎补齐树形 + 行拖拽）

> v3.5 PR1-A 通过 A11y + E2E 后，PR1-B 解决 v2.1 决策 5 遗留：vxe-table 引擎能力与 element-plus 对等。

### TreeAdapter / RowDragAdapter 引擎胶水层

| Adapter                           | 引擎差异点                                                        |
| --------------------------------- | ----------------------------------------------------------------- |
| `createElementPlusTreeAdapter`    | `treeProps: { children: '__pro_table_flat__', hasChildren: ... }` |
| `createVxeTreeAdapter`            | `treeConfig` + `setTreeExpand(row, expanded)` 双向同步            |
| `createElementPlusRowDragAdapter` | `.el-table__body tbody` + `data-row-key` 属性反查                 |
| `createVxeRowDragAdapter`         | `.vxe-table--body-wrapper tbody` + 视图索引 → `props.rows` 反查   |

### 双引擎能力对等（README §引擎能力矩阵 v2.1 → v3.5 PR1-B 更新）

| 能力       | v2.1 vxe 引擎            | v3.5 PR1-B vxe 引擎 |
| ---------- | ------------------------ | ------------------- |
| 树形数据   | ❌ 暂不支持（warn 忽略） | ✅ 完整支持         |
| 行拖拽排序 | ❌ 暂不支持（warn 忽略） | ✅ 完整支持         |

**实现要点**：

- 树形：`createVxeTreeAdapter(getVxeTable)` 提供 vxe-table tree-config 协议 + `setTreeExpand` 同步；
  `VxeTableBody.vue` 接收 `treeData` prop + watch expandedKeys 全量回灌 vxe 引擎侧 Map
- 行拖拽：`createVxeRowDragAdapter({ getRowsByIndex })` 反查行 rowKey；`VxeTableBody.vue` 暴露
  `getTbody` 给编排层 `useTableEngineDom`，按 effectiveEngine 路由到正确 tbody DOM

**唯一约束**：vxe 引擎 + 树形 + 行拖拽 **三者同时启用**会触发 console.warn（sortablejs 直接 DOM
操作与 vxe tree-node 行结构不兼容），行拖拽自动退化 null，业务方按需取舍。

**演示**：`ProTableEngineCompare.vue` demo 新增「树形 + 行拖拽双引擎对照」section，左右两栏分别
渲染 el-table 和 vxe-table 引擎同一份 columns + enable-tree + enable-row-drag，验证双引擎行为一致。

**新增/修改文件**：

- `adapters/tree-adapter.ts` + `tree-adapter.spec.ts`（新增）
- `adapters/row-drag-adapter.ts` + `row-drag-adapter.spec.ts`（新增）
- `composables/useTableEngineDom.ts`（双引擎 tbody 路由）
- `composables/useTableCapabilities.ts`（vxe 引擎能力补齐 + 三者冲突检测）
- `components/VxeTableBody.vue`（treeData + rowDrag prop + tree-config + getTbody 暴露）
- `ProTable.vue`（双引擎条件透传 treeData/rowDrag）
- `ProTable.engine.spec.ts` + `useTableCapabilities.spec.ts` + `ProTable.integration.spec.ts`
  （capability matrix 测试）

## v3.5 变更摘要（服务端筛选 filterParamsAdapter）

> 解决电商订单筛选 / 多维度财务报表等含 5-30 个查询条件的服务端筛选场景。filterParamsAdapter
> 与 sortParamsAdapter 对称：业务方声明「把全表筛选快照序列化为后端约定的请求参数形态」，
> ProTable 自动接管 filter-change 事件 + 回第 1 页 + 触发请求 + emit filter-change 供父级联动。

### 新增 API

```ts
import type { FilterParamsAdapter, FilterValuesMap } from '@/components/ProTable/types'

const filterParamsAdapter: FilterParamsAdapter = (filters: FilterValuesMap) => ({
  statusList: filters.status, // 状态多选 → statusList
  deptList: filters.dept, // 部门多选 → deptList
  dateRange: filters.dateRange, // 日期范围
  amountRange: filters.amountRange, // 金额范围
})

<ProTable
  :columns="columns"
  :request-api="filterOrdersRequestApi"
  :filter-params-adapter="filterParamsAdapter"
  row-key="id"
  @filter-change="(filters) => console.log('URL 同步 / 埋点:', filters)"
/>
```

### 与 sortParamsAdapter 对称性

| 维度       | sortParamsAdapter                   | filterParamsAdapter                                   |
| ---------- | ----------------------------------- | ----------------------------------------------------- |
| 入参形态   | `SortState`（单条记录）             | `FilterValuesMap`（全表快照 Record）                  |
| 触发时机   | el-table @sort-change               | el-table @filter-change                               |
| 入请求路径 | `serializeSort(state)` → params     | `serializeFilters(map)` → params（仅当 adapter 存在） |
| 默认行为   | 内置 `{ orderByColumn, isAsc }`     | 不调用 adapter，el-table 客户端筛选默认值             |
| 回第 1 页  | ✅                                  | ✅                                                    |
| 状态记忆   | `getSortState()` + emit sort-change | `getFilterState()` + emit filter-change               |
| reset 路径 | 不清 sortState（review 设计）       | reset 同步清空 filterState                            |

### 三引擎支持矩阵

| 引擎                   | filter-change 支持               | 备注                                                   |
| ---------------------- | -------------------------------- | ------------------------------------------------------ |
| element-plus（v1）     | ✅ 完整支持（el-table 原生协议） | 列头下拉由 `column.tableProps.filters` 声明            |
| vxe-table（v2.1）      | ✅ 完整支持（filter-config）     | `VxeTableBody` 翻译 vxe 单列 payload → 全表快照形态    |
| element-plus v2 虚拟化 | ⚠️ console.warn 占位             | el-table-v2 无内置列头筛选下拉 UI，v3.5 PR2 阶段不实现 |

### 实现要点

- `types/index.ts`：新增 `FilterValue / FilterValuesMap / FilterParamsAdapter` 三类型
- `composables/useTable.ts`：filterState ref + `setFilter` + `serializeFilters` + `resetFilter`
- `composables/useProTableEvents.ts`：handleFilterChange 桥接（与 handleSortChange 对称）
- `components/ElementTableBody.vue`：监听 `@filter-change` 转发 useProTableEvents.handleFilterChange
- `components/VxeTableBody.vue`：翻译 vxe 单列 payload → 全表快照（localFilterMap 累加多列）
- `components/ElementTableV2Body.vue`：console.warn 占位（H3 同款实例级 ref 防多次 warn）
- `ProTable.vue`：defineEmits 加 `filter-change` + 模板双引擎 `@filter-change` 绑定 + defineExpose `getFilterState`
  - fetchHook reset 路径同步清空 filterState

### 默认行为契约（无 adapter 时）

- filterState 仍被维护（UI 记忆 + expose.getFilterState）
- el-table 客户端筛选默认值继续生效
- 不触发新请求
- emit filter-change 仍触发（业务方可监听做 UI 联动）

**演示**：`src/modules/demo/examples/ProTable/ProTableServerFilter.vue` 含 4 列筛选（状态 / 部门 /
创建日期 / 金额范围）+ filterParamsAdapter 把全表快照序列化为 `{ statusList, deptList, dateRange, amountRange }` +
监听 filter-change 事件做快照展示。

**新增/修改文件**：

- `types/index.ts`（FilterValue / FilterValuesMap / FilterParamsAdapter / getFilterState）
- `composables/useTable.ts`（filterState + setFilter + resetFilter + serializeFilters）
- `composables/useTable.spec.ts`（+5 例 PR2 覆盖）
- `composables/useProTableEvents.ts`（handleFilterChange 桥接）
- `composables/useProTableEvents.spec.ts`（新增 +4 例 PR2 覆盖）
- `components/ElementTableBody.vue`（filter-change emit 转发）
- `components/VxeTableBody.vue`（vxe filter-change 翻译 + localFilterMap）
- `components/ElementTableV2Body.vue`（console.warn 占位）
- `components/{ElementTableBody,ElementTableV2Body,VxeTableBody}.spec.ts`（各 +1 例 PR2 覆盖）
- `ProTable.vue`（defineEmits + 双引擎 @filter-change + getFilterState expose + reset 路径）
- `ProTable.integration.spec.ts`（+5 例 PR2 端到端测试）
- `mock/pro-table/filter-orders.ts`（mock 数据 + requestApi + filterOrdersParamsAdapter）
- `src/modules/demo/examples/ProTable/ProTableServerFilter.vue`（新增 demo）
- `src/modules/demo/examples/ProTable/configs/protable-demos-api.ts`（3 张 ApiTable 数据）
- `src/modules/demo/config/sidebar-groups.ts`（ProTableServerFilter sidebar 注册）

## v3.4 变更摘要（搜索区布局档位下放）

> 真实业务两类场景不适配自动判定档位：① 宽屏页面 6 个字段想全平铺却被强制折叠；② `searchDisplay` 联动使字段数动态变化时档位在 flat/collapse 间跳变。本次把判定权下放，新增 `searchLayout` prop，`'auto'`（默认）保持自动行为完全向后兼容，显式档位跳过字段数判定。

```vue
<!-- 宽屏 6 字段强制平铺 -->
<ProTable :columns="columns" :request-api="requestApi" search-layout="flat" />

<!-- searchDisplay 联动时锁定档位避免布局抖动 -->
<ProTable :columns="columns" :request-api="requestApi" search-layout="collapse" />
```

| 值                        | 行为                                               |
| ------------------------- | -------------------------------------------------- |
| `'auto'`（默认）          | ≤3 flat / 4-8 collapse / >8 flat-large（自动判定） |
| `'flat'` / `'flat-large'` | 全部平铺，无展开/收起按钮                          |
| `'collapse'`              | 强制折叠，始终显示展开/收起按钮                    |
| `'drawer'`                | 强制高级筛选抽屉形态                               |

> **优先级**：存在 `search.level='advanced'` 字段时无论本配置为何都走 `drawer` 档（advanced 字段必须可达）。

**实现**：`types/index.ts` 新增 `SearchLayoutMode = 'auto' \| 'flat' \| 'collapse' \| 'flat-large' \| 'drawer'` 联合类型 + `ProTableProps.searchLayout?` prop；`SearchForm.vue` `layoutMode` 判定顺序「advanced 字段存在（永远 drawer，优先级最高）> searchLayout 非 auto 强制档位 > 字段数自动判定」；`ProTable.vue` 经 `v-bind` 透传 searchLayout（缺省不传保持子组件默认）。

**演示**：`ProTableSearchAdvanced.vue` ⑩ 号 demo「6 basic 强制 flat 档」（与 ② 号 demo 同字段对照：自动 collapse vs 强制 flat）。

## v3.2 变更摘要（多查询条件支持）

> 中后台典型「重搜索」页面（电商订单筛选、财务报表等）常含 5-30 个查询条件，平铺会挤压表格可视区。本次把搜索项拆分到两层（basic 主表单 / advanced 高级抽屉）+ 字段级防抖 + 字段联动 + 已选回显，让任意规模的查询条件都能优雅展示。

**新增 `SearchLevel` 常量**（`types/index.ts`）：

```ts
export const SearchLevel = { Basic: 'basic', Advanced: 'advanced' } as const
```

**search 配置扩展**（`SearchConfig`）：

| 字段            | 类型                               | 说明                                                                          |
| --------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `level`         | `'basic' \| 'advanced'`            | 搜索项层级（Advanced 收纳进「高级筛选」弹窗 + 角标显示已选数量）              |
| `debounce`      | `number`                           | input 类控件防抖毫秒（`>0` 输入时自动触发；`0`/undefined 保持输入与请求解耦） |
| `searchTrigger` | `'change' \| 'enter'`              | 触发时机（与 `debounce` 互斥）                                                |
| `onChange`      | `(newVal, oldVal, params) => void` | 字段联动清空钩子（典型：订单状态改「未支付」时清空支付时间字段）              |
| `lazyEnum`      | `boolean`                          | select 字典懒加载（聚焦/打开下拉才加载）                                      |
| `collapsed`     | `boolean`                          | per-field 折叠控制（核心字段强制在主表单展示）                                |

**新增 ProTable Props**：

| Prop                   | 类型                                  | 默认    | 说明                                                                              |
| ---------------------- | ------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| `showSelectedTags`     | `boolean`                             | `true`  | 搜索区与表格之间显示已选条件 tag，支持单个/全部清除                               |
| `expandedStatePersist` | `boolean`                             | `false` | 展开/收起状态通过 `localStorage[${tableKey}:search-expanded]` 记忆（需 tableKey） |
| `searchDisplay`        | `(params) => Record<string, boolean>` | —       | 字段联动显隐（返回 `false` 字段彻底隐藏）                                         |

**典型用法**：

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
  table-key="orders"
  expanded-state-persist
/>
```

## v3.1 变更摘要（能力补全）

对照社区最佳实践（vue-pure-admin / vben-admin）能力清单补齐 5 项缺口：

### 自动高度

```vue
<!-- 表格区撑满视口剩余高度：表头/分页器固定，表体随窗口伸缩滚动 -->
<ProTable :columns="columns" :request-api="requestApi" auto-height />

<!-- 对象形态可微调测量余量（页面底部留白等） -->
<ProTable :columns="columns" :request-api="requestApi" :auto-height="{ offset: 40 }" />
```

- 与 `virtualized` 同时启用时忽略并 warn（v2 引擎自带高度管理）
- 测量失败（jsdom/SSR）自动降级为默认全量渲染，不影响功能

### 状态保持（路由返回恢复）

```vue
<!-- 需配合 tableKey；路由切换返回时恢复搜索/分页/排序，F5 刷新不恢复 -->
<ProTable :columns="columns" :request-api="requestApi" table-key="orders" state-persist />
```

- 全量恢复：搜索参数 + 页码 + 每页大小 + 排序状态
- 实现：localStorage 快照 + sessionStorage alive 标记（beforeunload 清除判定刷新）

### 全屏

工具栏新增全屏按钮（v3.1 起内置），CSS fixed 方案，Esc 可退出，全屏内打开 el-dialog 不受遮挡。

### radio 单选列 与 跨页保持多选

```ts
const columns: ProColumn<User>[] = [
  { prop: 'id', label: '选择', type: 'radio' }, // 单选列（el 引擎自绘 / vxe 引擎内置）
  { prop: 'name', label: '名称', type: 'selection', reserveSelection: true }, // 多选跨页保持（需 row-key）
]
```

- radio 选中收敛到统一选中区：`getSelectedRows()` 返回单行数组，`clearSelection()` 同时清多单选
- `reserveSelection` 替代 `tableProps: { reserveSelection: true }` 手写透传（el 引擎列属性 / vxe 引擎 checkbox-config.reserve）

### 内置格式化器预设

```ts
const columns: ProColumn<Order>[] = [
  { prop: 'createdAt', label: '创建时间', formatter: 'dateTime' }, // 2026-09-16 14:30:00
  { prop: 'amount', label: '金额', formatter: 'amount' }, // 1,234,567.89
  { prop: 'rate', label: '费率', formatter: 'percent' }, // 15.67%
  { prop: 'enabled', label: '启用', formatter: 'boolTag' }, // 是/否 ElTag
  // 自定义函数形态仍可用（与 v1 el-table formatter 签名一致）
  { prop: 'code', label: '编码', formatter: (row) => row.code.toUpperCase() },
]
```

- 预设：`dateTime` / `date` / `time` / `amount` / `percent` / `boolTag`；非法输入原样返回
- **修复**：v3.0.1 引入 `formatter` 时仅虚拟滚动分支生效，v3.1 起三引擎（el / vxe / v2）行为一致（优先级 render > formatter > enum > 原始值）

## v3.0.1 变更摘要（虚拟滚动真虚拟化）

- **真虚拟化引擎升级**：`useVirtualScroll` 从假虚拟化（CSS overflow + 高度容器）切换到 `el-table-v2` 真虚拟化引擎，支持 10 万行 × 10 列流畅渲染。
- **强隔离策略**：开启 `virtualized` 时其他能力（行内编辑 / 树形 / 汇总 / 合并 / 拖拽）一律 `console.warn` + 忽略；`tableEngine="vxe-table"` 自动回落到 `element-plus`。
- **新增组件**：`ElementTableV2Body.vue`（独立文件，与 v1 引擎分支 `ElementTableBody` 并列存在）。
- **useVirtualScroll 升级**：新增 `v2TableConfig` 输出（width / height / rowHeight）；`VirtualScrollConfig` 扩展 `height` / `width` 字段。
- **demo 升级**：`/demo/pro-table-virtual-scroll` 演示 10 万行 × 10 列（含 ID + Department 左固定列），首屏 < 1s，滚动 avgFPS ≥ 100。
- **保留能力**：列设置 / 排序（`onColumnSort` 回调翻译为 `sort-change`）/ 搜索 / 密度切换（fixed-size `row-height` 模式）在虚拟化分支可用。
- **不支持能力**：多选列（`type="selection"`）el-table-v2 无内置实现，命中 `console.warn` + 忽略（与行内编辑等能力同属强隔离清单）。

完整 v3.0.1 设计 + 实施计划：

- [`docs/superpowers/specs/2026-09-15-protable-el-table-v2-design.md`](../../../docs/superpowers/specs/2026-09-15-protable-el-table-v2-design.md)
- [`docs/superpowers/plans/2026-09-15-protable-el-table-v2-impl.md`](../../../docs/superpowers/plans/2026-09-15-protable-el-table-v2-impl.md)

## v3.0 变更摘要

完整 16 项修复 + 优化见 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 顶部"v3.0 增量摘要" + 改造计划文档。

## v3.5 变更摘要（6 子组件 generic 收口 cast）

> 解决 ProTable → 子组件链上 generic 透传断层（消费方定义 `<ProTable<User>>` 时 IDE
> 提示在子组件列定义处丢失 T 字段，迫使编排层写 `as unknown as` 双断言）。
>
> 前置：v3.0 L5 已识别此边界但影响面大留待后续；v3.5 PR3 完成 6 子组件 generic 声明 + prop 类型泛型化。

### 改动要点

- **6 子组件加 `generic="T extends object = Record<string, unknown>"`**：
  `SearchForm / TableHeader / ColSetting / ElementTableBody / ElementTableV2Body / VxeTableBody`
- **移除 `asViewColumn` / `asViewColumns` cast 函数**（v3.1.2 review 引入的 `ProColumn<T> → ProColumn` 投影）
- **ProTable.vue 模板透传 typed columns**：`columns.searchColumns` / `allColumns.value` / `sortedColumns.value` 直接传子组件 generic
- **保留 2 处不可避免 cast**（已加注释说明）：
  - `props as unknown as ProTableProps<T>`：withDefaults 返回 `LooseRequired<__VLS_Props>` 与 `ProTableProps<T>` 不严格等价，composable 入口需 cast 收敛
  - SelectedTags / VxeTableBody.columns 仍为 `ProColumn[]`（不绑 T）：vue-tsc 模板推导对 generic 子组件 prop type 的 T 与父组件的 T 是两个独立 generic 参数，类型不兼容；保留 ProColumn[] 默认 Record 视角让父组件传 typed columns 时兼容
- **useTableCapabilities 标注 `ProColumn<T>` + 注释**：明确 T → Record 视角 cast 的必要边界（`useCellSpan` 不绑 T，cast 回 `ProColumn[]`；`useSummary` 绑 T，直接透传 T 视角）

### 受影响文件

- `ProTable.vue`（移除 asViewColumn/asViewColumns + 改 *NonGeneric 为 *Typed）
- `components/SearchForm.vue`（generic<T> + columns: ProColumn<T>[]）
- `components/TableHeader.vue`（generic<T> + columns/visibleColumns: ProColumn<T>[]）
- `components/ColSetting.vue`（generic<T> + columns: ProColumn<T>[]）
- `components/ElementTableBody.vue`（generic<T> + rows: T[] + columns: ProColumn<T>[]）
- `components/ElementTableV2Body.vue`（generic<T> + rows: T[] + columns: ProColumn<T>[]）
- `components/VxeTableBody.vue`（generic<T> + rows: T[]；columns 保持 ProColumn[] 默认 Record 视角）
- `composables/useTableCapabilities.ts`（ProColumn<T>[] 标注 + cast 必要性注释）
- `ProTable.integration.spec.ts`（+2 例泛型透传契约测试）
- 各子组件 .spec.ts（保留默认 Record 视角 mount，向后兼容）

### 完整实施计划

- [`docs/superpowers/plans/2026-09-18-protable-v3.5-generic-cast-cleanup.md`](../../../docs/superpowers/plans/2026-09-18-protable-v3.5-generic-cast-cleanup.md)
