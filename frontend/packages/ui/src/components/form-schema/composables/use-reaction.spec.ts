import { describe, it, expect, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import type { SchemaNode } from '../types'
import { containsReaction, applyReactions, createBudget } from './use-reaction'

describe('containsReaction(schema)', () => {
  it('returns true if any node has reaction field', () => {
    expect(containsReaction({ reaction: { label: 'x' } })).toBe(true)
    expect(containsReaction({ children: [{ reaction: { label: 'x' } }] })).toBe(true)
    expect(containsReaction({ slots: { default: { reaction: { hidden: true } } } })).toBe(true)
  })

  it('returns false otherwise', () => {
    expect(containsReaction({ component: 'Input' })).toBe(false)
    expect(containsReaction({ children: [{ component: 'Input' }] })).toBe(false)
    expect(containsReaction({})).toBe(false)
  })

  it('returns false for empty array', () => {
    expect(containsReaction([])).toBe(false)
  })
})

describe('applyReactions(node, model, stoppers)', () => {
  it('applies reaction.label as literal string', () => {
    const node = {
      reaction: { label: '新标签' },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, {}, stoppers)
    expect(node.label).toBe('新标签')
    expect(node.reaction).toBeUndefined()
    expect(stoppers.length).toBe(0)
  })

  it('applies reaction.label as function and registers watcher', async () => {
    const node = {
      reaction: { label: (m: { x: boolean }) => (m.x ? 'A' : 'B') },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, { x: true }, stoppers)
      // sync 模式 setup 立即跑一次
      expect(node.label).toBe('A')
      expect(stoppers.length).toBeGreaterThan(0)
    })
    scope.stop()
    expect(stoppers.length).toBe(1)
    stoppers.forEach((s) => s())
  })

  it('applies reaction as function expression string', async () => {
    const node = {
      reaction: { label: '{{ (m) => m.x ? "A" : "B" }}' },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, { x: true }, stoppers)
      expect(node.label).toBe('A')
    })
    scope.stop()
    stoppers.forEach((s) => s())
  })

  it('recurses into children array', () => {
    const node = {
      children: [{ reaction: { label: 'child label' } }],
    }
    const stoppers: (() => void)[] = []
    applyReactions(node, {}, stoppers)
    expect((node.children as Array<{ label?: string }>)[0]!.label).toBe('child label')
  })

  it('recurses into single child object', () => {
    const node = {
      children: { reaction: { label: 'single child' } },
    }
    const stoppers: (() => void)[] = []
    applyReactions(node, {}, stoppers)
    expect((node.children as { label?: string }).label).toBe('single child')
  })

  it('catches evaluation error and keeps last value', () => {
    const node = {
      reaction: {
        label: () => {
          throw new Error('boom')
        },
      },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => applyReactions(node, {}, stoppers)).not.toThrow()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
    stoppers.forEach((s) => s())
  })

  it('does not crash on nodes without reaction', () => {
    const node = { component: 'Input', name: 'x' }
    const stoppers: (() => void)[] = []
    expect(() => applyReactions(node, {}, stoppers)).not.toThrow()
    expect(stoppers.length).toBe(0)
  })

  // ============ strategy + delay 测试(简化版) ============

  it('strategy="sync"(默认): setup 立即同步执行 + watch 后续变化', async () => {
    const m = reactive({ x: 1 })
    const node = {
      reaction: {
        // strategy 未指定,默认 sync
        label: () => (m.x > 0 ? 'positive' : 'zero'),
      },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, m, stoppers)
      expect(node.label).toBe('positive')
      // mutate model,触发 watch
      m.x = -1
    })
    await nextTick()
    expect(node.label).toBe('zero')
    scope.stop()
    stoppers.forEach((s) => s())
  })

  it('strategy="sync" 显式声明: 行为同上', async () => {
    const m = reactive({ x: 1 })
    const node = {
      reaction: {
        strategy: 'sync' as const,
        delay: 999, // sync 时 delay 被忽略
        label: () => 'explicit',
      },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, m, stoppers)
      expect(node.label).toBe('explicit')
    })
    scope.stop()
    stoppers.forEach((s) => s())
  })

  it('strategy="debounce" + delay: 注册 watcher 且 setup 不跑', () => {
    // 集成测试(fake timers + deep watch 在 vue 3 + vitest 下不稳定),
    // 这里只验证策略分支:debounce 模式 setup 不跑,只注册 watcher
    const callCount = vi.fn()
    const node = {
      reaction: {
        strategy: 'debounce' as const,
        delay: 300,
        label: () => {
          callCount()
          return 'x'
        },
      },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, {}, stoppers)
      // debounce 模式 setup 不跑,只注册 watcher
      expect(callCount).toHaveBeenCalledTimes(0)
      expect(stoppers.length).toBeGreaterThan(0)
    })
    scope.stop()
    stoppers.forEach((s) => s())
  })

  it('strategy="throttle" + delay: 注册 watcher 且 setup 不跑', () => {
    const callCount = vi.fn()
    const node = {
      reaction: {
        strategy: 'throttle' as const,
        delay: 100,
        label: () => {
          callCount()
          return 'x'
        },
      },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, {}, stoppers)
      expect(callCount).toHaveBeenCalledTimes(0)
      expect(stoppers.length).toBeGreaterThan(0)
    })
    scope.stop()
    stoppers.forEach((s) => s())
  })

  it('delay: 0 时即使 strategy=debounce 也走 sync 路径(立即同步执行)', () => {
    const callCount = vi.fn()
    const node = {
      reaction: {
        strategy: 'debounce' as const,
        delay: 0, // 0 delay 退化
        label: () => {
          callCount()
          return 'x'
        },
      },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, {}, stoppers)
      // delay=0 时走 sync 分支,runner 立即跑
      expect(callCount).toHaveBeenCalledTimes(1)
    })
    scope.stop()
    stoppers.forEach((s) => s())
  })

  // ---- H5 回归：deps 精确监听 + 循环联动预算 ----

  it('声明 deps 时仅响应依赖路径变化（无关字段不触发）', async () => {
    const runnerSpy = vi.fn()
    const node = {
      reaction: {
        deps: ['a'],
        label: (m: { a: number }) => {
          runnerSpy()
          return String(m.a)
        },
      },
    } as unknown as SchemaNode
    const model = reactive({ a: 1, b: 100 })
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, model, stoppers)
    })
    // sync 模式 setup 立即跑一次
    expect(runnerSpy).toHaveBeenCalledTimes(1)
    model.b = 200 // 无关字段变化
    await nextTick()
    expect(runnerSpy).toHaveBeenCalledTimes(1)
    model.a = 2 // 依赖字段变化
    await nextTick()
    expect(runnerSpy).toHaveBeenCalledTimes(2)
    expect(node.label).toBe('2')
    scope.stop()
    stoppers.forEach((s) => s())
  })

  it('未声明 deps 时保持 deep watch 旧行为（任意字段变化都触发）', async () => {
    const runnerSpy = vi.fn()
    const node = {
      reaction: {
        label: (m: { a: number }) => {
          runnerSpy()
          return String(m.a)
        },
      },
    } as unknown as SchemaNode
    const model = reactive({ a: 1, b: 100 })
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, model, stoppers)
    })
    expect(runnerSpy).toHaveBeenCalledTimes(1)
    model.b = 200
    await nextTick()
    expect(runnerSpy).toHaveBeenCalledTimes(2)
    scope.stop()
    stoppers.forEach((s) => s())
  })

  it('reaction 写自身依赖构成环时，执行预算兜底（不卡死 + console.error 告警）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const model = reactive({ a: 0 })
    const node = {
      reaction: {
        deps: ['a'],
        // 每次执行都改 a → 再次触发自身 watch → 无预算时无限循环
        label: (m: { a: number }) => {
          m.a++
          return 'x'
        },
      },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, model, stoppers)
    })
    model.a = 5 // 外部触发一次，引爆循环链
    await nextTick()
    await nextTick()
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('疑似循环联动'))
    // 预算截断：初始 1 次 + 单 flush 上限 50 次，不可能无限增长
    expect(model.a).toBeLessThanOrEqual(60)
    scope.stop()
    stoppers.forEach((s) => s())
    errSpy.mockRestore()
  })
})

/**
 * P2-3 reactionBudget 可配置化 守护测试
 *
 * 验证点：
 * 1. createBudget(max) 接受 max 参数,budget 实例 .max 字段可读
 * 2. 默认 max = DEFAULT_REACTION_BUDGET = 50
 * 3. console.error 模板用 budget.max（不是硬编码常量）—— 修复 P2-3 typo
 * 4. 透过 useSchemaRenderer 链路，XFormProps.reactionBudget 改变 console 文案
 */
describe('P2-3 reactionBudget 可配置化', () => {
  it('createBudget 默认 max = DEFAULT_REACTION_BUDGET (50)', async () => {
    const { createBudget, DEFAULT_REACTION_BUDGET } = await import('./use-reaction')
    expect(DEFAULT_REACTION_BUDGET).toBe(50)
    const budget = createBudget()
    expect(budget.max).toBe(50)
    // 默认预算允许 50 次进入
    for (let i = 0; i < 50; i++) {
      expect(budget.enter()).toBe(true)
    }
    // 第 51 次拒绝
    expect(budget.enter()).toBe(false)
  })

  it('createBudget(自定义 max) 接受任意 max 值', async () => {
    const { createBudget } = await import('./use-reaction')
    const budget = createBudget(10)
    expect(budget.max).toBe(10)
    for (let i = 0; i < 10; i++) {
      expect(budget.enter()).toBe(true)
    }
    expect(budget.enter()).toBe(false)
  })

  it('applyReactions 触发循环时 console.error 文案含 budget.max（非硬编码 50）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { applyReactions, createBudget } = await import('./use-reaction')
    const model = reactive({ a: 0 })
    const node = {
      reaction: {
        deps: ['a'],
        // 写自身依赖 → 触发循环
        label: (m: { a: number }) => {
          m.a++
          return 'x'
        },
      },
    } as unknown as SchemaNode
    const stoppers: (() => void)[] = []
    const budget = createBudget(100)
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, model, stoppers, budget)
    })
    model.a = 5
    await nextTick()
    await nextTick()
    // 关键断言：文案必须含 "100"（实际 max），不能是 "50"（硬编码常量）
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('100'))
    expect(errSpy).not.toHaveBeenCalledWith(expect.stringContaining('超过 50 次'))
    scope.stop()
    stoppers.forEach((s) => s())
    errSpy.mockRestore()
  })
})

describe('H1 修复：standalone disabled/hidden 函数形态克隆阶段归一化', () => {
  it('containsReaction：standalone 函数 / {{ }} 形态 disabled/hidden 视为含 reaction', () => {
    expect(
      containsReaction({ component: 'Input', name: 'a', disabled: () => true } as SchemaNode)
    ).toBe(true)
    expect(
      containsReaction({
        component: 'Input',
        name: 'a',
        hidden: '{{ (m) => !!m.x }}',
      } as SchemaNode)
    ).toBe(true)
    // 字面量 boolean 维持原状（不触发 watch 管线）
    expect(
      containsReaction({
        component: 'Input',
        name: 'a',
        disabled: true,
        hidden: false,
      } as SchemaNode)
    ).toBe(false)
    expect(containsReaction({ component: 'Input', name: 'a' } as SchemaNode)).toBe(false)
  })

  it('applyReactions：函数 disabled 求值写回 node，且随 model 联动', async () => {
    const model = reactive<Record<string, unknown>>({ agree: false })
    const node = reactive({
      component: 'Input',
      name: 'a',
      disabled: (m: Record<string, unknown>) => !m.agree,
    }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers)

    // sync 策略 setup 立即求值一次：agree=false → disabled=true
    expect(node.disabled).toBe(true)
    model.agree = true
    await nextTick()
    expect(node.disabled).toBe(false)

    stoppers.forEach((s) => s())
  })

  it('applyReactions：{{ }} 表达式 hidden 求值写回 node.hidden', async () => {
    const model = reactive<Record<string, unknown>>({ vip: true })
    const node = reactive({
      component: 'Input',
      name: 'a',
      hidden: '{{ (m) => !m.vip }}',
    }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers)

    expect(node.hidden).toBe(false)
    model.vip = false
    await nextTick()
    expect(node.hidden).toBe(true)

    stoppers.forEach((s) => s())
  })

  it('applyReactions：reaction 已有同名 key 时 reaction 优先，standalone 被忽略', async () => {
    const model = reactive<Record<string, unknown>>({ agree: false })
    const node = reactive({
      component: 'Input',
      name: 'a',
      disabled: () => true, // standalone：reaction 已有 disabled → 被忽略
      reaction: { disabled: (m: Record<string, unknown>) => !m.agree },
    }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers)

    // reaction 求值：agree=false → disabled=true；standalone 的 () => true 未生效
    expect(node.disabled).toBe(true)
    model.agree = true
    await nextTick()
    expect(node.disabled).toBe(false)

    stoppers.forEach((s) => s())
  })

  it('applyReactions：无 reaction 且无 standalone 动态形态 → 不注册 watcher', () => {
    const model = reactive<Record<string, unknown>>({})
    const node = reactive({ component: 'Input', name: 'a', disabled: true }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers)
    expect(stoppers).toHaveLength(0)
  })
})

describe('H2：applyReactions 注入 resolveFunctionExpression（实例级沙箱）', () => {
  it('注入的 resolve 优先于模块级：node.label 用注入解析器的结果', () => {
    const model: Record<string, unknown> = {}
    const node = reactive({
      component: 'Input',
      name: 'a',
      reaction: { label: '{{ () => tag() }}' },
    }) as SchemaNode
    // 注入解析器：任何表达式都返回 () => 'INJECTED'（as never 兼容泛型签名）
    const injectedResolve = () => (() => 'INJECTED') as never
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers, createBudget(), injectedResolve)

    expect(node.label).toBe('INJECTED')
    stoppers.forEach((s) => s())
  })

  it('未注入 resolve → 回退模块级（向后兼容）', () => {
    const model: Record<string, unknown> = {}
    const node = reactive({
      component: 'Input',
      name: 'a',
      reaction: { label: '{{ (m) => "plain" }}' },
    }) as SchemaNode
    const stoppers: (() => void)[] = []
    applyReactions(node, model, stoppers) // 无第 5 参

    expect(node.label).toBe('plain')
    stoppers.forEach((s) => s())
  })
})

describe('use-reaction / D(#7) deps 对象路径 deep watch', () => {
  it('deps 指向对象路径（user）时，对象内部嵌套变化（user.age）也触发重算', async () => {
    const runnerSpy = vi.fn()
    const node = {
      reaction: {
        deps: ['user'],
        label: (m: { user: { age: number } }) => {
          runnerSpy()
          return `age=${m.user.age}`
        },
      },
    } as unknown as SchemaNode
    const model = reactive({ user: { age: 10 }, other: 1 })
    const stoppers: (() => void)[] = []
    const scope = effectScope()
    scope.run(() => {
      applyReactions(node, model, stoppers)
    })
    expect(runnerSpy).toHaveBeenCalledTimes(1)
    // ★ 对象路径内部嵌套变化：修复前 watch 无 deep，锚定 user 引用不重算
    model.user.age = 30
    await nextTick()
    expect(runnerSpy).toHaveBeenCalledTimes(2)
    expect(node.label).toBe('age=30')
    // 无关字段仍不触发（deps 精确监听语义保持）
    model.other = 2
    await nextTick()
    expect(runnerSpy).toHaveBeenCalledTimes(2)
    scope.stop()
    stoppers.forEach((s) => s())
  })
})
