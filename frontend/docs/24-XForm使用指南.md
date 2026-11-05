# 24-XForm 使用指南

> 基于 schema DSL 的动态表单引擎（源码位于 `packages/ui/src/components/form-schema/`，组件名 `<XForm>`）。
> 本文档依据当前代码逐项核对编写，权威性高于组件内 README 与任何旧文档。

> **TL;DR**：用 JS 对象描述表单结构（schema），`<XForm :schema="schema" :model="form" />` 一行渲染。核心能力：schema 动态渲染、跨字段校验、reaction 联动（防抖/节流）、数组节点、异步选项、字段权限、服务端错误映射、脏状态追踪、草稿持久化、链式构建器与完整 TS 类型推导。适合：动态 schema（后端下发）、复杂联动（>3 字段）、跨表单复用校验。不适合：< 5 字段的极简固定表单、> 100 字段的性能敏感场景（用 element-plus 原生）。

---

## 1. 快速上手

### 1.1 注册

```ts
// 方式一：Vue 插件（推荐）—— app.use 注册全局 <XForm> 组件
import FormSchema from '@vv/ui/components/form-schema'
app.use(FormSchema)

// 方式二：局部 import（常规场景不必——unplugin 已自动注册，模板直接用 <XForm>）
import XForm from '@vv/ui/components/form-schema/components/XForm.vue'
```

> 入口 `index.ts` 的具名导出：`validate` / `validateWithZod`（schema 静态校验）、`useFormPersist`（草稿持久化）、`resolveFunctionExpression` / `resolveElComponentName`（高级工具）、全部类型。

### 1.2 最小示例

```vue
<template>
  <XForm :schema="schema" :model="form" />
</template>

<script setup lang="ts">
const form = reactive({ email: '' })

const schema = {
  component: 'Input',
  name: 'email',
  label: '邮箱',
  defaultValue: 'a@b.com', // model 中该字段未定义时自动填充
  rules: [{ required: true, type: 'email', message: '请输入有效邮箱' }],
}
</script>
```

> **`model` 必须用 `reactive()` 包装**——校验、默认值填充、reaction、dirty 追踪都依赖响应式。未传 `model` 时 dev 模式会 console.warn。

### 1.3 schema 的三种顶层形态

| 形态   | 示例                                                  | 说明                                                   |
| ------ | ----------------------------------------------------- | ------------------------------------------------------ |
| 单节点 | `{ component: 'Input', name: 'email' }`               | 只渲染一个字段                                         |
| 数组   | `[nodeA, nodeB]`                                      | 顺序渲染多个字段                                       |
| 容器   | `{ column: 2, row: { gutter: 24 }, children: [...] }` | 带栅格布局；`labelPosition` 也只在此形态生效（见 §15） |

---

## 2. Props（18 个）

| Prop                    | 类型                                                              | 必填 | 说明                                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`                | `SchemaNode \| SchemaNode[]`                                      | ✅   | 表单 schema（§4 全 35 字段）                                                                                                                                                                                                                                                             |
| `model`                 | `Record<string, unknown>`                                         |      | 响应式数据对象，**必须 `reactive()` 包装**                                                                                                                                                                                                                                               |
| `components`            | `Record<string, unknown>`                                         |      | 自定义组件映射：`component: 'MyComp'` 时从这里查找                                                                                                                                                                                                                                       |
| `rules`                 | `Record<string, RuleItem>`                                        |      | 命名规则引用：节点 `rules: 'myRule'` 字符串指向这里                                                                                                                                                                                                                                      |
| `directives`            | `Record<string, Directive>`                                       |      | 自定义指令映射（节点 `directives` 中引用）                                                                                                                                                                                                                                               |
| `t`                     | `XFormTranslateFn`                                                |      | i18n 翻译函数注入：label 函数式 `(t) => t('form.email')` 渲染期以它求值。XForm 不绑定 i18n 库（vue-i18n 的 t / 字典闭包均可）；未注入时函数式 label 收 identity（key 原样返回）。t 在 render effect 内求值，vue-i18n 场景语言切换自动重渲（demo：XFormI18n）                             |
| `beforeChange`          | `(itemSchema, newValue, oldValue) => unknown \| Promise<unknown>` |      | 字段写入前拦截。**同步返回非 `undefined` → 用返回值替换写入；返回 Promise → resolve 后写入；reject 或返回 `undefined` → 放行原值**                                                                                                                                                       |
| `beforeChangeRules`     | `BeforeChangeRule[]`                                              |      | 动态命名空间拦截（第 2 层：按 pattern 匹配字段路径），数组内多规则按顺序串行执行；数组节点（`items[i].phone`）字段级配置繁琐时用规则数组简化                                                                                                                                             |
| `zodSchema`             | `ZodType`                                                         |      | Zod 校验模式，配合 `validateWithZod()`（§5.3）                                                                                                                                                                                                                                           |
| `componentProps`        | `Record<string, Record<string, unknown>>`                         |      | 按组件名注入默认 props（键支持短名 `'Input'` 和全名 `'ElInput'`）。与内置默认合并，用户配置覆盖内置；**节点级 `props` 优先级最高**                                                                                                                                                       |
| `expressionFunctions`   | `Record<string, (...args: never[]) => unknown>`                   |      | 白名单函数表：注册后 `{{ }}` 表达式可直接引用注册名。**实例级沙箱**（H2 起每实例 `createExpressionScope()` 独立注册表，多实例间隔离；模块级 API 已标记 `@deprecated`）                                                                                                                   |
| `scrollToError`         | `boolean`                                                         |      | 校验失败自动滚动到第一个错误字段。字段规则失败走 ElForm 原生（第一个 `.el-form-item.is-error`）；跨字段失败由 XForm 内部滚动到第一个错误字段。**schema 优先、props 兜底**（默认 false）                                                                                                  |
| `scrollIntoViewOptions` | `ScrollIntoViewOptions \| boolean`                                |      | 滚动行为选项（默认 true），如 `{ behavior: 'smooth', block: 'center' }`。**schema 优先、props 兜底**                                                                                                                                                                                     |
| `permissionResolver`    | `(perm: string) => 'view' \| 'edit' \| 'hidden'`                  |      | 权限码 → 字段状态映射：节点 `permission` 为权限码字面量（如 `'user.edit'`）时调用；默认 identity（字面量直接当作状态），返回值非三态时降级为 `'edit'`                                                                                                                                    |
| `showErrorToast`        | `boolean`                                                         |      | 开启错误浮窗 OSD（XFormErrorToast 展示 errorBus 事件）。**全环境默认 false**（防连续输入校验失败的弹窗噪音），与 DebugBanner 相互独立。行为：标题展示 `userMessage ?? message`（F3 用户语义分层，code/source 仅 dev 显示）；7s 自动消失；超 3 条聚合为「还有 N 条」卡片 + 一键全关（F4） |
| `reactionBudget`        | `number`                                                          |      | 单批次 reaction 执行预算（默认 50）：reaction 副作用构成环会无限刷入调度队列卡死页面，预算耗尽后本批次跳过 + console.error 报错                                                                                                                                                          |
| `size`                  | `'large' \| 'default' \| 'small'`                                 |      | 表单密度尺寸（设计师审查 F9）：透传 ElConfigProvider.size，覆盖内部写死的 'default'。中后台"紧凑表格页内嵌紧凑筛选表单"场景一处传入即可                                                                                                                                                  |
| `showDirtyMark`         | `boolean`                                                         |      | 字段级 dirty 视觉指示（设计师审查 F13，默认 false）：开启后被修改字段的 form-item label 追加 `is-dirty` class + 橙色圆点（`--el-color-warning`），给用户"我改了哪里"的视觉线索。数据侧 getDirtyFields 已就绪                                                                             |

> **18 个 prop 中只有 `schema` 必填**。`scrollToError` / `scrollIntoViewOptions` 是「schema 优先、props 兜底」双入口：schema 顶层字段显式声明（含显式 `false`）时以 schema 为准，未声明时读 props。

**内置默认 props**：下表列出 XForm 的安全默认值；节点级 `props` 优先级最高，也可通过 XForm 的 `componentProps` 按组件名覆盖内置默认。

---

### Slots（2 个）

XForm 暴露 2 个具名插槽（v3.5 起完整披露；`toastContainer` 为关键可扩展点）：

| Slot                 | Scope                          | 用途                                                                                                                                                                                  |
| -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `footer`             | —                              | 自定义整个表单底部（替换默认的「重置/提交」按钮区域）；典型场景：再加一个「保存草稿」按钮                                                                                             |
| **`toastContainer`** | **`{ events: ToastEvent[] }`** | **自定义错误提示容器**：替换默认的 XFormErrorToast（带堆叠、合并、自动消失）；scope 传入当前待显示的 `events` 数组，业务可接管渲染层。**v3.5 OPT-7 优化点（2026-09-15 review 落地）** |

**示例：替换默认错误提示容器**

```vue
<XForm :schema="schema" :model="model">
  <template #toastContainer="{ events }">
    <MyCustomToast :events="events" @dismiss="..." />
  </template>
</XForm>
```

**典型场景**：

- 替换为公司统一的 notification 系统
- 国际化由业务方控制（默认 toast 文案硬编码中文）
- 加声音提醒 / 持久化到 localStorage

**ToastEvent 类型**：

```ts
interface ToastEvent {
  key: string // 字段路径（如 'address.city / address'）
  message: string // 错误消息
  type: 'error' | 'warning' | 'info'
  trigger: 'blur' | 'change' | 'submit' | 'manual'
  createdAt: number // 时间戳
  // ... 详见 packages/ui/src/components/form-schema/composables/use-form-error-bus.ts
}
```

---

## 3. 实例方法（19 个）

通过 `ref` 获取：`const formRef = ref<XFormExpose>()` → `<XForm ref="formRef" ...>`。

### 3.1 校验

| 方法                  | 签名                                             | 说明                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `validate()`          | `() => Promise<boolean>`                         | **短路逻辑**：先跑 el-form 字段内规则，失败 → 直接 `false` 不跑跨字段；成功 → 跑全部跨字段 crossValidator（**异步会 await**），失败自动写红字                                        |
| `validateDetail()`    | `() => Promise<ValidateResult>`                  | 只跑跨字段校验，返回 `{ isValid, errors: [{ keyPath, message }] }`，不写 UI                                                                                                          |
| `validateWithZod()`   | `() => { success, errors: ZodError \| null }`    | Zod 校验（需传 `zodSchema` prop；未传恒返回 success=true）                                                                                                                           |
| `validateField(name)` | `(name: string \| string[]) => Promise<boolean>` | 校验指定字段（透传 el-form `validateField`）。**失败时与 `validate()` 对齐**：触发 `EL_FORM_VALIDATION_FAILED` OSD toast + `console.error('[XForm] validateField failed:', details)` |
| `clearValidate()`     | `(names?: string[]) => void`                     | 清除校验状态（含外部字段错误）；传字段名数组只清指定字段                                                                                                                             |
| `resetFields()`       | `() => void`                                     | 重置为初始值（同时清空外部字段错误）                                                                                                                                                 |
| `scrollToField(name)` | `(name: string) => void`                         | 滚动到指定字段                                                                                                                                                                       |

### 3.2 字段错误（服务端错误场景）

| 方法                                   | 签名                                                                                          | 说明                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setFieldError(name, message, state?)` | `(name: string, message: string, state?: '' \| 'validating' \| 'success' \| 'error') => void` | 手动写入/清除某字段错误（默认 `'error'`；message 为空则清除）。**用户重新输入该字段会自动清除**                                                                         |
| `setFieldValidating(name)`             | `(name: string) => void`                                                                      | 标记字段为校验中（form-item 显示 loading 图标）                                                                                                                         |
| `validateFromServer(response)`         | `(r: { success?, errors? }) => number`                                                        | 服务端响应映射：`success=true` 清空所有红字；`errors` 为 `Array<{ path? \| field?, message }>` 或 `Record<string, string \| string[]>` 时写入对应字段。返回写入的错误数 |

```ts
// 典型提交流程
const ok = await formRef.value?.validate()
if (!ok) return
const res = await api.createOrder(form)
formRef.value?.validateFromServer(res) // res.success=false 时红字自动落到对应字段
if (res.success) formRef.value?.resetDirty()
```

### 3.3 数组节点操作

| 方法                       | 签名                                                     | 说明             |
| -------------------------- | -------------------------------------------------------- | ---------------- |
| `addItem(name, init?)`     | `(name: string, init?: Record<string, unknown>) => void` | 数组末尾追加一项 |
| `removeItem(name, index)`  | `(name: string, index: number) => void`                  | 删除指定行       |
| `moveItem(name, from, to)` | `(name: string, from: number, to: number) => void`       | 行位置调整       |

### 3.4 脏状态追踪

| 方法               | 签名                        | 说明                                              |
| ------------------ | --------------------------- | ------------------------------------------------- |
| `isDirty()`        | `() => boolean`             | 任一字段与初始快照不同                            |
| `getDirtyFields()` | `() => string[]`            | 所有被修改字段的路径列表                          |
| `isTouched(name)`  | `(name: string) => boolean` | 指定字段是否被修改过                              |
| `resetDirty()`     | `() => void`                | 把当前状态拍为新基线（提交后归零 / 加载后初始化） |

> XForm 挂载后立即拍一次基线——加载接口数据请在拍基线**之后**赋值，否则加载即 dirty。

### 3.5 查询

| 方法                        | 签名                                                              | 说明                                 |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| `getRef(key)`               | `(key: string) => ComponentPublicInstance \| HTMLElement \| null` | 从 el-form 实例 map 取组件实例/元素  |
| `getNames(includesIgnore?)` | `(includesIgnore?: boolean) => string[]`                          | 全部字段名（默认不含 `ignore` 节点） |

---

## 4. SchemaNode 字段参考

| 分类     | 字段                    | 类型                                              | 说明                                                                                                                                                                                                                                                                        |
| -------- | ----------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 组件标识 | `component`             | `string \| object`                                | 短名 `'Input'` / 全名 `'ElInput'`（见 §4.1 解析规则）/ 直接传 Vue 组件对象（无需注册）                                                                                                                                                                                      |
| 结构     | `name`                  | `string`                                          | 字段名，**支持 lodash 路径**（如 `items[0].qty`），与 model 双向绑定                                                                                                                                                                                                        |
| 结构     | `children`              | `SchemaNode \| SchemaNode[] \| string`            | 子节点（递归渲染）；字符串直接输出文本                                                                                                                                                                                                                                      |
| 结构     | `slots`                 | `Record<string, SchemaSlot>`                      | 具名插槽：schema 节点 / 节点数组 / 字符串 / 渲染函数 `(scope?) => VNode`                                                                                                                                                                                                    |
| 结构     | `formItem`              | `boolean \| FormItemConfig`                       | 是否包 el-form-item；`false` 跳过包装（无 label/校验）；对象可配 `component/props/directives/slots/rules`                                                                                                                                                                   |
| 结构     | `kind` / `array`        | `'array'` / `ArrayNodeConfig`                     | 数组容器节点（§8）                                                                                                                                                                                                                                                          |
| UI       | `label`                 | `string`                                          | 标签文字                                                                                                                                                                                                                                                                    |
| UI       | `col`                   | `boolean \| ColConfig`                            | 栅格列：`{ span, offset, push, pull, responsive }`                                                                                                                                                                                                                          |
| UI       | `row`                   | `RowConfig`                                       | 栅格行：`{ gutter, type, align, justify, responsive }`（见 §15）                                                                                                                                                                                                            |
| UI       | `column`                | `number`                                          | 每行栅格数（顶层 schema 生效，自动平均分配 span）                                                                                                                                                                                                                           |
| 校验     | `rules`                 | `string \| RuleItem \| Array<string \| RuleItem>` | 校验规则（§5.1）；字符串为 `props.rules` 命名引用                                                                                                                                                                                                                           |
| 校验     | `disabled`              | `ReactionValue<boolean>`                          | 禁用（支持布尔/函数/表达式）。`props.disabled` 显式写优先；数组节点仅控制容器按钮；el-form 自动跳过 disabled 字段校验                                                                                                                                                       |
| 渲染     | `props`                 | `Record<string, unknown>`                         | 组件 props（覆盖 `componentProps` 与内置默认）                                                                                                                                                                                                                              |
| 渲染     | `on`                    | `Record<string, EventFn \| FunctionExpression>`   | 事件回调；字符串为 `{{ (m, ...args) => ... }}` 函数表达式                                                                                                                                                                                                                   |
| 渲染     | `defaultValue`          | `unknown`                                         | 初值——仅当 model 该路径为 `undefined` 时通过 lodash `set` 填充                                                                                                                                                                                                              |
| 渲染     | `modelProp`             | `string`                                          | 自定义 v-model 属性名（默认 `modelValue`）                                                                                                                                                                                                                                  |
| 渲染     | `directives`            | `DirectiveConfig[]`                               | 自定义指令：`{ directive: 'pin', arg, modifiers, value }`                                                                                                                                                                                                                   |
| 渲染     | `asyncOptions`          | `AsyncOptionsConfig`                              | 异步选项数据源（§9）                                                                                                                                                                                                                                                        |
| 状态     | `hidden`                | `boolean`                                         | 隐藏但**仍渲染**（`display:none`，保留校验）                                                                                                                                                                                                                                |
| 状态     | `ignore`                | `boolean`                                         | 跳过渲染（DOM 不出现）                                                                                                                                                                                                                                                      |
| 状态     | `key`                   | `string \| number`                                | 唯一标识                                                                                                                                                                                                                                                                    |
| 状态     | `permission`            | `ReactionValue<'view' \| 'edit' \| 'hidden'>`     | 字段权限（§10）。`'hidden'` 与 `hidden` 字段不同：**不渲染**                                                                                                                                                                                                                |
| 状态     | `reaction`              | `ReactionConfig`                                  | 响应式联动（§6）                                                                                                                                                                                                                                                            |
| 状态     | `readonly`              | `ReactionValue<boolean>`                          | **仅顶层 schema 生效**：`true` 时所有字段按 view 态纯文本展示（复用 `permission: 'view'` 渲染）；支持字面量/函数/表达式/reaction。字段级只读请用 `permission: 'view'`                                                                                                       |
| 布局     | `labelPosition`         | `'left' \| 'right' \| 'top'`                      | **仅顶层容器 schema 生效**（el-form 实例级属性，element-plus 自身限制）。默认 `'left'`                                                                                                                                                                                      |
| 布局     | `labelWidth`            | `string \| number`                                | **仅顶层 schema 生效**：如 `'120px'` 或 `120`。数组形式 schema 无顶层节点，配置不生效                                                                                                                                                                                       |
| 校验     | `scrollToError`         | `boolean`                                         | **仅顶层 schema 生效**：校验失败自动滚动到第一个错误字段（默认 false）。字段规则走 ElForm 原生；跨字段走 XForm 内部                                                                                                                                                         |
| 校验     | `scrollIntoViewOptions` | `ScrollIntoViewOptions \| boolean`                | **仅顶层 schema 生效**：滚动行为选项，默认 true                                                                                                                                                                                                                             |
| 校验     | `debounceValidation`    | `number`                                          | **仅顶层 schema 生效**：跨字段校验全局 debounce 默认延迟（毫秒），0 = 实时。字段级 `rules[i].debounceMs` 可覆盖                                                                                                                                                             |
| 校验     | `watchFallback`         | `boolean`                                         | **仅顶层 schema 生效**：反向 cross 的 deep watch 兜底开关（默认 true）。纯 v-model 表单（所有写入经 `onValueChange`）可显式 `false` 关闭兜底——省去每键 isEqual 快照 diff 成本，大表单性能敏感场景适用；绕过 v-model 的直改（setModel / 外部 patch）将不再自动触发跨字段校验 |

### 4.1 component 字符串解析规则

`resolveElComponentName(name)` 按序尝试：

1. 命中 `components` prop 注册的自定义组件名 → 直接用
2. 命中内置短名映射（33 个：`Input / Select / Option / Switch / DatePicker / TimePicker / TimeSelect / Upload / Transfer / TreeSelect / Autocomplete / Button / Icon / RadioGroup / Radio / CheckboxGroup / Checkbox / Cascader / InputNumber / InputPassword / InputTextArea / InputTag / ColorPicker / Mention / Rate / Slider / Card / Tabs / TabPane / Steps / Step / FormItem / Form`，另有 `ElInputPassword` / `ElInputTextArea` 两个 El 别名）→ 转 `ElXxx` 全名。映射表唯一真源为 `composables/resolve-component.ts` 的 `EL_COMPONENT_MAP`（35 键），`adapters/element-plus-adapter.ts` 从该表派生，禁止手写第二份
3. 以 `El` 开头的全名 → 直通
4. 全部未命中 → 降级渲染 `<div>` 占位（dev 模式 DebugBanner 会报 schema 校验错误）

### 内置默认 props

| 快捷名          | 默认 props                                  | 说明                                             |
| --------------- | ------------------------------------------- | ------------------------------------------------ |
| `Input`         | `{ clearable: true }`                       | 普通输入                                         |
| `InputNumber`   | `{ controlsPosition: 'right' }`             | 不限制最小值                                     |
| `InputPassword` | `{ type: 'password', showPassword: true }`  | 初始隐藏并允许切换                               |
| `InputTextArea` | `{ type: 'textarea', showWordLimit: true }` | 多行输入，默认显示字数统计（需配合 `maxlength`） |
| `InputTag`      | `{ clearable: true }`                       | `modelValue` 为 `string[]`                       |
| `ColorPicker`   | 无                                          | 颜色和格式由节点配置                             |
| `Mention`       | 无                                          | options 和 prefix 由节点配置                     |
| `Rate`          | 无                                          | 星级、是否半星由节点配置                         |

### 4.2 隐藏三态速查（hidden / ignore / permission: 'hidden'）

XForm 有 **三种语义不同的"隐藏"字段**，新人极易混淆。下面是决策速查：

| 字段                   | DOM 渲染                  | 参与校验 | `model[name]` 值 | 典型场景                                    |
| ---------------------- | ------------------------- | -------- | ---------------- | ------------------------------------------- |
| `hidden: true`         | ✅ 渲染（`display:none`） | ✅ 是    | ✅ 保留          | 表单分区（如折叠面板内字段，保留 model 值） |
| `ignore: true`         | ❌ 不渲染                 | ❌ 跳过  | ✅ 保留          | 临时不展示字段（如灰度发布、按角色屏蔽）    |
| `permission: 'hidden'` | ❌ 不渲染                 | ❌ 跳过  | ✅ 保留          | 权限敏感字段（无权限时连 model 都不暴露）   |

> **三种"隐藏"的共同点**：都不在 DOM 中可见；`model[name]` 都保留不变。
> **核心区别**：是否触发 el-form 校验、是否生成 form-item 实例。

#### 决策树

```text
需要隐藏字段但仍参与提交 / 校验？
├─ 是 → hidden: true（保留 form-item，display:none）
└─ 否 → 完全不需要该字段的校验与提示？
    ├─ 是 → ignore: true 或 permission: 'hidden'
    │   └─ 需要按用户权限动态决定？
    │       ├─ 是 → permission: 'hidden'（支持函数/表达式动态切换）
    │       └─ 否 → ignore: true（静态跳过）
    └─ 否 → 但需展示只读文本？
        └─ 是 → permission: 'view'（详见 §10）
```

#### 实际场景对照

| 业务场景                                    | 推荐字段               | 原因                   |
| ------------------------------------------- | ---------------------- | ---------------------- |
| "发票抬头"未勾选时折叠隐藏，但保留 model 值 | `hidden: true`         | 折叠显示时仍需必填校验 |
| 灰度发布的实验字段，未启用时跳过校验        | `ignore: true`         | 完全不渲染，避免误提交 |
| 管理员可见但普通用户不可见的内部备注        | `permission: 'hidden'` | 按角色动态隐藏         |
| 详情页只读展示用户角色                      | `permission: 'view'`   | 渲染纯文本，不校验     |

#### 与 §10 字段权限联动

`permission` 三态（`'view'` / `'edit'` / `'hidden'`）中的 `'hidden'` 与独立字段 `hidden` 是不同概念：

- 独立字段 `hidden: true` 是**静态隐藏**，永远隐藏
- `permission: 'hidden'` 是**动态隐藏**，按用户/权限/字段值决定

两者可组合：同时设 `hidden: true` 与 `permission: 'edit'` 表示默认隐藏、按权限切换为可编辑。

---

## 5. 校验体系

### 5.1 字段内规则（async-validator 兼容）

```ts
{
  component: 'Input',
  name: 'email',
  rules: [
    { required: true, message: '必填', trigger: 'blur' },
    { type: 'email', message: '邮箱格式错误' },
    { min: 6, max: 20 },
  ],
}
```

`RuleItem` 字段：`required / pattern / min / max / message / validator / trigger / type` + 扩展的跨字段字段（下节）。

命名复用（跨表单共享同一规则）：

```vue
<XForm :rules="{ strongPwd: { min: 8, message: '至少 8 位' } }" :schema="schema" />
```

```ts
// 节点内引用
{ component: 'Input', name: 'password', rules: 'strongPwd' }
```

### 5.2 跨字段校验（dependsOn / deps + crossValidator）

> **命名统一（Wave3-5）**：`dependsOn` 与 `deps` 是同一字段的别名（与 reaction / asyncOptions 的 `deps` 命名对齐），同时声明时 `dependsOn` 优先。新代码建议写 `deps`。

```ts
{
  component: 'Input',
  name: 'confirmPassword',
  rules: [
    {
      deps: ['password'],                            // 依赖字段（lodash 路径）；dependsOn 是别名
      crossValidator: (value, pwd) =>
        value === pwd ? true : '两次密码不一致',       // true=通过；string=错误信息
      trigger: 'blur',                               // blur / change / manual / 数组
    },
  ],
}
```

关键行为（按代码）：

- `crossValidator` 支持**同步返回** `true | string` 或 **异步返回** `Promise<true | string>`（`validate()` 会 await）
- 失败信息由 form-schema 统一写入对应 form-item，无需 callback
- `trigger` 匹配：未指定默认响应 `blur`；`'manual'` 只在 `validate()` 时跑；数组可配多事件
- **反向触发**：字段值变化时，只重跑 `dependsOn` 包含该字段的规则（精确触发，不整表重验）
- **空值跳过**：字段值为空时不跑 cross 校验（留给 required/type 规则）。⚠️ 三路径差异：实时触发（反向/事件）空值跳过并清错，但 `validate()` **批量路径空值照跑**——字段为空时实时编辑不报 cross 错、点提交却可能报，属刻意设计（三路径空值策略见 `cross-rule-runner.ts` 文件头）

### 5.3 Zod 校验

```vue
<script setup lang="ts">
import { z } from 'zod'
const zodSchema = z.object({ email: z.string().email('邮箱格式错误') })
</script>
<template>
  <XForm :schema="schema" :model="form" :zod-schema="zodSchema" ref="formRef" />
</template>
```

```ts
const { success, errors } = formRef.value!.validateWithZod()
// errors: ZodError | null（含完整 issues 路径）
```

### 5.4 触发时机汇总

| 时机                  | 跑什么                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 字段 blur / change    | 该字段 rules 中 `trigger` 匹配的规则（含 crossValidator）+ 反向跨字段规则（trigger 默认 `blur`，`'manual'` 不响应事件） |
| 字段值写入（v-model） | 反向跨字段规则（change 语义）+ 清空该字段错误                                                                           |
| `validate()` 手动调用 | **短路逻辑**：先跑 el-form 字段内规则，失败 → 直接 `false` 不跑跨字段；成功 → 跑全部跨字段规则（含 `manual`）           |
| `validateWithZod()`   | 仅 Zod schema（独立通道，与 validate() 不互通）                                                                         |

### 5.5 schema 静态校验（工具函数）

```ts
import { validate } from '@vv/ui/components/form-schema'
const { isValid, errors } = validate(schemaNode, {
  knownComponents: { builtin: new Set(['Input', 'Select']), user: new Set(['MyComp']) },
})
// errors: Array<{ keyPath, message }> —— 缺 component / 未知组件名 / on 回调非法等
```

dev 模式下 XForm 自动对传入 schema 做此校验 + 表达式安全扫描（禁 `window/eval/constructor` 等危险标识符），错误显示在右下角 **XFormDebugBanner** 浮窗，prod 零开销。

---

## 6. 响应式联动（reaction）

```ts
{
  component: 'Input',
  name: 'path',
  label: '路径',
  reaction: {
    disabled: (m) => !m.enablePath,                            // 字段值
    rules: (m) => (m.enablePath ? 'required' : undefined),     // 校验（可引用命名规则）
    props: { placeholder: (m) => (m.enablePath ? '请输入' : '') },
    label: (m) => (m.enablePath ? '路径（必填）' : '路径'),
    hidden: (m) => !m.enablePath,
    strategy: 'debounce',   // sync(默认) / debounce / throttle
    delay: 300,             // debounce/throttle 延迟 ms
  },
}
```

- **值形态**：字面量 / 函数 `(model) => T` / 函数表达式字符串 `'{{ (m) => ... }}'`（沙箱解析）
- **可覆盖字段**：`rules / props / label / hidden / disabled` 等任意节点字段（开闭原则，未知字段透传）
- **调度策略**：`sync` 立即执行；`debounce` 适合远程搜索等高频输入；`throttle` 适合实时保存
- **求值错误** → `console.error('[XForm] reaction evaluation error:', err)`，不中断渲染
- ⚠️ **不要在 reaction 函数里写 `model` 字段**——watch deep model 会再次触发 reaction，形成死循环

---

## 7. 数组节点（kind: 'array'）

```ts
{
  kind: 'array',
  name: 'items',
  label: '明细行',
  array: {
    itemSchema: [
      { component: 'Input', name: 'name', label: '品名' },
      { component: 'InputNumber', name: 'qty', label: '数量' },
    ],
    initialLength: 1,     // model 未定义时的初始行数（默认 1）
    minItems: 1,          // 达下限禁用删除按钮（校验也读取该值）
    maxItems: 5,          // 达上限禁用新增按钮
    showActions: { add: true, remove: true, move: true },
    labels: { add: '添加', remove: '删除', moveUp: '上移', moveDown: '下移' },
    title: '商品明细',     // 容器标题（默认不渲染表头）
  },
}
```

- 同一份 `itemSchema` 套到 `model[name]` 的每个数组元素；行内字段 `name` 自动重写为 `items[0].qty` 路径
- 操作 API 见 §3.3（`addItem / removeItem / moveItem`）
- 行内控件的禁用等联动需通过 `reaction` 自行级联

---

## 8. 异步选项（asyncOptions）

为 `Select / Cascader / TreeSelect / Autocomplete` 提供内置远程数据能力：

```ts
{
  component: 'Select',
  name: 'district',
  asyncOptions: {
    source: async () => fetch(`/api/districts?city=${form.city}`).then((r) => r.json()),
    deps: 'city',                          // 依赖字段路径，任一变化重新请求
    immediate: true,                       // 节点创建时立即请求（默认 true）
    transform: (raw) => raw.map((it) => ({ label: it.name, value: it.id })),
    onError: (err) => { /* 请求出错回调（默认仅写内部 error 状态） */ },
  },
}
```

| 字段        | 说明                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| `source`    | 数据源函数，返回原始数组（支持 Promise）；Autocomplete 场景可接收可选 query 参数 |
| `immediate` | 是否立即请求（默认 `true`）                                                      |
| `deps`      | 依赖字段路径（lodash 路径），变化时重新请求                                      |
| `transform` | 把原始数组转为 `{ label, value }[]`                                              |
| `onError`   | 请求出错回调                                                                     |

> ⚠️ **位置限制**：`asyncOptions` 仅支持顶层 `children` 与节点 `slots` 内的字段。**不支持**
> 数组行内（`kind: 'array'` 的 `array.itemSchema`）与自定义 FormItem 插槽（`formItem.slots`）——
> 这两处的 `asyncOptions` 不会发起请求，且 dev 模式下 Debug Banner 会输出
> `ASYNC_OPTIONS_UNSUPPORTED_POSITION` 警告。数组行内的远程下拉需求，请先在数组外预取数据、
> 行内用静态 `options` 消费；行内异步选项的支持已列入引擎演进计划。

---

## 9. 上传文件（Upload）

XForm 内置 `Upload` 组件对应 Element Plus 的 `ElUpload`。由于 ElUpload 的双向绑定属性是 `file-list` 而不是 `modelValue`，**节点必须显式声明 `modelProp: 'fileList'`**，否则表单模型不会随上传列表变化。

### 基础用法

```ts
{
  component: 'Upload',
  name: 'avatar',
  label: '头像',
  modelProp: 'fileList',          // 关键：绑定 ElUpload 的 file-list
  props: {
    action: '/api/upload',
    accept: 'image/*',
    limit: 1,
    listType: 'picture-card',
  },
}
```

> **picture-card 默认图标**：当 `props.listType: 'picture-card'` 且未自定义 `slots.default` 时，XForm 会自动注入
> `<el-icon><Plus /></el-icon>` 作为上传触发图标，无需在 schema 中手动配置。

### 常见场景速查

| 场景           | 关键配置                                                      |
| -------------- | ------------------------------------------------------------- |
| 单文件头像     | `limit: 1` + `accept: 'image/*'` + `listType: 'picture-card'` |
| 多文件附件     | `multiple: true` + `limit: 5`                                 |
| 拖拽上传       | `drag: true` + `multiple: true`                               |
| 图片墙         | `listType: 'picture-card'` + `multiple: true`                 |
| 手动上传       | `autoUpload: false`，选择文件后随表单一起提交                 |
| 上传前校验     | `beforeUpload` 拦截大小 / 类型                                |
| 已上传文件回显 | 给 `model.fileList` 预置 `UploadUserFile[]` 初始值            |

### 自定义上传行为

业务中通常不会把真实接口直接写在 `action`，而是使用 `httpRequest` 对接项目统一封装的请求方法：

```ts
{
  component: 'Upload',
  name: 'attachments',
  modelProp: 'fileList',
  props: {
    multiple: true,
    httpRequest: async (options) => {
      const formData = new FormData()
      formData.append('file', options.file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      options.onSuccess?.(json)
    },
  },
}
```

### 上传前校验示例

```ts
import type { UploadRawFile } from 'element-plus'

function beforeUploadCheck(rawFile: UploadRawFile): boolean {
  const isImage = ['image/jpeg', 'image/png'].includes(rawFile.type)
  const isLt2M = rawFile.size / 1024 / 1024 < 2
  if (!isImage) ElMessage.error('只接受 JPG/PNG 图片')
  if (!isLt2M) ElMessage.error('图片大小不能超过 2MB')
  return isImage && isLt2M
}

// schema 中
props: {
  beforeUpload: beforeUploadCheck
}
```

### 已上传文件回显

表单加载时直接把服务端返回的文件列表写入 model，ElUpload 会自动渲染为成功状态：

```ts
const model = reactive({
  contract: [{ name: 'contract.pdf', url: '/files/contract.pdf', status: 'success' }],
})
```

### 配置速查

| 字段                 | 说明                                                      |
| -------------------- | --------------------------------------------------------- |
| `modelProp`          | 必须设为 `'fileList'`                                     |
| `props.action`       | 上传地址；使用 `httpRequest` 时可填占位符                 |
| `props.accept`       | 接受的文件类型                                            |
| `props.multiple`     | 是否多选                                                  |
| `props.limit`        | 最大文件数                                                |
| `props.drag`         | 拖拽上传                                                  |
| `props.listType`     | `text / picture / picture-card`                           |
| `props.autoUpload`   | `false` 时手动触发或随表单提交                            |
| `props.beforeUpload` | 上传前拦截钩子                                            |
| `props.httpRequest`  | 自定义上传实现                                            |
| `slots.default`      | 自定义上传触发区；picture-card 未配置时自动显示 Plus 图标 |
| `slots.tip`          | 上传区域下方提示文案                                      |

## 10. 字段权限（permission）

三态：`'edit'`（默认，可编辑）/ `'view'`（只读纯文本，跳过校验）/ `'hidden'`（不渲染，DOM 不出现）：

```ts
{
  component: 'Input',
  name: 'salary',
  label: '薪资',
  permission: (m) => (m.role === 'admin' ? 'edit' : 'view'),
}
```

- 值形态：字面量 / 函数 `(model) => 'view' | 'edit' | 'hidden'` / 函数表达式 `'{{ (m) => ... }}'`
- `view` 态渲染 label + model 值纯文本（布尔 → 是/否；数组 → 逗号拼接；空 → `—`）
- 与 `hidden: true` 字段的区别：`hidden` 仍渲染（display:none，保留校验），`permission: 'hidden'` 完全不渲染

---

## 11. 脏状态追踪（dirty）

用于"离开页面未保存"提醒、仅提交变更字段等场景：

```ts
watch(
  () => formRef.value?.isDirty(),
  (dirty) => {
    /* 切换未保存标记 */
  }
)

// 提交成功后归零
formRef.value?.resetDirty()
```

配合草稿恢复（§12）：

```ts
onMounted(() => {
  if (persist.hasDraft.value) {
    persist.load()
    formRef.value?.resetDirty() // 草稿为新基线，isDirty 从草稿起算
  }
})
```

---

## 12. 草稿持久化（useFormPersist）

```ts
import { useFormPersist } from '@vv/ui/components/form-schema'

const model = reactive<Record<string, unknown>>({})
const persist = useFormPersist({
  key: 'orders.create.draft', // 草稿唯一标识（经 storage namespace 隔离）
  model,
  exclude: ['password', 'card.cvv'], // 敏感字段 lodash 路径，序列化剔除（必配！）
})
```

| 配置            | 默认      | 说明                                          |
| --------------- | --------- | --------------------------------------------- |
| `key`           | 必填      | 草稿唯一标识，建议 `<模块>.<表单名>.draft`    |
| `model`         | 必填      | 被监听的 reactive model                       |
| `storage`       | `'local'` | `'session'` 关标签页失效                      |
| `debounce`      | `400`     | 自动保存防抖 ms                               |
| `exclude`       | `[]`      | 敏感字段 lodash 路径，序列化剔除              |
| `restoreFilter` | —         | schema 升级后裁剪旧草稿；返回 `null` 丢弃草稿 |

返回 `{ save, load, clear, hasDraft, lastSavedAt }`：

- `save()` 立即落盘（取消防抖）；`load()` 恢复草稿（**草稿保留，可反复恢复**）；`clear()` 清除
- 自动防抖落盘 + `beforeunload` 兜底 flush（组件卸载时自动清理监听）
- `hasDraft: Ref<boolean>` 用于挂载时决定是否提示恢复

**已知限制**：File/Blob/函数等不可序列化值会退化丢失；多标签页并发编辑不同步（后写覆盖先写）；含密码/证件号等字段必须配置 `exclude`。

---

## 13. 链式构建器

> 复杂联动推荐对象字面量（可读性好）；类型安全要求高的场景用构建器。

```ts
import { xInput, xSelect, xArray } from '@vv/ui/components/form-schema/builders'

const schema = {
  column: 2,
  row: { gutter: 24 },
  children: [
    xInput('email').label('邮箱').required().placeholder('a@b.com').defaultValue('a@b.com').build(),
    xSelect('role')
      .label('角色')
      .options([
        { value: 'admin', label: '管理员' },
        { value: 'user', label: '用户' },
      ])
      .build(),
  ],
}
```

### 13.1 基础链式方法（所有 builder 通用）

| 方法                              | 说明                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| `label(text)`                     | 标签                                                                 |
| `defaultValue(v)`                 | 初值                                                                 |
| `placeholder(p)`                  | 占位符（写入 props）                                                 |
| `prop(key, value)`                | 任意组件 prop                                                        |
| `disabled(v)`                     | 禁用（支持反应式）                                                   |
| `required(message?)`              | 必填规则（可多次调用叠加）                                           |
| `validator(fn, trigger?)`         | callback 风格 async-validator（多次调用 push 多条规则）              |
| `asyncValidator(fn, trigger?)`    | 异步 validator 简写（fn 内部调 cb；抛错/reject 自动 cb(Error) 兜底） |
| `rules(rules)`                    | 整组覆盖规则                                                         |
| `hidden(flag?)` / `ignore(flag?)` | 隐藏 / 跳过渲染                                                      |
| `col(span)`                       | 栅格列                                                               |
| `reaction(config)`                | 联动配置                                                             |
| `build()`                         | 产出 `SchemaNodeFor<C>`                                              |

### 13.2 29 个 builder 及特有方法

| Builder                                                                                        | 特有链式方法                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `xInput`                                                                                       | `clearable()`                                                                                                        |
| `xTextarea`                                                                                    | `rows(n)`（type=textarea）                                                                                           |
| `xInputPassword`                                                                               | —                                                                                                                    |
| `xInputTextArea`                                                                               | —                                                                                                                    |
| `xInputTag`                                                                                    | —                                                                                                                    |
| `xColorPicker`                                                                                 | —                                                                                                                    |
| `xMention`                                                                                     | —                                                                                                                    |
| `xRate`                                                                                        | —                                                                                                                    |
| `xSelect`                                                                                      | `options([{ value, label }])`                                                                                        |
| `xOption` / `xSwitch` / `xInputNumber` / `xSlider` / `xRadio` / `xCheckbox` / `xCheckboxGroup` | —                                                                                                                    |
| `xDatePicker`                                                                                  | `format(v)`（→ valueFormat）                                                                                         |
| `xTimePicker`                                                                                  | `format(v)` / `valueFormat(v)` / `range()`                                                                           |
| `xTimeSelect`                                                                                  | `format(v)` / `start(v)` / `end(v)` / `step(v)`                                                                      |
| `xTreeSelect`                                                                                  | `data(tree)` / `multiple()` / `checkStrictly()` / `nodeKey(k)` / `props(p)`                                          |
| `xCascader`                                                                                    | `options(opts)` / `showAllLevels()` / `separator(s)`                                                                 |
| `xUpload`                                                                                      | `action(url)` / `accept(types)` / `multiple()` / `drag()` / `listType(t)`                                            |
| `xAutocomplete`                                                                                | `fetchSuggestions(fn)` / `triggerOnFocus()` / `placement(p)`                                                         |
| `xTransfer`                                                                                    | `data(items)` / `titles(l, r)` / `filterable()` / `buttonTexts(l, r)`                                                |
| `xRadioGroup`                                                                                  | `options(opts)`（生成 Radio 子节点）                                                                                 |
| `xCard`                                                                                        | `title(t)` / `column(c)` / `gutter(g)`                                                                               |
| `xTabs`                                                                                        | `modelValue(v)` / `beforeLeave(fn)`                                                                                  |
| `xSteps`                                                                                       | `active(n)` / `processStatus(s)`                                                                                     |
| `xArray`                                                                                       | `item(schema)` / `initialLength(n)` / `minItems(n)` / `maxItems(n)` / `showActions(v)` / `labels(opts)` / `title(t)` |

---

## 14. 类型推导

`SchemaNode` 是宽类型（`props: Record<string, unknown>`），写错不会报错。**`SchemaNodeFor<C>` 按 component 字段推导 props 类型**：

```ts
import type { SchemaNodeFor } from '@vv/ui/components/form-schema'

const email: SchemaNodeFor<'Input'> = {
  component: 'Input',
  name: 'email',
  props: { placeholder: 'a@b.com', clearable: true },
  // props: { placeholder: 123 }  // ❌ TS 报错
}
```

内置 30 个组件名均支持推导（`ComponentPropsRegistry`，另有 `ArrayNode` 占位条目）。运行时短名另有 Button、Icon、Form 等完整映射；自定义组件通过 module augmentation 扩展：

```ts
// types/form-schema.d.ts
declare module '@vv/ui/components/form-schema/types' {
  interface ComponentPropsRegistry {
    MyInput: MyInputProps
  }
}
```

> 类型扩展仅影响 TS 推导；运行时仍需 `<XForm :components="{ MyInput: MyInputComp }" />` 注册。

---

## 15. 栅格与响应式

### 15.1 顶层容器

```ts
const schema = {
  column: 2, // 每行 2 个字段（自动平均分配 span）
  row: { gutter: 24 },
  labelPosition: 'top', // 'left' 默认 / 'right' / 'top'（响应式布局推荐 top）
  children: [/* ... */],
}
```

### 15.2 节点级 col

```ts
{ component: 'Input', name: 'remark', col: { span: 24, offset: 2 } }
```

### 15.3 响应式断点（5 档）

```ts
col: {
  responsive: {
    xs: { span: 24 },   // < 768px 手机
    sm: { span: 12 },   // ≥ 768px 平板
    md: { span: 8 },    // ≥ 992px 小屏
    lg: { span: 6 },    // ≥ 1200px 桌面
    xl: { span: 4 },    // ≥ 1920px 大屏
  },
}
```

`row.responsive` 同构（每个断点可独立设 `gutter/type/align/justify`）。XForm 内部监听 `window.resize`，断点变化时整体重渲染（实测 120 字段 mount 74ms，流畅）。

---

## 16. 选型决策（XForm vs element-plus 原生）

| 场景                               | 推荐                  |
| ---------------------------------- | --------------------- |
| 简单表单（< 5 字段）固定结构       | **element-plus 原生** |
| 动态 schema（来自后端 / 配置文件） | **XForm**             |
| 复杂联动（> 3 字段互相关联）       | **XForm**             |
| 复用校验规则                       | **XForm**             |
| 跨组件共享表单状态                 | **XForm**             |
| 性能关键（> 100 字段同时渲染）     | **element-plus 原生** |
| 多语言 + 动态 schema               | **XForm**             |

```
需要动态 schema（配置/后端）？
├─ 是 → XForm ✅
└─ 否 → 字段是否 < 5 且结构固定？
        ├─ 是 → element-plus 原生 ✅
        └─ 否 → 需要复杂联动 / 校验复用？
                ├─ 是 → XForm ✅
                └─ 否 → 看团队偏好
```

---

## 17. 故障排查

| 现象                       | 原因                                      | 修复                                                                         |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| 输入无反应                 | `model` 不是 reactive 包装                | 用 `reactive({})` 包装（dev 控制台有 warn）                                  |
| 输入无反应                 | 节点缺 `name` 字段                        | 添加 `name: 'fieldId'`                                                       |
| 输入无反应（数组行内字段） | 行内 name 需相对路径                      | 用 lodash 路径语义，如 `name: 'qty'`（自动重写为 `items[0].qty`）            |
| 校验不触发                 | `rules` 是字符串但未在 `props.rules` 注册 | 配置 `<XForm :rules="{...}" />`                                              |
| 校验不触发                 | 异步 validator 返回 rejected Promise      | 用 `cb(err)` 不用 throw（builder 的 `asyncValidator` 已兜底）                |
| 校验不触发（跨字段）       | `crossValidator` 缺 `dependsOn`           | 两者必须成对出现                                                             |
| 反应式不响应               | reaction 函数体未引用 `model` 形参        | `reaction: { disabled: (m) => ... }`                                         |
| 反应式死循环               | reaction 函数内写 `model` 字段            | 联动只写节点字段，写 model 需走外部 store                                    |
| directive 不生效           | directive 名未注册                        | `app.directive()` 全局注册或传 `directives` prop                             |
| 栅格不生效                 | 顶层 schema 缺 `column` / `row`           | 添加 `{ column: 2, row: { gutter: 24 } }`                                    |
| 栅格不生效                 | 子节点 `col` 与顶层 `column` 同时使用     | 两者会形成两层 ElCol 嵌套（外层按 column 平均 span），布局由外层决定——二选一 |
| 自定义组件渲染成 `<div>`   | component 名未命中三类规则                | 注册到 `components` prop / 用 `ElXxx` 全名 / 直接传组件对象                  |
| 样式不对                   | 重复 import element-plus CSS              | XForm 内部已 `import 'element-plus/dist/index.css'`                          |
| 断点不响应                 | schema 引用频繁整体替换                   | 用 `markRaw` 包 schema 避免深度响应式开销                                    |
| 改 schema 深层字段不生效   | schema 管线只认根引用替换                 | 整体赋新引用（`schema = { ...schema, children: [...] }`），勿原地 mutate     |

**dev 调试浮窗**：XFormDebugBanner 显示 schema 校验错误（keyPath + message）与表达式安全扫描结果（`[SECURITY] forbidden identifiers`）。另有 `window.__xform_debug`（dev only）：`setFieldError / getFieldErrors / getModel`。

---

## 18. 已知限制

| 限制                             | 说明                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 草稿不可序列化值                 | File/Blob/函数 等经 JSON 序列化退化丢失（`useFormPersist`）                                                                                                                                                                     |
| 草稿多标签页不同步               | 后写覆盖先写，无跨标签监听                                                                                                                                                                                                      |
| builder 链式 TS 推断             | 个别链式组合需 `as` cast 绕过（运行时不影响）                                                                                                                                                                                   |
| `labelPosition` 仅顶层生效       | element-plus el-form 实例级属性限制                                                                                                                                                                                             |
| schema 须整体替换                | schema 变更管线对**根引用**做 deep watch + cloneDeep 重建（含索引 / reaction 预算 / crossRule 拍平等 N 次 walk）；不支持对 schema 内部深层字段做原地 mutate 热更——请整体赋新引用（`schema.value = nextSchema`）触发单次重建     |
| 数组行级 reaction 无全局预算上限 | 每行独立 `createBudget(50)`（单 flush 50 次），100 行理论合计 5000 次/flush 无全局闸门。A5 后同配置重渲染不再重注册（仅初始注册计入），实际风险已大降；超大数组 + 循环联动场景建议经 `XFormProps.reactionBudget` 收紧单行行预算 |

---

## 19. 示例索引（63 个 demo，含 1 个主入口）

在线演示站点：`pnpm dev` → `/demo`（左侧「XForm 表单引擎」分组），路由 = `/demo/xform-<kebab-case>`。所有 demo 源码位于 `apps/docs/src/modules/demo/examples/XForm/`（63 个 `.vue` 文件 + 5 个 configs/ 共享配置 + 2 个 utils/ 辅助文件）。

| 路由                                    | 内容                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `/demo/xform-overview`                  | **主 demo**：Props/Events/Slots 完整 API 表 + 实例方法演示（对应 `XFormOverview.vue`） |
| `/demo/xform-minimum-demo`              | 最小示例（5 分钟上手）                                                                 |
| `/demo/xform-base`                      | 基础用法（多字段 + 校验 + 重置）                                                       |
| `/demo/xform-nested`                    | 复杂布局（Card 容器 + slots + 嵌套）                                                   |
| `/demo/xform-nested-array`              | 嵌套数组（树形数据 + 多层联动）                                                        |
| `/demo/xform-builder`                   | 链式构建器                                                                             |
| `/demo/xform-grid`                      | row + column 栅格布局                                                                  |
| `/demo/xform-props-advanced`            | Props 进阶（model/schemas/events/expose 完整契约）                                     |
| `/demo/xform-schema-index`              | 索引快照（getNames/getRef）                                                            |
| `/demo/xform-large-schema`              | 大 schema 性能（千级字段）                                                             |
| `/demo/xform-label-layout`              | label 布局（top/left/right）+ labelWidth                                               |
| `/demo/xform-i18n`                      | label 函数式 i18n（XFormProps.t 注入 + 语言切换重渲）                                  |
| `/demo/xform-style-override`            | 样式覆盖（BEM 命名空间）                                                               |
| `/demo/xform-responsive`                | 响应式布局（断点拍平）                                                                 |
| `/demo/xform-ignore`                    | ignore 字段（UI 展示但不参与 submit）                                                  |
| `/demo/xform-render-recovery`           | 渲染失败恢复机制（ErrorBoundary + fallback）                                           |
| `/demo/xform-model-warn`                | model 缺失警告                                                                         |
| `/demo/xform-detail-fill`               | 详情页回填（加载 + resetDirty）                                                        |
| `/demo/xform-order-create`              | 业务综合示例（订单创建）                                                               |
| `/demo/xform-reaction`                  | 反应式联动（含防抖/节流）                                                              |
| `/demo/xform-reaction-deps`             | reaction `deps` 精确监听                                                               |
| `/demo/xform-reaction-array-row`        | 数组行内嵌 reaction（行内相对 deps，行小计联动）                                       |
| `/demo/xform-reaction-calc-field`       | reaction 计算字段                                                                      |
| `/demo/xform-reaction-cascade-clear`    | reaction 级联清空                                                                      |
| `/demo/xform-reaction-reactive-props`   | reaction 动态 props                                                                    |
| `/demo/xform-reaction-advanced`         | reaction 进阶用法                                                                      |
| `/demo/xform-reaction-strategy`         | reaction 策略选择                                                                      |
| `/demo/xform-expression`                | `{{ }}` 函数表达式沙箱                                                                 |
| `/demo/xform-expression-sandbox`        | 表达式沙箱隔离与安全演示                                                               |
| `/demo/xform-cross-field`               | 跨字段校验                                                                             |
| `/demo/xform-cross-field-reverse`       | 反向跨字段（精确触发）                                                                 |
| `/demo/xform-async-options`             | 异步选项                                                                               |
| `/demo/xform-async-options-error`       | 异步选项加载失败降级                                                                   |
| `/demo/xform-async-autocomplete`        | Autocomplete 远程搜索（asyncOptions 竞态令牌，快速连打不闪回）                         |
| `/demo/xform-async-validator`           | 异步校验（loading 态）                                                                 |
| `/demo/xform-array`                     | 数组节点（增删/上下移/min-max 限制）                                                   |
| `/demo/xform-array-api`                 | 数组节点 + 远程 API 同步                                                               |
| `/demo/xform-array-draggable`           | 数组行拖拽排序                                                                         |
| `/demo/xform-array-cross-field`         | 数组行内跨字段校验（行内相对 dependsOn + 反向触发）                                    |
| `/demo/xform-before-change`             | beforeChange 三层校验                                                                  |
| `/demo/xform-persist`                   | 草稿持久化（自动保存 + 刷新恢复）                                                      |
| `/demo/xform-persist-schema-version`    | 草稿持久化 + schema 版本不兼容检测                                                     |
| `/demo/xform-dirty`                     | 脏状态追踪                                                                             |
| `/demo/xform-disabled`                  | 禁用状态（反应式）                                                                     |
| `/demo/xform-global-disabled`           | 整体禁用（顶层 schema `disabled`）                                                     |
| `/demo/xform-global-readonly`           | 整体只读（顶层 schema `readonly`）                                                     |
| `/demo/xform-field-permission`          | 字段权限（view/edit/hidden）                                                           |
| `/demo/xform-field-permission-resolver` | 字段级权限解析器（`permissionResolver` 注入，权限码 → 状态映射）                       |
| `/demo/xform-directives`                | 自定义指令                                                                             |
| `/demo/xform-events`                    | `on` 事件绑定（函数 + 表达式）                                                         |
| `/demo/xform-server-error`              | 服务端错误映射                                                                         |
| `/demo/xform-error-toast-slot`          | 错误提示自定义插槽                                                                     |
| `/demo/xform-slots`                     | 插槽系统                                                                               |
| `/demo/xform-tabs-steps`                | Tabs/Steps 视觉容器（children 即面板 + 激活态绑定 model + 校验门控）                   |
| `/demo/xform-invalid-component`         | 无效组件校验（div 占位 + DebugBanner）                                                 |
| `/demo/xform-custom-component`          | 自定义组件（用户组件注册）                                                             |
| `/demo/xform-custom-form-item`          | 自定义 FormItem 包装                                                                   |
| `/demo/xform-scroll-to-error`           | 校验失败自动滚动                                                                       |
| `/demo/xform-validate-field`            | `validateField` 单字段校验                                                             |
| `/demo/xform-validate-detail`           | `validateDetail` 全字段校验 + 详细错误                                                 |
| `/demo/xform-validation-debounce`       | 跨字段 debounce 调优                                                                   |
| `/demo/xform-zod`                       | Zod schema 校验                                                                        |
| `/demo/xform-upload`                    | 文件上传（单文件/多文件/拖拽/图片墙/校验/回显）                                        |

> **主 demo 入口**：`/demo/xform-overview`（对应 `XFormOverview.vue`）—— 查阅全部 prop、事件、实例方法的入口。其余 62 个 demo 按「基础 → 进阶 → 反应式联动 → 校验 → 异步 → 数组 → 样式与扩展」分组覆盖各能力边界。
>
> **配套工具**：`apps/docs/src/modules/demo/examples/XForm/configs/`（5 个共享 schema 配置）+ `apps/docs/src/modules/demo/examples/XForm/utils/`（2 个演示用辅助文件）。

---

## 20. 相关文档

- `docs/25-XForm架构与决策记录.md` — 架构分层 / 渲染管线 / ADR 决策 / 调试教训（维护者视角）
- `docs/superpowers/specs/2026-08-19-form-schema-design.md` — 引擎设计稿
- `packages/ui/src/components/form-schema/README.md` — 组件内 README（如与本文冲突，以本文为准）
