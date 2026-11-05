import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activateRem, deactivateRem, H5_REM_MAX_WIDTH, H5_REM_RESIZE_DELAY } from './rem'

function mockViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
}

function firePageShow(persisted: boolean): void {
  const event = new Event('pageshow') as PageTransitionEvent
  Object.defineProperty(event, 'persisted', { value: persisted })
  window.dispatchEvent(event)
}

describe('layouts/h5/config/rem — rem 运行时激活与恢复', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    deactivateRem() // 复位模块级状态（用例间隔离）
    document.documentElement.style.cssText = ''
  })

  afterEach(() => {
    deactivateRem()
    vi.useRealTimers()
  })

  it('375 屏：fontSize = 37.5px，不限宽', () => {
    mockViewportWidth(375)
    activateRem()
    const style = document.documentElement.style
    expect(style.fontSize).toBe('37.5px')
    expect(style.width).toBe('')
    expect(style.margin).toBe('')
  })

  it('1024 屏：限 540px 居中，fontSize = 54px', () => {
    mockViewportWidth(1024)
    activateRem()
    const style = document.documentElement.style
    expect(style.fontSize).toBe('54px')
    expect(style.width).toBe('540px')
    expect(style.margin).toBe('0px auto') // CSSOM 序列化：length 0 规范要求带 px（jsdom 与真实浏览器一致）
  })

  it('deactivate 恢复进入前的内联样式', () => {
    document.documentElement.style.fontSize = '16px' // 模拟进入前已有值
    mockViewportWidth(375)
    activateRem()
    deactivateRem()
    expect(document.documentElement.style.fontSize).toBe('16px')
  })

  it('resize 防抖 300ms 后重算', () => {
    mockViewportWidth(375)
    activateRem()
    mockViewportWidth(414)
    window.dispatchEvent(new Event('resize'))
    expect(document.documentElement.style.fontSize).toBe('37.5px') // 防抖窗口内不变
    vi.advanceTimersByTime(300)
    expect(document.documentElement.style.fontSize).toBe('41.4px')
  })

  it('宽屏 resize 回窄屏：清理限宽内联样式', () => {
    mockViewportWidth(1024)
    activateRem()
    expect(document.documentElement.style.width).toBe('540px')
    mockViewportWidth(375)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(300)
    expect(document.documentElement.style.width).toBe('')
    expect(document.documentElement.style.fontSize).toBe('37.5px')
  })

  it('pageshow persisted=true（bfcache 恢复）重算', () => {
    mockViewportWidth(375)
    activateRem()
    mockViewportWidth(414)
    firePageShow(true)
    vi.advanceTimersByTime(300)
    expect(document.documentElement.style.fontSize).toBe('41.4px')
  })

  it('重复 activate 幂等：deactivate 后监听彻底移除', () => {
    mockViewportWidth(375)
    activateRem()
    activateRem()
    deactivateRem()
    expect(document.documentElement.style.fontSize).toBe('')
    mockViewportWidth(500)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(H5_REM_RESIZE_DELAY * 2)
    expect(document.documentElement.style.fontSize).toBe('') // 监听已移除，不再响应
  })

  it('未激活时 deactivate 为空操作（不报错、不改样式）', () => {
    document.documentElement.style.fontSize = '16px'
    deactivateRem()
    expect(document.documentElement.style.fontSize).toBe('16px')
  })

  it('防抖窗口内 deactivate：定时器被清除，到期不再重算', () => {
    mockViewportWidth(375)
    activateRem()
    mockViewportWidth(414)
    window.dispatchEvent(new Event('resize'))
    deactivateRem() // 防抖窗口内停用
    vi.advanceTimersByTime(H5_REM_RESIZE_DELAY * 2)
    expect(document.documentElement.style.fontSize).toBe('') // 快照原值（空）已恢复且未被重算覆盖
  })

  it('pageshow persisted=false（普通加载）不重算', () => {
    mockViewportWidth(375)
    activateRem()
    mockViewportWidth(414)
    firePageShow(false)
    vi.advanceTimersByTime(H5_REM_RESIZE_DELAY * 2)
    expect(document.documentElement.style.fontSize).toBe('37.5px') // 负分支：不触发重算
  })

  it('innerWidth=0（隐藏 iframe/预渲染）不写 0px，保持现状等自愈', () => {
    mockViewportWidth(375)
    activateRem()
    expect(document.documentElement.style.fontSize).toBe('37.5px')
    mockViewportWidth(0)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(H5_REM_RESIZE_DELAY * 2)
    expect(document.documentElement.style.fontSize).toBe('37.5px') // 卫语句跳过计算，未塌陷为 0px
  })

  it('窄屏 resize 到宽屏：fontSize 切到 54px 并出现限宽', () => {
    mockViewportWidth(375)
    activateRem()
    expect(document.documentElement.style.width).toBe('')
    mockViewportWidth(600)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(H5_REM_RESIZE_DELAY)
    expect(document.documentElement.style.fontSize).toBe('54px')
    expect(document.documentElement.style.width).toBe('540px')
  })

  it('H5_REM_MAX_WIDTH 常量为 540', () => {
    expect(H5_REM_MAX_WIDTH).toBe(540)
  })
})
