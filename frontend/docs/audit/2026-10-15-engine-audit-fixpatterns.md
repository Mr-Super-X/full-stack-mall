# 引擎加固 Sprint · 修复模式聚类分析报告

> **审计日期**：2026-10-15 | **审计员**：独立前端审计（只读） | **范围**：XForm/form-schema/ProTable 引擎
> **方法**：`git log --oneline -150` 全部 fix 提交聚类 → 每模式在当前引擎代码搜"同模式未修点" → spec 覆盖面对比
> **产出**：20 个修复模式、8 个同类隐患面（5 个 CONFIRMED 主清单 + 3 个附录 LOW）、6 项测试盲区

---

## 一、修复模式聚类表

| #   | 模式                                                                                                              | 历史 fix 提交                                                                             | 根因类型                         |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| P1  | reaction 求值上下文错位（行内相对 deps 用根 model 解析，watch 永不触发）                                          | `84bca22`（引擎层：顶层 traverse 跳过 itemSchema）、`91f2a6e`（demo 层：deps 改绝对路径） | 路径解析错误（上下文错配）       |
| P2  | 嵌套路径直索引 `model[node.name]` 不支持 `a.b` / `a[0].b` 路径                                                    | `07e51e0`（render-array-node + use-form-instance 修）                                     | 路径解析错误                     |
| P3  | 遍历器方向不一致（walkSchema 四向 vs 调用方实际范围，检测/处理范围错位）                                          | `84bca22`（引入 includeArrayItemSchema 开关）                                             | 边界条件遗漏                     |
| P4  | 同 tick 双写时序（clearValidate 在 crossValidator 写错之后调用，刚写的错误被清掉）                                | `3b06b6a`、`dbf2cbd`                                                                      | 时序竞态                         |
| P5  | 外部错误清除语义过宽（watch else 分支无差别清空，误清 el-form 内部 required 红字）                                | `11babdc`（改 diff 精准清理 prevErrorFields）                                             | 边界条件遗漏                     |
| P6  | 模块级共享状态跨实例污染（A mount 覆盖 B 函数表 / A unmount 清表致 B ReferenceError）                             | `245b5bd`（表达式沙箱改实例级 createExpressionScope）                                     | 状态所有权错误                   |
| P7  | 表达式编译契约不匹配（模板 `(${expr})(model)` 单参调用，事件第二参实参被丢弃）                                    | `6e499f2`（改 `(model, ...__rest__)` 多参透传）                                           | 接口契约不匹配                   |
| P8  | Vue Boolean casting（boolean prop 未进 withDefaults 且文档承诺默认开启 → 未传时被强转 false）                     | `9126f5f`（showSelectedTags 永不渲染）                                                    | 类型收窄缺失（Vue 布尔转型陷阱） |
| P9  | props 单向初始化不监听（`ref(props.x)` 只读一次，外部 v-model 动态变更不同步）                                    | `e923cb8`（density 补 watch + onUnmounted 清理）                                          | 响应式同步缺失                   |
| P10 | Date 对象格式化分支缺失（el-date-picker 默认返回 Date，走 `typeof v === 'object'` 输出 `[对象]`）                 | `143d96e`（formatDisplayValue 加 Date 分支）                                              | 边界条件遗漏（类型分支不全）     |
| P11 | vxe-table 协议版本适配（childrenField 新协议 / hasChildren 字段对齐 / flatData 树形加载 / syncExpanded 双边同步） | `2984ca4`、`46b160f`、`2373615`、`2dabaa8`                                                | 第三方库协议版本不匹配           |
| P12 | el-table filter-change payload 键名不稳定（column-key 未显式设置时键名随内部逻辑漂移）                            | `62dc65f`（ElementTableBody 补 `:column-key="col.prop"`）                                 | 第三方库隐式契约                 |
| P13 | filterState 覆盖语义丢列（el-table 2.14.x 多列连续筛选 payload 可能是残缺快照，纯覆盖擦除未变化列）               | `ed4c38a`（改 merge 语义，空数组显式 delete）                                             | 边界条件遗漏（部分快照当全量）   |
| P14 | DOM/数据双源（sortablejs 物理移动 DOM 行后取消/失败分支未还原，视图与数据错位）                                   | `0f44190`（onEnd 先 restoreDomRow 再走分支）                                              | 状态双源                         |
| P15 | DOM 事件不冒泡（原生 blur 不冒泡，监听器挂容器收不到 → 改 focusout）                                              | `5a23957`                                                                                 | DOM 事件语义                     |
| P16 | 校验错误去重误吞（5s 同 code+message 去重，用户主动 validate 第二次无反馈）                                       | `5f90a6d`（加 force 参数跳过 dedup）                                                      | 边界条件遗漏                     |
| P17 | Upload 插槽注入策略（ElUpload $slots.default 恒注入导致 trigger 孤立按钮 / text listType 空插槽零高度）           | `dbf2cbd`、`e2cf1fb`                                                                      | 组件封装契约                     |
| P18 | deps 快照 diff 漏触发（watch 兜底只比顶层 key 引用，嵌套路径直改不触发）                                          | `a44bd5b`（H3：逐路径 isEqual 快照）                                                      | 响应式追踪缺失                   |
| P19 | standalone 函数形态未归一化（disabled/hidden 函数被 spread 进组件 props / 被 truthy 判定恒隐藏）                  | `78b5be5`（H1：归一化为 reaction 条目求值）                                               | 类型归一化缺失                   |
| P20 | defaultValue 被 dev 环境变量门控（showDebugBanner 为 falsy 时 applyDefaults 不跑，生产静默失效）                  | `5a23957`                                                                                 | 环境门控逻辑错误                 |

---

## 二、同类隐患面清单（同类未修点）

### 主清单（CONFIRMED）

| #   | 位置 file:line                                                                                                                                                                                                   | 同哪个历史 fix 同模式                                                                                                                                                                                                                                                                                                                                   | 严重度                                                                                          | 置信度                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/components/form-schema/composables/use-validate.ts:166`                                                                                                                                                     | **07e51e0（P2）**：该 commit 把 render-array-node.ts:76 与 use-form-instance.ts 的 `model[name]` 直索引全改成 lodash `get`，唯独 `traverseCross` 的数组展开仍是 `const listRaw = model[node.name]`                                                                                                                                                      | **HIGH**（嵌套 array 的跨字段校验静默跳过——listRaw 为 undefined 直接 return，不报错、不校验）   | CONFIRMED                                                                                                           |
| 2   | `src/components/form-schema/composables/render-array-node.ts:43`（模块级 `rowReactionStoppers` Map）+ `array-row-key.ts:35`（原始值行回退 `i${index}`）                                                          | **245b5bd（P6）**：该 commit 把表达式沙箱从模块级共享改实例级隔离，但行级 reaction stopper 桶仍是模块级 Map；`rowKeyOf` 对 string/number 原始值数组退回 index 作 key，两个 XForm 实例各有 `['a','b']` 形态的同名 array 时 key 碰撞（`items#i0`），B 实例 renderRow 会 stop 掉 A 实例的行级 watcher（line 111 `stopRowReaction(rowStopKey)` 无实例隔离） | MEDIUM（触发条件苛刻：多实例 + 原始值数组 + 行内 reaction 同时成立；对象行 WeakMap 身份不碰撞） | CONFIRMED                                                                                                           |
| 3   | `src/components/ProTable/components/SelectedTags.vue:61`                                                                                                                                                         | **143d96e（P10）的衍生**：该 commit 用 `v.toISOString().slice(0, 10)` 补 Date 分支，但 `toISOString()` 是 UTC 转换——GMT+8 本地 2026-10-15 00:00 的 Date → UTC 2026-10-14 16:00 → 截出 `'2026-10-14'`。**东八区用户选 10-15，回显区显示 10-14（少一天）**；daterange 二元组分支（line 70）同样命中                                                       | **HIGH**（中国用户日期类筛选回显必现偏差一天；143d96e 修 `[对象]` 显示断裂时引入）              | CONFIRMED（数学上必然偏移；建议浏览器实测 el-date-picker 未设 value-format 的返回值形态后修复——改用本地时区格式化） |
| 4   | `src/components/ProTable/composables/useTable.ts:175`                                                                                                                                                            | **e923cb8（P9）**：该 commit 为 density 补了 `watch(() => props.density)`（line 183-191），但 `pageSize` 的 `ref(snapshot?.pageSize ?? props.pageSize ?? 10)` 同样只读一次初始化，外部动态修改 `pageSize` prop 不同步（density 修完 pageSize 漏修，同函数内同款模式只修一半）                                                                           | LOW-MEDIUM（业务上 pageSize 多由用户分页器驱动；但契约上与 density 修复前完全同构）             | CONFIRMED                                                                                                           |
| 5   | `src/components/form-schema/composables/use-schema-renderer.ts:191-200`（`containsAsyncOptions` 四向全扫）vs `use-schema-renderer.ts:159-188`（`registerAsyncOptions` 明确排除 array.itemSchema/formItem.slots） | **84bca22（P3）家族**（检测范围 ≠ 处理范围）：contains 扫到 itemSchema 内 asyncOptions 返回 true → 启用 reactive 管线成本，但 register 永不为其注册请求——行为由 use-scan-async-options 的 dev 警告兜底（F2 已知缺口），功能不失效但检测/注册范围错配是同模式残留                                                                                        | LOW（已有 dev 警告 + use-scan-async-options.spec 覆盖警告路径）                                 | CONFIRMED                                                                                                           |

### 附录（confidence: low，纯推测/影响面小）

| #   | 位置 file:line                                                                                                                              | 同模式来源 | 说明                                                                                                                                                                              | 置信度 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A1  | `src/components/form-schema/composables/use-validate.ts:186-208`（traverseCross 递归 children + formItem.slots，**漏 node.slots**）         | P3 家族    | crossValidator 配在 node.slots 内的节点不参与批量跨字段校验；use-schema-index.builder.ts:108 注释"不含 node.slots 与既有行为一致"——刻意决策但遍历范围与 walkSchema 四向默认不一致 | LOW    |
| A2  | `src/components/form-schema/composables/use-model-expression-rerender.ts:43`（walkSchema 无 walkOpts，扫到 array.itemSchema 内 permission） | P3 家族    | 行内 permission 表达式 → hasModelDependentExpression 返回 true → 整表挂 deep watch 重渲染（性能成本，非功能错误；行内 permission 本由行级渲染求值）                               | LOW    |
| A3  | `src/components/ProTable/composables/useSearch.ts:26-31`（serializeParams 不格式化 Date/数组值）                                            | P10 家族   | Date 对象原样进入请求 params（序列化为 ISO 字符串依赖后端容忍）；与 #3 同源但发生在请求侧而非 UI 侧——业务方可经 responseAdapter/searchParams 前置处理，属设计留白                 | LOW    |

---

## 三、测试盲区清单（有能力无 spec / spec 未覆盖修复场景）

| 能力面                                                  | spec 现状                                                                                                                          | 盲区                                                                       | 对应隐患 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| use-validate 嵌套 array crossValidator 展开             | `use-validate.spec.ts:215` 有 "expands array nodes"（仅顶层数组 `items[i].qty`）                                                   | **无嵌套路径（`orders[0].items[j].qty`）用例**——隐患 #1 无测试可拦         | #1       |
| SelectedTags formatDisplayValue Date / daterange        | `SelectedTags.spec.ts` 8 例全为 a11y / emit / 空值 / enum 翻译；**143d96e 修复时未同步补 spec**（该 commit stat 仅 1 文件 +19/-3） | 无 Date 单值 / [Date, Date] 二元组 / 时区边界用例——隐患 #3 无测试可拦      | #3       |
| 行级 reaction 多实例隔离                                | `array-row-reaction.spec.ts` 仅 1 个 describe（单实例端到端）                                                                      | 无"两个 composer 实例并存 + 同名 array + 原始值行"用例——隐患 #2 无测试可拦 | #2       |
| useTable props.pageSize 动态同步                        | `useTable.spec.ts` 有 density watch 回归（e923cb8 补）                                                                             | 无 pageSize prop 外部变更用例——隐患 #4 无测试可拦                          | #4       |
| containsAsyncOptions vs registerAsyncOptions 范围一致性 | 无直接对应用例（use-scan-async-options.spec 只覆盖警告路径）                                                                       | 无"asyncOptions 仅存在于 itemSchema 内"的集成行为断言                      | #5       |
| ProTable `_utils/searchControlRegistry.ts`              | 无 spec                                                                                                                            | 纯数据配置表（as const），盲区合理，可不补                                 | —        |

### 盲区 Top3（按风险排序）

1. **use-validate 嵌套 array crossValidator**（对应隐患 #1，校验静默失效类）——修复 = 用例补 `orders[0].items` 嵌套路径 + 源码 `model[node.name]` → `get(model, node.name)`（与 render-array-node.ts:76 同改法）。
2. **SelectedTags Date 格式化**（对应隐患 #3，UI 回显错误类）——修复 = `toISOString` 改本地时区格式化（如 dayjs/d.getFullYear() 拼串）+ 补 Date/daterange/时区 3 个用例。
3. **行级 reaction 多实例隔离**（对应隐患 #2，状态污染类）——修复 = `rowReactionStoppers` 下沉到 composer 实例（或 key 加实例 uid）+ 补双实例原始值数组用例。

---

## 四、修复模式 → 引擎文件的覆盖对照（速查）

| 模式          | 已修文件                                      | 未修遗留（本报告）                                                                          |
| ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| P2 嵌套路径   | render-array-node.ts:76、use-form-instance.ts | **use-validate.ts:166**（#1）                                                               |
| P6 模块级状态 | use-expression-functions.ts（实例化）         | **render-array-node.ts:43 rowReactionStoppers**（#2）                                       |
| P9 props 单向 | useTable.ts density watch                     | **useTable.ts:175 pageSize**（#4）                                                          |
| P10 Date 分支 | SelectedTags.vue（引入时区 bug）              | **SelectedTags.vue:61,70 toISOString**（#3）                                                |
| P3 遍历范围   | applyReactions walkOpts                       | **containsAsyncOptions/registerAsyncOptions 错配**（#5）、traverseCross 漏 node.slots（A1） |

---

## 五、下一步行动建议（引擎加固 Sprint 第二阶段输入）

1. 优先修 #1（use-validate 嵌套路径，HIGH + 校验静默失效）与 #3（SelectedTags 时区，HIGH + 用户可见）——两处均为 1-3 行级修复 + 补 spec。
2. #2（rowReactionStoppers 实例化）随 P6 模式统一治理：审计其余 `composables/` 下模块级 Map/ref（本次扫描未发现新的，但建议固化一条 lint 规则或 code review 清单项）。
3. #4（pageSize watch）顺手与 density watch 并列补齐，保持同函数内模式一致。
4. #5/A1/A2 属"范围一致性"技术债：建议把 walkSchema 方向开关从"各调用方自定义"收敛为"按用途命名的预设"（如 PRESET_REACTION / PRESET_ASYNC_OPTIONS / PRESET_VALIDATE），消灭 P3 家族的复发土壤。
5. 测试补齐：按第三节盲区表补 5 个 spec 用例（#1/#3/#4 各 1-2 个、#2 一个双实例用例）。

---

_报告完。全程只读，未修改任何源码文件。_
