# ProTable 表格引擎健康度审计报告

> **审计日期**：2026-10-15
> **审计对象**：`src/components/ProTable/`（95 个文件：ProTable.vue 编排层 + 17 composables + 双引擎 body + adapters + types）
> **契约基准**：`docs/29-ProTable使用指南.md`（v3.4.0）
> **审计性质**：只读健康度审计（引擎加固 sprint 第一阶段），产出供修复批使用的问题清单
> **审计维度**：服务端契约 / 大数据 / 状态保持 / 双引擎 / 引擎级已知缺陷面 / 文档契约对照

---

## 一、执行摘要

本次审计逐项核对了引擎实际行为与文档契约，共记录 **19 项确认发现**（HIGH 5 / MEDIUM 9 / LOW 5）+ 2 项低置信度附录发现。

**核心结论**：

1. **筛选子系统存在「状态复位不彻底」的系统性缺陷**（发现 #1、#2、#8）：`reset()` 只清 useTable 的 filterState ref，既不重置 el-table 列头筛选 UI（非受控 filteredValue），也不重置 VxeTableBody 的 localFilterMap 与 vxe UI 勾选；`clearSelection` 在 vxe 引擎下只清镜像不清 UI。这会导致「重置后旧筛选复活」「已选 0 项但勾选框仍打勾」的用户可见缺陷。
2. **docs/29 的 §6.4 / §12 #3 已严重过时**（发现 #5）：仍声称 vxe 引擎不支持树形/拖拽/合并/编辑四大能力，与 v3.5 PR1-B 实现（VxeTableBody 已全面补齐）直接矛盾，消费方按文档会做出错误引擎选型。
3. **文档内部引用断链**（发现 #6）：§1.2 Props 表、ProTable.vue emit 注释、types JSDoc 均引用「§3.5 filterParamsAdapter 服务端筛选示例」，但文档不存在 §3.5 章节。
4. **服务端排序/筛选契约三方一致**（引擎 `pageNum/pageSize` + prop 字典搜索参数 + `orderByColumn/isAsc` + adapter 序列化）：demo 层（mock/pro-table/filter-orders、sort-orders）与 docs §3.1/§5.2 描述如实，e2e 发现的「demo 层搜索参数为 prop 字典」与引擎契约一致，无偏差。
5. **v3.5 PR2 新增的 filter 事件/API 测试覆盖良好**（integration.spec 6 例 + 组件 spec），但 `reset` 复位引擎侧 UI 的用例是盲区（现有测试只断言 state 与请求参数）。

---

## 二、发现清单表

| #   | 发现                                                                                                                                                       | 严重度 | 证据 file:line                                                                                                                    | 建议修复方向                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | reset 路径不重置引擎侧筛选 UI：el-table filteredValue 非受控残留 + vxe localFilterMap 无清空通道，旧筛选会在下次操作时「复活」                             | HIGH   | composables/useTable.ts:405-407；ProTable.vue:177-190；components/VxeTableBody.vue:331-364；ProTable.integration.spec.ts:597-631  | reset 链路补引擎侧复位：el 引擎调 clearFilter / 列 filteredValue 受控化；VxeTableBody expose clearFilters 清 localFilterMap + vxe filter 状态 |
| 2   | vxe 引擎 clearSelection 只清内部镜像不清 vxe UI 勾选（tableRef 恒 null，el-table clearSelection 方法不可达）                                               | HIGH   | composables/useTable.ts:329-334；components/ElementTableBody.vue:167-174（vxe 无等价 expose）；ProTable.vue:608-618               | clearSelection 增加引擎分支：vxe 引擎调 vxeTableInst.clearCheckboxRow()；或统一经 body 组件 expose 的 clearSelection 方法                     |
| 3   | vxe 引擎 reserve-selection 跨页选区镜像不完整（vxe 恢复勾选不发事件 → 镜像丢跨页行），ToolbarCtx「含其他页选中行」承诺失效                                 | HIGH   | components/VxeTableBody.vue:273-314, 390-398；types/index.ts:445                                                                  | reserve 模式下翻页/数据变化后从 vxe 实例 getCheckboxRecords() 回同步镜像；或文档声明 vxe 引擎该契约不成立                                     |
| 4   | vxe 引擎 enableSummary 静默失效：summary 无引擎守卫实例化，但 VxeTableBody 未接线任何汇总行渲染                                                            | HIGH   | composposables/useTableCapabilities.ts:244-252；ProTable.vue:671-692（无 summary props）；components/VxeTableBody.vue 全文        | useTableCapabilities 对 vxe + summary 给 warn + 忽略（对齐 virtualized 强隔离策略）；docs §7.5/§12 补披露                                     |
| 5   | docs §6.4「vxe 引擎能力缺失」+ §12 #3 与 v3.5 PR1-B 实现严重矛盾（vxe 已支持树形/拖拽/合并/编辑）                                                          | HIGH   | docs/29-ProTable使用指南.md:592-601, 935；components/VxeTableBody.vue:10-13, 476-517；composables/useTableCapabilities.ts:107-167 | 重写 §6.4（改为能力对等矩阵 + vxe+tree+drag 三能力冲突的 debug 提示）；§12 #3 同步修订                                                        |
| 6   | docs §3.5 引用断链：§1.2 表 / ProTable.vue emit 注释 / types JSDoc 引用不存在的「§3.5 filterParamsAdapter 服务端筛选示例」                                 | HIGH   | docs/29-ProTable使用指南.md:96；ProTable.vue:124；types/index.ts:577；文档章节列表 349-417（仅 3.1-3.4）                          | 补写 §3.5 章节（filterParamsAdapter 协议 + 空数组语义 + 客户端筛选缺省行为）或把引用改指 demo/ServerFilter                                    |
| 7   | filter-change emit payload（增量/残缺快照）与 getFilterState()（merge 后全表快照）不一致；useProTableEvents 注释自称「全表快照」与实际不符                 | MEDIUM | composables/useProTableEvents.ts:115-119, 180-183；composables/useTable.ts:381-398；demo ProTableServerFilter.vue:168-174         | emit 统一改发 table.getFilterState()（merge 后快照）；或文档明确 payload 为「事件增量」并建议状态回显用 getFilterState                        |
| 8   | ElPagination v-bind 顺序允许业务方 pagination props 覆盖 current-page/page-size/total 内部绑定，分页状态失控                                               | MEDIUM | ProTable.vue:705-713                                                                                                              | 调整绑定顺序（v-bind 在前，受控绑定在后）或在 docs §5.1 声明保留键（current-page/page-size/total/layout）                                     |
| 9   | statePersist 持久化集合不含 filterState（v3.5 PR2 后筛选成一等状态，路由返回后筛选丢失，与 sortState 待遇不对等）                                          | MEDIUM | composables/useStatePersist.ts:31-37, 127-135；composables/useTable.ts:215                                                        | PersistedTableState v2 加 filterState 字段（版本迁移）；或文档明确不持久化筛选的决策理由                                                      |
| 10  | useTableCapabilities validateCapabilities 的 console.debug 文案（「已自动忽略行拖拽」）与 hotfix-7 后实际行为（拖拽照常挂载）矛盾                          | MEDIUM | composables/useTableCapabilities.ts:161-167, 210-214                                                                              | 修订文案为「如拖拽错位请反馈」或恢复守卫；消除误导性提示                                                                                      |
| 11  | SelectedTags「清除全部」与 SearchForm「重置」行为不一致：前者保留分页且不清筛选状态，后者回第 1 页 + resetFilter                                           | MEDIUM | ProTable.vue:469-492 vs composables/useSearch.ts:90-103                                                                           | 统一语义：handleClearAllConditions 走 search.reset() 或文档披露两入口差异                                                                     |
| 12  | §12 已知限制未列 virtualized（el-table-v2）分支能力缺失（selection 列忽略 / filter 忽略仅 warn），消费方无从查知                                           | MEDIUM | docs/29-ProTable使用指南.md:929-940；components/ElementTableV2Body.vue:381-421                                                    | §12 补行：virtualized 不支持多选/筛选/树形/汇总/合并/展开/拖拽（warn + 忽略）                                                                 |
| 13  | v2 虚拟滚动分支 sortable=true（客户端排序）点击无效果：onColumnSort → 编排层被 custom 判定拦截，v2 又无内置客户端排序                                      | MEDIUM | components/ElementTableV2Body.vue:373-379；composables/useProTableEvents.ts:168-173                                               | v2 分支对 sortable=true 给一次性 warn「请改 custom 或自排序」，或 docs §5.2 补披露                                                            |
| 14  | §13 测试覆盖表严重不完整：实际 30+ spec 文件仅列 9 个，且未列 useStatePersist/useVirtualScroll/useEngineFallback/useProTableEvents/useTableCapabilities 等 | MEDIUM | docs/29-ProTable使用指南.md:943-960 vs src/components/ProTable/**/*.spec.ts（30 个）                                              | 按目录分组补全测试表（composables 17 / components 12 / adapters 5 / utils 2 / 根 2）                                                          |
| 15  | sort-change 仅在 sortable='custom' 列触发，文档 §1.4 未披露该限定（客户端排序列变化时事件不触发，消费方监听会困惑）                                        | LOW    | composables/useProTableEvents.ts:168-173；docs/29-ProTable使用指南.md:156-160                                                     | §1.4 触发时机列补「仅 sortable='custom' 列」                                                                                                  |
| 16  | §16 示例索引表 21 行 vs 头部宣称「23 个演示」，缺 ProTableAsyncState、ProTableServerFilter 两行                                                            | LOW    | docs/29-ProTable使用指南.md:6, 1011-1040 vs src/modules/demo/examples/ProTable/（23 个 .vue）                                     | 补两行索引（AsyncState 三态演示、ServerFilter 服务端筛选）                                                                                    |
| 17  | useStatePersist.attach 注释称「mounted 后调用」，实际 ProTable.vue setup 期同步调用                                                                        | LOW    | composables/useStatePersist.ts:14-16, 60-61 vs ProTable.vue:203-209                                                               | 修订注释为「setup 期调用（read 之后）」                                                                                                       |
| 18  | useSearch.search()（搜索按钮 / SelectedTags 清除）保留分页，与 setSearchParams/reset 回第 1 页形成三种分页语义，文档仅披露两种                             | LOW    | composables/useSearch.ts:84-87；docs/29-ProTable使用指南.md:443-453                                                               | docs §4.3 补「搜索按钮保留当前页」说明                                                                                                        |
| 19  | filter-change 无 filterParamsAdapter 时仍 emit（客户端筛选场景），文档 §1.4 未披露该行为                                                                   | LOW    | composables/useProTableEvents.ts:175-183；docs/29-ProTable使用指南.md:156-160                                                     | §1.4 补注：无 adapter 时事件 payload 为 el-table 客户端筛选快照，仅供 UI 联动                                                                 |

---

## 三、HIGH 发现详细分析

### 发现 #1：reset 后引擎侧筛选 UI 残留，旧筛选「复活」

**现象链路**（el 引擎）：

1. 用户在两列（status / dept）设置列头筛选 → `el-table @filter-change` → `ElementTableBody.onFilterChange` 透传快照 → `useProTableEvents.handleFilterChange` → `useTable.setFilter` merge 进 filterState（有 adapter 时触发请求）。
2. 用户点「重置」→ `search.reset()` → fetchHook({reset: true}) → `table.resetFilter()`（useTable.ts:405-407 仅 `filterState.value = {}`）+ setPage(1) + refresh。
3. **缺口 A**：ElementTableBody 未给 ElTableColumn 绑 `filtered-value`（非受控），`resetFilter` 也不调 el-table 的 `clearFilter()` 方法 → 列头筛选下拉的勾选状态残留在 el-table 内部 store。
4. **缺口 B**：VxeTableBody 的 `localFilterMap`（vxe 引擎多列筛选合并镜像）无任何外部清空通道（grep 全库无写入口）→ vxe 引擎残留更严重。
5. **复活路径**：用户随后点另一列筛选 → el-table 再次 emit filter-change，payload 含**残留列的旧值** → `setFilter` merge 语义保留旧值 → 已「重置」的筛选条件静默回到请求参数中。`assertValidResponse` 之前的 `serializeParams` 会把它们发给后端。

**测试盲区**：现有 reset 用例（ProTable.integration.spec.ts:597-631）只断言 `getFilterState()` 为空与请求参数不含筛选字段——均为 useTable 内部状态，恰好绕过了引擎侧 UI 残留。jsdom 下 el-table 筛选 UI 不渲染也使该缺陷不可见。

**建议**：reset 链路增加引擎复位协议——ElementTableBody expose `clearFilters()`（内部调 elTableRef.clearFilter() 或受控 filtered-value）；VxeTableBody expose `clearFilters()`（清 localFilterMap + vxe filter 状态）；ProTable.vue reset 路径在 `table.resetFilter()` 后按引擎调用。

### 发现 #2：vxe 引擎 clearSelection 不清除 vxe UI 勾选

**代码链路**：`useTable.clearSelection()`（useTable.ts:329-334）只做两件事：清空 selectedRows 镜像 + 调 `tableRef.value?.clearSelection?.()`。`tableRef` 仅由 ElementTableBody 的 `elTable` expose 同步（ProTable.vue:333-339）；**vxe 引擎下 tableRef 恒为 null**（proTableVxe 是独立 ref，只暴露 recalculate/getTbody，见 VxeTableBody.vue:125-148）。

**后果**：vxe 引擎下点 SelectionBar「清除」→ 镜像清空（「已选 0 项」）→ vxe 表格勾选框全部仍打勾。用户再点任一勾选框 → checkbox-change 事件以空镜像为基线重新合并 → 勾选状态与选中区错乱（漏行/重复行）。

**建议**：VxeTableBody expose `clearSelection()`（内部调 `vxeTableInst.clearCheckboxRow()`）；useTable.clearSelection 改为引擎感知（或统一走 body 组件方法，el 引擎保持 tableRef 路径）。

### 发现 #3：vxe 引擎 reserve-selection 跨页选区镜像不完整

**契约承诺**：types/index.ts:445 ToolbarCtx.selectedRows JSDoc 明确「跨页 reserve-selection 时含其他页选中行」。

**实现缺口**：VxeTableBody 的 selectedRows 镜像只由 `checkbox-change` / `checkbox-all` 事件维护（VxeTableBody.vue:287-314）。vxe-table 在 `checkbox-config.reserve` 模式下翻页恢复历史勾选是内部行为，**不逐行派发事件**（与 el-table reserve-selection 在 selection-change 中回传全量选区的语义不同）。因此翻页后镜像只剩当前页操作过的行，ToolbarCtx.selectedCount / getSelectedRows() / 批量操作拿到的是残缺的跨页选区。

**缓解因素**：el 引擎无此问题（el-table selection-change 回传全量选中行）；vxe + 非 reserve 模式有 rows watch 兜底清空（VxeTableBody.vue:390-398），行为正确。

**confidence 说明**：「vxe 恢复勾选不派发事件」基于 vxe-table 事件模型推断，未在真机验证——标 confidence: medium，建议修复批先用 CDP 实证再定方案（方案 A：翻页后从 `getCheckboxRecords()` 回同步；方案 B：文档声明 vxe 引擎下该契约降级）。

### 发现 #4：vxe 引擎 enableSummary 静默失效

**链路**：`useTableCapabilities` 对 summary 无条件实例化（useTableCapabilities.ts:244-252，无 isVxeEngine 守卫）；ProTable.vue 仅给 ElementTableBody 传 showSummary/summaryMethod（:647-648）；VxeTableBody 的 props/模板/事件均无 summary 接线（vxe 汇总需 footer-method 或 VxeTable 的 show-footer 配置，当前为零）。**消费方配 `table-engine="vxe-table" :enable-summary="true"` 后无任何 warn、无任何汇总行**——纯静默失效。

**对照**：virtualized 冲突能力均有「warn + 忽略」强隔离（useVirtualScroll.ts:74-84），summary 唯独漏网。

**建议**：useTableCapabilities 补 `isVxeEngine && props.enableSummary` 的 warn + 忽略（或实现 vxe footer-method 接线）；docs §7.5 补引擎限制说明。

### 发现 #5：docs §6.4 / §12 #3 与 v3.5 PR1-B 实现严重矛盾

**文档现状**（docs/29:592-601, 935）：

> 「vxe 引擎不支持 4 大能力（树形 / 拖拽 / 合并 / 编辑）—— 启动 warn + 忽略」「这 4 个能力仅在 element-plus 引擎下生效」

**代码现状**（v3.5 PR1-B 起）：

- 树形：VxeTableBody 树形分支齐备（tree-config + tree-node 列 + syncExpanded 回灌 + toggle-tree-expand 回流，VxeTableBody.vue:168-235, 476-499）；useTableCapabilities.ts:107-120 注释「不再守卫 !isVxeEngine」。
- 行拖拽：useRowDrag 挂载 vxe tbody（getTbody querySelector 兼容 vxe 嵌套结构，VxeTableBody.vue:130-147）；hotfix-7 明确取消 vxe+tree+drag 守卫（useTableCapabilities.ts:161-167）。
- 单元格合并：spanMethod/cellClassName 已绑 vxe（VxeTableBody.vue:419-421）。
- 行内编辑：EditCell 分支齐备（VxeTableBody.vue:501-508）。

**影响**：消费方按文档会把需要树形/编辑的页面全部锁死 element-plus 引擎，vxe 引擎的 PR1-B 投入被文档架空；§12 #3 同样误导排障。

**建议**：重写 §6.4 为「能力对等矩阵」（el / vxe / virtualized 三列 × 能力行），§12 #3 删除或改为「vxe + 树形 + 行拖拽三者同开时 sortablejs 兼容性尚在观察（console.debug 提示）」。

### 发现 #6：docs §3.5 引用断链

**断链点**（三处引用一个不存在的章节）：

1. docs/29:96 §1.2 Props 表 `filterParamsAdapter` 行：「详见 §3.5」。
2. ProTable.vue:124 emit 区 JSDoc：`@see docs/29 §3.5 filterParamsAdapter 服务端筛选示例`。
3. types/index.ts:577 ProTableProps.filterParamsAdapter JSDoc 引用同章节。

**实际章节结构**：§3 仅有 3.1 requestApi / 3.2 默认响应约定 / 3.3 responseAdapter / 3.4 dataCallback（docs/29:349-415），直接跳 §4。filterParamsAdapter 的完整协议（merge 语义、空数组 delete、无 adapter 缺省行为、vxe 翻译层）在正文中无章节承载，只在 demo（ProTableServerFilter.vue）与 README.md 中有散落描述。

**建议**：补写 §3.5「服务端筛选（filterParamsAdapter）」：协议形态、merge 语义（hotfix-2）、reset 复位行为、双引擎翻译层差异、与 filter-change 事件的关系。

---

## 四、边界矩阵核对表

### 4.1 服务端契约维度

| 核对项                       | 代码行为                                                                               | 文档契约                           | 结论                                               |
| ---------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| 分页参数名                   | `pageNum` / `pageSize`（useTable.ts:235-236）                                          | §3.1「params 含 pageNum/pageSize」 | 一致                                               |
| 搜索参数形态                 | prop 扁平字典，serializeParams 剔除 undefined/null/''（useSearch.ts:26-33）            | §3.1「合并后的搜索参数」           | 一致（e2e 关注的 demo 层 {customer} 字典形态如实） |
| 默认排序序列化               | `{ orderByColumn, isAsc: 'asc'\|'desc' }`（useTable.ts:114-117）                       | §5.2 默认约定                      | 一致                                               |
| sortParamsAdapter 触发面     | 仅 sortable='custom' 列（useProTableEvents.ts:169-171）                                | §5.2 未明说 custom 限定            | 文档欠披露（发现 #15）                             |
| filterParamsAdapter 协议     | merge 语义 + 空数组 delete（useTable.ts:381-398）；无 adapter 时仅 UI 记忆（:222-226） | §1.2 表引用 §3.5（不存在）         | 断链（发现 #6）                                    |
| demo ServerFilter 与真实契约 | mock filter-orders.ts 消费 statusList/deptList + pageNum/pageSize                      | §3.1                               | 一致                                               |
| demo ServerSort 与真实契约   | mock sort-orders.ts 消费 orderByColumn/isAsc + customer + pageNum/pageSize             | §5.2                               | 一致                                               |

### 4.2 大数据维度

| 核对项                     | 代码行为                                                                                                                | 文档契约                                  | 结论                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------- |
| 虚拟滚动强隔离             | 行编辑/树形/汇总/合并/拖拽冲突 warn+忽略（useVirtualScroll.ts:74-84）                                                   | §1.2 virtualized 行「强隔离…warn + 忽略」 | 一致                                     |
| virtualized + vxe 冲突     | engineConflict 标记 → 编排层 handleEngineFallback 回退 element-plus（useVirtualScroll.ts:64-71；ProTable.vue:283-285）  | §6.3 引擎回退                             | 一致                                     |
| virtualized + selection 列 | v2 列过滤 + warn（ElementTableV2Body.vue:381-397）                                                                      | 未披露                                    | 发现 #12（§12 未列）                     |
| virtualized + 筛选         | v2 检测 tableProps.filters 非空数组 warn（ElementTableV2Body.vue:406-421；注意 demo 的空数组占位 `filters: []` 不触发） | 未披露                                    | 发现 #12（§12 未列）                     |
| 万级数据排序/筛选路径      | vxe 引擎 sortable 列 sort-change → custom 判定 → 请求；filter-change → localFilterMap 合并 → setFilter → 请求           | §6.2「>1 万行用 vxe」                     | 路径通，但 reserve 组合有缺陷（发现 #3） |
| vxe sort-config.remote     | hasCustomSort 判定开 remote（vxe-column.ts:78-80；VxeTableBody.vue:416）                                                | 未披露                                    | 实现自洽                                 |

### 4.3 状态保持维度

| 核对项                  | 代码行为                                                                                             | 文档契约                         | 结论                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------- |
| 持久化字段集合          | searchParams / page / pageSize / sortState（useStatePersist.ts:31-37）                               | §1.2「持久化搜索/分页/排序状态」 | 一致，但 filterState 未纳入（发现 #9） |
| 恢复时机                | sessionStorage alive 标记 + beforeunload 清除（useStatePersist.ts:69-119）；F5 不恢复 / 路由返回恢复 | §1.2「F5 刷新不恢复」            | 一致                                   |
| 快照注入时机            | read() 在 useTable 创建前同步调用，初值注入避免双发（useTable.ts:50-55, 174-175）                    | 未披露                           | 实现自洽（发现 #17 注释不符）          |
| 快照结构校验            | isValidSnapshot fail-safe，非法即清除（useStatePersist.ts:93-119）                                   | 未披露                           | 实现自洽                               |
| 树形 + 列设置持久化组合 | 树列 prop 与其他列同等参与 order/visible/fixed 持久化（useColumns.ts），无特殊冲突                   | §7.2 未提                        | 无缺陷                                 |
| expandedStatePersist    | SearchForm 级 localStorage[`${tableKey}:search-expanded`]（types/index.ts:663-670）                  | §4.6                             | 一致                                   |
| 列设置持久化 fail-safe  | isValidPersistedSetting 形状校验（useColumns.ts:121-123）                                            | §8.2                             | 一致                                   |

### 4.4 双引擎契约差异维度

| 核对项                       | element-plus 引擎                                     | vxe-table 引擎                                                          | 文档化？                        | 结论                  |
| ---------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------- | --------------------- |
| 多选跨页（reserveSelection） | el-table reserve-selection，selection-change 回传全量 | checkbox-config.reserve + 本地镜像（VxeTableBody.vue:375-377）          | types/index.ts:410-414 声称映射 | 实现有缺陷（发现 #3） |
| 单选列（radio）              | 自绘 ElRadio（ElementTableBody.vue:299-306）          | vxe 内置 type='radio'（vxe-column.ts:43）                               | 未披露                          | 实现自洽              |
| 排序事件负载                 | SortChangeEvent 原生                                  | {field,order} → SortChangeEvent 翻译（VxeTableBody.vue:317-322）        | ProTable.engine.spec 有测试     | 一致                  |
| 筛选事件负载                 | el-table 全表快照（可能残缺）→ 直接透传               | 单列 property+values / filterList → localFilterMap 合并全表快照         | 未披露差异                      | 发现 #7               |
| 汇总行                       | show-summary + summary-method                         | 未接线                                                                  | 未披露                          | 发现 #4               |
| 展开行事件                   | expand-change → expand-toggle → treeData.toggle       | toggle-tree-expand 双向同步 + 一致守卫 noop（VxeTableBody.vue:221-235） | §1.4 注：内部事件               | 一致                  |
| 密度切换行高                 | CSS 变量即时生效                                      | 需 recalculate()（useProTableEvents.ts:156-162）                        | §12 #4                          | 一致                  |
| 引擎回退                     | 默认                                                  | 动态 import 失败 → engine-fallback（useVxeTable.ts:58-81）              | §6.3                            | 一致                  |
| clearSelection               | tableRef.clearSelection() 清 UI                       | 不可达（tableRef null），镜像清 UI 残留                                 | 未披露                          | 发现 #2               |

### 4.5 引擎级已知缺陷面维度

| 核对项                   | 核对结果                                                                                                         | 结论       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------- |
| filterParamsAdapter 边界 | merge 语义有 hotfix-2 注释与测试（useTable.spec.ts:321）；但 reset 复位链路有缺口                                | 发现 #1    |
| getFilterState() expose  | 返回 merge 后快照（useTable.ts:410-412）；integration.spec.ts:576-595 有快照用例                                 | 一致       |
| SelectionBar × 跨页记忆  | el 引擎 OK；vxe 引擎因发现 #3 残缺；clearSelection 因发现 #2 在 vxe 下 UI 残留                                   | 发现 #2/#3 |
| vxe + tree + drag 三能力 | hotfix-7 取消守卫（实测可拖），但 validateCapabilities 文案仍说「已自动忽略」（useTableCapabilities.ts:210-214） | 发现 #10   |
| filter-change 无 adapter | 仍 emit（客户端筛选快照），文档未披露                                                                            | 发现 #19   |

### 4.6 文档契约对照维度

| 核对项             | 核对结果                                                                                                                                                                  | 结论     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| §1.4 Events 三事件 | sort-change / filter-change / engine-fallback 均有 spec 覆盖（engine.spec / integration.spec 6 例 / ElementTableBody.spec / VxeTableBody.spec / useProTableEvents.spec）  | 测试齐全 |
| §1.5 Slots 表      | tableHeader/toolButton/empty/paginationLeft/paginationRight/operation/expand/search-[prop]/selectionBar 与模板透传（ProTable.vue:662-664, 695-697, 700-702, 716-719）一致 | 无遗漏   |
| §1.2 Props 表      | 31 个 props 与 ProTableProps 一一对应                                                                                                                                     | 无遗漏   |
| §6.4 / §12 #3      | 与 v3.5 PR1-B 实现矛盾                                                                                                                                                    | 发现 #5  |
| §3.5 引用          | 章节不存在                                                                                                                                                                | 发现 #6  |
| §13 测试覆盖表     | 严重不完整                                                                                                                                                                | 发现 #14 |
| §16 示例索引       | 缺 2 行                                                                                                                                                                   | 发现 #16 |

---

## 五、附录：低置信度发现（confidence: low）

| #   | 发现                                                                                                                                                        | 证据                                                                                  | 待验证方式                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| A1  | vxe 引擎 reserve 模式下，vxe 翻页恢复勾选可能逐行派发 checkbox-change（则发现 #3 不成立）                                                                   | VxeTableBody.vue:287-314 镜像逻辑本身不区分事件来源                                   | CDP 真机：vxe + reserveSelection 翻页后读 getSelectedRows() |
| A2  | el-table 在 column 未绑 filtered-value 时，reset 后其内部 filters store 可能因下次 filter-change 的首列负载重建而被覆盖（则发现 #1 的「复活」仅限多列组合） | useTable.ts:369-376 merge 语义注释（hotfix-2 实证的是「子集丢列」而非「reset 复活」） | CDP 真机：两列筛选 → reset → 再筛第三列，抓请求参数         |

---

## 六、修复批建议优先级

| 批次 | 内容                                                                  | 关联发现          |
| ---- | --------------------------------------------------------------------- | ----------------- |
| P0   | 筛选 reset 复位链路（引擎侧 clearFilters 协议）+ vxe clearSelection   | #1 #2             |
| P0   | docs §6.4 / §12 #3 / §3.5 修订（文档契约纠偏）                        | #5 #6 #12 #14 #16 |
| P1   | vxe reserve 选区回同步 + vxe summary 守卫 warn                        | #3 #4             |
| P1   | filter-change emit 语义统一（payload = getFilterState()）             | #7                |
| P2   | validateCapabilities 文案、SelectedTags 语义统一、statePersist 含筛选 | #9 #10 #11        |
| P2   | ElPagination 绑定顺序 + v2 客户端排序 warn                            | #8 #13            |
