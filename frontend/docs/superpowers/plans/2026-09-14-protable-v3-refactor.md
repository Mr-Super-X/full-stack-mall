# ProTable v3.0 重构与扩展 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 ProTable v2.2 架构审查发现的 15 项瑕疵（C+H+M+L），新增 4 个能力（汇总行 / 虚拟滚动 / 列分组 / 单元格编辑 v-model）+ 4 个 demo，达成 v3.0 演进目标。

**Architecture:**
- **Phase 1-4**：在 useColumns / useTable / useTableCapabilities / ProTable.vue 内部修复 + 抽公共工具 `_utils/pickDefined`、`useTableEngineDom` composable
- **Phase 5**：新增 4 个能力 composable（useSummary / useVirtualScroll / 列分组在 useColumns 内处理 / 单元格编辑 v-model 在 EditCell 内处理）+ 配套子组件（SummaryRow / GroupedHeader）
- **Phase 6**：4 个 demo 页面 + 路由 + 侧边栏菜单

**Tech Stack:**
- Vue 3.5 + TypeScript 6 + Vite 8 + Element Plus 2.14 + vxe-table 4.x
- TDD：vitest + @vue/test-utils
- 状态管理：Pinia 不变（本次不涉及全局 store）
- BEM：`createNamespace` + `.#{$BEM_PREFIX}-` 命名空间

---

## 关键决策（用户已确认）

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| **R1** | 列分组 key 体系 | **B: 父子扁平化** | 同列序、同持久化 key；子列展开时与父列在同一 group；持久化 round-trip 不漂移 |
| **R2** | 虚拟滚动 + 行内编辑 | **A: 禁用** | 虚拟行索引 ≠ 真实数据索引会破坏 edit key 映射；启动 warn 提示用户 |
| **R3** | 导出功能 | **剔除 5e** | 本次 v3.0 范围外；下一迭代单独规划 |
| **R4** | useSummary 汇总维度 | **A: 客户端聚合** | 列声明聚合函数（sum/avg/count/max/min）；不依赖后端；自包含可测 |
| **R5** | 单元格编辑 v-model 触发 | **B: blur 同步** | 与 ProTable 默认 `trigger='blur'` 对齐；避免 input 高频同步风暴；符合表单语义 |

---

## 任务依赖关系

```
Phase 1 (CRITICAL) ─┐
Phase 2 (HIGH)    ─┼─→ Phase 3 (MEDIUM) ─→ Phase 4 (LOW)
                   │                          │
                   │                          ▼
                   │              Phase 5a 汇总行（独立）
                   │              Phase 5b 虚拟滚动（独立）
                   │              Phase 5c 列分组（依赖 Phase 3 M1 子函数化）
                   │              Phase 5d 单元格编辑 v-model（独立）
                   │                          │
                   │                          ▼
                   └──────────→ Phase 6 demo 页面（依赖 Phase 5）
                                              │
                                              ▼
                                  完整回归 + code-reviewer 复审
```

每个 Phase 完成后跑 `pnpm test src/components/ProTable/`，单测通过再进入下一 Phase。

---

## Phase 1 — CRITICAL 修复

### Task 1: 修复 resetToDefault 破坏 Ref 响应性（C1）

**Files:**
- Modify: `src/components/ProTable/composables/useColumns.ts:217-230`
- Test: `src/components/ProTable/composables/useColumns.spec.ts`（追加测试）

**问题根因**：cloneColumns 已把外部 `Ref<boolean>` 转成 computed 包装（55-69 行），但 resetToDefault 手动 `ref(false)` 覆盖后外部响应性永久失效。

**修复**：
```ts
function resetToDefault(): void {
  if (!storageKey) return
  Local.remove(storageKey)
  // 直接调用 cloneColumns 重新走 computed 包装逻辑——保留外部 Ref 响应性
  allColumns.value = cloneColumns(props.columns)
  visibleKeys.value = props.columns.map((c) => c.prop)
  columnOrder.value = props.columns.map((c) => c.prop)
  fixedKeys.value = props.columns.filter((c) => c.fixed).map((c) => c.prop)
  // 删除原 224-228 行的 manual ref(false) 赋值
}
```

**测试用例**（useColumns.spec.ts 追加）：
```ts
it('resetToDefault 保留外部 Ref<boolean> 响应性', () => {
  const externalHidden = ref(false)
  const columns: ProColumn[] = [{ prop: 'name', label: 'Name', hidden: externalHidden }]
  const { result, rerender } = renderUseColumns({ columns })
  act(() => externalHidden.value = true)
  expect(result.current.sortedColumns.value.find(c => c.prop === 'name')).toBeUndefined()
  act(() => result.current.resetToDefault())
  act(() => externalHidden.value = true)
  expect(result.current.sortedColumns.value.find(c => c.prop === 'name')).toBeUndefined()
})
```

**Commit**:
```bash
git add src/components/ProTable/composables/useColumns.ts src/components/ProTable/composables/useColumns.spec.ts
git commit -m "fix(ProTable): resetToDefault 保留外部 Ref<boolean> 响应性（C1 修复）"
```

---

### Task 2: 修复 hidden/visibleKeys 回填循环（C2）

**Files:**
- Modify: `src/components/ProTable/composables/useColumns.ts:130-143, 148-164`
- Test: `src/components/ProTable/composables/useColumns.spec.ts`（追加）

**问题根因**：外部 Ref 从 false 变 true → sortedColumns 过滤掉该列 → 但 visibleKeys 仍含该 prop → persist 写回 visible: true → 下次回填 visibleKeys 又含该 prop → 与 hidden=true 矛盾。

**修复**（持久化层改造）：
```ts
function persist(): void {
  if (!storageKey) return
  const setting: PersistedSetting = {
    order: columnOrder.value,
    // 用「静态 boolean hidden + visibleKeys」作为权威，外部 Ref 走动态路径不参与持久化
    visible: Object.fromEntries(
      allColumns.value
        .filter((c) => typeof c.hidden === 'boolean')  // 仅静态列参与持久化
        .map((c) => [c.prop, !c.hidden && visibleKeys.value.includes(c.prop)])
    ),
    fixed: Object.fromEntries(
      allColumns.value.filter((c) => c.fixed).map((c) => [c.prop, c.fixed ?? 'left'])
    ),
  }
  Local.set(storageKey, setting)
}
```

**回填层同步修复**（85-111 行）：
```ts
// 回填 visibleKeys 时排除外部 Ref 列（动态列不走持久化）
const visibleKeys = ref<string[]>(
  persisted?.visible
    ? props.columns
        .filter((c) => typeof c.hidden === 'boolean')  // 仅静态列
        .map((c) => c.prop)
        .filter((p) => persisted.visible?.[p] !== false)
    : props.columns.map((c) => c.prop)
)
```

**测试用例**：
```ts
it('外部 Ref<boolean> hidden 变化不污染 persist', () => {
  const externalHidden = ref(false)
  const columns: ProColumn[] = [{ prop: 'name', label: 'Name', hidden: externalHidden }]
  const { result, rerender } = renderUseColumns({ columns, tableKey: 'test' })
  act(() => externalHidden.value = true)  // 外部隐藏
  expect(result.current.sortedColumns.value).toHaveLength(0)
  // 模拟外部 Ref 重新变 false 后重渲染
  externalHidden.value = false
  rerender({ columns })
  expect(result.current.sortedColumns.value).toHaveLength(1)
})
```

**Commit**:
```bash
git add src/components/ProTable/composables/useColumns.ts src/components/ProTable/composables/useColumns.spec.ts
git commit -m "fix(ProTable): 持久化层排除动态 Ref 列避免回填循环（C2 修复）"
```

---

## Phase 2 — HIGH 修复

### Task 3: page/pageSize watch 加清理（H1）

**Files:**
- Modify: `src/components/ProTable/composables/useTable.ts:213-221`
- Test: `src/components/ProTable/composables/useTable.spec.ts`（追加）

**修复**：
```ts
import { ref, watch, onMounted, onUnmounted, type ComponentPublicInstance, type Ref } from 'vue'

// 替换原 219-221 行
const stopPageWatcher = watch([page, pageSize], () => {
  void refresh()
})

onUnmounted(() => {
  stopPageWatcher()
})

// 首次 mount 触发请求
onMounted(() => {
  void refresh()
})
```

**测试用例**：
```ts
it('组件卸载后 page watch 停止', async () => {
  const { result, unmount } = renderUseTable({ props })
  act(() => result.current.setPage(2))
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2))
  unmount()
  act(() => result.current.setPage(3))
  await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2))  // 不再增加
})
```

**Commit**:
```bash
git add src/components/ProTable/composables/useTable.ts src/components/ProTable/composables/useTable.spec.ts
git commit -m "fix(ProTable): page/pageSize watch 加 onUnmounted 清理（H1 修复）"
```

---

### Task 4: proTableEl watch 加清理（H2）

**Files:**
- Modify: `src/components/ProTable/ProTable.vue:140-146`
- Test: `src/components/ProTable/ProTable.integration.spec.ts`（追加）

**修复**：
```ts
import { ref, useAttrs, watch, onUnmounted, type ComponentPublicInstance, type Ref } from 'vue'

// 替换原 140-146 行
const stopProTableElWatcher = watch(
  proTableEl,
  (inst) => {
    table.tableRef.value = inst?.elTable ?? null
  },
  { flush: 'post' }
)

onUnmounted(() => {
  stopProTableElWatcher()
})
```

**测试用例**：
```ts
it('ProTable 卸载后 proTableEl watch 停止', async () => {
  const wrapper = mount(ProTable, { props: baseProps })
  await wrapper.find('.el-table').vm.$emit('hook:mounted')
  expect(wrapper.vm.element).not.toBeNull()
  wrapper.unmount()
  // 不应抛错或内存泄漏
})
```

**Commit**:
```bash
git add src/components/ProTable/ProTable.vue src/components/ProTable/ProTable.integration.spec.ts
git commit -m "fix(ProTable): proTableEl watch 加 onUnmounted 清理（H2 修复）"
```

---

### Task 5: validateCapabilities 提前到 setup（H3）

**Files:**
- Modify: `src/components/ProTable/composables/useTableCapabilities.ts:198`
- Test: `src/components/ProTable/composables/useTableCapabilities.spec.ts`（追加）

**修复**：
```ts
// 删除 onMounted(validateCapabilities) 这一行
// 在 setup 末尾直接调用（替换 198 行）
validateCapabilities()

// 清理未使用的 onMounted import（如果只在此处使用）
// 原 import 第 12 行：import { computed, onMounted, onUnmounted, type Ref } from 'vue'
// 改为：import { computed, onUnmounted, type Ref } from 'vue'
```

**测试用例**：
```ts
it('setup 阶段立即触发 validateCapabilities 警告', () => {
  const warn = vi.spyOn(console, 'warn')
  renderUseTableCapabilities({
    props: { ...baseProps, tableEngine: 'vxe-table', enableTree: true }
  })
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('vxe-table 引擎暂不支持树形'))
})
```

**Commit**:
```bash
git add src/components/ProTable/composables/useTableCapabilities.ts src/components/ProTable/composables/useTableCapabilities.spec.ts
git commit -m "perf(ProTable): validateCapabilities 提前到 setup 即时反馈（H3 修复）"
```

---

## Phase 3 — MEDIUM 优化

### Task 6: cloneColumns 拆分子函数（M1）

**Files:**
- Modify: `src/components/ProTable/composables/useColumns.ts:53-73`
- Test: `src/components/ProTable/composables/useColumns.spec.ts`（已有覆盖）

**重构**：
```ts
/**
 * 克隆单个列的 hidden 字段，统一处理 boolean / Ref<boolean> / undefined 三态
 * @see cloneColumns 调用方
 */
function cloneColumnHidden<T extends object>(col: ProColumn<T>): ProColumn<T> {
  const copy: ProColumn<T> = { ...col }
  const h = col.hidden
  if (h === undefined) return copy
  if (typeof h === 'boolean') {
    copy.hidden = ref(h)
    return copy
  }
  // 外部 Ref<boolean> → computed 包装：get 优先读本地写入，否则读外部
  const external = h as Ref<boolean>
  const local = ref<boolean | null>(null)
  copy.hidden = computed({
    get: () => local.value ?? Boolean(external.value),
    set: (v: boolean) => { local.value = v },
  })
  return copy
}

function cloneColumns<T extends object>(cols: ProColumn<T>[]): ProColumn<T>[] {
  return cols.map(cloneColumnHidden)
}
```

**Commit**:
```bash
git add src/components/ProTable/composables/useColumns.ts
git commit -m "refactor(ProTable): cloneColumns 拆出 cloneColumnHidden 子函数（M1）"
```

---

### Task 7: defaultSortParams 接受 SortState<T>（M2）

**Files:**
- Modify: `src/components/ProTable/composables/useTable.ts:73-76`

**修复**：
```ts
function defaultSortParams<T extends object>(state: SortState<T> | null): Record<string, unknown> {
  if (!state) return {}
  return { orderByColumn: state.prop, isAsc: state.order === 'ascending' ? 'asc' : 'desc' }
}

function serializeSort<T extends object>(state: SortState<T> | null): Record<string, unknown> {
  if (!state) return {}
  if (props.sortParamsAdapter) return props.sortParamsAdapter(state)
  return defaultSortParams(state)
}
```

**Commit**:
```bash
git add src/components/ProTable/composables/useTable.ts
git commit -m "refactor(ProTable): defaultSortParams 接受 SortState<T> 保留泛型（M2）"
```

---

### Task 8: 消除 loose computed（M3）

**Files:**
- Modify: `src/components/ProTable/ProTable.vue:223-225, 281-330, 307-325`
- Modify: `src/components/ProTable/components/{SearchForm,TableHeader,ColSetting,ElementTableBody,VxeTableBody}.vue`
  - 各组件加 `<script setup lang="ts" generic="T extends object = Record<string, unknown>">`
  - props 改 `ProColumn<T>[]`
- Test: 各组件 spec.ts 加类型覆盖

**重构**（ProTable.vue 223-225 行替换）：
```ts
// 移除 loose computed；直接传 columns（保留 ProColumn<T> 泛型）
// 子组件已声明 generic<T>，传值即可
const searchColumns = columns.searchColumns  // ProColumn<T>[]
const allColumnsRef = columns.allColumns      // Ref<ProColumn<T>[]>
const sortedColumnsRef = columns.sortedColumns  // Ref<ProColumn<T>[]>
```

**模板替换**（281-330 行）：
```vue
<SearchForm :columns="searchColumns" ... />
<TableHeader :columns="allColumnsRef.value" :visible-columns="sortedColumnsRef.value" ... />
<ElementTableBody :columns="sortedColumnsRef.value" ... />
```

**Commit**:
```bash
git add src/components/ProTable/ProTable.vue src/components/ProTable/components/{SearchForm,TableHeader,ColSetting,ElementTableBody,VxeTableBody}.vue
git commit -m "refactor(ProTable): 子组件加 generic<T> 消除 loose cast（M3）"
```

---

### Task 9: cast 边界收敛（M4）

**Files:**
- Modify: `src/components/ProTable/composables/useTableCapabilities.ts:241-247`

**修复**（抽 toRecordArray 工具，Phase 3.5 后引用）：
```ts
import { castToRecordArray } from './_utils/castToRecordArray'  // Phase 3.5 后新建

const v2Expose = {
  // ...
  setRowOrder: (newOrder: T[]) => {
    if (table.data) {
      table.data.value = castToRecordArray<T>(newOrder) as T[]
    }
  },
}
```

**Commit**:
```bash
git add src/components/ProTable/composables/useTableCapabilities.ts
git commit -m "refactor(ProTable): setRowOrder cast 收敛到 castToRecordArray（M4）"
```

---

### Task 10: 抽 _utils/pickDefined 公共工具（M 公共）

**Files:**
- Create: `src/components/ProTable/composables/_utils/pickDefined.ts`
- Modify: `src/components/ProTable/composables/useTableCapabilities.ts:72-78, 98, 106-113, 122-124` 等多处
- Modify: `src/components/ProTable/composables/useTable.ts`（如有相似逻辑）
- Test: `src/components/ProTable/composables/_utils/pickDefined.spec.ts`

**新建文件**：
```ts
/**
 * 过滤 undefined 字段（exactOptionalPropertyTypes 兼容）。
 *
 * 项目角色：跨 composable 复用的"精确属性选择"工具，避免 spread undefined 字段
 * 触发 TS exactOptionalPropertyTypes 报错。原 useTableCapabilities 内私有实现。
 *
 * @group ProTable 工具
 */
export function pickDefined<T extends object>(
  src: T,
  keys: readonly (keyof T)[]
): Partial<T> {
  const out: Partial<T> = {}
  for (const k of keys) {
    if (src[k] !== undefined) out[k] = src[k]
  }
  return out
}

/**
 * 收敛 boolean|Config 形态为 Config 形式
 */
export function asConfig<T extends object>(
  v: boolean | T | undefined,
  fallback: T
): T {
  return typeof v === 'object' && v !== null ? v : fallback
}
```

**useTableCapabilities.ts 顶部 import 替换**（72-78 行删除私有实现，引用 _utils）。

**Commit**:
```bash
git add src/components/ProTable/composables/_utils/pickDefined.ts src/components/ProTable/composables/useTableCapabilities.ts src/components/ProTable/composables/_utils/pickDefined.spec.ts
git commit -m "refactor(ProTable): 抽 pickDefined + asConfig 到 _utils 公共工具"
```

---

### Task 11: getTbody 抽 useTableEngineDom composable（M5）

**Files:**
- Create: `src/components/ProTable/composables/useTableEngineDom.ts`
- Create: `src/components/ProTable/composables/useTableEngineDom.spec.ts`
- Modify: `src/components/ProTable/ProTable.vue:108-112` → 调用 composable
- Modify: `src/components/ProTable/composables/useTableCapabilities.ts:151-156` → 接收 composable 输出

**新建文件**：
```ts
/**
 * 表格引擎 DOM 访问层 composable —— 把 ProTable.vue 模板 ref 转 tbody DOM 的内联查询抽出来。
 *
 * 项目角色：v2.1 行拖拽（useRowDrag）需要 .el-table__body tbody DOM 挂载点。
 * 当前实现散落在 ProTable.vue setup 阶段，违反"composable 单文件 ≤80 行 + 单职责"。
 *
 * @see useRowDrag 消费方
 * @group ProTable composables
 */
import { type ComponentPublicInstance, type Ref } from 'vue'

export interface UseTableEngineDomOptions {
  /** ProTable 模板 ref（ElementTableBody / VxeTableBody 实例） */
  proTableEl: Ref<{
    $el?: HTMLElement
    elTable?: ComponentPublicInstance | null
  } | null>
}

export interface UseTableEngineDomReturn {
  /** 获取当前引擎的 tbody DOM（行拖拽挂载点） */
  getTbody: () => HTMLElement | null
}

export function useTableEngineDom(
  options: UseTableEngineDomOptions
): UseTableEngineDomReturn {
  function getTbody(): HTMLElement | null {
    const root = options.proTableEl.value?.$el
    if (!root || typeof root.querySelector !== 'function') return null
    return root.querySelector('.el-table__body tbody') as HTMLElement | null
  }
  return { getTbody }
}
```

**ProTable.vue 修改**：
```ts
import { useTableEngineDom } from './composables/useTableEngineDom'

// 替换 108-112 行内联 getTbody
const { getTbody } = useTableEngineDom({ proTableEl })

const { rowEdit, treeData, cellSpan, v2Expose } = useTableCapabilities({
  // ...
  getTbody,  // 直接传 composable 输出
})
```

**Commit**:
```bash
git add src/components/ProTable/composables/useTableEngineDom.ts src/components/ProTable/composables/useTableEngineDom.spec.ts src/components/ProTable/ProTable.vue src/components/ProTable/composables/useTableCapabilities.ts
git commit -m "refactor(ProTable): 抽 useTableEngineDom composable 收敛 DOM 访问（M5）"
```

---

## Phase 4 — LOW 完善

### Task 12: console.error 加上下文（L1）

**Files:**
- Modify: `src/components/ProTable/composables/useTable.ts:87`

**修复**：
```ts
function assertValidResponse<T extends object>(
  result: ProTableResponse<T>,
  context: { tableKey?: string; timestamp?: number } = {}
): void {
  if (!result || !Array.isArray(result.data) || typeof result.total !== 'number') {
    const ts = context.timestamp ?? Date.now()
    const ctx = context.tableKey ? `[tableKey=${context.tableKey}]` : '[no-tableKey]'
    const message = `[ProTable]${ctx}@${ts} responseAdapter 返回值结构非法：期望 { data: T[], total: number }`
    console.error(message, result)
    throw new Error(message)
  }
}
```

**调用方同步修改**（useTable.ts:132）：
```ts
onSuccess: (result) => {
  const adapted = props.responseAdapter ? props.responseAdapter(result) : result
  assertValidResponse(adapted, { tableKey: props.tableKey })
  // ...
}
```

**Commit**:
```bash
git add src/components/ProTable/composables/useTable.ts
git commit -m "chore(ProTable): assertValidResponse 加 tableKey + timestamp 上下文（L1）"
```

---

### Task 13: ARCHITECTURE 增量更新至 v3.0（L2）

**Files:**
- Modify: `src/components/ProTable/ARCHITECTURE.md`

**修改要点**：
- 标题加 v3.0 版本号
- "## 数据流" mermaid 增补 v3.0 能力
- "## Composables 依赖" 表加 useSummary / useVirtualScroll / useTableEngineDom / _utils
- "## 状态归属" 表加 summaryRows / virtualized / groupedColumns
- "## 引擎切换" mermaid 更新 vxe 已支持树形/拖拽的矩阵
- "## 错误处理" 加 v3.0 错误码表
- "## 文件清单" 增补 7 个新文件

**Commit**:
```bash
git add src/components/ProTable/ARCHITECTURE.md
git commit -m "docs(ProTable): ARCHITECTURE.md 增量更新至 v3.0（L2）"
```

---

### Task 14: 命名工程化（L3）

**Files:**
- Modify: 全文搜索替换
  - `isVxe` → `isVxeEngine`（useTableCapabilities.ts:92, 173, 176, 180, 187）
  - `v2Expose` → `extendedExpose`（useTableCapabilities.ts:50-58, 204-248, 250）
  - `loose` → 删除（Phase 3 Task 8 已消除）

**替换示例**（useTableCapabilities.ts）：
```ts
// 92 行：const isVxe = options.engine?.value === 'vxe-table'
// 改为：const isVxeEngine = options.engine?.value === 'vxe-table'

// 173-194 行 validateCapabilities 内 if (isVxe ...) 同步改
```

**Commit**:
```bash
git add src/components/ProTable/composables/useTableCapabilities.ts src/components/ProTable/ProTable.vue
git commit -m "refactor(ProTable): 命名工程代号去工程化 isVxeEngine / extendedExpose（L3）"
```

---

### Task 15: 模板内联箭头函数提取（L4）

**Files:**
- Modify: `src/components/ProTable/ProTable.vue:295-298, 316-318`

**修复**：
```ts
// 新增 methods（setup 末尾）
function handleCellDblClick(rowKey: string | number): void {
  rowEdit?._start(rowKey)
}
function handleExpandToggle(rowKey: string | number): void {
  treeData && void treeData.toggle(rowKey)
}
```

**模板替换**：
```vue
<!-- ElementTableBody / VxeTableBody 替换 -->
@cell-dblclick="handleCellDblClick"
@expand-toggle="handleExpandToggle"
```

**Commit**:
```bash
git add src/components/ProTable/ProTable.vue
git commit -m "refactor(ProTable): 模板内联箭头函数提取为方法（L4）"
```

---

### Task 16: cast 陷阱抽 README（L5）

**Files:**
- Modify: `src/components/ProTable/README.md`（已有 → 加新章节）

**新增章节**（README.md 末尾追加）：
```markdown
## 常见 TypeScript 陷阱

### ProTableProps<T> 透传到非泛型组件

T 未解析时 ProColumn<T> 双向均不可赋值（TS bivariance 仅对具体类型生效）。
处理方式：组件声明 `generic="T extends object = Record<string, unknown>"`，
模板绑定处经 `as ProColumn[]` cast 收口（运行时同一引用）。

### useColumns 内部 cast 集中点

`useColumns.ts` 内 `col.hidden = ref(!isHidden(col))` 的 cast 原因：
- `Ref<ProColumn[]>.value` 经 `UnwrapRef` 把 hidden 的 `Ref<boolean>` 解成 boolean
- exactOptionalPropertyTypes 排除 undefined
- 还原为 ProColumn 类型后按公开声明赋值

详见 `useColumns.ts:170-174` 的 inline 注释。
```

**Commit**:
```bash
git add src/components/ProTable/README.md
git commit -m "docs(ProTable): README 新增 TypeScript 陷阱章节（L5）"
```

---

## Phase 5 — 能力扩展（4 个能力）

### Task 17: useSummary composable + SummaryRow 组件（5a）

**Files:**
- Create: `src/components/ProTable/composables/useSummary.ts`
- Create: `src/components/ProTable/composables/useSummary.spec.ts`
- Create: `src/components/ProTable/components/SummaryRow.vue`
- Create: `src/components/ProTable/components/SummaryRow.spec.ts`
- Modify: `src/components/ProTable/types/index.ts`（加 SummaryConfig / ColumnSummaryConfig）
- Modify: `src/components/ProTable/composables/useTableCapabilities.ts`（实例化 useSummary）
- Modify: `src/components/ProTable/ProTable.vue`（v-bind 透传 summary）
- Modify: `src/components/ProTable/components/ElementTableBody.vue`（接收 summary 配置）
- Modify: `src/components/ProTable/components/VxeTableBody.vue`（接收 summary 配置）

**R4 决策**：客户端聚合（columns 声明聚合函数，不依赖后端）

**types/index.ts 新增**：
```ts
/** 单列聚合类型 @group ProTable 类型 */
export type SummaryAggregate = 'sum' | 'avg' | 'count' | 'max' | 'min'

/** 单列聚合配置 @group ProTable 类型 */
export interface ColumnSummaryConfig {
  /** 聚合类型 */
  aggregate: SummaryAggregate
  /** 自定义格式化（默认：保留 2 位小数 + 千分位） */
  formatter?: (value: number, rows: Record<string, unknown>[]) => string
  /** 标签前缀（默认："合计"） */
  label?: string
}

/** ProTable 汇总行配置 @group ProTable 类型 */
export interface SummaryConfig {
  /** 显示在表格底部 */
  position?: 'bottom' | 'top'
  /** 哪些列参与汇总（按 prop 声明，未声明列不显示） */
  columns?: Record<string, ColumnSummaryConfig>
  /** 整行 label（如"合计"、"本页汇总"） */
  label?: string
}

// ProTableProps 加：
enableSummary?: boolean | SummaryConfig
```

**useSummary.ts**：
```ts
/**
 * useSummary —— 客户端汇总行计算（v3.0 新增能力）
 *
 * 职责：
 * - 根据 columns 声明的聚合函数（sum/avg/count/max/min）计算底部汇总行
 * - data 变化时自动重算（watch table.data）
 * - 输出 summaryRows: Ref<Record<string, string | number>[]>
 *
 * @see [`./useCellSpan`](./useCellSpan.ts) 同模式的可计算型 composable
 * @group ProTable composables
 */
import { computed, watch, type Ref } from 'vue'
import type { ProColumn, SummaryConfig } from '../types'

export interface UseSummaryOptions<T extends object = Record<string, unknown>> {
  columns: Ref<ProColumn<T>[]>
  data: Ref<T[] | null>
  config: SummaryConfig
}

export interface UseSummaryReturn {
  /** 汇总行数据（顺序匹配 columns 数组） */
  summaryRows: Ref<Record<string, string | number>[]>
  /** 列级汇总配置（按 prop 索引） */
  columnSummary: Ref<Map<string, NonNullable<SummaryConfig['columns']>[string]>>
}

export function useSummary<T extends object = Record<string, unknown>>(
  options: UseSummaryOptions<T>
): UseSummaryReturn {
  // ... 实现细节略（聚合函数 + watch data 重算）
}
```

**SummaryRow.vue**（BEM 命名 `pro-table-summary`）：
```vue
<script setup lang="ts" generic="T extends object = Record<string, unknown>">
import type { ProColumn } from '../types'

const props = defineProps<{
  columns: ProColumn<T>[]
  rows: Record<string, string | number>[]
}>()

const bem = createNamespace('pro-table-summary')
</script>

<template>
  <tr :class="bem.b()">
    <td v-for="(col, idx) in columns" :key="col.prop" :class="bem.e('cell')">
      <template v-for="(row, rIdx) in rows" :key="rIdx">
        <div v-if="idx === 0" :class="bem.e('label')">{{ row[col.prop] }}</div>
        <div v-else>{{ row[col.prop] }}</div>
      </template>
    </td>
  </tr>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-pro-table-summary {
  background-color: var(--el-fill-color-light);
  font-weight: 600;

  &__cell {
    padding: 8px 12px;
    border-top: 2px solid var(--el-border-color);
  }

  &__label {
    color: var(--el-text-color-secondary);
  }
}
</style>
```

**useTableCapabilities.ts 修改**（新能力实例化）：
```ts
import { useSummary } from './useSummary'

const summary = props.enableSummary
  ? useSummary({
      columns: columns.allColumns as Ref<ProColumn[]>,
      data: table.data as unknown as Ref<Record<string, unknown>[]>,
      config: typeof props.enableSummary === 'object' ? props.enableSummary : {},
    })
  : null

return { rowEdit, treeData, cellSpan, rowDrag, summary, v2Expose }
```

**ProTable.vue 模板透传**：
```vue
<ElementTableBody
  v-if="engineRef === 'element-plus'"
  :rows="..."
  :summary="summary"
  ...
/>
```

**Commit**：
```bash
git add src/components/ProTable/composables/useSummary.ts src/components/ProTable/composables/useSummary.spec.ts src/components/ProTable/components/SummaryRow.vue src/components/ProTable/components/SummaryRow.spec.ts src/components/ProTable/types/index.ts src/components/ProTable/composables/useTableCapabilities.ts src/components/ProTable/ProTable.vue src/components/ProTable/components/ElementTableBody.vue src/components/ProTable/components/VxeTableBody.vue
git commit -m "feat(ProTable): v3.0 新增 useSummary 客户端汇总行能力（5a）"
```

---

### Task 18: useVirtualScroll composable（5b）

**Files:**
- Create: `src/components/ProTable/composables/useVirtualScroll.ts`
- Create: `src/components/ProTable/composables/useVirtualScroll.spec.ts`
- Modify: `src/components/ProTable/types/index.ts`（加 virtualized?: boolean | { rowHeight?: number; overscan?: number }）
- Modify: `src/components/ProTable/components/ElementTableBody.vue`（启用 el-table-v2 虚拟滚动）
- Modify: `src/components/ProTable/components/VxeTableBody.vue`（vxe 虚拟滚动）
- Modify: `src/components/ProTable/composables/useTableCapabilities.ts`（实例化 + 启动校验禁用行内编辑）

**R2 决策**：启用虚拟滚动时禁用行内编辑（启动 warn）

**types/index.ts 新增**：
```ts
/** 虚拟滚动配置 @group ProTable 类型 */
export interface VirtualScrollConfig {
  /** 行高（像素） */
  rowHeight?: number
  /** 预渲染行数（默认 10） */
  overscan?: number
}

// ProTableProps 加：
virtualized?: boolean | VirtualScrollConfig
```

**useVirtualScroll.ts**：
```ts
/**
 * useVirtualScroll —— 虚拟滚动配置包装（v3.0 新增能力）
 *
 * 职责：
 * - 收敛 boolean|Config 形态为 Config
 * - 提供 el-table-v2 / vxe 兼容的配置适配
 * - 启用时触发 warn 禁用行内编辑
 *
 * @group ProTable composables
 */
import { computed, type Ref } from 'vue'
import type { ProTableProps, TableEngine, VirtualScrollConfig } from '../types'

export interface UseVirtualScrollOptions {
  props: ProTableProps
  engine: Ref<TableEngine>
  enableRowEdit: boolean
}

export interface UseVirtualScrollReturn {
  enabled: Ref<boolean>
  config: Ref<VirtualScrollConfig>
  /** 给 el-table-v2 / vxe 的 props */
  tableProps: Ref<Record<string, unknown>>
}

export function useVirtualScroll(options: UseVirtualScrollOptions): UseVirtualScrollReturn {
  const enabled = computed(() => Boolean(options.props.virtualized))
  const config = computed<VirtualScrollConfig>(() => {
    const v = options.props.virtualized
    return typeof v === 'object' && v !== null ? v : {}
  })

  // R2: 启动校验
  if (enabled.value && options.enableRowEdit && typeof console !== 'undefined') {
    console.warn('[ProTable] 虚拟滚动启用时行内编辑不可用（行索引漂移），enableRowEdit 配置已忽略')
  }

  const tableProps = computed<Record<string, unknown>>(() => {
    if (!enabled.value) return {}
    if (options.engine.value === 'element-plus') {
      // el-table-v2 props 适配
      return {
        rowHeight: config.value.rowHeight ?? 48,
        overscan: config.value.overscan ?? 10,
      }
    }
    // vxe-table
    return {
      'scroll-y': { gt: config.value.overscan ?? 10 },
    }
  })

  return { enabled, config, tableProps }
}
```

**useTableCapabilities.ts 集成**：
```ts
import { useVirtualScroll } from './useVirtualScroll'

const virtualScroll = useVirtualScroll({
  props,
  engine: options.engine ?? ref('element-plus'),
  enableRowEdit: Boolean(props.enableRowEdit),
})

return { rowEdit, treeData, cellSpan, rowDrag, summary, virtualScroll, v2Expose }
```

**Commit**：
```bash
git add src/components/ProTable/composables/useVirtualScroll.ts src/components/ProTable/composables/useVirtualScroll.spec.ts src/components/ProTable/types/index.ts src/components/ProTable/composables/useTableCapabilities.ts src/components/ProTable/components/ElementTableBody.vue src/components/ProTable/components/VxeTableBody.vue
git commit -m "feat(ProTable): v3.0 新增 useVirtualScroll 虚拟滚动能力（5b）"
```

---

### Task 19: 列分组（多级表头）（5c）

**Files:**
- Modify: `src/components/ProTable/types/index.ts`（ProColumn 加 children?: ProColumn<T>[]）
- Create: `src/components/ProTable/components/GroupedHeader.vue`
- Create: `src/components/ProTable/components/GroupedHeader.spec.ts`
- Modify: `src/components/ProTable/composables/useColumns.ts`（处理嵌套排序/过滤/扁平化）
- Modify: `src/components/ProTable/components/ElementTableBody.vue`（递归渲染嵌套列）
- Modify: `src/components/ProTable/components/VxeTableBody.vue`（vxe 多级表头）

**R1 决策**：父子扁平化 — 同列序、同持久化 key

**types/index.ts 修改**：
```ts
export interface ProColumn<T extends object = Record<string, unknown>> {
  // ... 原有字段 ...
  /** 子列（用于多级表头分组；列分组渲染时父列仅显示 children 合并后的表头） */
  children?: ProColumn<T>[]
  /** 分组 ID（持久化键分组用；同组列共享同一 groupKey 时视为同一分组） */
  groupKey?: string
}
```

**useColumns.ts 嵌套处理**：
```ts
/**
 * 扁平化嵌套列：把 ProColumn<T>[].children 拍平为 ProColumn<T>[]，保留父子关系引用。
 * 用于持久化（子列与父列共享同一 groupKey 的 storage key）。
 */
function flattenColumns<T extends object>(cols: ProColumn<T>[]): ProColumn<T>[] {
  const out: ProColumn<T>[] = []
  for (const col of cols) {
    if (col.children?.length) {
      out.push(...flattenColumns(col.children))
    } else {
      out.push(col)
    }
  }
  return out
}
```

**sort / filter / persist 同步支持嵌套**：
```ts
const sortedColumns = computed(() => {
  // R1: 父子扁平化 → 同列序同持久化 key
  const flat = flattenColumns([...allColumns.value])
  // ... 原有排序/过滤逻辑
})
```

**GroupedHeader.vue**（BEM `pro-table-grouped-header`）：
```vue
<script setup lang="ts" generic="T extends object = Record<string, unknown>">
import type { ProColumn } from '../types'

defineProps<{
  columns: ProColumn<T>[]  // 含 children 的嵌套列
}>()

const bem = createNamespace('pro-table-grouped-header')
</script>

<template>
  <!-- 递归渲染嵌套列 -->
  <div :class="bem.b()">
    <template v-for="col in columns" :key="col.prop">
      <div v-if="col.children?.length" :class="bem.e('group')">
        <div :class="bem.e('group-label')">{{ col.label }}</div>
        <GroupedHeader :columns="col.children" />
      </div>
      <div v-else :class="bem.e('leaf')">{{ col.label }}</div>
    </template>
  </div>
</template>
```

**ElementTableBody.vue / VxeTableBody.vue 接收 groupColumns prop**：
```vue
<!-- el-table 多级表头 -->
<el-table-column v-if="col.children?.length" :label="col.label">
  <el-table-column v-for="child in col.children" :key="child.prop" v-bind="elColProps(child)" />
</el-table-column>
<el-table-column v-else v-bind="elColProps(col)" />
```

**Commit**：
```bash
git add src/components/ProTable/types/index.ts src/components/ProTable/components/GroupedHeader.vue src/components/ProTable/components/GroupedHeader.spec.ts src/components/ProTable/composables/useColumns.ts src/components/ProTable/components/ElementTableBody.vue src/components/ProTable/components/VxeTableBody.vue
git commit -m "feat(ProTable): v3.0 新增列分组（多级表头）能力（5c）"
```

---

### Task 20: 单元格编辑 v-model（5d）

**Files:**
- Modify: `src/components/ProTable/types/index.ts`（ColumnEditConfig 加 updateEvent）
- Modify: `src/components/ProTable/components/EditCell.vue`（实现 v-model + blur 同步）
- Modify: `src/components/ProTable/composables/useRowEdit.ts`（接收 updateEvent 默认 'blur'）
- Create: `src/components/ProTable/components/EditCell.spec.ts`（追加 v-model 测试）

**R5 决策**：blur 事件同步

**types/index.ts 修改**：
```ts
export interface ColumnEditConfig {
  el: 'input' | 'select' | 'input-number' | string
  props?: Record<string, unknown>
  rules?: Record<string, unknown> | Record<string, unknown>[]
  editable?: boolean | Ref<boolean>
  /**
   * v-model 触发时机（v3.0 新增）：
   * - 'input'（默认）：input 事件即时同步（高频）
   * - 'blur'（推荐）：blur 事件同步，与 ProTable 默认 trigger='blur' 对齐
   */
  updateEvent?: 'input' | 'blur'
}
```

**EditCell.vue v-model 实现**：
```vue
<script setup lang="ts">
import { computed, ref, watch, type Ref } from 'vue'

const props = defineProps<{
  modelValue: unknown
  el: string
  elProps?: Record<string, unknown>
  editable?: boolean | Ref<boolean>
  updateEvent?: 'input' | 'blur'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const localValue = ref(props.modelValue)
watch(() => props.modelValue, (v) => { localValue.value = v })

const isEditable = computed(() => {
  if (typeof props.editable === 'boolean') return props.editable
  if (props.editable && 'value' in props.editable) return Boolean(props.editable.value)
  return true
})

const eventName = computed(() => props.updateEvent ?? 'blur')

function handleUpdate(value: unknown): void {
  if (!isEditable.value) return
  emit('update:modelValue', value)
}
</script>

<template>
  <el-input
    v-if="el === 'input'"
    :model-value="localValue"
    v-bind="elProps"
    @[eventName]="handleUpdate"
  />
  <!-- 其他 el 类型同理 -->
</template>
```

**useRowEdit.ts 修改**：
```ts
interface UseRowEditOptions {
  rowKey: string
  onSave?: (row: Record<string, unknown>, changes: Record<string, unknown>) => boolean | Promise<boolean>
  onSaved?: (row: Record<string, unknown>) => void
  onSaveError?: (row: Record<string, unknown>, error: unknown) => void
  // v3.0 新增：单元格编辑触发时机（默认 'blur'，与 ProTable trigger 对齐）
  updateEvent?: 'input' | 'blur'
}

export function useRowEdit(options: UseRowEditOptions) {
  // ... 内部维护 editingRows Map
  // commitEdit 时遍历该 row 的 columns，每个 col.updateEvent ?? 'blur'
  // 收集 dirty fields → onSave
}
```

**Commit**：
```bash
git add src/components/ProTable/types/index.ts src/components/ProTable/components/EditCell.vue src/components/ProTable/components/EditCell.spec.ts src/components/ProTable/composables/useRowEdit.ts
git commit -m "feat(ProTable): v3.0 单元格编辑支持 v-model + blur 同步（5d）"
```

---

## Phase 6 — Demo 页面

### Task 21: ProTableSummary demo

**Files:**
- Create: `src/modules/demo/examples/ProTable/ProTableSummary.vue`

**实现要点**：
- 演示 4 种聚合（sum / avg / count / max）+ 自定义 formatter
- 集成 mock 数据（mockApi 返回订单数据）
- 集成 ProTable.expose.refresh

**Commit**：
```bash
git add src/modules/demo/examples/ProTable/ProTableSummary.vue
git commit -m "demo(ProTable): 新增 ProTableSummary 演示汇总行（5a demo）"
```

---

### Task 22: ProTableVirtualScroll demo

**Files:**
- Create: `src/modules/demo/examples/ProTable/ProTableVirtualScroll.vue`

**实现要点**：
- mockApi 生成 10 万行数据
- 演示 `virtualized: { rowHeight: 48, overscan: 10 }`
- 演示启用虚拟滚动时行内编辑被 warn（验证 R2 决策）
- 性能埋点：首屏渲染时间 < 1s

**Commit**：
```bash
git add src/modules/demo/examples/ProTable/ProTableVirtualScroll.vue
git commit -m "demo(ProTable): 新增 ProTableVirtualScroll 演示虚拟滚动（5b demo）"
```

---

### Task 23: ProTableGroupedHeader demo

**Files:**
- Create: `src/modules/demo/examples/ProTable/ProTableGroupedHeader.vue`

**实现要点**：
- 演示 2 级表头（如"基础信息"分组下含 name/email/phone，"业务信息"分组下含 status/createdAt）
- 演示分组列与列设置持久化（tableKey + 父子扁平化 R1 验证）
- 演示拖拽列（分组内 + 跨分组）

**Commit**：
```bash
git add src/modules/demo/examples/ProTable/ProTableGroupedHeader.vue
git commit -m "demo(ProTable): 新增 ProTableGroupedHeader 演示列分组（5c demo）"
```

---

### Task 24: ProTableEditCellVModel demo

**Files:**
- Create: `src/modules/demo/examples/ProTable/ProTableEditCellVModel.vue`

**实现要点**：
- 演示 `updateEvent: 'blur'` 与默认 'input' 对比
- 演示行内编辑 + onSave 持久化
- 演示 v-model 与 useRowEdit 的双向联动

**Commit**：
```bash
git add src/modules/demo/examples/ProTable/ProTableEditCellVModel.vue
git commit -m "demo(ProTable): 新增 ProTableEditCellVModel 演示单元格 v-model（5d demo）"
```

---

### Task 25: demo 路由注册

**Files:**
- Modify: `src/modules/demo/routes/index.ts`（添加 4 个 demo 路由）
- Modify: `src/modules/demo/components/DemoSidebar.vue`（添加 4 个菜单项）

**Commit**：
```bash
git add src/modules/demo/routes/index.ts src/modules/demo/components/DemoSidebar.vue
git commit -m "demo(ProTable): 注册 4 个 v3.0 新能力 demo 路由 + 菜单"
```

---

## 最终验证

### Task 26: 完整回归

**Files:** 无（仅验证）

**命令**：
```bash
# 单元测试
pnpm test src/components/ProTable/

# 类型校验
pnpm type-check:full

# Lint
pnpm lint

# 测试覆盖率（要求 ≥80%）
pnpm test:coverage

# 生产构建
pnpm build

# 手动验证 demo（4 个新 demo 在 demo 侧边栏可见 + 功能正常）
pnpm dev
# 访问 /demo/pro-table-summary / /demo/pro-table-virtual-scroll
#      /demo/pro-table-grouped-header / /demo/pro-table-edit-cell-v-model
```

**Commit**：
```bash
git tag v3.0-prototype
git log --oneline  # 验证 commit 历史清晰
```

---

## 总提交数预期

| Phase | Task 数 | Commit 数 |
|-------|---------|-----------|
| Phase 1 | 2 | 2 |
| Phase 2 | 3 | 3 |
| Phase 3 | 6 | 6 |
| Phase 4 | 5 | 5 |
| Phase 5 | 4 | 4 |
| Phase 6 | 5 | 5 |
| 验证 | 1 | 1（tag） |
| **合计** | **26** | **26 + 1 tag** |

---

## 风险登记

| # | 风险 | 缓解策略 |
|---|------|---------|
| W1 | Phase 3 M3 消除 loose cast 影响 6 个组件，类型不匹配回归 | 每个组件单独 commit + type-check 验证 |
| W2 | Phase 5a useSummary 聚合函数 O(n) 性能影响大列表（10w+） | useVirtualScroll 协同 + useSummary 文档声明"大列表建议启用虚拟滚动" |
| W3 | Phase 5b el-table-v2 API 与 el-table 差异大 | ElementTableBody.vue 分支：虚拟模式走 v2 组件，原模式走原 el-table |
| W4 | Phase 5c 列分组 + 列设置持久化的 groupKey 冲突 | R1 决策"父子扁平化同 key"统一持久化口径 |
| W5 | Phase 5d blur 同步与 el-form 默认 trigger='change' 不一致 | useRowEdit 文档声明默认 'blur' 与 'input' 两种模式使用场景 |

---

## 文档同步

- [ ] `src/components/ProTable/README.md`：新增"v3.0 新能力"章节
- [ ] `src/components/ProTable/ARCHITECTURE.md`：v3.0 增量（Task 13）
- [ ] `CHANGELOG.md`：v3.0 release notes
- [ ] `CLAUDE.md` §1.6 AutoImport 标识符表：补 `useSummary` / `useVirtualScroll`
- [ ] `CLAUDE.md` §1.5 必用 composable 列表：补上述两个

---

**计划版本**：v1.0
**生成日期**：2026-09-14
**预计完成**：26 个 commit + 1 个 tag
