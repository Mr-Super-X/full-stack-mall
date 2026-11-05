/**
 * useXFormExpose 单元测试
 *
 * 覆盖：
 * - 返回 XFormExpose 全量 19 个方法
 * - 每个方法透传到底层 deps（不修改签名/行为）
 * - 方法引用一致（同 deps.fn 应是同一引用）
 */
import { describe, it, expect } from 'vitest'
import { useXFormExpose } from './use-xform-expose'

describe('useXFormExpose', () => {
  // 工具：构造全量 deps mock（19 个方法都填一个 stub）
  function makeDeps() {
    return {
      getRef: () => null,
      clearValidate: () => undefined,
      resetFields: () => undefined,
      validateField: async () => true,
      scrollToField: () => undefined,
      validateFormWithZod: () => ({ success: true, errors: null }),
      setFieldError: () => undefined,
      setFieldValidating: () => undefined,
      addItem: () => undefined,
      removeItem: () => undefined,
      moveItem: () => undefined,
      validateForm: async () => true,
      validateDetail: async () => ({ isValid: true, errors: [] }),
      getNames: () => [],
      isDirty: () => false,
      getDirtyFields: () => [],
      isTouched: () => false,
      resetDirty: () => undefined,
      validateFromServer: () => 0,
    }
  }

  it('返回 XFormExpose 全量 19 个方法', () => {
    const deps = makeDeps()
    const exposed = useXFormExpose(deps)
    const expectedKeys = [
      'getRef',
      'getNames',
      'validate',
      'validateDetail',
      'clearValidate',
      'resetFields',
      'validateField',
      'scrollToField',
      'validateWithZod',
      'setFieldError',
      'setFieldValidating',
      'addItem',
      'removeItem',
      'moveItem',
      'isDirty',
      'getDirtyFields',
      'isTouched',
      'resetDirty',
      'validateFromServer',
    ]
    for (const k of expectedKeys) {
      expect(exposed).toHaveProperty(k)
      expect(typeof (exposed as unknown as Record<string, unknown>)[k]).toBe('function')
    }
    expect(Object.keys(exposed)).toHaveLength(19)
  })

  it('方法透传：每个返回字段引用 === deps 对应字段', () => {
    const deps = makeDeps()
    const exposed = useXFormExpose(deps)
    // 19 个字段逐一比对（XFormExpose key 顺序与 deps 略有差异，逐个映射）
    expect(exposed.getRef).toBe(deps.getRef)
    expect(exposed.getNames).toBe(deps.getNames)
    expect(exposed.validate).toBe(deps.validateForm)
    expect(exposed.validateDetail).toBe(deps.validateDetail)
    expect(exposed.clearValidate).toBe(deps.clearValidate)
    expect(exposed.resetFields).toBe(deps.resetFields)
    expect(exposed.validateField).toBe(deps.validateField)
    expect(exposed.scrollToField).toBe(deps.scrollToField)
    expect(exposed.validateWithZod).toBe(deps.validateFormWithZod)
    expect(exposed.setFieldError).toBe(deps.setFieldError)
    expect(exposed.setFieldValidating).toBe(deps.setFieldValidating)
    expect(exposed.addItem).toBe(deps.addItem)
    expect(exposed.removeItem).toBe(deps.removeItem)
    expect(exposed.moveItem).toBe(deps.moveItem)
    expect(exposed.isDirty).toBe(deps.isDirty)
    expect(exposed.getDirtyFields).toBe(deps.getDirtyFields)
    expect(exposed.isTouched).toBe(deps.isTouched)
    expect(exposed.resetDirty).toBe(deps.resetDirty)
    expect(exposed.validateFromServer).toBe(deps.validateFromServer)
  })

  it('validate 字段绑定到 validateForm（不是 validateDetail）', () => {
    const validateForm = async () => false
    const deps = { ...makeDeps(), validateForm }
    const exposed = useXFormExpose(deps)
    expect(exposed.validate).toBe(validateForm)
    expect(exposed.validate).not.toBe(deps.validateDetail)
  })

  it('validateWithZod 字段绑定到 validateFormWithZod', () => {
    const validateFormWithZod = () => ({ success: false, errors: null })
    const deps = { ...makeDeps(), validateFormWithZod }
    const exposed = useXFormExpose(deps)
    expect(exposed.validateWithZod).toBe(validateFormWithZod)
  })

  it('调用暴露方法时按 deps 行为执行（端到端透传）', async () => {
    const validateForm = vi.fn(async () => true)
    const setFieldError = vi.fn()
    const deps = { ...makeDeps(), validateForm, setFieldError }
    const exposed = useXFormExpose(deps)

    await exposed.validate()
    expect(validateForm).toHaveBeenCalledTimes(1)

    exposed.setFieldError('email', '邮箱已被占用')
    expect(setFieldError).toHaveBeenCalledWith('email', '邮箱已被占用')
  })
})

import { vi } from 'vitest'
