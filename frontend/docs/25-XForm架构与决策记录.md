# 25-XForm 架构与决策记录（维护者视角）

> 本文由原 `26-XForm架构总览.md` 与 `27-XForm决策记录-ADR.md` 合并而来，数据按当前代码修正（2026-08-26）。
> **使用指南见 `docs/24-XForm使用指南.md`**；本文面向维护者与接手引擎开发的人。
> **完整设计规范见 `packages/ui/src/components/form-schema/ARCHITECTURE.md`**。

> **TL;DR** — form-schema 引擎分四层：Schema 定义层 → Composable 编排层 → Render 渲染层 → Demo 应用层。当前规模：**63 个 `.spec.ts` + 2 个 `.test-d.ts` 测试文件（合计 65）、63 个 demo（全部位于 `examples/XForm/` 目录，`XForm.vue` 为主入口）** 覆盖全部关键能力。核心设计决策：schema 对象 DSL + 链式 Builder 双轨、自研跨字段 crossValidator（三路径执行语义统一于 `cross-rule-runner.ts`）、v-model 写入后主动触发（不依赖 watch）。

---

## 1. 模块边界

```text
┌──────────────────────────────────────────────────────────┐
│ 应用层：apps/docs/src/modules/demo/examples/XForm/        │
│   （63 个 demo 文件，全部位于 XForm 目录）                │
├──────────────────────────────────────────────────────────┤
│ 引擎层：packages/ui/src/components/form-schema/            │
│                                                          │
│   XForm.vue（顶层组件）                                    │
│   ├─ useXFormComposer     顶层编排（11+ composable 装配） │
│   │   ├─ useSchemaRenderer   编排 + cloneDeep + reaction │
│   │   ├─ useSchemaIndex      schema 元数据索引（O(1)）   │
│   │   ├─ useFormInstance     el-form + 委托 useSetFieldError │
│   │   ├─ useCrossFieldTrigger 反向跨字段精确触发         │
│   │   ├─ useFormValidation   el-form.validate + crossValidator │
│   │   ├─ useFormDirty        dirty 快照追踪             │
│   │   ├─ useServerError      服务端错误适配             │
│   │   ├─ useTopLevelFields   顶层 schema 字段（11 个）    │
│   │   ├─ useFormErrorBus     错误事件总线（OPT-7 OSD）   │
│   │   └─ useCurrentBreakpoint 断点监听（xs~xl）           │
│                                                          │
│   render-schema-node（节点 → VNode 主入口，P2-B 拆 4 文件）│
│   ├─ resolve-component / compile-rules / wrap-with-elcol │
│   ├─ build-slots / render-form-item / render-array-node │
│   └─ render-visual-container / render-with-grid         │
│                                                          │
│   use-validate（字段规则 + 跨字段 + Zod）                 │
│   use-reaction（sync/debounce/throttle 调度）            │
│   use-expression（{{ }} 函数表达式沙箱）                 │
│   use-async-options / use-field-permission               │
│   use-form-persist（+ draft-storage）                    │
│   use-scan-forbidden（表达式安全扫描）                    │
│                                                          │
│   types/（P1 拆 14 文件；SchemaNode 35 字段 + SchemaNodeFor）│
│   builders/（29 个链式 builder 入口，含 ArrayBuilder）    │
│   adapters/element-plus-adapter.ts（默认 props；          │
│   短名映射由 composables/resolve-component.ts 的           │
│   EL_COMPONENT_MAP 单源派生，33 短名 + 2 El 别名）         │
│   index.ts（插件 + 具名导出）                             │
└──────────────────────────────────────────────────────────┘
```

## 2. 渲染管线（schema → DOM）

```text
props.schema 变化
  ↓
useSchemaRenderer：cloneDeep + reactive 包装 → reactiveSchema
  ↓
topLevelNodes computed（读 fieldErrors 建立响应式依赖，保证 setFieldError 后重渲染）
  ↓
顶层分派：
  ├─ 有 column → ElRow + ElCol（span = floor(24/column)）
  ├─ 有 row    → ElRow（gutter/align/justify + responsive 拍平）
  └─ 无        → 直接渲染节点
  ↓
renderToComponent（外层包装：ignore 跳过 / hidden → withHidden / directives）
  ↓
renderInner（useRenderSchemaNode）：
  ├─ permission gate（hidden 不渲染 / view 纯文本 / edit 继续）
  ├─ array 节点 → renderArrayNode（itemSchema × 每行，name 重写 items[0].x）
  ├─ 视觉容器（无 name 且有 children/slots）→ renderVisualContainer
  ├─ formItem 包裹（label/rules/外部错误 props.error + validateStatus）
  └─ v-model 绑定（lodash get/set 路径） + on 事件（函数/表达式）+ asyncProps
```

## 3. 触发器层级（关键设计）

**任何 model 字段变化 → 触发的链路（从内到外）**：

```text
model 字段写入
  │
  ├─→ buildVModelBindings 写入 model[name]（lodash get/set 路径解析）
  │   └─→ onValueChange(node, newValue)
  │       ├─→ triggerCrossFieldValidator(node, 'change')  自身规则
  │       ├─→ crossFieldTrigger.trigger(node.name)        反向精确触发（只跑 deps 含本字段的规则）
  │       └─→ clearValidate([node.name])                  自动清除服务端错误红字
  │
  ├─→ use-reaction：watch(() => model, runner, { deep: true })
  │   └─→ applyReactionFields 写 node.disabled / props / label / ...（跳过 strategy/delay 元字段）
  │
  └─→ onBlur / onChange（form-item 触发）
      └─→ triggerCrossFieldValidator(node, 'blur' | 'change')
          └─→ matchTrigger 过滤（未指定默认 blur / manual 只在 validate() 跑）
```

**核心洞察**：

- **v-model 写入后主动触发**，而非 watch——`vue Proxy + lodash set 链路 watch 不可靠`是 P0 阶段 4 次调试（6+ 小时）换来的结论，整个触发器系统以此为基础
- watch deep model 仅用于 reaction 调度与断点重渲染
- `manual` trigger 的跨字段规则只在 `validate()` 时跑

## 4. 校验双通道

```text
validate()
  ├─→ el-form.validate（字段内 async-validator 规则）→ 失败直接 false
  └─→ runCrossFieldValidation（跨字段 crossValidator，支持异步 await）
      └─→ applyCrossErrors：setFieldError 写入 form-item 红字

setFieldError（阶段 3.1 重构后的双路径）
  ├─→ 路径 A：externalErrors ref → form-item props.error + props.validateStatus（官方路径）
  └─→ 路径 B：watch 守护（监听 externalErrors 与 el-form.fields 注册，
       强制把内部 validateState/validateMessage 纠正为 error，对抗 validate 成功回调的覆盖）
```

## 5. ADR 决策记录（P0 → P3-B）

> 状态标注：✅ 已实施 / ⚠️ 部分解决 / ❌ 已被后续阶段取代

### ADR-001：Schema DSL 选用对象字面量 + 链式 Builder ✅

- **备选**：JSON Schema（标准但跨字段联动表达弱）/ JSX（类型好但运行时不灵活）/ 对象字面量 + Builder
- **决策**：对象字面量 + Builder 双轨——简单场景用字面量，类型安全场景用 Builder
- **影响**：SchemaNode 35 字段、29 个链式 builder 入口（含 ArrayBuilder，builders/ 目录实际导出 29 个 `xXxx` 入口）、链式 TS 推断有 cast 残留（见 ADR-007）

### ADR-002：自研 crossValidator 而非 el-form validator ✅

- **备选**：element-plus 原生 `validator`（单字段，不能跨字段）/ 自定义 `crossValidator`
- **决策**：自定义 `dependsOn` + `crossValidator`（保留原生 validator 兼容）——中后台跨字段约束极常见（密码确认/日期区间/xor）
- **影响**：`RuleItem` 扩展两字段；`runCrossFieldValidation` 调度；同步/异步 Promise 双支持

### ADR-003：数组节点独立 `kind: 'array'` ✅

- **备选**：children 数组存行（类型混乱）/ 独立 `array: ArrayNodeConfig`
- **决策**：独立 kind——`itemSchema/minItems/maxItems/labels/showActions` 语义独立，行 name 经 `rewriteNamePath` 拍平为 `items[0].qty`

### ADR-004：不依赖 el-form 自动 validate 的触发器 ✅

- **备选**：el-form 自动 validateField（跑不出 crossValidator）/ 自定义 trigger 系统 / watch deep model（不可靠）
- **决策**：自定义 `triggerCrossFieldValidator(node, 'blur' | 'change')`，由 v-model 写入 + onBlur + onChange 三入口调度

### ADR-005：v-model 写入后主动触发（不依赖 watch）✅

- **背景**：`vue Proxy + lodash set` 链路 watch 不可靠，deep watch 也不触发（4 次调试反复验证）
- **决策**：`buildVModelBindings` 加 `onValueChange` 回调，写入后主动调 reaction/跨字段调度
- **通用教训**：**不要在 watch 不可靠的链路上调试**——数据写入回调中主动调业务逻辑，watch 只用于纯 vue 内部响应式数据派生

### ADR-006：setFieldError 适配 element-plus 2.x shallowRef ❌（已被阶段 3.1 取代）

- **原决策**（P0-2）：写入 `fields[i].validateState` 后 `nextTick + splice 重建数组引用` 强制 shallowRef trigger——minimal hack，但复杂控件（DatePicker/Select/Cascader）失焦红字只在保存时显示
- **阶段 3.1 取代**：改为 `externalErrors ref → form-item props.error + props.validateStatus` 官方路径 + watch 守护双通道（见 §4），**不再直接写 `elForm.fields[i]`**，原浅层 ref 限制已被绕开
- **保留记录原因**：展示 element-plus 内部 `fields` 是 shallowRef 的陷阱，以及"官方 props 路径 > 内部状态直写"的适配原则

### ADR-007：Builder 工厂 makeBuilder cast 链路 ⚠️（P1-2 遗留）

- **现状**：makeBuilder 匿名 class + `_b` 转发 + `[k: string]: unknown` 索引签名，部分链式组合 TS 推断为 never，需 `as` cast 绕过；运行时正常
- **后续方向**（未排期）：重写 makeBuilder 用 this 多态，消除 cast

### ADR-008：响应式断点拍平（整体重渲染）✅

- **备选**：el-row 自带响应式（2.x 不自动监听 resize）/ 整体 schema 重渲染 / 字段级局部 re-render（复杂易错）
- **决策**：`useCurrentBreakpoint` 监听 window.resize → schema 整体重渲染。实测 120 字段 mount 74ms 流畅，未实施 markRaw / 字段级优化（避免过早优化）

### ADR-009：不用 FormRender 等外部库，自研 ✅

- **决策**：自研 form-schema + 简单场景用 element-plus 原生。理由：完全控制 + Builder 链式 + 响应式 + 跨字段 + 异步一站式，长期收益高于外部库

### ADR 索引

| 编号 | 主题                             | 状态                 | 关联 demo                       |
| ---- | -------------------------------- | -------------------- | ------------------------------- |
| 001  | Schema DSL 对象 + Builder        | ✅                   | XFormBuilder 等                 |
| 002  | 跨字段 crossValidator            | ✅                   | XFormCrossField                 |
| 003  | 数组节点独立 kind                | ✅                   | XFormArray                      |
| 004  | 自定义 trigger 触发器            | ✅                   | XFormCrossField / XFormDisabled |
| 005  | v-model 主动触发（不依赖 watch） | ✅                   | 所有反应式 demo                 |
| 006  | setFieldError 适配 shallowRef    | ❌ 已被阶段 3.1 取代 | XFormServerError                |
| 007  | Builder cast 链式类型            | ⚠️ 遗留（P1-2）      | XFormBuilder                    |
| 008  | 响应式断点拍平                   | ✅（120 字段 74ms）  | XFormResponsive                 |
| 009  | 不用 FormRender 自研             | ✅ 决策保留          | 全部                            |

## 6. 当前已知限制

| 限制                            | 根因 / 说明                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `permission` 权限码映射未透传   | `resolvePermission` 支持 `permissionResolver` 选项，但 XForm.vue 未将其暴露为 prop——权限码字符串按字面量处理，非三态值回退 `edit` |
| builder 链式 TS 推断 cast       | ADR-007 遗留                                                                                                                      |
| 草稿不可序列化值 / 多标签不同步 | `useFormPersist` 基于 JSON 序列化 + localStorage，无跨标签监听                                                                    |
| `labelPosition` 仅顶层生效      | element-plus el-form 实例级属性限制                                                                                               |
| 断点变化整体重渲染              | ADR-008 的取舍——简单可靠，> 200 字段场景需评估                                                                                    |

## 7. 调试快速参考

| 问题             | 排查点                                                             | 文件                                   |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------- |
| 输入不响应       | `buildVModelBindings` 的 lodash set 路径 / 节点缺 name             | `composables/build-vmodel-bindings.ts` |
| 校验不触发       | `compileRules` 字符串引用 + `rules` prop                           | `composables/render-schema-node.ts`    |
| 跨字段红字不显示 | externalErrors 双路径（§4）                                        | `composables/use-form-instance.ts`     |
| 反应式不响应     | reaction 函数未引用 model 形参 / 字段写在 strategy、delay 元字段上 | `composables/apply-reaction-fields.ts` |
| 反应式死循环     | reaction 函数内写 model 字段（deep watch 自激）                    | `composables/use-reaction.ts`          |
| 断点不响应       | schema 被频繁整体替换                                              | `composables/use-schema-renderer.ts`   |

## 8. 相关文档

- `docs/24-XForm使用指南.md` — 使用视角完整 API（本文的使用侧入口）
- `docs/superpowers/specs/2026-08-19-form-schema-design.md` — 引擎设计稿（P0-P3 规划）
- `packages/ui/src/components/form-schema/README.md` — 组件内 README
