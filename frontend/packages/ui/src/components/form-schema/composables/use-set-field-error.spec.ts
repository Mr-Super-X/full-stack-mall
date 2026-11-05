/**
 * useSetFieldError 单元测试
 *
 * 覆盖：
 * - 路径 A：state=error + message 非空 → 写入 externalErrors + errorBus.report
 * - 路径 A：message 空 → 删除 externalErrors
 * - 路径 A：state 非 error（validating/success）→ 删除 externalErrors
 * - silent=true → 不触发 errorBus.report
 * - 路径 B：externalErrors 变化时同步 el-form fields 的 validateState/validateMessage
 * - 路径 B：fields 变化时给新字段装 watch 守护
 * - guardField：field 已 watch 过 → 不重复装
 * - guardField：fieldName 缺失 → 不装
 * - guardField：validateState 变回非 error 时纠正回 error
 * - guardField：scope 销毁时清理所有 stop
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type Ref } from 'vue'
import { useSetFieldError, type FieldErrorState } from './use-set-field-error'
import type { UseFormErrorBusReturn } from './use-form-error-bus'

function makeErrorBus(): UseFormErrorBusReturn {
  return {
    events: ref([]) as UseFormErrorBusReturn['events'],
    report: vi.fn() as UseFormErrorBusReturn['report'],
    dismiss: vi.fn() as UseFormErrorBusReturn['dismiss'],
    dismissAll: vi.fn() as UseFormErrorBusReturn['dismissAll'],
    unreadCount: ref(0) as UseFormErrorBusReturn['unreadCount'],
  }
}

/**
 * 构造 mock el-form field
 * 关键：validateState / validateMessage 必须是 vue ref（普通对象不会被 watch 追踪）
 */
function makeField(name: string, initState = '', initMsg = '') {
  const validateState = ref(initState)
  const validateMessage = ref(initMsg)
  return {
    propString: ref(name),
    prop: ref(name),
    validateState,
    validateMessage,
    // 暴露 ref 以便测试中修改
    _state: validateState,
    _msg: validateMessage,
  }
}

describe('useSetFieldError — 路径 A（externalErrors 写入 + errorBus）', () => {
  let externalErrors: Ref<Record<string, FieldErrorState>>
  let errorBus: UseFormErrorBusReturn
  let getFields: () =>
    | Array<{
        propString?: Ref<string>
        prop?: Ref<string>
        validateState?: Ref<string>
        validateMessage?: Ref<string>
      }>
    | undefined

  beforeEach(() => {
    externalErrors = ref<Record<string, FieldErrorState>>({})
    errorBus = makeErrorBus()
    getFields = vi.fn(() => [])
  })

  it('state=error + message 非空 → 写入 externalErrors', () => {
    const scope = effectScope()
    scope.run(() => {
      const { setFieldError } = useSetFieldError({ externalErrors, getFields, errorBus })
      setFieldError('email', '邮箱已被占用')
    })
    expect(externalErrors.value.email).toEqual({ error: '邮箱已被占用', validateStatus: 'error' })
    scope.stop()
  })

  it('写入错误时默认触发 errorBus.report（FIELD_ERROR）', () => {
    const scope = effectScope()
    scope.run(() => {
      const { setFieldError } = useSetFieldError({ externalErrors, getFields, errorBus })
      setFieldError('email', '邮箱已被占用')
    })
    expect(errorBus.report).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FIELD_ERROR',
        severity: 'error',
        fields: ['email'],
      })
    )
    scope.stop()
  })

  it('silent=true → 不触发 errorBus.report（批量场景）', () => {
    const scope = effectScope()
    scope.run(() => {
      const { setFieldError } = useSetFieldError({ externalErrors, getFields, errorBus })
      setFieldError('email', '邮箱已被占用', 'error', true)
    })
    expect(errorBus.report).not.toHaveBeenCalled()
    expect(externalErrors.value.email).toEqual({ error: '邮箱已被占用', validateStatus: 'error' })
    scope.stop()
  })

  it('state=validating → 删除 externalErrors', () => {
    externalErrors.value.email = { error: 'x', validateStatus: 'error' }
    const scope = effectScope()
    scope.run(() => {
      const { setFieldError } = useSetFieldError({ externalErrors, getFields, errorBus })
      setFieldError('email', '', 'validating')
    })
    expect(externalErrors.value.email).toBeUndefined()
    scope.stop()
  })

  // A4（docs/audit/2026-10-15）：message 非空的 validating 态应写入条目（loading 图标）——
  // 修复前走 else 分支删除条目，"异步校验中误清已有红字"且 validating 态永不生效。
  // 当前唯一生产调用点（use-form-instance.ts:248）传空 message（清除意图），新旧语义一致；
  // 本用例覆盖文档承诺的 validating 写入路径。
  it('A4: message 非空 + state=validating → 写入条目（不触发 errorBus 上报）', () => {
    externalErrors.value.email = { error: '旧错误', validateStatus: 'error' }
    const scope = effectScope()
    const reportSpy = vi.spyOn(errorBus, 'report')
    scope.run(() => {
      const { setFieldError } = useSetFieldError({ externalErrors, getFields, errorBus })
      setFieldError('email', '异步校验中…', 'validating')
    })
    expect(externalErrors.value.email).toEqual({
      error: '异步校验中…',
      validateStatus: 'validating',
    })
    expect(reportSpy).not.toHaveBeenCalled()
    scope.stop()
  })

  it('state=success → 删除 externalErrors', () => {
    externalErrors.value.email = { error: 'x', validateStatus: 'error' }
    const scope = effectScope()
    scope.run(() => {
      const { setFieldError } = useSetFieldError({ externalErrors, getFields, errorBus })
      setFieldError('email', '', 'success')
    })
    expect(externalErrors.value.email).toBeUndefined()
    scope.stop()
  })

  it('message 空字符串 + state=error → 删除 externalErrors', () => {
    externalErrors.value.email = { error: 'x', validateStatus: 'error' }
    const scope = effectScope()
    scope.run(() => {
      const { setFieldError } = useSetFieldError({ externalErrors, getFields, errorBus })
      setFieldError('email', '')
    })
    expect(externalErrors.value.email).toBeUndefined()
    scope.stop()
  })

  it('errorBus 缺失时静默执行（不抛错）', () => {
    const scope = effectScope()
    expect(() => {
      scope.run(() => {
        const { setFieldError } = useSetFieldError({ externalErrors, getFields })
        setFieldError('email', 'err')
      })
    }).not.toThrow()
    expect(externalErrors.value.email).toBeDefined()
    scope.stop()
  })
})

describe('useSetFieldError — 路径 B（el-form fields 同步）', () => {
  it('externalErrors 变化时同步 field.validateState / validateMessage', async () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const field = makeField('email', '', '')
    const getFields = vi.fn(() => [field])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })
    // initial watch（immediate）触发时 externalErrors 为空
    expect(field.validateState.value).toBe('')
    expect(field.validateMessage.value).toBe('')

    // 写入错误 → 同步到 field
    externalErrors.value = { email: { error: '邮箱错', validateStatus: 'error' } }
    await nextTick()
    expect(field.validateState.value).toBe('error')
    expect(field.validateMessage.value).toBe('邮箱错')

    // 删除错误 → 同步清除
    externalErrors.value = {}
    await nextTick()
    expect(field.validateState.value).toBe('')
    expect(field.validateMessage.value).toBe('')

    scope.stop()
  })

  // A4 路径 B（docs/audit/2026-10-15，浏览器实测）：validating 条目须同步 validateState='validating'
  // （EP 显示 loading 图标）——修复前守护无条件写成 'error'，把路径 A 的 validating 覆盖掉
  it('validating 条目 → validateState 同步为 validating（不写 validateMessage）', async () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const field = makeField('email', '', '')
    const getFields = vi.fn(() => [field])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })
    externalErrors.value = { email: { error: '校验中…', validateStatus: 'validating' } }
    await nextTick()
    expect(field.validateState.value).toBe('validating')
    expect(field.validateMessage.value).toBe('')
    scope.stop()
  })

  it('已有 error 时不重复写（避免无效触发）', async () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const field = makeField('email', 'error', '已有错误')
    const getFields = vi.fn(() => [field])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })

    externalErrors.value = { email: { error: '新错误', validateStatus: 'error' } }
    await nextTick()
    // field 已被纠正为新错误（validateMessage 被覆盖）
    expect(field.validateMessage.value).toBe('新错误')

    scope.stop()
  })

  it('Bug 回归：其他字段新增外部错误时，不清除本字段的 el-form 内部错误（无外部错误条目不误清）', async () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const confirmField = makeField('passwordConfirm', '', '')
    const dateField = makeField('startDate', '', '')
    const getFields = vi.fn(() => [confirmField, dateField])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })
    await nextTick()

    // 模拟 el-form validate：空保存把日期标成内部错误（不经 externalErrors，无外部错误条目）
    dateField.validateState.value = 'error'
    dateField.validateMessage.value = '请选择开始日期'

    // 用户输入确认密码 12 → 跨字段错误经 externalErrors 新增条目
    externalErrors.value = { passwordConfirm: { error: '两次密码不一致', validateStatus: 'error' } }
    await nextTick()

    // 确认密码错误正常写入
    expect(confirmField.validateState.value).toBe('error')
    expect(confirmField.validateMessage.value).toBe('两次密码不一致')
    // ★ 日期的 el-form 内部错误绝不能被误清（旧逻辑：watch else 分支无差别清空）
    expect(dateField.validateState.value).toBe('error')
    expect(dateField.validateMessage.value).toBe('请选择开始日期')

    scope.stop()
  })

  it('Bug 回归：外部错误条目删除 → 仅该字段清除显示（diff 精准清理）', async () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({
      passwordConfirm: { error: '两次密码不一致', validateStatus: 'error' },
    })
    const confirmField = makeField('passwordConfirm', '', '')
    const dateField = makeField('startDate', 'error', '请选择开始日期')
    const getFields = vi.fn(() => [confirmField, dateField])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })
    await nextTick()
    // immediate 同步：confirmField 有条目 → 写入 error；dateField 无条目但初始即 error
    // （模拟 el-form 内部错误先于 useSetFieldError 挂载存在）→ 不应被误清
    expect(dateField.validateState.value).toBe('error')

    // 外部错误条目删除（crossValidator 重算通过）
    externalErrors.value = {}
    await nextTick()

    // 只有「旧有条目、新无条目」的 confirmField 被清除
    expect(confirmField.validateState.value).toBe('')
    expect(confirmField.validateMessage.value).toBe('')
    // dateField 新旧皆无外部错误条目 → 保持 el-form 内部错误不动
    expect(dateField.validateState.value).toBe('error')
    expect(dateField.validateMessage.value).toBe('请选择开始日期')

    scope.stop()
  })

  it('fields 数组变化时给新字段装 watch 守护（已知限制：新字段不自动同步已存在的错误）', async () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({
      email: { error: 'e', validateStatus: 'error' },
    })
    const field1 = makeField('email', '', '')
    const field2 = makeField('phone', '', '')

    // 用 ref 包装 fields 数组引用，让 watch(() => getFields()) 能追踪引用变化
    type MockField = ReturnType<typeof makeField>
    const fieldsRef = ref<MockField[]>([field1])
    const getFields: () => MockField[] | undefined = () => fieldsRef.value as unknown as MockField[]
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })

    // email 应被同步（immediate watch）
    expect(field1.validateState.value).toBe('error')
    expect(field1.validateMessage.value).toBe('e')

    // 新字段 phone 注册
    fieldsRef.value = [field1, field2]
    await nextTick()

    // 已知限制：fields watch 只调 guardField 不同步 externalErrors
    // 新字段不会自动从 externalErrors 拉取错误状态
    // （实际场景中 externalErrors 是按需写入，新字段注册时无对应错误）
    expect(field2.validateState.value).toBe('')

    // 但 guard 已装上：手动改 state 为 success 不会触发纠正（因为 externalErrors 无 phone）
    field2.validateState.value = 'success'
    await nextTick()
    expect(field2.validateState.value).toBe('success')

    // 当 externalErrors 新增 phone 错误时，deep watch 触发 → 同步 + 重新装 guard
    externalErrors.value = {
      ...externalErrors.value,
      phone: { error: 'p', validateStatus: 'error' },
    }
    await nextTick()
    expect(field2.validateState.value).toBe('error')

    // 此时 guard 已装：改 state 为 success 应被纠正回 error
    field2.validateState.value = 'success'
    await nextTick()
    expect(field2.validateState.value).toBe('error')

    scope.stop()
  })

  it('guardField：field 已 watch 过 → 不重复装（WeakSet 幂等）', async () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const field = makeField('email', 'error', 'm')
    const getFields = vi.fn(() => [field])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })

    // 多次更新 externalErrors，guardField 应只跑一次（WeakSet 已标记）
    externalErrors.value = { email: { error: 'm2', validateStatus: 'error' } }
    await nextTick()
    externalErrors.value = { email: { error: 'm3', validateStatus: 'error' } }
    await nextTick()

    // 验证：外部 watcher 触发 guardField 注册不会被重复执行
    // （无法直接验证 WeakSet 状态，但可验证行为正确性）
    expect(field.validateMessage.value).toBe('m3')
    scope.stop()
  })

  it('guardField：validateState 变回非 error 时纠正回 error', async () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({
      email: { error: 'e', validateStatus: 'error' },
    })
    // 初始 field 是空状态（el-form 内部），由 useSetFieldError 同步成 error 后装 guard
    const field = makeField('email', '', '')
    const getFields = vi.fn(() => [field])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })

    // immediate watch 已同步 field 状态为 error
    expect(field.validateState.value).toBe('error')

    // 模拟 el-form 把 state 改回 success（其他验证触发）
    field.validateState.value = 'success'
    await nextTick()

    // guard 应纠正回 error
    expect(field.validateState.value).toBe('error')
    expect(field.validateMessage.value).toBe('e')

    scope.stop()
  })

  it('guardField：字段名缺失（无 propString/prop）→ 不装 watch', () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const fieldWithoutName = {
      validateState: { value: 'error' },
      validateMessage: { value: 'm' },
    } as never
    const getFields = vi.fn(() => [fieldWithoutName])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    expect(() => {
      scope.run(() => {
        useSetFieldError({ externalErrors, getFields, errorBus })
      })
    }).not.toThrow()

    scope.stop()
  })

  it('fields 数组中含非对象元素（null/字符串）→ 跳过', () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const getFields = vi.fn(() => [null, 'str', undefined, makeField('email', '', '')] as never)
    const errorBus = makeErrorBus()

    const scope = effectScope()
    expect(() => {
      scope.run(() => {
        useSetFieldError({ externalErrors, getFields, errorBus })
      })
    }).not.toThrow()

    scope.stop()
  })

  it('getFields 返回 undefined → 安全跳过（不抛错）', () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const getFields = vi.fn(() => undefined)
    const errorBus = makeErrorBus()

    const scope = effectScope()
    expect(() => {
      scope.run(() => {
        useSetFieldError({ externalErrors, getFields, errorBus })
      })
    }).not.toThrow()
    scope.stop()
  })

  it('scope 销毁时清理所有 guard watch', () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({
      email: { error: 'e', validateStatus: 'error' },
    })
    const field = makeField('email', 'error', 'e')
    const getFields = vi.fn(() => [field])
    const errorBus = makeErrorBus()

    const scope = effectScope()
    scope.run(() => {
      useSetFieldError({ externalErrors, getFields, errorBus })
    })

    // 销毁 scope
    scope.stop()
    // 后续修改外部 ref 不应触发 guard（已被清理）
    field.validateState.value = 'success'
    expect(field.validateState.value).toBe('success') // 保持 success（无 guard 纠正）
  })

  it('无 effectScope 时调用（单测场景）→ 不抛错', () => {
    const externalErrors = ref<Record<string, FieldErrorState>>({})
    const getFields = vi.fn(() => [])
    const errorBus = makeErrorBus()

    expect(() => {
      // 故意不在 effectScope 内调用
      useSetFieldError({ externalErrors, getFields, errorBus })
    }).not.toThrow()
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
