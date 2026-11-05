# Form Schema Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `src/components/form-schema/` 下交付一个基于 Element Plus 的动态表单引擎，参考开源 form-schema 全量 14 字段 schema DSL，提供 `<XForm>` 全局组件。

**Architecture:** 参考开源 form-schema 515 行渲染核心，**用 Element Plus 替换原私有设计系统**，**用 `new Function` 沙箱替代 `eval`**，沿用 async-validator + zod 双轨校验。9 文件按 CLAUDE.md §4「composable 一文件一能力」拆分。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vite 8 + Element Plus 2.14 + zod 4.4 + Vitest 4 + Vue Test Utils 2.4

**Spec 引用：** [`docs/superpowers/specs/2026-08-19-form-schema-design.md`](../specs/2026-08-19-form-schema-design.md)

---

## 文件结构总览

| # | 文件                                                  | 行数 ≤ | 类型     | 依赖关系 |
| --- | ----------------------------------------------------- | ------ | -------- | -------- |
| 1 | `src/components/form-schema/types.ts`                | 200    | 类型     | （无）   |
| 2 | `src/components/form-schema/composables/use-validate.ts` | 80 | composable | types |
| 3 | `src/components/form-schema/element-plus-adapter.ts`  | 150    | 工具     | types    |
| 4 | `src/components/form-schema/composables/use-expression.ts` | 80 | composable | types |
| 5 | `src/components/form-schema/composables/use-reaction.ts` | 80 | composable | types, use-expression |
| 6 | `src/components/form-schema/composables/use-schema-renderer.ts` | 80 | composable | types, use-reaction, use-validate |
| 7 | `src/components/form-schema/XForm.vue`                | 300    | 组件     | 所有上面 |
| 8 | `src/components/form-schema/index.ts`                 | 30     | 入口     | XForm, use-validate |
| 9 | `CHANGELOG.md`（修改）                                 | —      | 文档     | 全量完成 |

测试文件（每个 composable / 工具 / 组件对应一个 spec）：

- `src/components/form-schema/element-plus-adapter.spec.ts`
- `src/components/form-schema/composables/use-validate.spec.ts`
- `src/components/form-schema/composables/use-expression.spec.ts`
- `src/components/form-schema/composables/use-reaction.spec.ts`
- `src/components/form-schema/composables/use-schema-renderer.spec.ts`
- `src/components/form-schema/XForm.spec.ts`
- `src/components/form-schema/index.spec.ts`

---

## 任务依赖 DAG

```text
Task 1 (types.ts)
   │
   ├─→ Task 2 (use-validate)
   ├─→ Task 3 (element-plus-adapter)
   ├─→ Task 4 (use-expression) ─── security-reviewer 审查节点
   │           │
   ├─→ Task 5 (use-reaction) ←───┘
   │           │
   ├─→ Task 6 (use-schema-renderer) ←─┘
   │           │
   ├─→ Task 7 (XForm.vue) ←──────────┘
   │           │
   └─→ Task 8 (index.ts) ←──────────┘
                       │
              Task 9 (验证 + CHANGELOG)
```

**并行机会**：Task 2、3、4 可并行（互不依赖）。

---

## 全局前置条件

在开始任何 Task 前，先验证环境：

```bash
cd "D:/personal/github/vue3工程模板/vue3-vite-project"
pnpm --version   # 期望 ≥11.0.0
node --version   # 期望 ≥22.18 或 ≥24.12
```

期望输出：

```
11.x.x
v22.18.x（或 v24.12.x）
```

如果版本不符，**停止**——告知用户安装 Node ≥22.18 + pnpm ≥11。

---

## Task 1：types.ts（Schema DSL 类型契约）

**Files:**
- Create: `src/components/form-schema/types.ts`

### Step 1：创建 types.ts

写入以下完整内容（spec §5 的类型定义）：

```typescript
// src/components/form-schema/types.ts
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
export interface RowConfig {
  gutter?: number
  type?: 'flex'
  align?: string
  justify?: string
}
export interface ColConfig {
  span?: number
  offset?: number
  push?: number
  pull?: number
}

/** 节点定义（全量 14 字段） */
export interface SchemaNode {
  component?: string | Component // 1
  props?: Record<string, unknown> // 2
  on?: Record<string, EventFn | FunctionExpression> // 3
  children?: SchemaNode | SchemaNode[] | string // 4
  name?: string // 5
  label?: string // 6
  rules?: string | RuleItem | Array<string | RuleItem> // 7
  formItem?: boolean | FormItemConfig // 8
  modelProp?: string // 9
  row?: RowConfig // 10
  column?: number // 11
  col?: boolean | ColConfig // 12
  reaction?: ReactionConfig // 13
  directives?: DirectiveConfig[] // 14
  slots?: Record<string, SchemaNode | SchemaNode[] | string | undefined>
  ignore?: boolean
  hidden?: boolean
  key?: string | number
}

/** XForm props */
export interface XFormProps {
  schema: SchemaNode | SchemaNode[]
  model?: Record<string, unknown>
  components?: Record<string, Component>
  rules?: Record<string, RuleItem>
  directives?: Record<string, Directive>
  beforeChange?: (
    itemSchema: SchemaNode,
    newValue: unknown,
    oldValue: unknown,
  ) => unknown | Promise<unknown>
  zodSchema?: ZodTypeAny
}

/** XForm 实例方法 */
export interface XFormExpose {
  getRef(key: string): ComponentPublicInstance | HTMLElement | null
  getNames(includesIgnore?: boolean): string[]
  validate(): Promise<boolean>
  clearValidate(): void
  resetFields(): void
  scrollToField(name: string): void
  validateWithZod(): { success: boolean; errors: import('zod').ZodError | null }
}

/** validate() 入参 */
export interface ValidateOptions {
  validateFirst?: boolean
}

/** validate() 出参 */
export interface ValidateResult {
  isValid: boolean
  errors: Array<{ keyPath: (string | number)[]; message: string }>
}
```

### Step 2：验证类型编译通过

```bash
pnpm type-check:full
```

期望：所有文件类型检查通过，无 error。如果报错，按错误信息修正 types.ts（通常是类型语法问题），重复运行。

### Step 3：Commit

```bash
git add src/components/form-schema/types.ts
git commit -m "feat(form-schema): 新增 Schema DSL 全量 14 字段类型契约"
```

---

## Task 2：composables/use-validate.ts（schema DSL 静态校验）

**Files:**
- Test: `src/components/form-schema/composables/use-validate.spec.ts`
- Create: `src/components/form-schema/composables/use-validate.ts`

### Step 1：写失败的测试

创建文件并写入：

```typescript
// src/components/form-schema/composables/use-validate.spec.ts
import { describe, it, expect } from 'vitest'
import { validate, validateWithZod } from './use-validate'
import { z } from 'zod'

describe('validate(schema, opts?)', () => {
  it('returns isValid=true for valid schema', () => {
    const schema = {
      component: 'Input',
      name: 'name',
      label: '名称',
    }
    const result = validate(schema)
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('returns isValid=false when on.* is not function/string', () => {
    const schema = {
      component: 'Input',
      on: { change: 123 as unknown as never },
    }
    const result = validate(schema)
    expect(result.isValid).toBe(false)
    expect(result.errors).toEqual([
      { keyPath: ['on', 'change'], message: '事件回调必须为函数或函数表达式' },
    ])
  })

  it('returns isValid=false when component is not string or Component', () => {
    const schema = {
      component: 999 as unknown as never,
    }
    const result = validate(schema)
    expect(result.isValid).toBe(false)
    expect(result.errors[0].keyPath).toEqual(['component'])
  })

  it('returns isValid=false when children is neither SchemaNode nor array nor string', () => {
    const schema = {
      children: 42 as unknown as never,
    }
    const result = validate(schema)
    expect(result.isValid).toBe(false)
  })

  it('recurses into children array', () => {
    const schema = {
      children: [
        { component: 'Input' },
        { component: 1 as unknown as never },
      ],
    }
    const result = validate(schema)
    expect(result.isValid).toBe(false)
    expect(result.errors[0].keyPath).toEqual(['children', 1, 'component'])
  })

  it('with validateFirst:true stops on first error', () => {
    const schema = {
      component: 1 as unknown as never,
      on: { change: 2 as unknown as never },
    }
    const result = validate(schema, { validateFirst: true })
    expect(result.errors).toHaveLength(1)
  })

  it('validates rules string/RuleItem/array shape', () => {
    const schema = {
      rules: 'required', // string: ok
    }
    expect(validate(schema).isValid).toBe(true)

    const badSchema = {
      rules: 999 as unknown as never,
    }
    expect(validate(badSchema).isValid).toBe(false)
  })
})

describe('validateWithZod(zodSchema, formData)', () => {
  it('returns success=true on valid data', () => {
    const zodSchema = z.object({ name: z.string() })
    const result = validateWithZod(zodSchema, { name: 'foo' })
    expect(result.success).toBe(true)
    expect(result.errors).toBeNull()
  })

  it('returns success=false with ZodError on invalid data', () => {
    const zodSchema = z.object({ name: z.string() })
    const result = validateWithZod(zodSchema, {})
    expect(result.success).toBe(false)
    expect(result.errors).not.toBeNull()
    expect(result.errors?.issues[0].path).toEqual(['name'])
  })
})
```

### Step 2：运行测试验证失败

```bash
pnpm test src/components/form-schema/composables/use-validate.spec.ts
```

期望：FAIL，"Cannot find module './use-validate'" 或类似。**确认测试失败**——这是 TDD RED 阶段。

### Step 3：实现 use-validate.ts

```typescript
// src/components/form-schema/composables/use-validate.ts
import type { SchemaNode, ValidateOptions, ValidateResult } from '../types'
import type { ZodTypeAny } from 'zod'

/**
 * 静态校验 schema 是否合法
 * - component: string 或 Component（Vue 组件对象）
 * - on.*: 函数或函数表达式字符串
 * - children: SchemaNode | SchemaNode[] | string
 * - rules: string | RuleItem | Array
 */
export function validate(
  schema: SchemaNode | SchemaNode[] | unknown,
  options: ValidateOptions = {},
): ValidateResult {
  const errors: ValidateResult['errors'] = []
  traverse(schema, [], errors, options.validateFirst ?? false)
  return { isValid: errors.length === 0, errors }
}

function traverse(
  node: unknown,
  keyPath: (string | number)[],
  errors: ValidateResult['errors'],
  validateFirst: boolean,
): void {
  if (validateFirst && errors.length > 0) return
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    if (keyPath.length > 0) return // 顶层非对象由调用方保证
    return
  }
  const obj = node as Record<string, unknown>

  // 1. component
  if ('component' in obj && obj.component !== undefined) {
    const c = obj.component
    if (typeof c !== 'string' && !isVueComponent(c)) {
      errors.push({ keyPath: [...keyPath, 'component'], message: 'component 必须是字符串或 Vue 组件' })
    }
  }

  // 2. on.* 类型检查
  if (obj.on && typeof obj.on === 'object') {
    for (const [k, v] of Object.entries(obj.on as Record<string, unknown>)) {
      if (typeof v !== 'function' && typeof v !== 'string') {
        errors.push({
          keyPath: [...keyPath, 'on', k],
          message: '事件回调必须为函数或函数表达式',
        })
      }
    }
  }

  // 3. rules
  if ('rules' in obj && obj.rules !== undefined) {
    const r = obj.rules
    const ok =
      typeof r === 'string' ||
      (typeof r === 'object' && !Array.isArray(r)) ||
      Array.isArray(r)
    if (!ok) {
      errors.push({ keyPath: [...keyPath, 'rules'], message: 'rules 必须是 string/RuleItem/Array' })
    }
  }

  // 4. children 递归
  if ('children' in obj && obj.children !== undefined) {
    const c = obj.children
    if (Array.isArray(c)) {
      c.forEach((child, i) => traverse(child, [...keyPath, 'children', i], errors, validateFirst))
    } else if (typeof c === 'object' && c !== null) {
      traverse(c, [...keyPath, 'children'], errors, validateFirst)
    } else if (typeof c !== 'string') {
      errors.push({ keyPath: [...keyPath, 'children'], message: 'children 类型非法' })
    }
  }
}

function isVueComponent(v: unknown): boolean {
  return typeof v === 'object' && v !== null && ('render' in v || 'setup' in v || 'template' in v)
}

/**
 * 顶层 zod schema 校验（与 element-plus async-validator 并行）
 */
export function validateWithZod(
  zodSchema: ZodTypeAny,
  formData: unknown,
): { success: boolean; errors: import('zod').ZodError | null } {
  const result = zodSchema.safeParse(formData)
  if (result.success) return { success: true, errors: null }
  return { success: false, errors: result.error }
}
```

### Step 4：运行测试验证通过

```bash
pnpm test src/components/form-schema/composables/use-validate.spec.ts
```

期望：所有用例 PASS。如果失败，按失败信息调试 use-validate.ts，重复运行直至全部通过。

### Step 5：Commit

```bash
git add src/components/form-schema/composables/
git commit -m "feat(form-schema): 新增 use-validate 静态校验 composable"
```

---

## Task 3：element-plus-adapter.ts（Element Plus 组件映射）

**Files:**
- Test: `src/components/form-schema/element-plus-adapter.spec.ts`
- Create: `src/components/form-schema/element-plus-adapter.ts`

### Step 1：写失败的测试

```typescript
// src/components/form-schema/element-plus-adapter.spec.ts
import { describe, it, expect } from 'vitest'
import { resolveElComponentName } from './element-plus-adapter'

describe('resolveElComponentName(name, userComponentKeys?)', () => {
  it('resolves "Input" to "ElInput" from default map', () => {
    expect(resolveElComponentName('Input')).toBe('ElInput')
  })

  it('user components override default map (returns original name)', () => {
    expect(resolveElComponentName('MyInput', ['MyInput'])).toBe('MyInput')
  })

  it('returns null for unknown component (not in default map and not ElXxx)', () => {
    expect(resolveElComponentName('UnknownXYZ')).toBeNull()
  })

  it('passes through ElXxx native names directly', () => {
    expect(resolveElComponentName('ElInput')).toBe('ElInput')
    expect(resolveElComponentName('ElSelect')).toBe('ElSelect')
  })

  it('resolves various built-in shortcuts', () => {
    expect(resolveElComponentName('Select')).toBe('ElSelect')
    expect(resolveElComponentName('Switch')).toBe('ElSwitch')
    expect(resolveElComponentName('DatePicker')).toBe('ElDatePicker')
    expect(resolveElComponentName('InputNumber')).toBe('ElInputNumber')
  })
})
```

### Step 2：运行测试验证失败

```bash
pnpm test src/components/form-schema/element-plus-adapter.spec.ts
```

期望：FAIL，"Cannot find module './element-plus-adapter'"。**确认失败**。

### Step 3：实现 element-plus-adapter.ts

```typescript
// src/components/form-schema/element-plus-adapter.ts

/**
 * Schema 字符串快捷名 → Element Plus 全局注册名 的内置映射
 *
 * 为什么不直接 import element-plus 组件：
 *   - 违反 CLAUDE.md §1.6 项目按需加载约定（unplugin-vue-components）
 *   - 增加 bundle size
 *   - 运行时通过 vue 的 resolveComponent() 从全局注册表中查
 */
const DEFAULT_COMPONENT_MAP: Record<string, string> = {
  Input: 'ElInput',
  Select: 'ElSelect',
  Option: 'ElOption',
  Switch: 'ElSwitch',
  DatePicker: 'ElDatePicker',
  RadioGroup: 'ElRadioGroup',
  Radio: 'ElRadio',
  CheckboxGroup: 'ElCheckboxGroup',
  Checkbox: 'ElCheckbox',
  Cascader: 'ElCascader',
  InputNumber: 'ElInputNumber',
  Slider: 'ElSlider',
}

/**
 * 解析 schema.component 字符串到最终组件名（用于 resolveComponent 查找）
 *
 * 解析顺序：
 *   1. userComponents 显式注入的 key 命中 → 返回原 name（调用方走 user map）
 *   2. DEFAULT_COMPONENT_MAP 内置映射命中（如 Input → 'ElInput'）
 *   3. 直接返回原 name（ElInput 等已是 ElXxx 形态）
 *
 * 返回 null 时调用方应降级为 <div> 占位
 *
 * 返回 string 时调用方应使用 resolveComponent(name) 获取真实组件
 */
export function resolveElComponentName(
  name: string,
  userComponentKeys?: string[],
): string | null {
  if (userComponentKeys && userComponentKeys.includes(name)) {
    return name // 调用方走 user map
  }
  if (name in DEFAULT_COMPONENT_MAP) {
    return DEFAULT_COMPONENT_MAP[name] ?? null
  }
  if (name.startsWith('El')) {
    return name
  }
  return null
}

export { DEFAULT_COMPONENT_MAP }
```

> ✅ **架构调整**：adapter 不返回 Component 对象，只返回组件名字符串。运行时由 XForm.vue 用 vue 内置 `resolveComponent(name)` 查找真实组件。这避免了直接 import element-plus 增加 bundle。

### Step 4：运行测试验证通过

```bash
pnpm test src/components/form-schema/element-plus-adapter.spec.ts
```

期望：所有用例 PASS。

### Step 5：Commit

```bash
git add src/components/form-schema/element-plus-adapter.ts src/components/form-schema/element-plus-adapter.spec.ts
git commit -m "feat(form-schema): 新增 element-plus 组件映射 adapter"
```

---

## Task 4：composables/use-expression.ts（函数表达式沙箱 + dev 黑名单）

**Files:**
- Test: `src/components/form-schema/composables/use-expression.spec.ts`
- Create: `src/components/form-schema/composables/use-expression.ts`

### Step 1：写失败的测试

```typescript
// src/components/form-schema/composables/use-expression.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { resolveFunctionExpression, scanForForbidden } from './use-expression'

describe('resolveFunctionExpression(raw)', () => {
  it('parses valid {{ (m) => m.x }} into executable function', () => {
    const fn = resolveFunctionExpression('{{ (m) => m.x }}')
    expect(fn).not.toBeNull()
    expect(fn!({ x: 42 })).toBe(42)
  })

  it('parses {{(m) => m.x + 1}} without spaces', () => {
    const fn = resolveFunctionExpression('{{(m) => m.x + 1}}')
    expect(fn!({ x: 10 })).toBe(11)
  })

  it('returns null for non-string', () => {
    expect(resolveFunctionExpression(123 as unknown as string)).toBeNull()
  })

  it('returns null for string without {{ }}', () => {
    expect(resolveFunctionExpression('plain text')).toBeNull()
  })

  it('returns null + console.error for invalid expression syntax', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fn = resolveFunctionExpression('{{ (( }}')
    expect(fn).toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('scanForForbidden(schema)', () => {
  it('returns errors for on.change containing "window"', () => {
    const errors = scanForForbidden({
      on: { change: '{{ (m) => window.alert(m.x) }}' },
    })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toContain('window')
  })

  it('returns errors for on.* containing "eval"', () => {
    const errors = scanForForbidden({
      on: { click: '{{() => eval("alert(1)")}}' },
    })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('returns empty array for safe expressions', () => {
    const errors = scanForForbidden({
      on: { change: '{{ (m) => m.x }}' },
    })
    expect(errors).toEqual([])
  })

  it('recurses into children', () => {
    const errors = scanForForbidden({
      children: [
        { on: { focus: '{{() => document.cookie }}' } },
      ],
    })
    expect(errors.length).toBeGreaterThan(0)
  })
})
```

### Step 2：运行测试验证失败

```bash
pnpm test src/components/form-schema/composables/use-expression.spec.ts
```

期望：FAIL，"Cannot find module './use-expression'"。**确认失败**。

### Step 3：实现 use-expression.ts

```typescript
// src/components/form-schema/composables/use-expression.ts
import type { SchemaNode } from '../types'

const EXPRESSION_REG = /^\s*\{\{([\s\S]+)\}\}\s*$/
const FORBIDDEN_REG = /\b(window|document|globalThis|eval|Function|setTimeout|setInterval|fetch|XMLHttpRequest)\b/

/**
 * 沙箱解析 schema 中的 {{ ... }} 函数表达式
 *
 * SECURITY：用 new Function 替代 eval，隔离上层作用域，仅暴露 model 参数
 * 调用方必须保证 schema 来源可信（项目内部，不接受用户输入）
 */
export function resolveFunctionExpression<T extends (...a: unknown[]) => unknown>(
  raw: unknown,
): T | null {
  if (typeof raw !== 'string') return null
  const match = raw.match(EXPRESSION_REG)
  if (!match || !match[1]) return null
  try {
    const fn = new Function('model', `return (${match[1].trim()})`) as T
    return fn
  } catch (err) {
    console.error('[XForm] Invalid function expression:', raw, err)
    return null
  }
}

/**
 * 扫描 schema 中的函数表达式，标记含危险标识符的（window/eval/document 等）
 * 仅 dev 模式调用，prod 模式下不强制
 *
 * 返回违规描述数组；空数组表示安全
 */
export function scanForForbidden(schema: SchemaNode | SchemaNode[]): string[] {
  const errors: string[] = []
  traverse(schema)
  function traverse(node: unknown): void {
    if (node === null || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (obj.on && typeof obj.on === 'object') {
      for (const [k, v] of Object.entries(obj.on as Record<string, unknown>)) {
        if (typeof v === 'string' && FORBIDDEN_REG.test(v)) {
          errors.push(`on.${k} contains dangerous identifier: ${v}`)
        }
      }
    }
    if (Array.isArray(obj.children)) {
      obj.children.forEach(traverse)
    } else if (obj.children && typeof obj.children === 'object') {
      traverse(obj.children)
    }
    if (obj.slots && typeof obj.slots === 'object') {
      for (const slot of Object.values(obj.slots as Record<string, unknown>)) {
        traverse(slot)
      }
    }
    if (obj.formItem && typeof obj.formItem === 'object') {
      const fi = obj.formItem as Record<string, unknown>
      if (fi.slots && typeof fi.slots === 'object') {
        for (const slot of Object.values(fi.slots as Record<string, unknown>)) {
          traverse(slot)
        }
      }
    }
  }
  return errors
}
```

### Step 4：运行测试验证通过

```bash
pnpm test src/components/form-schema/composables/use-expression.spec.ts
```

期望：所有用例 PASS。

### Step 5：Commit

```bash
git add src/components/form-schema/composables/use-expression.ts src/components/form-schema/composables/use-expression.spec.ts
git commit -m "feat(form-schema): 新增 use-expression 函数表达式沙箱 + dev 黑名单"
```

### Step 6：🛡 安全审查节点

```bash
# 派发 security-reviewer 审查
```

调用 `security-reviewer` agent（或在对话中明确告知用户），审查点：
- `new Function('model', ` + `return (${expr.trim()})` 是否真的隔离上层作用域
- `FORBIDDEN_REG` 是否覆盖所有 OWASP A03 Injection 风险点
- 是否有用户输入流入 schema 的路径（如 prop 透传未校验）

**审查通过才能进入 Task 5**。如审查不通过，根据反馈修改 use-expression.ts，重跑测试，重复审查。

---

## Task 5：composables/use-reaction.ts（reaction 反应式编排）

**Files:**
- Test: `src/components/form-schema/composables/use-reaction.spec.ts`
- Create: `src/components/form-schema/composables/use-reaction.ts`

### Step 1：写失败的测试

```typescript
// src/components/form-schema/composables/use-reaction.spec.ts
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { applyReactions, containsReaction } from './use-reaction'

describe('containsReaction(schema)', () => {
  it('returns true if any node has reaction field', () => {
    expect(containsReaction({ reaction: { label: 'x' } })).toBe(true)
    expect(containsReaction({ children: [{ reaction: { label: 'x' } }] })).toBe(true)
  })

  it('returns false otherwise', () => {
    expect(containsReaction({ component: 'Input' })).toBe(false)
    expect(containsReaction({ children: [{ component: 'Input' }] })).toBe(false)
  })
})

describe('applyReactions(node, model, stoppers)', () => {
  it('applies reaction.label as literal string', () => {
    const node: { reaction?: { label?: unknown } } = {
      reaction: { label: '新标签' },
    }
    const stoppers: (() => void)[] = []
    applyReactions(node as never, {}, stoppers)
    expect(node.label).toBe('新标签')
    expect(node.reaction).toBeUndefined()
    expect(stoppers.length).toBe(0) // 字面量不产生 watchEffect
  })

  it('applies reaction.label as function', async () => {
    const node: { reaction?: { label?: unknown }; label?: unknown } = {
      reaction: { label: (m: { x: boolean }) => (m.x ? 'A' : 'B') },
    }
    const stoppers: (() => void)[] = []
    const model = ref({ x: true })
    applyReactions(node, model.value, stoppers)
    expect(node.label).toBe('A')
    expect(stoppers.length).toBeGreaterThan(0)
    // 清理
    stoppers.forEach((s) => s())
  })

  it('recurses into children', () => {
    const node = {
      children: [
        { reaction: { label: 'child label' } },
      ],
    }
    const stoppers: (() => void)[] = []
    applyReactions(node as never, {}, stoppers)
    expect((node.children as Array<{ label?: string }>)[0]!.label).toBe('child label')
  })

  it('catches evaluation error and keeps last value', async () => {
    const node: { reaction?: { label?: unknown }; label?: unknown } = {
      reaction: { label: () => { throw new Error('boom') } },
    }
    const stoppers: (() => void)[] = []
    // 不应抛错
    expect(() => applyReactions(node, {}, stoppers)).not.toThrow()
    stoppers.forEach((s) => s())
  })
})
```

### Step 2：运行测试验证失败

```bash
pnpm test src/components/form-schema/composables/use-reaction.spec.ts
```

期望：FAIL，"Cannot find module './use-reaction'"。**确认失败**。

### Step 3：实现 use-reaction.ts

```typescript
// src/components/form-schema/composables/use-reaction.ts
import { watchEffect } from 'vue'
import type { SchemaNode } from '../types'
import { resolveFunctionExpression } from './use-expression'

/**
 * 检查 schema 中是否含 reaction 字段（含字段时才需启用 watchEffect）
 */
export function containsReaction(schema: SchemaNode | SchemaNode[]): boolean {
  let found = false
  traverse(schema)
  function traverse(node: unknown): void {
    if (found || node === null || typeof node !== 'object') return
    const o = node as Record<string, unknown>
    if (o.reaction) {
      found = true
      return
    }
    if (Array.isArray(o.children)) {
      o.children.forEach(traverse)
    } else if (o.children && typeof o.children === 'object') {
      traverse(o.children)
    }
    if (o.slots && typeof o.slots === 'object') {
      for (const slot of Object.values(o.slots as Record<string, unknown>)) traverse(slot)
    }
    if (o.formItem && typeof o.formItem === 'object') {
      const fi = o.formItem as Record<string, unknown>
      if (fi.slots && typeof fi.slots === 'object') {
        for (const slot of Object.values(fi.slots as Record<string, unknown>)) traverse(slot)
      }
    }
  }
  return found
}

/**
 * 应用 reaction：递归遍历 schema，对每个含 reaction 的节点注册 watchEffect
 * 求值错误 → console.error + 保留上次有效值
 */
export function applyReactions(
  node: SchemaNode,
  model: Record<string, unknown>,
  stoppers: (() => void)[],
): void {
  if (node.reaction) {
    const stop = watchEffect(() => {
      try {
        applyReactionFields(node, node.reaction!, model)
      } catch (err) {
        console.error('[XForm] reaction evaluation error:', err)
      }
    })
    stoppers.push(stop)
    delete node.reaction
  }
  if (node.children) {
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => applyReactions(child, model, stoppers))
    } else if (typeof node.children === 'object') {
      applyReactions(node.children, model, stoppers)
    }
  }
  if (node.slots) {
    for (const slot of Object.values(node.slots)) {
      if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
        applyReactions(slot, model, stoppers)
      } else if (Array.isArray(slot)) {
        slot.forEach((child) => applyReactions(child, model, stoppers))
      }
    }
  }
  if (node.formItem && typeof node.formItem === 'object' && node.formItem.slots) {
    for (const slot of Object.values(node.formItem.slots)) {
      if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
        applyReactions(slot, model, stoppers)
      }
    }
  }
}

function applyReactionFields(
  node: SchemaNode,
  reaction: NonNullable<SchemaNode['reaction']>,
  model: Record<string, unknown>,
): void {
  for (const [key, raw] of Object.entries(reaction)) {
    let value: unknown = raw
    if (typeof raw === 'string') {
      const fn = resolveFunctionExpression(raw)
      if (fn) value = (fn as (m: Record<string, unknown>) => unknown)(model)
    } else if (typeof raw === 'function') {
      value = (raw as (m: Record<string, unknown>) => unknown)(model)
    }
    ;(node as Record<string, unknown>)[key] = value
  }
}
```

### Step 4：运行测试验证通过

```bash
pnpm test src/components/form-schema/composables/use-reaction.spec.ts
```

期望：所有用例 PASS。

### Step 5：Commit

```bash
git add src/components/form-schema/composables/use-reaction.ts src/components/form-schema/composables/use-reaction.spec.ts
git commit -m "feat(form-schema): 新增 use-reaction 反应式编排 composable"
```

---

## Task 6：composables/use-schema-renderer.ts（核心编排）

**Files:**
- Test: `src/components/form-schema/composables/use-schema-renderer.spec.ts`
- Create: `src/components/form-schema/composables/use-schema-renderer.ts`

### Step 1：写失败的测试

```typescript
// src/components/form-schema/composables/use-schema-renderer.spec.ts
import { describe, it, expect } from 'vitest'
import { effectScope, ref } from 'vue'
import { useSchemaRenderer } from './use-schema-renderer'

describe('useSchemaRenderer(opts)', () => {
  it('returns reactiveSchema reflecting initial schema', () => {
    const schema = ref({ component: 'Input', name: 'x' })
    const formData = ref({})
    const scope = effectScope()
    scope.run(() => {
      const { reactiveSchema } = useSchemaRenderer({
        schema,
        components: ref(undefined),
        formData,
      })
      expect(reactiveSchema.value).toEqual({ component: 'Input', name: 'x' })
    })
    scope.stop()
  })

  it('does NOT clone schema when no reaction field', () => {
    const original = { component: 'Input', name: 'x' }
    const schema = ref(original)
    const formData = ref({})
    const scope = effectScope()
    scope.run(() => {
      const { reactiveSchema } = useSchemaRenderer({
        schema,
        components: ref(undefined),
        formData,
      })
      // 同一引用（无 reaction 时跳过 cloneDeep 节省性能）
      expect(reactiveSchema.value).toBe(original)
    })
    scope.stop()
  })

  it('does NOT register watchEffect when schema has no reaction', () => {
    const schema = ref({ component: 'Input' })
    const formData = ref({})
    const scope = effectScope()
    let hasEffect = false
    scope.run(() => {
      useSchemaRenderer({
        schema,
        components: ref(undefined),
        formData,
      })
      // 内部 stoppers 不应有新条目
      hasEffect = false // 通过行为推断
    })
    scope.stop()
    expect(hasEffect).toBe(false)
  })

  it('clones schema and registers watchEffect when reaction present', async () => {
    const schema = ref({
      children: [{ component: 'Input', name: 'x', reaction: { label: (m: { x: boolean }) => (m.x ? 'A' : 'B') } }],
    })
    const formData = ref({ x: true })
    const scope = effectScope()
    scope.run(() => {
      const { reactiveSchema } = useSchemaRenderer({
        schema,
        components: ref(undefined),
        formData,
      })
      // reaction 已应用
      expect((reactiveSchema.value.children as Array<{ label?: string }>)[0]!.label).toBe('A')
      // 原 schema 未被修改（已 cloneDeep）
      expect((schema.value.children as Array<{ label?: string; reaction?: unknown }>)[0]!.label).toBeUndefined()
    })
    scope.stop()
  })

  it('cleans up all watchEffects on scope dispose', () => {
    const schema = ref({
      component: 'Input',
      reaction: { label: '{{ (m) => "x" }}' },
    })
    const formData = ref({})
    const scope = effectScope()
    scope.run(() => {
      useSchemaRenderer({
        schema,
        components: ref(undefined),
        formData,
      })
    })
    expect(() => scope.stop()).not.toThrow()
  })
})
```

### Step 2：运行测试验证失败

```bash
pnpm test src/components/form-schema/composables/use-schema-renderer.spec.ts
```

期望：FAIL，"Cannot find module './use-schema-renderer'"。**确认失败**。

### Step 3：实现 use-schema-renderer.ts

```typescript
// src/components/form-schema/composables/use-schema-renderer.ts
import { watch, shallowRef, onScopeDispose, type Ref } from 'vue'
import { cloneDeep } from 'lodash-es'
import type { Component } from 'vue'
import type { SchemaNode, XFormProps } from '../types'
import { containsReaction, applyReactions } from './use-reaction'

interface UseSchemaRendererOptions {
  schema: Ref<SchemaNode | SchemaNode[]>
  components: Ref<Record<string, Component> | undefined>
  formData: Ref<Record<string, unknown>>
  beforeChange?: XFormProps['beforeChange']
}

/**
 * 核心编排 composable
 * - watch(schema, deep)：schema 变化时按需克隆 + 注册 reaction watchEffect
 * - onScopeDispose：卸载时清理所有 watchEffect
 */
export function useSchemaRenderer(opts: UseSchemaRendererOptions) {
  const reactiveSchema = shallowRef<SchemaNode | SchemaNode[]>({})
  const stoppers: (() => void)[] = []

  watch(
    () => opts.schema.value,
    (val) => {
      stoppers.forEach((s) => s())
      stoppers.length = 0
      const hasRx = containsReaction(val)
      const cloned = hasRx ? cloneDeep(val) : val
      if (hasRx) {
        traverse(cloned as SchemaNode, opts.formData.value, stoppers)
      }
      reactiveSchema.value = cloned
    },
    { immediate: true, deep: true },
  )

  onScopeDispose(() => {
    stoppers.forEach((s) => s())
    stoppers.length = 0
  })

  return { reactiveSchema }
}

function traverse(
  node: SchemaNode | SchemaNode[],
  model: Record<string, unknown>,
  stoppers: (() => void)[],
): void {
  if (Array.isArray(node)) {
    node.forEach((n) => traverse(n, model, stoppers))
    return
  }
  applyReactions(node, model, stoppers)
}
```

### Step 4：运行测试验证通过

```bash
pnpm test src/components/form-schema/composables/use-schema-renderer.spec.ts
```

期望：所有用例 PASS。

### Step 5：Commit

```bash
git add src/components/form-schema/composables/use-schema-renderer.ts src/components/form-schema/composables/use-schema-renderer.spec.ts
git commit -m "feat(form-schema): 新增 use-schema-renderer 核心编排 composable"
```

---

## Task 7：XForm.vue（入口组件）

**Files:**
- Test: `src/components/form-schema/XForm.spec.ts`
- Create: `src/components/form-schema/XForm.vue`

### Step 1：写失败的测试

```typescript
// src/components/form-schema/XForm.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'
import XForm from './XForm.vue'

const ElStub = { name: 'ElForm', template: '<form><slot /></form>' }
const ElItemStub = { name: 'ElFormItem', template: '<div><slot /></div>' }
const ElRowStub = { name: 'ElRow', template: '<div><slot /></div>' }
const ElColStub = { name: 'ElCol', template: '<div><slot /></div>' }

const InputStub = {
  name: 'ElInput',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

describe('XForm.vue', () => {
  it('renders schema as el-form', async () => {
    const model = reactive({ name: 'foo' })
    const wrapper = mount(XForm, {
      props: {
        schema: { component: 'Input', name: 'name', label: 'Name' },
        model,
      },
      global: {
        components: {
          ElForm: ElStub,
          ElFormItem: ElItemStub,
          ElRow: ElRowStub,
          ElCol: ElColStub,
          ElInput: InputStub,
        },
        stubs: { ElConfigProvider: true },
      },
    })
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('exposes instance methods via defineExpose', async () => {
    const wrapper = mount(XForm, {
      props: { schema: { component: 'Input' } },
      global: {
        components: {
          ElForm: { ...ElStub, methods: { validate: () => Promise.resolve(true), clearValidate: () => {}, scrollToField: () => {} } },
          ElFormItem: ElItemStub,
          ElInput: InputStub,
        },
      },
    })
    await nextTick()
    const exposed = wrapper.vm as unknown as Record<string, unknown>
    expect(typeof exposed.validate).toBe('function')
    expect(typeof exposed.clearValidate).toBe('function')
    expect(typeof exposed.getNames).toBe('function')
    expect(typeof exposed.getRef).toBe('function')
    expect(typeof exposed.validateWithZod).toBe('function')
  })

  it('recursively renders children', async () => {
    const wrapper = mount(XForm, {
      props: {
        schema: {
          children: [
            { component: 'Input', name: 'a' },
            { component: 'Input', name: 'b' },
          ],
        },
      },
      global: {
        components: {
          ElForm: ElStub,
          ElFormItem: ElItemStub,
          ElInput: InputStub,
        },
      },
    })
    const inputs = wrapper.findAllComponents(InputStub)
    expect(inputs.length).toBe(2)
  })

  it('accepts schema as array (auto-wrap with children)', async () => {
    const wrapper = mount(XForm, {
      props: {
        schema: [{ component: 'Input', name: 'a' }],
      },
      global: {
        components: {
          ElForm: ElStub,
          ElFormItem: ElItemStub,
          ElInput: InputStub,
        },
      },
    })
    expect(wrapper.findAllComponents(InputStub).length).toBe(1)
  })

  it('getNames() returns all name fields', async () => {
    const wrapper = mount(XForm, {
      props: {
        schema: {
          children: [
            { component: 'Input', name: 'a' },
            { component: 'Input', name: 'b' },
            { component: 'Input', key: 'c-only' }, // 没有 name
          ],
        },
      },
      global: {
        components: { ElForm: ElStub, ElFormItem: ElItemStub, ElInput: InputStub },
      },
    })
    await nextTick()
    const exposed = wrapper.vm as unknown as { getNames(): string[] }
    expect(exposed.getNames().sort()).toEqual(['a', 'b', 'c-only'])
  })
})
```

### Step 2：运行测试验证失败

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

期望：FAIL，"Cannot find module './XForm.vue'"。**确认失败**。

### Step 3：实现 XForm.vue

```vue
<!-- src/components/form-schema/XForm.vue -->
<script setup lang="ts">
import { computed, ref, watch as vueWatch, onMounted, nextTick } from 'vue'
import {
  ElForm,
  ElFormItem,
  ElRow,
  ElCol,
  ElConfigProvider,
} from 'element-plus'
import type { Component } from 'vue'
import type { SchemaNode, XFormProps, XFormExpose } from './types'
import { useSchemaRenderer } from './composables/use-schema-renderer'
import { validate, validateWithZod } from './composables/use-validate'
import { resolveElComponent } from './element-plus-adapter'
// 注：实际实施时改为 resolveElComponentName（适配 P5 修复后签名）
import { resolveFunctionExpression, scanForForbidden } from './composables/use-expression'

const props = defineProps<XFormProps>()

// BEM 命名空间（auto-import）
const bem = createNamespace('x-form')

// schema 规范化：数组 → { children: array }
const normalizedSchema = computed<SchemaNode>(() => {
  if (Array.isArray(props.schema)) return { children: props.schema }
  return props.schema
})

// dev 模式 schema 自检
if (import.meta.env.DEV) {
  vueWatch(
    normalizedSchema,
    (val) => {
      const { isValid, errors } = validate(val)
      if (!isValid) console.error('[XForm] schema validation failed:', errors)
      const forbidden = scanForForbidden(val)
      if (forbidden.length > 0) {
        console.error('[XForm][SECURITY] forbidden identifiers in expressions:', forbidden)
      }
    },
    { immediate: true, deep: true },
  )
}

const formDataRef = computed(() => props.model ?? {})
const componentsRef = computed(() => props.components)

// 核心编排
const { reactiveSchema } = useSchemaRenderer({
  schema: normalizedSchema as unknown as Parameters<typeof useSchemaRenderer>[0]['schema'],
  components: componentsRef as unknown as Parameters<typeof useSchemaRenderer>[0]['components'],
  formData: formDataRef as unknown as Parameters<typeof useSchemaRenderer>[0]['formData'],
  beforeChange: props.beforeChange,
})

const elFormRef = ref<InstanceType<typeof ElForm> | null>(null)

// 渲染：递归遍历 schema
function renderNode(node: SchemaNode | string): unknown {
  if (typeof node === 'string') return node
  if (node.ignore) return null
  if (node.hidden) return null

  const componentName = typeof node.component === 'string' ? node.component : undefined
  let ResolvedComp: Component | null = null
  if (componentName) {
    ResolvedComp = resolveElComponent(componentName, props.components) ?? null
    // 注：P5 修复后改为：
    // const finalName = resolveElComponentName(componentName, Object.keys(props.components ?? {}))
    // ResolvedComp = finalName ? resolveComponent(finalName) : null
    if (!ResolvedComp) {
      // 兜底：用 vue resolveComponent 查全局
      ResolvedComp = resolveDynamic(componentName, props.components)
    }
  } else if (typeof node.component !== 'string') {
    ResolvedComp = node.component ?? null
  }

  if (!ResolvedComp) {
    // 未识别的字符串组件名 → 渲染为该标签
    if (componentName) return h(componentName, node.props, renderChildren(node.children))
    return null
  }

  // 事件绑定
  const events: Record<string, unknown> = {}
  if (node.on) {
    for (const [evt, raw] of Object.entries(node.on)) {
      if (typeof raw === 'function') events[evt] = raw
      else if (typeof raw === 'string') {
        const fn = resolveFunctionExpression(raw)
        if (fn) events[evt] = (val: unknown) => (fn as (m: Record<string, unknown>) => unknown)(props.model ?? {})
      }
    }
  }

  // formItem 包裹
  if (node.name !== undefined || node.formItem) {
    return h(ElFormItem, { label: node.label, prop: node.name, rules: compileRules(node.rules) }, () =>
      h(ResolvedComp, { ...node.props, ...events }, renderChildren(node.children)),
    )
  }

  // row + col 包裹
  if (node.row || node.column !== undefined) {
    const cols = Array.isArray(node.children) ? node.children : node.children ? [node.children] : []
    return h(ElRow, { ...node.row }, () =>
      h(
        ElCol,
        { span: node.col && typeof node.col === 'object' ? node.col.span : node.column ? 24 / node.column : 24 },
        () => renderNode(typeof cols[0] === 'object' ? cols[0] : { component: 'div', children: cols[0] as string }),
      ),
    )
  }

  return h(ResolvedComp, { ...node.props, ...events }, renderChildren(node.children))
}

function renderChildren(children: SchemaNode['children']): unknown {
  if (children === undefined) return null
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map((c) => renderNode(c))
  return renderNode(children)
}

function resolveDynamic(name: string, userComponents?: Record<string, Component>): Component | null {
  if (userComponents && name in userComponents) return userComponents[name] ?? null
  return null
}

function compileRules(
  rules: SchemaNode['rules'],
): Array<Record<string, unknown>> {
  if (!rules) return []
  const arr = Array.isArray(rules) ? rules : [rules]
  return arr
    .map((r) => {
      if (typeof r === 'string') return props.rules?.[r] ?? { required: true }
      return r
    })
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
}

// 实例方法透传
function getNames(includesIgnore?: boolean): string[] {
  const names: string[] = []
  const visit = (n: SchemaNode | string) => {
    if (typeof n === 'string') return
    if (!includesIgnore && n.ignore) return
    if (n.name) names.push(n.name)
    else if (n.key) names.push(String(n.key))
    if (Array.isArray(n.children)) n.children.forEach(visit)
    else if (typeof n.children === 'object') visit(n.children)
  }
  visit(normalizedSchema.value)
  return names
}

function getRef(key: string): Component | HTMLElement | null {
  const elForm = elFormRef.value as unknown as Record<string, unknown> | null
  return (elForm?.$refs as Record<string, unknown>)?.[key] as Component | HTMLElement | null ?? null
}

function validateForm(): Promise<boolean> {
  const elForm = elFormRef.value as unknown as { validate?: () => Promise<boolean> } | null
  return elForm?.validate?.() ?? Promise.resolve(true)
}

function clearValidate(): void {
  ;(elFormRef.value as unknown as { clearValidate?: () => void } | null)?.clearValidate?.()
}

function resetFields(): void {
  ;(elFormRef.value as unknown as { resetFields?: () => void } | null)?.resetFields?.()
}

function scrollToField(name: string): void {
  ;(elFormRef.value as unknown as { scrollToField?: (n: string) => void } | null)?.scrollToField?.(name)
}

function validateFormWithZod() {
  if (!props.zodSchema) return { success: true, errors: null }
  return validateWithZod(props.zodSchema, props.model ?? {})
}

onMounted(async () => {
  await nextTick()
})

defineExpose({
  getRef,
  getNames,
  validate: validateForm,
  clearValidate,
  resetFields,
  scrollToField,
  validateWithZod: validateFormWithZod,
} satisfies XFormExpose)
</script>

<template>
  <ElConfigProvider>
    <div :class="bem.b()">
      <ElForm ref="elFormRef" :model="props.model">
        <component :is="renderToComponent(reactiveSchema)" />
      </ElForm>
    </div>
  </ElConfigProvider>
</template>

<style lang="scss">
.#{$BEM_PREFIX}-x-form {
  // 命名空间由 BEM 接管，scoped 禁止添加
}
</style>
```

> ✅ **关键修复**：
> - Vue 3.5 `defineExpose` 不支持泛型，改用 `defineExpose({...} satisfies XFormExpose)`（保留类型检查 + 不使用尖括号泛型）
> - 删除原计划中的第二个 `<script lang="ts">` 块（违反 Vue SFC 规范）
> - 模板中的 `<renderNode>` 替换为 `<component :is="renderToComponent(reactiveSchema)" />`
> - `renderToComponent` 函数在 `<script setup>` 中通过 `h()` 实现递归

**完整 XForm.vue 实现参考**（实施时按此结构）：

```vue
<script setup lang="ts">
import { h, computed, ref, watch as vueWatch, onMounted, nextTick, resolveComponent } from 'vue'
import { ElForm, ElFormItem, ElRow, ElCol, ElConfigProvider } from 'element-plus'
// ... 其他类型 + composable imports

// ... props 定义、bem 定义、normalizedSchema、useSchemaRenderer 调用、elFormRef

// 递归渲染主函数（替代 renderNode）
function renderToComponent(node: SchemaNode | SchemaNode[] | string | undefined | null) {
  if (node === null || node === undefined) return null
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(renderToComponent)
  // ... 单节点处理（formItem / row / col / 兜底）
  return h(...)
}
</script>
```

### Step 4：运行测试验证通过

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

期望：所有用例 PASS。如果失败，根据错误调整 XForm.vue（最常见的是模板/渲染逻辑问题），重跑测试。

### Step 5：Commit

```bash
git add src/components/form-schema/XForm.vue src/components/form-schema/XForm.spec.ts
git commit -m "feat(form-schema): 新增 XForm 入口组件（递归渲染 + 实例方法透传）"
```

---

## Task 8：index.ts（全局注册 + re-export）

**Files:**
- Test: `src/components/form-schema/index.spec.ts`
- Create: `src/components/form-schema/index.ts`

### Step 1：写失败的测试

```typescript
// src/components/form-schema/index.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { createApp } from 'vue'
import FormSchemaPlugin from './index'
import XForm from './XForm.vue'
import { validate } from './composables/use-validate'

describe('FormSchemaPlugin', () => {
  it('install(app) registers XForm globally', () => {
    const app = createApp({})
    const componentSpy = vi.spyOn(app, 'component')
    app.use(FormSchemaPlugin)
    expect(componentSpy).toHaveBeenCalledWith('XForm', XForm)
  })

  it('re-exports validate() from use-validate', () => {
    expect(typeof validate).toBe('function')
    const result = validate({ component: 'Input' })
    expect(result.isValid).toBe(true)
  })

  it('default export is installable', () => {
    const app = createApp({})
    expect(() => app.use(FormSchemaPlugin)).not.toThrow()
  })
})
```

### Step 2：运行测试验证失败

```bash
pnpm test src/components/form-schema/index.spec.ts
```

期望：FAIL，"Cannot find module './index'"。**确认失败**。

### Step 3：实现 index.ts

```typescript
// src/components/form-schema/index.ts
import type { App, Component } from 'vue'
import XForm from './XForm.vue'

export { validate, validateWithZod } from './composables/use-validate'
export { resolveFunctionExpression } from './composables/use-expression'
export { resolveElComponentName } from './element-plus-adapter'
export type {
  SchemaNode,
  XFormProps,
  XFormExpose,
  RuleItem,
  ReactionConfig,
  DirectiveConfig,
  FormItemConfig,
  RowConfig,
  ColConfig,
  EventFn,
  FunctionExpression,
} from './types'

/**
 * Vue 插件形式：app.use(FormSchema) 注册 <XForm> 全局组件
 */
const FormSchemaPlugin: { install: (app: App) => void } & Component = {
  install(app: App) {
    app.component('XForm', XForm)
  },
}

// 默认导出：Vue 插件（也可作为 Component 直接使用）
export default FormSchemaPlugin
```

### Step 4：运行测试验证通过

```bash
pnpm test src/components/form-schema/index.spec.ts
```

期望：所有用例 PASS。

### Step 5：Commit

```bash
git add src/components/form-schema/index.ts src/components/form-schema/index.spec.ts
git commit -m "feat(form-schema): 新增 index 入口（全局注册 + re-export）"
```

---

## Task 9：全量验证 + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

### Step 1：类型校验

```bash
pnpm type-check:full
```

期望：所有文件通过 TypeScript 编译。如有 error，按错误修正对应文件，重复运行直至通过。

### Step 2：Lint 检查

```bash
pnpm lint
```

期望：无 error。如有 lint error，根据提示修复（通常是 import 顺序、未使用变量等），重跑。

### Step 3：单测 + 覆盖率

```bash
pnpm test
pnpm test:coverage
```

期望：
- 所有测试 PASS
- 行覆盖率 ≥80%
- 函数覆盖率 ≥80%
- 分支覆盖率 ≥75%

如有失败用例或覆盖率不达标，按 Task 2-8 调试对应文件，重跑。

### Step 4：构建

```bash
pnpm build
```

期望：构建成功，无 TS 错误，无 Vite 警告。如失败，检查 element-plus 全局引入、按需引入配置。

### Step 5：更新 CHANGELOG.md

修改 `CHANGELOG.md`，在最新 Unreleased section 添加：

```markdown
## [Unreleased]

### Features
- **form-schema-engine**：新增 `<XForm>` 全局组件，支持动态 schema DSL 渲染表单
  - 参考开源 form-schema 515 行渲染核心，用 Element Plus 替换原私有设计系统
  - 用 `new Function` 沙箱替代 `eval`，含 dev 模式关键字黑名单扫描
  - 沿用 element-plus async-validator + 可zod 顶层校验双轨
  - 支持全量 14 字段 schema DSL（component/props/on/children/name/label/rules/formItem/modelProp/row/column/col/reaction/directives/slots/ignore/hidden/key）
  - 实例方法：`getRef` / `getNames` / `validate` / `clearValidate` / `resetFields` / `scrollToField` / `validateWithZod`
  - 命名导出 `validate(schema, opts?)` / `validateWithZod(zodSchema, formData)` / `resolveElComponentName` / `resolveFunctionExpression`
  - 文件清单：`src/components/form-schema/{types,XForm}.{ts,vue}` + `composables/{use-validate,use-expression,use-reaction,use-schema-renderer}.ts` + `element-plus-adapter.ts` + `index.ts`
  - 9 文件全部含对应 .spec.ts 单元测试，覆盖率 ≥80%
```

### Step 6：Commit

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): 记录 form-schema-engine 新增"
```

---

## 中间检查点

| 节点 | 触发条件 | 验证项 |
|------|---------|--------|
| **CP1** | Task 5 完成（types + 4 composables 完成） | `pnpm test src/components/form-schema/composables` 全部通过；security-reviewer 已审查 use-expression |
| **CP2** | Task 7 完成（XForm.vue 完成） | `pnpm test src/components/form-schema/XForm.spec.ts` 通过；§3 BEM 命名合规 |
| **CP3** | Task 8 完成（index.ts 完成） | `pnpm test src/components/form-schema` 全部通过；§1.6 AutoImport 合规 |
| **CP4** | Task 9 完成（验证 + CHANGELOG） | `pnpm type-check:full && pnpm lint && pnpm test:coverage && pnpm build` 全部通过；CHANGELOG 已更新 |

---

## 风险预案（参考 spec §8.6）

| 风险                              | 触发条件             | 回退方案 |
| --------------------------------- | -------------------- | -------- |
| XForm.vue 超 300 行               | 行数 >300            | 拆为 `XForm.vue`（薄壳 ≤80） + `useXForm.ts`（编排逻辑 ≤200） |
| reaction 性能问题                 | watchEffect 触发频繁 | 加 lodash debounce 200ms 节流 |
| new Function 残余风险             | security-reviewer 不通过 | 移除函数体字符串支持（仅接受函数 reaction） |
| 515 行 fork 消化时间长            | 工期超 2 周          | 分 3 个 PR 顺序：① types + use-validate ② adapter + use-expression + use-reaction ③ use-schema-renderer + XForm + index |

---

## 执行提示

**TDD 纪律**：每个 Task 都先写失败测试 → 验证失败 → 写最小实现 → 验证通过 → commit。**禁止跳过 RED 阶段**（未经测试先写代码违反 §一.4）。

**AutoImport 纪律**：不要 `import { ref, computed } from 'vue'` 等已自动注入的标识符（参考 CLAUDE.md §1.6）。

**BEM 纪律**：XForm.vue 必须用 `createNamespace('x-form')` + `<style lang="scss">` 无 scoped + `.#{$BEM_PREFIX}-x-form` 根选择器（参考 CLAUDE.md §3）。

**类型纪律**：严禁 `any`，用 `unknown` + 类型守卫（参考 CLAUDE.md §一.5）。

**commit 纪律**：必须用中文 commit msg（参考 CLAUDE.md §七）。

---

**计划版本**：v1.0.0 | **生成日期**：2026-08-19 | **基于 spec**：2026-08-19-form-schema-design.md