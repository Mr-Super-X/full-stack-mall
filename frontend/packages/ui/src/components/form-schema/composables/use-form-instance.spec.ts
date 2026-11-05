import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import { useFormInstance } from './use-form-instance'

/** 模拟 el-form 组件实例（暴露 XForm 需要的实例方法） */
function createMockElForm() {
  return {
    validate: vi.fn(),
    clearValidate: vi.fn(),
    resetFields: vi.fn(),
    validateField: vi.fn(),
    scrollToField: vi.fn(),
    $: {
      name: { name: 'ElInput' } as unknown,
      email: { name: 'ElInput' } as unknown,
    },
  }
}

describe('useFormInstance(model, zodSchema)', () => {
  it('exposes elFormRef initialized to null', () => {
    const { elFormRef } = useFormInstance(
      () => ({}),
      () => undefined
    )
    expect(elFormRef.value).toBeNull()
  })

  describe('getRef(key)', () => {
    it('returns null when elFormRef is not bound', () => {
      const { getRef } = useFormInstance(
        () => ({}),
        () => undefined
      )
      expect(getRef('name')).toBeNull()
    })

    it('returns component instance from elFormRef.$.$ when bound', () => {
      const { elFormRef, getRef } = useFormInstance(
        () => ({}),
        () => undefined
      )
      const mock = createMockElForm()
      elFormRef.value = mock as never
      expect(getRef('name')).toEqual({ name: 'ElInput' })
      expect(getRef('email')).toEqual({ name: 'ElInput' })
    })

    it('returns null for non-existent key', () => {
      const { elFormRef, getRef } = useFormInstance(
        () => ({}),
        () => undefined
      )
      elFormRef.value = createMockElForm() as never
      expect(getRef('nonexistent')).toBeNull()
    })
  })

  describe('clearValidate / resetFields / scrollToField', () => {
    it('clearValidate delegates to elFormRef', () => {
      const { elFormRef, clearValidate } = useFormInstance(
        () => ({}),
        () => undefined
      )
      const mock = createMockElForm()
      elFormRef.value = mock as never
      clearValidate()
      expect(mock.clearValidate).toHaveBeenCalledTimes(1)
    })

    it('resetFields delegates to elFormRef', () => {
      const { elFormRef, resetFields } = useFormInstance(
        () => ({}),
        () => undefined
      )
      const mock = createMockElForm()
      elFormRef.value = mock as never
      resetFields()
      expect(mock.resetFields).toHaveBeenCalledTimes(1)
    })

    it('scrollToField delegates with name', () => {
      const { elFormRef, scrollToField } = useFormInstance(
        () => ({}),
        () => undefined
      )
      const mock = createMockElForm()
      elFormRef.value = mock as never
      scrollToField('email')
      expect(mock.scrollToField).toHaveBeenCalledWith('email')
    })

    it('does nothing when elFormRef is null', () => {
      const { clearValidate, resetFields, scrollToField } = useFormInstance(
        () => ({}),
        () => undefined
      )
      expect(() => clearValidate()).not.toThrow()
      expect(() => resetFields()).not.toThrow()
      expect(() => scrollToField('x')).not.toThrow()
    })
  })

  describe('validateFormWithZod()', () => {
    it('returns success when no zodSchema provided', () => {
      const { validateFormWithZod } = useFormInstance(
        () => ({ name: 'foo' }),
        () => undefined
      )
      expect(validateFormWithZod()).toEqual({ success: true, errors: null })
    })

    it('validates with zod schema (passing data)', () => {
      const zodSchema = z.object({ name: z.string() })
      const { validateFormWithZod } = useFormInstance(
        () => ({ name: 'foo' }),
        () => zodSchema as never
      )
      expect(validateFormWithZod()).toEqual({ success: true, errors: null })
    })

    it('returns failure with ZodError (failing data)', () => {
      const zodSchema = z.object({ name: z.string() })
      const { validateFormWithZod } = useFormInstance(
        () => ({ name: 123 as unknown as string }),
        () => zodSchema as never
      )
      const result = validateFormWithZod()
      expect(result.success).toBe(false)
      expect(result.errors).not.toBeNull()
    })

    it('handles undefined model gracefully', () => {
      const zodSchema = z.object({ name: z.string() })
      const { validateFormWithZod } = useFormInstance(
        () => undefined,
        () => zodSchema as never
      )
      const result = validateFormWithZod()
      expect(result.success).toBe(false)
      expect(result.errors).not.toBeNull()
    })
  })

  describe('addItem(name, init?)', () => {
    it('appends empty object when model[name] is undefined', () => {
      const modelStore = {} as Record<string, unknown>
      const { addItem, elFormRef } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      elFormRef.value = createMockElForm() as never
      addItem('items')
      expect(modelStore.items).toEqual([{}])
    })

    it('appends to existing array', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }] }
      const { addItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      addItem('items', { b: 2 })
      expect(modelStore.items).toEqual([{ a: 1 }, { b: 2 }])
    })

    it('initializes to [] when model[name] exists but is not array', () => {
      const modelStore: Record<string, unknown> = { items: 'oops' as never }
      const { addItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      addItem('items')
      expect(Array.isArray(modelStore.items)).toBe(true)
      expect(modelStore.items).toEqual([{}])
    })

    it('does nothing when model is undefined', () => {
      const { addItem } = useFormInstance(
        () => undefined,
        () => undefined
      )
      expect(() => addItem('items')).not.toThrow()
    })

    it('addItem 追加不清任何校验态（末尾追加无索引位移，既有红字保留）', () => {
      const modelStore: Record<string, unknown> = { items: [] }
      const { addItem, elFormRef } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      const mock = {
        ...createMockElForm(),
        fields: [{ propString: { value: 'items[0].qty' } }],
      }
      elFormRef.value = mock as never
      addItem('items')
      expect(mock.clearValidate).not.toHaveBeenCalled()
    })

    it('M1：removeItem 只清理该数组子树的校验态，不误伤其他字段', () => {
      const modelStore: Record<string, unknown> = { items: [{}, {}] }
      const { removeItem, elFormRef } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      const mock = {
        ...createMockElForm(),
        // 模拟 el-form 已注册的字段：两个 items 子树字段 + 一个无关字段
        fields: [
          { propString: { value: 'items[0].qty' } },
          { propString: { value: 'items[1].qty' } },
          { propString: { value: 'other' } },
        ],
      }
      elFormRef.value = mock as never
      removeItem('items', 0)
      // 此前为无参调用（清空全表单）；现在只传 items 子树路径
      expect(mock.clearValidate).toHaveBeenCalledWith(['items[0].qty', 'items[1].qty'])
      expect(mock.clearValidate).not.toHaveBeenCalledWith()
    })

    it('M1：removeItem 只清被删行及之后的行，前面的行错误保留', () => {
      const modelStore: Record<string, unknown> = { items: [{}, {}, {}] }
      const { removeItem, elFormRef } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      const mock = {
        ...createMockElForm(),
        fields: [
          { propString: { value: 'items[0].qty' } },
          { propString: { value: 'items[1].qty' } },
          { propString: { value: 'items[2].qty' } },
        ],
      }
      elFormRef.value = mock as never
      removeItem('items', 1) // 删第 2 行 → 仅 items[1]/items[2] 路径失效
      expect(mock.clearValidate).toHaveBeenCalledWith(['items[1].qty', 'items[2].qty'])
    })

    it('M1：一个匹配字段都提不到时不调用 clearValidate（EP 空数组=清全部）', () => {
      // element-plus filterFields：clearValidate([]) 语义是清空全表单，必须守卫
      const modelStore: Record<string, unknown> = { items: [{}] }
      const { removeItem, elFormRef } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      const mock = createMockElForm() // 无 fields 属性 → 提取不到任何字段名
      elFormRef.value = mock as never
      removeItem('items', 0)
      expect(mock.clearValidate).not.toHaveBeenCalled()
    })
  })

  describe('removeItem(name, index)', () => {
    it('removes the item at given index', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }, { a: 2 }, { a: 3 }] }
      const { removeItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      removeItem('items', 1)
      expect(modelStore.items).toEqual([{ a: 1 }, { a: 3 }])
    })

    it('is silent when index is out of range', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }] }
      const { removeItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      expect(() => removeItem('items', 5)).not.toThrow()
      expect(() => removeItem('items', -1)).not.toThrow()
      expect(modelStore.items).toEqual([{ a: 1 }])
    })

    it('is silent when model[name] is not array', () => {
      const modelStore: Record<string, unknown> = { items: 'oops' as never }
      const { removeItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      expect(() => removeItem('items', 0)).not.toThrow()
    })

    it('is silent when model is undefined', () => {
      const { removeItem } = useFormInstance(
        () => undefined,
        () => undefined
      )
      expect(() => removeItem('items', 0)).not.toThrow()
    })

    it('calls elFormRef.clearValidate after removal', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }] }
      const { removeItem, elFormRef } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      const mock = {
        ...createMockElForm(),
        fields: [{ propString: { value: 'items[0].a' } }],
      }
      elFormRef.value = mock as never
      removeItem('items', 0)
      expect(mock.clearValidate).toHaveBeenCalledWith(['items[0].a'])
    })
  })

  describe('moveItem(name, from, to)', () => {
    it('moves item from index to index', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }, { a: 2 }, { a: 3 }] }
      const { moveItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      moveItem('items', 0, 2)
      expect(modelStore.items).toEqual([{ a: 2 }, { a: 3 }, { a: 1 }])
    })

    it('moves in reverse direction', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }, { a: 2 }, { a: 3 }] }
      const { moveItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      moveItem('items', 2, 0)
      expect(modelStore.items).toEqual([{ a: 3 }, { a: 1 }, { a: 2 }])
    })

    it('is silent when from === to', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }, { a: 2 }] }
      const { moveItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      moveItem('items', 1, 1)
      expect(modelStore.items).toEqual([{ a: 1 }, { a: 2 }])
    })

    it('is silent when indices are out of range', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }] }
      const { moveItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      expect(() => moveItem('items', -1, 0)).not.toThrow()
      expect(() => moveItem('items', 0, 5)).not.toThrow()
      expect(modelStore.items).toEqual([{ a: 1 }])
    })

    it('is silent when model[name] is not array', () => {
      const modelStore: Record<string, unknown> = { items: 'oops' as never }
      const { moveItem } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      expect(() => moveItem('items', 0, 1)).not.toThrow()
    })

    it('is silent when model is undefined', () => {
      const { moveItem } = useFormInstance(
        () => undefined,
        () => undefined
      )
      expect(() => moveItem('items', 0, 1)).not.toThrow()
    })

    it('calls elFormRef.clearValidate after move', () => {
      const modelStore: Record<string, unknown> = { items: [{ a: 1 }, { a: 2 }] }
      const { moveItem, elFormRef } = useFormInstance(
        () => modelStore,
        () => undefined
      )
      const mock = {
        ...createMockElForm(),
        fields: [{ propString: { value: 'items[0].a' } }, { propString: { value: 'items[1].a' } }],
      }
      elFormRef.value = mock as never
      moveItem('items', 0, 1)
      expect(mock.clearValidate).toHaveBeenCalledWith(['items[0].a', 'items[1].a'])
    })
  })

  describe('setFieldError(name, message)', () => {
    // 阶段 3.1:setFieldError 改为走 externalErrors ref(官方 props 路径),
    // 不再直接修改 elForm.fields[i]。测试相应更新:检查 externalErrors ref 值
    // P0-2:externalErrors 由 useFormInstance 内部创建并拥有,无需调用方传入
    it('writes message to externalErrors ref (走 element-plus 官方 props 路径)', () => {
      const { setFieldError, externalErrors } = useFormInstance(
        () => ({}),
        () => undefined
      )
      setFieldError('email', '邮箱格式错误')
      expect(externalErrors.value.email).toEqual({
        error: '邮箱格式错误',
        validateStatus: 'error',
      })
    })

    it('writes default validateStatus when state omitted', () => {
      const { setFieldError, externalErrors } = useFormInstance(
        () => ({}),
        () => undefined
      )
      setFieldError('email', '错误信息')
      expect(externalErrors.value.email?.validateStatus).toBe('error')
    })

    it('clears entry when message empty or state cleared', () => {
      const { setFieldError, externalErrors } = useFormInstance(
        () => ({}),
        () => undefined
      )
      // 先写入 —— internal externalErrors 现在由 useFormInstance 拥有,无法预先填充
      setFieldError('email', '错误信息')
      expect(externalErrors.value.email).toBeDefined()
      // 清空
      setFieldError('email', '')
      expect(externalErrors.value.email).toBeUndefined()
    })

    it('does not throw when called without explicit el-form binding', () => {
      // P0-2:externalErrors 始终由 useFormInstance 内部创建,setFieldError 不会因为无外部依赖而抛错
      const { setFieldError } = useFormInstance(
        () => ({}),
        () => undefined
      )
      expect(() => setFieldError('a', 'b')).not.toThrow()
    })

    it('supports nested path (items[0].qty) for array items', () => {
      const { setFieldError, externalErrors } = useFormInstance(
        () => ({}),
        () => undefined
      )
      setFieldError('items[0].qty', '数量必须大于 0')
      expect(externalErrors.value['items[0].qty']).toEqual({
        error: '数量必须大于 0',
        validateStatus: 'error',
      })
    })
  })
})

describe('useFormInstance / guard watcher 泄漏修复（⑥ 回归）', () => {
  it('scope 销毁后 guard watcher 不再纠正字段状态', async () => {
    const { effectScope, nextTick, ref } = await import('vue')
    const validateState = ref('success')
    const validateMessage = ref('')
    const scope = effectScope()
    // P0-2:externalErrors 改为 useFormInstance 内部创建,这里用闭包变量接住引用
    let externalErrorsRef: ReturnType<typeof useFormInstance>['externalErrors'] | undefined
    scope.run(() => {
      const inst = useFormInstance(
        () => ({}),
        () => undefined
      )
      externalErrorsRef = inst.externalErrors
      const mock = {
        ...createMockElForm(),
        fields: [{ propString: 'a', validateState, validateMessage }],
      }
      inst.elFormRef.value = mock as never
    })
    // 触发外层 watch → guardField 注册 inner watch
    externalErrorsRef!.value = { a: { error: '服务端错误', validateStatus: 'error' } }
    await nextTick()
    // guard 生效验证：字段被改成 success 时应被纠正回 error
    validateState.value = 'success'
    await nextTick()
    expect(validateState.value).toBe('error')
    // 销毁 scope 后再改 —— 泄漏修复后不应再被纠正
    scope.stop()
    validateState.value = 'success'
    await nextTick()
    expect(validateState.value).toBe('success')
  })
})

describe('useFormInstance / validateField（P1 回归）', () => {
  it('校验成功 resolve true', async () => {
    const { elFormRef, validateField } = useFormInstance(
      () => ({}),
      () => undefined
    )
    const mock = createMockElForm()
    mock.validateField = vi.fn(() => Promise.resolve(true))
    elFormRef.value = mock as never
    await expect(validateField('email')).resolves.toBe(true)
    expect(mock.validateField).toHaveBeenCalledWith('email')
  })

  it('校验失败（element-plus reject errorsMap）resolve false', async () => {
    const { elFormRef, validateField } = useFormInstance(
      () => ({}),
      () => undefined
    )
    const mock = createMockElForm()
    mock.validateField = vi.fn(() => Promise.reject(new Error('invalid')))
    elFormRef.value = mock as never
    await expect(validateField('email')).resolves.toBe(false)
  })

  it('el-form 未绑定 → false + console.error（不静默通过）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { validateField } = useFormInstance(
      () => ({}),
      () => undefined
    )
    await expect(validateField('email')).resolves.toBe(false)
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('el-form 实例未绑定'))
    errSpy.mockRestore()
  })

  it('校验失败且 ef.fields 含错误详情 → console.error + errorBus.report（与 validateForm 对齐）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reported: Array<{ code: string; severity: string; fields: string[] }> = []
    // errorBus mock —— 用 as unknown 强制类型断言避免 5 字段全列
    const errorBus = {
      report: (e: { code: string; severity: string; fields: string[] }): void => {
        reported.push(e)
      },
      events: { value: [] },
      dismiss: () => undefined,
      dismissAll: () => undefined,
      unreadCount: { value: 0 },
    }
    const { elFormRef, validateField } = useFormInstance(
      () => ({}),
      () => undefined,
      errorBus as never
    )
    const mock = createMockElForm() as unknown as {
      fields: Array<{
        propString: string
        validateState: { value: string }
        validateMessage: { value: string }
        fieldValue: unknown
      }>
      validateField: () => Promise<unknown>
    }
    mock.fields = [
      {
        propString: 'email',
        validateState: { value: 'error' },
        validateMessage: { value: '邮箱格式错误' },
        fieldValue: 'abc',
      },
    ]
    mock.validateField = vi.fn(() => Promise.reject(new Error('invalid')))
    elFormRef.value = mock as never
    await expect(validateField('email')).resolves.toBe(false)
    expect(errSpy).toHaveBeenCalledWith('[XForm] validateField failed:', expect.any(Array))
    expect(reported).toHaveLength(1)
    expect(reported[0]?.code).toBe('EL_FORM_VALIDATION_FAILED')
    expect(reported[0]?.fields).toEqual(['email'])
    errSpy.mockRestore()
  })

  it('校验失败但 ef.fields 无匹配字段 → 不输出 console.error 不上报 errorBus（避免误报）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reported: unknown[] = []
    const errorBus = {
      report: (e: unknown): void => {
        reported.push(e)
      },
      events: { value: [] },
      dismiss: () => undefined,
      dismissAll: () => undefined,
      unreadCount: { value: 0 },
    }
    const { elFormRef, validateField } = useFormInstance(
      () => ({}),
      () => undefined,
      errorBus as never
    )
    const mock = createMockElForm() as unknown as {
      fields: Array<{
        propString: string
        validateState: { value: string }
        validateMessage: { value: string }
      }>
      validateField: () => Promise<unknown>
    }
    // 字段名不匹配 → collectElFieldErrors 返回空 → 不触发反馈
    mock.fields = [
      {
        propString: 'otherField',
        validateState: { value: 'error' },
        validateMessage: { value: '其他字段错误' },
      },
    ]
    mock.validateField = vi.fn(() => Promise.reject(new Error('invalid')))
    elFormRef.value = mock as never
    await expect(validateField('email')).resolves.toBe(false)
    expect(errSpy).not.toHaveBeenCalledWith('[XForm] validateField failed:', expect.anything())
    expect(reported).toHaveLength(0)
    errSpy.mockRestore()
  })
})

describe('useFormInstance / resetFields(names) 部分重置（P1 回归）', () => {
  it('透传 names 给 el-form，且只清指定字段的 externalErrors', () => {
    // P0-2:externalErrors 由 useFormInstance 内部创建,通过 setFieldError 写入预置数据
    const { elFormRef, resetFields, setFieldError, externalErrors } = useFormInstance(
      () => ({}),
      () => undefined
    )
    setFieldError('a', '错误A')
    setFieldError('b', '错误B')
    const mock = createMockElForm()
    elFormRef.value = mock as never
    resetFields(['a'])
    expect(mock.resetFields).toHaveBeenCalledWith(['a'])
    expect(externalErrors.value.a).toBeUndefined() // 指定字段已清
    expect(externalErrors.value.b).toBeDefined() // 其他字段保留
  })

  it('不传 names → 全量重置并清空 externalErrors（行为不变）', () => {
    const { elFormRef, resetFields, setFieldError, externalErrors } = useFormInstance(
      () => ({}),
      () => undefined
    )
    setFieldError('a', '错误A')
    expect(externalErrors.value.a).toBeDefined()
    const mock = createMockElForm()
    elFormRef.value = mock as never
    resetFields()
    expect(mock.resetFields).toHaveBeenCalledWith(undefined)
    expect(externalErrors.value).toEqual({})
  })
})

describe('嵌套 array 操作（P0-3 修复）', () => {
  it('addItem 在嵌套路径 orders[0].items 末尾追加项', () => {
    const model: Record<string, unknown> = {
      orders: [{ items: [{ qty: 1 }] }],
    }
    const { addItem } = useFormInstance(
      () => model,
      () => undefined
    )
    addItem('orders[0].items', { qty: 2 })
    expect((model.orders as Array<{ items: unknown[] }>)[0]!.items).toHaveLength(2)
    expect((model.orders as Array<{ items: Array<{ qty: number }> }>)[0]!.items[1]).toEqual({
      qty: 2,
    })
  })

  it('addItem 自动初始化不存在的嵌套数组', () => {
    const model: Record<string, unknown> = {
      orders: [{}],
    }
    const { addItem } = useFormInstance(
      () => model,
      () => undefined
    )
    addItem('orders[0].items', { qty: 1 })
    expect((model.orders as Array<{ items?: unknown[] }>)[0]!.items).toEqual([{ qty: 1 }])
  })

  it('removeItem 删除嵌套路径的指定行', () => {
    const model: Record<string, unknown> = {
      orders: [{ items: [{ qty: 1 }, { qty: 2 }, { qty: 3 }] }],
    }
    const { removeItem } = useFormInstance(
      () => model,
      () => undefined
    )
    removeItem('orders[0].items', 1)
    expect((model.orders as Array<{ items: Array<{ qty: number }> }>)[0]!.items).toEqual([
      { qty: 1 },
      { qty: 3 },
    ])
  })

  it('moveItem 嵌套路径：行换位生效', () => {
    const model: Record<string, unknown> = {
      orders: [{ items: [{ qty: 1 }, { qty: 2 }, { qty: 3 }] }],
    }
    const { moveItem } = useFormInstance(
      () => model,
      () => undefined
    )
    moveItem('orders[0].items', 0, 2)
    expect((model.orders as Array<{ items: Array<{ qty: number }> }>)[0]!.items).toEqual([
      { qty: 2 },
      { qty: 3 },
      { qty: 1 },
    ])
  })

  it('moveItem 嵌套路径：非法索引不抛错（静默返回）', () => {
    const model: Record<string, unknown> = {
      orders: [{ items: [{ qty: 1 }] }],
    }
    const { moveItem } = useFormInstance(
      () => model,
      () => undefined
    )
    moveItem('orders[0].items', 0, 5) // to 越界
    expect((model.orders as Array<{ items: Array<{ qty: number }> }>)[0]!.items).toEqual([
      { qty: 1 },
    ])
  })

  it('addItem/removeItem/moveItem 不影响顶层 array（向后兼容）', () => {
    const model: Record<string, unknown> = {
      tasks: [{ id: 1 }, { id: 2 }],
    }
    const { addItem, removeItem, moveItem } = useFormInstance(
      () => model,
      () => undefined
    )
    addItem('tasks', { id: 3 })
    expect(model.tasks).toHaveLength(3)
    moveItem('tasks', 0, 2)
    expect(model.tasks).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }])
    removeItem('tasks', 0)
    expect(model.tasks).toEqual([{ id: 3 }, { id: 1 }])
  })
})
