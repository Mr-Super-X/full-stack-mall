# Form Schema Engine 设计文档

> 参考开源 form-schema 实现的动态表单能力，移植到 `vue3-vite-project`，
> 用 Element Plus 替换原私有设计系统，
> 在 `src/components/form-schema/` 下提供 `<XForm>` 全局组件。

| 属性 | 值 |
|------|-----|
| 版本 | v1.0.0 |
| 日期 | 2026-08-19 |
| 状态 | 设计稿待用户复核 |
| 关联项目 | `vue3-vite-project`（`D:\personal\github\vue3工程模板\vue3-vite-project`） |
| 关联参考 | 开源 form-schema 实现@3.0.4（私有 npm，不可达） + 原内部项目 `src/components/form/` 包装层 |
| 关联分支 | `feature/engine-optimization` |

---

## 1. 背景 & 需求

### 1.1 现状

- 开源 form-schema 实现是一个 515 行单文件 + vue 编译产物的动态表单引擎，支持 schema DSL 递归构造 Vue 组件、内置 async-validator 风格校验、`reaction` 响应式系统、`{{ }}` 函数表达式解析、`getRef/getNames/validate/resetFields` 实例方法。
- 包强耦合原私有设计系统，公共 npm registry 不可达（`npm view` ETIMEDOUT）。
- 原内部项目通过极薄 wrapper（40 行 `XForm.vue`）使用该包：`v-bind="$attrs"` 透传 + 实例方法暴露 + dev 模式 `validate()` 自检。
- 我的目标项目 `vue3-vite-project` 使用 **Element Plus 2.14.3**，且**不依赖该 form-schema 包及其私有设计系统**，但已有 **zod 4.4.3** 可复用。

### 1.2 目标

在 `src/components/form-schema/` 下交付一个**参考开源 form-schema 渲染核心**的 TypeScript 实现：

1. 保留开源 form-schema 全量 14 字段 schema DSL（component / props / on / children / name / label / rules / formItem / modelProp / row / column / col / reaction / directives / slots / ignore / hidden / key）。
2. 替换底层设计系统：原私有设计系统 → Element Plus（el-form / el-form-item / el-row / el-col）。
3. 用 `new Function` 沙箱替代 `eval`（D2 安全决策）。
4. 沿用 element-plus 原生 async-validator 体系，同时支持项目内 zod 顶层校验。
5. 暴露 `<XForm>` 全局组件（自动注册到 `src/components/index.ts`）。

### 1.3 范围

**包含**：
- 5 个新文件（XForm.vue + schema-renderer.ts + element-plus-adapter.ts + types.ts + index.ts）
- 4 个测试 spec 文件（覆盖率 ≥80%）
- 命名导出 `validate(schema, opts?)` 用于静态校验
- 函数表达式沙箱化（new Function + dev 模式关键字黑名单）
- reaction 响应式（watchEffect 编排 + onScopeDispose 清理）
- 实例方法透传（getRef / getNames / validate / clearValidate / resetFields / scrollToField / validateWithZod）
- CHANGELOG.md Unreleased 条目

**不包含**（YAGNI）：
- 异步表单（schema 不携带 async loader）
- 服务端 schema 动态下发（schema 必须来自项目内部代码/配置）
- 主题定制（沿用 Element Plus 默认主题）
- 复杂表单编排（多步骤 / 向导）—— 超出动态表单范围
- FormGenerator 可视化搭建 —— 超出本 spec 范围

---

## 2. 关键决策摘要

| # | 决策维度 | 选择 | 关键依据 |
| --- | -------------- | --------------------------------------- | ---------------------------------------- |
| D1 | 复刻深度 | 完整 fork 515 行 + Element Plus 适配层 | 用户选定；最大化保留原逻辑 |
| D2 | eval 替换 | `new Function('model', ` + `return (${expr})` + 仅暴露 model 参数 | 隔离上层 scope，保留 `{{ fn }}` 表达式能力 |
| D3 | 组件解析 | 内置 element-plus 映射 + `components` prop 覆盖 | 与开源 form-schema 原行为兼容 |
| D4 | 校验系统 | el-form-item async-validator + 可选 zod 顶层校验 | 沿用 element-plus 体系 + 复用项目 zod |
| D5 | 目录归属 | `src/components/form-schema/` 一级目录 | 与展示型 common 组件隔离 |
| D6 | DSL 字段范围 | 全量 14 字段（含 reaction / directives / slots） | 用户选定；最大化兼容性 |

---

## 3. 架构总览

```text
┌──────────────────────────────────────────────────────────────┐
│  Business Pages（modules/*/views/）                            │
│      ↓ <XForm :schema="..." :components="..." />              │
│  ┌────────────────────────────────────────────────────┐      │
│  │ src/components/form-schema/                         │      │
│  │  ├─ XForm.vue                          ← 入口         │      │
│  │  ├─ composables/                       ← 一文件一能力  │      │
│  │  │    ├─ use-schema-renderer.ts                       │      │
│  │  │    ├─ use-reaction.ts                              │      │
│  │  │    ├─ use-expression.ts                            │      │
│  │  │    └─ use-validate.ts                              │      │
│  │  ├─ element-plus-adapter.ts ← 内置组件映射表       │      │
│  │  ├─ types.ts               ← Schema DSL 类型契约   │      │
│  │  └─ index.ts               ← 导出 + 全局注册       │      │
│  └────────────────────────────────────────────────────┘      │
│      ↓ │
│  ┌────────────────────────────────────────────────────┐      │
│  │ Element Plus（el-form / el-form-item / el-row /...）│      │
│  └────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### 模块边界（与 CLAUDE.md §1.2 common 铁律兼容）

- ✅ XForm 只依赖 element-plus / lodash-es / @vue/shared
- ❌ 不依赖 `modules/` / `api/` / `store/`
- ✅ 暴露 `<XForm>` 全局组件名（自动注册到现有 common 机制）

---

## 4. 组件树与模块边界

### 4.1 9 文件职责矩阵（按 CLAUDE.md §4「一文件一能力」拆分）

| 文件                                       | 职责                                                                  | 预估行数             |
| ------------------------------------------ | --------------------------------------------------------------------- | -------------------- |
| `XForm.vue`                                | 入口组件：接收 schema/model/components/rules/zodSchema；dev 模式 schema 自检；实例方法透传 | ≤300 行              |
| `composables/use-schema-renderer.ts`       | 核心编排：`watch(schema)` + `onScopeDispose` + 节点遍历              | ≤80 行               |
| `composables/use-reaction.ts`              | reaction watchEffect 编排 + `applyReactions` / `applyReactionFields` | ≤80 行               |
| `composables/use-expression.ts`            | `resolveFunctionExpression` 沙箱 + dev 模式关键字黑名单扫描        | ≤80 行               |
| `composables/use-validate.ts`              | `validate(schema, opts?)` 静态校验 + `validateWithZod` + dev 错误聚合 | ≤80 行               |
| `element-plus-adapter.ts`                  | 内置 element-plus 组件映射表 + `resolveElComponent(name, map)` 工厂  | ≤150 行              |
| `types.ts`                                 | Schema DSL 全量 14 字段类型契约 + `XFormProps` + `XFormExpose`        | ≤200 行              |
| `index.ts`                                 | 全局注册（`app.component('XForm', XForm)`）+ re-export `validate`    | ≤30 行               |

### 4.2 文件间引用图

```text
XForm.vue
  ├─ composables/use-schema-renderer.ts (useSchemaRenderer)
  │    ├─ composables/use-reaction.ts (applyReactions)
  │    └─ composables/use-validate.ts (validate)
  ├─ composables/use-expression.ts (resolveFunctionExpression / FORBIDDEN scan)
  ├─ element-plus-adapter.ts (resolveElComponent)
  └─ types.ts (SchemaNode, XFormProps, XFormExpose)

index.ts
  ├─ XForm.vue (default)
  └─ composables/use-validate.ts (validate)
```

### 4.3 XForm.vue BEM 命名（CLAUDE.md §3）

```vue
<script setup lang="ts">
const bem = createNamespace('x-form') // kebab-case，与 sass 根选择器对齐
</script>

<template>
  <div :class="bem.b()">
    <el-form ...>...</el-form>
  </div>
</template>

<style lang="scss">  <!-- 无 scoped -->
.#{$BEM_PREFIX}-x-form { ... }
</style>
```

---

## 5. Schema DSL 类型契约（types.ts）

### 5.1 核心节点类型

```typescript
import type { Component, DirectiveBinding, Directive } from 'vue'
import type { ZodTypeAny } from 'zod'

export type EventFn = (value: unknown, ...args: unknown[]) => unknown
export type FunctionExpression = string // {{ ... }} 包裹的函数体

/** 校验规则（async-validator 兼容） */
export interface RuleItem {
  required?: boolean
  pattern?: RegExp | string
  min?: number | string
  max?: number | string
  message?: string
  validator?: (rule: unknown, value: unknown, cb: (err?: Error) => void) => void
  trigger?: 'blur' | 'change' | (string | string[])[]
}

/** reaction 字段值：函数 / 函数表达式字符串 / 字面量 */
export type ReactionValue<T> = T | ((model: Record<string, unknown>) => T) | FunctionExpression

/** 反应式配置：覆盖节点的任意字段 */
export interface ReactionConfig {
  rules?: ReactionValue<SchemaNode['rules']>
  props?: Record<string, ReactionValue<unknown>>
  label?: ReactionValue<string>
  hidden?: ReactionValue<boolean>
  // 其他可覆盖字段（开闭原则：未知字段透传）
  [key: string]: unknown
}

/** 指令系统 */
export interface DirectiveConfig {
  directive: string | DirectiveBinding | Directive
  arg?: string
  modifiers?: Record<string, boolean>
  value?: unknown
}

/** FormItem 包裹配置 */
export interface FormItemConfig {
  component?: string | Component
  props?: Record<string, unknown>
  directives?: DirectiveConfig[]
  slots?: Record<string, SchemaNode | SchemaNode[] | string | undefined>
  rules?: SchemaNode['rules']
  [key: string]: unknown
}

/** 栅格（el-row / el-col） */
export interface RowConfig { gutter?: number; type?: 'flex'; align?: string; justify?: string }
export interface ColConfig { span?: number; offset?: number; push?: number; pull?: number }

/** 节点定义（全量 14 字段） */
export interface SchemaNode {
  component?: string | Component // 1
  props?: Record<string, unknown>             // 2
  on?: Record<string, EventFn | FunctionExpression> // 3
  children?: SchemaNode | SchemaNode[] | string // 4
  name?: string                                // 5
  label?: string // 6
  rules?: string | RuleItem | Array<string | RuleItem> // 7
  formItem?: boolean | FormItemConfig         // 8
  modelProp?: string                          // 9
  row?: RowConfig                             // 10
  column?: number // 11
  col?: boolean | ColConfig                   // 12
  reaction?: ReactionConfig                   // 13
  directives?: DirectiveConfig[]              // 14
  slots?: Record<string, SchemaNode | SchemaNode[] | string | undefined>
  ignore?: boolean
  hidden?: boolean
  key?: string | number
}
```

### 5.2 XFormProps

```typescript
export interface XFormProps {
  schema: SchemaNode | SchemaNode[] // 顶层可为节点数组（自动包 children）
  model?: Record<string, unknown>
  components?: Record<string, Component>
  rules?: Record<string, RuleItem>
  directives?: Record<string, Directive>
  beforeChange?: (
    itemSchema: SchemaNode, newValue: unknown, oldValue: unknown
  ) => unknown | Promise<unknown>
  zodSchema?: ZodTypeAny // 可选 zod 顶层校验
}
```

### 5.3 XFormExpose

```typescript
export interface XFormExpose {
  getRef(key: string): ComponentPublicInstance | HTMLElement | null
  getNames(includesIgnore?: boolean): string[]
  validate(): Promise<boolean>
  clearValidate(): void
  resetFields(): void
  scrollToField(name: string): void
  validateWithZod(): { success: boolean; errors: import('zod').ZodError | null }
}
```

### 5.4 函数表达式沙箱解析

```typescript
// SECURITY: 用 new Function 替代 eval，隔离上层作用域
// 调用方必须保证 schema 来源可信（项目内部，不接受用户输入）
export function resolveFunctionExpression<T extends (...a: unknown[]) => unknown>(
  raw: string
): T | null {
 const m = raw.match(/^\s*\{\{([\s\S]+)\}\}\s*$/)
  if (!m) return null
  try {
    const fn = new Function('model', `return (${m[1].trim()})`)
    return fn as T
  } catch (err) {
    console.error('[XForm] Invalid function expression:', raw, err)
    return null
  }
}
```

---

## 6. 渲染流程与数据流

### 6.1 整体渲染主流程

```text
1. XForm 挂载 / props 变化
   ↓
2. props.schema 规范化（数组 → { children: array }）
   ↓
3. dev 模式：validateSchema(schema) 静态校验 + 错误日志
   ↓
4. 创建 el-form 容器（:model="model" :rules="compiledRules"）
   ↓
5. useSchemaRenderer({ schema, components, formData, beforeChange })
   ├─ watch(schema, deep) → 检测 reaction 字段 → 启用 watchEffect 编排
   ├─ watch(formData, deep) → reaction 触发
   └─ 返回 reactiveSchema → render → VNode 数组
   ↓
6. 递归渲染：resolveElComponent(name, components) → h(component, props, children)
   ├─ 节点含 name → 自动包裹 el-form-item（rules 转译 + label）
   ├─ 节点含 row / column → 自动包 el-row + el-col（col 默认 span = 24/column）
   └─ 节点含 on → resolveFunctionExpression + beforeChange 中转
   ↓
7. 用户操作 → el-form-item 触发 update:modelValue → 同步到 model
```

### 6.2 reaction 反应式系统（数据流核心）

```typescript
// schema-renderer.ts（核心 ≤80 行）
export function useSchemaRenderer(opts: {
  schema: Ref<SchemaNode | SchemaNode[]>
  components: Ref<Record<string, Component> | undefined>
  formData: Ref<Record<string, unknown>>
  beforeChange?: XFormProps['beforeChange']
}) {
  const reactiveSchema = shallowRef<SchemaNode | SchemaNode[]>({})
  const stoppers: (() => void)[] = []
  let hasReaction = false

  watch(() => opts.schema.value, (val) => {
    stoppers.forEach(s => s()); stoppers.length = 0
    hasReaction = containsReaction(val)
    // 仅当含 reaction 时才克隆（性能优化）
    const cloned = hasReaction ? cloneDeep(val) : val
    if (hasReaction) applyReactions(cloned as SchemaNode, opts.formData.value, stoppers)
    reactiveSchema.value = cloned
  }, { immediate: true, deep: true })

  // 卸载时清理所有 watchEffect（CLAUDE.md §4 Vue 性能：组件卸载清理）
  onScopeDispose(() => stoppers.forEach(s => s()))

  return { reactiveSchema, hasReaction }
}

function applyReactions(node: SchemaNode, model: any, stoppers: (() => void)[]) {
  if (node.reaction) {
    const stop = watchEffect(() => applyReactionFields(node, node.reaction!, model))
    stoppers.push(stop); delete node.reaction
  }
  visitChildren(node, child => applyReactions(child, model, stoppers))
}
```

### 6.3 数据双向绑定（model 流转）

```text
用户输入
  ↓
<el-input :model-value="model.name" @update:model-value="(v) => model.name = beforeChange?.(schema, v, old) ?? v" />
  ↓
XForm.model.name（响应式）
  ↓
父组件 reactive({ name: '' }) 自动同步（同一引用）
```

**关键点**：model 必须由父组件传入**响应式对象**（`reactive()` / `ref().value`），XForm 不会创建副本。

### 6.4 校验双轨

| 触发                                  | 路径                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `formRef.value.validate()`            | `el-form.validate()` → async-validator 走 el-form-item.rules（schema.rules 转译） |
| `formRef.value.validateWithZod()`     | `zodSchema.safeParse(formData)` → `{ success, errors }`                        |
| 两者并行                              | `Promise.all([async, zod])` → 合并错误                                        |

### 6.5 实例方法调用链

```text
formRef.value.getRef('name')
  └─ XFormExpose.getRef(key) → refMap.get(key) ?? null（mount 时通过子组件 onMounted 钩子缓存）

formRef.value.validate()
  └─ elFormRef.value.validate() → Promise<boolean>

formRef.value.resetFields()
  └─ elFormRef.value.resetFields()

formRef.value.getNames()
  └─ traverseSchema(schema) → name[] 收集（默认排除 ignore:true）
```

### 6.6 错误处理节点

| 节点                              | 错误场景                  | 处理                                |
| --------------------------------- | ------------------------- | ----------------------------------- |
| schema 静态校验失败（dev）        | component/rules 类型错误   | `console.error` + 不阻塞渲染         |
| 函数表达式解析失败                | `{{ ... }}` 语法错误       | `console.error` + 跳过该字段        |
| reaction 求值抛错                 | watchEffect 内异常         | `console.error` + 保留上次有效值    |
| 组件查找失败                      | component 字符串未注册     | `console.warn` + 渲染为 `<div>` 兜底 |
| zod 校验失败                      | 数据不匹配                 | 返回 `{ success: false, errors }`   |
| 用户输入 beforeChange reject      | reject → 不更新 model     | `console.error` + 保留旧值          |

---

## 7. 安全策略与错误处理

### 7.1 函数表达式沙箱化（D2）

- 用 `new Function('model', ` + `return (${expr})` + 仅暴露 model 参数
- 相对 eval 的安全提升：new Function 创建独立函数作用域，不污染上层闭包
- 残余风险：表达式可写成 `{{ (m) => m.fn?.() }}` 间接执行任意引用 → 必须配套约束

**dev 模式静态扫描**（`composables/use-expression.ts` 中实现）：

```typescript
const FORBIDDEN_IN_EXPR = /\b(window|document|globalThis|eval|Function|setTimeout|setInterval|fetch|XMLHttpRequest)\b/

watch(schema, (val) => {
  if (import.meta.env.DEV) {
    traverseSchema(val, (node) => {
      for (const v of Object.values(node.on ?? {})) {
        if (typeof v === 'string' && FORBIDDEN_IN_EXPR.test(v)) {
          console.error('[XForm][SECURITY] Forbidden identifier in function expression:', v)
        }
      }
    })
  }
}, { deep: true, immediate: true })
```

### 7.2 schema 来源约束

| 来源                                          | 是否允许 | 备注 |
| --------------------------------------------- | -------- | ---- |
| 内部代码硬编码 schema                         | ✅ 推荐  | —    |
| `*.config.ts` / `*.json` 项目配置文件        | ✅        | —    |
| 后端 API 返回 schema                          | ⚠ 必须先经 `validateSchema` 静态校验 | 否则视为不可信源 |
| URL 参数 / localStorage / 用户输入拼接 schema | ❌ 禁止  | XForm 不应消费此类来源 |

### 7.3 错误传播分级

| 错误类型                       | 等级 | 处理方式                                  | 用户感知                     |
| ------------------------------ | ---- | ----------------------------------------- | ---------------------------- |
| schema 静态校验失败（dev）     | INFO | `console.error(errors)`，不阻塞渲染       | 控制台日志，正常渲染         |
| 函数表达式解析失败             | WARN | `console.error`，跳过该字段              | 该字段事件不触发，不报错     |
| reaction 求值抛错              | WARN | `console.error`，保留上次有效值          | 反应式联动暂时失效           |
| 组件查找失败                   | WARN | `console.warn`，降级为 `<div>` 兜底      | 占位 div，无样式             |
| zod 校验失败                   | INFO | `return { success: false, errors }`，不抛 | 调用方决定展示               |
| beforeChange reject            | INFO | `console.error`，保留旧 model 值         | 输入回滚，无报错             |
| `validate()` 返回 `false`      | INFO | `resolve(false)`，不抛                    | 调用方用 `<AsyncState>` 展示 |

**无静默吞错误**（CLAUDE.md §一.10）：所有 catch / 异常分支均带 `console.error` + 上下文。

### 7.4 防御性 UI 边界（CLAUDE.md §1.4）

- XForm **不在内部**实现 Loading / Error / Empty（不是它的职责）
- XForm 内部职责：schema → DOM 节点（同步）
- 校验结果展示由调用方负责，调用方用 `<AsyncState>` 包装：

```vue
<XForm ref="formRef" :schema="s" :model="m" />
<AsyncState :loading="submitting" :error="submitError" @retry="onSubmit">
  <ElButton @click="onSubmit">提交</ElButton>
</AsyncState>
```

### 7.5 与 §7 安全底线对齐

| §7 项                         | 实现                                       |
| ----------------------------- | ------------------------------------------ |
| 无硬编码凭证                  | ✅ 无任何凭证                               |
| 用户输入校验                  | ⚠️ schema 来源约束 + dev 静态扫描           |
| 外部数据不信任                | ✅ `validate()` 命名导出供消费前校验        |
| 错误消息不泄露敏感数据        | ✅ 错误仅 console.error，不向 UI 暴露堆栈   |

### 7.6 OWASP Top 10 对齐

| 风险                  | 相关性                | XForm 缓解                                                     |
| --------------------- | --------------------- | -------------------------------------------------------------- |
| A03 Injection         | 函数表达式可执行任意引用 | new Function 沙箱 + FORBIDDEN 关键字扫描 + schema 来源约束     |
| A04 Insecure Design   | 校验逻辑被绕过        | 双轨校验（async-validator + zod 可选）+ `validate()` 强制校验  |
| A05 Misconfig         | 默认配置不当          | 不暴露 `validateFirst` 等敏感选项；提供的是「最小可用 API」    |
| A08 Data Integrity    | schema 注入           | dev 模式扫描 + 来源约束                                        |

---

## 8. 测试策略与验收标准

### 8.1 测试文件矩阵

| 源文件                                | spec 文件                              | 覆盖率目标 |
| ------------------------------------- | -------------------------------------- | ---------- |
| `types.ts`                            | —（仅类型，编译期验证）              | N/A        |
| `element-plus-adapter.ts`             | `element-plus-adapter.spec.ts`         | 100%       |
| `composables/use-schema-renderer.ts`  | `use-schema-renderer.spec.ts`          | ≥85%       |
| `composables/use-reaction.ts`         | `use-reaction.spec.ts`                 | ≥85%       |
| `composables/use-expression.ts`       | `use-expression.spec.ts`               | 100%       |
| `composables/use-validate.ts`         | `use-validate.spec.ts`                 | ≥85%       |
| `XForm.vue`                           | `XForm.spec.ts`                        | ≥80%       |
| `index.ts`                            | `index.spec.ts`                        | 100%       |

### 8.2 单元测试要点

**`element-plus-adapter.spec.ts`**
- `resolveElComponent('Input')` → 返回 `ElInput`（内置命中）
- `resolveElComponent('Foo', { Foo: MyComponent })` → 返回 `MyComponent`（用户覆盖优先）
- `resolveElComponent('Unknown')` → 返回 `null`（兜底 div）
- `resolveElComponent('ElInput')` → 直接返回（Element Plus 原生名）

**`use-schema-renderer.spec.ts`**
- `useSchemaRenderer`：`watch(schema, deep)` 触发时按需克隆（无 reaction 不克隆）
- 含 reaction 字段 → 启用 `watchEffect` + 注册到 stoppers
- `onScopeDispose` 调用 → 所有 watchEffect 已 stop

**`use-reaction.spec.ts`**
- `applyReactions` 递归覆盖 children / slots / formItem.slots
- `applyReactionFields` 函数直接调用
- `applyReactionFields` 函数表达式字符串求值（Function 构造器）
- 求值抛错时保留上次有效值

**`use-expression.spec.ts`**
- `resolveFunctionExpression('{{ (m) => m.x }}')` 返回可执行函数
- 非法表达式 → 返回 `null` + `console.error`
- dev 模式扫描：表达式含 `window` / `eval` 等关键字 → `console.error`

**`use-validate.spec.ts`**
- `validate(schema)` → `{ isValid, errors[] }`
- `validate(schema, { validateFirst: true })` 遇错即止
- `validateWithZod` 顶层 zod 校验
- schema 含未知字段 → `errors[]` 含 keyPath + message

**`XForm.spec.ts`**（Vue Test Utils）
- 基础渲染：传入 schema + model → 渲染为 `<el-form>`
- 嵌套渲染：`children` 自动递归
- 实例方法透传：`getRef` / `getNames` / `validate` / `clearValidate` / `resetFields` / `scrollToField` / `validateWithZod`
- 自定义组件：`components` prop 覆盖
- 函数表达式：`on.change = '{{ (v) => ... }}'` 正常触发
- reaction：`formData` 变化 → schema 字段更新
- 校验：rules 转译到 el-form-item
- dev 模式：schema 非法时控制台日志输出
- 函数表达式含 `window` 关键字 → dev 模式 `console.error`

**`index.spec.ts`**
- `install(app)` → `app.component('XForm', XForm)` 被调用
- 命名导出 `validate` 可独立调用

### 8.3 覆盖率目标（CLAUDE.md §4 强制）

| 维度         | 目标  | 验证命令                            |
| ------------ | ----- | ----------------------------------- |
| 行覆盖率     | ≥80%  | `pnpm test:coverage`                |
| 函数覆盖率   | ≥80%  | 同上                                |
| 分支覆盖率   | ≥75%  | 同上                                |
| 测试用例数   | ≥60   | `pnpm test --reporter=verbose`      |

### 8.4 验收 DoD

- [ ] 9 个文件全部创建，行数符合预估（XForm.vue ≤300、4 个 composables 各 ≤80、adapter ≤150、types ≤200、index ≤30）
- [ ] CLAUDE.md §3 BEM 规范：`XForm.vue` 使用 `createNamespace('x-form')` + `<style lang="scss">` 无 scoped + `.#{$BEM_PREFIX}-x-form`
- [ ] CLAUDE.md §1.6 AutoImport：createNamespace / ref / watch 等无显式 import
- [ ] 7 个 spec 文件就绪，覆盖率 ≥80%
- [ ] `pnpm type-check:full` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm test` 通过（含覆盖率门槛）
- [ ] `pnpm build` 通过
- [ ] `CHANGELOG.md` 新增 Unreleased 条目
- [ ] src/ Architecture Lockdown 修改申请已输出（实际上首轮已默认批准）

### 8.5 验证命令

```bash
pnpm type-check:full
pnpm lint
pnpm test
pnpm test:coverage   # 验证 ≥80%
pnpm build
```

### 8.6 风险登记与回退

| 风险                              | 影响               | 回退方案                                                 |
| --------------------------------- | ------------------ | -------------------------------------------------------- |
| XForm.vue 超 300 行               | §2 文件行限违反    | 拆为 `XForm.vue`（薄壳） + `useXForm.ts`（composable）   |
| reaction 性能问题                 | watchEffect 频繁触发 | 加节流（lodash debounce 200ms）                          |
| new Function 残余风险             | 安全审计不通过      | 移除函数体字符串支持（仅接受函数 reaction）              |
| 515 行 fork 消化时间长            | 工期不可控          | 分 3 个 PR 顺序实施：① entry + types ② schema-renderer ③ adapter + tests |

---

## 9. 引用

| 资源 | 路径 |
|------|------|
| 开源 form-schema 包源码 | 原内部项目 node_modules 下（`dist/index.js`，515 行） |
| 开源 form-schema README | 原内部项目 node_modules 下（`README.md`） |
| 参考实现包装层 | 原内部项目 `src/components/form/form.vue` + `index.js` |
| 项目级 CLAUDE.md | `D:\personal\github\vue3工程模板\vue3-vite-project\CLAUDE.md` |
| 全局 §1.2 模块边界 | `~/.claude/rules/zh/frontend.md` |
| 全局 §7 安全底线 | `~/.claude/CLAUDE.md` §七 |
| 已存在的 spec 命名约定 | `docs/superpowers/specs/2026-07-2*-*-design.md` |

---

## 10. 自审清单（设计文档提交前）

| # | 检查项 | 状态 |
| --- | --------------------------------- | ---- |
| 1  | 无 "TBD" / "TODO" / 占位符 | ✅    |
| 2  | 内部一致性：架构 / 组件树 / DSL 互相不矛盾 | ✅    |
| 3  | 范围聚焦：可被单一实施计划覆盖 | ✅    |
| 4  | 无双义解读：每个决策已单选并标注依据 | ✅    |
| 5  | 引用资源链接可达                       | ✅    |
| 6  | 与项目 CLAUDE.md §1.2 / §1.6 / §2 / §3 / §4 对齐 | ✅    |
| 7  | 与全局 §一.10 防御性 UI / §七 安全底线 / §八 调试规范对齐 | ✅    |

---

**文档版本**：v1.0.0 | **生成日期**：2026-08-19 | **状态**：待用户复核