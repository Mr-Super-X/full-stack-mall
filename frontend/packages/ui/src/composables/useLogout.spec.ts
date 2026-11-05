import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// 整页跳转断言夹具（@vv/shared test-utils 单源，2026-10-30 基建收敛）
import { createFakeLocation, installFakeLocation } from '@vv/shared/test-utils/fakeLocation'

// P4 跨应用统一登录协议：登出改整页 location.href 跳 apps/auth（跨 app 无共享 router），
// 不再有 useAppRouter.goLogin；jsdom 的 Location.href 不可拦截，经 stubGlobal 整体替换
const fakeLocation = createFakeLocation('http://localhost/workbench')

const { mockStoreLogout, mockUseConfirm } = vi.hoisted(() => ({
  mockStoreLogout: vi.fn(),
  mockUseConfirm: vi.fn(),
}))

// '@/composables/useConfirm' 与 useLogout.ts 的相对导入 './useConfirm.ts'
// 解析到同一物理文件（ui 包内），mock 按解析路径生效
vi.mock('@/composables/useConfirm', () => ({
  useConfirm: mockUseConfirm,
}))

vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return {
    ...actual, // 保留 resolveAuthOrigin 等真实实现（M5 单源）
    useUserStore: () => ({ logout: mockStoreLogout }),
  }
})

import { useLogout } from './useLogout'

// 替换先行：4 例直调全部改经 stub 组件 setup 执行（见文件尾 useLogoutWithSetup 定义）
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
// i18n 实例经 @locales 别名（指 @vv/shared/src/locales；具名 default export 为 createI18n 实例）
import i18n from '@locales'

beforeEach(() => {
  mockStoreLogout.mockReset()
  mockUseConfirm.mockReset()
  fakeLocation.href = 'http://localhost/workbench'
  installFakeLocation(fakeLocation)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useLogout', () => {
  it('初始 loggingOut 为 false', () => {
    const { loggingOut } = useLogoutWithSetup()
    expect(loggingOut.value).toBe(false)
  })

  it('confirm 取消时 logout 与跳转均不触发', async () => {
    mockUseConfirm.mockResolvedValueOnce(false)
    const { loggingOut, confirmLogout } = useLogoutWithSetup()
    await confirmLogout()
    expect(mockStoreLogout).not.toHaveBeenCalled()
    expect(window.location.href).toBe('http://localhost/workbench')
    expect(loggingOut.value).toBe(false)
  })

  it('confirm 确认后：logout + 整页跳 apps/auth 登录页，loggingOut 复位（P4）', async () => {
    mockUseConfirm.mockResolvedValueOnce(true)
    mockStoreLogout.mockResolvedValueOnce(undefined)
    const { loggingOut, confirmLogout } = useLogoutWithSetup()
    await confirmLogout()
    expect(mockStoreLogout).toHaveBeenCalledTimes(1)
    // 未注入 VITE_AUTH_ORIGIN 时回落 '/auth'（与 redirectToAuthLogin 同语义）
    expect(window.location.href).toBe('/auth/login')
    expect(loggingOut.value).toBe(false)
  })

  it('跳转抛错时 loggingOut 在 finally 中复位', async () => {
    mockUseConfirm.mockResolvedValueOnce(true)
    mockStoreLogout.mockResolvedValueOnce(undefined)
    // 用带 throw setter 的 fake location 模拟整页跳转失败
    vi.stubGlobal('location', {
      set href(_v: string) {
        throw new Error('boom')
      },
    })
    const { loggingOut, confirmLogout } = useLogoutWithSetup()
    await expect(confirmLogout()).rejects.toThrow('boom')
    expect(loggingOut.value).toBe(false)
  })
})

/**
 * useLogout 自 2026-10-28 接线 useI18n（弹窗文案 i18n 化）——useI18n 硬约束「须在 setup
 * 顶部调用」，spec 直调 throw（SyntaxError: Must be called at the top of a setup function）。
 * 本辅助把调用包进 stub 组件的 setup（挂真实 i18n 实例，zh-CN 默认），是命令式 composable
 * 接线 i18n 后的标准 spec 形态。
 */
function useLogoutWithSetup(): ReturnType<typeof useLogout> {
  let result!: ReturnType<typeof useLogout>
  mount(
    defineComponent({
      setup() {
        result = useLogout()
        return () => null
      },
    }),
    { global: { plugins: [i18n] } }
  )
  return result
}
