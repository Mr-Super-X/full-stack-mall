import { describe, it, expect, vi, afterEach } from 'vitest'
import { runCrossRule, runCrossRuleMaybeSync, createCrossSeqGuard } from './cross-rule-runner'
import type { RuleItem } from '../types'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runCrossRule —— 跨字段规则统一执行', () => {
  const model = { a: 1, b: 2, nested: { c: 3 } }

  it('同步 pass → { kind: pass }', async () => {
    const rule = { crossValidator: () => true, dependsOn: ['b'] } as RuleItem
    expect(await runCrossRule(rule, model, 'a')).toEqual({ kind: 'pass' })
  })

  it('同步 fail → { kind: fail, message }', async () => {
    const rule = { crossValidator: () => 'a 必须小于 b', dependsOn: ['b'] } as RuleItem
    expect(await runCrossRule(rule, model, 'a')).toEqual({
      kind: 'fail',
      message: 'a 必须小于 b',
    })
  })

  it('异步 pass / fail 统一 await 归纳', async () => {
    const passRule = {
      crossValidator: async () => true,
      dependsOn: ['b'],
    } as RuleItem
    const failRule = {
      crossValidator: async () => 'async 错误',
      dependsOn: ['b'],
    } as RuleItem
    expect(await runCrossRule(passRule, model, 'a')).toEqual({ kind: 'pass' })
    expect(await runCrossRule(failRule, model, 'a')).toEqual({
      kind: 'fail',
      message: 'async 错误',
    })
  })

  it('dependsOn 单值字符串归一为数组取值', async () => {
    const cv = vi.fn(() => true)
    const rule = { crossValidator: cv, dependsOn: 'nested.c' } as unknown as RuleItem
    await runCrossRule(rule, model, 'a')
    expect(cv).toHaveBeenCalledWith(1, 3)
  })

  it('deps 别名：与 dependsOn 等效（命名统一，PM 审查发现 4）', async () => {
    const cv = vi.fn(() => true)
    const rule = { crossValidator: cv, deps: ['b'] } as unknown as RuleItem
    await runCrossRule(rule, model, 'a')
    expect(cv).toHaveBeenCalledWith(1, 2)
  })

  it('dependsOn 与 deps 同时声明时 dependsOn 优先', async () => {
    const cv = vi.fn(() => true)
    const rule = {
      crossValidator: cv,
      dependsOn: ['b'],
      deps: ['nested.c'],
    } as unknown as RuleItem
    await runCrossRule(rule, model, 'a')
    expect(cv).toHaveBeenCalledWith(1, 2)
  })

  it('缺 dependsOn 与 deps → { kind: threw }（不调用 crossValidator）', async () => {
    const cv = vi.fn(() => true)
    const rule = { crossValidator: cv } as RuleItem
    expect(await runCrossRule(rule, model, 'a')).toEqual({ kind: 'threw' })
    expect(cv).not.toHaveBeenCalled()
  })

  it('crossValidator 同步抛错 → { kind: threw } + console.error（不抛出）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rule = {
      crossValidator: () => {
        throw new Error('sync boom')
      },
      dependsOn: ['b'],
    } as RuleItem
    expect(await runCrossRule(rule, model, 'a')).toEqual({ kind: 'threw' })
    expect(console.error).toHaveBeenCalledWith('[XForm] crossValidator threw:', expect.any(Error))
  })

  it('crossValidator 异步 reject → { kind: threw } + console.error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rule = {
      crossValidator: async () => {
        throw new Error('async boom')
      },
      dependsOn: ['b'],
    } as RuleItem
    expect(await runCrossRule(rule, model, 'a')).toEqual({ kind: 'threw' })
  })

  it('valuePath 支持嵌套路径（items[0].qty 形式）', async () => {
    const m = { items: [{ qty: 5 }] }
    const cv = vi.fn(() => true)
    const rule = { crossValidator: cv, dependsOn: [] } as unknown as RuleItem
    await runCrossRule(rule, m, 'items[0].qty')
    expect(cv).toHaveBeenCalledWith(5)
  })
})

describe('runCrossRuleMaybeSync —— 同步直返语义（反向路径同步写入保持）', () => {
  const model = { a: 1, b: 2 }

  it('同步 crossValidator 直返 outcome（非 Promise），同步结果可被调用方同步消费', () => {
    const passRule = { crossValidator: () => true, dependsOn: ['b'] } as RuleItem
    const failRule = { crossValidator: () => '错了', dependsOn: ['b'] } as RuleItem
    const passOutcome = runCrossRuleMaybeSync(passRule, model, 'a')
    const failOutcome = runCrossRuleMaybeSync(failRule, model, 'a')
    expect(passOutcome).toEqual({ kind: 'pass' }) // 非 Promise，toEqual 直接通过
    expect(failOutcome).toEqual({ kind: 'fail', message: '错了' })
  })

  it('异步 crossValidator 返回 Promise<outcome>', async () => {
    const rule = { crossValidator: async () => 'async 错', dependsOn: ['b'] } as RuleItem
    const outcome = runCrossRuleMaybeSync(rule, model, 'a')
    expect(outcome).toBeInstanceOf(Promise)
    expect(await outcome).toEqual({ kind: 'fail', message: 'async 错' })
  })

  it('同步抛错直返 { kind: threw } + console.error（不经微任务）', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const rule = {
      crossValidator: () => {
        throw new Error('sync boom')
      },
      dependsOn: ['b'],
    } as RuleItem
    expect(runCrossRuleMaybeSync(rule, model, 'a')).toEqual({ kind: 'threw' })
  })
})

describe('createCrossSeqGuard —— seq 竞态令牌', () => {
  it('begin 同一 key 递增，不同 key 独立计数', () => {
    const guard = createCrossSeqGuard()
    expect(guard.begin('email')).toBe(1)
    expect(guard.begin('email')).toBe(2)
    expect(guard.begin('phone')).toBe(1)
  })

  it('isCurrent：最新 seq 为 current，旧 seq 过期', () => {
    const guard = createCrossSeqGuard()
    const old = guard.begin('email')
    expect(guard.isCurrent('email', old)).toBe(true)
    guard.begin('email')
    expect(guard.isCurrent('email', old)).toBe(false)
  })

  it('clear 后旧 seq 全部过期（规则集重建场景）', () => {
    const guard = createCrossSeqGuard()
    const seq = guard.begin('email')
    guard.clear()
    expect(guard.isCurrent('email', seq)).toBe(false)
    // clear 后重新计数从 1 开始
    expect(guard.begin('email')).toBe(1)
  })
})
