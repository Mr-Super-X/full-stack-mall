import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { nextTick, ref, reactive } from 'vue'

// P4 跨应用统一登录协议：登录按钮改 redirectToAuthLogin 整页跳 apps/auth；
// mock 掉真实实现（会赋 location.href + throw AUTH_REDIRECTING）
const { mockRedirectToAuthLogin } = vi.hoisted(() => ({
  mockRedirectToAuthLogin: vi.fn(),
}))

// mock useUserStore（组件消费 profile + fetchProfile——2026-10-30 登录态探测接线后组件
// onMounted 会调用探测，mock 须提供该方法）
const mockProfile = ref<{ name: string } | null>({ name: '张三' })
const mockUserStore = reactive({
  profile: mockProfile,
  permissions: [] as string[],
  isLoggedIn: true,
  fetchProfile: vi.fn().mockResolvedValue(undefined),
})

// 合并单点 mock @vv/shared 根 barrel：redirectToAuthLogin + useUserStore 双覆盖
// （importOriginal 保留其余导出，createNamespace 等 AutoImport 注入标识符真实实现不受影响）
vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return {
    ...actual,
    redirectToAuthLogin: mockRedirectToAuthLogin,
    useUserStore: () => mockUserStore,
  }
})

// mock useLogout
const mockLoggingOut = ref(false)
const mockConfirmLogout = vi.fn()
vi.mock('@vv/ui/composables/useLogout', () => ({
  useLogout: () => ({ loggingOut: mockLoggingOut, confirmLogout: mockConfirmLogout }),
}))

const map: Record<string, string> = { 'auth.logout': '退出' }
const mockT = (key: string): string => map[key] ?? key

import PortalHeader from './PortalHeader.vue'

describe('PortalHeader 企业官网顶栏', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProfile.value = { name: '张三' }
    mockLoggingOut.value = false
  })

  it('1. 渲染品牌名与全部锚点导航', () => {
    const w = mount(PortalHeader, { global: { mocks: { $t: mockT } } })
    expect(w.text()).toContain('企业门户')
    // 品牌 logo 锚点(1) + 导航锚点(4) + 管理后台跳链(1)
    expect(w.findAll('a')).toHaveLength(6)
    expect(w.text()).toContain('产品')
    expect(w.text()).toContain('管理后台')
  })

  it('2. 未登录显示「登录」按钮，点击整页跳 apps/auth 统一登录（P4）', async () => {
    mockProfile.value = null
    const w = mount(PortalHeader, { global: { mocks: { $t: mockT } } })
    const btn = w.find('.vv-portal-header__login')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(mockRedirectToAuthLogin).toHaveBeenCalledTimes(1)
    expect(mockRedirectToAuthLogin).toHaveBeenCalledWith(window.location.pathname)
  })

  it('3. 已登录显示用户菜单，下拉「退出」触发 confirmLogout', async () => {
    const w = mount(PortalHeader, {
      global: { mocks: { $t: mockT } },
      attachTo: document.body,
    })
    expect(w.find('.vv-portal-header__login').exists()).toBe(false)
    const trigger = w.find('.vv-portal-header__user')
    expect(trigger.text()).toContain('张三')
    await trigger.trigger('click')
    await nextTick()
    const item = document.querySelector('.el-dropdown-menu__item') as HTMLElement | null
    expect(item?.textContent).toContain('退出')
    item?.click()
    await nextTick()
    expect(mockConfirmLogout).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('4. loggingOut=true 时退出项禁用', async () => {
    mockLoggingOut.value = true
    const w = mount(PortalHeader, {
      global: { mocks: { $t: mockT } },
      attachTo: document.body,
    })
    await w.find('.vv-portal-header__user').trigger('click')
    await nextTick()
    expect(
      document.querySelector('.el-dropdown-menu__item')?.classList.contains('is-disabled')
    ).toBe(true)
    w.unmount()
    mockLoggingOut.value = false
  })
})
