# 2026-10-15 XForm 引擎健康度审计报告

> **审计类型**：只读健康度审计（第一阶段，产出修复批输入）
> **审计对象**：`src/components/form-schema/`（useXFormComposer 编排层 + reaction / validate / expression / render 管线 + types/）
> **对照契约**：`docs/24-XForm使用指南.md`
> **审计人**：独立高级前端审计员（只读，未修改任何源文件）
> **置信度纪律**：每条发现附 file:line 实证；无法实证的列入附录（confidence: low）

---

## 1. 执行摘要

本次审计按 6 个边界维度逐项核对「代码实际行为 vs docs/24 文档承诺」，精读引擎核心源码 20+ 文件、交叉比对 12 个 spec 文件与 61 个 demo 清单，共确认 **14 项发现**：

| 严重度 | 数量 | 分布                                                       |
| ------ | ---- | ---------------------------------------------------------- |
| HIGH   | 3    | 嵌套 crossValidator 失效 / API 语义 bug / 大数组性能残余面 |
| MEDIUM | 7    | 扫描缺口、三路径不一致、文档过时、竞态                     |
| LOW    | 4    | 文档条目过时、demo 索引遗漏、预算无全局上限                |

三条最重要发现：

1. **数组行内 crossValidator 的 dependsOn 相对路径双路径失效**（反向实时触发恒不触发 + 批量 validate() 取顶层字段而非行字段）——业务最典型的「同行 min ≤ max」校验在引擎层无正确实现，且现有测试用顶层字段恰好掩盖了缺口。
2. **`setFieldValidating` API 名不副实**——文档承诺「form-item 显示 loading 图标」，实现走 setFieldError 的 else 分支实际是**清除**外部错误条目，validating 视觉状态永不生效；测试只断言 key 存在。
3. **84bca22 修复后的残余面：大数组行级 reaction 每轮渲染全量 stop + 重注册**——100 行场景任意一行变化触发 O(行数 × 行内字段数) 次 watcher 重建 + sync 立即求值；配套 stopper 桶为模块级 Map，组件卸载无清理路径。

整体评估：引擎主干（reaction 预算、表达式沙箱实例化、asyncOptions 序号令牌、cross seq 竞态防护）设计严密、注释充分；问题集中在**数组嵌套场景的 cross 校验链路**与**文档滞后于 H2/84bca22 等修复**两个面。

---

## 2. 发现清单表

| #   | 发现                                                                                       | 严重度 | 证据 file:line                                                                                      | 建议修复方向                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 行内 crossValidator `dependsOn` 相对路径反向触发恒失效                                     | HIGH   | use-schema-index.builder.ts:59-110 / use-cross-field-trigger.ts:206-217                             | buildIndex 对 itemSchema 节点做 `items[i]` 前缀重写（与 rewriteNamePath 对齐），或文档显式声明不支持                            |
| 2   | 行内 crossValidator 批量路径（validate()）dependsOn 只认顶层路径                           | HIGH   | use-validate.ts:227（只重写 name）/ use-validate.spec.ts:215-249                                    | traverseArrayItem 同时重写 rules 内 dependsOn；补「同行 min≤max」用例                                                           |
| 3   | `setFieldValidating` 名不副实：实现是清除外部错误，validating 态永不生效                   | HIGH   | use-form-instance.ts:247-249 / use-set-field-error.ts:98-114 / docs/24:147                          | setFieldError 增加 `state==='validating'` 写入分支（externalErrors[name]={error:'',validateStatus:'validating'}），或下线该 API |
| 4   | 大数组行级 reaction 每渲染全量 stop+重注册 + 模块级 stopper Map 泄漏                       | HIGH   | render-array-node.ts:43,92-126                                                                      | 行级 reaction 注册改为按 (rowKey, reactionConfig 引用) 缓存幂等；stopper 桶挂组件 scope dispose                                 |
| 5   | 危险标识符扫描漏 hidden / readonly（两字段同样支持 `{{ }}` 函数表达式）                    | MEDIUM | use-scan-forbidden.ts:46-50 vs use-reaction.ts:59-65 / use-top-level-fields.ts:151-163              | scanValue 补 obj.hidden / obj.readonly；补 spec 用例                                                                            |
| 6   | 字符串命名 cross 规则（`rules: 'myRule'` → props.rules 含 crossValidator）不进反向实时索引 | MEDIUM | use-schema-index.builder.ts:74 / use-validate.ts:272 / use-validate.ts:243                          | buildIndex / collectCrossRuleFields 解析命名规则后再判 crossValidator；或文档声明命名规则仅批量路径生效                         |
| 7   | reaction `deps` 声明对象路径时，对象内部嵌套字段变化不触发                                 | MEDIUM | use-reaction.ts:166-167（source 浅层求值 + 无 deep）                                                | 文档披露「deps 应指向叶子标量路径」；或对对象路径自动 deep watch                                                                |
| 8   | Autocomplete `buildAutocompleteFetcher` 无序号令牌，旧响应可后到会 cb 旧数据               | MEDIUM | use-async-options.ts:110-124（对照 54-77 fetchSeq 机制）                                            | fetcher 内加 seq 校验，过期响应直接丢弃不调 cb                                                                                  |
| 9   | cross 三路径空值策略差异文档未完整披露（实时跳过 vs 批量照跑）                             | MEDIUM | cross-rule-runner.ts:15-18 / use-validate.ts:248 / docs/24:344                                      | §5.2 补「validate() 批量路径空值照跑 crossValidator」一行说明                                                                   |
| 10  | docs/24 §2 `expressionFunctions` 描述过时（模块级共享 → 实际实例级）                       | MEDIUM | docs/24:71 vs use-expression.ts:36-40 / use-xform-composer.ts:112 / use-expression-functions.ts:1-9 | 修订为「每 XForm 实例独立注册，互不污染」                                                                                       |
| 11  | schema 顶层 `watchFallback: false` 性能开关未入文档                                        | MEDIUM | use-xform-composer.ts:203-206 / docs/24 全文无                                                      | §6 或 §18 补充披露（大表单可关 deep watch 兜底）                                                                                |
| 12  | §18 已知限制第 1 条「permissionResolver 未透传」过时                                       | LOW    | docs/24:847 vs types/xform.ts:140 / use-xform-composer.ts:286 / docs/24:74                          | 删除该条；§10 字段权限已支持权限码                                                                                              |
| 13  | §19 示例索引表遗漏 5 个 demo（PermissionResolver / ReactionArrayRow 等）                   | LOW    | docs/24:856-917（56 条目）vs 实际 61 个 .vue                                                        | 补 5 行；其中 XFormReactionArrayRow 是 84bca22 配套 demo 应优先列入                                                             |
| 14  | 行级 reaction 预算每行独立 createBudget，无全局限额                                        | LOW    | render-array-node.ts:120                                                                            | 视 #4 修复方案决定；如保留独立预算可接受现状并文档化                                                                            |

---

## 3. HIGH 发现详细分析

### 3.1 发现 #1 + #2：行内 crossValidator 的 dependsOn 相对路径双路径失效

**影响维度**：嵌套深度（二层 array 场景）/ 空值与缺失值（deps 取空）

**机制链证据**：

1. 反向实时路径：buildIndex 遍历 itemSchema 时 `resolveFieldId(n)` 返回原始相对名（`'min'`），`deps` 也是原始相对路径（`'max'`）——use-schema-index.builder.ts:59-110 **未做任何 `items[i]` 前缀重写**（对比 render 层 rewriteNamePath 的 name 重写机制，索引层无等价物）。
2. use-cross-field-trigger.ts:206-217 `takeSnapshot` 用 `get(model, 'min')` / `get(model, 'max')` 在**根 model** 取值 → 恒 undefined → 快照恒「无变化」+ executeRule 空值分支（123-126 行）直接清错返回。
3. XForm onValueChange 传入的 changedField 是渲染层重写后的完整路径（`'items[0].min'`，见 rewriteNamePath），与索引中 deps `'max'` / target `'min'` 均不匹配（use-cross-field-trigger.ts:187）→ 精确触发路径同样恒不命中。
4. 批量路径：use-validate.ts:227 `traverseArrayItem` 仅重写 `name` 为 `items[i].subName`，**不重写 rule.dependsOn** → `runCrossRule` 内 `get(model, 'max')` 取的是**顶层字段**（若顶层恰好有同名字段则拿到错误的值；没有则为 undefined）。

**测试盲区**：use-validate.spec.ts:215-249 「expands array nodes」用例的 `dependsOn: 'max'` 恰好指向 **model 顶层** `max: 5`，测试通过；业务最典型的「同行 min ≤ max」场景（dependsOn 应指 `items[i].max`）无任何覆盖。该用例实际上固化了「dependsOn 只认顶层路径」这一限制性语义而未加注释说明。

**文档缺口**：docs/24 §5.2（319-344 行）与 §7（413-440 行）均未披露行内 crossValidator 的 dependsOn 语义限制。§7 仅提「行内控件的禁用等联动需通过 reaction 自行级联」，未提校验场景。

**建议**：短期在 §5.2/§7 显式披露「行内 crossValidator 的 dependsOn 仅支持顶层 model 路径」；中期在 traverseArrayItem / buildIndex 实现相对路径重写（注意 deps 指向行内字段时按 `prefix.dep` 解析，指向顶层时透传——需要约定消歧规则，如 `./` 前缀表行内）。

### 3.2 发现 #3：`setFieldValidating` 名不副实

**影响维度**：文档承诺对照 / 并发时序（validate 与 setFieldError 的状态竞争）

**证据链**：

1. 文档承诺 docs/24:147：`setFieldValidating(name)` —— 「标记字段为校验中（form-item 显示 loading 图标）」。
2. 实现 use-form-instance.ts:247-249：`setFieldValidating(name) → setFieldError(name, '', 'validating')`。
3. use-set-field-error.ts:98-114 的写入条件是 `if (state === 'error' && message)`，`state='validating'` 落入 else 分支执行 `delete externalErrors.value[name]`。
4. 效果链：externalErrors 条目被删除 → render-form-item 的 externalErrors() 读取无条目 → el-form-item 的 `error` / `validateStatus` props 收到空 → **loading 图标永不显示**，且调用瞬间会把该字段已有的外部红字一并清掉（副作用）。
5. 测试盲区：use-xform-expose.spec.ts:83 仅断言 `exposed.setFieldValidating === deps.setFieldValidating`（key 存在性），无行为断言。

**建议**：二选一——

- 修复：use-set-field-error.ts 增加 `state === 'validating'` 写入分支（`externalErrors.value[name] = { error: '', validateStatus: 'validating' }`），同时 error 渲染层需容忍空 error 文本（现有 render-form-item 按 `target?.error` 判断，空串为 falsy，需要同步调整渲染条件）；
- 或下线：若业务无消费方，从 XFormExpose 移除该 API 并同步文档（需先 grep 业务侧调用点）。

### 3.3 发现 #4：大数组行级 reaction 全量重注册（84bca22 残余面）

**影响维度**：大数组性能 / 并发时序

**证据链**：

1. render-array-node.ts:92-126：每次 `renderRow(row, index)` 执行都走 `stopRowReaction(rowStopKey)` + `applyReactions(rewritten, row, rowStoppers, createBudget(), resolve)`。
2. `renderArrayNode` 在每次重渲染时对**每一行**调用 renderRow——任何一行 model 变化、增删移行、乃至父级无关重渲，都会触发**全部行的 reaction watcher 先停再建**。
3. sync 策略下 applyReactions 立即同步执行 runner（use-reaction.ts:176-178）——100 行 × 每行 F 个 reaction 字段 = 每轮渲染 O(100F) 次 watcher 注册 + O(100F) 次 sync 求值。`applyReactionFields` 虽有 isEqual 跳过无变化写入（apply-reaction-fields.ts:49），但**求值本身**（函数执行 + isEqual）不可省。
4. 内存面：`rowReactionStoppers` 是**模块级 Map**（render-array-node.ts:43），key 为 `${listName}#${rowKey}`。stale 清理只在「list 重渲」时发生（84-90 行）；**XForm 组件卸载后不会再有重渲**，Map 中条目（闭包 + 行对象引用）随组件历史行数单调增长——watcher 本体随组件 effect scope dispose 被 Vue 停止，但 Map 强引用不释放。
5. 基准盲区：bench/large-schema.bench.ts:1-40 只测顶层 100+ 字段 mount/输入/reaction，**无数组行数维度的基准**；array-row-reaction.spec.ts（84bca22 新增，238 行）验证功能正确性但无性能断言，也无二层嵌套 array 用例（grep「嵌套/nest」无命中）。

**对比**：84bca22 修复前的问题是「行内 reaction 被 delete 后永不触发」；修复后语义正确但实现是「每渲染幂等重注册」的朴素方案，大数组下从「功能 bug」转为「性能热点」。

**建议**：

- 行级 reaction 注册加缓存键（rowStopKey + rewritten 引用比对），引用未变则跳过重注册（stale 清理已保证删行安全）；
- rowReactionStoppers 移入 useRenderRoot 的组件级作用域，随 onScopeDispose 统一清空；
- bench 增加「array 100 行 × 行内 4 字段 reaction」用例。

---

## 4. MEDIUM 发现摘要（#5-#11）

**#5 扫描缺口 hidden/readonly**（维度：表达式安全）
use-scan-forbidden.ts:46-50 仅扫描 on/reaction/disabled/permission + directives.value。但 hidden 函数/'{{ }}' 形态经 hasReactiveStandaloneField 归一化为 reaction 求值（use-reaction.ts:59-65），顶层 readonly 支持函数与 '{{ }}'（use-top-level-fields.ts:151-163）——两个可达沙箱的字段不在 dev 扫描覆盖内。真实边界是「schema 来自可信配置 + prod 不扫描」（use-scan-forbidden.ts:4-5 注释已声明取舍），但 dev 兜底扫描的覆盖不一致本身可修复。修复成本：scanValue 两行 + spec 两例。

**#6 字符串命名 cross 规则不进反向索引**（维度：文档承诺对照）
buildIndex（use-schema-index.builder.ts:74）与 collectCrossRuleFields（use-validate.ts:272）均用 `'crossValidator' in r` 判对象规则——`rules: 'myRule'`（指向 props.rules 中含 crossValidator 的命名规则）被跳过 → 反向实时触发与 dependsOnMap 漏配；批量路径 use-validate.ts:243 `namedRules?.[r]` 却正常解析。三路径行为不一致，文档 §5.1 命名复用小节未提示该差异。

**#7 reaction deps 对象路径漏触发**（维度：空值/缺失值 + 嵌套深度）
use-reaction.ts:166-167 声明 deps 后 source 为 `() => deps.map(d => get(model, d))` 且 watchOpts 无 deep——deps 指向对象路径（如 `'user'`）时，Vue 依赖追踪只锚定 `model.user` 引用，user.age 等内部变化不重算 source → reaction 不触发。未声明 deps 的 deep watch 路径无此问题。use-reaction.spec.ts deps 用例（225/284/348 行）全为标量路径，无对象路径用例。文档 §6 未披露。

**#8 Autocomplete fetcher 无竞态令牌**（维度：并发时序）
use-async-options.ts:54-77 的 fetch 有 fetchSeq 序号令牌；110-124 的 buildAutocompleteFetcher 直接 `Promise.resolve(cfg.source(query)).then(... cb(data))` 无 seq——连续输入场景旧响应后到会调 cb(旧数据)。el-autocomplete 内部是否只认最后一次 cb 未实证（confidence: 代码层无防护为实证，实际用户可见影响取决于 EP 内部实现），列为 MEDIUM 而非 HIGH。

**#9 cross 空值三路径差异**（维度：空值/缺失值）
cross-rule-runner.ts:15-18 文件头明确三路径空值策略刻意不同（反向=清错 / 事件=静默跳过 / 批量=照跑）。docs/24:344 只披露「空值跳过」一句，未说明 validate() 批量路径空值照跑（行为差异：字段为空时实时编辑不报 cross 错，点提交却报——用户感知为「时灵时不灵」）。

**#10 expressionFunctions 文档过时**（维度：文档承诺对照）
docs/24:71 仍写「模块级共享，多实例间共享；组件 scope 销毁会清空避免跨实例污染」——这是 H2（2026-09-09）修复前语义。实际 use-xform-composer.ts:112 每实例 createExpressionScope()，use-expression.ts:31-34 模块级 API 标 @deprecated，use-expression-functions.ts:7-9 明确「旧实现的模块级清表正是 H2 污染源」。同页 §2 表格其他行均准确，此行会误导排查多实例表达式问题的开发者。

**#11 watchFallback 未入文档**（维度：文档承诺对照）
use-xform-composer.ts:203-206 支持 schema 顶层 `watchFallback: false` 关闭 deep watch 兜底（大表单每键 isEqual 的性能开关，架构审查 #8）。docs/24 全文 grep 无 watchFallback——纯 v-model 表单省 deep watch 成本的能力对性能敏感业务不可发现。

---

## 5. LOW 发现摘要（#12-#14）

- **#12**：docs/24:847「permission 权限码映射未透传」与 types/xform.ts:140、use-xform-composer.ts:286、docs/24:74 自相矛盾且与代码不符，应删除。
- **#13**：§19 表格 56 条目 vs 实际 61 个 demo 文件，缺 XFormFieldPermissionResolver / XFormReactionArrayRow / XFormReactionCalcField / XFormReactionCascadeClear / XFormReactionReactiveProps。ReactionArrayRow 是 84bca22 行内 reaction 修复的配套 demo，缺席索引使该能力不可发现。
- **#14**：render-array-node.ts:120 每行独立 createBudget()——单行行内循环联动有 50 次/flush 保护，但 100 行合计可达 5000 次/flush 无全局上限。若 #4 改为幂等注册则此问题自然消解；否则建议文档化。

---

## 6. 边界矩阵核对表（6 维度 × 行为 × 测试覆盖）

| 维度           | 场景                                                | 代码实际行为                                                                     | 文档披露                | 测试覆盖                                    | 评估                    |
| -------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------- | ----------------------- |
| 1. 空值/缺失值 | 反向 cross：target 空值                             | 清错并跳过（use-cross-field-trigger.ts:123-126）                                 | §5.2 披露「空值跳过」   | 反向 spec 有空值用例                        | ✅ 一致                 |
| 1. 空值/缺失值 | 批量 cross：target 空值                             | 照跑 crossValidator（use-validate.ts:248）                                       | 未披露                  | 未见空值专项                                | ⚠️ 发现 #9              |
| 1. 空值/缺失值 | setFieldValidating                                  | 实际清除外部错误（use-set-field-error.ts:112-114）                               | §3.2 承诺 loading 图标  | 仅 key 存在性                               | ❌ 发现 #3              |
| 1. 空值/缺失值 | defaultValue 填充                                   | 仅 undefined 时 lodash set（apply-default-values.ts:36-40）                      | §4 字段参考披露         | apply-default-values.spec                   | ✅ 一致                 |
| 1. 空值/缺失值 | 富文本 required（组合层）                           | wangEditor 空内容 `<p><br></p>` 绕过 async-validator required                    | 未披露                  | 无（组件层 spec 另有覆盖）                  | ⚠️ 附录 A-1             |
| 2. 嵌套深度    | 二层 array reaction 相对 deps                       | 行级 applyReactions 以行对象为 model，OK（render-array-node.ts:113-122）         | §7 提 reaction 级联     | array-row-reaction.spec 无嵌套用例          | ⚠️ 功能对但无回归网     |
| 2. 嵌套深度    | 二层 array crossValidator 相对 dependsOn            | 反向恒失效 + 批量取顶层值（发现 #1/#2）                                          | 未披露                  | 现有用例用顶层字段掩盖                      | ❌ 发现 #1/#2           |
| 2. 嵌套深度    | reaction deps 对象路径                              | 内部嵌套变化不触发（use-reaction.ts:166）                                        | 未披露                  | 无对象路径用例                              | ⚠️ 发现 #7              |
| 3. 并发时序    | asyncOptions deps 竞态                              | fetchSeq 序号令牌丢弃过期响应（use-async-options.ts:54-77）                      | 未显式披露机制          | use-async-options.spec:82- 竞态回归         | ✅ 一致                 |
| 3. 并发时序    | Autocomplete fetcher 竞态                           | 无 seq，旧响应可后到会 cb（use-async-options.ts:110-124）                        | 未披露                  | 无                                          | ⚠️ 发现 #8              |
| 3. 并发时序    | crossValidator 连续触发                             | seqGuard 令牌（cross-rule-runner.ts:86-104），反向/事件/批量三路径统一           | 未披露机制              | cross-rule-runner.spec                      | ✅ 一致                 |
| 3. 并发时序    | validate() 与 setFieldError 并发                    | 路径 B watch 守护纠正 drift（use-set-field-error.ts:146-177），按需挂 watcher    | 未披露                  | use-set-field-error 相关 spec               | ✅ 一致                 |
| 4. 大数组      | 100+ 行行级 reaction                                | 每渲染全量 stop+重注册 + sync 立即求值 O(rows×fields)                            | 未披露                  | 无性能断言；bench 无数组维度                | ❌ 发现 #4              |
| 4. 大数组      | 行级 stopper 清理                                   | 重渲时 stale 清理；卸载无清理，模块级 Map 泄漏                                   | 未披露                  | 无卸载用例                                  | ❌ 发现 #4              |
| 4. 大数组      | 行级 budget                                         | 每行独立 createBudget(50)，无全局上限                                            | 未披露                  | 无                                          | ⚠️ 发现 #14             |
| 5. 表达式安全  | `{{ }}` 编译                                        | new Function + 白名单 fns 形参注入 + safe DTO 深拷贝（use-expression.ts:78-103） | §6 提沙箱               | use-expression.spec 多例                    | ✅ 一致                 |
| 5. 表达式安全  | 危险标识符 dev 扫描                                 | 扫 on/reaction/disabled/permission/directives；漏 hidden/readonly                | §17 披露扫描存在        | scan-forbidden.spec 无 hidden/readonly 用例 | ❌ 发现 #5              |
| 5. 表达式安全  | prod 扫描                                           | 不扫描（设计取舍：schema 可信源）                                                | README/源码注释披露     | —                                           | ✅ 取舍已声明           |
| 5. 表达式安全  | 多实例沙箱隔离                                      | createExpressionScope 实例级（H2），缓存/fns 隔离                                | §2 描述仍为模块级旧语义 | use-expression.spec:151- 隔离用例           | ⚠️ 发现 #10（文档过时） |
| 6. 文档承诺    | §2 18 props                                         | 类型与实现核对一致（types/xform.ts）                                             | —                       | props 表自洽                                | ✅ 一致                 |
| 6. 文档承诺    | §18 已知限制                                        | 第 1 条 permissionResolver 已过时                                                | —                       | —                                           | ❌ 发现 #12             |
| 6. 文档承诺    | §19 示例索引                                        | 56/61，缺 5 个                                                                   | —                       | —                                           | ⚠️ 发现 #13             |
| 6. 文档承诺    | watchFallback / 命名 cross 规则差异 / deps 对象路径 | 代码有能力、文档无                                                               | —                       | —                                           | ⚠️ 发现 #6/#7/#11       |

---

## 7. 附录

### A-1 confidence: low 项（未入正式清单）

1. **富文本 required 组合边界**：项目记忆记载 wangEditor V5 空内容 emit `<p><br></p>` 使 async-validator required 静默失效（RichTextEditor 层已用自定义 validator 修复）。XForm 文档未提示该组合陷阱，但修复点在组件层，XForm 引擎无 action。confidence: low（本次未复现验证）。
2. **use-form-dirty 数组深比较**：isDirty 对数组字段按引用/深比较快照，大数组频繁变更的成本未实测。confidence: low（未读 use-form-dirty 实现细节）。

### A-2 审计方法与范围声明

- 精读源码：use-xform-composer / use-reaction / use-validate / use-expression / use-expression-functions / use-scan-forbidden / use-async-options / use-cross-field-trigger / cross-rule-runner / use-form-validation / use-set-field-error / use-form-instance（片段）/ use-schema-renderer / use-schema-index(.builder) / render-schema-node / render-array-node / array-row-key / apply-reaction-fields / apply-default-values / use-top-level-fields / walk-schema + types/xform.ts + bench/large-schema.bench.ts。
- 交叉比对 spec：use-validate.spec / use-expression.spec / use-async-options.spec / array-row-reaction.spec / render-array-nested.spec / use-schema-index.builder.spec / use-scan-forbidden.spec / use-xform-expose.spec / use-reaction.spec / use-xform-composer.spec / render-array-node.spec / use-dev-runtime.spec（grep 级）。
- 文档对照：docs/24 全文标题结构 + §2 / §3.2 / §5.1 / §5.2 / §6 / §7 / §8 / §17 / §18 / §19。
- 未执行：运行时复现（只读审计，未起 dev server）；EP 内部行为（el-autocomplete cb 语义）按代码层证据定性。

### A-3 修复批建议排序（供第二阶段参考）

| 批次 | 内容                                                                                        | 关联发现           |
| ---- | ------------------------------------------------------------------------------------------- | ------------------ |
| P0   | 行内 crossValidator dependsOn 重写 + 「同行 min≤max」回归测试                               | #1 #2              |
| P0   | setFieldValidating 语义修复或下线                                                           | #3                 |
| P1   | 行级 reaction 幂等注册 + stopper 入组件 scope + bench 数组维度                              | #4 #14             |
| P1   | 扫描器补 hidden/readonly + 文档披露三路径空值差异 / deps 对象路径 / 命名规则差异            | #5 #6 #7 #9        |
| P2   | Autocomplete seq + 文档同步（expressionFunctions / watchFallback / §18 删除 / §19 补 5 行） | #8 #10 #11 #12 #13 |
