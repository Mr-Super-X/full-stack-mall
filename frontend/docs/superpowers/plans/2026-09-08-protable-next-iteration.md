# ProTable 下一迭代实施计划（M1 泛型化 → M2 服务端排序 → M3 响应适配器）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** ProTable 完成泛型化类型改造（`ProColumn<T>`），接通服务端排序（`sortable: 'custom'`），新增 `responseAdapter` 响应结构适配器——让组件能直接对接真实业务类型与真实后端约定。

**Architecture:** 纯类型层先行（M1，运行时零变化，向后兼容默认 T）；排序状态归 `useTable` 内部（不混入 `useSearch.searchParams`，决策 D4），请求组装时合并排序参数；`responseAdapter` 在 `useRequest.onSuccess` 内 fail-fast 校验。设计文档：`docs/superpowers/specs/2026-09-08-protable-next-iteration-design.md`。

**Tech Stack:** Vue 3.5 泛型 SFC（`generic="T"`）、TS 6、Vitest（`expectTypeOf` 类型断言 + 行为 spec）、Element Plus 2.14。

**全局约定：**

- 每步验收命令：`pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint`，全绿才进下一步
- **commit 纪律（项目规则 §二-7）：每步的 commit 步骤须先获得用户明确确认；用户也可指示攒批最后一次性提交**
- TDD 顺序：先写失败测试 → 跑红 → 最小实现 → 跑绿 → commit
- 类型断言 spec 由 `pnpm type-check:full`（vue-tsc）把关：vitest 用 esbuild 剥离类型（运行时恒真），类型错误只在 type-check 阶段暴露
- 关键类型技巧：ProColumn 的 `render`/`headerRender`/`dataCallback` 用**方法语法**声明 —— TS 方法参数双变（bivariance）检查让 `ProColumn<T>` 可赋值给 `ProColumn`（默认 `Record<string, unknown>`），下游子组件（EditCell/SearchForm/TableHeader/ColSetting）与 4 个能力 composable **无需泛型化**
- 行级字段读取统一收口到局部 `as Record<string, unknown>` 转换（`T extends object` 无索引签名，不能直接 `row[col.prop]`；cast 集中在 resolveCell/rowKeyOf/setSelectedRows 三处，不散落）

---

## 进度总览

| 里程碑 | 任务 | 内容 | 验收 |
|--------|------|------|------|
| M1 | Task 1-4 | types 泛型化 + composables/ProTable.vue 签名传播 | 95 用例全绿 + type-check + lint；存量调用零改动 |
| M2 | Task 5-9 | 服务端排序（sortState + 接线 + demo） | +8 用例全绿 + 浏览器手动验证 |
| M3 | Task 10-12 | responseAdapter + demo 改造 + 文档 | +3 用例全绿 + 文档同步 |

---

## M1：泛型化（运行时零变化）

### Task 1: types/index.ts 泛型化 + 类型级 spec

**Files:**
- Modify: `src/components/ProTable/types/index.ts`（全文 271 行，全部接口加泛型参数）
- Test: `src/components/ProTable/types/protable-types.spec.ts`（新建）

- [x] **Step 1: 写类型级测试（先红）**

新建 `src/components/ProTable/types/protable-types.spec.ts`：

```ts
/**
 * ProTable 泛型类型层测试（M1）—— 断言由 `pnpm type-check:full`（vue-tsc）把关：
 * vitest 运行时用 esbuild 剥离类型（恒真），类型错误只在 type-check 阶段暴露。
 *
 * @group ProTable 类型
 */
import { describe, it, expectTypeOf } from 'vitest'
import { h } from 'vue'
import type { ProColumn, ProTableProps, ProTableResponse } from './index'

interface User {
  id: number
  name: string
  status: 0 | 1
}

describe('ProTable 泛型类型（M1）', () => {
  it('render 回调的 row 精确到 T', () => {
    const col: ProColumn<User> = {
      prop: 'name',
      label: '名称',
      render: ({ row }) => {
        expectTypeOf(row).toMatchTypeOf<User>()
        expectTypeOf(row.name).toEqualTypeOf<string>()
        return h('span', row.name)
      },
    }
    expectTypeOf(col.prop).toEqualTypeOf<string>()
  })

  it('默认 T 向后兼容：ProColumn = ProColumn<Record<string, unknown>>', () => {
    const col: ProColumn = { prop: 'anything', label: '任意' }
    expectTypeOf(col).toMatchTypeOf<ProColumn<Record<string, unknown>>>()
  })

  it('ProTableProps<T> 泛型传播：columns / requestApi 响应', () => {
    type Props = ProTableProps<User>
    expectTypeOf<Props['columns']>().toEqualTypeOf<ProColumn<User>[]>()
    expectTypeOf<Props['requestApi']>().returns.toMatchTypeOf<Promise<ProTableResponse<User>>>()
  })

  it('ProColumn<T> 可赋值给 ProColumn（bivariance：下游子组件/能力层消费不报错）', () => {
    const cols: ProColumn<User>[] = [{ prop: 'name', label: '名称' }]
    // 模拟下游非泛型消费（EditCell col / SearchForm columns / ColSetting columns）
    const loose: ProColumn[] = cols
    expectTypeOf(loose).toEqualTypeOf<ProColumn[]>()
  })
})
```

- [x] **Step 2: 跑 type-check 确认红**

Run: `pnpm type-check:full`
Expected: FAIL（`ProColumn` 无泛型参数 / `ProTableProps<User>` 类型不匹配等）

- [x] **Step 3: 改造 types/index.ts**

`ProColumn` 接口（原 122-164 行区域）改为：

```ts
/**
 * ProTable 列定义 —— 同时驱动表格列与搜索项（spec §1 配置驱动）。
 *
 * 泛型 T = 行数据类型（M1 泛型化，默认 Record<string, unknown> 向后兼容）。
 * render/headerRender 用「方法语法」声明：TS 对方法参数做双变（bivariance）检查，
 * 使 ProColumn<T> 可赋值给 ProColumn（默认 Record）——下游子组件与能力层消费方
 * 无需泛型化（§5.1 JSDoc 陷阱 #2：单属性一段注释）。
 *
 * @group ProTable 类型
 */
export interface ProColumn<T extends object = Record<string, unknown>> {
  /** 字段名（v-for key + table column prop + search 表单 key）—— IDE 优先补全 T 的键；联合 string 放行 'operation' 等特殊列（决策 D1） */
  prop: Extract<keyof T, string> | string
  /** 显示文本（表头 + 表单 label） */
  label: string
  /** 特殊列类型（index 序号 / selection 多选 / expand 展开 / operation 操作） */
  type?: 'index' | 'selection' | 'expand' | 'operation'
  width?: number | string
  minWidth?: number | string
  /** 固定列（left/right；false 由列设置抽屉控制） */
  fixed?: 'left' | 'right'
  /** 是否可排序 */
  sortable?: boolean
  /** 是否隐藏（支持 Ref 响应式，列设置抽屉切换） */
  hidden?: boolean | Ref<boolean>
  /** 搜索配置（缺省则该列不参与搜索区） */
  search?: SearchConfig
  /** 字典映射（自动渲染 ElTag） */
  enum?: EnumProps[]
  /** 是否从 useDict 异步字典过滤（spec §九 #9） */
  isFilterEnum?: boolean
  /** el-option fieldNames（label/value 映射，与 element-plus 对齐） */
  fieldNames?: { label: string; value: string }
  /** 自定义表头渲染（返回 VNode；支持 h() 与 JSX）—— 方法语法（bivariance），见接口级注释 */
  headerRender?(scope: { column: ProColumn<T>; $index: number }): VNode
  /** 自定义单元格渲染（返回 VNode；不传则按 enum/字段值渲染）—— 方法语法（bivariance），见接口级注释 */
  render?(scope: { row: T; column: ProColumn<T>; $index: number }): VNode
  /** 透传给 ElTableColumn 的 props */
  tableProps?: Record<string, unknown>
  /** 行内编辑配置（不声明 = 该列只读） */
  edit?: ColumnEditConfig
  /** 树形列声明（仅一列生效，默认第一列） */
  tree?: ColumnTreeConfig
  /** 单元格合并配置（不声明 = 该列不参与合并） */
  span?: ColumnSpanConfig
  /** 该列是否参与行拖拽（默认 false 不参与） */
  draggable?: boolean
}
```

`ProTableResponse` / `ProTableRequestApi` / `ProTableProps` / `ProTableExpose` 改为：

```ts
/**
 * ProTable requestApi 响应结构 —— 后端约定（data + total + pageNum + pageSize）。
 *
 * @group ProTable 类型
 */
export interface ProTableResponse<T extends object = Record<string, unknown>> {
  data: T[]
  total: number
  pageNum: number
  pageSize: number
}

/**
 * ProTable requestApi 方法签名。
 *
 * @group ProTable 类型
 */
export type ProTableRequestApi<T extends object = Record<string, unknown>> = (
  params: Record<string, unknown>
) => Promise<ProTableResponse<T>>

/**
 * ProTable 组件 props —— 公开 API 的类型契约（spec §4 / §7）。
 *
 * @group ProTable 类型
 */
export interface ProTableProps<T extends object = Record<string, unknown>> {
  /** 列定义（同时驱动表格列与搜索项） */
  columns: ProColumn<T>[]
  /** 数据请求方法（必填） */
  requestApi: ProTableRequestApi<T>
  /** 固定查询参数（搜索时与表单值合并；附录 A #10 序列化规则） */
  initParam?: Record<string, unknown>
  /**
   * 数据预处理（在 useTable 拿到 result 之后）—— 方法语法（bivariance），
   * 与 render 同理由：保证 ProTableProps<T> 在下游非泛型消费时可赋值
   */
  dataCallback?(data: T[]): T[]
  /** 请求错误回调（useRequest.onError 已自动捕获错误） */
  requestError?: (error: unknown) => void
  /** 是否显示分页（true / false / 透传 props） */
  pagination?: boolean | Record<string, unknown>
  /** 表格引擎（spec 决策 4：首次 mount 前设置，运行时修改需 reload） */
  tableEngine?: TableEngine
  /** 用于 localStorage 缓存列设置的 key（未传则不持久化，附录 A #5） */
  tableKey?: string
  /** 行 key 字段名（多选必填） */
  rowKey?: string
  /** 初始每页大小（默认 10） */
  pageSize?: number
  /** 搜索项默认显示行数（默认 3 行；超出可展开） */
  searchRows?: number
  /** 默认密度（附录 A #7 默认 'default'） */
  density?: TableDensity
  /** 行内编辑（v2.0） */
  enableRowEdit?: boolean | RowEditConfig
  /** 树形数据（v2.0） */
  enableTree?: boolean | TreeConfig
  /** 单元格合并（v2.0） */
  enableCellSpan?: boolean | CellSpanConfig
  /** 行拖拽排序（v2.0） */
  enableRowDrag?: boolean | RowDragConfig
}

/**
 * ProTable 实例对外暴露的 API（spec §八）—— 父组件通过 ref 调用。
 *
 * @group ProTable 类型
 */
export interface ProTableExpose<T extends object = Record<string, unknown>> {
  /** 重新执行当前搜索条件（搜索参数不变） */
  refresh: () => Promise<void>
  /**
   * 重置搜索参数到 defaultValue + 清空分页 + 刷新
   * 默认行为：保留多选选中行（附录 A #1；调用方需清可调 clearSelection）
   */
  reset: () => Promise<void>
  /** 当前多选选中的行（按 row-key 去重） */
  getSelectedRows: () => T[]
  /** 清空所有选中 */
  clearSelection: () => void
  /** 当前搜索参数（响应式 read-only snapshot） */
  getSearchParams: () => Record<string, unknown>
  /**
   * 程序化修改搜索参数（修改后自动触发搜索 + 回到第 1 页，附录 A #9）
   * 默认行为：保留多选选中行（附录 A #3）
   */
  setSearchParams: (params: Record<string, unknown>) => Promise<void>
  /**
   * element-plus 表格实例（v2.0 vxe-table 引擎未实现，传入时回退 element-plus，故恒有值）。
   * 使用 ComponentPublicInstance 而非 InstanceType<typeof ElTable>，
   * 原因：el-table 是 functional 组件定义，InstanceType 不适用。
   * 父组件如需直接调用 el-table 方法，可通过类型断言访问具体方法。
   */
  element: Ref<ComponentPublicInstance | null>
  /** 当前激活的引擎（首次挂载锁定） */
  engine: TableEngine
  // 行内编辑（v2.0 —— Task 7 实施后改为 required）
  startEdit?: (rowKey: string | number) => void
  cancelEdit?: (rowKey?: string | number) => void
  saveEdit?: (rowKey?: string | number) => Promise<boolean>

  // 树形（v2.0 —— Task 7 实施后改为 required）
  expandNode?: (rowKey: string | number, expanded?: boolean) => void
  collapseNode?: (rowKey: string | number) => void
  refreshChildren?: (rowKey: string | number) => Promise<void>

  // 行拖拽（v2.0 —— Task 7 实施后改为 required）
  setRowOrder?: (newOrder: T[]) => void
}
```

`RowEditConfig` / `TreeConfig` / `CellSpanConfig` / `RowDragConfig` / `ColumnEditConfig` 等能力层配置**保持非泛型**（内部行类型 `Record<string, unknown>` 不变）——能力层与编排层之间已有 cast 边界（useTableCapabilities），不扩散泛型。

- [x] **Step 4: 跑 type-check 确认绿 + 回归**

Run: `pnpm type-check:full && pnpm test src/components/ProTable && pnpm lint`
Expected: 全绿（此时 composables 还没泛型化——它们消费 `ProTableProps`（默认 Record），Task 1 类型变化对它们是兼容的；bivariance 保证 `ProColumn<T>` 可赋值 `ProColumn`）

- [x] **Step 5: Commit（需用户确认）**

```bash
git add src/components/ProTable/types/
git commit -m "feat(pro-table): ProColumn/ProTableProps 泛型化（M1 类型层，运行时零变化）"
```

### Task 2: composables 泛型签名传播

**Files:**
- Modify: `src/components/ProTable/composables/useSearch.ts`（options 泛型化）
- Modify: `src/components/ProTable/composables/useColumns.ts`（options/return/cloneColumns 泛型化）
- Modify: `src/components/ProTable/composables/useTable.ts`（options/return 泛型化）
- Modify: `src/components/ProTable/composables/useTableCapabilities.ts`（options/v2Expose 泛型化）

- [x] **Step 1: 跑现有 spec 确认基线绿**

Run: `pnpm test src/components/ProTable`
Expected: 全绿（本任务只改类型签名，不改运行时；以现有用例做回归基线）

- [x] **Step 2: useSearch.ts 泛型化**

`UseSearchOptions` 与 `useSearch` 改为（其余实现不变）：

```ts
export interface UseSearchOptions<T extends object = Record<string, unknown>> {
  props: ProTableProps<T>
  engine: Ref<TableEngine>
  fetchHook?: FetchHook
}

export function useSearch<T extends object = Record<string, unknown>>(
  options: UseSearchOptions<T>
): UseSearchReturn {
```

- [x] **Step 3: useColumns.ts 泛型化**

```ts
export interface UseColumnsOptions<T extends object = Record<string, unknown>> {
  props: ProTableProps<T>
  engine: Ref<TableEngine>
}

export interface UseColumnsReturn<T extends object = Record<string, unknown>> {
  allColumns: Ref<ProColumn<T>[]>
  sortedColumns: Ref<ProColumn<T>[]>
  searchColumns: ProColumn<T>[]
  visibleKeys: Ref<string[]>
  fixedKeys: Ref<string[]>
  colSettingVisible: Ref<boolean>
  toggleVisible: (prop: string) => void
  toggleFixed: (prop: string, fixed: 'left' | 'right' | undefined) => void
  setColumnOrder: (order: string[]) => void
  setVisibleKeys: (keys: string[]) => void
  setFixedKeys: (keys: string[]) => void
  resetToDefault: () => void
}
```

`cloneColumns` 与 `useColumns` 签名：

```ts
function cloneColumns<T extends object>(cols: ProColumn<T>[]): ProColumn<T>[] {
  return cols.map((col) => {
    const copy: ProColumn<T> = { ...col }
    // ……（内部实现不变）
  })
}

export function useColumns<T extends object = Record<string, unknown>>(
  options: UseColumnsOptions<T>
): UseColumnsReturn<T> {
```

函数体内三处 `ProColumn` 标注同步改 `ProColumn<T>`：`cloneColumns` 的 `copy` 声明、`isHidden(col: ProColumn<T>)`、`sortedColumns` computed 内的 `const arr: ProColumn<T>[]`、`toggleVisible`/`toggleFixed`/`resetToDefault` 内的 cast（`(col as ProColumn<T>)`）。

- [x] **Step 4: useTable.ts 泛型化**

```ts
export interface UseTableOptions<T extends object = Record<string, unknown>> {
  props: ProTableProps<T>
  /** 列上下文（useColumns 返回值） */
  columns: { allColumns?: Ref<unknown[]>; sortedColumns?: Ref<unknown[]> }
  engine: Ref<TableEngine>
  /**
   * 读取当前搜索参数 —— 由 ProTable.vue 注入 useSearch.searchParams（单一数据源）。
   * 第 1 步单源化：useTable 不再自持 searchParams 副本（原双份 + watch 桥接导致 H1 参数错配）。
   */
  getSearchParams: () => Record<string, unknown>
}

export interface UseTableReturn<T extends object = Record<string, unknown>> {
  data: Ref<T[] | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  total: Ref<number>
  page: Ref<number>
  pageSize: Ref<number>
  selectedRows: Ref<T[]>
  density: Ref<TableDensity>
  tableRef: Ref<ComponentPublicInstance | null>
  refresh: () => Promise<void>
  clearSelection: () => void
  getSelectedRows: () => T[]
  setSelectedRows: (rows: T[]) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setDensity: (d: TableDensity) => void
}

export function useTable<T extends object = Record<string, unknown>>(
  options: UseTableOptions<T>
): UseTableReturn<T> {
```

函数体改动（data/selectedRows/setSelectedRows 的类型与行读取 cast）：

```ts
  const data = ref<T[] | null>(null)
  // ……（total/page/pageSize/tableRef/density 不变）
  const selectedRows = ref<T[]>([])

  // onSuccess 回调不变（result 类型随 props.requestApi 变为 ProTableResponse<T>）

  function setSelectedRows(rows: T[]): void {
    // 按 row-key 去重（spec §九 #13 守卫：row-key 缺失时不报错）
    const key = props.rowKey
    if (!key) {
      selectedRows.value = [...rows]
      return
    }
    const seen = new Set<string>()
    const unique: T[] = []
    for (const row of rows) {
      // T extends object 无索引签名：行字段读取统一经 Record 转换（本文件唯一 cast 点之一）
      const k = String((row as Record<string, unknown>)[key])
      if (seen.has(k)) continue
      seen.add(k)
      unique.push(row)
    }
    selectedRows.value = unique
  }
```

- [x] **Step 5: useTableCapabilities.ts 泛型化**

```ts
export interface UseTableCapabilitiesOptions<T extends object = Record<string, unknown>> {
  props: ProTableProps<T>
  columns: { allColumns?: RefType<ProColumn<T>[]> }
  table: { data: RefType<T[] | null> }
  /**
   * el-table tbody DOM 获取器 —— 由编排层提供（持有模板 ref），
   * 传入后 useRowDrag 自持挂载生命周期（onMounted + watch data 自动重挂）。
   */
  getTbody?: () => HTMLElement | null
}
```

`v2Expose` 类型与 `useTableCapabilities` 签名：

```ts
  v2Expose: {
    startEdit: (rowKey: string | number) => void
    cancelEdit: (rowKey?: string | number) => void
    saveEdit: (rowKey?: string | number) => Promise<boolean>
    expandNode: (rowKey: string | number, expanded?: boolean) => void
    collapseNode: (rowKey: string | number) => void
    refreshChildren: (rowKey: string | number) => Promise<void>
    setRowOrder: (newOrder: T[]) => void
  }
}

export function useTableCapabilities<T extends object = Record<string, unknown>>(
  options: UseTableCapabilitiesOptions<T>
): UseTableCapabilitiesReturn {
```

函数体内：4 个能力 composable（useRowEdit/useTreeData/useCellSpan/useRowDrag）**保持非泛型消费**，既有 cast 保留（`columns.allColumns as Ref<ProColumn[]>`、`table.data as unknown as Ref<Record<string, unknown>[]>`）；仅 `v2Expose.setRowOrder` 参数改 `T[]` + 赋值处 cast：

```ts
    setRowOrder: (newOrder: T[]) => {
      if (table.data)
        (table.data as Ref<Record<string, unknown>[] | null>).value =
          newOrder as unknown as Record<string, unknown>[]
    },
```

- [x] **Step 6: 跑全量确认绿**

Run: `pnpm type-check:full && pnpm test src/components/ProTable && pnpm lint`
Expected: 全绿（此时 ProTable.vue 仍传非泛型 propsForComposables——默认 T 兼容）

- [x] **Step 7: Commit（需用户确认）**

```bash
git add src/components/ProTable/composables/
git commit -m "feat(pro-table): composables 泛型签名传播（M1，运行时零变化）"
```

### Task 3: ProTable.vue 泛型化

**Files:**
- Modify: `src/components/ProTable/ProTable.vue`

- [x] **Step 1: script 标签加 generic + props cast 改泛型**

```vue
<script setup lang="ts" generic="T extends object = Record<string, unknown>">
```

`propsForComposables`（原 58 行）改为：

```ts
const propsForComposables = props as unknown as ProTableProps<T>
```

- [x] **Step 2: 三个行读取/渲染辅助函数收口 cast**

```ts
/**
 * 解析列渲染（enum → ElTag；render → 调用返回 VNode；默认 → 字段值）
 *
 * 行字段读取经 record 局部转换：T extends object 无索引签名，
 * render 回调则直接拿到 T（泛型化的核心收益）。
 *
 * @group ProTable 组件
 */
function resolveCell(col: ProColumn<T>, row: T, index: number): unknown {
  if (col.render) return col.render({ row, column: col, $index: index })
  const record = row as Record<string, unknown>
  if (col.enum) {
    const entry = col.enum.find((e) => e.value === record[col.prop])
    if (entry) {
      return h(ElTag, { type: entry.tagType ?? 'info' }, () => entry.label)
    }
  }
  return record[col.prop]
}
```

```ts
/** 统一取行 rowKey（props.rowKey 字段，默认 'id'）—— 模板与事件桥接共用 */
function rowKeyOf(row: unknown): string | number {
  // unknown 入参解耦 T：树形扁平行含 _level/_hasChildren 附加字段，事件行来自 el-table（any）
  return (row as Record<string, unknown>)[props.rowKey ?? 'id'] as string | number
}
```

`handleSelectionChange` 改泛型（其余事件处理器不动——它们只经 rowKeyOf 取 key）：

```ts
/** 多选变化桥接 */
function handleSelectionChange(rows: T[]): void {
  table.setSelectedRows(rows)
}
```

`defineExpose` 的 `satisfies` 改泛型（最后一行）：

```ts
} satisfies ProTableExpose<T>)
```

- [x] **Step 3: 跑全量确认绿**

Run: `pnpm type-check:full && pnpm test src/components/ProTable && pnpm lint`
Expected: 全绿。M1 完成判据：**git diff 无任何运行时逻辑变化**（仅类型标注与局部 cast）

Run: `git diff --stat`（人工核对：改动应全部是类型层）

- [x] **Step 4: Commit（需用户确认）**

```bash
git add src/components/ProTable/ProTable.vue
git commit -m "feat(pro-table): ProTable.vue 泛型 SFC 化（M1 完成，运行时零变化）"
```

---

## M2：服务端排序

### Task 4: types 增量（SortState / SortChangeEvent / sortable 扩展 / sortParamsAdapter）

**Files:**
- Modify: `src/components/ProTable/types/index.ts`
- Modify: `src/components/ProTable/index.ts`（barrel 导出新类型）

- [x] **Step 1: types/index.ts 新增排序类型 + 扩展字段**

在 `TableDensity` 类型后新增：

```ts
/** 排序状态 —— 组件向外暴露/emit 的形态；null 表示未排序（表头第三击清除） @group ProTable 类型 */
export interface SortState<T extends object = Record<string, unknown>> {
  /** 排序列字段名（IDE 优先补全 T 的键；联合 string 与 ProColumn.prop 同理由） */
  prop: Extract<keyof T, string> | string
  /** 升序 / 降序 */
  order: 'ascending' | 'descending'
}

/** el-table sort-change 事件负载（order 为 null = 第三击清除排序） @group ProTable 类型 */
export interface SortChangeEvent {
  prop: string
  order: 'ascending' | 'descending' | null
}
```

`ProColumn.sortable` 扩展（JSDoc 更新 + 类型放宽）：

```ts
  /** 是否可排序 —— true 客户端排序（el-table 原生行为）；'custom' 服务端排序（M2 接线：sort-change → 请求参数） */
  sortable?: boolean | 'custom'
```

`ProTableProps` 新增（放在 `pagination` 字段后）：

```ts
  /**
   * 排序参数序列化适配（决策 D2）—— 缺省用内置约定 { orderByColumn, isAsc }；
   * 后端约定不同时用它改键名/形态（如 (state) => ({ sortBy: state.prop, sortOrder: state.order })）
   */
  sortParamsAdapter?: (state: SortState<T>) => Record<string, unknown>
```

`ProTableExpose` 新增（`engine` 字段后）：

```ts
  /** 当前排序状态（null = 未排序；M2 服务端排序） */
  getSortState: () => SortState<T> | null
```

- [x] **Step 2: barrel 导出新类型**

`index.ts` 的 type 导出块（原 26-37 行）追加两行：

```ts
export {
  type ProColumn,
  type ProTableProps,
  type ProTableExpose,
  type ProTableRequestApi,
  type ProTableResponse,
  type EnumProps,
  type SearchConfig,
  type SearchElType,
  type TableEngine,
  type TableDensity,
  /** 排序状态 —— sort-change 事件与 getSortState 暴露的类型 @see ./types */
  type SortState,
  /** el-table sort-change 事件负载 @see ./types */
  type SortChangeEvent,
} from './types'
```

- [x] **Step 3: 跑 type-check 确认绿**

Run: `pnpm type-check:full && pnpm lint`
Expected: 全绿（仅类型新增，`sortable: 'custom'` 值暂无消费者不影响运行时）

- [x] **Step 4: Commit（需用户确认）**

```bash
git add src/components/ProTable/types/ src/components/ProTable/index.ts
git commit -m "feat(pro-table): 服务端排序类型契约（SortState/SortChangeEvent/sortParamsAdapter）"
```

### Task 5: useTable 排序状态 + 请求合并（TDD）

**Files:**
- Modify: `src/components/ProTable/composables/useTable.ts`
- Test: `src/components/ProTable/composables/useTable.spec.ts`

- [x] **Step 1: 写失败测试（useTable.spec.ts 追加 4 个用例）**

```ts
  it('M2：onSortChange 更新 sortState 并把排序参数并入请求（默认序列化）', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    table.onSortChange({ prop: 'name', order: 'ascending' })
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    expect(deps.props.requestApi).toHaveBeenLastCalledWith({
      name: '',
      orderByColumn: 'name',
      isAsc: 'asc',
      pageNum: 1,
      pageSize: 10,
    })
    expect(table.getSortState()).toEqual({ prop: 'name', order: 'ascending' })
  })

  it('M2：第三击（order=null）清除排序状态且请求不带排序参数', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    table.onSortChange({ prop: 'name', order: 'ascending' })
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    table.onSortChange({ prop: 'name', order: null })
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(3))
    expect(table.getSortState()).toBeNull()
    const last = deps.props.requestApi.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(last).not.toHaveProperty('orderByColumn')
    expect(last).not.toHaveProperty('isAsc')
  })

  it('M2：自定义 sortParamsAdapter 覆盖默认序列化', async () => {
    const deps = makeDeps()
    deps.props.sortParamsAdapter = (state: SortState) => ({
      sortBy: state.prop,
      sortOrder: state.order,
    })
    const table = useTable(deps)
    await table.refresh()
    table.onSortChange({ prop: 'name', order: 'descending' })
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    expect(deps.props.requestApi).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'name', sortOrder: 'descending' })
    )
  })

  it('M2：排序变化回第 1 页（page>1 时只触发一次新请求）', async () => {
    const deps = makeDeps()
    const table = useTable(deps)
    await table.refresh()
    table.setPage(3)
    await vi.waitFor(() => expect(deps.props.requestApi).toHaveBeenCalledTimes(2))
    expect(table.page.value).toBe(3)
    table.onSortChange({ prop: 'name', order: 'ascending' })
    await vi.waitFor(() => expect(table.page.value).toBe(1))
    const last = deps.props.requestApi.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(last).toMatchObject({ pageNum: 1, orderByColumn: 'name' })
    // page watch 已触发刷新：确认没有二次重复请求
    await new Promise((r) => setTimeout(r, 20))
    expect(deps.props.requestApi).toHaveBeenCalledTimes(3)
  })
```

spec 文件头部 import 追加 `SortState` 类型：

```ts
import type { SortState } from '../types'
```

- [x] **Step 2: 跑测试确认红**

Run: `pnpm test src/components/ProTable/composables/useTable.spec.ts`
Expected: FAIL（`table.onSortChange is not a function`）

- [x] **Step 3: useTable.ts 实现**

import 区追加：

```ts
import type { ProTableProps, SortChangeEvent, SortState, TableDensity, TableEngine } from '../types'
```

模块级内置序列化（`UseTableOptions` 定义之后）：

```ts
/**
 * 内置排序参数序列化 —— 国产后台最常用约定 { orderByColumn, isAsc }（设计决策 D2）。
 * 后端约定不同时由 props.sortParamsAdapter 接管（见类型 JSDoc）。
 */
function defaultSortParams(state: SortState | null): Record<string, unknown> {
  if (!state) return {}
  return { orderByColumn: state.prop, isAsc: state.order === 'ascending' ? 'asc' : 'desc' }
}
```

`UseTableReturn` 接口追加三个成员：

```ts
  /** 当前排序状态（null = 未排序） */
  sortState: Ref<SortState<T> | null>
  /** el-table sort-change 事件入口 —— 更新状态 + 回第 1 页 + 触发请求 */
  onSortChange: (evt: SortChangeEvent) => void
  /** 排序状态快照（ProTable.vue 经此向外 emit / expose） */
  getSortState: () => SortState<T> | null
```

函数体内新增（`const density = ...` 之后）：

```ts
  /** 排序状态 —— 不混入 searchParams（D4：排序是表格交互状态，非表单输入，useSearch 语义保持纯净） */
  const sortState = ref<SortState<T> | null>(null)

  /** 排序参数序列化：优先业务方 adapter，缺省内置约定；未排序返回空对象（不传空键给后端） */
  function serializeSort(state: SortState<T> | null): Record<string, unknown> {
    if (!state) return {}
    if (props.sortParamsAdapter) return props.sortParamsAdapter(state)
    return defaultSortParams(state)
  }
```

请求组装（`useRequest` 的 fetcher 内，原 70-74 行）改为：

```ts
      const params = serializeParams({
        ...options.getSearchParams(),
        ...serializeSort(sortState.value),
        pageNum: page.value,
        pageSize: pageSize.value,
      })
```

`refresh` 函数后新增：

```ts
  /**
   * el-table sort-change 事件入口（M2 服务端排序）。
   * 三连点语义由 el-table 提供（asc → desc → null）；order=null 清除排序。
   * 排序变化回第 1 页（与搜索同语义）：page 未变时须手动刷新（watch 不触发）。
   */
  function onSortChange(evt: SortChangeEvent): void {
    sortState.value = evt.order ? { prop: evt.prop, order: evt.order } : null
    if (page.value !== 1) {
      page.value = 1
    } else {
      void refresh()
    }
  }

  function getSortState(): SortState<T> | null {
    return sortState.value
  }
```

return 对象追加：

```ts
    sortState,
    onSortChange,
    getSortState,
```

- [x] **Step 4: 跑测试确认绿**

Run: `pnpm test src/components/ProTable/composables/useTable.spec.ts`
Expected: PASS（4 个新用例 + 6 个存量用例）

- [x] **Step 5: Commit（需用户确认）**

```bash
git add src/components/ProTable/composables/useTable.ts src/components/ProTable/composables/useTable.spec.ts
git commit -m "feat(pro-table): useTable 排序状态与请求参数合并（M2 服务端排序核心）"
```

### Task 6: ProTable.vue 接线 + 集成测试（TDD）

**Files:**
- Modify: `src/components/ProTable/ProTable.vue`
- Test: `src/components/ProTable/ProTable.integration.spec.ts`

- [x] **Step 1: 写失败测试（integration spec 追加 3 个用例）**

```ts
  it('M2：sortable=custom 列 sort-change → 请求带 orderByColumn/isAsc（服务端排序接线）', async () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ name: '甲', amount: 3 }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'amount', label: '金额', sortable: 'custom' }],
        requestApi,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10)) // 首次请求
    // 直接驱动 el-table 的 sort-change（jsdom 点击 el-table 表头不可靠；
    // 事件接线由本测试覆盖，真实点击路径列为浏览器手动验证）
    wrapper
      .findComponent({ name: 'ElTable' })
      .vm.$emit('sort-change', { column: null, prop: 'amount', order: 'ascending' })
    await new Promise((r) => setTimeout(r, 10))
    const calls = requestApi.mock.calls
    expect(calls[calls.length - 1]![0]).toMatchObject({ orderByColumn: 'amount', isAsc: 'asc' })
  })

  it('M2：sortable=true（客户端排序）列 sort-change 不触发服务端请求', async () => {
    const requestApi = vi.fn().mockResolvedValue({
      data: [{ name: '甲', amount: 3 }],
      total: 1,
      pageNum: 1,
      pageSize: 10,
    })
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'amount', label: '金额', sortable: true }],
        requestApi,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    const callsBefore = requestApi.mock.calls.length
    wrapper
      .findComponent({ name: 'ElTable' })
      .vm.$emit('sort-change', { column: null, prop: 'amount', order: 'ascending' })
    await new Promise((r) => setTimeout(r, 10))
    expect(requestApi.mock.calls.length).toBe(callsBefore)
  })

  it('M2：组件向外 emit sort-change（父级可监听排序变化）', async () => {
    const onSortChange = vi.fn()
    const wrapper = mount(ProTable, {
      props: {
        columns: [{ prop: 'amount', label: '金额', sortable: 'custom' }],
        requestApi: mockApi,
        onSortChange,
      } as unknown as ProTableProps,
    })
    await new Promise((r) => setTimeout(r, 10))
    wrapper
      .findComponent({ name: 'ElTable' })
      .vm.$emit('sort-change', { column: null, prop: 'amount', order: 'descending' })
    await new Promise((r) => setTimeout(r, 10))
    expect(onSortChange).toHaveBeenCalledWith({ prop: 'amount', order: 'descending' })
  })
```

- [x] **Step 2: 跑测试确认红**

Run: `pnpm test src/components/ProTable/ProTable.integration.spec.ts`
Expected: 新用例 FAIL（custom 列未接线：请求不带排序参数 / 客户端列也触发请求 / 无 emit）

- [x] **Step 3: ProTable.vue 实现**

import 区（原 37 行 `import type { ProColumn, ProTableExpose, ProTableProps, TableDensity } from './types'`）改为：

```ts
import type {
  ProColumn,
  ProTableExpose,
  ProTableProps,
  SortChangeEvent,
  SortState,
  TableDensity,
} from './types'
```

`attrs` 声明后新增 emits 声明：

```ts
const emit = defineEmits<{
  /** 服务端排序变化（仅 sortable='custom' 列触发；payload 为 null 表示清除排序） */
  (e: 'sort-change', payload: SortState<T> | null): void
}>()
```

`handleSelectionChange` 后新增处理器（含「仅 custom 列生效」门控——客户端排序列维持 el-table 原生行为，不发请求）：

```ts
/**
 * M2 服务端排序桥接：仅 sortable='custom' 列生效（决策：客户端排序列维持 el-table 原生行为）。
 * 经 useTable.onSortChange 更新状态 + 回第 1 页 + 触发请求，随后向外 emit 当前排序状态。
 */
function handleSortChange(evt: SortChangeEvent): void {
  const col = columns.sortedColumns.value.find((c) => c.prop === evt.prop)
  if (!col || col.sortable !== 'custom') return
  table.onSortChange(evt)
  emit('sort-change', table.sortState.value)
}
```

ElTable 模板（原 264-266 行的事件绑定区）追加：

```vue
          @selection-change="handleSelectionChange"
          @cell-dblclick="handleCellDblClick"
          @expand-change="handleExpandChange"
          @sort-change="handleSortChange"
```

`defineExpose`（`engine` 字段后）追加：

```ts
  getSortState: () => table.getSortState(),
```

- [x] **Step 4: 跑测试确认绿 + 行数核查**

Run: `pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint`
Expected: 全绿。行数核查：ProTable.vue 应 ≤400 行（超 430 触发「再抽组件」预案——预估 +14 行到 ~400）

- [x] **Step 5: Commit（需用户确认）**

```bash
git add src/components/ProTable/ProTable.vue src/components/ProTable/ProTable.integration.spec.ts
git commit -m "feat(pro-table): 服务端排序接线（sort-change → 请求参数 + 对外 emit）"
```

### Task 7: 新 demo ProTableServerSort（mock + 页面 + 注册）

**Files:**
- Create: `mock/pro-table/orders.ts`
- Create: `src/modules/demo/examples/ProTable/ProTableServerSort.vue`
- Modify: `src/modules/demo/config/sidebar-groups.ts:29`（CN_NAMES 追加一行）
- Modify: `src/modules/demo/examples/ProTable/configs/protable-demos-api.ts`（追加排序 API 条目）

- [x] **Step 1: 新建 mock（M2 阶段用标准响应结构；M3 改造为自定义结构演示 responseAdapter）**

`mock/pro-table/orders.ts`：

```ts
/**
 * 服务端排序 demo —— 订单 mock（M2 新增）
 *
 * 支持：分页 / customer 模糊搜索 / amount、orderNo 服务端排序回显。
 * M3 将响应结构改造为 { records, totalCount } 以演示 responseAdapter。
 */
import type { ProTableRequestApi } from '@/components/ProTable/types'

export interface Order {
  id: string
  orderNo: string
  customer: string
  amount: number
  status: 'pending' | 'paid' | 'shipped'
}

const mockOrders: Order[] = [
  { id: '1', orderNo: 'SO-20260901', customer: '杭州星辰科技', amount: 12800, status: 'paid' },
  { id: '2', orderNo: 'SO-20260902', customer: '上海云帆贸易', amount: 8600, status: 'shipped' },
  { id: '3', orderNo: 'SO-20260903', customer: '北京远山文创', amount: 23900, status: 'pending' },
  { id: '4', orderNo: 'SO-20260904', customer: '深圳启明电子', amount: 5200, status: 'paid' },
  { id: '5', orderNo: 'SO-20260905', customer: '杭州星辰科技', amount: 31500, status: 'shipped' },
  { id: '6', orderNo: 'SO-20260906', customer: '成都锦城餐饮', amount: 4700, status: 'pending' },
  { id: '7', orderNo: 'SO-20260907', customer: '广州南珠服饰', amount: 15400, status: 'paid' },
  { id: '8', orderNo: 'SO-20260908', customer: '南京栖霞出版', amount: 9800, status: 'shipped' },
  { id: '9', orderNo: 'SO-20260909', customer: '武汉长江物流', amount: 18300, status: 'pending' },
  { id: '10', orderNo: 'SO-20260910', customer: '苏州园林设计', amount: 7600, status: 'paid' },
  { id: '11', orderNo: 'SO-20260911', customer: '重庆山城火锅', amount: 11200, status: 'shipped' },
  { id: '12', orderNo: 'SO-20260912', customer: '西安秦汉文旅', amount: 20500, status: 'pending' },
]

interface OrdersParams {
  pageNum?: number
  pageSize?: number
  customer?: string
  orderByColumn?: string
  isAsc?: 'asc' | 'desc'
}

export const ordersRequestApi: ProTableRequestApi<Order> = async (rawParams) => {
  await new Promise((r) => setTimeout(r, 200))
  const params = rawParams as OrdersParams
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 10
  let rows = [...mockOrders]
  if (params.customer) {
    rows = rows.filter((o) => o.customer.includes(params.customer as string))
  }
  if (params.orderByColumn === 'amount') {
    rows.sort((a, b) => (params.isAsc === 'desc' ? b.amount - a.amount : a.amount - b.amount))
  }
  if (params.orderByColumn === 'orderNo') {
    rows.sort((a, b) =>
      params.isAsc === 'desc'
        ? b.orderNo.localeCompare(a.orderNo)
        : a.orderNo.localeCompare(b.orderNo)
    )
  }
  return { data: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize), total: rows.length, pageNum, pageSize }
}
```

- [x] **Step 2: 新建 demo 页面**

`src/modules/demo/examples/ProTable/ProTableServerSort.vue`（结构对齐 ProTableRowDrag.vue：DocLayout/DemoFrame/DemoField/ApiTable/DocToc）：

```vue
<script setup lang="ts">
/**
 * ProTable 服务端排序 demo（M2 新增）
 *
 * 演示能力：
 * - ProColumn.sortable: 'custom' → 点击表头触发服务端排序（参数 orderByColumn/isAsc）
 * - 泛型列定义 ProColumn<Order> —— render/枚举类型安全（M1）
 * - 排序变化回第 1 页；第三击清除排序
 *
 * 验证步骤：
 * 1. 12 行订单，点击「金额」表头 → 升序；再点 → 降序；三击 → 恢复
 * 2. Network 面板确认请求带 orderByColumn=amount&isAsc=asc|desc
 * 3. 翻页到第 2 页后点排序 → 自动回第 1 页
 */
import type { ProColumn } from '@/components/ProTable/types'
import ProTable from '@/components/ProTable/ProTable.vue'
import DocLayout from '../../layouts/DocLayout.vue'
import DemoFrame from '../../components/DemoFrame.vue'
import DemoField from '../../components/DemoField.vue'
import ApiTable from '../../components/ApiTable.vue'
import DocToc from '../../components/DocToc.vue'
import { ordersRequestApi, type Order } from '../../../../../mock/pro-table/orders'
import { sortColumnItems, sortPropsItems, sortExposeItems } from './configs/protable-demos-api'

const bem = createNamespace('demo-pro-table-server-sort')

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

const tocItems = [
  { id: 'demo-server-sort', label: '能力演示' },
  { id: 'api-sort-column', label: 'ProColumn.sortable' },
  { id: 'api-sort-props', label: '排序 Props' },
  { id: 'api-sort-expose', label: 'Expose API' },
]

const basicCode = `<template>
  <ProTable :columns="columns" :request-api="ordersRequestApi" row-key="id" />
</template>

<script setup lang="ts">
const columns: ProColumn<Order>[] = [
  { prop: 'orderNo', label: '订单号', sortable: 'custom' },
  { prop: 'customer', label: '客户', search: { el: 'input' } },
  { prop: 'amount', label: '金额', sortable: 'custom' }  // 服务端排序列
]
<\/script>`
</script>

<template>
  <DocLayout>
    <DemoFrame
      title="ProTableServerSort 服务端排序"
      source="src/components/ProTable/composables/useTable.ts"
      :introductions="[
        'sortable: \'custom\' 的列表头点击后，排序参数随请求发给后端（默认 orderByColumn/isAsc）。',
        '排序变化自动回第 1 页；第三击清除排序（el-table 原生三连点语义）。',
        '后端约定不同可用 sortParamsAdapter 改序列化形态。',
      ]"
    >
      <section id="demo-server-sort" :class="bem.b()">
        <DemoField label="基本用法（服务端排序 + 泛型列定义）" :code="basicCode">
          <ProTable :columns="columns" :request-api="ordersRequestApi" row-key="id" />
        </DemoField>
      </section>

      <ApiTable
        title="ProColumn.sortable 字段"
        :items="sortColumnItems"
        anchor="api-sort-column"
      />
      <ApiTable title="排序相关 Props" :items="sortPropsItems" anchor="api-sort-props" />
      <ApiTable title="Expose API（getSortState）" :items="sortExposeItems" anchor="api-sort-expose" />
    </DemoFrame>

    <template #toc>
      <DocToc :items="tocItems" />
    </template>
  </DocLayout>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-demo-pro-table-server-sort {
  // BEM 命名空间
}
</style>
```

- [x] **Step 3: sidebar 注册 + API 配置条目**

`src/modules/demo/config/sidebar-groups.ts` 的 `CN_NAMES`（`ProTableRowDrag: '行拖拽排序',` 行后）追加：

```ts
  ProTableServerSort: '服务端排序',
```

`configs/protable-demos-api.ts` 文件末尾追加：

```ts
/* ───────────── 服务端排序 demo（ProTableServerSort） ───────────── */

export const sortColumnItems: ApiItem[] = [
  {
    name: 'sortable',
    type: "boolean | 'custom'",
    required: false,
    default: 'false',
    description: "true 客户端排序（el-table 原生）；'custom' 服务端排序（点击表头把排序参数发给后端）。",
  },
]

export const sortPropsItems: ApiItem[] = [
  {
    name: 'sortParamsAdapter',
    type: '(state: SortState) => Record<string, unknown>',
    required: false,
    description: '排序参数序列化适配；缺省 { orderByColumn, isAsc }。',
  },
]

export const sortExposeItems: ApiItem[] = [
  {
    name: 'getSortState()',
    type: 'SortState | null',
    description: '当前排序状态；组件同时向外 emit sort-change 事件。',
  },
]
```

- [x] **Step 4: 验证（路由派生 + 全量）**

Run: `pnpm check:routes && pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint`
Expected: 全绿（路由 `/demo/pro-table-server-sort` 由 import.meta.glob 自动派生，无需改 routes/index.ts）

- [x] **Step 5: Commit（需用户确认）**

```bash
git add mock/pro-table/orders.ts src/modules/demo/
git commit -m "feat(pro-table): 服务端排序 demo（ProTableServerSort + 订单 mock）"
```

---

## M3：响应结构适配器

### Task 8: responseAdapter（TDD）

**Files:**
- Modify: `src/components/ProTable/types/index.ts`
- Modify: `src/components/ProTable/composables/useTable.ts`
- Test: `src/components/ProTable/composables/useTable.spec.ts`

- [x] **Step 1: 写失败测试（useTable.spec.ts 追加 2 个用例）**

```ts
  it('M3：responseAdapter 映射自定义结构（records/totalCount → data/total）', async () => {
    const deps = makeDeps()
    deps.props.requestApi = vi.fn().mockResolvedValue({ records: [{ id: 7, name: 'x' }], totalCount: 1 })
    deps.props.responseAdapter = (raw: unknown) => {
      const r = raw as { records: unknown[]; totalCount: number }
      return { data: r.records, total: r.totalCount, pageNum: 1, pageSize: 10 }
    }
    const table = useTable(deps)
    await table.refresh()
    expect(table.data.value).toEqual([{ id: 7, name: 'x' }])
    expect(table.total.value).toBe(1)
  })

  it('M3：responseAdapter 返回非法结构 → 错误态 + requestError 回调（fail-fast）', async () => {
    const deps = makeDeps()
    const onRequestError = vi.fn()
    deps.props.requestApi = vi.fn().mockResolvedValue({ wrong: true })
    deps.props.responseAdapter = () => ({ bad: 1 }) as never
    deps.props.requestError = onRequestError
    const table = useTable(deps)
    await table.refresh()
    expect(table.error.value).toBeTruthy()
    expect(String(table.error.value?.message)).toContain('结构非法')
    expect(onRequestError).toHaveBeenCalled()
  })
```

- [x] **Step 2: 跑测试确认红**

Run: `pnpm test src/components/ProTable/composables/useTable.spec.ts`
Expected: 新用例 FAIL（非法结构未被拦截：`table.error.value` 为 null / data 为 undefined）

- [x] **Step 3: types + useTable 实现**

`ProTableProps` 新增（`sortParamsAdapter` 字段后）：

```ts
  /**
   * 响应结构适配器（决策 D5 fail-fast）—— 兼容非 { data, total, pageNum, pageSize } 约定的后端。
   * requestApi 可原样返回后端结构（类型侧 cast 一次），由本回调映射为 ProTableResponse<T>；
   * 映射结果结构非法（data 非数组 / total 非数字）时 console.error + 抛错（经 useRequest 错误通道进入 error 态）。
   */
  responseAdapter?: (raw: unknown) => ProTableResponse<T>
```

`useTable.ts` 模块级新增校验函数（`defaultSortParams` 之后）：

```ts
/**
 * 校验适配后的响应结构（M3 fail-fast，决策 D5）。
 * 抛错发生在 useRequest 的 try 内 → 被 catch 捕获进入 error 态 + requestError 回调——
 * 不静默吞、不影响组件树（AsyncState 展示错误 + 重试）。
 */
function assertValidResponse<T extends object>(result: ProTableResponse<T>): void {
  if (!result || !Array.isArray(result.data) || typeof result.total !== 'number') {
    const message =
      '[ProTable] responseAdapter 返回值结构非法：期望 { data: T[], total: number }（pageNum/pageSize 可省略）'
    console.error(message, result)
    throw new Error(message)
  }
}
```

`onSuccess` 回调改为：

```ts
      onSuccess: (result) => {
        const adapted = props.responseAdapter ? props.responseAdapter(result) : result
        assertValidResponse(adapted)
        data.value = props.dataCallback ? props.dataCallback(adapted.data) : adapted.data
        total.value = adapted.total
      },
```

- [x] **Step 4: 跑测试确认绿**

Run: `pnpm test src/components/ProTable/composables/useTable.spec.ts`
Expected: PASS（2 新用例 + 存量全绿——默认无 adapter 时恒等路径行为不变）

- [x] **Step 5: Commit（需用户确认）**

```bash
git add src/components/ProTable/types/index.ts src/components/ProTable/composables/useTable.ts src/components/ProTable/composables/useTable.spec.ts
git commit -m "feat(pro-table): responseAdapter 响应结构适配 + fail-fast 校验（M3）"
```

### Task 9: demo 改造为自定义响应结构 + 文档同步

**Files:**
- Modify: `mock/pro-table/orders.ts`（响应结构改自定义 + 导出 adapter）
- Modify: `src/modules/demo/examples/ProTable/ProTableServerSort.vue`（接 responseAdapter）
- Modify: `src/components/ProTable/README.md`
- Modify: `src/components/ProTable/ARCHITECTURE.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: mock 改造为自定义结构**

`mock/pro-table/orders.ts` 全文替换为：

```ts
/**
 * 服务端排序 demo —— 订单 mock（M3 改造：响应结构改为 { records, totalCount }，
 * 与 ProTable 默认约定不同，演示 responseAdapter 的真实业务用法）
 */
import type { ProTableRequestApi, ProTableResponse } from '@/components/ProTable/types'

export interface Order {
  id: string
  orderNo: string
  customer: string
  amount: number
  status: 'pending' | 'paid' | 'shipped'
}

/** 后端原始分页结构（非 ProTable 默认约定 → 必须配合 responseAdapter 使用） */
export interface BackendPage<T> {
  records: T[]
  totalCount: number
}

const mockOrders: Order[] = [
  { id: '1', orderNo: 'SO-20260901', customer: '杭州星辰科技', amount: 12800, status: 'paid' },
  { id: '2', orderNo: 'SO-20260902', customer: '上海云帆贸易', amount: 8600, status: 'shipped' },
  { id: '3', orderNo: 'SO-20260903', customer: '北京远山文创', amount: 23900, status: 'pending' },
  { id: '4', orderNo: 'SO-20260904', customer: '深圳启明电子', amount: 5200, status: 'paid' },
  { id: '5', orderNo: 'SO-20260905', customer: '杭州星辰科技', amount: 31500, status: 'shipped' },
  { id: '6', orderNo: 'SO-20260906', customer: '成都锦城餐饮', amount: 4700, status: 'pending' },
  { id: '7', orderNo: 'SO-20260907', customer: '广州南珠服饰', amount: 15400, status: 'paid' },
  { id: '8', orderNo: 'SO-20260908', customer: '南京栖霞出版', amount: 9800, status: 'shipped' },
  { id: '9', orderNo: 'SO-20260909', customer: '武汉长江物流', amount: 18300, status: 'pending' },
  { id: '10', orderNo: 'SO-20260910', customer: '苏州园林设计', amount: 7600, status: 'paid' },
  { id: '11', orderNo: 'SO-20260911', customer: '重庆山城火锅', amount: 11200, status: 'shipped' },
  { id: '12', orderNo: 'SO-20260912', customer: '西安秦汉文旅', amount: 20500, status: 'pending' },
]

interface OrdersParams {
  pageNum?: number
  pageSize?: number
  customer?: string
  orderByColumn?: string
  isAsc?: 'asc' | 'desc'
}

export const ordersRequestApi: ProTableRequestApi<Order> = async (rawParams) => {
  await new Promise((r) => setTimeout(r, 200))
  const params = rawParams as OrdersParams
  const pageNum = params.pageNum ?? 1
  const pageSize = params.pageSize ?? 10
  let rows = [...mockOrders]
  if (params.customer) {
    rows = rows.filter((o) => o.customer.includes(params.customer as string))
  }
  if (params.orderByColumn === 'amount') {
    rows.sort((a, b) => (params.isAsc === 'desc' ? b.amount - a.amount : a.amount - b.amount))
  }
  if (params.orderByColumn === 'orderNo') {
    rows.sort((a, b) =>
      params.isAsc === 'desc'
        ? b.orderNo.localeCompare(a.orderNo)
        : a.orderNo.localeCompare(b.orderNo)
    )
  }
  return {
    records: rows.slice((pageNum - 1) * pageSize, pageNum * pageSize),
    totalCount: rows.length,
  } as unknown as ProTableResponse<Order>
}

/** responseAdapter —— 把后端 { records, totalCount } 映射为 ProTable 约定结构 */
export const ordersResponseAdapter = (raw: unknown): ProTableResponse<Order> => {
  const page = raw as BackendPage<Order>
  return { data: page.records, total: page.totalCount, pageNum: 1, pageSize: 10 }
}
```

- [x] **Step 2: demo 接 adapter**

`ProTableServerSort.vue`：import 追加 `ordersResponseAdapter`，模板 ProTable 加 prop：

```vue
          <ProTable
            :columns="columns"
            :request-api="ordersRequestApi"
            :response-adapter="ordersResponseAdapter"
            row-key="id"
          />
```

`basicCode` 字符串同步展示 `:response-adapter="ordersResponseAdapter"` 一行；introductions 追加一条「本 demo 后端返回 { records, totalCount }，经 responseAdapter 映射（M3）」。

- [x] **Step 3: README.md 新增三节**

在「## 引擎」之前插入：

```markdown
## 泛型（M1）

```ts
interface User { id: number; name: string; status: 0 | 1 }

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
<ProTable :request-api="rawApi as ProTableRequestApi<Order>" :response-adapter="(raw) => {
  const r = raw as { records: Order[]; totalCount: number }
  return { data: r.records, total: r.totalCount, pageNum: 1, pageSize: 10 }
}" ... />
```

适配结果结构非法（data 非数组 / total 非数字）会 console.error 并进入错误态（AsyncState 展示 + 重试）。
```

- [x] **Step 4: ARCHITECTURE.md 同步**

- 「状态归属」表追加一行：`| 排序状态 | useTable | ref | 否 | M2 服务端排序：sortState（不混入 searchParams，决策 D4） |`
- 「Composables 依赖」表 `useTable` 行输出列追加 `sortState / onSortChange / getSortState`
- 「错误处理」小节追加一条：`responseAdapter 返回值结构非法 → console.error + 抛错（useRequest catch 进入 error 态 + requestError 回调，决策 D5）`

- [x] **Step 5: CHANGELOG.md**

按既有格式在 Unreleased/最新版本段追加：

```markdown
- feat(pro-table): ProColumn/ProTableProps 泛型化（render row 精确到 T，默认 T 向后兼容）
- feat(pro-table): 服务端排序（sortable: 'custom' 接线 + sortParamsAdapter + sort-change 事件 + getSortState）
- feat(pro-table): responseAdapter 响应结构适配 + fail-fast 校验
```

- [x] **Step 6: 全量验证**

Run: `pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint && pnpm check:routes`
Expected: 全绿

- [x] **Step 7: Commit（需用户确认）**

```bash
git add mock/pro-table/orders.ts src/modules/demo/ src/components/ProTable/README.md src/components/ProTable/ARCHITECTURE.md CHANGELOG.md
git commit -m "feat(pro-table): demo 演示 responseAdapter + 文档同步（M3 完成）"
```

### Task 10: 收尾验证 + 记忆更新

- [x] **Step 1: 全量回归**

Run: `pnpm test && pnpm type-check:full && pnpm lint`
Expected: 全绿（全项目单测，防上下游影响）

- [x] **Step 2: 浏览器手动验证清单**

1. `/demo/pro-table-server-sort`：点「金额」表头升序 → 降序 → 第三击清除；Network 确认 `orderByColumn=amount&isAsc=asc|desc`；翻页后点排序回第 1 页
2. 同页：搜索框输入客户名 → 点搜索 → 数据过滤 + 排序参数仍正确
3. `/demo/pro-table-overview` `/demo/pro-table-row-edit` `/demo/pro-table-tree` `/demo/pro-table-cell-span` `/demo/pro-table-row-drag` 回归（无行为变化）
4. 列设置抽屉：显隐/固定/拖拽排序/恢复默认（M1 触碰过 useColumns 类型）

- [x] **Step 3: 更新跨会话记忆**

更新 `~/.claude/projects/D--personal-github-vue3-----vue3-vite-project/memory/protable-arch-refactor-plan.md`：标记下一迭代三个里程碑完成状态与最终测试数。

---

## 附：风险与预案

| 风险 | 预案 |
|------|------|
| vue-tsc 不支持泛型 SFC 默认值语法（`generic="T extends object = Record<string, unknown>>"`） | 去默认值改 `generic="T extends object"`（T 从 props 推断）；仍失败则降级「组件不泛型 + ProColumn 泛型 + 调用方断言」 |
| ProTable.vue 超过 400 行（上限 430） | 预估 +14 行到 ~400；若超，抽 `useProTableSlots` 或把 handleSortChange 并入 useTable 返回 |
| jsdom 中 el-table 表头点击不可靠 | 集成测试用 `$emit('sort-change')` 驱动事件（本计划已采用）；真实点击列浏览器手动验证 |
| `Extract<keyof T, string> \| string` 在个别 TS 版本推断异常 | 类型 spec Task 1 已锁定行为；type-check:full 兜底 |
