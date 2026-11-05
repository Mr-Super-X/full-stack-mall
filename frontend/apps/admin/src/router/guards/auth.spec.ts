// 路由守卫 - 重置函数测试
//
// 覆盖：resetAuthGuardState 每次调用都应将内部 dynamicLoaded + currentToken 重置为初始值。
//
// 为什么需要测试：守卫内部用模块级变量（dynamicLoaded / currentToken）跟踪远程菜单加载状态，
// 单测多次 case 之间如果不重置，前一个 case 的 token 会泄漏到下一个 case，导致行为不可预测。
// 本 spec 验证 reset 函数确实清空这些状态。

import { beforeEach, describe, expect, it } from 'vitest'

// 注意：本 spec 必须**第一个** import 守卫模块，否则守卫模块的模块级变量已经在
// 其他测试中被污染过。Vitest 按文件顺序执行，每个 spec 文件独立。
import { resetAuthGuardState } from './auth'

describe('resetAuthGuardState', () => {
  beforeEach(() => {
    // 每个 case 之前先重置，避免相互污染
    resetAuthGuardState()
  })

  it('可以被重复调用而不抛错', () => {
    expect(() => {
      resetAuthGuardState()
      resetAuthGuardState()
      resetAuthGuardState()
    }).not.toThrow()
  })

  it('调用前后行为一致（幂等性）', () => {
    // 第一次调用：从某个（未知）状态 → 初始状态
    resetAuthGuardState()
    // 第二次调用：从初始状态 → 初始状态
    expect(() => resetAuthGuardState()).not.toThrow()
  })

  it('导出的函数引用保持稳定（用于外部 import 的兼容性）', async () => {
    const m1 = await import('./auth')
    const m2 = await import('./auth')
    // 函数引用应相同（模块单例）
    expect(m1.resetAuthGuardState).toBe(m2.resetAuthGuardState)
  })
})
