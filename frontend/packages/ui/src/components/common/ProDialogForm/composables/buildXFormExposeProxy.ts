/**
 * buildXFormExposeProxy —— defineExpose 代理工厂
 *
 * 把 19 个 XFormExpose 方法的「转发样板代码」收敛到一处,主组件 defineExpose 一行调用。
 *
 * 安全性 vs 简洁性权衡:
 * - 不用 Proxy:因为 Proxy 的 get 拦截在 formRef 为 null 时返回 undefined,
 *   调用方 `proDialogFormRef.value.setFieldError` 拿到 undefined 后 .() 才报错,
 *   错误信息是 "xxx is not a function",定位困难。
 * - 改用显式对象字面量:每个方法都是真实函数,formRef 为 null 时函数体直接返回 undefined,
 *   调用方拿到 undefined 后通过可选链 `?.setFieldError()` 自然短路,符合 Vue 习惯。
 *
 * @see [`../ProDialogForm.vue`](../ProDialogForm.vue) 消费方
 * @group 通用组件:ProDialogForm
 */
import type { XFormExpose } from '../../../form-schema/types.ts'

/**
 * 构造 XFormExpose 代理 —— 每个方法透传到 getFormRef()() 的同名方法。
 * @param getFormRef 取 XForm 实例的 getter(用 () => formRef.value 解耦响应式)
 */
export function buildXFormExposeProxy(
  getFormRef: () => XFormExpose | null | undefined
): XFormExpose {
  const ref = getFormRef
  return {
    getRef: ((key) => ref()?.getRef(key)) as XFormExpose['getRef'],
    getNames: ((includesIgnore) => ref()?.getNames(includesIgnore)) as XFormExpose['getNames'],
    validate: (() => ref()?.validate()) as XFormExpose['validate'],
    validateDetail: (() => ref()?.validateDetail()) as XFormExpose['validateDetail'],
    clearValidate: (() => ref()?.clearValidate()) as XFormExpose['clearValidate'],
    resetFields: ((names) => ref()?.resetFields(names)) as XFormExpose['resetFields'],
    validateField: ((name) => ref()?.validateField(name)) as XFormExpose['validateField'],
    scrollToField: ((name) => ref()?.scrollToField(name)) as XFormExpose['scrollToField'],
    validateWithZod: (() => ref()?.validateWithZod()) as XFormExpose['validateWithZod'],
    setFieldError: ((name, message, state) =>
      ref()?.setFieldError(name, message, state)) as XFormExpose['setFieldError'],
    setFieldValidating: ((name) =>
      ref()?.setFieldValidating(name)) as XFormExpose['setFieldValidating'],
    addItem: ((name, init) => ref()?.addItem(name, init)) as XFormExpose['addItem'],
    removeItem: ((name, index) => ref()?.removeItem(name, index)) as XFormExpose['removeItem'],
    moveItem: ((name, from, to) => ref()?.moveItem(name, from, to)) as XFormExpose['moveItem'],
    isDirty: (() => ref()?.isDirty() ?? false) as XFormExpose['isDirty'],
    getDirtyFields: (() => ref()?.getDirtyFields() ?? []) as XFormExpose['getDirtyFields'],
    isTouched: ((name) => ref()?.isTouched(name) ?? false) as XFormExpose['isTouched'],
    resetDirty: (() => ref()?.resetDirty()) as XFormExpose['resetDirty'],
    validateFromServer: ((response) =>
      ref()?.validateFromServer(response) ?? 0) as XFormExpose['validateFromServer'],
  }
}
