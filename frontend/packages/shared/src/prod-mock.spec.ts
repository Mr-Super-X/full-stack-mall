import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupProdMockIfNeeded } from './prod-mock.ts'

const { setupProdMockServer } = vi.hoisted(() => ({
  setupProdMockServer: vi.fn(() => Promise.resolve()),
}))

// 与 app 侧 `() => import('@mock/mockProdServer')` 同形的加载回调——
// 本 spec 只验证「条件命中 → 加载并激活」的契约，不触达真实 mock 模块
const loadModule = vi.fn(() => Promise.resolve({ setupProdMockServer }))

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('setupProdMockIfNeeded', () => {
  it('PROD && VITE_USE_MOCK=true → 加载并激活 prod mock', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_USE_MOCK', 'true')

    await setupProdMockIfNeeded(loadModule)

    expect(loadModule).toHaveBeenCalledTimes(1)
    expect(setupProdMockServer).toHaveBeenCalledTimes(1)
  })

  it('非 PROD → 不加载（dev 由 vite-plugin-mock node 中间件接管）', async () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_USE_MOCK', 'true')

    await setupProdMockIfNeeded(loadModule)

    expect(loadModule).not.toHaveBeenCalled()
    expect(setupProdMockServer).not.toHaveBeenCalled()
  })

  it('PROD 但 VITE_USE_MOCK 缺省 → 不加载（常规生产构建 tree-shake 分支）', async () => {
    vi.stubEnv('PROD', true)

    await setupProdMockIfNeeded(loadModule)

    expect(loadModule).not.toHaveBeenCalled()
  })

  it("PROD 但 VITE_USE_MOCK 非 'true' → 不加载", async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_USE_MOCK', 'false')

    await setupProdMockIfNeeded(loadModule)

    expect(loadModule).not.toHaveBeenCalled()
  })
})
