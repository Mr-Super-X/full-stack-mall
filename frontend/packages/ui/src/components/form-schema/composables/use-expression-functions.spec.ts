/**
 * useExpressionFunctions 单元测试
 *
 * 覆盖（H2 修复后契约）：
 * - immediate: true —— 同步写入注入的 ExpressionScope
 * - watch 触发：getter 返回新对象时重新写入 scope
 * - 多实例隔离：A/B 实例各自写各自 scope，互不感知（不再污染模块级表）
 * - 无 onScopeDispose 清表：scope 随实例 GC，停止实例不应再有任何写入
 *
 * 设计：fake ExpressionScope（setExpressionFunctions 用 vi.fn 观察），
 * 直接断言「写入的是哪个 scope」—— 这是 H2 修复的核心契约。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import type { ExpressionScope } from './use-expression'
import { useExpressionFunctions } from './use-expression-functions'

/** 造一个 fake ExpressionScope：setExpressionFunctions 可观察，resolve 行为不重要 */
function makeFakeScope() {
  const setExpressionFunctions = vi.fn()
  return {
    scope: {
      setExpressionFunctions,
      resolveFunctionExpression: () => null,
    } as unknown as ExpressionScope,
    setExpressionFunctions,
  }
}

let scope: EffectScope

beforeEach(() => {
  scope = effectScope()
})

afterEach(() => {
  scope.stop()
})

describe('useExpressionFunctions / 立即注册（H2：写入注入 scope）', () => {
  it('immediate: true —— 同步调用注入 scope.setExpressionFunctions(fns)', () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    const fns = { greet: (s: string) => `hi ${s}` }
    scope.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => fns })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    expect(setExpressionFunctions).toHaveBeenLastCalledWith(fns)
  })

  it('getter 返回 undefined → scope.setExpressionFunctions(undefined)', () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    scope.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => undefined })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    expect(setExpressionFunctions).toHaveBeenLastCalledWith(undefined)
  })
})

describe('useExpressionFunctions / watch 触发（H2）', () => {
  it('getter 返回新对象 → nextTick 后 scope 被再次写入（新对象）', async () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    const oldFns = { v: () => 'old' }
    const newFns = { v: () => 'new' }
    const currentRef = ref(oldFns)
    scope.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => currentRef.value })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    expect(setExpressionFunctions).toHaveBeenLastCalledWith(oldFns)

    // 模拟 props.expressionFunctions 引用换代（ref 改变触发 watch）
    currentRef.value = newFns
    await nextTick()
    expect(setExpressionFunctions).toHaveBeenCalledTimes(2)
    expect(setExpressionFunctions).toHaveBeenLastCalledWith(newFns)
  })

  it('getter 连续返回相同对象 → 不重复写入', async () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    const stable = { v: () => 'stable' }
    scope.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => stable })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)

    await nextTick()
    await nextTick()
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
  })
})

describe('useExpressionFunctions / 多实例隔离（H2 核心回归）', () => {
  it('A/B 实例各自写各自 scope：B 注册后 A 的 scope 不被二次触碰', () => {
    const a = makeFakeScope()
    const b = makeFakeScope()
    const scopeA = effectScope()
    const scopeB = effectScope()
    scopeA.run(() => {
      useExpressionFunctions({ scope: a.scope, expressionFunctions: () => ({ fromA: () => 'A' }) })
    })
    scopeB.run(() => {
      useExpressionFunctions({ scope: b.scope, expressionFunctions: () => ({ fromB: () => 'B' }) })
    })
    // 每个 scope 各写一次（immediate），互不知道对方存在
    expect(a.setExpressionFunctions).toHaveBeenCalledTimes(1)
    expect(b.setExpressionFunctions).toHaveBeenCalledTimes(1)
    scopeA.stop()
    scopeB.stop()
  })

  it('scope.stop() 不再产生任何写入（无 onScopeDispose 清表；旧模块级清表是 H2 污染源）', () => {
    const { scope: fakeScope, setExpressionFunctions } = makeFakeScope()
    const inner = effectScope()
    inner.run(() => {
      useExpressionFunctions({ scope: fakeScope, expressionFunctions: () => ({ f: () => 1 }) })
    })
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
    inner.stop()
    // 关键断言：停止后调用次数不增加（旧实现会追加一次 undefined 清表调用毁掉其他实例）
    expect(setExpressionFunctions).toHaveBeenCalledTimes(1)
  })
})
