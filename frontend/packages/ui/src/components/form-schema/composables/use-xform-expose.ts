/**
 * use-xform-expose —— XFormExpose 19 个方法聚合
 *
 * 从 useXFormComposer 抽离：el-form 实例方法 / 校验 / 字段错误 / 数组操作 / dirty / schema 元数据 / 服务端错误。
 * exposed 对象键集与顺序保持一致（XFormExpose 定义）。
 *
 * @group 表单编排：对外接口
 */
import type { XFormExpose } from '../types'

/**
 * useXFormExpose 入参 —— XFormExpose 19 方法的来源
 *
 * 所有方法均来自 useXFormComposer 装配的各个子 composable（el-form 实例 / 校验 / dirty / 服务端错误等）
 */
export interface UseXFormExposeDeps {
  /** el-form 实例方法（来自 useFormInstance） */
  getRef: XFormExpose['getRef']
  clearValidate: XFormExpose['clearValidate']
  resetFields: XFormExpose['resetFields']
  validateField: XFormExpose['validateField']
  scrollToField: XFormExpose['scrollToField']
  validateFormWithZod: XFormExpose['validateWithZod']
  setFieldError: XFormExpose['setFieldError']
  setFieldValidating: XFormExpose['setFieldValidating']
  /** 数组操作（来自 useFormInstance） */
  addItem: XFormExpose['addItem']
  removeItem: XFormExpose['removeItem']
  moveItem: XFormExpose['moveItem']
  /** 校验编排（来自 useFormValidation） */
  validateForm: XFormExpose['validate']
  validateDetail: XFormExpose['validateDetail']
  /** schema 元数据 */
  getNames: XFormExpose['getNames']
  /** dirty 状态（来自 useFormDirty） */
  isDirty: XFormExpose['isDirty']
  getDirtyFields: XFormExpose['getDirtyFields']
  isTouched: XFormExpose['isTouched']
  resetDirty: XFormExpose['resetDirty']
  /** 服务端错误（来自 useServerError） */
  validateFromServer: XFormExpose['validateFromServer']
}

/**
 * 构造 XFormExpose —— 19 个方法聚合
 *
 * 顺序与 use-xform-composer.ts 拆分前保持一致，便于对照验证。
 */
export function useXFormExpose(deps: UseXFormExposeDeps): XFormExpose {
  return {
    getRef: deps.getRef,
    getNames: deps.getNames,
    validate: deps.validateForm,
    validateDetail: deps.validateDetail,
    clearValidate: deps.clearValidate,
    resetFields: deps.resetFields,
    validateField: deps.validateField,
    scrollToField: deps.scrollToField,
    validateWithZod: deps.validateFormWithZod,
    setFieldError: deps.setFieldError,
    setFieldValidating: deps.setFieldValidating,
    addItem: deps.addItem,
    removeItem: deps.removeItem,
    moveItem: deps.moveItem,
    isDirty: deps.isDirty,
    getDirtyFields: deps.getDirtyFields,
    isTouched: deps.isTouched,
    resetDirty: deps.resetDirty,
    validateFromServer: deps.validateFromServer,
  }
}
