# ProDialogForm 高级弹窗表单使用指南

> **文档版本**：v1.0.0 | **最后更新**：2026-09-17
> **覆盖范围**：`<ProDialogForm>` —— ProDialog + XForm 的弹窗表单组合（含内置校验 → 提交 → 自动关闭 → 关闭重置）
> **源码位置**：`packages/ui/src/components/common/ProDialogForm/`

---

## 📋 概述

`ProDialogForm` 是项目中**最常用**的弹窗表单模式封装，针对以下场景：

- 新增 / 编辑业务数据弹窗（90% 用例）
- 内置 XForm 校验 → 异步提交 → 成功自动关闭 → 关闭后延时重置（无闪烁）
- 内置防重复提交 + loading 状态
- 透传 ProDialog 原生 attrs（width / close-on-click-modal / before-close 等）

**典型场景**：用户管理（新增 / 编辑弹窗）、订单管理（状态变更弹窗）、配置项管理（编辑表单弹窗）。

---

## 1. 与 ProDialog / useDialog 的对比

| 能力            | `<ProDialog>` | `useDialog(Comp)` | **`<ProDialogForm>`**           |
| --------------- | ------------- | ----------------- | ------------------------------- |
| 弹窗基础能力    | ✅            | ✅                | ✅（内部封装）                  |
| 表单校验        | ❌ 自行实现   | 自行实现          | **✅ 内置 XForm 校验**          |
| 提交 → 自动关闭 | ❌            | ❌                | **✅**                          |
| 关闭后重置      | ❌            | ❌                | **✅**（动画结束后延时重置）    |
| 防重复提交      | ❌            | ❌                | **✅**                          |
| Loading 按钮    | ❌            | ❌                | **✅**                          |
| schema 复用     | ❌            | ❌                | **✅**（XForm schema 直接传入） |

> **结论**：表单弹窗场景**优先用 `ProDialogForm`**，自定义弹窗（非表单）用 `ProDialog` / `useDialog`。

---

## 2. Props / Emits

### 2.1 Props

| Prop               | 类型                          | 默认值    | 说明                                                          |
| ------------------ | ----------------------------- | --------- | ------------------------------------------------------------- |
| `modelValue`       | `boolean`                     | —         | v-model 显隐控制                                              |
| `title`            | `string`                      | —         | 弹窗标题                                                      |
| `schema`           | `SchemaNode \| SchemaNode[]`  | —         | XForm schema（详见 `docs/24-XForm使用指南.md`）               |
| `model`            | `Record<string, unknown>`     | —         | 表单响应式数据（**必须 `reactive()` 包装**）                  |
| `onSubmit`         | `(model) => Promise<unknown>` | —（必填） | 提交回调：resolve = 成功自动关闭 / reject = 触发 submitFailed |
| `rules`            | `Record<string, RuleItem>`    | `{}`      | 命名规则引用（XForm 的 `rules` prop）                         |
| `width`            | `string \| number`            | `'500px'` | 弹窗宽度                                                      |
| `submitButtonText` | `string`                      | `'确 定'` | 提交按钮文案                                                  |
| `cancelButtonText` | `string`                      | `'取 消'` | 取消按钮文案                                                  |
| `resetOnClose`     | `boolean`                     | `true`    | 关闭后是否重置表单（动画结束 300ms 后）                       |
| `xformProps`       | `Partial<XFormProps>`         | —         | XForm 扩展 props 透传入口（见下方说明）                       |

> **XForm 能力透传**：ProDialogForm 显式 props 只覆盖 XForm 的主数据契约（`schema` / `model` / `rules`），
> 其余 XForm 能力 —— `components`（自定义组件）/ `zodSchema` / `beforeChange` / `directives` /
> `componentProps` / `expressionFunctions` / `permissionResolver` / `showErrorToast` / `scrollToError`
> 等 —— 统一经 `xformProps` 透传。同名键优先级：显式 props > `xformProps`。
>
> ```ts
> <ProDialogForm
>   v-model="visible"
>   title="编辑用户"
>   :schema="schema"
>   :model="form"
>   :on-submit="handleSubmit"
>   :xform-props="{ showErrorToast: true, scrollToError: true, components: { MyInput } }"
> />
> ```

### 2.2 Emits

| Event               | 参数               | 说明                                          |
| ------------------- | ------------------ | --------------------------------------------- |
| `update:modelValue` | `(value: boolean)` | v-model 双向绑定（提交成功会自动 emit false） |
| `success`           | —                  | 提交成功回调（弹窗已自动关闭）                |
| `submitFailed`      | `(error: unknown)` | 提交失败回调（弹窗不关闭，等待用户修复）      |

### 2.3 Slots

| Slot      | Scope                         | 说明                                                      |
| --------- | ----------------------------- | --------------------------------------------------------- |
| `default` | —                             | 在表单之后插入额外内容（分隔线 / 说明文字）               |
| `footer`  | `{ submit, cancel, loading }` | 自定义底部按钮（暴露 submit / cancel / loading 三个回调） |

---

## 3. 暴露方法（`defineExpose`）

通过 `buildXFormExposeProxy` 透传 XFormExpose **19 个方法**（详见 `docs/24-XForm使用指南.md` §3）：

| 分类       | 方法                                                                            |
| ---------- | ------------------------------------------------------------------------------- |
| 校验       | `validate()` / `validateDetail()` / `validateField(name)` / `validateWithZod()` |
| 清理       | `clearValidate(names?)` / `resetFields(names?)`                                 |
| 滚动       | `scrollToField(name)`                                                           |
| 字段错误   | `setFieldError(name, message, state?)` / `setFieldValidating(name)`             |
| 数组节点   | `addItem(name, init)` / `removeItem(name, index)` / `moveItem(name, from, to)`  |
| 脏状态     | `isDirty()` / `isTouched(name)` / `getDirtyFields()` / `resetDirty()`           |
| 引用       | `getRef(key)` / `getNames(includesIgnore)`                                      |
| 服务端校验 | `validateFromServer(response)`                                                  |

> **实现机制**：`buildXFormExposeProxy` 用显式对象字面量（**不是 Proxy**），每个方法是真实函数，formRef 为 null 时函数体直接返回 undefined，调用方 `?.method()` 可选链短路。

---

## 4. 集成示例

### 4.1 基础用法（新增 / 编辑弹窗）

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import ProDialogForm from '@vv/ui/components/common/ProDialogForm/ProDialogForm.vue' // 或由 unplugin 自动注册，模板免 import
import type { SchemaNode } from '@vv/ui/components/form-schema/types'

const visible = ref(false)
const form = reactive({})

const schema: SchemaNode[] = [
  {
    component: 'Input',
    name: 'username',
    label: '账号',
    rules: [{ required: true, message: '请输入账号' }],
  },
  {
    component: 'Input',
    name: 'email',
    label: '邮箱',
    rules: [{ required: true, type: 'email', message: '邮箱格式错误' }],
  },
]

async function handleSubmit(data: Record<string, unknown>) {
  await userApi.create(data)
  ElMessage.success('保存成功')
}
</script>

<template>
  <el-button @click="visible = true">新增用户</el-button>
  <ProDialogForm
    v-model="visible"
    title="新增用户"
    :schema="schema"
    :model="form"
    :on-submit="() => handleSubmit(form)"
  />
</template>
```

> 注意：`on-submit` 是 ProDialogForm 的 prop（**新增**），不是 `<el-form>` 的 `@submit`。

### 4.2 监听 success / submitFailed

```vue
<ProDialogForm
  v-model="visible"
  title="编辑用户"
  :schema="schema"
  :model="form"
  :on-submit="() => userApi.update(form)"
  @success="() => ElMessage.success('已保存')"
  @submit-failed="(err) => ElMessage.error(`保存失败：${String(err)}`)"
/>
```

### 4.3 自定义 footer（带「保存并继续」按钮）

```vue
<ProDialogForm v-model="visible" :schema="schema" :model="form">
  <template #footer="{ submit, cancel, loading }">
    <el-button @click="cancel">取 消</el-button>
    <el-button :loading="loading" @click="handleSaveAndAddNew(submit)">
      保存并新增下一条
    </el-button>
    <el-button type="primary" :loading="loading" @click="submit">
      确 定
    </el-button>
  </template>
</ProDialogForm>
```

```typescript
async function handleSaveAndAddNew(submit: () => Promise<void>) {
  await submit()
  // 成功提交后清空表单，准备新增下一条
  Object.assign(form, { username: '', email: '' })
}
```

### 4.4 与 `useDialog` 命令式结合（动态唤起）

```typescript
import { useDialog } from '@vv/ui/composables/useDialog' // AutoImport 也可省略
import ProDialogForm from '@vv/ui/components/common/ProDialogForm/ProDialogForm.vue'

const editDialog = useDialog(ProDialogForm, {
  title: '编辑用户',
  schema: userSchema,
  model: userForm,
})

async function handleEdit(userId: number) {
  await userApi.getDetail(userId).then((data) => Object.assign(userForm, data))
  try {
    await editDialog.open() // 提交成功 resolve
    ElMessage.success('保存成功')
  } catch (e) {
    // 用户取消静默
  }
}
```

---

## 5. 关键设计决策

### 5.1 防重复提交（双重保护）

- **UI 层**：提交按钮 `:loading="submitLoading"`，按下后立即禁用
- **逻辑层**（`useDialogSubmit`）：`if (submitLoading.value) return` 兜底，程序化触发 `handleSubmit()` 也会被拦截
- **finally 复位**：无论成功失败，loading 都会复位（不然下次点不了）

### 5.2 不抛错误（避免 500 重定向）

```typescript
catch (err) {
  // ❌ throw err → 冒泡到全局 errorHandler → 500 重定向
  // ✅ 调用方监听 @submit-failed 自行处理
  emit('submitFailed', err)
}
```

业务方通过 `@submit-failed` 自行决定是 ElMessage 提示 / scrollToError / 表单回填错误等，不污染全局错误流。

### 5.3 关闭后延时重置（无闪烁）

- 时序：`@close` 事件触发 → `setTimeout(reset, 300)` → 在 EP 关闭动画结束（`display: none`）后重置表单
- 效果：用户看到的不是「数据瞬间清零」，而是「弹窗消失后下次打开是空白」
- 重入保护：短时间内多次触发 close 时清理已有 timer，不堆积多次 reset
- 生命周期清理：`onUnmounted` 中 `clearTimeout`，避免访问已卸载的 ref

### 5.4 getter 而非闭包 props

```typescript
// ❌ onSubmit: () => props.onSubmit(props.model) — props 变化时仍持有旧值
// ✅ onSubmit: () => props.onSubmit(props.model) — getter 形式保留响应式追踪
```

`useDialogSubmit` / `useResetOnClose` 都用 getter（`() => formRef.value` / `() => props.resetOnClose`），保留响应式同时让单测可直接传 mock。

---

## 6. 测试覆盖

| 文件                      | 用例数 | 覆盖范围                                   |
| ------------------------- | ------ | ------------------------------------------ |
| `useDialogSubmit.spec.ts` | 5      | 防重复 + 失败 loading 复位 + 不抛 err      |
| `useResetOnClose.spec.ts` | 5      | 延时重置 + 重入保护 + onUnmounted 清 timer |

完整 demo 站：`apps/docs/src/modules/demo/examples/ProDialogForm/ProDialogFormOverview.vue` 单 demo（基础用法 + 自定义 footer + 命令式 useDialog 集成三类场景在同一文件内分章节演示），路由 `/demo/pro-dialog-form-overview`。

---

## 7. 相关文档

- 组件源码：`packages/ui/src/components/common/ProDialogForm/ProDialogForm.vue`
- 组合式：`packages/ui/src/components/common/ProDialogForm/composables/useDialogSubmit.ts` + `useResetOnClose.ts` + `buildXFormExposeProxy.ts`
- XForm 文档：[`docs/24-XForm使用指南.md`](24-XForm使用指南.md)（schema / 暴露方法定义）
- ProDialog 文档：[`docs/27-ProDialog使用指南.md`](27-ProDialog使用指南.md)（基础弹窗能力）
- useDialog 命令式：[`docs/27-ProDialog使用指南.md`](27-ProDialog使用指南.md) §3
