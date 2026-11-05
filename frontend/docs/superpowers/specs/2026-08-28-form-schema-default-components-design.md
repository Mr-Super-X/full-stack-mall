# Form Schema 内置默认组件扩展设计

> 为 `XForm` 增加常用 Element Plus 表单组件的统一快捷名、运行时注册、类型推导和链式 builder。
> `InputPassword` 与 `InputTextArea` 是 XForm 快捷别名，不伪装成不存在的 Element Plus 组件。

| 属性 | 值 |
|---|---|
| 版本 | v1.0.0 |
| 日期 | 2026-08-28 |
| 状态 | 已完成设计评审，待实施 |
| Element Plus | 2.14.3 |
| 关联分支 | `feature/form-engine` |

---

## 1. 背景

`XForm` 当前通过 `DEFAULT_COMPONENT_MAP`、`EL_COMPONENT_MAP` 和 `ComponentPropsRegistry` 三处配置共同决定一个组件能否被解析、渲染和获得正确 props 类型。

当前 `DEFAULT_COMPONENT_PROPS` 只对支持清空能力的组件设置少量默认 props。虽然 Element Plus 2.14.3 已提供 `ElInputTag`、`ElMention`、`ElColorPicker` 和 `ElRate`，但 XForm 尚未把名称和类型注册到三个内部配置源，也没有 `InputPassword`、`InputTextArea` 这两个用户期望的快捷名称。

本设计统一扩展这六类输入体验：

- `InputPassword`
- `InputTextArea`
- `InputTag`
- `ColorPicker`
- `Mention`
- `Rate`

并把已有的 `InputNumber` 纳入 `BASE_DEFAULT_COMPONENT_PROPS`。

## 2. 依据

已直接核对项目安装的 Element Plus 2.14.3 类型声明：

- `ElInput` 存在，`InputProps` 支持 `type: 'password'` 和 `showPassword: true`。
- Element Plus 没有独立的 `ElInputPassword`。
- TextArea 是 `ElInput` 的 `type: 'textarea'` 模式。
- 存在 `ElInputTag`、`ElMention`、`ElColorPicker` 和 `ElRate`。
- `InputTag` 的 `modelValue` 为 `string[]`。
- `Mention` 的 `modelValue` 为 `string`。
- `ColorPicker` 的 `modelValue` 为 `string | null`。
- `Rate` 的 `modelValue` 为 `number`。

## 3. 目标

1. 六个新增快捷名都能通过 schema 的字符串 `component` 直接使用。
2. 对应的 `ElXxx` 全名解析到相同 Element Plus 组件。
3. `SchemaNodeFor<...>` 能推导组件真实 props 类型。
4. 六个链式 builder 能返回正确快捷名和 props。
5. 默认 props 不强制 ColorPicker、Mention、Rate 的业务偏好。
6. 节点级 props 始终覆盖内置默认 props。
7. 现有 `Input`、`InputNumber` 行为保持向后兼容。

## 4. 非目标

- 不新增第三方依赖。
- 不创建独立 wrapper 组件。
- 不新增 `asyncOptions` 分支；只有 Autocomplete 使用现有异步选项能力。
- 不修改 `XForm` 的 `v-model`、事件、校验、权限或响应式渲染核心。
- 不新增交互式 demo 页面；文档中提供使用示例。
- 不把 `InputPassword` 宣称为原生 `ElInputPassword`。
- 不强制 `InputNumber.min = 0`、ColorPicker 的透明度、Rate 的半星等业务偏好。

## 5. 组件映射

| 快捷名 | Element Plus 组件 | 默认 props | 典型 model 值 |
|---|---|---|---|
| `InputPassword` | `ElInput` | `{ type: 'password', showPassword: true }` | `string` |
| `InputTextArea` | `ElInput` | `{ type: 'textarea', showWordLimit: true }` | `string` |
| `InputTag` | `ElInputTag` | `{ clearable: true }` | `string[]` |
| `ColorPicker` | `ElColorPicker` | `{}` | `string \| null` |
| `Mention` | `ElMention` | `{}` | `string` |
| `Rate` | `ElRate` | `{}` | `number` |
| `InputNumber` | `ElInputNumber` | `{ controlsPosition: 'right' }` | 保持现有 |

`DEFAULT_COMPONENT_MAP` 同时提供 `InputPassword / ElInputPassword` 和 `InputTextArea / ElInputTextArea` 四种名称入口。它们都解析到 `ElInput`，`DEFAULT_COMPONENT_PROPS` 展开机制会为名称入口及 `ElInput` 目标复制同一组默认 props。

## 6. Builder 契约

新增以下链式工厂：

| builder | 组件名 | 行为 |
|---|---|---|
| `xInputPassword` | `InputPassword` | 使用 `ElInput` props 类型 |
| `xInputTextArea` | `InputTextArea` | 使用 `ElInput` props 类型 |
| `xInputTag` | `InputTag` | 使用 `ElInputTag` props 类型 |
| `xColorPicker` | `ColorPicker` | 使用 `ElColorPicker` props 类型 |
| `xMention` | `Mention` | 使用 `ElMention` props 类型 |
| `xRate` | `Rate` | 使用 `ElRate` props 类型 |

现有 `xTextarea` 继续绑定 `Input` 并保持公开兼容；它不删除、不改名，也不强制迁移用户。

## 7. 数据流

沿用 `render-schema-node.ts` 的现有通用分支：

```text
schema.component
  → resolveComponentFor / 组件类型注册
  → buildVModelBindings + buildOnBindings
  → getComponentDefaultProps
  → node.props
  → 异步组件专用 props（当前仅 Autocomplete）
  → node.disabled
```

合并优先级保持：

1. `v-model` 与 `node.on` 事件绑定先统一展开。
2. 内置默认 props 与 XForm 级 `componentProps` 按组件名合并；同名键由 XForm 配置覆盖。
3. 节点级 `props` 覆盖 XForm 级配置。
4. 异步组件专用 props 仅在支持的组件上追加。
5. 字段级 `disabled` 按现有约定执行。

`InputPassword` 节点可显式写 `props.type = 'text'`，覆盖密码默认类型；`showPassword`、placeholder、rows 等普通 Input props 可直接透传。

## 8. 类型设计

`types.ts` 从 `element-plus` 引入：

- `ElInput`
- `ElInputTag`
- `ElMention`
- `ElColorPicker`
- `ElRate`

新增与快捷名一一对应的 props 提取类型：

- `InputPassword` 和 `InputTextArea` 使用 `ElInputProps`。
- `InputTag` 使用 `ElInputTagProps`。
- `ColorPicker` 使用 `ElColorPickerProps`。
- `Mention` 使用 `ElMentionProps`。
- `Rate` 使用 `ElRateProps`。

`ComponentName` 因 `ComponentPropsRegistry` 声明合并自动扩展，`SchemaNodeFor` 和公开 builder 类型无需另建并行联合类型。

## 9. 文件清单

计划仅修改现有文件，不在 `src/` 下新增或移动文件：

- `src/components/form-schema/element-plus-adapter.ts`
- `src/components/form-schema/composables/render-schema-node.ts`
- `src/components/form-schema/types.ts`
- `src/components/form-schema/builders.ts`
- `src/components/form-schema/element-plus-adapter.spec.ts`
- `src/components/form-schema/composables/render-schema-node.spec.ts`
- `src/components/form-schema/types.types-derivation.test-d.ts`
- `src/components/form-schema/builders.spec.ts`
- `src/components/form-schema/README.md`
- `docs/24-XForm使用指南.md`
- `CHANGELOG.md`

`XForm.vue` 无需修改：它已经通过 `DEFAULT_COMPONENT_PROPS` 和 props 更新链路接收新增配置。

## 10. 错误与边界处理

- 六个快捷名和对应 `ElXxx` 全名必须加入内置组件白名单。
- 未知组件继续走现有校验与错误提示，不新增静默降级。
- Mention 缺少 `options` 时保持组件原生空下拉行为。
- ColorPicker 缺少 `predefine` 时保持组件原生行为。
- 本次不新增外部数据源、HTML 注入路径或动态脚本。
- 不改变现有 `beforeChange`、`on` 事件、permission、readonly、disabled 和 async-validator 行为。

## 11. 测试设计

### 11.1 适配层测试

`element-plus-adapter.spec.ts` 验证：

- 六个快捷名解析到正确 `ElXxx` 名称。
- `ElInputPassword`、`ElInputTextArea` 解析到 `ElInput`。
- 默认 props 包含 `InputNumber`、密码、文本域和 InputTag 配置。
- ColorPicker、Mention、Rate 不产生额外内置默认 props。

### 11.2 渲染与数据流测试

`render-schema-node.spec.ts` 与 `XForm.spec.ts` 验证：

- 快捷名解析为预期组件。
- `InputPassword` 默认 `type` 和 `showPassword`。
- `InputTextArea` 默认 `type`。
- `InputTag` 接收并写回 `string[]`。
- ColorPicker 接收并写回 `string | null`。
- Mention 接收并写回 `string`。
- Rate 接收并写回 `number`。
- 节点 props 覆盖默认 props。
- 自定义 `components` 注册仍保持最高优先级。

### 11.3 类型测试

`types.types-derivation.test-d.ts` 验证六个 `SchemaNodeFor` 示例均能正确推导：

- `showPassword`、`type: 'textarea'`
- `max`
- `predefine`
- `options`
- `allowHalf`

### 11.4 Builder 测试

`builders.spec.ts` 验证六个 builder 的返回对象：

- `component` 快捷名正确。
- `name` 正确。
- props 类型在 TypeScript 编译期可被正确接受。

### 11.5 回归验证

执行：

- 定向 Vitest 测试。
- `pnpm test`
- `pnpm test:coverage`
- `pnpm type-check:full`
- `pnpm lint`
- `pnpm build`

## 12. 手动验收

1. 启动 dev server，进入 XForm 基础示例或临时 schema 调试区。
2. 输入 `InputPassword` 节点，确认初始为隐藏密码且可切换可见。
3. 输入 `InputTextArea` 节点，确认渲染文本域并同步字符串。
4. 输入 `InputTag` 节点，确认标签新增/删除同步数组。
5. 输入 `ColorPicker` 节点，确认颜色选择和 `null`/字符串同步。
6. 输入 `Mention` 节点，确认 `options` 下拉和文本同步。
7. 输入 `Rate` 节点，确认 0～5 的 number 值同步。
8. 覆盖各节点默认 props，确认节点级值生效。
9. 回归 Input、InputNumber、Select、DatePicker、Switch 等现有字段。

## 13. 回退方式

本次不改变目录结构，不新增依赖，不修改渲染核心。回退时按单个文件恢复即可；优先级建议依次为：

1. 恢复 `builders.ts` 和 `types.ts`，移除公开入口。
2. 恢复 `element-plus-adapter.ts` 和 `render-schema-node.ts`。
3. 恢复测试、文档与 CHANGELOG。

恢复后重新运行 XForm 定向测试、类型检查和构建即可验证回退完整。
