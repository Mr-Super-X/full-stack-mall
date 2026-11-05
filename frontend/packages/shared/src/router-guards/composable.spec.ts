import { describe, it, expect, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { composeGuards, type RouteGuard } from './composable'

const to = { path: '/x', meta: {} } as RouteLocationNormalized

describe('composeGuards', () => {
  it('全部返回 null 时最终返回 null（放行）', async () => {
    const guards: RouteGuard[] = [() => null, () => null]
    expect(await composeGuards(to, guards)).toBeNull()
  })

  it('首个非 null 结果立即终止后续 guard', async () => {
    const second = vi.fn(() => null)
    const guards: RouteGuard[] = [() => ({ path: '/login' }), second]
    const result = await composeGuards(to, guards)
    expect(result).toEqual({ path: '/login' })
    expect(second).not.toHaveBeenCalled()
  })

  it('支持 async guard', async () => {
    const guards: RouteGuard[] = [async () => ({ path: '/403' })]
    expect(await composeGuards(to, guards)).toEqual({ path: '/403' })
  })

  it('guard 抛错时 console.error 并继续执行下一个', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const guards: RouteGuard[] = [
      () => {
        throw new Error('boom')
      },
      () => ({ path: '/500' }),
    ]
    const result = await composeGuards(to, guards)
    expect(result).toEqual({ path: '/500' })
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('AUTH_REDIRECTING 中断信号不吞：透传 throw 且终止后续 guard（P4 跨应用登录协议）', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const second = vi.fn(() => null)
    const guards: RouteGuard[] = [
      () => {
        throw new Error('AUTH_REDIRECTING')
      },
      second,
    ]
    await expect(composeGuards(to, guards)).rejects.toThrow('AUTH_REDIRECTING')
    expect(second).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('context 参数透传给每个 guard', async () => {
    const received: unknown[] = []
    const guards: RouteGuard[] = [
      (_to, ...args) => {
        received.push(...args)
        return null
      },
    ]
    await composeGuards(to, guards, ['ctx-a', 'ctx-b'])
    expect(received).toEqual(['ctx-a', 'ctx-b'])
  })
})
