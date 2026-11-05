import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { App } from 'vue'

const { mockBindErrorHandler } = vi.hoisted(() => ({
  mockBindErrorHandler: vi.fn(),
}))

// 单源后 errorHandler 与 safeAsync 同包，mock 走相对路径（原 app 侧 mock '@vv/shared'）
vi.mock('../utils/safeAsync.ts', () => ({
  _bindErrorHandler: mockBindErrorHandler,
}))

import errorHandler from './errorHandler.ts'

const makeApp = (): App & { config: { errorHandler?: unknown } } =>
  ({ config: {} }) as unknown as App & { config: { errorHandler?: unknown } }

beforeEach(() => {
  mockBindErrorHandler.mockReset()
})

describe('errorHandler 插件', () => {
  it('install 注册 Vue errorHandler 并桥接 safeAsync', () => {
    const app = makeApp()
    errorHandler.install(app, { logToConsole: false })
    expect(typeof app.config.errorHandler).toBe('function')
    expect(mockBindErrorHandler).toHaveBeenCalledTimes(1)
  })

  it('Vue 组件错误：规范化后走 report 通道', () => {
    const app = makeApp()
    const report = vi.fn()
    errorHandler.install(app, { report, logToConsole: false })

    const handler = app.config.errorHandler as (err: unknown, i: unknown, info: string) => void
    handler(new Error('render boom'), null, 'render')

    expect(report).toHaveBeenCalledWith(expect.any(Error), { source: 'vue', extra: 'render' })
  })

  it('非 Error 实例包装为 Error', () => {
    const app = makeApp()
    const report = vi.fn()
    errorHandler.install(app, { report, logToConsole: false })

    const handler = app.config.errorHandler as (err: unknown, i: unknown, info: string) => void
    handler('string error', null, 'setup')

    const [err] = report.mock.calls[0] as [Error]
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('string error')
  })

  it('window 全局错误与 unhandledrejection 均走 report', () => {
    const app = makeApp()
    const report = vi.fn()
    errorHandler.install(app, { report, logToConsole: false })

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('window boom') }))
    // promise 需提前 catch 接住，避免测试自身产生真实的未处理拒绝
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(new Error('async boom')).catch(() => {}),
        reason: new Error('async boom'),
      })
    )

    const sources = report.mock.calls.map((call) => (call[1] as { source: string }).source)
    expect(sources).toContain('window.error')
    expect(sources).toContain('unhandledrejection')
  })

  it('logToConsole 开启时 console.error 输出', () => {
    const app = makeApp()
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    errorHandler.install(app, { logToConsole: true })

    const handler = app.config.errorHandler as (err: unknown, i: unknown, info: string) => void
    handler(new Error('x'), null, 'info')

    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
