import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'
// 整页跳转断言夹具（@vv/shared test-utils 单源，2026-10-30 基建收敛）
import { createFakeLocation, installFakeLocation } from '@vv/shared/test-utils/fakeLocation'

// P4 跨应用统一登录协议：登录成功改整页 location.href 回跳（跨 app 无共享 router），
// 不再有 vue-router push；jsdom 的 Location.href 不可拦截，经 stubGlobal 整体替换
const fakeLocation = createFakeLocation('http://localhost/login')

// 单点 mock @vv/shared 根 barrel：useUserStore + resolvePostLoginRedirect 双覆盖
// （importOriginal 保留其余导出——createNamespace 等 AutoImport 注入标识符的真实实现不受影响）
const { mockLogin, mockUserStore, mockResolvePostLoginRedirect } = vi.hoisted(() => {
  const mockLogin = vi.fn()
  return {
    mockLogin,
    mockUserStore: { login: mockLogin },
    mockResolvePostLoginRedirect: vi.fn(() => '/admin/'),
  }
})
vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return {
    ...actual,
    useUserStore: () => mockUserStore,
    resolvePostLoginRedirect: mockResolvePostLoginRedirect,
  }
})

vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessage: { success: vi.fn(), error: vi.fn() },
  }
})

// 引入被测组件（必须在 mock 之后）
import Login from './Login.vue'
// i18n 接线后组件 setup 依赖 useI18n——spec mount 须挂真实 i18n 实例（zh-CN 默认 locale，
// $t 文案断言与 zh 硬编码逐字相同，行为零变化；2026-10-28 i18n 审计配套）
import i18n from '@locales'

const mountOptions = { global: { plugins: [i18n] } }

describe('Login.vue（apps/auth 统一登录页）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeLocation.href = 'http://localhost/login'
    fakeLocation.search = ''
    installFakeLocation(fakeLocation)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    // referrer 用例（#9）会改写 document.referrer，这里复位避免污染后续用例
    Object.defineProperty(document, 'referrer', { value: '', configurable: true })
  })

  it('1. 渲染默认结构：品牌区 + 表单 + 按钮 + 版权', () => {
    const w = mount(Login, mountOptions)
    expect(w.find('h1').exists()).toBe(true)
    expect(w.text()).toContain('统一登录')
    expect(w.findAll('input').length).toBeGreaterThanOrEqual(2)
    expect(w.find('button').exists()).toBe(true)
    expect(w.text()).toContain('© 2026')
  })

  it('2. 空表单提交触发校验（不调用 login）', async () => {
    const w = mount(Login, mountOptions)
    // 清空默认值
    const usernameInput = w.find('input[autocomplete="username"]')
    const passwordInput = w.find('input[autocomplete="current-password"]')
    expect(usernameInput.exists()).toBe(true)
    expect(passwordInput.exists()).toBe(true)
    await usernameInput.setValue('')
    await passwordInput.setValue('')
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockLogin).not.toHaveBeenCalled()
    expect(mockResolvePostLoginRedirect).not.toHaveBeenCalled()
  })

  it('3. 登录成功：toast success + 整页回跳（resolvePostLoginRedirect 解析目标）', async () => {
    // mock 返回值对齐 httpOnly 契约 LoginResult（{ profile }）——SUT 不消费返回值，
    // 但旧形态 { token } 是 token 落 localStorage 时代残留（2026-10-26 测试审计 #7）
    mockLogin.mockResolvedValueOnce({ profile: { id: 1, name: 'Admin' } })
    fakeLocation.search = '?redirect=%2Fworkbench'
    mockResolvePostLoginRedirect.mockReturnValueOnce('/workbench')
    const w = mount(Login, mountOptions)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    // 预填真后端种子账号 admin/admin123（统一登录接线真后端，Login.vue 默认 form）
    expect(mockLogin).toHaveBeenCalledWith({ username: 'admin', password: 'admin123' })
    // 对齐 65b3c96 易用性修复：success toast 须存活到整页跳转，提示文案为「正在跳转…」
    expect(ElMessage.success).toHaveBeenCalledWith('登录成功，正在跳转…')
    // jsdom referrer 为空 → resolveDefaultFallback 走 /auth/ 兜底（env 未注入）
    expect(mockResolvePostLoginRedirect).toHaveBeenCalledWith('/auth/')
    expect(window.location.href).toBe('/workbench')
  })

  it('4. 登录失败：toast error + 不回跳（无静默吞错）', async () => {
    mockLogin.mockRejectedValueOnce(new Error('密码错误'))
    const w = mount(Login, mountOptions)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalledWith('密码错误')
    expect(mockResolvePostLoginRedirect).not.toHaveBeenCalled()
    expect(window.location.href).toBe('http://localhost/login')
  })

  it('5. 无 redirect 参数且无 referrer：fallback 兜底 /auth/（对齐 referrer 推断实现）', async () => {
    mockLogin.mockResolvedValueOnce({ profile: { id: 1, name: 'Admin' } })
    // jsdom document.referrer 默认 '' → new URL('') 抛错 → env 未注入 → /auth/ 兜底
    const w = mount(Login, mountOptions)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockResolvePostLoginRedirect).toHaveBeenCalledWith('/auth/')
    expect(window.location.href).toBe('/admin/')
  })

  it('8. dev:gateway 注入 VITE_POST_LOGIN_FALLBACK：referrer 为空时经 env 兜底（子集模式）', async () => {
    mockLogin.mockResolvedValueOnce({ profile: { id: 1, name: 'Admin' } })
    vi.stubEnv('VITE_POST_LOGIN_FALLBACK', '/big/')
    const w = mount(Login, mountOptions)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockResolvePostLoginRedirect).toHaveBeenCalledWith('/big/')
  })

  it('9. referrer 推断优先于 env fallback（从 h5 跳来 → /h5/）', async () => {
    mockLogin.mockResolvedValueOnce({ profile: { id: 1, name: 'Admin' } })
    vi.stubEnv('VITE_POST_LOGIN_FALLBACK', '/big/')
    Object.defineProperty(document, 'referrer', {
      value: 'http://localhost/h5/demo',
      configurable: true,
    })
    const w = mount(Login, mountOptions)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockResolvePostLoginRedirect).toHaveBeenCalledWith('/h5/')
  })

  // 2026-11-04 线上 404 根因回归：gh-pages 形态（VITE_BASE=/<repo>/<app>/）下 referrer
  // pathname 首段是 repo 名——剥部署前缀后取 app 段，否则 repo 名被误当 app 名，
  // 经 withRepoPrefix 二次加前缀拼出 /<repo>/<repo>/ 404
  it('10. gh-pages 形态 referrer 剥部署前缀后推断来源 app（portal → /portal/）', async () => {
    mockLogin.mockResolvedValueOnce({ profile: { id: 1, name: 'Admin' } })
    vi.stubEnv('VITE_BASE', '/vue3-vite-project/auth/')
    Object.defineProperty(document, 'referrer', {
      value: 'https://mr-super-x.github.io/vue3-vite-project/portal/home',
      configurable: true,
    })
    const w = mount(Login, mountOptions)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    // 断言传参为 withRepoPrefix('/portal/') 的真实计算结果（gh-pages 加前缀）
    expect(mockResolvePostLoginRedirect).toHaveBeenCalledWith('/vue3-vite-project/portal/')
  })

  it('11. gh-pages 落地导航页 referrer（剥前缀后无 app 段）→ env fallback /admin/ 兜底', async () => {
    mockLogin.mockResolvedValueOnce({ profile: { id: 1, name: 'Admin' } })
    vi.stubEnv('VITE_BASE', '/vue3-vite-project/auth/')
    vi.stubEnv('VITE_POST_LOGIN_FALLBACK', '/admin/')
    Object.defineProperty(document, 'referrer', {
      value: 'https://mr-super-x.github.io/vue3-vite-project/',
      configurable: true,
    })
    const w = mount(Login, mountOptions)
    await w.find('form').trigger('submit.prevent')
    await flushPromises()
    expect(mockResolvePostLoginRedirect).toHaveBeenCalledWith('/vue3-vite-project/admin/')
  })

  it('6. 密码显隐切换：点击 👁 后 input type 切换', async () => {
    const w = mount(Login, mountOptions)
    const pwdInput = w.find('input[autocomplete="current-password"]')
    expect(pwdInput.exists()).toBe(true)
    expect(pwdInput.attributes('type')).toBe('password')
    const toggleBtn = w.find('button[aria-label="显示密码"]')
    expect(toggleBtn.exists()).toBe(true)
    await toggleBtn.trigger('click')
    await nextTick()
    const pwdInputAfter = w.find('input[autocomplete="current-password"]')
    expect(pwdInputAfter.attributes('type')).toBe('text')
  })

  it('7. 提交期间 loading 态：按钮 disabled', async () => {
    let resolveLogin!: (v: unknown) => void
    mockLogin.mockReturnValueOnce(
      new Promise((r) => {
        resolveLogin = r
      })
    )
    const w = mount(Login, mountOptions)
    await w.find('form').trigger('submit.prevent')
    // 等 validate 异步完成 + loading=true
    await flushPromises()
    // 用 BEM class 精准定位提交按钮（排除密码显隐按钮）
    const submitBtn = w.find('button.vv-login__submit')
    expect(submitBtn.exists()).toBe(true)
    expect(submitBtn.attributes('disabled')).toBeDefined()
    // 挂起态 resolve 也需契约形态（LoginResult），与用例 3/5 同因修正
    resolveLogin({ profile: { id: 1, name: 'Admin' } })
    await flushPromises()
  })
})
