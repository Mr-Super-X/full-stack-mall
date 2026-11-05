# Type Cast Audit —— XForm 类型断言归因表

> 集中登记 `src/components/form-schema/` 下所有 `as never` / `as any` / `as unknown` 类型断言的根因。
> 维护者查 cast 归因不必翻每个文件头部 JSDoc，到本文档查根因编号 → 跳到具体文件行。
>
> **2026-09-01 首次建立**：运行时 cast 总数 85 处，按 9 个根因编号（C1-C9）分类。
>
> **2026-09-04 更新**：XForm.vue:30 唯一生产代码 `as any` 改用 `Record<string, unknown>`（C1 根因修复），生产代码 cast 总数降至 84 处；测试代码（*.spec.ts）的 `as any` 不计入。

---

## 总览

| 根因编号 | 根因描述                                                                                          | 替代方案                                        | 优先级 |
| -------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------ |
| **C1**   | element-plus buildProp 类型元组在 vue 模板 / h() 调用推导失败                                     | 等待 element-plus 3.0 类型系统重写              | P2     |
| **C2**   | `SchemaNode.children` 多态（`SchemaNode \| SchemaNode[] \| string \| undefined`），TS narrow 失败 | schema 校验已拦截非法形态，运行时安全           | 接受   |
| **C3**   | element-plus 2.x 内部 ref-like 字段（validateState/validateMessage/fieldValue/propString）        | 等待 element-plus 3.0 重构 setFieldError 路径 B | P2     |
| **C4**   | `ComputedRef<XFormProps['model']>` 转 `Ref<Record<string, unknown>>` 类型偏离                     | 实际运行时是 reactive 对象，类型契约小幅偏离    | 接受   |
| **C5**   | `setExpressionFunctions` 入参故意宽松（`fn: any`）                                                | 设计意图：允许业务注入任何函数形态              | 接受   |
| **C6**   | `renderToComponent` 返回 `VNode \| string \| VNode[] \| undefined` 多态统一对外                   | 上层 `RenderFn` 签名对齐需要                    | 接受   |
| **C7**   | vue 3.5 Conditional 类型 narrowing 在多层 `NonNullable` 后不完整                                  | 等待 vue 3.6+ 改善 Conditional narrowing        | P2     |
| **C8**   | lodash-es `set/get` 对动态字符串路径访问                                                          | 类型不可推导，运行时安全                        | 接受   |
| **C9**   | element-plus el-form 内部 `fields` 数组类型声明不完整                                             | 等待 element-plus 3.0 重构                      | P2     |

---

## 文件级分布（运行时 cast，排除 .spec.ts）

| 文件                                     | cast 数 | 主要根因       |
| ---------------------------------------- | ------: | -------------- |
| `composables/render-array-node.ts`       |      26 | C1, C2         |
| `composables/render-form-item.ts`        |      12 | C1             |
| `composables/render-schema-node.ts`      |      10 | C1, C2, C7     |
| `composables/use-xform-composer.ts`      |       8 | C4, C5, C6, C8 |
| `composables/use-form-instance.ts`       |       7 | C3, C9         |
| `composables/render-with-grid.ts`        |       7 | C1             |
| `composables/render-visual-container.ts` |       5 | C2             |
| `composables/wrap-with-elcol.ts`         |       3 | C7             |
| `composables/use-schema-renderer.ts`     |       2 | C4             |
| `composables/build-slots.ts`             |       2 | C2             |
| `composables/use-form-validation.ts`     |       1 | C3             |
| `composables/use-cross-field-trigger.ts` |       1 | C9             |
| `composables/with-hidden.ts`             |       1 | C2             |
| **合计**                                 |  **85** | —              |

---

## 各根因明细

### C1 — element-plus buildProp 类型元组缺陷（~39 处）

**根因**：element-plus 组件 props 通过 `buildProp` 工具构造（`type/required/validator/__epPropKey` 元组），vue 模板表达式和 `h()` 函数调用推导时无法解开元组，导致 TS 报错。

**涉及文件 / 位置**：

- `render-array-node.ts`：`h(ElCol, ...)`、`h(ElFormItem, ...)`、`h(ElRow, ...)` 等（~20 处）
- `render-form-item.ts`：`h(ElFormItem, ...)` 等（~10 处）
- `render-schema-node.ts`：`h(ElCol, ...)` 等（~5 处）
- `render-with-grid.ts`：`h(ElCol, ...)` 等（~5 处）

**运行时安全**：ElRow/ElCol/ElFormItem 内部校验 props 类型，cast 不引入运行时风险。

**替代方案**：等待 element-plus 3.0 重写类型系统（已规划 P2-1）。在此之前保留 cast。

#### C1 已删除：XForm.vue elConfig

- 文件：`XForm.vue`（2026-09-18 移除内层 ElConfigProvider 包裹时一并删除）
- 原写法（历史）：`{ locale: zhCn, size: 'default' } as any`（全局 §1.5 违规）
- 中间形态：`{ locale: zhCn, size: 'default' }: Record<string, unknown>`
- 触发场景（历史）：`<ElConfigProvider v-bind="elConfig">`
- 现状：XForm 模板根改为单个原生 div（locale 继承 App.vue 全局 ElConfigProvider、
  size 直接绑 ElForm.size），elConfig 与对应 cast 场景均已不存在

---

### C2 — `SchemaNode.children` 多态（~15 处）

**根因**：`SchemaNode.children` 类型为 `SchemaNode | SchemaNode[] | string | undefined`，TS 模板表达式 narrow 失败（业务上不可能误用，schema 校验在 XFormDebugBanner 阶段拦截）。

**涉及文件 / 位置**：

- `render-schema-node.ts`：`buildSlotFn(...)()`、`renderChildren(...)` 等
- `build-slots.ts`：`renderChildren` 调用
- `render-visual-container.ts`：children 多态
- `with-hidden.ts`：children 透传

**运行时安全**：schema 校验（`use-validate.ts`）已拦非法形态，cast 仅为 TS 推导。

**替代方案**：保持原状——可考虑未来重写 `SchemaNode.children` 为 discriminated union（`{ kind: 'node', value: SchemaNode }` vs `{ kind: 'text', value: string }`），但收益有限。

---

### C3 — element-plus 2.x 内部 ref-like 字段（~8 处）

**根因**：element-plus 2.x 内部 field 状态是 `ref<string>`（`validateState` / `validateMessage` / `fieldValue` / `propString`），TS 类型声明为 `string`；需运行时解包。

**涉及文件 / 位置**：

- `use-form-instance.ts`：`extractFieldName` / `readRefStr` / `collectElFieldErrors`（~6 处）
- `use-form-validation.ts`：`validateForm` 内 `ef.fields` 扫描（~2 处）

**运行时安全**：已通过 `readRefStr` 工具函数统一处理 ref-like 与普通 string 两种形态。

**替代方案**：等待 element-plus 3.0 重构 setFieldError 路径 B（`use-set-field-error.ts`）。

---

### C4 — `ComputedRef` 转 `ref` 类型偏离（~6 处）

**根因**：`ComputedRef<XFormProps['model']>` 转 `Ref<Record<string, unknown>>` 推导失败；实际运行时是 reactive 对象（vue ref 推断在 schema 边界不完整）。

**涉及文件 / 位置**：

- `use-xform-composer.ts`：`computed(() => props.components) as never`、`computed(() => props.model ?? {}) as never`
- `use-schema-renderer.ts`：schema/options/formData 注入（2 处）

**运行时安全**：vue computed 返回的 ref 在内部跨 composable 传递时实际是 reactive 对象。

**替代方案**：保持原状——类型契约小幅偏离，运行等价。

---

### C5 — `setExpressionFunctions` 入参故意宽松（1 处）

**根因**：`setExpressionFunctions(fns)` 入参类型故意用 `as never`，允许业务注入任何函数形态（包括箭头函数、命名函数、async 函数）。

**涉及位置**：`use-xform-composer.ts`：`setExpressionFunctions(fns as never)`

**运行时安全**：沙箱内 `new Function('model', '__rest', ...)` 创建独立函数作用域，不污染闭包。

**替代方案**：保持原状（设计意图）。

---

### C6 — `renderToComponent` 多态返回（1 处）

**根因**：`renderToComponent` 返回 `VNode | string | VNode[] | undefined` 多态，对外统一签名需要 `as never`。

**涉及位置**：`use-xform-composer.ts`：内部 `renderInner(node)` 返回值。

**替代方案**：保持原状（上层 `RenderFn` 签名对齐需要）。

---

### C7 — vue 3.5 Conditional narrowing 不完整（~6 处）

**根因**：`ColConfig.responsive` 已是 `NonNullable`，但 vue 3.5 Conditional 类型推导在多层 `NonNullable` narrowing 上不完整，导致 cast 不可避免。

**涉及文件 / 位置**：

- `render-schema-node.ts`：`pickBreakpointConfig(responsive as never, current)`
- `wrap-with-elcol.ts`：`mergeColResponsive` / `mergeRowResponsive` 内部（约 3 处）
- `render-with-grid.ts`：pickBreakpointConfig 调用（约 2 处）

**运行时安全**：vue 模板运行时校验响应式配置，cast 仅为 TS 推导。

**替代方案**：等待 vue 3.6+ 改善 Conditional narrowing。

---

### C8 — lodash-es `set/get` 动态路径（~5 处）

**根因**：`set(model, node.name, final)` 与 `get(model, dep)` 走 lodash-es，TS 对动态字符串路径无法推导。

**涉及位置**：`use-xform-composer.ts`：applyDefaults、`build-vmodel-bindings.ts`、`use-cross-field-trigger.ts` 等。

**运行时安全**：lodash-es 内部校验路径格式，运行时无异常。

**替代方案**：保持原状。

---

### C9 — element-plus el-form 内部 `fields` 类型不完整（~2 处）

**根因**：element-plus el-form 内部 `fields` 数组类型声明不完整（实际有 `propString` / `validateState` / `validateMessage` 等运行时字段），需 `as unknown as ...` 强转。

**涉及位置**：

- `use-form-instance.ts`：`getFields()` 返回值
- `use-cross-field-trigger.ts`：fields 扫描

**替代方案**：等待 element-plus 3.0 重构。

---

## 维护约定

1. **新增 cast 时**：
   - 在本文件对应根因（C#）的"涉及位置"小节加一行（含文件 / 行号）
   - 在代码 `as never` / `as any` 上方加一行短注释 `// cast C#（详见 TYPE-CAST-AUDIT.md）`
2. **根因消除时**（如 element-plus 升级）：
   - 从本文件移除对应条目
   - 删除代码短注释 + `as never`
3. **每月 review**：跑 `grep -rn "as never\|as any\|as unknown" src/components/form-schema/composables --include="*.ts"` 确认新增 cast 已登记

---

## 验证脚本

```bash
# 运行时 cast 总数（应 ≈ 85，偏差 ±5 内算正常）
find src/components/form-schema/composables -name "*.ts" ! -name "*.spec.ts" \
  -exec grep -c "as never\|as any\|as unknown" {} + \
  | awk -F: '{sum+=$2} END {print sum}'
```

---

**文档版本**：v1.0.0 | **生成日期**：2026-09-01 | **状态**：首次建立（P0-3）
