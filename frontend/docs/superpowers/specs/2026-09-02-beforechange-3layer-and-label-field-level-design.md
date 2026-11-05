# beforeChange 3 层升级 + label 字段级颗粒度 设计文档

> 为 `XForm` 组件扩展两项能力：① 把 `beforeChange` 从单一全局 Props 升级为 3 层拦截（全局 Props + 动态命名空间规则 + 字段级 Schema 配置）；② 把 `labelPosition` / `labelWidth` 从"仅顶层 schema"扩展到字段级可覆盖。

| 属性 | 值 |
|------|-----|
| 版本 | v1.0.0 |
| 日期 | 2026-09-02 |
| 状态 | 设计稿待用户复核 |
| 关联项目 | `vue3-vite-project` |
| 关联分支 | `feature/form-engine` |
| 关联文档 | `docs/superpowers/specs/2026-08-19-form-schema-design.md`（form-schema 总设计） |

---

## 1. 背景 & 需求

### 1.1 现状

- `XFormProps.beforeChange` 当前是**单一全局 Props 函数**（`types/xform.ts:17-21`），签名 `(item, newValue, oldValue) => unknown | Promise<unknown>`。Demo `XFormBeforeChange.vue` 演示用法是把单个全局函数按 `item.name` 手工分派到具体字段（提现金额超额拦截 + 自动取百位）。
- **执行点唯一**：在 `build-vmodel-bindings.ts:37-51` 的 v-model `update:modelValue` 事件里调用一次。当前没有字段级别 beforeChange。
- **现有测试已覆盖核心语义**（`XForm.spec.ts:309-349`）：返回值更新、undefined 放行、Promise 异步、Promise.reject 跳过。
- `SchemaNode` 上**没有** `labelPosition` / `labelWidth` 字段级覆盖。当前 `types/schema-node.ts:150-169` 注释错误地把这两个字段标注为"仅顶层 schema 生效，节点级不生效"。**事实上 element-plus 的 `el-form-item` props 同时接受 `label-position` 和 `label-width`**（与 `el-form` 共享同一套），所以字段级颗粒度可直接透传实现，无须绕开 element-plus。
- 当前 demo `XFormLabelLayout.vue` 强调"节点级 labelPosition / labelWidth 不生效——这点新人最容易踩坑"——这个限制**将在本设计落地后被解除**。

### 1.2 目标

新增/扩展：

1. **beforeChange 3 层拦截**：保留全局 Props（横切关注点），新增字段级 `node.beforeChange`（业务内聚）和动态命名空间规则 `beforeChangeRules`（数组节点等场景）。
2. **label 字段级颗粒度**：`SchemaNode.labelPosition` / `SchemaNode.labelWidth` 字段级 override 顶层。
3. **3 层 ctx 上下文**：`setFieldValue` / `setFieldError` / `name` / `abort`，允许在字段级钩子里联动修改其他字段（选了"北京"清空"区"）。
4. **Demo 更新**：`XFormBeforeChange.vue` 重写为 3 段 tab 演示；`XFormLabelLayout.vue` 扩展字段级颗粒度演示。

### 1.3 范围

**包含**：
- 类型扩展（`BeforeChangeFn` / `BeforeChangeRule` / `BeforeChangeCtx` / `XFormProps.beforeChangeRules` / `SchemaNode.beforeChange` / `SchemaNode.labelPosition` / `SchemaNode.labelWidth`）
- `build-vmodel-bindings.ts` 改造为 3 层串联
- `use-xform-composer.ts` 暴露 ctx API
- `render-form-item.ts` 透传字段级 label 配置
- 单元测试（覆盖率 ≥80%）
- demo 重写/扩展
- `README.md` / `ARCHITECTURE.md` / `CHANGELOG.md` 同步更新
- 修正 `types/schema-node.ts:150-151` 错误注释

**不包含**（YAGNI）：
- beforeChange 在 `el-form-item` 原生事件上的扩展（如 `onBlur` / `onFocus` 的字段级钩子）——超出"值变更拦截"语义
- 字段级 `labelSuffix` / `labelClassName` —— 一期仅覆盖 `labelPosition` / `labelWidth`，其他 label 配置如需可后续追加
- 多实例多 beforeChange 串行链路（同一字段同时匹配多个 namespace 规则时按数组顺序全部执行）——作为 namespace 规则内部默认行为实现，不单独抽 API
- beforeChange 钩子返回值类型细化（如返回 `{ value, skipValidation, ... }` 对象替代 raw value）——维持现有"返回新值即替换"语义

---

## 2. 关键决策摘要

| # | 决策维度 | 选择 | 关键依据 |
| --- | -------------- | --------------------------------------- | ---------------------------------------- |
| 1 | 3 层执行顺序 | 全局 Props → 命名空间规则 → 字段级 | 用户原需求明确"字段级别为主，组件级别为辅"，命名空间位于中间作为"动态数组场景的捷径" |
| 2 | 每层串联语义 | 返回新值透传给下一层；Promise.resolve → 下一层；Promise.reject → 中断 | 直观、可预测；与现有单层语义一致 |
| 3 | 命名空间规则形式 | `BeforeChangeRule[]`，`pattern: RegExp \| string`，`handler: BeforeChangeFn` | 灵活支持正则、字面量、通配符；与现有 `match-trigger` composable 思路对齐 |
| 4 | 字段级函数签名 | `(item, newVal, oldVal, allValues, ctx) => unknown \| Promise<unknown>` | 与全局 Props 签名一致（仅多 allValues + ctx 在尾部），心智一致；与用户原 prompt 描述对应 |
| 5 | ctx 边界 | 完全开放：可调用 setFieldValue / setFieldError / 副作用；不允许 ctx 改写 ctx 自身 | 用户要求"ctx 可以做任何事"，最大化表达力；ctx 自身 API 只读防误用 |
| 6 | 字段级 label 配置 | 字段级声明则覆盖顶层；未声明则 el-form-item 走 element-plus 原生继承 | element-plus 行为即"未传 prop 时继承 el-form"，无须手动透传 |
| 7 | label 实现路径 | 直接透传到 el-form-item 的 `labelPosition` / `labelWidth` props | 推翻旧注释中的"element-plus 限制"误判；el-form-item 与 el-form 共享同一套 props |
| 8 | ctx 数据来源 | `use-xform-composer.ts` 在 render 阶段构造（每节点闭包独立 ctx） | 与现有 `useFormInstance` 同模式；ctx 与 model / formRef 同生命周期 |
| 9 | 数组节点支持 | 字段级 beforeChange 在 array.children[i].field 上配置；命名空间规则用正则匹配 `items[i].phone` | 沿用现有 array 节点机制，零改动 |
| 10 | 向后兼容 | 全局 beforeChange 旧签名（3 参）保留，新增 2 参在尾部 | 现有 demo XFormBeforeChange.vue 升级时同步调整；测试用例扩展签名 |
| 11 | 错误处理 | Promise.reject / 抛异常 → catch + console.warn + 跳过写入 | 防静默吞错：warn 可观测；与现有 build-vmodel-bindings 行为一致 |

---

## 3. 架构与文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/form-schema/types/xform.ts` | 修改 | 新增 `BeforeChangeFn` / `BeforeChangeRule` / `BeforeChangeCtx` 类型；`XFormProps.beforeChange` 升级签名；新增 `XFormProps.beforeChangeRules` |
| `src/components/form-schema/types/schema-node.ts` | 修改 | `SchemaNode.beforeChange?` 字段；`SchemaNode.labelPosition` / `labelWidth` 字段级 override 注释（推翻旧"仅顶层"注释） |
| `src/components/form-schema/composables/build-vmodel-bindings.ts` | 重写 | 1 层 → 3 层串联实现（resolveBeforeChangeChain），接受 ctx 工厂 |
| `src/components/form-schema/composables/build-vmodel-bindings.spec.ts` | 新增 | 单元测试（覆盖率 ≥80%） |
| `src/components/form-schema/composables/use-xform-composer.ts` | 修改 | 提供 ctx API 工厂（setFieldValue / setFieldError / abort），传给 renderOpts |
| `src/components/form-schema/composables/render-form-item.ts` | 修改 | el-form-item props 透传 `labelPosition` / `labelWidth`（字段级 override） |
| `src/components/form-schema/composables/render-schema-node.ts` | 修改 | `RenderSchemaNodeOptions` 增补字段；调用 `buildVModelBindings` 时传 ctx 工厂 |
| `src/components/form-schema/composables/validate-component-props.ts` | 修改 | 注释更新：labelPosition / labelWidth 现在字段级也允许（仍需顶层 schema 白名单） |
| `src/components/form-schema/XForm.spec.ts` | 修改 | 扩展现有 beforeChange 测试 + 新增 3 层 / label 字段级 / ctx API 用例 |
| `src/components/form-schema/README.md` | 修改 | beforeChange / labelPosition / labelWidth 章节更新 |
| `src/components/form-schema/ARCHITECTURE.md` | 修改 | 流程图更新（1 层 → 3 层） |
| `src/modules/demo/examples/XFormBeforeChange.vue` | 重写 | el-tabs 三段演示：A 全局 / B 字段级 / C 命名空间 |
| `src/modules/demo/examples/XFormLabelLayout.vue` | 扩展 | 新增字段级 labelPosition override 演示 |
| `src/modules/demo/examples/xform-demos-api.ts` | 修改 | 新增 `beforeChangeRules` / `fieldBeforeChange` API 条目；labelPosition / labelWidth 条目加"字段级可覆盖" |
| `src/modules/demo/config/sidebar-groups.ts` | 修改 | `XFormBeforeChange` 中文名更新为"字段值拦截·3 层" |
| `CHANGELOG.md` | 修改 | Unreleased 条目 |

**零改动**：`XForm.vue` 根组件 / `use-form-validation.ts` / `use-form-instance.ts` / `use-form-persist.ts` / 其他 demo。

**模块边界**：变更全部在 `src/components/form-schema/` 与 `src/modules/demo/examples/` 内（已在 §2 Lockdown 列出的允许操作清单）。

---

## 4. 类型与 API 设计

### 4.1 新增类型（`types/xform.ts`）

```ts
/** beforeChange 钩子上下文 —— 允许在字段级钩子里联动修改其他字段 / 取消写入 */
export interface BeforeChangeCtx {
  /** 当前字段完整名（含数组路径如 items[0].phone），由 build-vmodel-bindings 在调用时注入 */
  readonly name: string
  /** 联动修改其他字段（ctx.setFieldValue('district', null) → 选城市时清空区） */
  setFieldValue(name: string, value: unknown): void
  /** 设置字段错误（不阻断写入，仅显示红字提示） */
  setFieldError(name: string, message: string): void
  /** 取消本次写入（等价于返回 undefined），仅作用于本字段 */
  readonly abort: () => void
}

/** beforeChange 函数签名 —— 全局 Props / 字段级 / 命名空间 handler 三处共用 */
export type BeforeChangeFn = (
  item: SchemaNode,
  newValue: unknown,
  oldValue: unknown,
  allValues?: Record<string, unknown>,
  ctx?: BeforeChangeCtx
) => unknown | Promise<unknown>

/** 动态命名空间规则 —— 当字段是动态生成（如数组列表）时按正则 / 字符串匹配 */
export interface BeforeChangeRule {
  /** RegExp（精确匹配） / 字符串字面量（精确匹配） / 字符串通配符（'*' 匹配单层 / '**' 匹配多层） */
  pattern: RegExp | string
  handler: BeforeChangeFn
}
```

### 4.2 XFormProps 扩展

```ts
export interface XFormProps {
  // ... 现有字段 ...
  /**
   * 全局 Props beforeChange（第 1 层：横切关注点）
   * - 返回新值 → 透传给下一层
   * - 返回 undefined → 放行原值给下一层
   * - Promise.resolve → 异步更新，等待结果后透传
   * - Promise.reject / 抛异常 → catch + warn + 中断后续写入（已产生的 ctx.setFieldValue 副作用保留）
   *
   * 字段级别拦截请用 SchemaNode.beforeChange；动态数组场景请用 beforeChangeRules
   */
  beforeChange?: BeforeChangeFn
  /**
   * 动态命名空间拦截（第 2 层：按 pattern 匹配字段路径）
   * 数组节点（如 items[i].phone）的字段级配置繁琐时，用规则数组统一处理
   * 多个规则匹配同一字段时，按数组顺序全部串行执行（前一个的返回值作为后一个的 newValue）
   */
  beforeChangeRules?: BeforeChangeRule[]
}
```

### 4.3 SchemaNode 扩展（`types/schema-node.ts`）

```ts
export interface SchemaNode {
  // ... 现有字段 ...

  /**
   * 字段级 beforeChange（第 3 层：业务内聚）
   * - 与 Props.beforeChange 同签名（多 allValues + ctx 两参在尾部）
   * - 数组元素字段（items[i].phone）直接写在 array.children[i].phone 上即可
   * - 可通过 ctx.setFieldValue 联动修改其他兄弟字段
   * @group 响应式（字段级）
   */
  beforeChange?: BeforeChangeFn

  /**
   * 字段级 label 位置（覆盖顶层 schema.labelPosition）
   * - element-plus el-form-item 原生支持 labelPosition prop，字段级与顶层可独立设置
   * - 未设置时 el-form-item 自动继承 el-form 顶层 labelPosition（element-plus 原生行为）
   * @group 渲染属性（字段级 override 顶层）
   */
  labelPosition?: 'left' | 'right' | 'top'

  /**
   * 字段级 label 宽度（覆盖顶层 schema.labelWidth）
   * - 同 labelPosition 字段级颗粒度机制
   * @group 渲染属性（字段级 override 顶层）
   */
  labelWidth?: string | number
}
```

> ⚠️ **推翻旧注释**：原 `types/schema-node.ts:150-151` 注释"label-position 是 el-form 实例级属性,只能由顶层 schema 配置,不能针对单个 el-form-item 设置"——这是**错误**的。element-plus 文档与源码均显示 `el-form-item` 同时接受 `label-position` 和 `label-width` props。本设计直接利用该 element-plus 能力，不做"绕过"的特殊实现。

---

## 5. 数据流：3 层 beforeChange 执行链路

```
【触发】el-form-item 内部 v-model update:modelValue(v)
   │
   ▼
buildVModelBindings(node, model, beforeChange, beforeChangeRules, makeCtx, onValueChange)
   │
   ├─ onUpdate:modelValue(v) 进入 update handler
   │    │
   │    ▼
   │  resolveBeforeChangeChain(node, v, oldVal, model, makeCtx)
   │    │
   │    ├─ [第 1 层] props.beforeChange(node, v, oldVal, allValues, ctx)
   │    │    ├─ 同步返回 final1 → 透传
   │    │    ├─ 返回 undefined → 放行原值 v
   │    │    └─ Promise.resolve(final1) / Promise.reject → 异步处理
   │    │
   │    ├─ [第 2 层] beforeChangeRules.filter(r => r.pattern.test(node.name))
   │    │    多个匹配时按数组顺序串行：
   │    │    ├─ rule[i].handler(node, curr, prev, allValues, ctx) → curr
   │    │    └─ 全部执行完 → finalN
   │    │
   │    └─ [第 3 层] node.beforeChange(node, finalN, oldVal, allValues, ctx)
   │         └─ final
   │
   ├─ applyValue(final)  ← 等所有层（同步链 / 异步 await）结束
   │    ├─ set(model, node.name, final)        // lodash set 支持嵌套路径
   │    └─ onValueChange?.(node, final)       // 跨字段校验 / dirty 追踪钩子
   │
   └─ 返回（el-form-item 自身处理 v-model 已 done）
```

### 5.1 ctx 工厂签名

```ts
type MakeBeforeChangeCtx = (node: SchemaNode) => BeforeChangeCtx

// 内部实现：
function makeBeforeChangeCtx(
  node: SchemaNode,
  model: Record<string, unknown>,
  abortFlag: { aborted: boolean },
  formRef: XFormExpose | undefined
): BeforeChangeCtx {
  return {
    get name() { return node.name ?? '' },
    setFieldValue: (name, value) => set(model, name, value),
    setFieldError: (name, message) => formRef?.setFieldError(name, message),
    get abort() { return () => { abortFlag.aborted = true } }
  }
}
```

### 5.2 异常与边界

| 场景 | 处理 |
|------|------|
| 同步链中途某层抛异常 | catch + `console.warn('[beforeChange] handler threw', err)` + 放行上一层结果给下一层（不中断） |
| 异步 Promise.reject | catch + warn + 跳过本字段写入（已产生的 ctx.setFieldValue 副作用保留） |
| 命名空间 pattern 无任何匹配 | 第 2 层 noop，透传第 1 层结果 |
| ctx.setFieldValue 触发被写入字段自己的 beforeChange | 防止无限递归（写入时检测 ctx 内部 abort flag，递归层数 > 10 则终止） |
| ctx.setFieldValue 写入的字段也在第 2/3 层规则中 | 正常串行执行（链式反应受递归深度保护） |

---

## 6. label 字段级颗粒度实现

### 6.1 render-form-item.ts 改造点

原代码（`render-form-item.ts:91-109`）：

```ts
const formItem = h(FormItemComp as never, {
  label: node.label,
  prop: node.name,
  rules: ...,
  ...(ext?.error ? { error: ext.error } : {}),
  ...(ext?.validateStatus ? { validateStatus: ext.validateStatus } : {}),
  ...
})
```

改造后：

```ts
const formItem = h(FormItemComp as never, {
  label: node.label,
  prop: node.name,
  // ⭐ 字段级 label 配置 override 顶层
  // element-plus el-form-item 与 el-form 共享 labelPosition / labelWidth props
  // 字段级未设置时 el-form-item 自动继承 el-form 顶层配置（element-plus 原生行为）
  ...(node.labelPosition !== undefined ? { labelPosition: node.labelPosition } : {}),
  ...(node.labelWidth !== undefined ? { labelWidth: node.labelWidth } : {}),
  rules: ...,
  ...(ext?.error ? { error: ext.error } : {}),
  ...(ext?.validateStatus ? { validateStatus: ext.validateStatus } : {}),
  ...
})
```

### 6.2 顶层 schema 配置保持不变

- `use-top-level-fields.ts:158-167` 派生 `topLevelLabelWidth` / `topLevelLabelPosition` 给 el-form
- `validate-component-props.ts:74-75` 白名单 labelPosition / labelWidth 是顶层字段（白名单不动，只是注释更新：字段级 override 现在允许）

---

## 7. Demo 更新

### 7.1 重写 `XFormBeforeChange.vue`

`el-tabs` 三段：

| Tab | 演示内容 | 涉及层 |
|-----|----------|---------|
| A. 全局 Props | 保留原超额拦截 + 自动取百位 + 新增 ctx.setFieldError 用法 | 第 1 层 |
| B. 字段级 | 输入手机号自动去空格 + 选城市联动清空区（ctx.setFieldValue） | 第 3 层 |
| C. 命名空间 | 数组 items[*].phone 用正则统一格式化（`/^items\[\d+\]\.phone$/`） | 第 2 层 |

### 7.2 扩展 `XFormLabelLayout.vue`

顶部加新演示：3 个字段中只有 1 个字段级 `labelPosition: 'top'`（如备注字段长内容），其他字段继承顶层 `labelPosition: 'left'`。并保留原 3 种顶层位置切换。

### 7.3 sidebar 与 API 表

- `sidebar-groups.ts`: `XFormBeforeChange` 中文名 → "字段值拦截·3 层"
- `xform-demos-api.ts`:
  - `beforeChangePropsItems`: 加 `beforeChangeRules` / `BeforeChangeCtx` 字段速查
  - `labelLayoutItems`: `labelPosition / labelWidth` 加"字段级可覆盖"标注

---

## 8. 测试清单（build-vmodel-bindings.spec.ts 新增 + XForm.spec.ts 扩展）

| # | 用例 | 验证点 |
|---|------|--------|
| 1 | 第 1 层返回值替换 | props.beforeChange 返回 newVal → 写入 model |
| 2 | 第 1 层返回 undefined 放行 | props.beforeChange 返回 undefined → 写入原值 |
| 3 | 第 1 层 Promise.resolve 异步 | await 后写入最终值 |
| 4 | 第 1 层 Promise.reject 跳过 | await 后不写入 model，warn 被调 |
| 5 | 第 1 层抛异常 | catch + warn + 放行原值给第 2 层 |
| 6 | 第 2 层规则匹配单字段 | beforeChangeRules 1 条正则匹配 → handler 执行 |
| 7 | 第 2 层多规则串行 | 2 条匹配同一字段 → 按数组顺序串联 |
| 8 | 第 2 层规则不匹配 | 第 2 层 noop，透传第 1 层结果 |
| 9 | 第 3 层字段级执行 | node.beforeChange 触发 |
| 10 | 3 层串联 | 第 1 层 → 第 2 层 → 第 3 层顺序执行，每层返回透传下一层 |
| 11 | ctx.setFieldValue 联动 | 字段级钩子里 ctx.setFieldValue('district', null) → model.district 被清空 |
| 12 | ctx.setFieldError 显示 | setFieldError 后 el-form-item 显示红字 |
| 13 | ctx.abort 取消 | ctx.abort() → 本字段不写入 |
| 14 | 递归深度保护 | 字段级钩子里 ctx.setFieldValue 触发自己 beforeChange > 10 次终止 |
| 15 | 数组节点字段级 | items[0].phone 的 beforeChange 触发 |
| 16 | 数组节点命名空间 | pattern `/^items\[\d+\]\.phone$/` 匹配所有 items[i].phone |
| 17 | label 字段级 override | node.labelPosition='top' → 该字段 label 在上方 |
| 18 | label 字段级未设置继承 | node.labelPosition 未设置 → 字段继承顶层 |
| 19 | label 字段级 labelWidth | node.labelWidth='200px' → 该字段 label 宽度 200px |
| 20 | 全局 beforeChange 旧签名 3 参兼容 | 仅用 (item, newVal, oldVal) 调用 → 仍工作（TS 类型上允许省略后两参） |

测试环境：Vitest + happy-dom（mock el-form v-model 事件）。

---

## 9. 风险登记

| 风险 | 等级 | 对策 |
|------|------|------|
| 递归调用 beforeChange 死循环 | 高 | ctx.setFieldValue 触发被写入字段自己的 beforeChange 时检测递归深度 > 10 终止 |
| 命名空间规则误匹配（pattern 太宽） | 中 | 文档强调 pattern 用 `^` + `$` 精确锚定；测试覆盖典型边界 |
| 字段级 beforeChange 与 reaction 联动冲突 | 中 | reaction 是 watchEffect 反应式（声明式），beforeChange 是同步拦截（命令式）；两者职责清晰不冲突 |
| ctx.setFieldValue 修改的字段是 el-form 校验中的字段 | 低 | el-form 自动重跑该字段校验，红色提示用户——符合直觉 |
| demo 三段 tab 切换时 model 重置 | 低 | demo 内每个 tab 独立 schema + model，互不污染 |
| 推翻旧注释影响其他文档 | 低 | ARCHITECTURE.md 同步更新；README.md labelPosition / labelWidth 条目加"字段级可覆盖" |

---

## 10. 验收标准

1. `pnpm test src/components/form-schema/` 全绿，新增 `build-vmodel-bindings.spec.ts` 覆盖率 ≥80%。
2. `pnpm type-check:full` 通过（旧 beforeChange 签名向后兼容，新签名扩展在尾部）。
3. `pnpm lint` 通过。
4. `XFormBeforeChange.vue` demo 完成 3 段 tab 真实浏览器验证：每段都能跑通对应场景。
5. `XFormLabelLayout.vue` demo 验证字段级 labelPosition override 视觉生效。
6. CHANGELOG.md / README.md / ARCHITECTURE.md 同步更新。
7. `pnpm build` 成功，无 TS 编译错误。

---

*文档版本：v1.0.0 | 生成日期：2026-09-02 | 状态：待用户复核*