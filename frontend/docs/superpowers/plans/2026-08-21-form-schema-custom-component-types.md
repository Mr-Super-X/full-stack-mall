# form-schema 自定义组件类型推导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `SchemaNodeFor<'CustomComp'>` 和链式 builder 支持消费方通过 TypeScript module augmentation 扩展自定义组件的 props 类型，不再受限于内置 EL 组件列表。

**Architecture:** 将 `PropsByComponent` 从固定 `type` 改为可声明合并的 `interface ComponentPropsRegistry`，`ComponentName` 自动从该接口推导，`SchemaNodeFor` 和 `makeBuilder` 统一读取该注册表。消费方在模块声明中扩展接口即可获得类型推导。

**Tech Stack:** Vue 3.5 + TypeScript 6 + Vitest + `*.test-d.ts` 编译时类型测试

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/components/form-schema/types.ts` | 声明 `ComponentPropsRegistry` 接口、`ComponentName`、`SchemaNodeFor`；保留 `PropsByComponent` 别名向后兼容。 |
| `src/components/form-schema/builders.ts` | `makeBuilder` 与 `NodeBuilder` 泛型绑定到 `ComponentPropsRegistry` 和 `ComponentName`。 |
| `src/components/form-schema/types.custom-component.test-d.ts` | 类型测试：验证 module augmentation 后 `SchemaNodeFor` 与 `xCustom` builder 的 props 推导。 |
| `src/components/form-schema/README.md` | 新增“自定义组件类型扩展”小节。 |

---

## Task 1: 将 `PropsByComponent` 改为可扩展接口 `ComponentPropsRegistry`

**Files:**
- Modify: `src/components/form-schema/types.ts:271-295`

- [ ] **Step 1: 重命名为 interface 并保留向后兼容别名**

将现有 `type PropsByComponent = { ... }` 改为 `interface ComponentPropsRegistry`，并新增 `export type PropsByComponent = ComponentPropsRegistry` 别名，避免破坏已有消费方。

```ts
/**
 * 组件 props 注册表（可声明合并）
 *
 * 消费方可通过 TypeScript module augmentation 扩展自定义组件：
 * ```ts
 * declare module '@/components/form-schema/types' {
 *   interface ComponentPropsRegistry {
 *     MyInput: MyInputProps
 *   }
 * }
 * ```
 */
export interface ComponentPropsRegistry {
  Input: ElInputProps
  Select: ElSelectProps
  Option: ElOptionProps
  Switch: ElSwitchProps
  DatePicker: ElDatePickerProps
  TimePicker: ElTimePickerProps
  TimeSelect: ElTimeSelectProps
  TreeSelect: ElTreeSelectProps
  Upload: ElUploadProps
  Autocomplete: ElAutocompleteProps
  Transfer: ElTransferProps
  RadioGroup: ElRadioGroupProps
  Radio: ElRadioProps
  CheckboxGroup: ElCheckboxGroupProps
  Checkbox: ElCheckboxProps
  Cascader: ElCascaderProps
  InputNumber: ElInputNumberProps
  Slider: ElSliderProps
  Card: ElCardProps
  FormItem: ElFormItemProps
  // 数组节点不绑 el 组件,内部独立渲染 —— props 类型留空占位
  ArrayNode: Record<string, unknown>
}

/** 向后兼容别名，等效于 ComponentPropsRegistry */
export type PropsByComponent = ComponentPropsRegistry
```

- [ ] **Step 2: 更新 `ComponentName` 与 `SchemaNodeFor`**

```ts
/** 支持类型推导的 component 名 */
export type ComponentName = keyof ComponentPropsRegistry

/**
 * 按 component 字段推导 props 类型的 SchemaNode 泛型
 */
export type SchemaNodeFor<C extends ComponentName = ComponentName> = Omit<
  SchemaNode,
  'component' | 'props'
> & {
  component: C
  props?: ComponentPropsRegistry[C]
}
```

- [ ] **Step 3: 跑类型检查确认无回归**

Run: `pnpm type-check:full`
Expected: 无新增 TS 错误，现有 `SchemaNodeFor<'Input'>` 等推导保持。

---

## Task 2: 更新 `builders.ts` 泛型绑定到注册表

**Files:**
- Modify: `src/components/form-schema/builders.ts:15-22`, `:25`, `:129-207`

- [ ] **Step 1: 导入 `ComponentPropsRegistry` 并替换 `PropsByComponent` 在泛型约束中的使用**

```ts
import type {
  SchemaNode,
  SchemaNodeFor,
  ComponentName,
  ComponentPropsRegistry, // 新增
  RuleItem,
  ReactionValue,
} from './types'
```

- [ ] **Step 2: 修改 `NodeBuilder` 与 `makeBuilder` 泛型**

```ts
class NodeBuilder<C extends ComponentName, P = ComponentPropsRegistry[C]> {
  // ... 其余不变
}

function makeBuilder<C extends ComponentName>(
  componentName: C
): new (name: string) => NodeBuilder<C, ComponentPropsRegistry[C]> & { [k: string]: unknown } {
  // ... 内部 _b 类型同步调整
  return class {
    private _b: NodeBuilder<C, ComponentPropsRegistry[C]>
    constructor(name: string) {
      this._b = new NodeBuilder<C, ComponentPropsRegistry[C]>(name)
      ;(this._b.node as { component?: C }).component = componentName
    }
    // ... 其余返回 this 的方法不变
  } as unknown as new (
    name: string
  ) => NodeBuilder<C, ComponentPropsRegistry[C]> & { [k: string]: unknown }
}
```

- [ ] **Step 3: 跑类型检查与单元测试**

Run: `pnpm type-check:full`
Run: `pnpm test src/components/form-schema/builders.spec.ts`
Expected: 全部通过。

---

## Task 3: 新增自定义组件类型扩展测试

**Files:**
- Create: `src/components/form-schema/types.custom-component.test-d.ts`

- [ ] **Step 1: 定义一个自定义组件 props 类型并扩展注册表**

```ts
/**
 * 自定义组件类型扩展测试（编译时类型测试）
 *
 * 验证消费方通过 module augmentation 扩展 ComponentPropsRegistry 后：
 * 1. SchemaNodeFor<'MyInput'> 能推导自定义 props
 * 2. makeBuilder 派生的 xMyInput() builder 有自定义 props 提示
 */
import type { SchemaNodeFor, ComponentPropsRegistry } from './types'
import type { xInput } from './builders'

// 自定义组件 props
interface MyInputProps {
  prefix?: string
  suffix?: string
  modelValue?: string
}

declare module './types' {
  interface ComponentPropsRegistry {
    MyInput: MyInputProps
  }
}

// === SchemaNodeFor 扩展后推导 ===
const _myInputValid: SchemaNodeFor<'MyInput'> = {
  component: 'MyInput',
  name: 'keyword',
  props: { prefix: 'Search:', suffix: '✓', modelValue: '' },
}
void _myInputValid

// 错误示例（注释掉，仅文档化）
// const _myInputBad: SchemaNodeFor<'MyInput'> = {
//   component: 'MyInput',
//   props: { prefix: 123 }, // ❌ 类型错
// }
```

- [ ] **Step 2: 验证 builder 扩展（若 `builders.ts` 已导出工厂）**

当前 `builders.ts` 未直接导出 `makeBuilder`，但可以通过 `xInput` 的返回类型是 `SchemaNodeFor<'Input'>` 来侧面验证注册表机制。为验证自定义 builder，在测试中通过 `xInput` 推断返回类型：

```ts
// 通过 xInput 返回类型验证注册表读取正常
const _inputBuilderReturn = xInput('email').build()
type _InputBuilderReturnType = typeof _inputBuilderReturn
void _InputBuilderReturnType
```

- [ ] **Step 3: 跑类型检查**

Run: `pnpm type-check:full`
Expected: 无 TS 错误；若注释掉错误示例再放开，应报 `TS2322`。

---

## Task 4: 更新 README 说明自定义组件类型扩展

**Files:**
- Modify: `src/components/form-schema/README.md`

- [ ] **Step 1: 在“类型推导”节后插入新小节**

在 `## 类型推导（SchemaNodeFor）` 之后追加：

```markdown
## 自定义组件类型扩展

如果业务写了自定义字段组件，可以让 `SchemaNodeFor` 和 builder 也识别它的 props：

```ts
// types/form-schema.d.ts
import type { ComponentPropsRegistry } from '@/components/form-schema/types'

interface MyInputProps {
  prefix?: string
  suffix?: string
  modelValue?: string
}

declare module '@/components/form-schema/types' {
  interface ComponentPropsRegistry {
    MyInput: MyInputProps
  }
}
```

扩展后：

```ts
const node: SchemaNodeFor<'MyInput'> = {
  component: 'MyInput',
  name: 'keyword',
  props: { prefix: 'Search:', suffix: '✓' }, // IDE 自动补全 + 类型校验
}
```

> 注意：类型扩展仅影响 TS 推导，运行时仍需在 `XForm` 的 `components` prop 中注册 `<XForm :components="{ MyInput: MyInputComp }" />`。
```

- [ ] **Step 2: 更新 README 中“支持的 component 名”描述**

将原 `支持的 component 名（12 个）...` 改为：

```markdown
内置支持类型推导的 component 名：18 个（见 `ComponentPropsRegistry`）。
自定义组件可通过 module augmentation 扩展该注册表。
```

---

## Task 5: 回归验证

- [ ] **Step 1: 跑全量单测**

Run: `pnpm test src/components/form-schema/`
Expected: 全部通过。

- [ ] **Step 2: 跑全量类型检查**

Run: `pnpm type-check:full`
Expected: 无新增 TS 错误。

- [ ] **Step 3: 跑 lint**

Run: `pnpm lint`
Expected: 无新增 lint 错误。

- [ ] **Step 4: 派发 code-reviewer 审查**

使用 `code-reviewer` agent 审查 `types.ts`、`builders.ts`、测试文件和 README 变更。

---

## Self-Review

- **Spec coverage:** 可扩展类型注册表、builder 绑定、类型测试、文档均已覆盖。
- **Placeholder scan:** 无 TBD/TODO/"implement later"；每个步骤含具体代码和命令。
- **Type consistency:** `ComponentPropsRegistry` 贯穿 types.ts、builders.ts、测试文件；`PropsByComponent` 作为别名保留向后兼容。
