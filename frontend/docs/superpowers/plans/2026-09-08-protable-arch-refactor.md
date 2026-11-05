# ProTable 架构优化实施计划（5 步）

> 来源：2026-09-08 架构深度评估报告（问题编号 H1-H7 / M1-M8 / L1-L6 与本计划对应）。
> 使用方式：**每完成一个子任务就把 `[ ]` 改为 `[x]` 并注明完成日期**；跨会话继续时先读本文件与 git log。
> 底线：每步完成后 `pnpm test src/components/ProTable` 全绿 + `pnpm type-check:full` + `pnpm lint` 通过，再做下一步。

---

## 进度总览

| 步骤 | 内容 | 状态 | 完成日期 |
|------|------|------|----------|
| 第 0 步 | 行为等价清理（死代码 / 单源化 colSettingVisible / engine 锁定 / M4 判定） | ✅ 已完成 | 2026-09-08 |
| 第 1 步 | searchParams 单源化（修 H1/H2/M6，核心） | ✅ 已完成 | 2026-09-08 |
| 第 2 步 | 能力编排归位（H4/H7/M8 + EditCell 抽取） | ✅ 已完成 | 2026-09-08 |
| 第 3 步 | props 保护（M2 列对象拷贝 / M5 派生 direction） | ✅ 已完成 | 2026-09-08 |
| 第 4 步 | vxe 死路径决策 + useRowEdit rowKey 注入（H3/H5） | ✅ 已完成 | 2026-09-08 |

---

## 第 0 步：行为等价清理（零风险，先行）

目标：删死代码、消除 colSettingVisible 双份、修正自相矛盾的 engine watch、M4 硬编码判定。**不改任何运行时行为**（M4 需同步改 demo 断言）。

- [x] 0.1 删除模板死代码：`<component :is="'div'" v-if="false" />`（`ProTable.vue:431`）✅ 2026-09-08
- [x] 0.2 删除 useTable 三个死字段 `editingKeys/treeExpandedKeys/isTreeMode`（`useTable.ts:42-47, 90-92, 199-201`），同步删 `UseTableReturn` 接口声明 ✅ 2026-09-08
- [x] 0.3 engine 锁定语义统一：删除 `ProTable.vue:53-61` 的 watch（JSDoc 已声明"首次 mount 锁定"），保留 `resolveEngine` 一次性捕获 ✅ 2026-09-08
- [x] 0.4 colSettingVisible 单源化：删除 `ProTable.vue:64, 98-106` 本地副本 + 两个 watch；模板与 `handleColSettingUpdate` 改绑 `columns.colSettingVisible`（`useColumns.ts:52` 已有该 ref）✅ 2026-09-08
- [x] 0.5 M4：`useCellSpan.ts:114` 的 `params.column?.property === 'amount'` 改为「该列 `span.judge` 存在」判定（在 `cellClassName` 内查 `columnsRef.value.find(c => c.prop === params.column?.property)?.span?.judge`）✅ 2026-09-08
- [x] 0.6 同步更新 demo：检查 `src/modules/demo/examples/ProTable/ProTableCellSpan.vue` 中 `amount` 列的 judge 合并颜色断言/样式是否仍命中（judge 存在 → 橙色 class 逻辑不变，理论上无需改；需人工浏览器确认）✅ 2026-09-08（代码级验证：`amount` 列声明 `span.judge`（demo 111/128-130 行），判定行为等价；浏览器回归见 0.7）
- [x] 0.7 验证：`pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint`；浏览器过一遍 `/demo/pro-table-overview` ✅ 2026-09-08（13 文件 81 测试全绿 + vue-tsc + eslint 零错误；浏览器回归列为手动验证项）

---

## 第 1 步：searchParams 单源化（核心，修 H1/H2/M6）

目标：searchParams 唯一由 `useSearch` 持有；`useTable` 改为读取回调；输入路径与请求路径分离；输入加防抖。

### 1.1 useTable 改造

- [x] `UseTableOptions` 增加 `getSearchParams: () => Record<string, unknown>`；删除内部 `searchParams` ref、`setSearchParams`、`resetSearchParams`、`serializeParams` ✅ 2026-09-08
- [x] 请求参数组装改为 `serializeParams({ ...options.getSearchParams(), pageNum, pageSize })`；`serializeParams` 全库唯一实现放 `useSearch.ts` 模块级 export，useTable import 复用 ✅ 2026-09-08
- [x] 删 `UseTableReturn` 中对应字段 ✅ 2026-09-08

### 1.2 useSearch 改造

- [x] 新增 `updateParams(params)`——纯写参数，不触发请求（供搜索区输入绑定）✅ 2026-09-08
- [x] `setSearchParams` 语义不变（写 + 回第 1 页 + 请求），仅程序化 expose 使用 ✅ 2026-09-08
- [x] `reset()` 保持「恢复 defaultValue + fetchHook({reset:true})」✅ 2026-09-08（无需改动，原有行为即正确）

### 1.3 ProTable.vue 接线

- [x] `useSearch` 先于 `useTable` 创建；`getSearchParams: () => search.searchParams.value`；fetchHook 闭包引用后声明的 table（用户交互期才执行）✅ 2026-09-08
- [x] 删除桥接 watch（原 `ProTable.vue:91-95`）✅ 2026-09-08
- [x] SearchForm 的 `@update:search-params` 从 `search.setSearchParams` 改绑 `search.updateParams` ✅ 2026-09-08
- [~] SearchForm 输入防抖：**调整决定 —— 不实施**。H2 修复后输入与请求已解耦（updateParams 纯写即时回写，是受控输入的标准行为）；需要防抖的副作用（请求）已由按钮门控。且 `v-inputDebounce` 是 DOM 层 input 事件防抖，与 `update:model-value` 受控流不兼容 ✅ 2026-09-08

### 1.4 测试

- [x] `useSearch.spec.ts` 增补：`updateParams` 不触发 fetchHook；`setSearchParams` 仍触发 ✅ 2026-09-08
- [x] `useTable.spec.ts` 改造：mock `getSearchParams` 验证请求参数组装（含序列化用例）；删除 resetSearchParams 用例 ✅ 2026-09-08
- [x] 集成测试增补：「暴露的 setSearchParams → requestApi 收到传入参数（H1 回归）」「输入不发请求、点搜索发正确参数（H2 回归）」✅ 2026-09-08

### 1.5 验证

- [x] `pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint` —— 13 文件 84 测试全绿 + vue-tsc + eslint 零错误 ✅ 2026-09-08（浏览器 Network 面板验证列为手动项）

---

## 第 2 步：能力编排归位（H4/H7/M8 + 模板减负）

### 2.1 useRowDrag 自持 DOM 挂载

- [x] `UseRowDragOptions` 增加 `getTbody: () => HTMLElement | null`（替代外部传 tbody）✅ 2026-09-08
- [x] useRowDrag 内部 `watch(data, flush: 'post')` 自动 `detach + attach`；对外保留 `attachSortable/detachSortable` 签名兼容（spec 复用）✅ 2026-09-08
- [x] 删除 `ProTable.vue:133-156` 的 `tryAttachSortable` + 3 个 `setTimeout` + 2 个 watch；`onMounted` 仅剩首次 attach（移入 useRowDrag 内部）✅ 2026-09-08
- [x] `ProTable.vue` 传 `getTbody: () => proTableEl.value?.$el?.querySelector('.el-table__body tbody') ?? null`（经 useTableCapabilities options 透传）✅ 2026-09-08

### 2.2 树形索引映射（H6）

- [x] `onEnd` 不再直接用 DOM index splice 顶层数组：先由 `getViewRowKeys` 收集视图行 key 序列 → 映射到顶层数组索引 → 再 splice ✅ 2026-09-08
- [x] `UseRowDragOptions` 增加 `getViewRowKeys?: () => (string|number)[]` 与 `resolveTopIndex?: (viewIndex: number) => number`；树形模式（crossLevelDrag=false）下映射失败时 `console.warn` 并跳过（替代现状静默错位）✅ 2026-09-08
- [x] 补 useRowDrag.spec：树形模式拖拽非顶层行的用例（映射成功 splice + 映射失败跳过）✅ 2026-09-08

### 2.3 useTreeData 响应式与资源清理

- [x] `flattenData()` 普通方法改为内部 `computed`，返回对象增加 `flatData: Ref<TreeNode[]>`；`ProTable.vue:126-128` 的 `flatTreeData` computed 删除，模板直接用 `treeData.flatData` ✅ 2026-09-08
- [x] 返回 `dispose(): void` 清理 `timers` Map + `expanded/loading`（`useTreeData.ts:14`）✅ 2026-09-08
- [x] `useTableCapabilities.ts:134-136` 的 `onUnmounted` 增加 `treeData?.dispose()` ✅ 2026-09-08

### 2.4 模板减负

- [x] 抽取 `components/EditCell.vue`：props `(rowKey, col, value)` + emit `update(prop, value)`；承接 `ProTable.vue:380-428` 四分支编辑控件与 `resolveEditComp`（附 EditCell.spec 4 用例）✅ 2026-09-08
- [x] 抽取 `components/CellContent.vue`：承接 VNode 包装 trick（两处 `v-for="(item,i) in [resolveCell(...)]"`，附 CellContent.spec 3 用例）✅ 2026-09-08
- [x] 树形缩进 span 保留在模板（抽完后 ProTable.vue 384 行 ≤400 目标已达成，无需再抽 TreeCell.vue）；顺带提取 `rowKeyOf()` 统一 rowKey 取法 ✅ 2026-09-08
- [x] `resolveEditComp` 随 EditCell 迁移出 ProTable.vue ✅ 2026-09-08

### 2.5 验证

- [x] `pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint` —— 15 文件 93 测试全绿 + vue-tsc + eslint 零错误 ✅ 2026-09-08
- [~] 浏览器回归：行拖拽排序（平铺 + 树形同层）、单元格合并、行内编辑双击、树形展开/懒加载 —— 列为手动验证项（代码级验证：H6 映射逻辑由 useRowDrag.spec 树形用例覆盖）

---

## 第 3 步：props 保护（M2 / M5）

### 3.1 useColumns 列对象拷贝

- [x] 初始化 `allColumns` 时白名单拷贝列对象：新增 `cloneColumns()`（`useColumns.ts:53`）浅拷贝一层，boolean → 本地 `ref`；外部 `Ref<boolean>` → computed 包装（本地未写入时读外部保持联动，set 写本地副本 ref 实现"手动优先"）；函数/数组引用（render/headerRender/enum/search/tableProps）保留共享 ✅ 2026-09-08
- [x] `toggleVisible`/`resetToDefault` 基于本地副本：统一赋「新 ref 实例」走 reactive 属性替换（根因：`allColumns` 是 deep ref，读 `col.hidden` 时被 reactive 自动解包拿不到 Ref 本体，且 UnwrapRef+exactOptionalPropertyTypes 需 cast 回 `ProColumn`）；`toggleFixed` 原本就写副本字段无需改 ✅ 2026-09-08
- [x] `sortedColumns`/`searchColumns` 消费拷贝后的列，`ProColumn.hidden` 的 `Ref<boolean>` 公开类型保持不变 ✅ 2026-09-08
- [x] 补 useColumns.spec 3 用例：外部 columns 常量不被修改（toggleVisible+toggleFixed 前后 deep equal）；两个实例共享同一 columns 常量互不污染；外部 Ref<boolean> 联动 + 手动 toggle 本地优先 ✅ 2026-09-08

### 3.2 validateCapabilities 派生化（M5）

- [~] **方案修正（实施时发现原计划假设不成立）**：原计划的 `effectiveSpanDirection` computed 假设 useCellSpan 消费全局 direction，但经全库核实全局 `span.direction` **无任何消费者**（合并生效路径只有列级 `span.direction`，见 `useCellSpan.ts:51,89`），全局配置本来就是死配置。因此不新增 computed（避免把死配置接线成行为变化），改为最小行为等价修复：`validateCapabilities` 删除 `cellSpanConfig.value.direction = 'row'` 原地改写（M5 mutation 消除），保留 console.warn 并注明该配置被忽略 ✅ 2026-09-08
- [x] 全局 `direction` 死配置与 vxe 死路径同类，列入第 4 步统一决策（删除或标注）✅ 2026-09-08
- [x] 同步更新集成测试 ④ 标题（断言只查 warn 文案，不受影响）✅ 2026-09-08

### 3.3 验证

- [x] `pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint` —— 15 文件 96 测试全绿 + vue-tsc + eslint 零错误 ✅ 2026-09-08
- [~] 浏览器验证列设置：显隐切换、固定列、拖拽排序、恢复默认、localStorage 持久化（tableKey 场景）—— 列为手动验证项

---

## 第 4 步：vxe 死路径决策 + rowKey 注入（H3 / H5）

### 4.1 vxe 决策（方案 A，用户已拍板）

- [x] 方案 A：`'vxe-table'` 时 `console.warn('[ProTable] vxe-table 引擎暂未实现，已回退 element-plus（v2.1 计划支持）')` 并回退（`adapters/engine.ts` resolveEngine）；删除 `useVxeTable.ts` 及其 spec；`types/index.ts` 删除 `vxeProps` 字段；README/ARCHITECTURE/CONTRIBUTING 标注 v2.1 计划 ✅ 2026-09-08
- [x] 顺带清理：`engine.ts` 删除无消费者的 `isVxeEngine`；CONTRIBUTING 删除已过时的「集成测试未交付」条目 ✅ 2026-09-08
- [x] 补测试：传 `table-engine="vxe-table"` 渲染 el-table 且 warn（方案 A）✅ 2026-09-08

### 4.2 useRowEdit rowKey 注入（H5）

- [x] `UseRowEditOptions` 增加 `rowKey?: string`（默认 `'id'`）；`_save` 内按 `options.rowKey ?? 'id'` 查找行（成功 + catch 两处）✅ 2026-09-08
- [x] `useTableCapabilities.ts:83-87` 透传 `props.rowKey ?? 'id'` ✅ 2026-09-08
- [x] 补 useRowEdit.spec：自定义 rowKey（`uuid`）保存成功用例 ✅ 2026-09-08

### 4.3 验证

- [x] `pnpm test src/components/ProTable && pnpm type-check:full && pnpm lint` —— 14 文件 95 测试全绿 + vue-tsc + eslint 零错误 ✅ 2026-09-08
- [~] 全量 demo 回归：`/demo/pro-table-overview|row-edit|tree|cell-span|row-drag` —— 列为手动验证项（4.2 行为由 spec 用例覆盖；4.1 回退路径由集成测试覆盖）

---

## 附：风险与防新 bug 清单

| 风险点 | 措施 |
|--------|------|
| 第 1 步后旧 demo 依赖「输入即搜」 | H2 本身即 bug 修复；全量 demo 路由人工回归 |
| 第 3 步拷贝列对象后 hidden 响应式断链 | 外部 Ref 包 computed 读 + 本地 ref 写 |
| 第 2 步拖拽挂载时序变化 | watch flush:'post' + 保留公开签名；现有 spec 复跑 |
| 每步顺序不可调换 | 0 → 1 → 2 → 3 → 4；每步跑全绿再进下一步 |

## 附：变更说明模板（每步完成时输出）

```
- 新增文件：…
- 修改函数：…
- 自检清单通过情况：[n / 26]
- src/ 写操作清单：…
- 建议验证：…
```
