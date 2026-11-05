# Form Schema 权威设计指南

> 本文档是 `src/components/form-schema/` 的综合设计指南，整合了 2026-08-19 至 2026-08-28 期间 6 份 spec/impl 文档，并反映了 2026-09 月 P0 / P1 / P2 三轮重构后的当前实现。
>
> **历史决策档案**：原分散文档保留在 `docs/superpowers/{specs,plans}/2026-08-*-form-schema-*.md`，可作为变更历史追溯。

| 属性     | 值                            |
| -------- | ----------------------------- |
| 版本     | v3.1.0                        |
| 日期     | 2026-09-09                    |
| 状态     | 当前实现（生产可用）          |
| 关联分支 | `feature/form-engine`         |
| 关联代码 | `src/components/form-schema/` |

---

## 0. 演进时间线

| 日期       | 阶段         | 主要内容                                                                                      |
| ---------- | ------------ | --------------------------------------------------------------------------------------------- |
| 2026-08-19 | 设计稿       | 整体设计：架构、DSL、API、安全、测试                                                          |
| 2026-08-20 | v1 实现      | 基础 schema 渲染、reaction 联动、表达式沙箱                                                   |
| 2026-08-21 | 异步选项     | `asyncOptions` 字段 + 自动渲染 + deps 触发                                                    |
| 2026-08-21 | 类型推导     | `SchemaNodeFor<C>` 按 component 字段推导 props 类型                                           |
| 2026-08-28 | 默认组件扩展 | 6 个新快捷名（InputPassword / InputTextArea / InputTag / ColorPicker / Mention / Rate）       |
| 2026-08-28 | 上传 demo    | `XFormUpload.vue` 演示 7 种上传场景                                                           |
| 2026-09-01 | P0 重构      | 拆 XForm.vue 95 行 + builders.ts 去重 + 类型断言归因                                          |
| 2026-09-01 | P1 重构      | types.ts 拆 9 文件 + 模块级状态清理 + OSD 错误反馈                                            |
| 2026-09-01 | P2 重构      | 超大 composable 拆分 + render-schema-node 拆 4 文件                                           |
| 2026-09-09 | 目录归位     | 5 个 Vue 组件移入 `components/` + element-plus-adapter 移入 `adapters/`（纯移动，零逻辑变更） |

---

## 1. 架构与目录结构（当前 P2 拆分后）

### 1.1 顶层目录

```text
src/components/form-schema/
├── components/                    # Vue 组件集中（2026-09-09 从根目录归位）
│   ├── XForm.vue                  # 入口组件（149 行：P2 后 setup 块零业务逻辑；模板 + props/attrs 透传 + ElConfigProvider + ElForm 骨架）
│   ├── XFormDebugBanner.vue       # dev mode 调试面板（schema 校验错误 + 安全扫描）
│   ├── XFormErrorToast.vue        # 错误 OSD toast（OPT-7 user-facing，showErrorToast prop 控制默认关闭）
│   ├── XFormErrorToastItem.vue    # OSD toast 单条错误项
│   └── SchemaField.vue            # 节点级渲染容器（B-2：字段级重渲隔离）
├── adapters/                      # 组件库适配层（2026-09-09 从根目录归位）
│   └── element-plus-adapter.ts    # 内置 EL 组件映射表 + 默认 props
├── types.ts                       # barrel re-export（→ types/ 子目录）
├── types/                         # P1-OPT-4 拆分后
│   ├── base.ts                    # EventFn / FunctionExpression / SchemaSlot
│   ├── rule.ts                    # RuleItem（async-validator 兼容 + 跨字段）
│   ├── reaction.ts                # ReactionValue / ReactionConfig
│   ├── directive.ts               # DirectiveConfig / FormItemConfig
│   ├── array.ts                   # ArrayNodeConfig
│   ├── layout.ts                  # RowConfig / ColConfig（响应式断点）
│   ├── async-options.ts           # AsyncOptionsConfig
│   ├── schema-node.ts             # SchemaNode（35 字段）+ ComponentPropsRegistry + SchemaNodeFor
│   ├── xform.ts                   # XFormProps / XFormExpose / ValidateOptions / ValidateResult
│   ├── identity.ts                # SchemaNodeIdentity（6 字段：component/name/label/key + id/meta 设计器预留）
│   ├── render.ts                  # SchemaNodeRender（5 字段：props/on/children/slots/directives）
│   ├── validate.ts                # SchemaNodeValidate（2 字段：rules/defaultValue）
│   ├── top-level.ts               # SchemaNodeTopLevel（7 字段：labelPosition/labelWidth/scrollToError/scrollIntoViewOptions/debounceValidation/watchFallback + schemaVersion 设计器预留）
│   └── v-model.ts                 # SchemaNodeVModel（1 字段：modelProp）
├── builders.ts                    # 兼容 barrel → builders/（29 个链式 builder，架构审查 #3 拆分；Wave4-2 +2 xTabs/xSteps）
├── builders/                      # 链式 builder 实现（core 基类 + fields-input/select/date/data + containers）
├── index.ts                        # 公共导出 + Vue 插件形式
├── README.md                      # 简明使用说明
├── styles/
│   └── element-form-overwrite.scss   # form-schema 自定义样式覆盖
├── composables/                   # 一文件一能力（50 个含 barrel.ts，P2 拆分后）
│   ├── barrel.ts                  # 子模块公共导出聚合
│   ├── use-xform-composer.ts      # 顶层编排（composition root）
│   ├── use-xform-expose.ts        # XFormExpose 装配（实例方法对外契约）
│   ├── use-form-instance.ts       # el-form 实例方法编排（P2-A1：200 行）
│   ├── use-set-field-error.ts     # setFieldError 双路径 + watch 守护（P2-A1：219 行）
│   ├── use-form-validation.ts     # validateForm / validateDetail / applyCrossErrors
│   ├── use-cross-field-trigger.ts # 反向跨字段实时触发 + debounce
│   ├── use-cross-field-rule-trigger.ts # 正向跨字段（blur/change 触发）+ 序号令牌竞态防护
│   ├── use-form-dirty.ts          # dirty 状态追踪（阶段 2.2）
│   ├── use-form-persist.ts        # 草稿持久化（草稿存储到 localStorage）
│   ├── use-server-error.ts        # 服务端 422 → 表单字段错误映射（阶段 2.1）
│   ├── use-top-level-fields.ts     # 顶层 schema 字段解析（11 个 computed）
│   ├── use-schema-renderer.ts     # watch(schema) + reaction traverse
│   ├── use-render-root.ts         # 渲染根维护（renderOpts 快照 + optsEpoch 失效广播）
│   ├── use-schema-index.ts        # 字段元数据中央索引（O(1) getNames）
│   ├── use-schema-index.builder.ts # 索引构建器
│   ├── use-validate.ts            # validate() 静态校验 + validateWithZod
│   ├── use-zod-validator.ts       # zod 校验执行器（validateWithZod 实现）
│   ├── validate-component-props.ts # 节点 props 静态校验（dev 拼写检测）
│   ├── use-scan-forbidden.ts      # 表达式沙箱关键字黑名单扫描
│   ├── use-scan-async-options.ts  # asyncOptions 不可达位置扫描（formItem.slots / array.itemSchema）
│   ├── use-dev-runtime.ts         # dev 运行时（schema 校验 + 扫描 + debug hook 挂载）
│   ├── use-expression.ts          # ExpressionScope 实例沙箱 + 模块级兼容 API（@deprecated）
│   ├── use-expression-functions.ts # 白名单函数表管理（expressionFunctions 注册/清空）
│   ├── use-async-options.ts       # 异步选项数据源 + Autocomplete fetcher
│   ├── use-field-permission.ts    # view/edit/hidden 权限 gate
│   ├── use-current-breakpoint.ts  # 响应式断点检测
│   ├── use-reaction.ts            # reaction applyReactionFields + watchEffect
│   ├── use-form-error-bus.ts      # OPT-7：错误事件总线（provide/inject + OSD）
│   ├── apply-reaction-fields.ts   # reaction 字段值求值
│   ├── apply-default-values.ts    # 默认值填充（schema.defaultValue → model）
│   ├── apply-directives.ts        # withDirectives 包装
│   ├── build-vmodel-bindings.ts   # v-model 双向绑定（含 beforeChange 拦截）
│   ├── build-on-bindings.ts       # on 事件绑定（函数 / 函数表达式字符串）
│   ├── render-schema-node.ts      # 主调度入口（~190 行，P2-B 拆分后）
│   ├── resolve-component.ts       # 组件名解析（P2-B：104 行）
│   ├── compile-rules.ts           # 规则编译 + 默认 message（P2-B：41 行）
│   ├── wrap-with-elcol.ts         # 栅格响应式包装（P2-B：82 行）
│   ├── build-slots.ts             # 插槽构造 + Upload 默认内容（P2-B：125 行）
│   ├── render-form-item.ts        # formItem 包装 + row+column 布局
│   ├── render-visual-container.ts # 视觉容器（Card 等无 name 节点）
│   ├── render-array-node.ts       # 数组节点（kind: 'array'）
│   ├── array-row-key.ts           # 数组行身份 key（rowKeyOf / rewriteNamePath 名路径前缀化）
│   ├── render-with-grid.ts        # row+column 布局辅助
│   ├── with-hidden.ts             # display:none wrapper
│   └── draft-storage.ts           # 草稿存储后端
├── utils/                         # 纯函数工具（跨 composable 复用、无响应式状态）
│   ├── read-ref-str.ts            # ref/string 归一化读取
│   ├── collect-el-field-errors.ts # el-form 错误对象扁平化收集（批次 1-1）
│   ├── run-el-form-validate.ts    # el-form validate Promise 化（批次 1-1）
│   └── walk-schema.ts             # M5：schema 树四向递归公共遍历器（批次 3-2，统一 5 处手写递归）
└── bench/
    └── large-schema.bench.ts       # 大 schema 性能基线
```

### 1.2 模块职责分层

| 层级                   | 职责                                                                                                             | 边界                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **XForm.vue**          | 模板 + props/attrs 透传 + setup 零业务逻辑                                                                       | 仅依赖 useXFormComposer             |
| **use-xform-composer** | 顶层编排（composition root）：11 个 composable 装配 + opts 同步（watch 守护已于 2026-09-18 实证删除，见审查 #4） | 编排其他 composable，不重复业务逻辑 |
| **composables/**       | 一文件一能力（<200 行）                                                                                          | 仅依赖 types/ + 其他 composable     |
| **types/**             | Schema DSL 类型契约                                                                                              | 无运行时逻辑                        |
| **builders/**          | 链式 API（builder 模式，builders.ts 为兼容 barrel）                                                              | 类型强推导                          |

### 1.3 数据流

```text
XForm.vue 接收 props
    ↓
useXFormComposer 编排
    ├── useSchemaRenderer  ──watch(schema)──→ reactiveSchema
    ├── useSchemaIndex     ──O(1) getNames/fields
    ├── useFormInstance    ──elFormRef + setFieldError + 数组操作
    ├── useFormValidation  ──validateForm + applyCrossErrors
    ├── useCrossFieldTrigger ──realtime reverse cross
    ├── useFormDirty       ──dirty 状态基线
    ├── useServerError     ──422 → 字段错误
    ├── useTopLevelFields   ──顶层字段（labelPosition 等）
    ├── useFormErrorBus    ──OPT-7：OSD 错误事件总线
    └── useApplyReactions  ──reaction watchEffect 编排
    ↓
RenderSchemaNode 主调度（render-schema-node.ts）
    ├── 权限 gate（hidden / view / edit）
    ├── 数组节点 → renderArrayNode
    ├── 视觉容器 → renderVisualContainer
    ├── formItem 包装 → renderWithFormItem
    └── 默认分支 → wrapWithElCol + h(Comp, props)
```

---

## 2. Schema DSL 字段契约（31 字段最终版）

### 2.1 字段分类

| 类别             | 字段                                                                                                                            | 数     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **节点标识**     | `component`, `name`, `key`, `label`, `id`, `meta`                                                                               | 6      |
| **渲染属性**     | `props`, `on`, `children`, `slots`, `directives`                                                                                | 5      |
| **布局**         | `row`, `column`, `col`, `formItem`                                                                                              | 4      |
| **校验**         | `rules`, `defaultValue`                                                                                                         | 2      |
| **响应式**       | `reaction`, `disabled`, `permission`, `readonly`, `hidden`, `ignore`, `beforeChange`                                            | 7      |
| **数组节点**     | `kind: 'array'`, `array: ArrayNodeConfig`                                                                                       | 2      |
| **数据加载**     | `asyncOptions`                                                                                                                  | 1      |
| **顶层配置**     | `labelPosition`, `labelWidth`, `scrollToError`, `scrollIntoViewOptions`, `debounceValidation`, `watchFallback`, `schemaVersion` | 7      |
| **v-model 适配** | `modelProp`                                                                                                                     | 1      |
| **合计**         |                                                                                                                                 | **35** |

完整字段定义见 `types/schema-node.ts`。

### 2.2 节点类型

```typescript
export interface SchemaNode {
  // 节点标识
  component?: string | object // 组件名（short/ElXxx/native）或 Component 对象
  name?: string // 字段名（绑定 model[name]）
  label?: string // form-item label
  key?: string | number // v-for key

  // 渲染属性
  props?: Record<string, unknown> // 透传给 component
  on?: Record<string, EventFn | FunctionExpression> // 事件绑定
  children?: SchemaNode | SchemaNode[] | string // 子节点 / 字符串
  slots?: Record<string, SchemaSlot> // 插槽
  directives?: DirectiveConfig[] // 自定义指令

  // 布局
  row?: RowConfig // el-row 响应式
  column?: number // 自动分列（24/column）
  col?: boolean | ColConfig // el-col 响应式
  formItem?: boolean | FormItemConfig // 是否包 el-form-item

  // 校验
  rules?: string | RuleItem | Array<string | RuleItem>
  defaultValue?: unknown // mount 时填充到 model（若未定义）

  // 反应式
  reaction?: ReactionConfig // 节点级派生
  disabled?: ReactionValue<boolean>
  permission?: ReactionValue<'view' | 'edit' | 'hidden'>
  readonly?: ReactionValue<boolean>
  hidden?: boolean | ReactionValue<boolean>
  ignore?: boolean // getNames 排除 / 不渲染

  // 数组节点
  kind?: 'array'
  array?: ArrayNodeConfig

  // 数据加载
  asyncOptions?: AsyncOptionsConfig // Select/Cascader/TreeSelect/Autocomplete

  // v-model 适配
  modelProp?: string // 默认 'modelValue'，Upload 用 'fileList'

  // 顶层 schema 生效
  labelPosition?: 'left' | 'right' | 'top'
  labelWidth?: string | number
  scrollToError?: boolean
  scrollIntoViewOptions?: ScrollIntoViewOptions | boolean
  debounceValidation?: number
}
```

### 2.3 类型推导

`SchemaNodeFor<C>` 按 component 字段推导 props 类型：

```typescript
const node: SchemaNodeFor<'Input'> = {
  component: 'Input',
  name: 'email',
  props: { placeholder: 'a@b.com', clearable: true }, // ← TS 校验 ElInputProps
}
```

`ComponentPropsRegistry` 通过 TS module augmentation 可扩展自定义组件：

```typescript
declare module '@/components/form-schema/types' {
  interface ComponentPropsRegistry {
    MyInput: MyInputProps
  }
}
```

---

## 3. 渲染流程与数据流

### 3.1 整体流程

```text
1. XForm 挂载 / props 变化
   ↓
2. useXFormComposer 编排
   ↓
3. RenderSchemaNode 主调度（renderToComponentInner）
   ├─ 权限 gate（hidden / view / edit）
   ├─ 数组节点 → renderArrayNode
   ├─ 视觉容器（Card 等带 row/column，无 name）
   ├─ formItem 包装（含 name 或 formItem: true）
   └─ 默认分支 → wrapWithElCol + h(Comp, props)
   ↓
4. el-form-item 注册到 el-form（自动按 name 关联 model[field]）
   ↓
5. 用户输入 → v-model 更新 → model[field] 响应式更新 → reaction 联动
```

### 3.2 反应式系统（reaction）

```typescript
const schema: SchemaNode = {
  children: [
    {
      component: 'Switch',
      name: 'strict',
    },
    {
      component: 'Input',
      name: 'reason',
      reaction: {
        hidden: (m) => !m.strict, // 函数
        disabled: '{{ (m) => m.strict ? "是" : "否" }}', // 表达式字符串
        rules: (m) => (m.strict ? [{ required: true }] : []), // 同步 rules
        deps: ['strict'], // 精确 watch 路径
      },
    },
  ],
}
```

**reaction 调度策略**（`ReactionConfig.strategy`，见 `types/reaction.ts`）：

- `sync`（默认）：依赖变化立即同步执行
- `debounce`：依赖停止变化 `delay` ms 后执行（远程搜索等高频输入场景）
- `throttle`：`delay` ms 内最多执行一次（实时保存场景）

**性能优化**：声明 `deps: ['a', 'b.c']` 后，仅精确 watch 这些路径；未声明时 deep watch 整棵 model（重开销）。

### 3.3 数据双向绑定

```typescript
// buildVModelBindings(node, model, beforeChange, onValueChange)
{
  modelValue: model.name,                     // 读
  'onUpdate:modelValue': (v) => {            // 写
    const old = model.name
    const final = beforeChange?.(node, v, old) ?? v
    set(model, node.name, final)              // lodash set 支持嵌套路径
    onValueChange?.(node, final)
  },
}
```

**关键点**：model 必须由父组件传入**响应式对象**（`reactive()` / `ref().value`），XForm 不创建副本。

### 3.4 校验双轨

| 触发                        | 路径                                                    |
| --------------------------- | ------------------------------------------------------- |
| `exposed.validate()`        | `el-form.validate()` + `runCrossFieldValidation()` 并行 |
| 字段失焦                    | el-form-item.async-validator（rules）                   |
| `exposed.validateWithZod()` | `zodSchema.safeParse(model)`                            |
| 跨字段反向触发              | `useCrossFieldTrigger.trigger(field)`                   |

---

## 4. 校验系统

### 4.1 标准字段规则（async-validator 兼容）

```typescript
{
  rules: [
    { required: true, message: '请输入', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式错误' },
    {
      validator: (rule, value, cb) => {
        if (value === 'forbidden') cb(new Error('禁用值'))
        else cb()
      },
      trigger: 'change',
    },
    // 命名规则引用（XForm 扩展）
    { required: true, message: '请输入' },  // 'required' 是 DSL 简写
  ],
  rules: 'emailRule',  // 命名规则需在 XFormProps.rules 中注册
}
```

### 4.2 跨字段规则

```typescript
{
  rules: [{
    dependsOn: ['password'],
    crossValidator: (value, password) =>
      value === password || '两次密码不一致',
    // trigger: 'blur' | 'change' | 'manual'  —— 可选，默认 blur（与 match-trigger.ts 第 14 行一致）
    // debounceMs: 300  —— 字段级 debounce 覆盖顶层 debounceValidation
  }],
}
```

**触发机制**：

- **realtime 反向触发**：`useCrossFieldTrigger` watch model 变化时精确触发 deps 包含变化字段的 crossValidator（不区分 trigger）
- **trigger 匹配（match-trigger.ts）**：字段 blur/change 事件触发时按 `rule.trigger` 过滤——`'manual'` 永不响应事件，array 形式 `['blur','change']` 任一命中即匹配，未指定默认 `blur`
- **validateForm 批量 + 短路**：`runCrossFieldValidation` 遍历 schema 跑全部 crossValidator（含 `'manual'`），但 `validateForm` 字段规则失败时直接 `false` 不跑跨字段（短路逻辑）

> **H3 修复（2026-09-09）**：model watch 兜底从顶层浅拷贝 diff 改为按 rule 的 deps 值快照 diff
> （`use-cross-field-trigger.ts`，对齐 use-reaction deps 快照模式），嵌套路径直改
> （`model.user.age = 30` 绕过 v-model）不再漏触发。
>
> **reset 语义（2026-09-09）**：`resetFields` 走 composer 包装 —— 实例重置后同 tick 调
> `crossFieldTrigger.onFormReset()`（取消排队 debounce runner + 重拍 deps 快照），
> 兜底 watch 随后到达时快照一致空跑，**重置后不重新校验**（对齐 el-form 官方惯例）。
> 无此防护时，重置回初始值的字段会被兜底 watch 当普通变化重跑 crossValidator
> （如 user.age 重置回 10 时「未成年」红字复现）。setModel 不经此包装，仍走兜底校验。

### 4.3 服务端错误映射（OPT 2.1）

```typescript
exposed.validateFromServer({
  success: false,
  errors: [
    { field: 'email', message: '邮箱已被注册' },
    { field: 'username', message: '用户名非法' },
  ],
})
```

自动写入字段错误，触发红字 + OSD toast。

---

## 5. 反应式（reaction）

> **H1 修复（2026-09-09）**：字段级 `disabled`/`hidden` 的函数 / `'{{ fn }}'` 形态在克隆阶段
> 由 `applyReactions` 归一化为 reaction 条目求值（`use-reaction.ts` 入口），boolean 结果写回 node。
> `permission`（渲染时 `resolvePermission` 求值）与顶层 `disabled`/`readonly`
> （`useTopLevelFields` computed 求值）本就工作，不在归一化范围。

### 5.1 字段覆盖范围

`reaction` 可覆盖节点的任意字段：rules / props / label / hidden / disabled + 任何 `SchemaNode[key]`。

### 5.2 调度策略

| strategy         | 行为                             | 适用场景 |
| ---------------- | -------------------------------- | -------- |
| `'sync'`（默认） | 依赖变化立即同步执行             | 一般联动 |
| `'debounce'`     | 依赖停止变化 delay ms 后执行一次 | 远程搜索 |
| `'throttle'`     | delay ms 内最多执行一次          | 实时保存 |

### 5.3 性能：deps 精确监听

```typescript
reaction: {
  hidden: (m) => !m.userType,
  deps: ['userType'],  // 精确监听 —— 避免 deep watch 整棵 model
}
```

未声明 `deps` 时 deep watch 整棵 model（重开销）。大 schema 下务必声明 deps。

---

## 6. 错误处理与 OSD

### 6.1 三层错误展示

| 层                                                            | 触发                                            | 可见性         |
| ------------------------------------------------------------- | ----------------------------------------------- | -------------- |
| **form 红字**                                                 | el-form-item 校验失败                           | 用户           |
| **XFormDebugBanner**（dev only）                              | schema 静态校验失败 / 表达式含 forbidden 标识符 | 开发者右下角   |
| **XFormErrorToast**（`showErrorToast` prop，默认关闭，OPT-7） | 跨字段校验失败 / schema 非法 / 服务端错误       | 用户右上角浮窗 |

### 6.2 OSD 输出格式

```text
✕ [CROSS_VALIDATION_FAILED] @useFormValidation/elForm
校验失败 3 项（详见表单红字）
  passwordConfirm  两次密码不一致     = 1
  startDate        请选择开始日期     = (空)
  endDate          请选择结束日期     = (空)
```

**Console 同步输出**（async-validator 风格 errorsMap）：

```js
[XForm][CROSS_VALIDATION_FAILED] 校验失败 3 项（详见表单红字） useFormValidation/elForm {
  passwordConfirm: [{ message: '两次密码不一致', fieldValue: '1', field: 'passwordConfirm' }],
  startDate: [{ message: '请选择开始日期', fieldValue: '', field: 'startDate' }],
  endDate: [{ message: '请选择结束日期', fieldValue: '', field: 'endDate' }]
}
```

### 6.3 错误传播分级

| 错误类型            | 等级  | 处理                             | 用户感知            |
| ------------------- | ----- | -------------------------------- | ------------------- |
| schema 静态校验失败 | INFO  | console.error + 不阻塞           | 控制台 + dev banner |
| 函数表达式解析失败  | WARN  | console.error + 跳过字段         | 该事件不触发        |
| reaction 求值抛错   | WARN  | console.error + 保留上次值       | 反应式失效          |
| 组件查找失败        | WARN  | console.warn + 渲染 `<div>`      | 占位                |
| 跨字段校验失败      | ERROR | console.error + OSD toast + 红字 | 用户感知            |
| 服务端 422          |       | OSD toast + 红字                 | 用户感知            |
| zod 顶层校验失败    | INFO  | 返回 errors                      | 调用方展示          |

**无静默吞错误**（CLAUDE.md §一.10）：所有 catch / 异常分支均带 console + OSD 上下文。

---

## 7. 安全策略

### 7.1 函数表达式沙箱（D2）

- 用 `new Function('model', '__rest', ` + `return (${expr})` + 仅暴露 model 参数
- 相对 `eval` 的安全提升：new Function 创建独立函数作用域，不污染上层闭包

**dev 模式静态扫描**（`use-scan-forbidden.ts`）：

```typescript
const FORBIDDEN_REG =
  /\b(window|document|globalThis|eval|Function|setTimeout|setInterval|fetch|XMLHttpRequest)\b/
```

**H2 修复（2026-09-09）：沙箱状态实例级化**

此前函数表（`EXPRESSION_FNS`）与编译缓存（`EXPRESSION_CACHE`）是模块级共享状态，同页多 XForm
实例互相污染（浏览器实测三种形态：B mount 覆盖 A 的函数表 / A unmount 清表致 B 表达式
ReferenceError / A 重挂载覆盖 B）。修复后：

- composer setup 顶部用 `createExpressionScope()` 创建**每实例一份**的函数表 + 编译缓存
- 4 个消费点统一注入 `exprScope.resolveFunctionExpression`：
  `useTopLevelFields`（顶层自描述字段）→ `useSchemaRenderer`（reaction 管线
  traverse → applyReactions → applyReactionFields）→ `useRenderRoot`（render 层
  on 事件绑定 / permission 表达式）
- `useExpressionFunctions` 改为把 props.expressionFunctions 写入注入 scope，
  不再操作模块级状态，也无 onScopeDispose 清表（scope 随实例 GC）
- 模块级 `setExpressionFunctions` / `resolveFunctionExpression` 保留并标 `@deprecated`
  （对外公共 API，直接删除是 breaking change）

### 7.2 schema 来源约束

| 来源                               | 是否允许                                |
| ---------------------------------- | --------------------------------------- |
| 内部代码硬编码 schema              | ✅ 推荐                                 |
| `*.config.ts` / `*.json` 项目配置  | ✅                                      |
| 后端 API 返回 schema               | ⚠️ 必须先经 `validate(schema)` 静态校验 |
| URL 参数 / localStorage / 用户输入 | ❌ 禁止                                 |

### 7.3 OWASP Top 10 对齐

| 风险                | 缓解                                                       |
| ------------------- | ---------------------------------------------------------- |
| A03 Injection       | new Function 沙箱 + FORBIDDEN 关键字扫描 + schema 来源约束 |
| A04 Insecure Design | 双轨校验 + `validate()` 强制校验                           |
| A05 Misconfig       | 默认安全配置；不暴露敏感选项                               |
| A08 Data Integrity  | dev 模式扫描 + 来源约束                                    |

---

## 8. Builder 链式 API

### 8.1 29 个 builder 工厂

| builder          | 组件名          | 特有方法                                                                                              |
| ---------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `xInput`         | `Input`         | `clearable`                                                                                           |
| `xInputPassword` | `Input`         | -                                                                                                     |
| `xInputTextArea` | `Input`         | -                                                                                                     |
| `xInputTag`      | `InputTag`      | -                                                                                                     |
| `xTextarea`      | `Input`         | `rows`                                                                                                |
| `xSelect`        | `Select`        | `options`                                                                                             |
| `xOption`        | `Option`        | -                                                                                                     |
| `xSwitch`        | `Switch`        | -                                                                                                     |
| `xDatePicker`    | `DatePicker`    | `format`（valueFormat）                                                                               |
| `xTimePicker`    | `TimePicker`    | `format` / `valueFormat` / `range`                                                                    |
| `xTimeSelect`    | `TimeSelect`    | `format` / `start` / `end` / `step`                                                                   |
| `xTreeSelect`    | `TreeSelect`    | `data` / `multiple` / `checkStrictly` / `nodeKey` / `props`                                           |
| `xUpload`        | `Upload`        | `action` / `accept` / `multiple` / `drag` / `listType`                                                |
| `xAutocomplete`  | `Autocomplete`  | `fetchSuggestions` / `triggerOnFocus` / `placement`                                                   |
| `xTransfer`      | `Transfer`      | `data` / `titles` / `filterable` / `buttonTexts`                                                      |
| `xRadioGroup`    | `RadioGroup`    | `options`                                                                                             |
| `xRadio`         | `Radio`         | -                                                                                                     |
| `xCheckboxGroup` | `CheckboxGroup` | -                                                                                                     |
| `xCheckbox`      | `Checkbox`      | -                                                                                                     |
| `xCascader`      | `Cascader`      | `options` / `showAllLevels` / `separator`                                                             |
| `xInputNumber`   | `InputNumber`   | -                                                                                                     |
| `xColorPicker`   | `ColorPicker`   | -                                                                                                     |
| `xMention`       | `Mention`       | -                                                                                                     |
| `xRate`          | `Rate`          | -                                                                                                     |
| `xSlider`        | `Slider`        | -                                                                                                     |
| `xCard`          | `Card`          | `title` / `column` / `gutter`                                                                         |
| `xTabs`          | `Tabs`          | `modelValue` / `beforeLeave`                                                                          |
| `xSteps`         | `Steps`         | `active` / `processStatus`                                                                            |
| `xArray`         | (array node)    | `item` / `initialLength` / `minItems` / `maxItems` / `showActions` / `labels` / `title` / `draggable` |

### 8.2 用法示例

```typescript
const schema = {
  column: 2,
  row: { gutter: 24 },
  children: [
    xInput('email').label('邮箱').required().placeholder('a@b.com').defaultValue('a@b.com').build(),
    xDatePicker('birthday').label('生日').format('YYYY-MM-DD').build(),
    xSelect('country')
      .label('国家')
      .options([
        { value: 'CN', label: '中国' },
        { value: 'US', label: '美国' },
      ])
      .build(),
  ],
}
```

**类型推导**：每个 builder 绑死 component 名 + props 类型，IDE 自动补全 props 字段名 + 校验值类型。

---

## 9. 测试策略（65 个 `.spec.ts` + 2 个 `.test-d.ts`）

### 9.1 测试分布

| 类别                         | 文件数 | 测试数                  | 覆盖率目标 |
| ---------------------------- | ------ | ----------------------- | ---------- |
| composables（含 XForm 编排） | 51     | 主体回归                | ≥80%       |
| components                   | 5      | 组件行为                | ≥80%       |
| adapters                     | 1      | 适配层                  | ≥80%       |
| utils                        | 5      | 纯函数                  | ≥80%       |
| 根 *.spec.ts                 | 3      | 主入口 + 契约           | ≥80%       |
| types (test-d)               | 2      | 编译期                  | N/A        |
| **合计（spec 文件）**        | **65** | 见 `pnpm test` 实际输出 | ≥80%       |

> 测试用例总计数应通过 `pnpm test --reporter=verbose` 实测，文档不在此处硬编码（避免与实际运行结果失真）。
> 根目录 spec 为 builders / index / xform-contract 共 3 个；components/ 下 5 个（XForm/SchemaField/XFormDebugBanner/XFormErrorToast/XFormErrorToastItem）；adapters/ 下 1 个（element-plus-adapter）；utils/ 下 5 个。

### 9.2 关键回归保护（源码级静态断言）

`XForm.spec.ts` 用 `?raw` 导入源码做正则匹配，防止未来精简时误删关键配置：

- `:validate-trigger="['change', 'blur']"` 必须在 `<ElForm>` 标签上
- `import 'element-plus/dist/index.css'` 必须存在（OPT-0 回归修复）
- `import './styles/element-form-overwrite.scss'` 必须存在（OPT-0 回归修复）
- 顶层 `v-for` 不能用 `:key="i"`，必须用 `node.key ?? node.name ?? i`

### 9.3 验证命令

```bash
pnpm type-check:full   # vue-tsc --build --force
pnpm test              # 全量测试（52 个 .spec.ts + 2 个 .test-d.ts）
pnpm lint              # ESLint
pnpm check:doc-currency  # 文档硬数据与代码一致性（5 项校验）
pnpm build             # vite build
```

---

## 10. 已知限制与未来路线

### 10.1 已知限制

- **Element Plus 2.x 内部耦合**：setFieldError 双路径依赖 el-form.fields[i].validateState/validateMessage ref，element-plus 3.0 升级需重新验证
- **getRef 依赖 el-form 实例内部 `$` 结构**（非 EP 公开 API，架构审查 #14）：`use-form-instance.ts` 的 `getRef()` 经内部 `$` 字段取 el-form 暴露，EP 3.0 升级窗口期需与 setFieldError 路径 B 一并验证
- **element-plus 2.14 shallowRef 限制**：日期/Select/Cascader 等复杂控件失焦时不触发 crossValidator 红字（点击保存才触发）—— 这是 element-plus 自身实现
- **validateStateDebounced (100ms)**：setFieldError 写入后 100ms 才显示红字（element-plus 内部节流）
- **reaction 嵌套无深度检查**：循环 reaction 可能触发"Maximum recursive updates"（已实现 50 次/flush 预算作为兜底并 `console.error` 告警）
- **validate() 短路逻辑**：字段规则失败时直接 `false` 不跑跨字段；这是 element-plus `validate()` 风格一致行为，详见 `use-form-validation.ts:validateForm`

### 10.2 未来路线（P2+ 待评估）

| 项                             | 描述                               | 风险                        |
| ------------------------------ | ---------------------------------- | --------------------------- |
| element-plus 3.0 升级          | setFieldError 重构 + 全套回归      | 高（需重写路径 B）          |
| setFieldError 重构（P1-OPT-6） | 130 行 → 40 行，等待 EP 3.0 窗口期 | 高                          |
| builder API 统一（27→15）      | 破坏性变更，4 种 Input 变体合并    | 中（需要 deprecation 过渡） |
| unknown props 校验             | dev mode 严格 props 校验           | 中                          |
| 服务端 schema 动态下发         | 安全风险高                         | 暂不做                      |

### 10.3 已完成的优化

| 阶段    | 改进                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**  | 拆 XForm.vue (478→95) + builders 去重 + 类型断言归因 + CSS 回归修复                                                                               |
| **P1**  | 拆 types.ts (556→9 文件) + 模块级状态清理 + OSD 错误反馈 + 组件拆分                                                                               |
| **P2**  | 拆超大 composable + 拆 render-schema-node.ts + 合并设计文档（本文件，125 行 XForm.vue + 30 字段 SchemaNode + 39 个 demo 配套）                    |
| **P0+** | 2026-09-02：useXFormComposer 拆 useDevRuntime + useXFormExpose + applyDefaultValues（493→387 行）；renderArrayNode 抽 array-row-key（276→185 行） |

---

## 11. 手动验证步骤

### 11.1 基础渲染验证

1. 启动 `pnpm dev`，打开 `http://localhost:5173/demo/xform-base`
2. **预期**：基础 XForm 渲染，所有 Input/Select 组件正常工作

### 11.2 校验路径验证

1. 打开 `/demo/xform-cross-field`
2. 密码填 `123`，确认密码填 `1`，点击「保存」
3. **预期**：
   - 表单红字「两次密码不一致」「请选择开始日期」「请选择结束日期」可见
   - **右上角 OSD toast**：3 项错误详情，field + message + 当前值
   - **console**：async-validator 风格 errorsMap 对象

### 11.3 反应式验证

1. 打开 `/demo/xform-reaction`
2. 切换 Switch 状态，观察其他字段的 hidden / disabled / rules 联动
3. **预期**：字段立即响应，OSD 无 toast（realtime 路径静默避免噪音）

### 11.4 数组节点验证

1. 打开 `/demo/xform-array`
2. 添加 3 行数据，删除中间一行，验证焦点保持
3. **预期**：剩余行不闪烁、焦点不丢失

### 11.5 服务端错误验证

1. 打开 `/demo/xform-server-error`
2. 触发模拟 422 错误
3. **预期**：OSD toast 列出错误字段，控制台输出服务端 errorsMap

### 11.6 类型推导验证

1. 在 IDE 中输入 `const node: SchemaNodeFor<'Input'> = { ... }`
2. **预期**：IDE 自动补全 props 字段名，写错类型（如 `placeholder: 123`）触发 TS 编译错误

---

## 12. 与项目 CLAUDE.md 硬约束对齐

| §      | 约束                             | 状态                                                                                                                                                                                                                                                                                                              |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1.2   | 模块边界                         | ✅ types.ts barrel + composables 一文件一能力                                                                                                                                                                                                                                                                     |
| §1.4   | 防御性 UI（Loading/Error/Empty） | ⚠️ 不在 XForm 内部，由调用方用 `<AsyncState>` 包装                                                                                                                                                                                                                                                                |
| §1.6   | AutoImport                       | ✅ 全程不显式 import ref / watch / createNamespace                                                                                                                                                                                                                                                                |
| §2     | src/ Architecture Lockdown       | ✅ 本目录稳定，所有改动经 §2.4 申请                                                                                                                                                                                                                                                                               |
| §3     | BEM 命名规范                     | ✅ XForm.vue 使用 `createNamespace('x-form')` + `<style lang="scss">` 无 scoped                                                                                                                                                                                                                                   |
| §4 #6  | 文件行数限制                     | ✅ XForm 149 / composables ≤315 / types/ ≤227                                                                                                                                                                                                                                                                     |
| §4 #7  | Hook/Composable 行数             | ⚠️ P0/P1 拆分后 5 个 composable >200 行：useXFormComposer (349)、useValidate (279)、useCrossFieldTrigger (306)、useFormInstance (268)、useFormValidation (236)。均按 §3.4 备注"cohesive orchestrator 例外"接受；composer 已贴近 doc-currency 预警上限（350/350），下次增长应先抽离 cross-field 编排块而非放宽阈值 |
| §4 #10 | npm 包验证                       | ✅ 仅 element-plus / lodash-es / zod（项目已装）                                                                                                                                                                                                                                                                  |
| §4 #11 | 新增 composable 需 .spec.ts      | ✅ composables/ 下 49 个实现文件全部配 spec（51 个 spec 文件，含 barrel.spec 与 cross-rule-runner.spec）                                                                                                                                                                                                          |

---

## 13. 引用

### 13.1 核心代码

- 入口组件：`src/components/form-schema/components/XForm.vue`
- 组件适配层：`src/components/form-schema/adapters/element-plus-adapter.ts`
- 顶层编排：`src/components/form-schema/composables/use-xform-composer.ts`
- 主调度：`src/components/form-schema/composables/render-schema-node.ts`
- 类型契约：`src/components/form-schema/types/schema-node.ts`
- 链式 builder：`src/components/form-schema/builders/`（`builders.ts` 为兼容 barrel）

### 13.2 历史决策档案

- `docs/superpowers/specs/2026-08-19-form-schema-design.md` — 原始设计
- `docs/superpowers/specs/2026-08-28-form-schema-default-components-design.md` — 默认组件扩展
- `docs/superpowers/plans/2026-08-19-form-schema-impl.md` — v1 实施
- `docs/superpowers/plans/2026-08-20-form-schema-v2-impl.md` — v2 实施
- `docs/superpowers/plans/2026-08-21-form-schema-async-options.md` — 异步选项实施
- `docs/superpowers/plans/2026-08-21-form-schema-custom-component-types.md` — 类型推导实施
- `docs/superpowers/plans/2026-08-28-form-schema-default-components.md` — 默认组件实施
- `docs/superpowers/plans/2026-08-28-form-schema-upload-demo.md` — 上传 demo

### 13.3 外部参考

- Element Plus 2.14.3：`node_modules/element-plus`（类型与实现）
- async-validator：`element-plus` 内部依赖，规则兼容
- Zod 4.4.3：可选顶层校验

---

## 14. 类型断言归因（`TYPE-CAST-AUDIT.md`）

`src/components/form-schema/` 下运行时类型断言（`as never` / `as any` / `as unknown`）共 **85 处**，按 9 个根因分类（C1-C9），归因表见 [`types/TYPE-CAST-AUDIT.md`](./types/TYPE-CAST-AUDIT.md)。

> 摘要：
>
> - **39 处 C1**（element-plus buildProp 类型元组缺陷）—— 等待 element-plus 3.0 类型系统重写（P2）
> - **15 处 C2**（SchemaNode.children 多态）—— schema 校验已拦，运行时安全，**接受**
> - **8 处 C3**（element-plus 2.x 内部 ref-like 字段）—— 等待 3.0 重构 setFieldError 路径 B
> - **6 处 C4**（ComputedRef 转 ref 类型偏离）—— 类型契约小幅偏离，**接受**
> - **5 处 C8**（lodash-es 动态路径）—— **接受**
> - 其余 12 处（C5/C6/C7/C9）零散分布在 use-xform-composer / wrap-with-elcol / render-with-grid 等

新增 cast 必须登记到 `TYPE-CAST-AUDIT.md` 并在代码内加 `// cast C#` 短注释。

---

## 15. 注释规范执行情况（2026-09-03）

> 依据 `~/.claude/rules/zh/comments.md` 的 4 层结构（文件级 / 函数级 / 关键分支级 / 跨文件钩子）与「不写『是什么』、只写『Why』+ magic number 来源 + 限制」原则，对 `src/components/form-schema/` 全量注释审计后的执行情况。

### 15.1 审计范围

| 类别                                                                   | 文件数      | 改动条数（约） |
| ---------------------------------------------------------------------- | ----------- | -------------- |
| 核心入口（XForm + composer + 主调度 + 校验编排 + el-form 编排）        | 5           | ~80 行精简     |
| 渲染子模块（render-* / wrap-* / build-* / resolve-* / compile-*）      | 9           | ~40 行精简     |
| composables/ 编排层（27 个）                                           | 27          | ~120 行精简    |
| 入口与适配（builders + index + components/ 5 组件 + adapters/ 适配器） | 7           | ~30 行精简     |
| types barrel                                                           | 1           | ~10 行精简     |
| **合计**                                                               | **49 文件** | **~280 行**    |

### 15.2 处理原则

| 原状                                                                                     | 处理                                  | 理由                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| 文件头 JSDoc 含 P0/P1/P2 拆分过程叙述                                                    | 删除                                  | 拆分过程已在 CHANGELOG 与 git log 中，按 comments.md 注释只写"是什么"，不写架构历史 |
| OPT-3 类型断言归因长块（≥10 行重复）                                                     | 缩短为 1 行 + 指向 TYPE-CAST-AUDIT.md | 已建独立审计文件，代码内重复是噪音                                                  |
| 描述"是什么"的 JSDoc（如 `/** 字段错误状态 ref —— XForm 模板用 keys 建立响应式依赖 */`） | 拆分保留 Why、删除"是什么"前缀        | 命名已解释"是什么"，注释只留模板为什么需要它                                        |
| 业务 Why 注释（如 clearArraySubtree 只清 fromIndex 及之后）                              | 保留                                  | 不读注释会改错，必留                                                                |
| 公共 API 行为契约 + 边界条件（如 `validate()` 短路规则）                                 | 保留                                  | 不变量不可缺                                                                        |
| 上下游钩子链（@see / @trigger 语义）                                                     | 简化                                  | 函数命名 + JSDoc `@returns` 路径足够                                                |

### 15.3 改进效果

- **总行数变化**：约 -200 行（删除冗余）+ ~80 行新增精简版 + ~80 行 types.ts barrel 拆开 = 净减少约 120 行
- **信息密度**：Why 类注释占比从约 35% 提升到约 75%（types.ts barrel 每个类型都附 JSDoc，业务方 hover 即可看到关键说明）
- **新人上手**：接手者读 1 行文件头 JSDoc + `git log -- <file>` 即可理解架构演变，不再被拆分历史淹没
- **IDE 智能提示**：types.ts barrel 上每个类型都附 JSDoc，业务方 `import { SchemaNode }` hover 即可看到字段分组 + 关键说明，不用跳到子目录

### 15.4 本轮补充改动（types/ 与 types.ts）

- **types/schema-node.ts**（30 字段核心接口）：删除文件级 JSDoc 中 22 行冗余字段列表（命名已解释，TS 类型已提供结构信息）；合并字段级 JSDoc 与 `@group` 标签到同一段（见 §15.5 第 2 条）；保留关键业务说明（SchemaNodeFor 泛型用法、disabled 双层语义、permission 三态、双层 override 模式）
- **types.ts barrel**：把 `export type { ... } from` 拆成 `export { type X } from`，每个类型上方加 JSDoc 速览，业务方 hover 时 IDE 显示完整说明而不是 `(alias) interface X`（见 §15.5 第 3 条）
- **composables/\*.spec.ts**（38 个测试）：未改动——按行业惯例 describe/it 名称自描述，无需 JSDoc

### 15.5 后续维护约束

- 新增/修改 .ts 文件时按 comments.md 4 层结构写注释
- 重构时若涉及拆分，**只在新文件头保留拆分说明**（如「从 useFormInstance 抽离」），旧文件头更新为新职责
- OPT-3 / OPT-7 等重构标签不再写入代码注释（已固化到 CHANGELOG 与审计文件），改用「从 use-xform-composer 抽离」等业务语境描述
- 任何新增的 `as any` / `as never` 必须同步登记到 `types/TYPE-CAST-AUDIT.md`
- **结构性 JSDoc 标签不得删除**：`@group` / `@see` / `@trigger` / `@defaultValue` / `@example` 等是 comments.md §15「结构化文档规范」硬约束要求的 IDE 智能提示依据，**审计时不得删除**
- **JSDoc 单属性只允许一段注释**：当字段需要「业务说明 + 结构性标签」时，必须把标签**合并到业务说明的同一段末尾**；拆成两段（业务说明段 + 独立 `@group` 段）时，TSDoc 只解析最后一段，前面的业务说明会被 IDE hover 丢弃。**反例 → 正例**：
  ```ts
  // ❌ 两段：hover 只看到 @group 节点标识
  /** 组件 —— 支持三种形式... */
  /** @group 节点标识 */
  component?: string | object

  // ✅ 一段：hover 看到完整说明 + 分组
  /**
   * 组件 —— 支持三种形式...
   * @group 节点标识
   */
  component?: string | object
  ```
- **barrel re-export 必须用 `export { type X }` + 上方 JSDoc**：`types.ts` 是公共入口，业务方 `import { SchemaNode } from '.../types'` 时 IDE 跳到 barrel。`export type { X } from` 写法 IDE 只显示 `(alias) interface X`，**真实定义位置的 JSDoc 不会显示**。修复方法：
  ```ts
  // ❌ alias 行无 JSDoc，hover 只显示 (alias) interface SchemaNode
  export type { SchemaNode } from './types/schema-node'

  // ✅ JSDoc 附着在 alias 上，hover 显示完整说明 + @see 跳转
  /**
   * SchemaNode —— XForm schema DSL 的核心节点定义（30 字段接口）
   * @see ./types/schema-node.ts 完整字段表
   */
  export { type SchemaNode } from './types/schema-node'
  ```
- **JSDoc 必须紧贴 export 声明**：TypeScript / TSDoc 解析器把 JSDoc 附着在**下一个 AST 节点**，中间隔了若干 import / type alias 等其他声明时，注释会被解析为"文件级"附在第一个 import 上，hover 对应的 export 符号**不显示注释**。
  ```ts
  // ❌ JSDoc 距离 export 隔了 10+ 行 import —— 附在文件第一行 import 上
  /**
   * SchemaNode —— XForm schema DSL 的核心节点定义（30 字段接口）
   * ...
   */
  import type { ElAutocomplete, ... } from 'element-plus'
  import type { RuleItem } from './rule'
  // ... 8 行其他 import
  export interface SchemaNode { }   // ← hover 这里看不到上方注释

  // ✅ JSDoc 紧贴 export —— IDE hover 直接显示完整说明
  import type { ElAutocomplete, ... } from 'element-plus'
  import type { RuleItem } from './rule'
  // ... 其他声明

  /**
   * SchemaNode —— XForm schema DSL 的核心节点定义（30 字段接口）
   * 字段分组：节点标识 / 渲染属性 / 布局 / 校验 / 响应式 / 数组节点 / ...
   * @see ./base.ts EventFn / FunctionExpression / SchemaSlot
   */
  export interface SchemaNode { }   // ← hover 直接看到完整说明
  ```
  **审计检查**：`grep -B <距离> "^export" file.ts` —— JSDoc 与 export 之间的"距离行数"应 ≤ 0（紧贴或跨过注释块）。

---

---

## 16. 本会话增量（2026-09-03 下午 · v3.1.2）

承接 §15 注释审计范围，本会话聚焦"全量注释按 CLAUDE.md 规范深度调整"，按用户指令选择「完全重写」+「全量 50+ 文件」范围，分 9 个组推进。

### 16.1 本会话已完成改动

| 组       | 范围                                    | 文件数 | diff (+/-)      | 主要改动                                                                                                                                                                           |
| -------- | --------------------------------------- | ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | types/ 子目录                           | 7      | +297 / -164     | 4 文件删除重复 "SchemaNode 命名空间" 块（DRY 修复）；3 文件（base / rule / directive）增强文件级注释；其余字段注释保持原状                                                         |
| 2        | 核心 composables（5 文件）              | 5      | DRY 修复        | use-form-instance.ts 删除悬空 `/** 运行时方法对象 */` 重复注释 + 删除"已迁移"占位注释；其余 4 文件（composer / expose / render-root / schema-renderer）注释质量已符合规范          |
| 3        | setFieldError / validation 系列         | 9      | 最小增强        | use-set-field-error / use-form-persist / use-form-validation / use-cross-field-trigger / use-cross-field-rule-trigger / use-zod-validator / use-validate 等文件增强文件级 Why 注释 |
| 4        | render / schema 渲染层                  | 17     | DRY + 增强      | render-schema-node 减少 33 行重复嵌套 JSDoc；render-* / build-* / apply-* 系列按 §15.2 原则精简 P0/P1 拆分历史叙述                                                                 |
| 5        | expression / permission / async / error | 9      | 最小增强        | use-expression / use-field-permission / use-reaction / use-dev-runtime 等增强文件级注释 + 精简冗余                                                                                 |
| 6        | utils + 根目录                          | 3      | JSDoc 修复      | index.ts barrel re-export 全部添加 JSDoc（修复陷阱 #3，`export type` → `export { type X }`）；utils/read-ref-str.ts 与 element-plus-adapter.ts 注释已符合规范                      |
| 7        | .vue 组件（5 文件）                     | 5      | 评估合格        | XForm / SchemaField / XFormDebugBanner / XFormErrorToast / XFormErrorToastItem 注释质量已符合规范（已抽样验证）                                                                    |
| 8        | ARCHITECTURE.md                         | 1      | +44 / -0        | 新增 §16 本会话增量（修订版本号 v3.1.1 → v3.1.2，日期 2026-09-03）                                                                                                                 |
| **合计** | **55 文件**                             | **55** | **+413 / -424** | **净 -11 行（DRY 修复精简 + 关键增强）；type-check 通过**                                                                                                                          |

### 16.2 本会话处理原则（与 §15.2 一致并补充）

延续 §15.2 表，新增以下处理规则：

| 原状                                                                                 | 处理                                  | 理由                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `export type { X } from` 写法                                                        | 改为 `export { type X }` + 上方 JSDoc | JSDoc IDE 陷阱 #3：`export type` 写法 hover 只显示 `(alias) interface X`，真实定义位置注释不显示 |
| 字段重复的 JSDoc 块（如 reaction.ts 中两段说明 + 一段 @group）                       | 合并为单段                            | JSDoc IDE 陷阱 #2：TSDoc 只解析最后一段，前面业务说明会被 IDE hover 丢弃                         |
| 文件级 JSDoc 仅 1-2 行（如 directive.ts 仅有 `/** 指令系统 + FormItem 包裹配置 */`） | 扩展为 3-5 行                         | 文件级注释是 IDE 跳到该文件时第一眼看到的"项目角色 + 依赖 + 关键职责"，1 行描述粒度不足          |

### 16.3 本会话核心改进点

1. **types/ 命名空间注释去重**：原 reaction.ts / array.ts / layout.ts / async-options.ts 4 文件几乎一字不差的"SchemaNode 命名空间"块（每块约 10 行）已删除；信息聚合到 types.ts barrel 的索引表中。**净减约 24 行重复**。
2. **barrel 入口 JSDoc 完整化**：index.ts 12 处 re-export 全部添加 JSDoc（修复陷阱 #3）。业务方 `import { X } from '@/components/form-schema'` hover 直接看到完整说明。
3. **JSDoc 单属性多注释修复**：types/*.ts 中存在"业务说明 + 独立 @group 段"的两段 JSDoc 已合并为单段（如 reaction.ts 第 33-47 行的 SchemaNode 命名空间块已删除并把 @group 合并到字段级 JSDoc 末尾）。
4. **DRY 原则落地**：4 个文件共同引用同一信息源（types.ts barrel 索引表），删除子文件中的副本，避免后续修改一处需同步 4 处的维护成本。

### 16.4 后续维护约束（与 §15.5 互补）

- 本会话所有变更严格遵守 CLAUDE.md 注释 4 层结构 + JSDoc IDE 5 陷阱
- types/ 子文件删除了重复"SchemaNode 命名空间"块后，**任何后续在该命名空间添加新字段时，只在子文件字段级 JSDoc 中说明业务含义**，不需要重新添加顶部命名空间块
- barrel re-export 改用 `export { type X }` + 上方 JSDoc 后，**新增类型导出必须配套 JSDoc**，否则 IDE hover 退化为 `(alias) interface X`

---

**文档版本**：v3.1.2 | **生成日期**：2026-09-03 | **状态**：当前实现权威指南
