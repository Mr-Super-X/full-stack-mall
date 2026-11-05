# 引擎健康度审计报告 — XForm / ProTable（2026-10-15）

> /autoplan TODOS #2「引擎加固 sprint」第一阶段（只审不修）。
> 三份独立子代理审计 + 主审查实证复核（5 条 HIGH 抽查：4 成立 / 1 证据不足降级）。
> 子报告：[`xform`](./2026-10-15-engine-audit-xform.md)（14 项）/ [`protable`](./2026-10-15-engine-audit-protable.md)（19 项）/ [`fixpatterns`](./2026-10-15-engine-audit-fixpatterns.md)（8 隐患面 + 20 修复模式聚类）

## 复核结论

| 抽查项                                                                                                              | 证据                                     | 裁决                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| 数组行内 crossValidator `dependsOn` 相对路径未重写（use-validate.ts:225 只拼 name）                                 | 实证 ✓                                   | CONFIRMED                                            |
| `use-validate.ts:166` 嵌套数组 `model[node.name]` 直索引（model 为嵌套结构，扁平 key 取不到）                       | 实证 ✓                                   | CONFIRMED                                            |
| ProTable `resetFilter()` 只清 `filterState` ref，列头筛选 UI / vxe localFilterMap 无清理通道（useTable.ts:405-407） | 实证 ✓                                   | CONFIRMED                                            |
| `setFieldValidating` else 分支 `delete externalErrors`（use-set-field-error.ts:112-114）                            | 部分实证（行为吻合，完整路径待修时确认） | PLAUSIBLE                                            |
| SelectedTags.vue:61 时区偏移                                                                                        | **文件不存在**                           | **REJECTED**（子代理路径错误，已降级为"待验证线索"） |

## 修复批规划（按数据正确性 → 状态一致性 → 文档/测试排序）

### 批 A — 数据正确性（P0，错误数据/静默跳过）

| #   | 问题                                                                                                    | 证据                                                     | 来源          |
| --- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------- |
| A1  | 数组行内 crossValidator 的 `dependsOn` 相对路径双路径失效（反向触发恒不触发；批量路径取到顶层字段）     | use-validate.ts:225 / use-schema-index.builder.ts:59-110 | xform#1       |
| A2  | 嵌套数组（array 套 array）校验 `model[node.name]` 直索引静默跳过                                        | use-validate.ts:166                                      | fixpatterns#1 |
| A3  | `reset()` 后筛选"复活"：el-table 列头筛选 UI 非受控残留，再操作时旧条件静默回参                         | useTable.ts:405-407                                      | protable#1    |
| A4  | `setFieldValidating` 名不副实：走 setFieldError 的 else 分支清错误，validating 态永不生效且误清已有红字 | use-set-field-error.ts:112-114                           | xform#2       |
| A5  | 行级 reaction 全量重注册 + 模块级 stopper 桶泄漏（84bca22 残余面）                                      | render-array-node.ts:43                                  | xform#3       |

### 批 B — 状态一致性（P1）

| #   | 问题                                                                                            | 来源          |
| --- | ----------------------------------------------------------------------------------------------- | ------------- |
| B1  | vxe 引擎 `clearSelection` tableRef 恒 null（只清镜像不清 UI）；reserve-selection 跨页镜像不完整 | protable#2    |
| B2  | Autocomplete 异步选项无竞态令牌（快速切换旧响应覆盖新值）                                       | xform#8       |
| B3  | 原始值数组行 key 跨实例碰撞误停 watcher（模块级 rowReactionStoppers）                           | fixpatterns#3 |
| B4  | useTable `pageSize` 只读初始化未跟随 density 改造（e923cb8 同类漏网）                           | fixpatterns#5 |

### 批 C — 文档与测试（P2）

| #   | 问题                                                                                                                       | 来源        |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------- |
| C1  | docs/29 §6.4/§12 #3 称 vxe 不支持树形/拖拽/合并/编辑——与 v3.5 PR1-B 实现矛盾                                               | protable#3  |
| C2  | docs/29 §1.2 与源码 JSDoc 引用的「§3.5」章节不存在（断链）                                                                 | protable#3  |
| C3  | 测试盲区补 spec：use-validate 嵌套数组（A2 防线）/ 行级 reaction 双实例（B3 防线）/ setFieldValidating 真实行为（A4 防线） | fixpatterns |
| C4  | XForm 文档 4 处过时/遗漏（表达式扫描范围 / cross 规则索引说明等）                                                          | xform#9-13  |

## 批 A 修复进展（2026-10-15 当天）

| 项                     | 状态      | 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A2 嵌套数组直索引      | ✅ 已修复 | `get(model, node.name)`（use-validate.ts）；红→绿 TDD（41/41）                                                                                                                                                                                                                                                                                                                                                                                         |
| A1 批量路径 dependsOn  | ✅ 已修复 | `rewriteRuleDeps`：行内相对**优先**、顶层绝对**回退**（双语义兼容既有"行小计≤总额"用法）；既有 spec 2 条曾红后绿 = 绝对路径回归防线                                                                                                                                                                                                                                                                                                                    |
| A1 反向触发路径        | ✅ 已修复 | builder 标记 rowScoped + composer 透传 + 行前缀 concrete 化（见下方批 A 收尾）                                                                                                                                                                                                                                                                                                                                                                         |
| A4 validating 三态链路 | ✅ 已修复 | 三层修复：①写入层 `message 非空优先`（use-set-field-error.ts，validating 条目不再被误删）②渲染层 validating 态不注入 `:error`（render-form-item.ts——EP error prop 优先级压过 validateStatus）③守护层按条目 validateStatus 同步/纠正（use-set-field-error 路径 B，不再无条件覆盖成 error）。浏览器实证：`is-validating ✓ / is-error ✗`（修复前恒 is-error），error 态与清除回归正常。生产调用点（use-form-instance.ts:248）传空 message，零行为变化风险 |
| A3 / A5                | ✅ 已修复 | 见下方批 A 收尾（2026-10-15 第二轮）                                                                                                                                                                                                                                                                                                                                                                                                                   |

**浏览器实测验收（chrome-devtools @ dev:local，2026-10-15）**：XFormCrossField（正向：不一致→报错、改一致→错误清除）/ XFormAsyncValidator（空提交→必填错误+toast）/ XFormCrossFieldReverse（反向实时清错 + 批量 cross 报错）/ XFormOrderCreate（业务表单校验）——四页全通过；console 零异常。受影响面排查：crossValidator 使用方 8 个文件，其中"数组+cross"组合 demo **0 个**（A1 场景长期无 demo 无测试即此因，已转 C3 输入）。另发现文档漂移：docs/24「路由 = /demo/x-form-<kebab>」应为 `/demo/xform-<kebab>`。

**验证方法论教训**：HMR 热更新后的页面实测出现"错误残留"假回归——经 stash 对比 + 双方 fresh reload 公平对比排除。**引擎修复的浏览器验证必须在 fresh reload 页面进行**。

## 批 A 收尾（2026-10-15 第二轮：A1-反向 + A3 + A5，批 A 全部关闭）

| 项      | 修复要点                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 浏览器实测（fresh reload @ dev:local）                                                                                                                                                                                                                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1-反向 | 数组行 crossRule 反向触发恒不触发：trigger('items[0].qty') 精确字符串匹配不到模板 deps（相对名 'qty'）。修复三层：①builder 预遍历 array.itemSchema 后代标记 `rowScoped`（CrossRuleEntry 新字段）②composer 透传 ③`resolveConcreteRule`/`concretizeRowRule` 按行前缀 concrete 化（行内相对优先、顶层绝对回退，语义同批量 rewriteRuleDeps；执行原语从 rule.dependsOn 取值故连 rule 一起副本重写）。spec +10                                                              | XFormCrossFieldReverse：不一致→报错→改依赖字段→目标字段红字自动清除 ✓（反向链路回归）。数组行 cross demo 仍为 0（上轮已转 C3），新能力由 spec 覆盖                                                                                                                                                                                                     |
| A3      | reset() 后筛选复活：resetFilter 只清 filterState，el-table 列头筛选 UI（非受控）与 vxe localFilterMap 无清理通道。修复：useTable.resetFilter 内经 tableRef 结构化调官方 `clearFilter()`（clearSelection 同款模式）+ VxeTableBody expose `clearFilter()`（清 localFilterMap + vxe 内部态）+ 编排层 reset 路径补调（el 模式 proTableVxe 为 null 自然短路）。spec +4。附带修正：vxe-table mock 缺具名导出 VxeTable/VxeColumn（真实 v4 模块形态），原"加载成功"断言空洞化 | **真实 CDP 输入重验**（首轮合成事件验证作废，见下方教训④）：真实点击「按状态过滤」→ Space 勾选待支付 → 真实点击「筛选」→ 行 10→3 + 快照 `{"status":["pending"]}` ✓ → 经 `__vueParentComponent` 调 exposed `reset()`（= SearchForm 重置按钮同一 fetchHook({reset:true}) 链路）→ 行恢复 10 ✓ + 重开面板 checkbox `[]` ✓ + `getFilterState()` 返回 `{}` ✓ |
| A5      | 行级 reaction 全量重注册 + 模块级 stopper 桶泄漏。修复：①stopper 桶 value 升级 `RowReactionEntry` 四元组（stop/index/itemSchema/rewritten），配置未变（同 rowKey+index+itemSchema 引用）跨渲染复用 watcher+副本跳过重注册 ②`useRenderSchemaNode` 每实例建桶经 opts 注入，setup 卸载时 onScopeDispose 统一 stop+clear（getCurrentScope 守卫兼容直调）；原始值行 i${index} key 跨实例碰撞（B3 关联面）随实例隔离消除。spec +6                                           | XFormReactionArrayRow：初始小计正确（含税 2×50×1.06=106）✓ 改数量联动 ✓ 切含税→税率出现+重算 339 ✓ 加新行→reaction 自动注册 ✓ console 零异常 ✓                                                                                                                                                                                                         |

**回归基线（批 A 收尾后）**：form-schema 目录全绿 + ProTable 目录全绿 + type-check PASS + 全量 specs 绿（净增 21 例）。

**验证方法论补充（本轮教训）**：①popper 常驻 DOM（display:none）——判断面板开关须读计算样式（既有记忆的复现）②EP 筛选面板"筛选"按钮在勾选后会被 Vue 重渲染替换引用——合成事件须在重查后的节点上派发 ③vxe-table 测试 mock 须镜像真实模块具名导出形态，否则组件解析路径在测试里恒空跑。④**合成事件对隐藏按钮也会派发（不检查可见性）——首轮 A3 验证点的「重置」实为隐藏筛选面板里的按钮，根本没走到 ProTable reset 编排链路；且 el-switch/checkbox 的 a11y uid 解析到隐藏原生 input，uid 直点报"not interactive"，真实交互须走「Tab 移焦点 + CDP Space/click」或坐标级输入**。引擎修复的浏览器验证必须以真实输入管线为准，合成事件仅用于无交互断言。

## 批 B 收尾（2026-10-15 第三轮：B1–B4，批 B 全部关闭）

| 项    | 修复要点                                                                                                                                                                                        | 验证                                                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| B1 #2 | vxe 引擎 clearSelection 只清镜像不清 UI：`VxeTableBody` expose `clearSelection()`（clearCheckboxRow/clearRadioRow 清 UI + 引擎侧本地镜像），ProTable expose 双通道并调（A3 clearFilter 同模式） | spec×3；EngineCompare 真实页面回归（双 vxe 实例渲染 13 行 + console 零异常）     |
| B1 #3 | reserve 跨页选区镜像残缺（vxe 恢复勾选不派发事件）：rows watch 在 reserve 分支改为 nextTick 后经 `getCheckboxRecords()` 回同步全量镜像，key 集合无变化不 emit（噪声防护）                       | spec×2（回同步全量 / 无变化不 emit）                                             |
| B2    | `buildAutocompleteFetcher` 无竞态令牌（useAsyncOptions 已有 fetchSeq，fetcher 是漏网）：per-fetcher seq，过期 resolve/reject 静默（新查询拥有 UI）。RED 经 stash 补验                           | spec×2（过期 cb 不触发 / 过期 reject 静默），stash 恢复旧实现确认 2 红           |
| B3    | 原始值行 i${index} key 跨实例碰撞：A5 实例桶已结构性消除，本批补双实例防线 spec（同 listName+同原始值行，B 渲染不得停 A 的 watcher / 换 A 的桶条目；A 重渲染命中自己缓存）                      | spec×1（曾定位出 makeOpts 返回包装对象而非 opts 的测试自身 bug，探针 DUMP 定位） |
| B4    | `pageSize` 只读初始化未跟随 density 改造：补 `watch(() => props.pageSize)`（density v3.0.1 同款；变化经既有 [page,pageSize] watcher 自动刷新；卸载 stop 合并进既有 onUnmounted）                | spec×2（跟随 / 联动刷新），RED 2 例先行                                          |

**浏览器验证面说明**：B1/B2 均无对应 demo（全项目无 vxe+selection 列 demo、无 Autocomplete+asyncOptions demo），由 spec 覆盖（与批 A「数组+cross」同型缺口，可入批 C 补 demo）；B4 无动态 pageSize demo。浏览器回归面 = EngineCompare vxe 引擎页（B1 改动后 vxe 渲染链路正常）。

## 批 C 收尾（2026-10-15 第四轮：C1–C4，批 C 全部关闭 = 审计修复批全量完成）

| 项               | 处理                                                                                                                                                                                                                                                                                             | 证据                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| C1（protable#5） | docs/29 §6.4 重写为「vxe 引擎能力对等矩阵」（el/vxe/virtualized 三列 × 能力行，PR1-B 四大能力对齐 + vxe+tree+drag 观察项）；§12 #3 同步改为观察项表述                                                                                                                                            | check:doc-currency 13 项全过                 |
| C2（protable#6） | docs/29 补写 §3.5「服务端筛选（filterParamsAdapter）」：协议形态/触发时机/merge 语义/无 adapter 缺省/双引擎翻译层/reset 复位/事件与快照——§1.2 表 + ProTable.vue emit 注释 + types JSDoc 三处「详见 §3.5」断链全部落地                                                                            | 同上                                         |
| C3               | 三项防线 spec 核对：**全部已就位无需补**——use-validate 嵌套数组（8ebe4ee TDD 已有）、行级 reaction 双实例（批 B B3 已补）、setFieldValidating 真实行为（22c12bb 已有三态断言）                                                                                                                   | use-validate + use-set-field-error 62 例全绿 |
| C4（xform#9-13） | docs/24 五处：①§2 expressionFunctions 改实例级沙箱语义（H2）②§5.2 补 cross 空值三路径差异（实时跳过 vs 批量照跑）③§18 删除已过时的「permission 权限码映射未透传」行④§4 schema 级字段表补 `watchFallback` 行⑤§19 索引补 5 个缺失 demo（ReactionArrayRow 等，56→61 闭环，「其余 53 个」同步改 60） | check:doc-currency 13 项全过                 |
| 附带             | `flattenCrossRules` 抽离（A1 的 crossRules 拍平从 composer 移到 use-schema-index.ts）——批 A 提交后 composer 363 行突破 check-doc-currency 250-350 膨胀预警，抽离后 345 行解除                                                                                                                    | check:doc-currency 13 项全过                 |

**审计修复批 A/B/C 全量完成。** 剩余未处理项均为审计清单外新增观察（reset 不发 filter-change 事件、docs/24 路由前缀漂移 x-form-/xform-、vxe+selection/Autocomplete 异步 demo 缺口），已在本文件各收尾节记录，供后续 sprint 决策。

## 批 D 收尾（2026-10-15 第五轮：审计剩余项全清 = 审计清单 100% 关闭）

| 项                 | 处理                                                                                                                                                                                                                                                                                                                         | 证据                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| protable#4（HIGH） | vxe 引擎 `enableSummary` 静默失效：useTableCapabilities 对 vxe+summary warn + 不实例化（对齐 virtualized 强隔离策略）                                                                                                                                                                                                        | spec×2（vxe null+warn / el 回归）                                                                                                          |
| protable#7         | `filter-change` payload 统一为 `getFilterState()` 全表合并快照（EP 2.14 增量负载不外泄，与 vxe 翻译层协议对齐）；旧 spec 三处同步改断言                                                                                                                                                                                      | spec×3 + **浏览器实测**：连续筛状态+部门两列 → 快照面板显示合并两列的 `{"status":["pending"],"dept":["tech"]}`（真实 CDP 点击/Space 驱动） |
| protable#8         | ElPagination `v-bind="paginationProps"` 移至受控绑定之前（后者覆盖前者，分页状态不再可被业务 props 抢占）                                                                                                                                                                                                                    | 模板修复 + 全量回归                                                                                                                        |
| protable#9         | statePersist 快照 v2 追加 filterState（v1 旧快照读时向后兼容补 {}，类型非法 fail-safe）；useTable initialState 消费 + ProTable attach 接线                                                                                                                                                                                   | spec×5（写回 v2 / v1 迁移 / fail-safe / useTable 初值×2）                                                                                  |
| protable#10        | vxe+树形+拖拽 debug 文案「已自动忽略行拖拽」→「兼容性观察中」（与 hotfix-7 后实现一致）                                                                                                                                                                                                                                      | spec×1（含旧文案不得出现的反向断言）                                                                                                       |
| protable#11        | SelectedTags「清除全部」vs「重置」语义差异 → **文档披露**（§4.3 补三种入口分页语义表），不改行为（不同名不同命，行为变更风险大于收益）                                                                                                                                                                                       | docs/29 §4.3                                                                                                                               |
| protable#13        | v2 虚拟滚动 `sortable=true` 点击无效果：ElementTableV2Body 实例级一次性 warn（与 selection 守卫同款纪律）                                                                                                                                                                                                                    | spec×2（warn 一次 / custom 不 warn）                                                                                                       |
| xform#5            | 危险表达式扫描补 hidden/readonly（两字段可达沙箱此前漏扫）                                                                                                                                                                                                                                                                   | spec×2                                                                                                                                     |
| xform#6            | 字符串命名 cross 规则（`rules: 'myRule'`）经 namedRules 解析进索引——buildIndex 加 namedRules 参数 + useSchemaIndex getter 透传 + composer 接线 props.rules（注册表替换触发重建），与批量路径 namedRules?.[r] 对齐                                                                                                            | spec×2（解析进索引 / 缺失 fail-safe）                                                                                                      |
| xform#7            | reaction deps 声明后 watchOpts 同样 deep——deps 指向对象路径（'user'）时 user.age 内部变化可触发（此前锚定引用不重算）；标量 deps 触发点不变                                                                                                                                                                                  | spec×1 + form-schema 全目录 1212 例回归                                                                                                    |
| LOW×8              | docs/29 §12 补 virtualized 行 · §13 测试表按目录分组补全（composables 17/components 13/adapters 5/utils 2/根 2）· §1.4 补 sort-change 仅 custom + filter-change 无 adapter 披露 · §16 索引补 AsyncState/ServerFilter（22→23 闭环）· §4.3 分页语义 · useStatePersist 注释（setup 期调用）· docs/24 §18 补行级 budget 上限披露 | check:doc-currency 13 项全过                                                                                                               |

**审计清单 19+14+8 项至此 100% 关闭（HIGH 全清 / MEDIUM 全清 / LOW 全清）。** ⚠️ 例外（2026-10-20 文档同步轮复核确认）：fixpatterns 子报告**隐患 #3（SelectedTags Date 回显 `toISOString` 东八区少一天，`SelectedTags.vue:61,70`）未落地修复**——本 summary 原表述与 fixpatterns 子报告矛盾，以此注记为准，该项移交后续 sprint（1-3 行修复 + Date/daterange/时区 3 个 spec 用例）。清单外观察项：~~reset 事件~~（已闭环——reset 补发 `filter-change({})`，§3.5 披露）、~~路由前缀漂移~~（已闭环——docs/24 全文 61 处修订为 `/demo/xform-`）、demo 缺口（vxe+selection / Autocomplete+asyncOptions / 数组+cross / search+filter 组合）维持留后续 sprint。

## demo 缺口补齐（2026-10-19 后续 sprint 闭环）

| 缺口                          | 验证入口                                                        | 覆盖修复场景                                       |
| ----------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| ~~数组+cross~~                | `XFormArrayCrossField.vue`（/demo/x-form-array-cross-field）    | 批 A1 行内相对 dependsOn + 反向触发 + 批量路径     |
| ~~Autocomplete+asyncOptions~~ | `XFormAsyncAutocomplete.vue`（/demo/x-form-async-autocomplete） | 批 B2 竞态令牌（发起/落地日志可视化）              |
| ~~vxe+selection~~             | `ProTableVxeRowSelect.vue`（/demo/pro-table-vxe-row-select）    | 批 B1 clearSelection 双清 + reserve 跨页镜像回同步 |
| ~~search+filter 组合~~        | `ProTableSearchFilter.vue`（/demo/pro-table-search-filter）     | 批 D reset 补发 filter-change({}) 双清             |

**至此审计发现的所有缺口 100% 闭环**（含清单内 41 项 + 清单外 5 项观察）。配套：mock filter-orders 扩展 orderNo/customer 搜索参数；docs/24 §19（61→63）/ docs/29 §16（23→25）索引与 check-doc-currency 硬数据同步。

## demo 浏览器实测暴露的清单外缺陷（2026-10-19 验证轮，2 项）

| 缺陷                                                                                                           | 根因                                                                                                                                                                                                                                                                                                              | 处理                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**vxe reserve 跨页镜像回同步 API 误用**（HIGH）~~                                                            | 批 B1 #3 修复用 `getCheckboxRecords()` 回同步——浏览器实测该 API 仅返回**当前页**勾选（`[项目-6]`），跨页保留行在 `getCheckboxReserveRecords()`（`[项目-1, 项目-2]`）。翻页后旧行被从镜像冲掉，跨页累计读取只剩当前页。spec mock 曾错误假设前者为全量（与批 A「mock 须镜像真实形态」同型教训）                     | **已修复**：rows watch reserve 分支改两 API 合并 + keyField 去重；spec mock 补 `getCheckboxReserveRecords` 并修正语义（TDD：先 RED 后 GREEN）；浏览器实测「第 1 页勾 2 行 + 第 2 页勾 1 行 = 累计 3 行」实证                                                                                                                                                                                                                                         |
| ~~**cross 规则透传 el-form 致 number 目标字段保存被拦截**~~（MEDIUM，~~留后续 sprint~~ **已根治 2026-10-19**） | XForm `compileRules` 把含 `crossValidator` 的规则原样透传 el-form-item → async-validator `getValidationMethod` 对「非纯 required」规则回退 `type: 'string'`（源码 `rule.type \|\| 'string'`）→ cross 目标字段为 number 时保存全量校验报「is not a string」。既有 demo 未暴露因 cross 目标均为 string（日期/密码） | **已根治**：compileRules 拆分含 crossValidator 的规则——纯 cross 整条不进 el-form（XForm 三路径全权接管）；混合规则（crossValidator + required 同条）剔除扩展键后保留字段校验部分，防必填静默丢失；TDD spec ×4（compile-rules.spec 红→绿）；demo 规避写法（显式 `type:'number'`）已撤销；浏览器实测 ArrayCrossField 批量路径 FIELD_ERROR ×2 + CROSS_VALIDATION_FAILED 零类型误拦、实时反向/消除正常，CrossField 短路语义保持；form-schema 1221 例全绿 |

## 返工轮再暴露的引擎缺陷（2026-10-19 第二轮，demo 场景 = 真实业务形态的实证）

> 用户手动验证反馈后返工，返工场景恰好命中此前所有 demo 都绕开的两个形态：**itemSchema 对象容器**（column/row 布局）与**同字段多条 cross 规则**——A1 修复的两处漏网。

| 缺陷                                                                           | 根因                                                                                                                                                                                                                                                                                            | 处理                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**A1 批量路径行前缀不递归 children**（HIGH）~~                               | `traverseCross` 的行前缀重写只在 `traverseArrayItem` 处理直接子节点；itemSchema 为对象容器（无 name、字段在 children）时 children 的 name 没加 `rows[i]` 前缀 → 批量 cross 的 `dependsOn` 取顶层 `undefined` 空值跳过，**该行全部 cross 规则静默通过**（spec 复现：`isValid: true` 应为 false） | **已修复**：`traverseCross` 加 `namePrefix` 参数在 children/formItem.slots 递归中透传（嵌套数组语义保持）+ spec ×1（use-validate.spec 对象容器形态防线）                                                                                       |
| ~~**反向触发 runner 缓存键冲突，同 target 多规则只执行第一条**（HIGH）~~       | `getRunner` 缓存 key 为 `${target}\|${delay}` 字符串——同 target 多条 cross 规则（「数量≤库存」+「数量≤上限」）key 相同，第二条命中第一条的缓存 runner（闭包绑第一条 rule 引用）→ 第二条规则永不执行（实测：改上限不标红，保存批量路径正常——两路径行为分裂是定位关键线索）                       | **已修复**：缓存 key 改 rule 引用 `Map<ReverseRule, Runner>`，同 target 每条规则独立 runner + 同 target 不同 delay 清理逻辑保持 + spec ×1（use-cross-field-trigger.spec 两规则分别 trigger 各自 deps）                                         |
| ~~**Autocomplete 竞态令牌被渲染层重建 fetcher 架空**（HIGH，批 B2 实证修正）~~ | `buildAsyncProps` 每次重渲染都新建 `buildAutocompleteFetcher` 实例——seq 闭包归零，每次输入都用 seq=1 的"新"实例 → 慢响应全部落地，竞态令牌形同虚设（浏览器实测：发起 5 / 落地 5 零丢弃）。批 B2 spec 只测单实例多次调用，未覆盖实例复用                                                         | **已修复**：`WeakMap<asyncOptions 引用, fetcher>` 按配置复用（同节点 seq 累计，配置替换自动失效）+ spec ×2（build-slots.spec：重渲染引用相等 / 复用实例竞态丢弃）。修复后实测：输「张三丰」逐字 3 次搜索 → 发起 3 / 落地 1，2 个旧响应被丢弃 ✓ |

**验证方法论教训（第二轮）**：①「保存批量路径正常 + 实时反向路径失效」的行为分裂 = 两条路径独立排查的分界证据，比全链路盲查快得多；②demo 场景选型即回归形态选型——数组平铺 itemSchema + 单 cross 规则的 demo 形态恰好同时绕开这两个 bug，返工引入的对象容器 + 多规则形态才让缺陷现形。

另：**Autocomplete asyncOptions loading 注入未适配**（批 B2 姊妹缺口）与 **vxe radio 跨页保持未接线**（radio-config.reserve，用户手动验证暴露）同轮修复，见 CHANGELOG。

## 使用说明

- 每批开工时按本清单建任务，修复后把对应行标记 ✅ 并补回归 spec（C3 是各批的验收成分）
- A5/B3 涉及模块级状态，修复时顺手做"卸载清理路径"（onScopeDispose 注册）
- 修复批顺序：A → B → C；A 批内 A1/A2 同源（嵌套路径解析），建议同一人/同批修
- 修复期间如发现清单外问题，先入 `docs/audit/` 追加记录，不扩大当批范围
- **每个修复项的验收 = 单测红绿 + 受影响 demo 浏览器实测（fresh reload）双证据**

## 验证基线（修复批开工前应保持）

196 unit specs + 12 e2e 全绿 · check:doc-currency 13 项 · type-check PASS
