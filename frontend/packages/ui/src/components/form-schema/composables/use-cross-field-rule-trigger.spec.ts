/**
 * useCrossFieldRuleTrigger 单元测试
 *
 * 覆盖：
 * - 无 node.name → 直接 return
 * - 无 node.rules → 直接 return
 * - model undefined → 直接 return
 * - 空值跳过：currentValue 为 ''/undefined/null → 不跑 crossValidator
 * - 同步 crossValidator 返回 true → setFieldError(name, '', '') 清错
 * - 同步 crossValidator 返回 string → setFieldError(name, msg) 红字
 * - 异步 crossValidator 返回 Promise<true> → 清错
 * - 异步 crossValidator 返回 Promise<string> → 红字
 * - 异步 crossValidator reject → console.error + continue
 * - 序号令牌：旧 Promise 后返回不覆盖新结果
 * - matchTrigger 过滤：rule.trigger 与 eventType 不匹配 → 跳过
 * - crossValidator 缺失 / dependsOn 缺失 → 跳过
 * - rules 是字符串或 RuleItem → 归一化为数组
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCrossFieldRuleTrigger } from './use-cross-field-rule-trigger'
import type { RuleItem, SchemaNode } from '../types'

describe('useCrossFieldRuleTrigger', () => {
  let setFieldError: (name: string, message: string, state?: '' | 'error') => void

  beforeEach(() => {
    setFieldError = vi.fn() as unknown as typeof setFieldError
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeDeps(model?: Record<string, unknown>) {
    return {
      model: { value: model },
      setFieldError,
    }
  }

  it('node.name 缺失 → 直接 return', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({}))
    const node: SchemaNode = {
      component: 'Input',
      rules: [{ crossValidator: () => 'err', dependsOn: ['x'] } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).not.toHaveBeenCalled()
  })

  it('node.rules 缺失 → 直接 return', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x' }))
    const node: SchemaNode = { component: 'Input', name: 'a' }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).not.toHaveBeenCalled()
  })

  it('model undefined → 直接 return', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps(undefined))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: () => 'err', dependsOn: ['x'] } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).not.toHaveBeenCalled()
  })

  it('空值跳过：currentValue 为空字符串 → 不跑 crossValidator', async () => {
    const cv = vi.fn(() => 'err')
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: '' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: cv, dependsOn: ['x'] } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(cv).not.toHaveBeenCalled()
    expect(setFieldError).not.toHaveBeenCalled()
  })

  it('空值跳过：currentValue 为 undefined → 不跑', async () => {
    const cv = vi.fn(() => 'err')
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: undefined }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: cv, dependsOn: ['x'] } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(cv).not.toHaveBeenCalled()
  })

  it('同步 crossValidator 返回 true → 清错（3 参数）', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: () => true, dependsOn: ['b'] } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).toHaveBeenCalledWith('a', '', '')
  })

  it('同步 crossValidator 返回 string → 红字', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: () => '不一致', dependsOn: ['b'] } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).toHaveBeenCalledWith('a', '不一致')
  })

  it('异步 crossValidator 返回 Promise<true> → 清错', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [
        {
          crossValidator: async () => true,
          dependsOn: ['b'],
        } as RuleItem,
      ],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).toHaveBeenCalledWith('a', '', '')
  })

  it('异步 crossValidator 返回 Promise<string> → 红字', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [
        {
          crossValidator: async () => '异步校验失败',
          dependsOn: ['b'],
        } as RuleItem,
      ],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).toHaveBeenCalledWith('a', '异步校验失败')
  })

  it('异步 crossValidator reject → console.error 且 continue', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [
        {
          crossValidator: async () => {
            throw new Error('network error')
          },
          dependsOn: ['b'],
        } as RuleItem,
      ],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(errorSpy).toHaveBeenCalledWith('[XForm] crossValidator threw:', expect.any(Error))
    // 不写错误（异常 catch 后 continue）
    expect(setFieldError).not.toHaveBeenCalled()
  })

  it('matchTrigger 过滤：rule.trigger="change" 但 event=blur → 跳过', async () => {
    const cv = vi.fn(() => 'err')
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: cv, dependsOn: ['b'], trigger: 'change' } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(cv).not.toHaveBeenCalled()
    expect(setFieldError).not.toHaveBeenCalled()
  })

  it('matchTrigger 放行：rule.trigger="blur" + event=blur → 跑', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: () => 'err', dependsOn: ['b'], trigger: 'blur' } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).toHaveBeenCalledWith('a', 'err')
  })

  it('matchTrigger 放行：rule.trigger=数组 ["blur","change"] + event=change → 跑', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [
        { crossValidator: () => 'err', dependsOn: ['b'], trigger: ['blur', 'change'] } as RuleItem,
      ],
    }
    await triggerCrossFieldValidator(node, 'change')
    expect(setFieldError).toHaveBeenCalledWith('a', 'err')
  })

  it('crossValidator 缺失 → 跳过该 rule', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ dependsOn: ['b'] } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(setFieldError).not.toHaveBeenCalled()
  })

  it('dependsOn 缺失 → 跳过该 rule', async () => {
    const cv = vi.fn(() => 'err')
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: cv } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(cv).not.toHaveBeenCalled()
  })

  it('序号令牌：连续 blur 触发时，旧 Promise 后返回不覆盖新结果（H3）', async () => {
    let resolveFirst!: (v: string) => void
    let resolveSecond!: (v: string) => void
    const cv = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((r) => {
            resolveFirst = r
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<string>((r) => {
            resolveSecond = r
          })
      )

    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: cv, dependsOn: ['b'] } as RuleItem],
    }

    // 第一次触发（异步未完成）
    const first = triggerCrossFieldValidator(node, 'blur')
    // 第二次触发（异步也未完成）
    const second = triggerCrossFieldValidator(node, 'blur')

    // 旧 Promise 后返回（first 完成）
    resolveFirst('旧错误')
    await first
    // 此时不应写入错误（已被新的 triggerSeq 覆盖）
    expect(setFieldError).not.toHaveBeenCalled()

    // 新 Promise 后返回（second 完成）
    resolveSecond('新错误')
    await second
    expect(setFieldError).toHaveBeenCalledWith('a', '新错误')
  })

  it('规则归一化：rules 是字符串 → 包成单元素数组', async () => {
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(makeDeps({ a: 'x', b: 'y' }))
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      // type 断言：字符串形式通常表示命名规则引用，但这里允许运行时调 crossValidator（mock）
      rules: 'stringRule' as unknown as RuleItem,
    }
    await triggerCrossFieldValidator(node, 'blur')
    // 字符串类型不是 RuleItem 对象，跳过 crossValidator
    expect(setFieldError).not.toHaveBeenCalled()
  })

  it('dependsOn 数组形式：传多个依赖值', async () => {
    const cv = vi.fn((_v: unknown, ...rest: unknown[]) => `收到 ${rest.join(',')}`)
    const { triggerCrossFieldValidator } = useCrossFieldRuleTrigger(
      makeDeps({ a: 'x', b: 'y', c: 'z' })
    )
    const node: SchemaNode = {
      component: 'Input',
      name: 'a',
      rules: [{ crossValidator: cv, dependsOn: ['b', 'c'] } as RuleItem],
    }
    await triggerCrossFieldValidator(node, 'blur')
    expect(cv).toHaveBeenCalledWith('x', 'y', 'z')
    expect(setFieldError).toHaveBeenCalledWith('a', '收到 y,z')
  })
})
