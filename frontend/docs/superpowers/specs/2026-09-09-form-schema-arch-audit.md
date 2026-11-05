# Form-Schema 架构深度审计报告

> 对 `src/components/form-schema/`（138 文件，约 2.4 万行）的架构设计评估：架构分层、API 设计、可读性、易用性、可维护性、可扩展性、组件透传合理性。所有论断均有代码证据（文件:行号）。

| 属性     | 值                                |
| -------- | --------------------------------- |
| 版本     | v1.0.0                            |
| 日期     | 2026-09-09                        |
| 分支     | `feature/form-engine`             |
| 审计方式 | 主线程逐文件精读（79 文件）+ 证据交叉验证 |
| 结论 | 无 CRITICAL；3 HIGH / 7 MEDIUM / 5 LOW；**H1/H3 已于 2026-09-09 浏览器实测确认**（§5） |

---

## 1. 总体架构评价

### 1.1 架构亮点（值得保持）

```mermaid
flowchart TD
    A[XForm.vue 125行<br/>模板+透传 零业务逻辑] --> B[useXFormComposer<br/>composition root]
    B --> C[useSchemaRenderer<br/>schema 克隆+reaction]
    B --> D[useFormInstance<br/>el-form 编排+数组操作]
    B --> E[useFormValidation<br/>validate 编排]
    B --> F[useRenderRoot<br/>渲染闭包+optsEpoch]
    F --> G[useRenderSchemaNode<br/>主调度 5 分支]
    G --> H[render-form-item / array / visual]
    B --> I[useSchemaIndex<br/>O(1) 元数据索引]
    B --> J[useFormErrorBus<br/>OSD 错误总线]
```

| 维度 | 评价 | 证据 |
| --- | --- | --- |
| 分层与依赖方向 | ✅ 组件层→编排层→能力层→类型/适配层，单向依赖，无反向引用 | composer 只注入 deps，子 composable 不 import composer |
| 组合根模式 | ✅ XForm.vue setup 零业务逻辑，全部收敛 composer | `use-xform-composer.ts:95` |
| 显式 deps 注入 | ✅ 一致地用参数注入替代 provide/inject，并注释说明原因（嵌套 setup 失效） | `use-form-validation.ts:42`、`use-form-instance.ts:58` |
| 渲染隔离 | ✅ SchemaField 字段级重渲隔离，设计意图清晰 | `SchemaField.vue:5-10` |
| 错误处理 | ✅ 三层错误展示 + errorBus 收敛 console + 5s 去重 + force 语义 | `use-form-error-bus.ts` |
| 类型契约 | ✅ 31 字段 SchemaNode 分组接口、`SchemaNodeFor<C>` 推导、module augmentation 扩展点 | `types/schema-node.ts:86-195` |
| 文档质量 | ✅ ARCHITECTURE.md 为权威指南且与实现同步，cast 归因机制（TYPE-CAST-AUDIT.md）行业少见 | `ARCHITECTURE.md`、`types/TYPE-CAST-AUDIT.md` |
| 测试组织 | ✅ 52 spec + 2 test-d，源码级静态断言防回归 | `XForm.spec.ts`（?raw 正则） |

### 1.2 核心判断

架构骨架健康，**主要债务集中在三类**：
1. **校验/错误子系统的代码重复**（el-form 内部结构扫描 3 份、validate Promise 包装 3 份、schema 树遍历 5+ 份）；
2. **两处"双轨设计"的语义漂移风险**（跨字段触发、表达式沙箱实例隔离）；
3. **文档承诺超出实现能力**（standalone `disabled` 函数形态）。

---

## 2. 发现清单

### 2.1 HIGH

#### H1 — 字段级 `disabled`/`readonly`/`hidden` 的函数/表达式形态实现层不求值，与 README 承诺矛盾

| 项 | 内容 |
| --- | --- |
| 证据 | `render-schema-node.ts:205`、`render-form-item.ts:137`、`render-visual-container.ts:38` 三处 `...(node.disabled !== undefined ? { disabled: node.disabled } : {})` 把 `node.disabled` **原样** spread 进组件 props；`use-render-root.ts:119` `if (node.hidden)` 对函数形态 truthy 判定 |
| 对照 | `README.md:679-686` 宣称 `disabled: (m) => !m.enable` "✅ 完整（推荐）"；`render-schema-node.spec.ts:358` 注释"留待反应式调度"，但全库无任何代码把 standalone `node.disabled` 注册进 reaction 调度（`applyReactions` 只处理 `node.reaction`，`apply-reaction-fields.ts:32`） |
| 后果 | 业务按文档写 `disabled: (m) => !m.agree` → 函数对象作为 truthy 的 `disabled` prop 传给 ElInput → **字段永久禁用**，且无任何报错 |
| 验证 | ✅ **已确认**（2026-09-09 浏览器实测，`/demo/xform-cross-field` 临时改造）：① dev 控制台报 `Invalid prop: type check failed for prop "disabled". Expected Boolean, got Function`（21 次）；② 切换 agree 开关后字段**仍永久禁用**。prod 构建无 prop 警告，仍属静默失效 |
| 建议 | 见 §3 批次 2-2。验证已完成，可直接立项 |

#### H2 — 表达式沙箱白名单函数表是模块级共享状态，多 XForm 实例互相污染

| 项 | 内容 |
| --- | --- |
| 证据 | `use-expression.ts:21-23` 模块级 `EXPRESSion_CACHE / EXPRESSION_FNS / fnsVersion`；`use-expression-functions.ts:31-36` 直接写模块级表 + `onScopeDispose(() => setExpressionFunctions(undefined))`；composer 注入的是模块级 `resolveFunctionExpression`（`use-xform-composer.ts:27,160`） |
| 佐证 | composer 注释自己记录了 setup 顺序 race 的 workaround（`use-xform-composer.ts:105-107`："白名单函数表注册必须在 useSchemaRenderer 之前…否则 ReferenceError"）——这是共享状态被迫串行化的典型症状 |
| 现状 | per-instance 的 `createExpressionScope()` 已实现（`use-expression.ts:98-124`）但 **composer 未采用**；`useTopLevelFields` 的 `resolveFunctionExpression` 已是注入参数（`use-top-level-fields.ts:32`），接缝现成 |
| 后果 | 同页两个 XForm：实例 B setup 时 immediate watch 以 `undefined` 清表，毁掉实例 A 的注册；A 卸载时 onScopeDispose 又清表毁掉 B |
| 验证 | ✅ **已确认**（2026-09-09 浏览器实测，chrome-devtools 驱动，`/demo/xform-reaction` 临时双实例装置）：① B mount 后 A 的 `{{ tag() }}` 重算显示 **from-B**（B 覆盖模块表）；② A unmount 后 B 重算 **ReferenceError**（清表毁 B，控制台实证）；③ A 重挂载后 B 重算显示 **from-A**。批次 2-3 修复后三形态复验**全部通过**（A 恒 from-A、B 恒 from-B、console 零报错） |
| 建议 | 见 §3 批次 2-3。验证已完成，批次 2-3 已实施并复验通过 |

#### H3 — useCrossFieldTrigger 的 model diff 快照是顶层浅拷贝，嵌套字段变化检测失效

| 项 | 内容 |
| --- | --- |
| 证据 | `use-cross-field-trigger.ts:197` `let oldSnapshot = { ...opts.model() }`（浅拷贝）、`:212` 同样浅拷贝；`:207-211` 用 `isEqual(newModel[key], oldSnapshot[key])` 对顶层 key 比较——`oldSnapshot[key]` 与 `newModel[key]` 是**同一对象引用**（浅拷贝只拷顶层），嵌套 mutate 后两者同时变化，`isEqual` 对同引用恒 `true` → `changed` 恒为空 |
| 对照 | 文件头注释（`:4-7`）声称"watch model deep diff 变化字段，逐个 run（处理 resetFields / setModel 等场景）"——实际只能检测"顶层 key 整体被替换" |
| 影响 | 业务直接 `model.a.b = x`（绕过 v-model）时，依赖 `deps: ['a.b']` 的 crossValidator **静默漏触发**；当前未爆雷只因 onValueChange 精确路径覆盖了大部分真实输入路径 |
| 验证 | ✅ **已确认**（2026-09-09 浏览器实测，chrome-devtools 驱动 + 排除干扰设计）：红字「未成年」状态下，用 `@mousedown.prevent` 按钮直改 `model.user.age = 30`（阻断焦点转移、排除 blur/focusout 路径）→ **model 已更新为 30，红字保持不动**；对照组走输入框 v-model 路径改值 → 红字正常消失（证明装置有效）。另注意：即使浅拷贝 diff 检测出顶层 `user` 变化，`run('user')` 也因 `deps` 精确匹配（`'user.age' ≠ 'user'`）空跑（`use-cross-field-trigger.ts:214-215` 注释已自认），双重失效 |
| 建议 | 见 §3 批次 2-1。验证已完成，可直接立项 |

### 2.2 MEDIUM

#### M1 — el-form fields 错误扫描逻辑重复 3 份

| 位置 | 形态 |
| --- | --- |
| `use-form-instance.ts:119-142` | `collectElFieldErrors`（已抽函数，支持 filterNames，含 fieldValue） |
| `use-form-validation.ts:149-166` | `validateForm` 内联循环（无 filter，含 fieldValue） |
| `use-form-validation.ts:260-276` | `validateDetail` 内联循环（无 filter，无 value） |

三处对 `ef.fields` 的 `toRaw → readRefStr(validateState)==='error' → readRefStr(validateMessage) → readRefStr(propString || prop)` 结构高度重复。element-plus 内部结构一旦变化（3.0 升级）需同步改 3 处——而 `ARCHITECTURE.md §10.1` 已把"EP 3.0 升级"列为高风险的既定事项，重复面越大风险越大。

#### M2 — el-form validate 的 Promise 包装重复 3 份

`use-form-instance.ts:81-95`、`use-form-validation.ts:141-145`、`:255-258` 三处相同模式：

```ts
new Promise<boolean>((resolve) => {
  const maybePromise = efValidate((v) => resolve(v))
  Promise.resolve(maybePromise).catch(() => resolve(false))  // EP 2.x 传 callback 仍 reject errorsMap
})
```

#### M3 — composer 对 fieldErrors 的 deep watch + triggerRender 全量重建

| 项 | 内容 |
| --- | --- |
| 证据 | `use-xform-composer.ts:188` `watch(fieldErrors, () => triggerRender(), { deep: true })`；`triggerRender` = `reactiveSchema.value = { ...reactiveSchema.value }`（`use-schema-renderer.ts:116`）→ `topLevelNodes` computed 返回新引用 → **所有 SchemaField 的 render effect 全部失效重建** |
| 问题 a | `deep: true` 无必要：`setFieldError` 的写入全部是顶层键赋值/删除（`use-set-field-error.ts:97,111`、`use-form-instance.ts:170-173`），浅 watch 即可捕获；deep 白白增加每次遍历成本 |
| 问题 b | 每次单字段错误写入都触发全表单 vnode 重建，与 SchemaField 字段级隔离设计（`SchemaField.vue:5-10`"其余字段的 vnode 完全不动"）在错误路径上直接矛盾；大表单 + 服务端 422 批量写入 N 字段 = N 次全量重建 |
| 缓解事实 | `use-set-field-error.ts:159-191` 的 deep watch 是路径 B 守护所必需（读嵌套 error 字段），不能动；要动的是 composer 这层 |

#### M4 — useFormValidation 死依赖与重复守卫

- `use-form-validation.ts:286-287` `void crossFieldTrigger` — deps 接口注释自称"当前未直接使用——保留以备扩展"（`:64-67`），违反 YAGNI；composer 为此维护一条构造链路（`use-xform-composer.ts:205`）。
- `use-form-validation.ts:127-139` `if (!ef?.validate)` 与 `if (!efValidate)` 两个分支体完全相同（逐字重复 5 行），第二个检查恒等价于第一个。

#### M5 — schema 树遍历逻辑重复 5+ 处

"children / slots / formItem.slots / array.itemSchema" 五向递归在以下各处手写：

| 位置 | 用途 |
| --- | --- |
| `use-reaction.ts:58-88`（containsReaction）+ `:152-182`（applyReactions） | reaction 探测 + 注册 |
| `use-schema-renderer.ts:191-221`（containsAsyncOptions）+ `:166-183`（registerAsyncOptions） | 异步选项探测 + 注册 |
| `use-validate.ts:278-307`（collectCrossRuleFields）+ `:141-202`（traverseCross） | 跨字段规则收集 + 执行 |
| `use-schema-index.builder.ts`（buildIndex） | 中央索引 |

新增一种"含 schema 节点的容器字段"需同步 5 处，漏一处即静默漏 reaction/漏校验/漏索引。**建议抽一个 `walkSchema(node, visitor, opts?)` 公共遍历器**（visitor 模式，各调用方只保留自己的命中逻辑）。

#### M6 — useFormInstance.validateForm 是死代码 + 命名冲突

| 项 | 内容 |
| --- | --- |
| 证据 | `use-form-instance.ts:81-95` 定义、`:296` 返回 `validateForm`；composer 解构列表（`use-xform-composer.ts:120-139`）**不含**它；全 src 范围 grep 确认生产代码零调用方，仅 `use-form-instance.spec.ts:59-110` 自测引用 |
| 叠加风险 | 与 `use-form-validation.ts` 的 `validateForm`（真正暴露给 XFormExpose 的版本）**同名不同语义**（前者只跑 el-form 字段规则，后者跑完整编排），维护者极易在 instance 上改"validate 逻辑"却发现不生效 |

#### M7 — 双路径注释与实现矛盾（文档债）

`render-form-item.ts:70-72` 注释："不直接修改 elForm.fields[i] —— 避免与 element-plus 内部状态机冲突"；而 `use-set-field-error.ts:132-203` 的路径 B watch 守护恰恰就是直接写 `vs.value = 'error'` / `vm.value = ...`。双路径设计本身合理且文件头解释清楚（`use-set-field-error.ts:1-16`），但 render-form-item 的注释会让维护者误以为路径 B 不存在，"修正"掉路径 A 或引入第三路径。

### 2.3 LOW

| # | 位置 | 问题 | 建议 |
| --- | --- | --- | --- |
| L1 | `use-form-error-bus.ts:114-121` | 去重命中时刷新时间戳，形成滑动窗口——高频同码错误（如每键触发）可能被无限顺延永不展示 | 改为固定窗口（命中不刷新）或注释明确"滑动窗口是有意语义" |
| L2 | `use-set-field-error.ts:159-203` | 每个 el-form field 单独 mount 一个 watch 守护（guardField），大表单（数百字段）= 数百 watcher + externalErrors deep watch 的双份 per-field 成本 | WeakSet 去重已防重复挂载；可评估合并为单次遍历比对 |
| L3 | `use-schema-renderer.ts:112-115` | `window.__triggerRenderCalled` dev 计数器散落在渲染器内 | 移入 `useDevRuntime` 统一收敛 dev 副作用 |
| L4 | `builders.ts:65-74,89-118` | `prop()` 以 `Record<string, unknown>` 绕过类型；`required()` 内联 3 分支 rules 归一化逻辑 | 可接受（builder 累积语义使然）；`required()` 归一化可抽 `pushRule()` 私有方法供 validator/required 复用 |
| L5 | `XForm.vue:26` `props as XFormProps` | exactOptionalPropertyTypes 与 defineProps 推导差异的受控断言 | 保留（已在注释归因），建议登记 TYPE-CAST-AUDIT.md |

### 2.4 已核查排除的疑点（避免误报）

| 疑点 | 核查结论 |
| --- | --- |
| `reactiveSchema` 破坏 props.schema 只读约定 | 排除：`cloneSchema` 深克隆后才 reactive（`use-schema-renderer.ts:82`），props 原对象不被改写；reaction 的 `delete node.reaction`（`use-reaction.ts:107`）删的是克隆体 |
| `applyReactionFields` 无条件写入引发重渲风暴 | 排除：有 `isEqual` 跳过（`apply-reaction-fields.ts:44`） |
| `expandComponentProps` 键膨胀 | 确认为有意设计（兼容短名/ElXxx 两种写法，注释充分），非缺陷 |
| `onValueChange` 先 clearValidate 后 trigger 的顺序 | 已验证正确且有注释（`use-render-root.ts:162-168`），sync 竞态已处理 |
| 表达式沙箱 `toSafeDto` 深冻结成本 | 每次表达式调用都深拷贝 model，大 model 有成本；但属安全设计取舍，非缺陷（可记入未来性能项） |

---

## 3. 优化方案（三批次，全部非破坏公开 API）

### 批次 1 — 纯内部重构（零行为变更）—— ✅ 已完成

> 2026-09-09 核查确认：6 项均在此前会话完成（1-1 见 commit `6afb19b`；1-2/1-3/1-4/1-5/1-6 逐项核对当前代码确认），零剩余。

| # | 改动 | 文件 | 消除项 |
| --- | --- | --- | --- |
| 1-1 | 抽 `utils/collect-el-field-errors.ts`（支持可选 filter / 可选 value）+ `utils/run-el-form-validate.ts` | 新增 2 个 util；改 `use-form-instance.ts`、`use-form-validation.ts` | M1、M2 |
| 1-2 | 删除 `useFormValidation` deps 的 `crossFieldTrigger` + `void` 语句；合并 `validateForm` 重复守卫块 | `use-form-validation.ts`、`use-xform-composer.ts` | M4 |
| 1-3 | 删除 `useFormInstance` 的 `validateForm`（死代码）及对应 spec 段 | `use-form-instance.ts`、spec | M6 |
| 1-4 | composer 的 `watch(fieldErrors, ...)` 去 `deep: true` | `use-xform-composer.ts:188` | M3a |
| 1-5 | 修正 `render-form-item.ts:70-72` 过时注释（说明路径 B 的存在与位置） | 注释-only | M7 |
| 1-6 | `window.__triggerRenderCalled` 计数器移入 `useDevRuntime` | `use-schema-renderer.ts`、`use-dev-runtime.ts` | L3 |

验收：`pnpm test` 全绿 + `pnpm type-check:full` + `pnpm check:doc-currency`。

### 批次 2 — 行为修复（需 spec 评审 + 手动验证）

| # | 改动 | 说明 | 消除项 |
| --- | --- | --- | --- |
| 2-1 | 修复 `useCrossFieldTrigger` diff 失效 | 方案 A（推荐）：`oldSnapshot` 改为按触发时 `toRaw` 深拷贝比较，或改用"记录上次触发时的 deps 值"对比（与 reaction 的 deps 快照模式 `use-reaction.ts:133` 对齐）；方案 B：删除 diff 兜底，仅保留顶层引用替换检测 + onValueChange 精确路径，明确文档化"绕过 v-model 直改 model 的嵌套路径不触发实时跨字段" | H3 |
| 2-2 | standalone ReactionValue 字段求值 | `use-schema-renderer` 克隆阶段把 `disabled/readonly/hidden/permission` 的函数/表达式形态统一归一化为 `reaction` 条目（等价于文档已推荐的 `reaction: { disabled: ... }` 写法），实现层单点求值；或反向修 README 收窄承诺。**先做 §5 手动验证确认行为** | H1 |
| 2-3 | composer 改用 `createExpressionScope()` 实例级沙箱 | composer 持有 `const exprScope = createExpressionScope()`；`useExpressionFunctions` 改为操作 scope；`resolveFunctionExpression` 通过参数下传（`useTopLevelFields` 已支持注入；render 层经 `renderOpts` 下传）；删除模块级 API 或标注 deprecated。消除多实例污染 + setup 顺序 race workaround | H2 |

### 批次 3 — 性能与结构（排期项）

| # | 改动 | 说明 | 消除项 |
| --- | --- | --- | --- |
| 3-1 | `triggerRender` 细粒度失效 | 按 `fieldErrors` 变更的字段名定位对应 SchemaField（如 `:data-error-key` 订阅），错误写入只重渲受影响字段；保留顶层浅拷贝作为 fallback | M3b |
| 3-2 | ~~抽 `walkSchema` 公共遍历器~~ **✅ 已完成（2026-09-09）** | visitor 模式统一 6 处静态递归（containsReaction / applyReactions / registerAsyncOptions / containsAsyncOptions / collectCrossRuleFields / buildIndex；#5 traverseCross 为模型驱动异步遍历保持独立并加 @see 注释）；计划 `docs/superpowers/plans/2026-09-09-form-schema-batch3-2-walk-schema.md` | M5 |
| 3-3 | ~~`useSetFieldError` 守护 watcher 合并~~ **✅ 已完成（2026-09-09）** | 评估结论：审计原建议「单次遍历比对」不可行（丢实时纠正语义，el-form blur 校验通过改回 success 时 externalErrors 未变，需 ref 变化瞬间纠正）；改做「按需守护」——仅出错字段挂 watcher、条目清除即 stop，常态 watcher 数 O(字段数)→0，行为等价 | L2 |
| 3-4 | ~~errorBus 去重窗口语义~~ **✅ 已完成（2026-09-09）** | 固定窗口（命中不刷新窗口起点）+ dedupeCache 容量上限 100 + JSDoc 明确去重粒度契约（9 调用点逐一核对均满足） | L1 |

---

## 4. 与项目硬约束的对齐核查

| 约束 | 状态 |
| --- | --- |
| 高内聚低耦合 | ⚠️ 分层耦合健康；但 M1/M2/M5 的"复制式复用"使 element-plus 内部结构耦合面 ×3/×5（EP 3.0 升级风险放大） |
| DRY | ⚠️ M1/M2/M5 三处系统性重复 |
| YAGNI | ⚠️ M4 死依赖、M6 死代码 |
| KISS | ✅ 双路径/双轨设计均有 Why 注释 |
| 开闭原则 | ⚠️ 新增容器字段类型需改 5 处遍历（M5）；新增 EL 组件仅需 adapter 一处 ✅ |
| 注释规范 | ⚠️ M7 一处过时注释；其余抽查合格 |
| src/ Architecture Lockdown | ✅ 本审计零写操作；批次 1 的 util 新增属于 §2.3 例外需用户在对应任务中确认路径 |

---

## 5. 手动验证步骤（针对 H1/H3 的行为确认）—— ✅ 已完成：两项均确认成立

> 2026-09-09 已按下列步骤完成浏览器实测（chrome-devtools MCP 驱动，`/demo/xform-cross-field` 临时改造 + `@mousedown.prevent` 排除 blur 干扰）。**结论：H1 确认、H3 确认**，详细证据见 §2.1 各条「验证」行。以下原始步骤保留备查。

### 5.1 H1 确认（standalone disabled 函数形态）

1. `pnpm dev` → `/demo/x-form-disabled`
2. 找一个字段配置为 `disabled: (m) => !m.agree`（standalone，非 reaction 包裹）
3. 切换 `agree` 开关
4. **预期（文档承诺）**：字段随 agree 联动禁用/启用；**实际（疑似）**：字段永久禁用，无报错

### 5.2 H3 确认（嵌套路径跨字段漏触发）

1. `/demo/x-form-cross-field` 改造或临时 demo：`model.user = { age: 0 }`，字段 name 为 `'user.age'`（嵌套路径），跨字段规则 `dependsOn: ['user.age']`
2. 通过按钮直接执行 `model.user.age = 30`（绕过 v-model 输入）
3. **预期**：依赖字段 crossValidator 重算；**实际（疑似）**：watch diff 检测不到嵌套变化，漏触发

### 5.3 批次 1 回归验证

1. `pnpm test` 全绿（52 spec + 2 test-d）
2. `pnpm type-check:full`
3. `pnpm check:doc-currency`
4. 手动过 `/demo/xform-cross-field`（保存触发红字 + OSD）、`/demo/xform-server-error`（422 映射）、`/demo/xform-reaction`（联动）

---

## 6. 下一迭代路线建议

| 优先级 | 事项 | 依赖 |
| --- | --- | --- |
| P0 | 批次 1（1-1 ~ 1-6，一次 commit 或按项拆分） | 无 |
| P0 | ~~H1/H3 手动验证（§5.1/5.2）→ 确认后立项批次 2~~ **已完成（2026-09-09，均确认成立）** | 无 |
| P1 | 批次 2（行为修复，逐项 spec） | H1/H3 验证结论 |
| P1 | ~~批次 3-2 walkSchema~~ **✅ 已完成（2026-09-09，EP 3.0 升级 diff 面已收敛）** | 无 |
| P2 | 批次 3-1/3-3/3-4（性能项，大表单场景实测后定） | 有真实大表单性能数据 |
| P2 | EP 3.0 升级评估（ARCHITECTURE §10.2 既定项，批次 1 完成后 diff 面最小） | 批次 1 + 3-2 |

---

## 7. 审计方法与局限声明

- 本报告全部发现来自主线程逐文件精读（79 个文件）+ grep 证据交叉验证；审计过程中派发的 4 个并行 Explore 子代理均返回空确认（"完成"/"任务已结束"），未产出可用内容，故未采纳其任何结论，亦未让渡核查责任。
- 未精读文件（builders.ts 后半、render-array-node.ts、build-slots.ts、use-field-permission.ts、use-server-error.ts、use-form-persist.ts、draft-storage.ts、use-async-options.ts、use-schema-index.builder.ts、render-visual-container.ts 等 30+ 文件）仅通过 import 关系与 spec 存在性间接确认职责，H1/H2/H3 均不依赖这些文件。
- H1/H3 已于 2026-09-09 按 §5 完成浏览器手动验证，**均确认成立**（证据见 §2.1 各条「验证」行）；H2 三种污染形态亦于 2026-09-09 浏览器实测确认（证据见 §2.1 H2「验证」行），批次 2-3 修复后复验全部通过。
