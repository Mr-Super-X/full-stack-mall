/**
 * useFullscreen 单元测试 —— v3.1 全屏切换
 *
 * 覆盖矩阵：
 * - 初始状态 false
 * - toggleFullscreen 双向切换
 * - Esc 键退出（仅全屏激活时监听）
 * - 非 Esc 键不退出
 * - effectScope dispose 后移除 window 监听（防路由跳走泄漏）
 *
 * @group ProTable composables
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { useFullscreen } from './useFullscreen'

/** 以独立 effectScope 包裹调用，模拟组件 setup 上下文（onScopeDispose 依赖） */
function withScope<T>(fn: () => T): { result: T; dispose: () => void } {
  const scope = effectScope()
  const result = scope.run(fn)!
  return { result, dispose: () => scope.stop() }
}

function pressKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useFullscreen', () => {
  it('初始 isFullscreen 为 false', () => {
    const { result } = withScope(() => useFullscreen())
    expect(result.isFullscreen.value).toBe(false)
  })

  it('toggleFullscreen 双向切换', () => {
    const { result } = withScope(() => useFullscreen())
    result.toggleFullscreen()
    expect(result.isFullscreen.value).toBe(true)
    result.toggleFullscreen()
    expect(result.isFullscreen.value).toBe(false)
  })

  it('exitFullscreen 幂等退出', () => {
    const { result } = withScope(() => useFullscreen())
    result.toggleFullscreen()
    result.exitFullscreen()
    expect(result.isFullscreen.value).toBe(false)
    result.exitFullscreen() // 未激活时再调不抛错
    expect(result.isFullscreen.value).toBe(false)
  })

  it('全屏激活时 Esc 退出', () => {
    const { result } = withScope(() => useFullscreen())
    result.toggleFullscreen()
    pressKey('Escape')
    expect(result.isFullscreen.value).toBe(false)
  })

  it('未全屏时 Esc 不影响（监听未注册）', () => {
    const { result } = withScope(() => useFullscreen())
    pressKey('Escape')
    expect(result.isFullscreen.value).toBe(false)
  })

  it('非 Esc 键不退出全屏', () => {
    const { result } = withScope(() => useFullscreen())
    result.toggleFullscreen()
    pressKey('Enter')
    expect(result.isFullscreen.value).toBe(true)
  })

  it('退出全屏后 Esc 监听移除（再次按 Esc 不抛错、不翻转状态）', () => {
    const { result } = withScope(() => useFullscreen())
    result.toggleFullscreen()
    pressKey('Escape')
    expect(result.isFullscreen.value).toBe(false)
    pressKey('Escape')
    expect(result.isFullscreen.value).toBe(false)
  })

  it('effectScope dispose 移除 window 监听', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { result, dispose } = withScope(() => useFullscreen())
    result.toggleFullscreen() // 激活后 dispose 才走清理路径
    dispose()
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
