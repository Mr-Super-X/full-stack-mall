# Form Schema Default Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `XForm` 增加 `InputPassword`、`InputTextArea`、`InputTag`、`ColorPicker`、`Mention`、`Rate` 的快捷名、Element Plus 运行时注册、真实 props 类型推导、链式 builder 和安全默认 props，同时将 `InputNumber` 纳入内置默认配置。

**Architecture:** 继续以 `element-plus-adapter.ts` 作为名称与默认 props 的配置源，以 `render-schema-node.ts` 的直接组件映射和通用 `v-model` 渲染链作为运行时入口，以 `ComponentPropsRegistry` 作为类型源。`InputPassword` 与 `InputTextArea` 不创建新 wrapper，而是作为 `ElInput` 的语义别名；`InputTag`、`ColorPicker`、`Mention`、`Rate` 直接映射 Element Plus 原生组件。

**Tech Stack:** Vue 3.5、TypeScript 6、Element Plus 2.14.3、Pinia 现有 XForm 架构、Vitest、Vue Test Utils、pnpm。

---

## 0. 执行约束与审批门

### 0.1 已批准设计

实现必须遵循：

- `docs/superpowers/specs/2026-08-28-form-schema-default-components-design.md`

### 0.2 `src/` 修改申请

在编码开始前，必须先向用户提交并取得单独批准。以下为本计划明确涉及的全部 `src/` 写操作：

- `src/components/form-schema/element-plus-adapter.ts`
- `src/components/form-schema/composables/render-schema-node.ts`
- `src/components/form-schema/types.ts`
- `src/components/form-schema/builders.ts`
- `src/components/form-schema/index.ts`
- `src/components/form-schema/element-plus-adapter.spec.ts`
- `src/components/form-schema/composables/render-schema-node.spec.ts`
- `src/components/form-schema/types.types-derivation.test-d.ts`
- `src/components/form-schema/builders.spec.ts`
- `src/components/form-schema/XForm.spec.ts`

不修改或删除 `src/` 下任何其他文件，不新增或移动 `src/` 目录、文件。

### 0.3 当前工作区保护

当前 Git index 已包含以下变更，实施时必须保留且不得混入、覆盖或撤销：

- 新增设计文档 `docs/superpowers/specs/2026-08-28-form-schema-default-components-design.md`
- 已暂存的 `src/modules/demo/examples/XFormEvents.vue`：为 TextArea 示例增加 `showWordLimit: true`

不得修改 `XFormEvents.vue`，不得擅自执行 `git reset`、反暂存或提交。验证最终差异时使用 `git diff HEAD`，不能只看未暂存工作区差异。

### 0.4 Git 约束

本计划不包含 `git commit` 步骤。只有用户后续明确要求提交时，才使用中文 Conventional Commit 消息提交。

### 0.5 实施代理约束

- 开始编码后先派发 `tdd-guide`，按每个任务的 RED → GREEN → IMPROVE 执行。
- 所有实现完成后只走一次 `typescript-reviewer` 独立审查通道，避免与通用 `code-reviewer` 重复审查同一代码。
- UI 关键流程使用 `/browse` 做真实页面检查；本任务不涉及认证、支付、用户数据或外部 API，不触发 security reviewer。

---

## 1. 文件结构与职责

| 文件 | 本次职责 |
|---|---|
| `element-plus-adapter.ts` | 名称白名单、短名到 `ElXxx` 映射、内置安全默认 props |
| `render-schema-node.ts` | 新增真实 Element Plus 组件导入和直接组件映射；两个 Input 模式别名复用 `ElInput` |
| `types.ts` | 提取新 Element Plus props 类型并注册到 `ComponentPropsRegistry` |
| `builders.ts` | 新增 6 个链式 builder 工厂 |
| `index.ts` | 同步 builder 数量说明，不改运行时导出结构 |
| `element-plus-adapter.spec.ts` | RED/GREEN 验证名称解析、短名/全名和默认 props |
| `render-schema-node.spec.ts` | 验证组件解析、默认 props 和不同 model 值写回 |
| `XForm.spec.ts` | 验证 `XForm` 集成层中的别名与 `InputNumber` 默认 props |
| `types.types-derivation.test-d.ts` | 编译期验证 6 个新 `SchemaNodeFor` |
| `builders.spec.ts` | 验证 6 个新 builder 的返回形态 |
| `README.md` | 同步组件清单、builder 示例和默认 props 说明 |
| `docs/24-XForm使用指南.md` | 同步完整使用指南的组件名、默认表和 builder 表 |
| `CHANGELOG.md` | 在未发布功能区记录功能和防回归测试 |

---

### Task 1: 建立名称与默认 props 基线

**Files:**
- Modify: `src/components/form-schema/element-plus-adapter.spec.ts:22-40`
- Modify: `src/components/form-schema/element-plus-adapter.ts:13-74`

- [ ] **Step 1: 扩展适配层测试并确认 RED**

将 `element-plus-adapter.spec.ts` 中现有快捷名测试替换为以下精确断言：

```ts
  it('resolves extended built-in shortcuts', () => {
    expect(resolveElComponentName('Input')).toBe('ElInput')
    expect(resolveElComponentName('InputPassword')).toBe('ElInput')
    expect(resolveElComponentName('InputTextArea')).toBe('ElInput')
    expect(resolveElComponentName('InputTag')).toBe('ElInputTag')
    expect(resolveElComponentName('ColorPicker')).toBe('ElColorPicker')
    expect(resolveElComponentName('Mention')).toBe('ElMention')
    expect(resolveElComponentName('Rate')).toBe('ElRate')
  })

  it('resolves alias full names to the same Element Plus components', () => {
    expect(resolveElComponentName('ElInputPassword')).toBe('ElInput')
    expect(resolveElComponentName('ElInputTextArea')).toBe('ElInput')
    expect(resolveElComponentName('ElInputTag')).toBe('ElInputTag')
    expect(resolveElComponentName('ElColorPicker')).toBe('ElColorPicker')
    expect(resolveElComponentName('ElMention')).toBe('ElMention')
    expect(resolveElComponentName('ElRate')).toBe('ElRate')
  })

  it('DEFAULT_COMPONENT_PROPS exposes only safe defaults', () => {
    expect(DEFAULT_COMPONENT_PROPS.Input).toEqual({ clearable: true })
    expect(DEFAULT_COMPONENT_PROPS.InputNumber).toEqual({ controlsPosition: 'right' })
    expect(DEFAULT_COMPONENT_PROPS.InputPassword).toEqual({
      type: 'password',
      showPassword: true,
    })
    expect(DEFAULT_COMPONENT_PROPS.ElInputPassword).toEqual({
      type: 'password',
      showPassword: true,
    })
    expect(DEFAULT_COMPONENT_PROPS.InputTextArea).toEqual({ type: 'textarea' })
    expect(DEFAULT_COMPONENT_PROPS.ElInputTextArea).toEqual({ type: 'textarea' })
    expect(DEFAULT_COMPONENT_PROPS.InputTag).toEqual({ clearable: true })
    expect(DEFAULT_COMPONENT_PROPS.ColorPicker).toBeUndefined()
    expect(DEFAULT_COMPONENT_PROPS.Mention).toBeUndefined()
    expect(DEFAULT_COMPONENT_PROPS.Rate).toBeUndefined()
  })
```

保留现有未知组件和 `ElXxx` 透传测试，不删除既有覆盖。

运行：

```bash
pnpm test src/components/form-schema/element-plus-adapter.spec.ts
```

预期：FAIL；至少包含 `InputPassword`、`InputTag`、`ColorPicker` 等名称解析为 `null`，以及新默认 props 为 `undefined`。

- [ ] **Step 2: 扩展名称映射**

在 `DEFAULT_COMPONENT_MAP` 的 `Input` 后加入：

```ts
  InputPassword: 'ElInput',
  ElInputPassword: 'ElInput',
  InputTextArea: 'ElInput',
  ElInputTextArea: 'ElInput',
  InputTag: 'ElInputTag',
  ColorPicker: 'ElColorPicker',
  Mention: 'ElMention',
  Rate: 'ElRate',
```

`InputTag` 放在 Input 系列附近；`ColorPicker`、`Mention`、`Rate` 放在通用表单组件附近。不得新增第二个组件名字典。

- [ ] **Step 3: 扩展安全默认 props**

将 `BASE_DEFAULT_COMPONENT_PROPS` 调整为：

```ts
const BASE_DEFAULT_COMPONENT_PROPS: Record<string, Record<string, unknown>> = {
  Input: { clearable: true },
  InputNumber: { controlsPosition: 'right' },
  InputPassword: { type: 'password', showPassword: true },
  InputTextArea: { type: 'textarea' },
  InputTag: { clearable: true },
  Select: { clearable: true },
  Cascader: { clearable: true },
  DatePicker: { clearable: true },
  TimePicker: { clearable: true },
  TimeSelect: { clearable: true },
  TreeSelect: { clearable: true },
  Autocomplete: { clearable: true },
}
```

同步修正文件注释：不再写“目前仅对支持 clearable 的组件默认开启 clearable”，改为说明本表包含“轻量输入 UX 默认值和 Input 语义别名默认值”，并强调不强制 ColorPicker、Mention、Rate 的业务偏好。

- [ ] **Step 4: 运行适配层测试确认 GREEN**

运行：

```bash
pnpm test src/components/form-schema/element-plus-adapter.spec.ts
```

预期：`1` 个测试文件通过，新增名称与默认 props 断言全部 PASS；不再出现 `close timed out` 之外的非零退出。

---

### Task 2: 补齐 TypeScript 组件注册表

**Files:**
- Modify: `src/components/form-schema/types.types-derivation.test-d.ts:9-67`
- Modify: `src/components/form-schema/types.ts:1-24`
- Modify: `src/components/form-schema/types.ts:343-402`

- [ ] **Step 1: 写入新类型推导用例并确认 RED**

在 `types.types-derivation.test-d.ts` 增加：

```ts
const _inputPassword: SchemaNodeFor<'InputPassword'> = {
  component: 'InputPassword',
  props: { type: 'password', showPassword: true },
}
const _inputTextArea: SchemaNodeFor<'InputTextArea'> = {
  component: 'InputTextArea',
  props: { type: 'textarea', rows: 4 },
}
const _inputTag: SchemaNodeFor<'InputTag'> = {
  component: 'InputTag',
  props: { modelValue: ['Vue', 'Element Plus'], max: 5, clearable: true },
}
const _colorPicker: SchemaNodeFor<'ColorPicker'> = {
  component: 'ColorPicker',
  props: { modelValue: '#1890ff', colorFormat: 'hex', showAlpha: true },
}
const _mention: SchemaNodeFor<'Mention'> = {
  component: 'Mention',
  props: { modelValue: '@alice', options: [{ value: 'alice', label: 'Alice' }] },
}
const _rate: SchemaNodeFor<'Rate'> = {
  component: 'Rate',
  props: { modelValue: 4, allowHalf: true },
}

void _inputPassword
void _inputTextArea
void _inputTag
void _colorPicker
void _mention
void _rate
```

运行：

```bash
pnpm type-check:full
```

预期：FAIL；`ComponentPropsRegistry` 缺少 `InputPassword`、`InputTextArea`、`InputTag`、`ColorPicker`、`Mention`、`Rate`。

- [ ] **Step 2: 引入真实组件类型**

在 `types.ts` 的 `element-plus` type import 中加入：

```ts
  ElInputTag,
  ElMention,
  ElColorPicker,
  ElRate,
```

保留所有既有 import，排序与组件类型分组保持一致。

- [ ] **Step 3: 注册 props 类型**

在 props 提取区加入：

```ts
type ElInputTagProps = ComponentProps<typeof ElInputTag>
type ElMentionProps = ComponentProps<typeof ElMention>
type ElColorPickerProps = ComponentProps<typeof ElColorPicker>
type ElRateProps = ComponentProps<typeof ElRate>
```

在 `ComponentPropsRegistry` 中加入：

```ts
  InputPassword: ElInputProps
  InputTextArea: ElInputProps
  InputTag: ElInputTagProps
  ColorPicker: ElColorPickerProps
  Mention: ElMentionProps
  Rate: ElRateProps
```

位置：两个 Input 模式别名紧跟 `Input`，`InputTag` 放在输入组件区域，ColorPicker/Mention/Rate 放在各自名称附近。不要另建并行的 `ComponentName` 联合类型。

- [ ] **Step 4: 运行全量类型检查确认 GREEN**

运行：

```bash
pnpm type-check:full
```

预期：退出码 `0`；无新增 TS 错误。

---

### Task 3: 增加链式 builder

**Files:**
- Modify: `src/components/form-schema/builders.spec.ts:1-14`
- Modify: `src/components/form-schema/builders.ts:211-230`
- Modify: `src/components/form-schema/builders.ts:485-506`
- Modify: `src/components/form-schema/index.ts:19`

- [ ] **Step 1: 写入 builder RED 测试**

在 `builders.spec.ts` import 中加入：

```ts
  xColorPicker,
  xInputPassword,
  xInputTag,
  xInputTextArea,
  xMention,
  xRate,
```

增加以下测试：

```ts
describe('扩展内置组件 builder', () => {
  it('返回正确的快捷名并支持通用 props 链式调用', () => {
    expect(xInputPassword('password').label('密码').prop('clearable', true).build()).toMatchObject({
      name: 'password',
      component: 'InputPassword',
      props: { clearable: true },
    })
    expect(
      xInputTextArea('remark').label('备注').prop('autosize', { minRows: 2, maxRows: 6 }).build()
    ).toMatchObject({
      name: 'remark',
      component: 'InputTextArea',
      props: { autosize: { minRows: 2, maxRows: 6 } },
    })
    expect(xInputTag('skills').prop('max', 5).build()).toMatchObject({
      name: 'skills',
      component: 'InputTag',
      props: { max: 5 },
    })
    expect(xColorPicker('theme').prop('showAlpha', true).build()).toMatchObject({
      name: 'theme',
      component: 'ColorPicker',
      props: { showAlpha: true },
    })
    expect(xMention('owner').prop('options', [{ value: 'alice', label: 'Alice' }]).build()).toMatchObject({
      name: 'owner',
      component: 'Mention',
      props: { options: [{ value: 'alice', label: 'Alice' }] },
    })
    expect(xRate('score').prop('allowHalf', true).build()).toMatchObject({
      name: 'score',
      component: 'Rate',
      props: { allowHalf: true },
    })
  })
})
```

运行：

```bash
pnpm test src/components/form-schema/builders.spec.ts
```

预期：FAIL；6 个导出不存在。

- [ ] **Step 2: 增加基础 builder 类型和工厂**

在 `builders.ts` 基础 builder 区域加入：

```ts
const InputPasswordBuilder = makeBuilder('InputPassword')
const InputTextAreaBuilder = makeBuilder('InputTextArea')
const InputTagBuilder = makeBuilder('InputTag')
const ColorPickerBuilder = makeBuilder('ColorPicker')
const MentionBuilder = makeBuilder('Mention')
const RateBuilder = makeBuilder('Rate')
```

将“19 个 component 类型”注释更新为“25 个 component 类型”。不在 builder 内部硬编码默认 props；密码和文本域默认值统一由 `DEFAULT_COMPONENT_PROPS` 注入，避免两个配置源漂移。

- [ ] **Step 3: 导出 builder 工厂**

在 `builders.ts` 公开出口加入：

```ts
export const xInputPassword = (name: string) => new InputPasswordBuilder(name)
export const xInputTextArea = (name: string) => new InputTextAreaBuilder(name)
export const xInputTag = (name: string) => new InputTagBuilder(name)
export const xColorPicker = (name: string) => new ColorPickerBuilder(name)
export const xMention = (name: string) => new MentionBuilder(name)
export const xRate = (name: string) => new RateBuilder(name)
```

保留现有 `xTextarea`，其 `Input` + `type: 'textarea'` 兼容路径不变。

- [ ] **Step 4: 同步公开 builder 数量说明**

在 `index.ts` 中将：

```ts
// 链式构建器全集（21 个工厂函数：xInput / xSelect / ... / xCard / xArray）
```

改为：

```ts
// 链式构建器全集（27 个工厂函数：xInput / xSelect / ... / xRate / xArray）
```

- [ ] **Step 5: 运行 builder 测试和类型检查**

运行：

```bash
pnpm test src/components/form-schema/builders.spec.ts
pnpm type-check:full
```

预期：builder 测试全部 PASS，类型检查退出码 `0`。

---

### Task 4: 注册真实 Element Plus 运行时组件

**Files:**
- Modify: `src/components/form-schema/composables/render-schema-node.spec.ts:1-4`
- Modify: `src/components/form-schema/composables/render-schema-node.ts:12-75`

- [ ] **Step 1: 写入运行时解析和 v-model RED 测试**

在 `render-schema-node.spec.ts` 增加 `element-plus` import：

```ts
import {
  ElInput,
  ElInputTag,
  ElMention,
  ElColorPicker,
  ElRate,
} from 'element-plus'
```

增加：

```ts
describe('resolveComponentFor 扩展内置表单组件', () => {
  it.each([
    ['InputPassword', ElInput],
    ['ElInputPassword', ElInput],
    ['InputTextArea', ElInput],
    ['ElInputTextArea', ElInput],
    ['InputTag', ElInputTag],
    ['ElInputTag', ElInputTag],
    ['ColorPicker', ElColorPicker],
    ['ElColorPicker', ElColorPicker],
    ['Mention', ElMention],
    ['ElMention', ElMention],
    ['Rate', ElRate],
    ['ElRate', ElRate],
  ] as Array<[string, unknown]>)('%s 解析为预期组件', (name, expected) => {
    const { opts } = makeOpts({ model: { field: undefined } })
    const render = useRenderSchemaNode(opts)
    const result = render({ component: name, name: 'field' } as SchemaNode)
    expect((result as VNode).type).toBe(expected)
  })

  it('为六类值形态写入 model', () => {
    const cases: Array<[string, unknown]> = [
      ['InputPassword', 'secret'],
      ['InputTextArea', 'line 1'],
      ['InputTag', ['Vue', 'Element Plus']],
      ['ColorPicker', null],
      ['Mention', '@alice'],
      ['Rate', 4],
    ]

    for (const [name, value] of cases) {
      const model: Record<string, unknown> = {}
      const { opts } = makeOpts({ model })
      const render = useRenderSchemaNode(opts)
      const result = render({ component: name, name: 'field' } as SchemaNode)
      const props = (result as VNode).props as Record<string, unknown>
      const updateModelValue = props['onUpdate:modelValue']
      expect(updateModelValue).toBeTypeOf('function')
      ;(updateModelValue as (nextValue: unknown) => void)(value)
      expect(model.field).toEqual(value)
    }
  })

  it('InputPassword 节点 props 可覆盖密码默认类型', () => {
    const { opts } = makeOpts({ model: {} })
    const render = useRenderSchemaNode(opts)
    const result = render({
      component: 'InputPassword',
      name: 'password',
      props: { type: 'text' },
    } as SchemaNode)
    const props = (result as VNode).props as Record<string, unknown>
    expect(props.type).toBe('text')
  })
})
```

运行：

```bash
pnpm test src/components/form-schema/composables/render-schema-node.spec.ts
```

预期：FAIL；新 `EL_COMPONENT_MAP` 条目缺失时，结果为 `undefined` 或不包含预期 VNode。

- [ ] **Step 2: 引入真实组件**

在 `render-schema-node.ts` 的 Element Plus import 中加入：

```ts
  ElInputTag,
  ElMention,
  ElColorPicker,
  ElRate,
```

- [ ] **Step 3: 扩展直接组件映射**

在 `EL_COMPONENT_MAP` 中加入：

```ts
  InputPassword: ElInput,
  ElInputPassword: ElInput,
  InputTextArea: ElInput,
  ElInputTextArea: ElInput,
  InputTag: ElInputTag,
  ColorPicker: ElColorPicker,
  Mention: ElMention,
  Rate: ElRate,
```

`ElInputPassword` 与 `ElInputTextArea` 通过直接 alias 条目返回同一个 `ElInput` 组件对象，不创建任何新 wrapper，也不依赖大小写不稳定的通用 `ElXxx → PascalCase` 推断。

- [ ] **Step 4: 运行渲染测试确认 GREEN**

运行：

```bash
pnpm test src/components/form-schema/composables/render-schema-node.spec.ts
```

预期：新增 `it.each` 12 个名称映射、值形态循环、节点覆盖测试全部 PASS；既有数组、自定义组件、disabled、crossValidator 和响应式测试无回归失败。

---

### Task 5: 增加 XForm 集成层回归

**Files:**
- Modify: `src/components/form-schema/XForm.spec.ts:18-41`
- Modify: `src/components/form-schema/XForm.spec.ts:148-174`

- [ ] **Step 1: 扩展 Input stub 和新增 InputNumber stub**

将 `InputStub` 替换为：

```ts
const InputStub = {
  name: 'ElInput',
  props: ['modelValue', 'type', 'showPassword', 'clearable'],
  emits: ['update:modelValue'],
  template:
    '<input class="el-input-stub" :value="modelValue" :data-type="type" :data-show-password="showPassword" :data-clearable="clearable" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const InputNumberStub = {
  name: 'ElInputNumber',
  props: ['modelValue', 'controlsPosition', 'min'],
  emits: ['update:modelValue'],
  template:
    '<input class="el-input-number-stub" :value="modelValue" :data-controls-position="controlsPosition" :data-min="min" />',
}
```

在 `mountXForm` 的 `global.components` 中加入：

```ts
        ElInputNumber: InputNumberStub,
```

- [ ] **Step 2: 写集成层 RED 测试**

在现有默认 props 测试后增加：

```ts
  it('内置别名默认 props 与 InputNumber 默认 props 可在 XForm 中生效', () => {
    const wrapper = mountXForm({
      schema: [
        { component: 'InputPassword', name: 'password' },
        { component: 'InputTextArea', name: 'remark' },
        { component: 'InputNumber', name: 'qty' },
        { component: 'InputNumber', name: 'price', props: { min: 0 } },
      ] as unknown as SchemaNode[],
      components: { ElInput: InputStub, ElInputNumber: InputNumberStub },
    } as never)

    const inputs = wrapper.findAllComponents(InputStub)
    const numbers = wrapper.findAllComponents(InputNumberStub)
    expect(inputs).toHaveLength(2)
    expect(numbers).toHaveLength(2)
    expect(inputs[0]!.props('type')).toBe('password')
    expect(inputs[0]!.props('showPassword')).toBe(true)
    expect(inputs[1]!.props('type')).toBe('textarea')
    expect(numbers[0]!.props('controlsPosition')).toBe('right')
    expect(numbers[0]!.props('min')).toBeUndefined()
    expect(numbers[1]!.props('controlsPosition')).toBe('right')
    expect(numbers[1]!.props('min')).toBe(0)
  })
```

运行：

```bash
pnpm test src/components/form-schema/XForm.spec.ts
```

预期：实现 Task 1-4 后该测试 PASS；当前基线会因新组件映射或默认 props 缺失而 FAIL。Task 5 不修改 `XForm.vue`。

---

### Task 6: 同步文档与变更记录

**Files:**
- Modify: `src/components/form-schema/README.md:120-180`
- Modify: `docs/24-XForm使用指南.md:163-170`
- Modify: `docs/24-XForm使用指南.md:472-509`
- Modify: `CHANGELOG.md:22-23`

- [ ] **Step 1: 更新组件 README 的 builder 示例**

在 `README.md` 的 builder import 中加入：

```ts
  xColorPicker,
  xInputPassword,
  xInputTag,
  xInputTextArea,
  xMention,
  xRate,
```

在示例 children 中加入：

```ts
    xInputPassword('password').label('密码').placeholder('请输入密码').build(),
    xInputTextArea('remark').label('备注').prop('rows', 4).build(),
    xInputTag('skills').label('技能').prop('max', 5).build(),
    xColorPicker('theme').label('主题色').build(),
    xMention('owner').label('负责人').build(),
    xRate('score').label('评分').build(),
```

- [ ] **Step 2: 更新默认配置说明**

将“支持的 component 名（20 个内置 + ArrayNode 占位）”更新为：

```md
支持的 component 名（26 个内置 + ArrayNode 占位）：`Input | Select | Option | Switch | DatePicker | TimePicker | TimeSelect | TreeSelect | Upload | Autocomplete | Transfer | RadioGroup | Radio | CheckboxGroup | Checkbox | Cascader | InputNumber | InputPassword | InputTextArea | InputTag | ColorPicker | Mention | Rate | Slider | Card | FormItem`
```

在类型推导章节前加入以下默认表：

```md
| 快捷名 | 默认 props | 说明 |
|---|---|---|
| `Input` | `{ clearable: true }` | 普通输入 |
| `InputNumber` | `{ controlsPosition: 'right' }` | 不限制最小值 |
| `InputPassword` | `{ type: 'password', showPassword: true }` | 初始隐藏并允许切换 |
| `InputTextArea` | `{ type: 'textarea' }` | 多行输入 |
| `InputTag` | `{ clearable: true }` | `modelValue` 为 `string[]` |
| `ColorPicker` | 无 | 颜色和格式由节点配置 |
| `Mention` | 无 | options 和 prefix 由节点配置 |
| `Rate` | 无 | 星级、是否半星由节点配置 |
```

- [ ] **Step 3: 更新完整使用指南**

将组件解析列表更新为 29 个内置快捷名：

```md
`Input / Select / Option / Switch / DatePicker / TimePicker / TimeSelect / Upload / Transfer / TreeSelect / Autocomplete / Button / Icon / RadioGroup / Radio / CheckboxGroup / Checkbox / Cascader / InputNumber / InputPassword / InputTextArea / InputTag / ColorPicker / Mention / Rate / Slider / Card / FormItem / Form`
```

在 builder 表中将“22 个 builder”更新为“28 个 builder”，新增以下行：

```md
| `xInputPassword` | — |
| `xInputTextArea` | — |
| `xInputTag` | — |
| `xColorPicker` | — |
| `xMention` | — |
| `xRate` | — |
```

保留 `xTextarea`，说明它是 `Input` 的 `type: 'textarea'` 兼容 builder。

将“内置 22 个组件名均支持推导”更新为“内置 28 个组件名均支持推导”，原因是有类型注册表的组件增加 6 个；运行时短名仍为 29 个。

- [ ] **Step 4: 写入 CHANGELOG 功能条目**

在 `## 未发布` 的 `### ✨ Features | 新特性` 首位加入：

```md
* **form-schema:** 扩展常用输入组件与默认配置
  - 新增 `InputPassword`（`ElInput` 语义别名，默认隐藏并可切换）、`InputTextArea`（`ElInput` 语义别名）、`InputTag`、`ColorPicker`、`Mention`、`Rate` 六个内置组件及对应 `xXxx` builder
  - 同步补齐 `Element Plus` 组件导入、快捷名/全名解析、`SchemaNodeFor` 类型推导、props 覆盖与 v-model 写回测试
  - `InputNumber` 纳入内置默认配置，右侧控制器但**不**强制 `min: 0`；ColorPicker/Mention/Rate 不增加业务偏好默认值
  - 回归验证：密码、文本域、标签数组、颜色 `string|null`、提及文本、评分数字均通过 adapter、renderer、XForm 与类型测试
```

- [ ] **Step 5: 检查文档格式**

运行：

```bash
pnpm format:check
pnpm exec prettier --check docs/24-XForm使用指南.md src/components/form-schema/README.md CHANGELOG.md
```

预期：两个命令退出码均为 `0`；若 Prettier 提示文件，仅格式化本任务明确修改的 3 个文档文件。

---

### Task 7: 全量回归、独立审查与完成前验证

**Files:**
- Verify: 所有 Task 1-6 涉及文件
- Preserve: `docs/superpowers/specs/2026-08-28-form-schema-default-components-design.md`
- Preserve: `src/modules/demo/examples/XFormEvents.vue`

- [ ] **Step 1: 运行全部单元测试**

```bash
pnpm test
```

预期：全部测试文件 PASS，退出码 `0`。

- [ ] **Step 2: 运行覆盖率**

```bash
pnpm test:coverage
```

预期：退出码 `0`；项目既有整体覆盖率不得因本次修改下降，相关 form-schema 覆盖保持或提升。

- [ ] **Step 3: 运行类型、Lint 与生产构建**

```bash
pnpm type-check:full
pnpm lint
pnpm build
```

预期：三个命令退出码均为 `0`；无新增 TS、ESLint、SCSS 或构建错误。

- [ ] **Step 4: 执行独立 TypeScript 专项审查**

派发 `typescript-reviewer`，输入范围必须包含以下已批准文件及设计意图：

```text
审查需求：form-schema 新增 InputPassword/InputTextArea/InputTag/ColorPicker/Mention/Rate，检查 Element Plus 类型提取、DEFAULT_COMPONENT_MAP/PROPS 展开、EL_COMPONENT_MAP 名称归一化、builder 类型和 props 优先级。只报告可复现或高置信度问题。
目标文件：
- src/components/form-schema/element-plus-adapter.ts
- src/components/form-schema/composables/render-schema-node.ts
- src/components/form-schema/types.ts
- src/components/form-schema/builders.ts
- src/components/form-schema/index.ts
- 对应 5 个测试文件
- src/components/form-schema/README.md
- docs/24-XForm使用指南.md
- CHANGELOG.md
保护项：不得要求提交；不得修改 src/modules/demo/examples/XFormEvents.vue。
```

若有 CRITICAL/HIGH 发现，先修复并重跑受影响测试与全量验证；不要与通用 code-reviewer 对同一代码重复派发。

- [ ] **Step 5: 使用真实页面验证关键 UI 流程**

调用 `/browse`，至少执行：

1. 打开 XForm 基础示例。
2. 输入 `InputPassword` 节点，确认默认密码类型和可见性切换。
3. 输入 `InputTextArea` 节点，确认文本域渲染。
4. 输入 `InputTag` 节点，确认标签新增、删除和数组同步。
5. 输入 `ColorPicker` 节点，确认颜色和 `null`/字符串同步。
6. 输入 `Mention` 节点，确认 options 下拉和文本同步。
7. 输入 `Rate` 节点，确认 0～5 的 number 值同步。
8. 给 `InputPassword` 写 `props.type: 'text'`，确认节点级覆盖默认。
9. 给 `InputNumber` 写 `props.min: 0`，确认默认 `controlsPosition` 保留且用户 min 不被覆盖。
10. 回归 Input、Select、DatePicker、Switch 的现有行为。

- [ ] **Step 6: 检查最终差异无意外变更**

运行：

```bash
git diff HEAD --check
git diff HEAD --stat
git status --short
```

检查清单：

- 无空白错误。
- 差异只包含设计文档、Task 1-6 明确文件和既有 `XFormEvents.vue` 的 `showWordLimit` 改动。
- 没有新 `src/` 文件、目录移动、依赖或构建配置变更。
- 没有 `any` 新增；第三方声明自身包含的 `any` 不算本次新增。
- 没有调试日志、空 `catch` 或 `@ts-ignore/@ts-expect-error`。
- 没有提交操作。

- [ ] **Step 7: 完成 15+2 项强制自检**

逐项确认：

1. 需求已与批准的组件名、默认值和映射语义对齐。
2. 所有 Edit 只改最小必要代码块。
3. 所有 import 为项目内可解析路径；未新增依赖，Element Plus API 已用安装包声明核对。
4. 无超过 80 行的新增函数；未新增新函数。
5. 未使用 `any`。
6. 现有相关文件未因本次修改触发行数上限。
7. 未新增 composable。
8. 无新增 suppression。
9. 本任务无异步数据组件新增，未引入三态要求。
10. 新增代码无错误处理或异常路径变更。
11. 变更可能超过 50 行时，编码前已在执行消息中给 ≤3 行摘要。
12. `CHANGELOG.md` 已更新。
13. 六个组件和 `InputNumber` 默认场景通过测试。
14. 现有 XForm 渲染、v-model、事件、校验和 `Input/InputNumber` 回归通过。
15. `git diff HEAD` 无意外变更。
16. 场景模拟覆盖六个组件和现有用户覆盖路径，心智负担未增加：schema 仍只写字符串 component，特殊值仅由默认 props 注入。
17. 最终简报包含手动验证步骤。

---

## 2. 实施顺序总结

1. 取得本计划第 0 节的 `src/` 修改申请批准。
2. 选择 Subagent-Driven 或 Inline Execution。
3. 按 Task 1 → 6 顺序执行，每个任务严格执行 RED → GREEN。
4. Task 7 完成前验证、独立审查、真实页面检查和最终差异检查。
5. 不执行 commit，除非用户另行明确授权。
