# 组件契约审计报告

> 生成时间：2026-09-20
> 项目：D:\personal\github\vue3工程模板\vue3-vite-project
> 审计范围：5 大核心全局组件的 Props / Emits / Slots / defineExpose / 默认值 / TODO 与文档的逐项对照
> 审计员：general-purpose 代理（仅读，无源码/文档修改）

---

## 0. 摘要

| 组件           | Props 缺失 | Emits 缺失 | Slots 缺失   | expose 缺失 | 默认值错误 | 总计                       |
| -------------- | ---------- | ---------- | ------------ | ----------- | ---------- | -------------------------- |
| ProTable       | 0          | 3          | 多处说明不全 | 1           | 0          | **4+ 处（CRITICAL/HIGH）** |
| ProDialog      | 0          | 0          | 0            | —           | 0          | 0 ✅                       |
| XForm          | 0          | —          | 1            | 0           | 0          | **1 处（CRITICAL）**       |
| BaseChart      | 0          | —          | 0            | 0           | 0          | 0 ✅                       |
| RichTextEditor | 0          | 0          | 0            | 0           | 0          | 0 ✅                       |

**核心结论**：

- **ProTable 与 XForm 文档存在 CRITICAL 缺漏**（ProTable 整张 Emits 表完全未列出；XForm 的 `toastContainer` slot 未文档化）
- **ProDialog / BaseChart / RichTextEditor 三个组件的契约与文档完全对齐**（✅ 无差异）
- **5 个组件源码均无遗留 TODO/FIXME/HACK 标记**（grep 验证无匹配）

---

## 1. ProTable（`src/components/ProTable/ProTable.vue` + `src/components/ProTable/types/index.ts`）

### 1.1 Props 差异

源码定义：`src/components/ProTable/types/index.ts:544-684`（`ProTableProps<T>` 接口）

| Prop 名                   | 源码定义                                                    | 文档描述（docs/29 §1.2）                                                   | 差异类型                                                                                             |
| ------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `columns`                 | `ProColumn<T>[]` 必填                                       | `ProColumn<T>[]` 必填                                                      | ✅ 一致                                                                                              |
| `requestApi`              | `ProTableRequestApi<T>` 必填                                | `ProTableRequestApi<T>` 必填                                               | ✅ 一致                                                                                              |
| `initParam`               | `Record<string, unknown>` 默认 `{}`                         | `Record<string, unknown>` 默认 `{}`                                        | ✅ 一致                                                                                              |
| `dataCallback`            | `(data: T[]) => T[]`                                        | `(data: T[]) => T[]`                                                       | ✅ 一致                                                                                              |
| `requestError`            | `(error: unknown) => void`                                  | `(error: unknown) => void`                                                 | ✅ 一致                                                                                              |
| `pagination`              | `boolean \| Record<string, unknown>` 默认 `true`            | `boolean \| Record<string, unknown>` 默认 `true`                           | ✅ 一致                                                                                              |
| `sortParamsAdapter`       | `(state: SortState<T>) => Record`                           | `(state: SortState<T>) => Record`                                          | ✅ 一致                                                                                              |
| **`filterParamsAdapter`** | **`(filters: FilterValuesMap) => Record<string, unknown>`** | **完全缺失**                                                               | ❌ **CRITICAL — 核心 prop 缺失**（types/index.ts:569-578 + §7 `FilterParamsAdapter`，v3.5 PR2 新增） |
| `responseAdapter`         | `(raw: unknown) => ProTableResponse<T>`                     | `(raw: unknown) => ProTableResponse<T>`                                    | ✅ 一致                                                                                              |
| `tableEngine`             | `TableEngine` 默认 `'element-plus'`                         | `'element-plus' \| 'vxe-table'` 默认 `'element-plus'`                      | ✅ 一致                                                                                              |
| `tableKey`                | `string`                                                    | `string`                                                                   | ✅ 一致                                                                                              |
| `rowKey`                  | `string`                                                    | `string`                                                                   | ✅ 一致                                                                                              |
| `pageSize`                | `number` 默认 `10`                                          | `number` 默认 `10`                                                         | ✅ 一致                                                                                              |
| `searchRows`              | `number` 默认 `3`                                           | `number` 默认 `3`                                                          | ✅ 一致                                                                                              |
| `density`                 | `TableDensity` 默认 `'default'`                             | `'compact' \| 'default' \| 'loose'` 默认 `'default'`                       | ✅ 一致                                                                                              |
| `enableRowEdit`           | `boolean \| RowEditConfig`                                  | `boolean \| RowEditConfig`                                                 | ✅ 一致                                                                                              |
| `enableTree`              | `boolean \| TreeConfig`                                     | `boolean \| TreeConfig`                                                    | ✅ 一致                                                                                              |
| `enableCellSpan`          | `boolean \| CellSpanConfig`                                 | `boolean \| CellSpanConfig`                                                | ✅ 一致                                                                                              |
| `enableRowDrag`           | `boolean \| RowDragConfig`                                  | `boolean \| RowDragConfig`                                                 | ✅ 一致                                                                                              |
| `enableSummary`           | `boolean \| SummaryConfig`                                  | `boolean \| SummaryConfig`                                                 | ✅ 一致                                                                                              |
| `virtualized`             | `boolean \| VirtualScrollConfig`                            | `boolean \| VirtualScrollConfig`                                           | ✅ 一致                                                                                              |
| `autoHeight`              | `boolean \| AutoHeightConfig`                               | `boolean \| AutoHeightConfig`                                              | ✅ 一致                                                                                              |
| `statePersist`            | `boolean` 默认 `false`                                      | `boolean` 默认 `false`                                                     | ✅ 一致                                                                                              |
| `columnResize`            | `boolean` 默认 `false`                                      | `boolean` 默认 `false`                                                     | ✅ 一致                                                                                              |
| `searchDisplay`           | `(params) => Record<string, boolean>`                       | `(params) => Record<string, boolean>`                                      | ✅ 一致                                                                                              |
| `searchLayout`            | `SearchLayoutMode` 默认 `'auto'`                            | `'auto' \| 'flat' \| 'collapse' \| 'flat-large' \| 'drawer'` 默认 `'auto'` | ✅ 一致                                                                                              |
| `showSelectedTags`        | `boolean` 默认 `true`                                       | `boolean` 默认 `true`                                                      | ✅ 一致                                                                                              |
| `expandedStatePersist`    | `boolean` 默认 `false`                                      | `boolean` 默认 `false`                                                     | ✅ 一致                                                                                              |
| `toolbar`                 | `ToolbarAction<T>[]`                                        | `ToolbarAction<T>[]`                                                       | ✅ 一致                                                                                              |
| `selectionBarActions`     | `ToolbarAction<T>[]`                                        | `ToolbarAction<T>[]`                                                       | ✅ 一致                                                                                              |
| `maxVisibleActions`       | `number` 默认 `3`                                           | `number` 默认 `3`                                                          | ✅ 一致                                                                                              |

**Props 小计**：30 个源码 prop，文档覆盖 29 个，**缺失 1 个（filterParamsAdapter，CRITICAL）**

### 1.2 Emits 差异

源码定义：`src/components/ProTable/ProTable.vue:109-116`

```typescript
const emit = defineEmits<{
  (e: 'sort-change', payload: SortState<T> | null): void
  (e: 'filter-change', payload: Record<string, (string | number | boolean)[]>): void
  (e: 'engine-fallback', reason: string): void
}>()
```

| Emit 名               | 源码签名                                                         | 文档描述                                             | 差异类型                                                                                                 |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **`sort-change`**     | `(payload: SortState<T> \| null) => void`                        | **§5.2 提及（@sort-change）但无完整 Emits 表**       | ⚠️ MEDIUM — 未提供独立事件表（grep docs/29 `getFilterState\|filter-change\|filterParamsAdapter` 无匹配） |
| **`filter-change`**   | `(payload: Record<string, (string\|number\|boolean)[]>) => void` | **完全缺失**                                         | ❌ **CRITICAL — v3.5 PR2 核心事件未文档化**                                                              |
| **`engine-fallback`** | `(reason: string) => void`                                       | **完全缺失**（仅 §6.3 引擎回退章节文字提及，无签名） | ❌ **CRITICAL — 引擎回退联动事件未文档化**                                                               |

**Emits 小计**：3 个源码 emit，文档完全无独立 Emits 表 → **3 个全部缺失（CRITICAL ×2 + MEDIUM ×1）**

### 1.3 Slots 差异

源码定义：模板见 `src/components/ProTable/ProTable.vue:524-722`，散落于 SearchForm / SelectedTags / TableHeader / SelectionBar / AsyncState / ElPagination 子组件挂载点

| Slot 名                                  | 源码位置                               | 文档描述（docs/29 §9.4、§10）                                   | 差异类型               |
| ---------------------------------------- | -------------------------------------- | --------------------------------------------------------------- | ---------------------- |
| `tableHeader`                            | ProTable.vue:585（透传给 TableHeader） | §9.4 提及（"slot 作用域增强"），✅                              | ✅                     |
| `toolButton`                             | ProTable.vue:588                       | §9.4 提及，✅                                                   | ✅                     |
| `empty`                                  | ProTable.vue:688                       | §10 "空数据" 隐含提及但未列独立 slot 表                         | ⚠️ MEDIUM — 未独立列名 |
| `paginationLeft`                         | ProTable.vue:704                       | 完全未文档化                                                    | ❌ **MEDIUM**          |
| `paginationRight`                        | ProTable.vue:707                       | 完全未文档化                                                    | ❌ **MEDIUM**          |
| `operation` / `expand` / `search-[prop]` | ProTable.vue:651 透传任意业务插槽      | §2.5 提及 `operation` / `expand`，§4.2 提及 `search-[prop]`，✅ | ✅                     |
| `selectionBar`                           | ProTable.vue:603-604                   | §9.3 提及 ✅                                                    | ✅                     |

**Slots 小计**：源码 8+ 个具名插槽 + 任意业务插槽（dynamic `v-for` $slots 透传）。文档覆盖主流程（`operation` / `expand` / `search-[prop]` / `tableHeader` / `toolButton` / `selectionBar`），**`empty` / `paginationLeft` / `paginationRight` 三个 slot 未独立文档化**。

### 1.4 defineExpose 差异

源码定义：`src/components/ProTable/ProTable.vue:505-521` + `src/components/ProTable/types/index.ts:693-745`

| Expose 方法                                   | 源码签名                                             | 文档描述（docs/29 §1.3） | 差异类型                                |
| --------------------------------------------- | ---------------------------------------------------- | ------------------------ | --------------------------------------- |
| `refresh()`                                   | `() => Promise<void>`                                | ✅                       | ✅                                      |
| `reset()`                                     | `() => Promise<void>`                                | ✅                       | ✅                                      |
| `getSelectedRows()`                           | `() => T[]`                                          | ✅                       | ✅                                      |
| `clearSelection()`                            | `() => void`                                         | ✅                       | ✅                                      |
| `getSearchParams()`                           | `() => Record<string, unknown>`                      | ✅                       | ✅                                      |
| `setSearchParams(params)`                     | `(params: Record<string, unknown>) => Promise<void>` | ✅                       | ✅                                      |
| `element`                                     | `Ref<ComponentPublicInstance \| null>`               | ✅                       | ✅                                      |
| `engine`                                      | `TableEngine`（getter）                              | ✅                       | ✅                                      |
| `getSortState()`                              | `() => SortState<T> \| null`                         | ✅                       | ✅                                      |
| **`getFilterState()`**                        | **`() => FilterValuesMap`**（v3.5 PR2 新增）         | **完全缺失**             | ❌ **HIGH — v3.5 PR2 新增方法未文档化** |
| `startEdit / cancelEdit / saveEdit`           | `RowEditExpose`                                      | ✅                       | ✅                                      |
| `expandNode / collapseNode / refreshChildren` | `TreeExpose`                                         | ✅                       | ✅                                      |
| `setRowOrder`                                 | `RowDragExpose`                                      | ✅                       | ✅                                      |

**Expose 小计**：14 个方法，文档覆盖 13 个，**缺失 1 个（getFilterState，HIGH）**

### 1.5 源码 TODO/FIXME 列表

`src/components/ProTable/ProTable.vue`：**无匹配**（grep `TODO|FIXME|HACK|XXX` 返回 0）
`src/components/ProTable/types/index.ts`：**无匹配**

### 1.6 子类型差异

| 子类型                  | 源码定义                                                                                     | 文档描述                    | 差异类型                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------- |
| `FilterValue`           | `string \| number \| boolean`（types/index.ts:189）                                          | **未文档化**                | ⚠️ MEDIUM                                      |
| `FilterValuesMap`       | `Record<string, FilterValue[]>`（types/index.ts:202）                                        | **未文档化**                | ⚠️ MEDIUM                                      |
| `FilterParamsAdapter`   | `(filters: FilterValuesMap) => Record<string, unknown>`（types/index.ts:218）                | **未文档化**                | ❌ CRITICAL（同 1.1 filterParamsAdapter prop） |
| `SummaryAggregate`      | `'sum' \| 'avg' \| 'count' \| 'max' \| 'min'`（types/index.ts:79）                           | §7.3 部分提及但无独立类型表 | ⚠️ MEDIUM                                      |
| `ColumnFormatterPreset` | `'dateTime' \| 'date' \| 'time' \| 'amount' \| 'percent' \| 'boolTag'`（types/index.ts:338） | §2.1 字段表简要提及         | ✅ 一致                                        |
| `SearchLevel` 常量      | `SearchLevel.Basic / Advanced`（types/index.ts:124-128）                                     | §2.4 提及常量值             | ✅ 一致                                        |
| `DEFAULT_ROW_KEY`       | `'id'` 常量（types/index.ts:136）                                                            | 未文档化（隐含）            | LOW                                            |

---

## 2. ProDialog（`src/components/common/ProDialog/ProDialog.vue` + `src/components/common/ProDialog/types.ts`）

### 2.1 Props 差异

源码定义：`src/components/common/ProDialog/ProDialog.vue:54-92`（显式 Props 接口）+ `src/components/common/ProDialog/types.ts:31-71`（完整 ProDialogProps = ElDialog 原生透传 + 4 扩展）

| Prop 名                                                                                                                                                                         | 源码定义                                                      | 文档描述（docs/27 §2.1）             | 差异类型 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------ | -------- |
| `modelValue`                                                                                                                                                                    | `boolean` 默认 `false`                                        | `boolean` 默认 `false`               | ✅ 一致  |
| `title`                                                                                                                                                                         | `string` 默认 `''`                                            | `string` 默认 `''`                   | ✅ 一致  |
| `draggable`                                                                                                                                                                     | `boolean` 默认 `true`                                         | `boolean` 默认 `true`                | ✅ 一致  |
| `fullScreen`                                                                                                                                                                    | `boolean` 默认 `false`                                        | `boolean` 默认 `false`               | ✅ 一致  |
| `showFullScreenButton`                                                                                                                                                          | `boolean` 默认 `true`                                         | `boolean` 默认 `true`                | ✅ 一致  |
| `resizable`                                                                                                                                                                     | `boolean` 默认 `false`                                        | `boolean` 默认 `false`               | ✅ 一致  |
| `resizeMinToInitial`                                                                                                                                                            | `boolean` 默认 `false`                                        | `boolean` 默认 `false`               | ✅ 一致  |
| **ElDialog 原生透传 Props**（width / top / modal / showClose / beforeClose / closeOnClickModal / closeOnPressEscape / destroyOnClose / center / alignCenter / appendToBody 等） | `Partial<ElDialogNativeProps>`（types.ts:23）经 `$attrs` 透传 | §2.4 明确说明透传机制，§2.7 钳制规则 | ✅ 一致  |

**Props 小计**：7 个自有 + 全量 ElDialog 透传 = ✅ 完全一致

### 2.2 Emits 差异

源码定义：`src/components/common/ProDialog/ProDialog.vue:94-106` + `src/components/common/ProDialog/types.ts:84-96`

| Emit 名             | 源码签名                          | 文档描述（docs/27 §2.2）          | 差异类型 |
| ------------------- | --------------------------------- | --------------------------------- | -------- |
| `update:modelValue` | `[value: boolean]`                | `(value: boolean)`                | ✅ 一致  |
| `open`              | `[]`                              | —                                 | ✅ 一致  |
| `close`             | `[]`                              | —                                 | ✅ 一致  |
| `confirm`           | `[]`                              | —                                 | ✅ 一致  |
| `fullScreenChange`  | `[value: boolean]`                | `(value: boolean)`                | ✅ 一致  |
| `resizeChange`      | `[width: number, height: number]` | `(width: number, height: number)` | ✅ 一致  |

**Emits 小计**：6 个，文档全部覆盖 ✅

### 2.3 Slots 差异

源码定义：`src/components/common/ProDialog/ProDialog.vue:360-403`

| Slot 名   | 源码位置              | 文档描述（docs/27 §2.3） | 差异类型 |
| --------- | --------------------- | ------------------------ | -------- |
| `default` | ProDialog.vue:395     | ✅                       | ✅       |
| `header`  | ProDialog.vue:362-363 | ✅                       | ✅       |
| `footer`  | ProDialog.vue:397-402 | ✅                       | ✅       |

**Slots 小计**：3 个，文档全部覆盖 ✅

### 2.4 defineExpose 差异

源码未调用 `defineExpose`，组件通过 `v-model`（`update:modelValue`）+ 事件 API 与父组件通信。文档无 expose 节，符合 Vue 3 标准模式 ✅

### 2.5 源码 TODO/FIXME 列表

`src/components/common/ProDialog/ProDialog.vue`：**无匹配**
`src/components/common/ProDialog/types.ts`：**无匹配**

### 2.6 已知限制文档差异

| 限制项                                                                        | 源码 / types.ts 描述                | 文档描述（docs/27 §7）                | 差异类型 |
| ----------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------- | -------- |
| 与 EP 原生 draggable 语义差异                                                 | types.ts:30-32 注释明确说明         | §2.4 + §4.2 已说明                    | ✅ 一致  |
| Vue 3.6 SFC 编译器无法展开 `Partial<InstanceType<typeof ElDialog>['$props']>` | ProDialog.vue:18-19 文件头          | §2.4 末段说明                         | ✅ 一致  |
| 关闭时清除内联定位（全屏切）                                                  | ProDialog.vue:138-145 + types.ts:30 | §7 #2 全屏互斥 + §2.7 resize 后切全屏 | ✅ 一致  |

**ProDialog 整体审计结论：✅ 无差异（props/emits/slots/默认值/已知限制全部对齐）**

---

## 3. XForm（`src/components/form-schema/components/XForm.vue` + `src/types/xform.ts` + composables/*）

### 3.1 Props 差异

源码定义：`src/components/form-schema/types/xform.ts:58-198`（`XFormProps` 接口）

| Prop 名                 | 源码定义                                         | 文档描述（docs/24 §2）          | 差异类型 |
| ----------------------- | ------------------------------------------------ | ------------------------------- | -------- |
| `schema`                | `SchemaNode \| SchemaNode[]` 必填                | `SchemaNode \| SchemaNode[]` ✅ | ✅       |
| `model`                 | `Record<string, unknown>` 可选                   | 未列必填 ✅                     | ✅       |
| `components`            | `Record<string, unknown>`                        | ✅                              | ✅       |
| `rules`                 | `Record<string, RuleItem>`                       | ✅                              | ✅       |
| `directives`            | `Record<string, Directive>`                      | ✅                              | ✅       |
| `t`                     | `XFormTranslateFn`                               | ✅                              | ✅       |
| `beforeChange`          | `BeforeChangeFn`                                 | ✅                              | ✅       |
| `beforeChangeRules`     | `BeforeChangeRule[]`                             | ✅                              | ✅       |
| `zodSchema`             | `ZodType`                                        | ✅                              | ✅       |
| `componentProps`        | `Record<string, Record<string, unknown>>`        | ✅                              | ✅       |
| `expressionFunctions`   | `Record<string, (...args: never[]) => unknown>`  | ✅                              | ✅       |
| `scrollToError`         | `boolean`                                        | ✅                              | ✅       |
| `scrollIntoViewOptions` | `ScrollIntoViewOptions \| boolean`               | ✅                              | ✅       |
| `permissionResolver`    | `(perm: string) => 'view' \| 'edit' \| 'hidden'` | ✅                              | ✅       |
| `showErrorToast`        | `boolean`                                        | ✅                              | ✅       |
| `reactionBudget`        | `number`                                         | ✅                              | ✅       |
| `size`                  | `'large' \| 'default' \| 'small'`                | ✅                              | ✅       |
| `showDirtyMark`         | `boolean`                                        | ✅                              | ✅       |

**Props 小计**：18 个，文档全部覆盖 ✅

### 3.2 Emits 差异

XForm 源码未声明自定义 emit（`grep defineEmits` 仅匹配到 XForm.vue 第 21 行 `defineProps`，无 `defineEmits`），组件仅通过 `v-model` 间接数据流 + `defineExpose` 命令式方法通信。文档无独立 Emits 节，符合 Vue 3 composition API 标准 ✅

### 3.3 Slots 差异

源码定义：`src/components/form-schema/components/XForm.vue:118, 141`

| Slot 名              | 源码位置                                        | 文档描述（docs/24）                            | 差异类型                                                                                                                                               |
| -------------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `footer`             | XForm.vue:118                                   | §1.2 隐含 + §17 「ElForm 自定义」 — 未独立列名 | ⚠️ MEDIUM — 未明确列出 slot 名                                                                                                                         |
| **`toastContainer`** | **XForm.vue:141**（带 scope 参数 `{ events }`） | **完全缺失**                                   | ❌ **CRITICAL — toastContainer slot 未文档化（XForm.vue 模板注释提及业务可用 `<XForm><template #toastContainer="{ events }">` 自定义替换默认 toast）** |

**Slots 小计**：2 个，文档覆盖 0 个 → **2 处缺失（CRITICAL ×1 + MEDIUM ×1）**

### 3.4 defineExpose 差异

源码定义：`src/components/form-schema/types/xform.ts:201-247`（`XFormExpose` 接口）

| Expose 方法                            | 源码签名                                                          | 文档描述（docs/24 §3） | 差异类型 |
| -------------------------------------- | ----------------------------------------------------------------- | ---------------------- | -------- |
| `getRef(key)`                          | `(key: string) => ComponentPublicInstance \| HTMLElement \| null` | §3.5 ✅                | ✅       |
| `getNames(includesIgnore?)`            | `(includesIgnore?: boolean) => string[]`                          | §3.5 ✅                | ✅       |
| `validate()`                           | `() => Promise<boolean>`                                          | §3.1 ✅                | ✅       |
| `validateDetail()`                     | `() => Promise<ValidateResult>`                                   | §3.1 ✅                | ✅       |
| `clearValidate(names?)`                | `(names?: string[]) => void`                                      | §3.1 ✅                | ✅       |
| `resetFields(names?)`                  | `(names?: string \| string[]) => void`                            | §3.1 ✅                | ✅       |
| `validateField(name)`                  | `(name: string \| string[]) => Promise<boolean>`                  | §3.1 ✅                | ✅       |
| `scrollToField(name)`                  | `(name: string) => void`                                          | §3.1 ✅                | ✅       |
| `validateWithZod()`                    | `() => { success: boolean; errors: ZodError \| null }`            | §3.1 ✅                | ✅       |
| `setFieldError(name, message, state?)` | 同源码                                                            | §3.2 ✅                | ✅       |
| `setFieldValidating(name)`             | 同源码                                                            | §3.2 ✅                | ✅       |
| `addItem(name, init?)`                 | 同源码                                                            | §3.3 ✅                | ✅       |
| `removeItem(name, index)`              | 同源码                                                            | §3.3 ✅                | ✅       |
| `moveItem(name, from, to)`             | 同源码                                                            | §3.3 ✅                | ✅       |
| `isDirty()`                            | `() => boolean`                                                   | §3.4 ✅                | ✅       |
| `getDirtyFields()`                     | `() => string[]`                                                  | §3.4 ✅                | ✅       |
| `isTouched(name)`                      | `(name: string) => boolean`                                       | §3.4 ✅                | ✅       |
| `resetDirty()`                         | `() => void`                                                      | §3.4 ✅                | ✅       |
| `validateFromServer(response)`         | 同源码                                                            | §3.2 ✅                | ✅       |

**Expose 小计**：19 个方法，文档全部覆盖 ✅

### 3.5 源码 TODO/FIXME 列表

`src/components/form-schema/components/XForm.vue`：**无匹配**

### 3.6 已知限制 / Bug 文档差异

| 限制项                          | 源码 / docs/25 描述 | docs/24 §18 描述        | 差异类型 |
| ------------------------------- | ------------------- | ----------------------- | -------- |
| `permission` 权限码映射未透传   | docs/25 §6 + ADR    | docs/24 §18 #1 已记录   | ✅ 一致  |
| `labelPosition` 仅顶层生效      | docs/25 §6 + ADR    | docs/24 §18 #5 已记录   | ✅ 一致  |
| schema 须整体替换               | docs/25 §6          | docs/24 §18 #6 已记录   | ✅ 一致  |
| builder 链式 TS 推断 cast       | docs/25 §6 ADR-007  | docs/24 §18 #4 已记录   | ✅ 一致  |
| 草稿不可序列化值 / 多标签不同步 | docs/25 §6          | docs/24 §12 + §18 #2/#3 | ✅ 一致  |

**XForm 整体审计结论**：1 处 CRITICAL（`toastContainer` slot 未文档化），其余对齐。

---

## 4. BaseChart（`src/components/common/BaseChart.vue`）

### 4.1 Props 差异

源码定义：`src/components/common/BaseChart.vue:20-34`

| Prop 名      | 源码定义                            | 文档描述（docs/28 §1.1）            | 差异类型 |
| ------------ | ----------------------------------- | ----------------------------------- | -------- |
| `option`     | `EChartsCoreOption` 必填            | `EChartsCoreOption` 必填            | ✅ 一致  |
| `loading`    | `boolean` 默认 `false`              | `boolean` 默认 `false`              | ✅ 一致  |
| `theme`      | `string \| object` 默认 `undefined` | `string \| object` 默认 `undefined` | ✅ 一致  |
| `autoResize` | `boolean` 默认 `true`               | `boolean` 默认 `true`               | ✅ 一致  |

**Props 小计**：4 个，文档全部覆盖 ✅

### 4.2 Emits 差异

BaseChart **不暴露自定义事件**——所有 ECharts 原生事件通过 `defineExpose.getInstance()` 获取实例后绑定（源码无 `defineEmits` 调用）。文档 §1.2 明确说明 ✅

### 4.3 Slots 差异

BaseChart 模板只有 `<div ref="chartRef" :class="bem.b()">`，无 slot。文档 §1.3 明确"无" ✅

### 4.4 defineExpose 差异

源码定义：`src/components/common/BaseChart.vue:136-147`

| Expose 方法     | 源码签名              | 文档描述（docs/28 §3） | 差异类型 |
| --------------- | --------------------- | ---------------------- | -------- |
| `getInstance()` | `(): ECharts \| null` | `(): ECharts \| null`  | ✅       |
| `resize()`      | `(): void`            | `(): void`             | ✅       |
| `clear()`       | `(): void`            | `(): void`             | ✅       |

**Expose 小计**：3 个，文档全部覆盖 ✅

### 4.5 源码 TODO/FIXME 列表

`src/components/common/BaseChart.vue`：**无匹配**

### 4.6 已知限制 / 设计要点文档差异

| 设计要点                              | 源码文件头注释      | 文档描述（docs/28 §2 + §5 + §7） | 差异类型 |
| ------------------------------------- | ------------------- | -------------------------------- | -------- |
| shallowRef 持有 ECharts 实例          | BaseChart.vue:6     | §2 #1 + §6                       | ✅       |
| ResizeObserver 替代 window.resize     | BaseChart.vue:7     | §2 #2                            | ✅       |
| setOption 强制 notMerge: true         | BaseChart.vue:8-10  | §2 #3 + §6                       | ✅       |
| 主题变更需销毁重建（无 setTheme API） | BaseChart.vue:11    | §2 #4 + §4.2 + §7 #3             | ✅       |
| onBeforeUnmount 三步清理              | BaseChart.vue:12-14 | §2 #5 + §5.3 + §6                | ✅       |
| 150ms trailing debounce               | BaseChart.vue:48-49 | §6 量化数据                      | ✅       |
| min-height: 1px 兜底                  | BaseChart.vue:160   | §5.1                             | ✅       |

**BaseChart 整体审计结论：✅ 无差异（5 项设计要点 + 3 项已知限制 + 4 props + 3 expose 全部对齐）**

---

## 5. RichTextEditor（`src/components/common/RichTextEditor/RichTextEditor.vue` + `types.ts`）

### 5.1 Props 差异

源码定义：`src/components/common/RichTextEditor/types.ts:20-75`（`RichTextEditorProps` 接口）

| Prop 名              | 源码定义                                | 文档描述（docs/30 §1.1）                                 | 差异类型 |
| -------------------- | --------------------------------------- | -------------------------------------------------------- | -------- |
| `modelValue`         | `string` 必填                           | `string` 必填                                            | ✅       |
| `height`             | `string \| number` 默认 `'300px'`       | `string \| number` 默认 `'300px'`                        | ✅       |
| `placeholder`        | `string` 默认 `'请输入内容...'`         | `string` 默认 `'请输入内容...'`                          | ✅       |
| `readOnly`           | `boolean` 默认 `false`                  | `boolean` 默认 `false`                                   | ✅       |
| `uploadApi`          | `(file: File) => Promise<UploadResult>` | `(file: File) => Promise<{ url: string; alt?: string }>` | ✅       |
| `toolbarExcludeKeys` | `string[]` 默认 `['uploadVideo']`       | `string[]` 默认 `['uploadVideo']`                        | ✅       |
| `toolbarKeys`        | `string[]` 默认 `undefined`             | `string[]` 默认 `undefined`                              | ✅       |

**Props 小计**：7 个，文档全部覆盖 ✅

### 5.2 Emits 差异

源码定义：`src/components/common/RichTextEditor/types.ts:82-85`（`RichTextEditorEmits`）+ `RichTextEditor.vue:54`

| Emit 名             | 源码签名                             | 文档描述（docs/30 §1.2） | 差异类型 |
| ------------------- | ------------------------------------ | ------------------------ | -------- |
| `update:modelValue` | `[html: string]`（DOMPurify 清洗后） | `(value: string)`        | ✅       |

**Emits 小计**：1 个，文档全部覆盖 ✅

### 5.3 Slots 差异

源码定义：`src/components/common/RichTextEditor/RichTextEditor.vue:346-348`

| Slot 名  | 源码位置                   | 文档描述（docs/30 §1.3） | 差异类型 |
| -------- | -------------------------- | ------------------------ | -------- |
| `footer` | RichTextEditor.vue:346-348 | ✅                       | ✅       |

**Slots 小计**：1 个，文档全部覆盖 ✅

### 5.4 defineExpose 差异

源码定义：`src/components/common/RichTextEditor/RichTextEditor.vue:307-317`

| Expose 方法     | 源码签名                 | 文档描述（docs/30 §2）   | 差异类型 |
| --------------- | ------------------------ | ------------------------ | -------- |
| `getEditor()`   | `(): IDomEditor \| null` | `(): IDomEditor \| null` | ✅       |
| `focus()`       | `(): void`               | `(): void`               | ✅       |
| `blur()`        | `(): void`               | `(): void`               | ✅       |
| `getHtml()`     | `(): string`             | `(): string`             | ✅       |
| `setHtml(html)` | `(html: string) => void` | `(html: string) => void` | ✅       |

**Expose 小计**：5 个，文档全部覆盖 ✅

### 5.5 源码 TODO/FIXME 列表

`src/components/common/RichTextEditor/RichTextEditor.vue`：**无匹配**

### 5.6 已知限制 / 设计决策文档差异

| 设计要点                                                                                  | 源码 / types.ts 描述                      | 文档描述（docs/30 §3）          | 差异类型 |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------- | -------- |
| DOMPurify 双向 sanitize（XSS 防御）                                                       | RichTextEditor.vue:60-87 + types.ts:21-29 | §3.1 完整说明                   | ✅       |
| 视觉为空映射（emit('')，<p><br></p> 占位段）                                              | RichTextEditor.vue:90-106 + 220-232       | §3.2 完整说明                   | ✅       |
| 防循环更新（6 步链路）                                                                    | RichTextEditor.vue:234-269                | §3.3 完整说明                   | ✅       |
| 自定义图片上传（uploadApi + customUpload）                                                | RichTextEditor.vue:166-204                | §3.4 完整说明                   | ✅       |
| 运行时变更不响应（uploadApi / placeholder / readOnly / toolbarExcludeKeys / toolbarKeys） | types.ts:39-72 ⚠️ 标记                    | §1.1 末尾"运行时变更不响应"提示 | ✅       |
| @ts-expect-error for @wangeditor/editor-for-vue                                           | RichTextEditor.vue:35-37                  | 未文档化（实现细节，可不改）    | LOW      |

**RichTextEditor 整体审计结论：✅ 无差异（7 props + 1 emit + 1 slot + 5 expose + 4 设计要点 + 1 运行时限制全部对齐）**

---

## 6. 总体结论

### 6.1 优先修复建议（按优先级排序）

| #   | 优先级       | 组件     | 问题                                                                                                   | 修复位置                                               |
| --- | ------------ | -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 1   | **CRITICAL** | ProTable | **缺独立 Emits 表**（3 个 emit：`sort-change` / `filter-change` / `engine-fallback` 完全未文档化）     | docs/29 §1.3 后新增 §1.4 `Events` 表                   |
| 2   | **CRITICAL** | ProTable | **`filterParamsAdapter` prop 缺失**（v3.5 PR2 新增核心 API）                                           | docs/29 §1.2 表格新增一行；新增 §3.5「服务端筛选」章节 |
| 3   | **CRITICAL** | XForm    | **`toastContainer` slot 未文档化**（带 scope 参数 `{ events }`，业务可自定义替换默认 XFormErrorToast） | docs/24 §1 / §2 新增 slot 表；§3 章节补充              |
| 4   | **HIGH**     | ProTable | **`getFilterState()` expose 方法缺失**（v3.5 PR2 新增）                                                | docs/29 §1.3 表格新增一行                              |
| 5   | **MEDIUM**   | ProTable | `empty` / `paginationLeft` / `paginationRight` slots 未独立列名                                        | docs/29 新增 §1.5 `Slots` 表                           |
| 6   | **MEDIUM**   | ProTable | 子类型 `FilterValue` / `FilterValuesMap` / `FilterParamsAdapter` 未文档化（与 #2 关联）                | docs/29 §2 后新增 §2.6 类型参考表                      |
| 7   | **MEDIUM**   | ProTable | `SummaryAggregate` 子类型未独立列名                                                                    | docs/29 §7.5 新增                                      |
| 8   | **MEDIUM**   | XForm    | `footer` slot 未独立列名（仅 §1.2 隐含）                                                               | docs/24 新增 §1.4 Slots 小表                           |

### 6.2 风险评估

| 风险维度         | 评级 | 说明                                                                                                                                                                                                                                |
| ---------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **消费方困惑**   | HIGH | ProTable 是项目核心列表组件，缺独立 Emits 表会让消费方无法用 `@filter-change` / `@engine-fallback` 监听 v3.5 PR2 能力；XForm 的 `toastContainer` slot 是 §OPT-7 优化点（2026-09-15 review 落地），业务可能错过替换默认 toast 的机会 |
| **类型推导**     | LOW  | 源码 `FilterValue` / `FilterValuesMap` 未文档化不影响运行时，但消费方写 `filterParamsAdapter` 时可能误用类型                                                                                                                        |
| **测试覆盖盲区** | LOW  | 5 个组件 spec 文件存在（grep 已验证），本审计不涉及测试覆盖度                                                                                                                                                                       |
| **运行时回归**   | LOW  | 5 个组件均无 TODO/FIXME/HACK 残留，3 个组件（ProDialog / BaseChart / RichTextEditor）契约与文档完全对齐                                                                                                                             |

### 6.3 合规对照

- ✅ 5 个组件均无遗留 `TODO|FIXME|HACK|XXX` 标记（grep 全量验证）
- ✅ 3 个组件（ProDialog / BaseChart / RichTextEditor）契约与文档 **完全对齐**（零差异）
- ⚠️ 2 个组件（ProTable / XForm）存在 CRITICAL/HIGH 文档缺漏，建议优先修复 #1/#2/#3 三项

### 6.4 本审计边界声明

- 本审计**仅读不改**，未触动任何源码 / 文档 / 类型文件
- 仅审计「契约」（Props / Emits / Slots / defineExpose / 默认值 / 已知限制）维度，**未审计**：
  - 实现细节（如 ProTable 内 8 个 composables 的逻辑）
  - 样式 / BEM 规范（CLAUDE.md §3 强制约束由其它审查通道覆盖）
  - 测试用例质量（spec.ts 文件已存在，覆盖度审计非本次范围）
  - 性能 / 包体积（不属契约审计）
- 子组件（SearchForm / SelectedTags / TableHeader / SelectionBar / ColSetting / ElementTableBody / VxeTableBody 等）未单独审计，建议下一轮单独立项

---

**END OF REPORT**
