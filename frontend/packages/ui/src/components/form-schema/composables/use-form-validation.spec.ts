/**
 * useFormValidation 单测 —— 覆盖 6 个函数
 *
 * 目标：锁定 Phase 1 抽取后的行为契约，防止后续修改破坏等价的 100% 行为
 *
 * 行为契约来源：原 XForm.vue 内联实现（已删除），对照 ADR / docs/24 文档
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick, ref, type Ref } from 'vue'
import type { UseFormValidationDeps } from './use-form-validation'
import { useFormValidation as useFormValidationReal } from './use-form-validation'
import type { SchemaNode, RuleItem, ValidateResult } from '../types'

// mock matchTrigger（use-form-validation 内部 import）—— 透传判断，不展开测试
vi.mock('./match-trigger', () => ({
  matchTrigger: (trigger: unknown, eventType: 'blur' | 'change') => {
    if (trigger === undefined) return eventType === 'blur'
    if (trigger === eventType) return true
    if (Array.isArray(trigger)) return (trigger as string[]).includes(eventType)
    return false
  },
}))

// mock element-plus 间接依赖（use-form-validation 不直接 import，但 runCrossFieldValidation 可能间接用）
vi.mock('element-plus', () => ({}))

// mock use-validate 中的 runCrossFieldValidation（避免依赖真实 schema 树）
const mockRunCrossFieldValidation = vi.fn(async (): Promise<ValidateResult> => ({
  isValid: true,
  errors: [],
}))
vi.mock('./use-validate', () => ({
  runCrossFieldValidation: (...args: unknown[]) => {
    // 类型适配：vi.fn 类型推断与 runCrossFieldValidation 签名不完全兼容，运行时透传即可
    void mockRunCrossFieldValidation
    return (mockRunCrossFieldValidation as unknown as (...a: unknown[]) => Promise<ValidateResult>)(
      ...args
    )
  },
}))

function makeDeps(overrides: Partial<UseFormValidationDeps> = {}): {
  deps: UseFormValidationDeps
  setFieldError: ReturnType<typeof vi.fn>
  clearValidate: ReturnType<typeof vi.fn>
  scrollToField: ReturnType<typeof vi.fn>
  topLevelScrollToError: Ref<boolean>
  elFormRef: Ref<{ validate?: (cb?: (v: boolean) => void) => Promise<boolean> } | null>
  reactiveSchema: Ref<SchemaNode | SchemaNode[] | string | undefined>
  model: Ref<Record<string, unknown> | undefined>
  rules: Ref<Record<string, RuleItem> | undefined>
} {
  const reactiveSchema = ref<SchemaNode | SchemaNode[] | string | undefined>({})
  const model = ref<Record<string, unknown> | undefined>({})
  const rules = ref<Record<string, RuleItem> | undefined>({})
  const elFormRef = ref<{ validate?: (cb?: (v: boolean) => void) => Promise<boolean> } | null>(null)
  const setFieldError = vi.fn()
  const clearValidate = vi.fn()
  const scrollToField = vi.fn()
  const topLevelScrollToError = ref(false)

  const deps: UseFormValidationDeps = {
    reactiveSchema: reactiveSchema as { value: SchemaNode | SchemaNode[] | string | undefined },
    model: model as { value: Record<string, unknown> | undefined },
    rules: rules as { value: Record<string, RuleItem> | undefined },
    elFormRef: elFormRef as {
      value: { validate?: (cb?: (v: boolean) => void) => Promise<boolean> } | null
    },
    setFieldError,
    scrollToField,
    topLevelScrollToError,
    ...overrides,
  }

  return {
    deps,
    setFieldError,
    clearValidate,
    scrollToField,
    topLevelScrollToError,
    elFormRef,
    reactiveSchema,
    model,
    rules,
  }
}

describe('useFormValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunCrossFieldValidation.mockReset()
    mockRunCrossFieldValidation.mockResolvedValue({ isValid: true, errors: [] })
  })

  // ============================================================
  // validateForm
  // ============================================================
  describe('validateForm', () => {
    it('model 未传 → 返回 true', async () => {
      const { deps, model } = makeDeps()
      model.value = undefined
      const api = useFormValidationReal(deps)
      expect(await api.validateForm()).toBe(true)
      expect(mockRunCrossFieldValidation).not.toHaveBeenCalled()
    })

    it('elFormRef 未挂载（validate 不存在）→ 跑 crossField，结果返回', async () => {
      const { deps, elFormRef } = makeDeps()
      elFormRef.value = null
      mockRunCrossFieldValidation.mockResolvedValueOnce({
        isValid: false,
        errors: [{ keyPath: ['email'], message: 'invalid' }],
      })
      const api = useFormValidationReal(deps)
      expect(await api.validateForm()).toBe(false)
      expect(mockRunCrossFieldValidation).toHaveBeenCalledOnce()
    })

    it('el-form.validate callback 失败 → 返回 false，不跑 crossField', async () => {
      const { deps, elFormRef } = makeDeps()
      elFormRef.value = {
        validate: (cb?: (v: boolean) => void) => {
          cb?.(false)
          return Promise.resolve(false)
        },
      }
      const api = useFormValidationReal(deps)
      expect(await api.validateForm()).toBe(false)
      expect(mockRunCrossFieldValidation).not.toHaveBeenCalled()
    })

    it('el-form.validate callback 成功 → 跑 crossField，cross 失败返回 false', async () => {
      const { deps, elFormRef } = makeDeps()
      elFormRef.value = {
        validate: (cb?: (v: boolean) => void) => {
          cb?.(true)
          return Promise.resolve(true)
        },
      }
      mockRunCrossFieldValidation.mockResolvedValueOnce({
        isValid: false,
        errors: [{ keyPath: ['email'], message: 'taken' }],
      })
      const api = useFormValidationReal(deps)
      expect(await api.validateForm()).toBe(false)
      expect(mockRunCrossFieldValidation).toHaveBeenCalledOnce()
      // OPT-7: validateForm → applyCrossErrors → setFieldError(name, msg, 'error', true)
      expect(deps.setFieldError).toHaveBeenCalledWith('email', 'taken', 'error', true)
    })

    it('el-form.validate callback 成功 + cross 成功 → 返回 true', async () => {
      const { deps, elFormRef } = makeDeps()
      elFormRef.value = {
        validate: (cb?: (v: boolean) => void) => {
          cb?.(true)
          return Promise.resolve(true)
        },
      }
      const api = useFormValidationReal(deps)
      expect(await api.validateForm()).toBe(true)
      expect(mockRunCrossFieldValidation).toHaveBeenCalledOnce()
    })
  })

  // ============================================================
  // validateDetail
  // ============================================================
  describe('validateDetail', () => {
    it('model 未传 → 返回 { isValid: true, errors: [] }', async () => {
      const { deps, model } = makeDeps()
      model.value = undefined
      const api = useFormValidationReal(deps)
      const result = await api.validateDetail()
      expect(result).toEqual({ isValid: true, errors: [] })
      expect(mockRunCrossFieldValidation).not.toHaveBeenCalled()
    })

    it('跨字段成功 → 返回 isValid true', async () => {
      const { deps } = makeDeps()
      mockRunCrossFieldValidation.mockResolvedValueOnce({ isValid: true, errors: [] })
      const api = useFormValidationReal(deps)
      expect(await api.validateDetail()).toEqual({ isValid: true, errors: [] })
    })

    it('跨字段失败 → 返回完整错误列表（不写 UI）', async () => {
      const { deps, setFieldError } = makeDeps()
      mockRunCrossFieldValidation.mockResolvedValueOnce({
        isValid: false,
        errors: [
          { keyPath: ['a', 'b'], message: 'err1' },
          { keyPath: ['c'], message: 'err2' },
        ],
      })
      const api = useFormValidationReal(deps)
      const result = await api.validateDetail()
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(2)
      // validateDetail 不应自动写入 setFieldError（与 validateForm 行为差异）
      expect(setFieldError).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // triggerCrossFieldValidator（关键：序号令牌 H3）
  // ============================================================
  describe('triggerCrossFieldValidator', () => {
    it('node.name 缺失 → 不调用 crossValidator', async () => {
      const { deps, setFieldError } = makeDeps()
      const api = useFormValidationReal(deps)
      const node: SchemaNode = {
        component: 'Input',
        rules: [{ crossValidator: vi.fn(), dependsOn: ['x'] }],
      }
      await api.triggerCrossFieldValidator(node, 'blur')
      expect(setFieldError).not.toHaveBeenCalled()
    })

    it('node.rules 缺失 → 不调用', async () => {
      const { deps, setFieldError } = makeDeps()
      const api = useFormValidationReal(deps)
      const node: SchemaNode = { component: 'Input', name: 'x' }
      await api.triggerCrossFieldValidator(node, 'blur')
      expect(setFieldError).not.toHaveBeenCalled()
    })

    it('空值（undefined）→ 跳过 cross（留给 required）', async () => {
      const { deps, model, setFieldError } = makeDeps()
      model.value = { x: undefined }
      const api = useFormValidationReal(deps)
      const node: SchemaNode = {
        component: 'Input',
        name: 'x',
        rules: [{ crossValidator: vi.fn(), dependsOn: ['y'] }],
      }
      await api.triggerCrossFieldValidator(node, 'blur')
      expect(setFieldError).not.toHaveBeenCalled()
    })

    it('crossValidator 返回 true → setFieldError(name, "", "")', async () => {
      const { deps, model } = makeDeps()
      model.value = { x: 'abc' }
      const api = useFormValidationReal(deps)
      const node: SchemaNode = {
        component: 'Input',
        name: 'x',
        rules: [
          {
            crossValidator: () => true,
            dependsOn: 'y',
            trigger: 'blur',
          },
        ],
      }
      await api.triggerCrossFieldValidator(node, 'blur')
      expect(deps.setFieldError).toHaveBeenCalledWith('x', '', '')
    })

    it('crossValidator 返回 string → setFieldError(name, msg)', async () => {
      const { deps, model } = makeDeps()
      model.value = { x: 'a', y: 'b' }
      const api = useFormValidationReal(deps)
      const node: SchemaNode = {
        component: 'Input',
        name: 'x',
        rules: [
          {
            crossValidator: (v: unknown, y: unknown) => (v === y ? true : 'mismatch'),
            dependsOn: 'y',
            trigger: 'blur',
          },
        ],
      }
      await api.triggerCrossFieldValidator(node, 'blur')
      expect(deps.setFieldError).toHaveBeenCalledWith('x', 'mismatch')
    })

    it('crossValidator 抛错 → console.error + 跳过', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { deps, model } = makeDeps()
      model.value = { x: 'a' }
      const api = useFormValidationReal(deps)
      const node: SchemaNode = {
        component: 'Input',
        name: 'x',
        rules: [
          {
            crossValidator: () => {
              throw new Error('boom')
            },
            dependsOn: 'y',
            trigger: 'blur',
          },
        ],
      }
      await api.triggerCrossFieldValidator(node, 'blur')
      expect(deps.setFieldError).not.toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith('[XForm] crossValidator threw:', expect.any(Error))
      consoleSpy.mockRestore()
    })

    it('trigger 不匹配（trigger="change"，event="blur）→ 不调用 crossValidator', async () => {
      const crossValidator = vi.fn((): true => true)
      const { deps, model } = makeDeps()
      model.value = { x: 'a' }
      const api = useFormValidationReal(deps)
      const node: SchemaNode = {
        component: 'Input',
        name: 'x',
        rules: [{ crossValidator, dependsOn: 'y', trigger: 'change' }],
      }
      await api.triggerCrossFieldValidator(node, 'blur')
      expect(crossValidator).not.toHaveBeenCalled()
    })

    it('trigger=数组包含 eventType → 调用 crossValidator', async () => {
      const crossValidator = vi.fn((): true => true)
      const { deps, model } = makeDeps()
      model.value = { x: 'a' }
      const api = useFormValidationReal(deps)
      const node: SchemaNode = {
        component: 'Input',
        name: 'x',
        rules: [{ crossValidator, dependsOn: 'y', trigger: ['blur', 'change'] }],
      }
      await api.triggerCrossFieldValidator(node, 'change')
      expect(crossValidator).toHaveBeenCalled()
    })

    it('序号令牌 H3：连续触发时旧结果不覆盖新结果', async () => {
      // 模拟连续两次 blur：第二次触发序号更新，第一次的延迟 Promise 完成时不应写 setFieldError
      const { deps, model, setFieldError } = makeDeps()
      model.value = { x: 'a', y: 'b' }
      const api = useFormValidationReal(deps)

      const resolveFns: Array<(v: true | string) => void> = []
      const crossValidator = vi.fn(
        (): Promise<true | string> =>
          new Promise<true | string>((resolve) => {
            resolveFns.push(resolve)
          })
      )
      const node: SchemaNode = {
        component: 'Input',
        name: 'x',
        rules: [{ crossValidator, dependsOn: 'y', trigger: 'blur' }],
      }

      // 第一次 blur（Promise pending）
      const first = api.triggerCrossFieldValidator(node, 'blur')
      // 第二次 blur（序号 +1，旧结果应被丢弃）
      const second = api.triggerCrossFieldValidator(node, 'blur')

      expect(crossValidator).toHaveBeenCalledTimes(2)
      // 让第一次先 resolve（应该是 stale）
      resolveFns[0]?.('first-stale-msg')
      await first
      // 第一次结果应被丢弃（setFieldError 未调用）
      expect(setFieldError).not.toHaveBeenCalledWith('x', 'first-stale-msg')

      // 让第二次 resolve（最新）
      resolveFns[1]?.('second-fresh-msg')
      await second
      expect(setFieldError).toHaveBeenCalledWith('x', 'second-fresh-msg')
    })

    it('dependsOn 是字符串数组 → 按顺序传参给 crossValidator', async () => {
      const crossValidator = vi.fn((): true => true)
      const { deps, model } = makeDeps()
      model.value = { x: 'a', y: 'b', z: 'c' }
      const api = useFormValidationReal(deps)
      const node: SchemaNode = {
        component: 'Input',
        name: 'x',
        rules: [{ crossValidator, dependsOn: ['y', 'z'], trigger: 'blur' }],
      }
      await api.triggerCrossFieldValidator(node, 'blur')
      expect(crossValidator).toHaveBeenCalledWith('a', 'b', 'c')
    })
  })

  // ============================================================
  // firstCrossErrorField
  // ============================================================
  describe('firstCrossErrorField', () => {
    it('isValid → null', () => {
      const { deps } = makeDeps()
      const api = useFormValidationReal(deps)
      expect(api.firstCrossErrorField({ isValid: true, errors: [] })).toBe(null)
    })

    it('errors 空 → null', () => {
      const { deps } = makeDeps()
      const api = useFormValidationReal(deps)
      expect(api.firstCrossErrorField({ isValid: false, errors: [] })).toBe(null)
    })

    it('errors[0] 末段是 string → 返回该 string', () => {
      const { deps } = makeDeps()
      const api = useFormValidationReal(deps)
      expect(
        api.firstCrossErrorField({
          isValid: false,
          errors: [{ keyPath: ['items', 0, 'qty'], message: 'x' }],
        })
      ).toBe('qty')
    })

    it('errors[0] 末段是 number（非 string） → null', () => {
      const { deps } = makeDeps()
      const api = useFormValidationReal(deps)
      expect(
        api.firstCrossErrorField({
          isValid: false,
          errors: [{ keyPath: [0], message: 'x' }],
        })
      ).toBe(null)
    })
  })

  // ============================================================
  // applyCrossErrors
  // ============================================================
  describe('applyCrossErrors', () => {
    it('isValid → 不写 setFieldError，不 console.error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { deps, setFieldError } = makeDeps()
      const api = useFormValidationReal(deps)
      api.applyCrossErrors({ isValid: true, errors: [] })
      expect(setFieldError).not.toHaveBeenCalled()
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('errors 非空 → 写 setFieldError(silent=true)（console 由 errorBus 统一输出）', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { deps, setFieldError } = makeDeps()
      const api = useFormValidationReal(deps)
      api.applyCrossErrors({
        isValid: false,
        errors: [
          { keyPath: ['a'], message: 'err1' },
          { keyPath: ['b'], message: 'err2' },
        ],
      })
      expect(setFieldError).toHaveBeenCalledTimes(2)
      // OPT-7: applyCrossErrors 用 silent=true 避免与 per-field OSD 重复
      expect(setFieldError).toHaveBeenNthCalledWith(1, 'a', 'err1', 'error', true)
      expect(setFieldError).toHaveBeenNthCalledWith(2, 'b', 'err2', 'error', true)
      // console 输出由 errorBus 内部统一处理（避免双重输出）：
      // applyCrossErrors 不再直接 console.error，所有 console 走 errorBus → console 单一来源
      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('keyPath 末段非 string → 跳过该 error', () => {
      const { deps, setFieldError } = makeDeps()
      const api = useFormValidationReal(deps)
      api.applyCrossErrors({
        isValid: false,
        errors: [
          { keyPath: [0], message: 'skip' },
          { keyPath: ['valid'], message: 'keep' },
        ],
      })
      expect(setFieldError).toHaveBeenCalledTimes(1)
      expect(setFieldError).toHaveBeenCalledWith('valid', 'keep', 'error', true)
    })
  })

  // ============================================================
  // scrollToFirstError
  // ============================================================
  describe('scrollToFirstError', () => {
    it('fieldName 为 null → 不滚动', async () => {
      const { deps, scrollToField, topLevelScrollToError } = makeDeps()
      topLevelScrollToError.value = true
      const api = useFormValidationReal(deps)
      api.scrollToFirstError(null)
      await nextTick()
      expect(scrollToField).not.toHaveBeenCalled()
    })

    it('topLevelScrollToError=false → 不滚动', async () => {
      const { deps, scrollToField, topLevelScrollToError } = makeDeps()
      topLevelScrollToError.value = false
      const api = useFormValidationReal(deps)
      api.scrollToFirstError('email')
      await nextTick()
      expect(scrollToField).not.toHaveBeenCalled()
    })

    it('fieldName 有效 + topLevelScrollToError=true → nextTick 后调用 scrollToField', async () => {
      const { deps, scrollToField, topLevelScrollToError } = makeDeps()
      topLevelScrollToError.value = true
      const api = useFormValidationReal(deps)
      api.scrollToFirstError('email')
      // 同步不调，等 nextTick
      expect(scrollToField).not.toHaveBeenCalled()
      await nextTick()
      expect(scrollToField).toHaveBeenCalledWith('email')
    })
  })
})
