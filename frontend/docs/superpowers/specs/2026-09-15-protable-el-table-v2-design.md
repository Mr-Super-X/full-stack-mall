# ProTable el-table-v2 真虚拟化能力 v3.0.1 — 设计文档

> **文档版本**：v1.0
> **生成日期**：2026-09-15
> **适用版本**：ProTable v3.0.1
> **目的**：用 el-table-v2 替换现有 v3.0 假虚拟化（仅 CSS overflow），落地真虚拟化能力

---

## 一、背景

ProTable v3.0 在 `useVirtualScroll.ts` 中预留了虚拟滚动能力入口，但**实际并未接入 el-table-v2**——只是给 `el-table v1` 写死 `height: 500` + CSS overflow，由浏览器原生滚动接管。demo `ProTableVirtualScroll.vue` 中已直接承认该限制：

> el-table v1 不支持自动虚拟化（仅高度容器 + CSS overflow）。真虚拟化需切到 el-table-v2，留待 v3.0.1。

实测 v1 引擎在虚拟化下的性能边界：
- 3,000 行 → avgFPS 107（流畅）
- 5,000 行 → avgFPS 93（轻微掉帧）
- 7,000 行 → avgFPS 76（临界）
- 10,000 行 → avgFPS 55（明显卡顿）

10 万行场景下 v1 完全不可用，必须切到 v2 真虚拟化。

---

## 二、目标

1. 在 ProTable 单一组件内落地真虚拟化能力（仍 import ProTable 不变）
2. 启用 `virtualized` prop 时自动切换到 el-table-v2 引擎分支
3. **强隔离**：开启虚拟化时其他能力（行内编辑 / 树形 / 汇总 / 合并 / 拖拽）一律 warn + 忽略
4. demo 升级到 10 万行 × 10 列（含固定列），首屏 < 1s，滚动 avgFPS ≥ 100

---

## 三、范围与非目标

### 范围

- ✅ 新增 `ElementTableV2Body.vue` 组件（包装 `<el-table-v2>`）
- ✅ 升级 `useVirtualScroll.ts` 产出完整 v2 props + 强隔离校验
- ✅ ProTable.vue 渲染分支优先级调整（virtualized > engine）
- ✅ VirtualScrollConfig 类型扩展
- ✅ demo 数据规模扩充 + 验证
- ✅ README/ARCHITECTURE 同步

### 非目标

- ❌ 不改变 ProTable 公共 API（业务代码 import 路径不变）
- ❌ 不在虚拟化模式下实现行内编辑 / 树形 / 汇总 / 合并 / 拖拽（强隔离策略）
- ❌ 不动 vxe-table 引擎分支
- ❌ 不引入新的第三方 npm 包

---

## 四、架构

### 4.1 关键边界决策

```
┌─────────────────────────────────────────────────┐
│  ProTable.vue（编排层）                          │
│  ├─ 检测 virtualScroll.enabled                  │
│  │   ├─ true  → 挂载 <ElementTableV2Body />    │
│  │   └─ false → 原 ElementTableBody / VxeTableBody  │
└─────────────────────────────────────────────────┘
```

判断条件：`engineRef === 'element-plus' && virtualScroll.enabled === true`

### 4.2 文件改动清单

| # | 操作 | 路径 | 预计行数 | 角色 |
|---|------|------|---------|------|
| 1 | 新增 | `src/components/ProTable/components/ElementTableV2Body.vue` | ≤250 | 包装 `<el-table-v2>` + columns cellRenderer 适配 |
| 2 | 新增 | `src/components/ProTable/components/ElementTableV2Body.spec.ts` | ≤120 | mount 渲染 / columns 适配 / selection 事件 |
| 3 | 修改 | `src/components/ProTable/composables/useVirtualScroll.ts` | ≤120 | 升级为完整 v2 props + 强隔离校验 |
| 4 | 修改 | `src/components/ProTable/composables/useVirtualScroll.spec.ts` | ≤180 | 校验矩阵 + props 派生 |
| 5 | 修改 | `src/components/ProTable/ProTable.vue` | ≤460（当前 451 + 10 行分支逻辑） | 渲染分支优先级 |
| 6 | 修改 | `src/components/ProTable/types/index.ts` | +10 行 | VirtualScrollConfig 扩展 |
| 7 | 修改 | `mock/pro-table/big-data.ts` | ≤120 | 10 万行 × 10 列 + 固定列数据 |
| 8 | 修改 | `src/modules/demo/examples/ProTable/ProTableVirtualScroll.vue` | ≤150 | 演示规模 + 文档卡片 |
| 9 | 修改 | `src/components/ProTable/README.md` | +30 行 | v3.0.1 changelog + 强隔离说明 |
| 10 | 修改 | `src/components/ProTable/ARCHITECTURE.md` | +20 行 | 同步架构图 |

### 4.3 关键决策

**决策 1：`ElementTableV2Body` 作为独立组件而非 ElementTableBody 内部分支**
- 原因：ElementTableBody.vue 已 400+ 行，再加 v2 分支会超限
- 独立组件保持单一职责，el-table v1 与 v2 各走各的

**决策 2：强隔离校验集中在 useVirtualScroll 启动期**
- 命中即 console.warn + 标记该能力在 v2 分支失效
- 启动期一次性完成，不污染运行时

**决策 3：虚拟化分支不走 vxe-table**
- 当 engineRef === 'vxe-table' 且 virtualized 启用时 warn + 强制回落 element-plus

---

## 五、数据流与 props 适配

### 5.1 useVirtualScroll 升级后产出

```typescript
{
  enabled: Ref<boolean>,
  config: Ref<VirtualScrollConfig>,
  /** 给 el-table v1 引擎用（虚拟化走 v2 分支时不消费） */
  tableProps: Ref<Record<string, unknown>>,
  /** v3.0.1 新增：给 el-table-v2 引擎分支用 */
  v2TableConfig: Ref<{
    width: number | 'auto',
    height: number,
    estimatedRowHeight: number,
  }>,
}
```

### 5.2 VirtualScrollConfig 扩展

```typescript
export interface VirtualScrollConfig {
  /** 行高 px（默认 48） */
  rowHeight?: number
  /** 预渲染 overscan 行数（默认 10） */
  overscan?: number
  // v3.0.1 新增
  /** 容器高度 px（默认 500） */
  height?: number
  /** 容器宽度：'auto' | number px（v2 不支持百分比，默认 'auto'） */
  width?: number | 'auto'
}
```

### 5.3 ElementTableV2Body.vue props 契约

```typescript
defineProps<{
  rows: Record<string, unknown>[]          // 平铺数据
  columns: ProColumn[]                     // 已 sorted / 已过滤
  rowKey: string
  loading: boolean
  virtualConfig: VirtualScrollConfig
}>()
```

ElementTableV2Body 内部职责：
1. ProColumn[] → el-table-v2 Column[]：生成 key/prop/title/width/cellRenderer
2. cellRenderer 用 `h()` 函数渲染，优先 ProColumn.render 字段
3. fixed 列处理：扫描 columns 中含 `fixed: 'left' | 'right'` 的，标记到 v2 columns
4. 列设置联动：通过响应式 columns 消费 useColumns.visibleKeys / columnOrder

### 5.4 ProTable.vue 渲染分支

```vue
<template>
  <ElementTableV2Body
    v-if="engineRef === 'element-plus' && virtualScroll?.enabled"
    :rows="(table.data.value ?? []) as Record<string, unknown>[]"
    :columns="sortedColumnsNonGeneric"
    :row-key="props.rowKey"
    :loading="table.loading.value && hasTableMounted"
    :virtual-config="virtualScroll?.config.value ?? {}"
    @selection-change="handleSelectionChange"
  />
  <ElementTableBody v-else-if="engineRef === 'element-plus'" ... />
  <VxeTableBody v-else ... />
</template>
```

### 5.5 关键约束

- cellRenderer 函数式渲染：`(props: { rowData, column, rowIndex, columnIndex }) => VNode`
- ProColumn 已有的 render / cellRenderer 字段优先；否则默认 `row[prop]` 文本渲染
- 列设置隐藏：通过 useColumns.visibleKeys 过滤 columns
- 列重排：通过 useColumns.columnOrder 排序 columns

---

## 六、强隔离校验与冲突策略

### 6.1 校验矩阵

useVirtualScroll 启动期一次性遍历：

| 其他能力 prop | el-table-v2 支持 | 行为 |
|--------------|-----------------|------|
| `enableRowEdit` | ❌ 行索引漂移破坏 edit state | warn + v2 分支禁用编辑 |
| `enableTree` | ❌ 无 tree-props | warn + v2 分支按平铺处理 |
| `enableSummary` | ❌ 无 show-summary | warn + v2 分支无 footer |
| `enableCellSpan` | ❌ 无 span-method | warn + v2 分支不合并 |
| `enableRowDrag` | ❌ Sortable.js 找不到 tbody | warn + v2 分支无拖拽 |
| `tableEngine === 'vxe-table'` | ❌ 虚拟化只走 el-table-v2 | warn + 强制回落 element-plus |

### 6.2 校验实现

```typescript
function validateIsolation(): void {
  if (!enabled.value) return

  if (options.engine.value === 'vxe-table') {
    console.warn('[ProTable] virtualized + tableEngine="vxe-table" 不兼容，自动回落到 element-plus 引擎')
    options.engine.value = 'element-plus'
    return
  }

  const conflicts: string[] = []
  if (options.enableRowEdit) conflicts.push('enableRowEdit')
  if (options.props.enableTree) conflicts.push('enableTree')
  if (options.props.enableSummary) conflicts.push('enableSummary')
  if (options.props.enableCellSpan) conflicts.push('enableCellSpan')
  if (options.props.enableRowDrag) conflicts.push('enableRowDrag')

  if (conflicts.length > 0) {
    console.warn(
      `[ProTable] virtualized 模式下以下能力被忽略: ${conflicts.join(', ')}`
    )
  }
}
```

### 6.3 用户行为约定

- 不阻断渲染：警告只是提示，虚拟化分支仍正常渲染
- 不修改 props：保持单向数据流
- 统一前缀：`[ProTable]` 前缀让用户能在 console 一键 filter

### 6.4 单元测试用例

```
- 启用 virtualized + enableRowEdit → warn 包含 'enableRowEdit'
- 启用 virtualized + enableTree → warn 包含 'enableTree'
- 启用 virtualized + enableSummary → warn 包含 'enableSummary'
- 启用 virtualized + enableCellSpan → warn 包含 'enableCellSpan'
- 启用 virtualized + enableRowDrag → warn 包含 'enableRowDrag'
- 启用 virtualized + engineRef vxe → engine 回落 element-plus + warn
- 启用 virtualized 且全部能力关闭 → 无 warn
- 未启用 virtualized + 任意能力 → 无 warn
```

---

## 七、Demo 与文档同步

### 7.1 Demo 改造：`ProTableVirtualScroll.vue`

**核心目标**：演示 10 万行 × 10 列的真实虚拟化效果（替代现有 3000 行 × 3 列 demo）。

### 7.2 数据模型

```typescript
interface BigRow {
  id: number            // 固定列
  name: string
  email: string
  department: string    // 固定列
  status: 'active' | 'inactive'
  score: number
  city: string
  joinDate: string
  level: number
  remark: string
}
```

mock 数据规模：100,000 行 × 10 列。固定列：`id`（左）、`department`（左）。

### 7.3 Demo 区块布局

```
┌──────────────────────────────────────────────┐
│ §1 基础演示：10 万行 × 10 列                 │
│   - 列设置：勾选/重排（保持能力）            │
│   - 排序：按 score / level 服务端排序        │
│   - 搜索：name 模糊搜索（分页走 pageSize=∞） │
├──────────────────────────────────────────────┤
│ §2 已知限制                                  │
│   - 启用时如同时开启 enableSummary → warn    │
│   - 行内编辑不可用（截图演示对比）           │
├──────────────────────────────────────────────┤
│ §3 性能埋点                                  │
│   - 首屏渲染 < 1s                            │
│   - 滚动 avgFPS ≥ 100                        │
│   - 内存占用对比（v1 vs v2）                 │
└──────────────────────────────────────────────┘
```

### 7.4 mock 数据生成

`mock/pro-table/big-data.ts` 改造：

```typescript
export interface BigRow { id, name, email, ... }  // 10 个字段

export const bigDataRequestApi = async (params: ListRequest): Promise<{ list: BigRow[]; total: number }> => {
  const filtered = filterByKeyword(allRows, params.keyword)
  const sorted = sortByField(filtered, params.orderBy)
  const sliced = sorted.slice((params.pageIndex - 1) * params.pageSize, params.pageIndex * params.pageSize)
  return { list: sliced, total: allRows.length }
}

// 模块级一次性生成 10 万行（mock 阶段直接全量返回，不分页）
const allRows: BigRow[] = Array.from({ length: 100_000 }, (_, i) => ({ ... }))
```

### 7.5 demo 关键交互点

1. **顶部控件**：列设置抽屉按钮 + 密度切换按钮（验证虚拟化下密度切换响应）
2. **主表格**：启用虚拟化，10 万行单页（pageSize=100000 或 pagination={false}）；列固定：ID 左固定、Department 左固定；列设置：可隐藏 remark 列
3. **底部说明卡片**：当前仅保留：列设置 / 排序 / 搜索 / 密度切换；已禁用：行内编辑 / 树形 / 汇总 / 合并 / 拖拽
4. **性能指标展示**：首屏渲染耗时、滚动 10s 平均 FPS

### 7.6 文档同步

| 文件 | 改动 |
|------|------|
| `README.md` | v3.0.1 changelog：新增 el-table-v2 真虚拟化能力 + 强隔离策略说明 |
| `ARCHITECTURE.md` | 同步架构图：v2 分支作为 element-plus 引擎的子路径 |
| `useVirtualScroll.ts` 顶部 JSDoc | 改写"虚拟滚动配置包装"→"虚拟滚动引擎分支（el-table-v2）" + 强隔离说明 |
| `ElementTableV2Body.vue` 顶部 JSDoc | 完整职责说明 + 已知限制 |

### 7.7 验证脚本

- vitest 用例：useVirtualScroll 校验矩阵
- 浏览器手动验证：
  1. 进入 `/demo/pro-table-virtual-scroll`，首屏渲染 < 1s
  2. 滚动到底部，平均 FPS ≥ 100
  3. 打开列设置 → 隐藏 remark 列 → 表格刷新正常
  4. 拖拽列设置中的列重排 → 表格列序变化
  5. console 无报错（仅可能有预期的 warn）

---

## 八、关键文件结构

### 8.1 ElementTableV2Body.vue 骨架

```vue
<script setup lang="ts">
import { computed, h, type VNode } from 'vue'
import { ElTableV2 } from 'element-plus'
import type { ProColumn, VirtualScrollConfig } from '../types'

const props = defineProps<{
  rows: Record<string, unknown>[]
  columns: ProColumn[]
  rowKey: string
  loading: boolean
  virtualConfig: VirtualScrollConfig
}>()

const emit = defineEmits<{
  (e: 'selection-change', rows: Record<string, unknown>[]): void
}>()

// columns 适配：ProColumn → el-table-v2 Column
const v2Columns = computed(() => props.columns.map((col) => ({
  key: col.prop,
  prop: col.prop,
  title: col.label,
  width: col.width ?? 120,
  minWidth: col.minWidth,
  fixed: col.fixed,
  align: col.align ?? 'left',
  cellRenderer: ({ rowData, column, rowIndex }: any) => renderCell(col, rowData, rowIndex),
  headerCellRenderer: ({ column }: any) => h('span', column.title),
})))

// 容器尺寸
const containerWidth = computed(() => props.virtualConfig.width === 'auto' ? undefined : (props.virtualConfig.width ?? 800))
const containerHeight = computed(() => props.virtualConfig.height ?? 500)

function renderCell(col: ProColumn, row: Record<string, unknown>, rowIndex: number): VNode {
  // 优先用 ProColumn.render（业务自定义渲染）
  if (typeof col.render === 'function') {
    return col.render({ row, column: col, rowIndex, value: row[col.prop!] })
  }
  // 默认文本渲染
  return h('span', String(row[col.prop!] ?? ''))
}
</script>

<template>
  <ElTableV2
    :columns="v2Columns"
    :data="props.rows"
    :width="containerWidth"
    :height="containerHeight"
    :estimated-row-height="props.virtualConfig.rowHeight ?? 48"
    :row-key="props.rowKey"
    :loading="props.loading"
    fixed
    @selection-change="(rows: any) => emit('selection-change', rows)"
  />
</template>
```

### 8.2 useVirtualScroll.ts 关键结构

```typescript
export function useVirtualScroll(options: UseVirtualScrollOptions): UseVirtualScrollReturn {
  const enabled = computed(() => Boolean(options.props.virtualized))
  const config = computed<VirtualScrollConfig>(() => /* 与现状一致 */)

  // 新增：强隔离校验
  validateIsolation(options, enabled.value)

  // 新增：v2 完整 props
  const v2TableConfig = computed(() => ({
    width: config.value.width ?? 800,
    height: typeof config.value.height === 'number' ? config.value.height : 500,
    estimatedRowHeight: config.value.rowHeight ?? 48,
  }))

  // 保留：引擎差异化 tableProps（v1 引擎用，v2 分支不用）
  const tableProps = computed<Record<string, unknown>>(() => /* 与现状一致 */)

  return { enabled, config, tableProps, v2TableConfig }
}
```

---

## 九、测试覆盖目标

| 文件 | 测试用例数 | 覆盖目标 |
|------|-----------|----------|
| `useVirtualScroll.spec.ts` | 8-10 | enabled / config 派生 / 强隔离校验 / v2 props |
| `ElementTableV2Body.spec.ts` | 4-5 | mount 渲染 / columns 转换 / selection 事件 / 默认 render |

覆盖率目标：≥80%（沿用项目 §4 #11 约束）

---

## 十、依赖与风险

### 10.1 依赖

- 不需要新增第三方 npm 包（element-plus 已在项目依赖，ElTableV2 在 2.14 已暴露）

### 10.2 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| el-table-v2 列宽与 ProColumn 默认宽度不匹配 | 中 | 列错位 | 默认 width=120，未声明宽度的列不会被压扁 |
| cellRenderer 业务自定义渲染类型与 ProColumn.render 不一致 | 低 | 渲染异常 | ProColumn.render 已是 h() 函数，el-table-v2 cellRenderer 也是 h() 函数，签名兼容 |
| 固定列 fixed 实现细节差异 | 中 | 列错位 | 在 demo 中加 `fixed` 列验证 |
| useVirtualScroll 是 setup 时一次性校验，与 props 后改时机不一致 | 低 | 错过校验 | 维持 setup 校验（与现状一致） |

---

**Spec 完成。请审阅后告知是否进入 writing-plans 阶段。**
