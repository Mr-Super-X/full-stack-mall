/**
 * useCrossFieldTrigger 单元测试
 * 覆盖反向跨字段实时校验：
 * - trigger(fieldName) 精确触发：只跑 deps 包含该字段的 rules
 * - target === fieldName 时也触发（正向：字段改自己的跨字段规则重算）
 * - 同步 / 异步 crossValidator 路径
 * - 空值跳过（value === '' / undefined / null → 清错误不写错误）
 * - manual 规则跳过
 * - model watch 兜底路径（resetFields 等非 onValueChange 路径）
 * - stop() 卸载清理
 */
import { describe, it, expect, vi } from 'vitest'
import { ref, reactive, nextTick } from 'vue'
import type { RuleItem } from '../types'
import { useCrossFieldTrigger, type UseCrossFieldTriggerOptions } from './use-cross-field-trigger'

interface ReverseRule {
  target: string
  deps: string[]
  /**
   * 行模板标记（useSchemaIndex 对 array.itemSchema 产出的条目）：
   * target/deps 为行内相对名，trigger 收到全路径时按行前缀 concrete 化后执行
   */
  rowScoped?: boolean
  rule: RuleItem
}

function makeOpts(
  rules: ReverseRule[],
  modelGetter: () => Record<string, unknown> | undefined,
  extra?: Pick<UseCrossFieldTriggerOptions, 'defaultDebounceMs' | 'watchFallback'>
): UseCrossFieldTriggerOptions & {
  setFieldError: ReturnType<typeof vi.fn>
  clearValidate: ReturnType<typeof vi.fn>
} {
  const setFieldError = vi.fn()
  const clearValidate = vi.fn()
  return {
    crossRules: () => rules,
    model: modelGetter,
    setFieldError,
    clearValidate,
    ...(extra ?? {}),
  }
}

describe('useCrossFieldTrigger / trigger 精确触发', () => {
  it('changedField 命中 deps → 触发 crossValidator（返回值 true → clearValidate）', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'passwordConfirm',
        deps: ['password'],
        rule: {
          crossValidator: (v: unknown, p: unknown) => (v === p ? true : '两次密码不一致'),
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '123', passwordConfirm: '123' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    await nextTick()
    // crossValidator 返回 true → clearValidate 清错误（已通过）
    expect(opts.clearValidate).toHaveBeenCalledWith(['passwordConfirm'])
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })

  it('changedField 不在 deps 里 → 不触发', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'passwordConfirm',
        deps: ['password'],
        rule: {
          crossValidator: (v: unknown, p: unknown) => (v === p ? true : 'err'),
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '1', passwordConfirm: '2' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('endDate')
    await nextTick()
    expect(opts.setFieldError).not.toHaveBeenCalled()
    expect(opts.clearValidate).not.toHaveBeenCalled()
  })

  it('changedField === target → 也触发（正向重算）', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'endDate',
        deps: ['startDate'],
        rule: {
          crossValidator: (_v: unknown, _s: unknown) => 'err',
          dependsOn: 'startDate',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { startDate: '2026-01-01', endDate: '2025-12-31' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('endDate')
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledWith('endDate', 'err')
  })

  it('trigger=manual 的规则跳过反向触发', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'manualField',
        deps: ['trigger'],
        rule: {
          crossValidator: () => 'should not run',
          dependsOn: 'trigger',
          trigger: 'manual',
        },
      },
    ]
    const model: Record<string, unknown> = { trigger: 'x', manualField: 'y' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('trigger')
    await nextTick()
    expect(opts.setFieldError).not.toHaveBeenCalled()
    expect(opts.clearValidate).not.toHaveBeenCalled()
  })

  it('crossValidator 返回 string → setFieldError 写入错误', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'passwordConfirm',
        deps: ['password'],
        rule: {
          crossValidator: () => '两次密码不一致',
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '1', passwordConfirm: '2' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledWith('passwordConfirm', '两次密码不一致')
  })

  it('crossValidator 返回 true → clearValidate 清错误', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'passwordConfirm',
        deps: ['password'],
        rule: {
          crossValidator: () => true as const,
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '1', passwordConfirm: '2' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    await nextTick()
    expect(opts.clearValidate).toHaveBeenCalledWith(['passwordConfirm'])
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })

  it('crossValidator 返回 Promise<true> → async clear', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'p2',
        deps: ['p1'],
        rule: {
          crossValidator: () => Promise.resolve(true as const),
          dependsOn: 'p1',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { p1: 'x', p2: 'y' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('p1')
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(opts.clearValidate).toHaveBeenCalledWith(['p2'])
  })

  it('crossValidator 返回 Promise<string> → async setFieldError', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'p2',
        deps: ['p1'],
        rule: {
          crossValidator: () => Promise.resolve('async err'),
          dependsOn: 'p1',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { p1: 'x', p2: 'y' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('p1')
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(opts.setFieldError).toHaveBeenCalledWith('p2', 'async err')
  })

  it('crossValidator Promise reject → console.error 不抛错', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rules: ReverseRule[] = [
      {
        target: 'p2',
        deps: ['p1'],
        rule: {
          crossValidator: () => Promise.reject(new Error('boom')),
          dependsOn: 'p1',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { p1: 'x', p2: 'y' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('p1')
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(errorSpy).toHaveBeenCalled()
    expect(opts.setFieldError).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('useCrossFieldTrigger / 空值跳过', () => {
  it('target value === "" → clearValidate 不写错误', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'passwordConfirm',
        deps: ['password'],
        rule: {
          crossValidator: () => 'err',
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '1', passwordConfirm: '' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    await nextTick()
    expect(opts.clearValidate).toHaveBeenCalledWith(['passwordConfirm'])
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })

  it('target value === null → clearValidate', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'passwordConfirm',
        deps: ['password'],
        rule: {
          crossValidator: () => 'err',
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '1', passwordConfirm: null }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    await nextTick()
    expect(opts.clearValidate).toHaveBeenCalledWith(['passwordConfirm'])
  })

  it('target value === undefined → clearValidate', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'passwordConfirm',
        deps: ['password'],
        rule: {
          crossValidator: () => 'err',
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '1' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    await nextTick()
    expect(opts.clearValidate).toHaveBeenCalledWith(['passwordConfirm'])
  })
})

describe('useCrossFieldTrigger / 多 deps', () => {
  it('dependsOn 数组只触发 dep 命中的规则', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'target',
        deps: ['a', 'b'],
        rule: {
          crossValidator: (_v: unknown, _a: unknown, _b: unknown) => 'err',
          dependsOn: ['a', 'b'],
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { a: '1', b: '2', target: 'x' }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('a')
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledWith('target', 'err')

    opts.setFieldError.mockClear()
    trigger('b')
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledWith('target', 'err')

    opts.setFieldError.mockClear()
    trigger('other')
    await nextTick()
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })
})

describe('useCrossFieldTrigger / model watch 兜底路径', () => {
  it('model 字段变化 → 自动 trigger 该字段', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'passwordConfirm',
        deps: ['password'],
        rule: {
          crossValidator: (v: unknown, p: unknown) => (v === p ? true : '两次密码不一致'),
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const modelRef = ref<Record<string, unknown>>({ password: '1', passwordConfirm: '1' })
    const opts = makeOpts(rules, () => modelRef.value)
    useCrossFieldTrigger(opts)

    // model 变化：直接修改值（不走 onValueChange）
    modelRef.value = { password: '1', passwordConfirm: '2' }
    await nextTick()

    expect(opts.setFieldError).toHaveBeenCalledWith('passwordConfirm', '两次密码不一致')
  })

  it('H3 回归：直改嵌套路径（绕过 v-model）→ deps 快照 diff 命中 → 触发 crossValidator', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: (_v: unknown, age: unknown) => {
            call++
            return Number(age) >= 18 ? true : '未成年'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    // 用 reactive() 让嵌套属性可 deep watch
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x' })
    const opts = makeOpts(rules, () => model)
    useCrossFieldTrigger(opts)
    await nextTick()
    call = 0 // 排除 setup 期可能的初始触发计数

    // H3 场景：demo 程序直改嵌套路径（不走 v-model / onValueChange）
    ;(model.user as { age: number }).age = 30
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(1)
    expect(opts.clearValidate).toHaveBeenCalledWith(['label'])
  })

  it('H3 回归：与任何 rule 无关的字段变化 → 不触发（新旧逻辑行为等价，新逻辑不再空跑 run）', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x', noise: 1 })
    const opts = makeOpts(rules, () => model)
    useCrossFieldTrigger(opts)
    await nextTick()
    call = 0

    model.noise = 999
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(0)
  })

  it('model 从 undefined → {} 不抛错', async () => {
    const rules: ReverseRule[] = [
      {
        target: 't',
        deps: ['a'],
        rule: {
          crossValidator: () => true as const,
          dependsOn: 'a',
          trigger: 'change',
        },
      },
    ]
    const modelRef = ref<Record<string, unknown> | undefined>(undefined)
    const opts = makeOpts(rules, () => modelRef.value)
    expect(() => useCrossFieldTrigger(opts)).not.toThrow()
  })

  it('H3 修复附带语义：直改 target 值（绕过 v-model）→ target 快照变化 → 正向重算', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: (v: unknown, age: unknown) => {
            call++
            return Number(age) >= 18 || v === '' ? true : '未成年'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 30 }, label: 'x' })
    const opts = makeOpts(rules, () => model)
    useCrossFieldTrigger(opts)
    await nextTick()
    call = 0

    model.label = 'y'
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(1)
  })

  it('H3 修复：同 tick trigger(dep) + 直改同路径 → 去重窗口保留，只执行 1 次', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x' })
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('user.age') // 路径 1：onValueChange 精确触发（同步）
    ;(model.user as { age: number }).age = 11 // 路径 2：同 tick deep watch diff
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(1)
  })

  it('H3 修复：rules 整体替换后快照重置，不因旧快照误触发', async () => {
    let call = 0
    const rulesA: ReverseRule[] = [
      {
        target: 'label',
        deps: ['a'],
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'a',
          trigger: 'change',
        },
      },
    ]
    const rulesRef = ref(rulesA)
    const model = reactive<Record<string, unknown>>({ a: 1, label: 'x' })
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    useCrossFieldTrigger({
      crossRules: () => rulesRef.value,
      model: () => model,
      setFieldError,
      clearValidate,
    })
    await nextTick()
    call = 0

    // 替换为无关 rule（deps 完全不同），随后改旧 dep → 不应触发旧 rule
    rulesRef.value = [
      {
        target: 'other',
        deps: ['b'],
        rule: {
          crossValidator: () => 'other err',
          dependsOn: 'b',
          trigger: 'change',
        },
      },
    ]
    await nextTick()
    model.a = 2
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(0)
  })

  it('watchFallback=false → 直改 model 字段不触发 crossValidator（兜底关闭，纯 v-model 表单可省 deep watch）', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x' })
    const opts = makeOpts(rules, () => model, { watchFallback: false })
    useCrossFieldTrigger(opts)
    await nextTick()
    call = 0

    // 直改嵌套路径（绕过 v-model）——watchFallback=false 时兜底 deep watch 未注册，不应触发
    ;(model.user as { age: number }).age = 30
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(0)
  })

  it('watchFallback=false → trigger(dep) 精确路径仍可用（只关兜底，不关正触发）', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: (_v: unknown, age: unknown) => {
            call++
            return Number(age) >= 18 ? true : '未成年'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x' })
    const opts = makeOpts(rules, () => model, { watchFallback: false })
    const { trigger } = useCrossFieldTrigger(opts)
    await nextTick()
    call = 0

    trigger('user.age') // 精确路径：不受 watchFallback 影响
    await nextTick()

    expect(call).toBe(1)
    expect(opts.setFieldError).toHaveBeenCalledWith('label', '未成年')
  })

  it('watchFallback 缺省（undefined）→ 向后兼容：直改 model 字段仍触发（同显式 true）', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'label',
        deps: ['user.age'],
        rule: {
          crossValidator: (_v: unknown, age: unknown) => {
            call++
            return Number(age) >= 18 ? true : '未成年'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 10 }, label: 'x' })
    const opts = makeOpts(rules, () => model) // 不传 watchFallback → undefined → 默认 true
    useCrossFieldTrigger(opts)
    await nextTick()
    call = 0

    ;(model.user as { age: number }).age = 30
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    expect(call).toBe(1)
    expect(opts.clearValidate).toHaveBeenCalledWith(['label'])
  })
})

describe('useCrossFieldTrigger / onFormReset（reset 后不重校验）', () => {
  it('reset 值变化后同 tick 调 onFormReset → 兜底 watch 空跑，不触发 crossValidator', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'user.age',
        deps: ['user.age'],
        rule: {
          crossValidator: (_v: unknown, age: unknown) => {
            call++
            return Number(age) >= 18 ? true : '未成年'
          },
          dependsOn: 'user.age',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ user: { age: 30 } })
    const opts = makeOpts(rules, () => model)
    const { onFormReset } = useCrossFieldTrigger(opts)
    await nextTick()
    call = 0

    // 模拟 resetFields：model 被重置回初始值（age 10），同 tick 内调 onFormReset 重拍快照
    ;(model.user as { age: number }).age = 10
    onFormReset()
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))

    // ★ 旧逻辑：watch diff 命中 user.age → crossValidator(10) 重跑 → 未成年错误复现
    expect(call).toBe(0)
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })

  it('onFormReset 取消排队中的 debounce runner（timer 到期不执行）', async () => {
    vi.useFakeTimers()
    const rules: ReverseRule[] = [
      {
        target: 'confirmPassword',
        deps: ['password'],
        rule: {
          debounceMs: 500,
          crossValidator: () => 'err',
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '1', confirmPassword: '1' }
    const opts = makeOpts(rules, () => model)
    const { trigger, onFormReset } = useCrossFieldTrigger(opts)

    trigger('password') // debounce 排队中
    onFormReset() // 取消排队 runner
    vi.advanceTimersByTime(500)
    expect(opts.setFieldError).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('useCrossFieldTrigger / 卸载清理', () => {
  it('stop() 卸载后 trigger 不再生效', async () => {
    const rules: ReverseRule[] = [
      {
        target: 't',
        deps: ['a'],
        rule: {
          crossValidator: () => 'err',
          dependsOn: 'a',
          trigger: 'change',
        },
      },
    ]
    const modelRef = ref<Record<string, unknown>>({ a: 'x', t: 'y' })
    const setFieldError = vi.fn()
    const clearValidate = vi.fn()
    const { trigger, stop } = useCrossFieldTrigger({
      crossRules: () => rules,
      model: () => modelRef.value,
      setFieldError,
      clearValidate,
    })

    trigger('a')
    await nextTick()
    expect(setFieldError).toHaveBeenCalledTimes(1)

    stop()
    setFieldError.mockClear()

    // 模型变化，stop 后 watch 不应再触发
    modelRef.value = { a: 'y', t: 'z' }
    await nextTick()
    expect(setFieldError).not.toHaveBeenCalled()
  })
})

describe('useCrossFieldTrigger / 异步竞态防护（H3 回归）', () => {
  it('旧 Promise 后返回不覆盖新结果（序号令牌）', async () => {
    let resolveOld!: (v: true | string) => void
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'b',
        deps: ['a'],
        rule: {
          dependsOn: 'a',
          crossValidator: () => {
            call++
            return call === 1
              ? new Promise<true | string>((r) => {
                  resolveOld = r
                })
              : '新错误'
          },
          trigger: 'change',
        },
      },
    ]
    const model = reactive({ a: '1', b: 'x' })
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('a') // 第一次：慢 Promise
    trigger('a') // 第二次：同步返回 '新错误'
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledWith('b', '新错误')
    opts.setFieldError.mockClear()
    resolveOld(true) // 旧 Promise 后返回 → 应被丢弃
    await nextTick()
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })
})

describe('useCrossFieldTrigger / debounce 调度', () => {
  function makeOptsWithDebounce(
    rules: ReverseRule[],
    modelGetter: () => Record<string, unknown> | undefined,
    defaultDebounceMs?: number
  ): UseCrossFieldTriggerOptions & {
    setFieldError: ReturnType<typeof vi.fn>
    clearValidate: ReturnType<typeof vi.fn>
  } {
    const opts = makeOpts(rules, modelGetter) as UseCrossFieldTriggerOptions & {
      setFieldError: ReturnType<typeof vi.fn>
      clearValidate: ReturnType<typeof vi.fn>
    }
    if (defaultDebounceMs !== undefined) {
      // getter 形式：内部把 number 包成 () => number 让 useCrossFieldTrigger 实时取值
      ;(opts as { defaultDebounceMs?: () => number }).defaultDebounceMs = () => defaultDebounceMs
    }
    return opts
  }

  it('字段级 debounceMs: 500 → 连触发 5 次只跑 1 次 crossValidator', async () => {
    vi.useFakeTimers()
    const rules: ReverseRule[] = [
      {
        target: 'confirmPassword',
        deps: ['password'],
        rule: {
          debounceMs: 500,
          crossValidator: () => 'err',
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { password: '1', confirmPassword: '1' }
    const opts = makeOptsWithDebounce(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    trigger('password')
    trigger('password')
    trigger('password')
    trigger('password')
    // debounce 期内未到期：crossValidator 未跑
    expect(opts.setFieldError).not.toHaveBeenCalled()
    // 推进到 debounce 到期
    vi.advanceTimersByTime(500)
    expect(opts.setFieldError).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('全局 defaultDebounceMs: 300 → 字段未设 debounceMs 继承全局', async () => {
    vi.useFakeTimers()
    const rules: ReverseRule[] = [
      {
        target: 'target',
        deps: ['a'],
        // 字段级 debounceMs 未设 → 继承 defaultDebounceMs: 300
        rule: { crossValidator: () => 'err', dependsOn: 'a', trigger: 'change' },
      },
    ]
    const model: Record<string, unknown> = { a: '1', target: 'x' }
    const opts = makeOptsWithDebounce(rules, () => model, 300)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('a')
    trigger('a')
    expect(opts.setFieldError).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(opts.setFieldError).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('字段级 debounceMs: 0 → 强制实时（覆盖全局 500ms）', () => {
    // 同步路径不需要 fake timers
    const rules: ReverseRule[] = [
      {
        target: 'target',
        deps: ['a'],
        rule: { debounceMs: 0, crossValidator: () => 'err', dependsOn: 'a', trigger: 'change' },
      },
    ]
    const model: Record<string, unknown> = { a: '1', target: 'x' }
    const opts = makeOptsWithDebounce(rules, () => model, 500) // 全局 500ms
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('a')
    expect(opts.setFieldError).toHaveBeenCalledTimes(1) // 立即执行
  })
})

describe('useCrossFieldTrigger / 同 tick 双路径去重', () => {
  // 真实时序：用户按键 → XForm.onValueChange 同步调 trigger(field)，
  // 同一 tick 内 deep watch model 也 diff 出同一字段 → 两条路径都 run(field)。
  // delay=0（实时模式）下若不去重，crossValidator 每键执行 2 次（demo counter 虚高）。
  it('delay=0：trigger + model watch 同一 tick 触发同一字段 → crossValidator 只执行 1 次', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'confirmPassword',
        deps: ['password'],
        rule: {
          debounceMs: 0,
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ password: '1', confirmPassword: 'x' })
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password') // 路径 1：onValueChange 精确触发（同步）
    model.password = '2' // 路径 2：同 tick 内 model 变化 → deep watch diff
    await nextTick()

    expect(call).toBe(1)
  })

  it('delay>0：同一 tick 双路径触发 → debounce 到期只执行 1 次', async () => {
    vi.useFakeTimers()
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'confirmPassword',
        deps: ['password'],
        rule: {
          debounceMs: 500,
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ password: '1', confirmPassword: 'x' })
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    model.password = '2'
    await nextTick()
    vi.advanceTimersByTime(500)

    expect(call).toBe(1)
    vi.useRealTimers()
  })

  it('去重只作用于同一 tick：下一 tick 字段再次变化 → 重新触发', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'confirmPassword',
        deps: ['password'],
        rule: {
          debounceMs: 0,
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: 'password',
          trigger: 'change',
        },
      },
    ]
    const model = reactive<Record<string, unknown>>({ password: '1', confirmPassword: 'x' })
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('password')
    model.password = '2'
    await nextTick()
    expect(call).toBe(1)

    // 下一 tick 用户继续输入：deep watch diff 应重新触发（去重不能吞掉真实变化）
    model.password = '3'
    await nextTick()
    expect(call).toBe(2)
  })
})

describe('useCrossFieldTrigger / 数组行模板规则（A1-反向）', () => {
  /**
   * 行模板形态：useSchemaIndex 对 array.itemSchema 产出的条目 ——
   * target/deps 是行内相对名（'subtotal' / ['qty','price']），rowScoped 标记。
   * 运行时 XForm onValueChange 传入全路径 'items[0].qty'，需按行前缀 concrete 化后执行。
   */
  function makeRowTemplateRule(): ReverseRule {
    return {
      target: 'subtotal',
      deps: ['qty', 'price'],
      rowScoped: true,
      rule: {
        crossValidator: (v: unknown, qty: unknown, price: unknown) =>
          Number(v) === Number(qty) * Number(price) ? true : '行小计不等于数量×单价',
        dependsOn: ['qty', 'price'],
        trigger: 'change',
      },
    }
  }

  it('trigger("items[0].qty") → 命中行模板，错误写入 items[0].subtotal 全路径', async () => {
    const model: Record<string, unknown> = {
      items: [{ qty: 2, price: 3, subtotal: 99 }],
    }
    const opts = makeOpts([makeRowTemplateRule()], () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('items[0].qty')
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledWith('items[0].subtotal', '行小计不等于数量×单价')
  })

  it('行模板 pass → clearValidate 用全路径清错', async () => {
    const model: Record<string, unknown> = {
      items: [{ qty: 2, price: 3, subtotal: 6 }],
    }
    const opts = makeOpts([makeRowTemplateRule()], () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('items[0].qty')
    await nextTick()
    expect(opts.clearValidate).toHaveBeenCalledWith(['items[0].subtotal'])
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })

  it('validator 收到的 dep 值来自本行（非顶层同名字段）—— 行内相对优先', async () => {
    const seen: unknown[] = []
    const rules: ReverseRule[] = [
      {
        target: 'subtotal',
        deps: ['qty'],
        rowScoped: true,
        rule: {
          crossValidator: (v: unknown, qty: unknown) => {
            seen.push(qty)
            return true as const
          },
          dependsOn: ['qty'],
          trigger: 'change',
        },
      },
    ]
    // 顶层有同名 qty=999，行内 qty=2 —— 必须取行内值
    const model: Record<string, unknown> = {
      qty: 999,
      items: [{ qty: 2, subtotal: 0 }],
    }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('items[0].qty')
    await nextTick()
    expect(seen).toEqual([2])
  })

  it('混合语义「顶层绝对回退」：行内无该键时 dep 取顶层值', async () => {
    const seen: unknown[] = []
    const rules: ReverseRule[] = [
      {
        target: 'amount',
        deps: ['cap'],
        rowScoped: true,
        rule: {
          crossValidator: (v: unknown, cap: unknown) => {
            seen.push(cap)
            return true as const
          },
          dependsOn: ['cap'],
          trigger: 'change',
        },
      },
    ]
    // 「行小计 ≤ 全局上限」场景：行内无 cap，顶层 cap=100
    const model: Record<string, unknown> = {
      cap: 100,
      items: [{ amount: 150 }],
    }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('items[0].amount')
    await nextTick()
    expect(seen).toEqual([100])
  })

  it('多行隔离：trigger("items[1].qty") 只写 items[1].subtotal', async () => {
    const model: Record<string, unknown> = {
      items: [
        { qty: 2, price: 3, subtotal: 6 },
        { qty: 1, price: 1, subtotal: 99 },
      ],
    }
    const opts = makeOpts([makeRowTemplateRule()], () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('items[1].qty')
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledTimes(1)
    expect(opts.setFieldError).toHaveBeenCalledWith('items[1].subtotal', '行小计不等于数量×单价')
  })

  it('trigger("items[0].subtotal")（target 命中）→ 也触发本行规则', async () => {
    const model: Record<string, unknown> = {
      items: [{ qty: 2, price: 3, subtotal: 99 }],
    }
    const opts = makeOpts([makeRowTemplateRule()], () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('items[0].subtotal')
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledWith('items[0].subtotal', '行小计不等于数量×单价')
  })

  it('无关字段变化不触发模板（trigger("other") → 不跑）', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        target: 'subtotal',
        deps: ['qty'],
        rowScoped: true,
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: ['qty'],
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { other: 'x', items: [{ qty: 1, subtotal: 1 }] }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('other')
    await nextTick()
    expect(call).toBe(0)
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })

  it('rowScoped 未标记的规则保持原行为：相对 deps 不匹配全路径 changedField（防误伤顶层规则）', async () => {
    let call = 0
    const rules: ReverseRule[] = [
      {
        // 顶层规则但 deps 是相对名（如手写 schema 未走 itemSchema）——rowScoped 未标记
        target: 'total',
        deps: ['qty'],
        rule: {
          crossValidator: () => {
            call++
            return 'err'
          },
          dependsOn: ['qty'],
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { total: 0, items: [{ qty: 1 }] }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('items[0].qty')
    await nextTick()
    expect(call).toBe(0)
  })

  it('嵌套数组：trigger("orders[0].items[1].qty") → 写 orders[0].items[1].subtotal', async () => {
    const model: Record<string, unknown> = {
      orders: [
        {
          items: [
            { qty: 1, price: 1, subtotal: 1 },
            { qty: 2, price: 3, subtotal: 99 },
          ],
        },
      ],
    }
    const opts = makeOpts([makeRowTemplateRule()], () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('orders[0].items[1].qty')
    await nextTick()
    expect(opts.setFieldError).toHaveBeenCalledWith(
      'orders[0].items[1].subtotal',
      '行小计不等于数量×单价'
    )
  })

  it('行内空值跳过语义保持：target（concrete 后）为空 → clearValidate 全路径', async () => {
    const rules: ReverseRule[] = [
      {
        target: 'subtotal',
        deps: ['qty'],
        rowScoped: true,
        rule: {
          crossValidator: () => 'err',
          dependsOn: ['qty'],
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = { items: [{ qty: 1, subtotal: '' }] }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    trigger('items[0].qty')
    await nextTick()
    expect(opts.clearValidate).toHaveBeenCalledWith(['items[0].subtotal'])
    expect(opts.setFieldError).not.toHaveBeenCalled()
  })

  // 2026-10-19 浏览器实测暴露：同一 target 多条 cross 规则（不同 deps）时，runner 缓存
  // key 为 `${target}|${delay}` —— 两规则 key 相同，第二条命中第一条的缓存 runner
  // （闭包绑第一条的 rule 引用）→ 第二条规则永不被执行。修复后缓存 key 为 rule 引用。
  it('同 target 多条规则：分别 trigger 各自 deps，两条规则都必须执行', async () => {
    const seen: string[] = []
    const rules: ReverseRule[] = [
      {
        target: 'qty',
        deps: ['stock'],
        rowScoped: true,
        rule: {
          crossValidator: (v: unknown, stock: unknown) => {
            seen.push(`stock-rule:${String(stock)}`)
            return Number(v) <= Number(stock) ? true : '超库存'
          },
          dependsOn: ['stock'],
          trigger: 'change',
        },
      },
      {
        target: 'qty',
        deps: ['maxQty'],
        rowScoped: true,
        rule: {
          crossValidator: (v: unknown, maxQty: unknown) => {
            seen.push(`maxQty-rule:${String(maxQty)}`)
            return Number(v) <= Number(maxQty) ? true : '超上限'
          },
          dependsOn: ['maxQty'],
          trigger: 'change',
        },
      },
    ]
    const model: Record<string, unknown> = {
      rows: [{ stock: 20, maxQty: 8, qty: 10 }],
    }
    const opts = makeOpts(rules, () => model)
    const { trigger } = useCrossFieldTrigger(opts)

    // 改 stock：只应执行规则 1（10 ≤ 20 pass → clearValidate）
    trigger('rows[0].stock')
    await nextTick()
    expect(seen).toEqual(['stock-rule:20'])
    expect(opts.clearValidate).toHaveBeenCalledWith(['rows[0].qty'])

    // 改 maxQty：只应执行规则 2（10 > 8 fail → setFieldError「超上限」）
    // 修复前：命中规则 1 的缓存 runner，实际又跑了规则 1（10 ≤ 20 pass），此断言红
    seen.length = 0
    trigger('rows[0].maxQty')
    await nextTick()
    expect(seen).toEqual(['maxQty-rule:8'])
    expect(opts.setFieldError).toHaveBeenCalledWith('rows[0].qty', '超上限')
  })
})
