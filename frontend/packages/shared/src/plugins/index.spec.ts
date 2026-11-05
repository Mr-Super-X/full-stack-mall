import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { App } from 'vue'

const { mockErrorHandlerInstall, mockWebVitalsInstall, mockRemInstall, mockVersionCheckInstall } =
  vi.hoisted(() => ({
    mockErrorHandlerInstall: vi.fn(),
    mockWebVitalsInstall: vi.fn(),
    mockRemInstall: vi.fn(),
    mockVersionCheckInstall: vi.fn(),
  }))

vi.mock('./errorHandler.ts', () => ({ default: { install: mockErrorHandlerInstall } }))
vi.mock('./webVitals.ts', () => ({ default: { install: mockWebVitalsInstall } }))
vi.mock('./remAdaptation.ts', () => ({ default: { install: mockRemInstall } }))
vi.mock('./versionCheck.ts', () => ({ default: { install: mockVersionCheckInstall } }))

import { createAppPlugins } from './index.ts'

/**
 * 构造最小 App stub：use 按 Vue 语义转发 plugin.install（装配断言落在
 * 各插件 install 的调用次数上，而非 use 的入参形状）
 */
const makeApp = (): App => {
  const app = {
    use: vi.fn((plugin: { install?: (...args: unknown[]) => void }, ...options: unknown[]) => {
      plugin.install?.(app, ...options)
      return app
    }),
  }
  return app as unknown as App
}

beforeEach(() => {
  mockErrorHandlerInstall.mockReset()
  mockWebVitalsInstall.mockReset()
  mockRemInstall.mockReset()
  mockVersionCheckInstall.mockReset()
})

describe('createAppPlugins 插件注册工厂', () => {
  it('缺省装配 errorHandler + webVitals + versionCheck，不装配 remAdaptation', () => {
    const app = makeApp()
    createAppPlugins().install(app, {})
    expect(mockErrorHandlerInstall).toHaveBeenCalledTimes(1)
    expect(mockWebVitalsInstall).toHaveBeenCalledTimes(1)
    expect(mockRemInstall).not.toHaveBeenCalled()
    expect(mockVersionCheckInstall).toHaveBeenCalledTimes(1)
  })

  it('remAdaptation: true 时装配 remAdaptation 插件', () => {
    const app = makeApp()
    createAppPlugins({ remAdaptation: true }).install(app, {})
    expect(mockRemInstall).toHaveBeenCalledTimes(1)
  })

  it('options 传 false 可关闭对应插件', () => {
    const app = makeApp()
    createAppPlugins({ remAdaptation: true }).install(app, {
      errorHandler: false,
      webVitals: false,
      remAdaptation: false,
    })
    expect(mockErrorHandlerInstall).not.toHaveBeenCalled()
    expect(mockWebVitalsInstall).not.toHaveBeenCalled()
    expect(mockRemInstall).not.toHaveBeenCalled()
  })

  it('options 对象透传到对应插件 install', () => {
    const app = makeApp()
    createAppPlugins().install(app, { errorHandler: { logToConsole: false } })
    expect(mockErrorHandlerInstall).toHaveBeenCalledWith(app, { logToConsole: false })
  })

  it('options.versionCheck === false 关闭 versionCheck', () => {
    const app = makeApp()
    createAppPlugins().install(app, { versionCheck: false })
    expect(mockVersionCheckInstall).not.toHaveBeenCalled()
  })

  it('options.versionCheck 对象透传到插件 install', () => {
    const app = makeApp()
    const opts = { onUpdate: vi.fn() }
    createAppPlugins().install(app, { versionCheck: opts })
    expect(mockVersionCheckInstall).toHaveBeenCalledWith(app, opts)
  })
})
