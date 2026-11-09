import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

// 统一登录接线 shared 契约（计划 07 v2）：useAuthForm 消费 shared userStore.login / authApi.register。
// mock 说明符与被测模块 import 说明符一致：userStore 走 '@vv/shared'，authApi 走 '@api/modules/auth'
//（§1.6.2 既定例外路径）；importOriginal 展开其余导出（Session 等）。
// vi.hoisted：vi.mock 工厂被提升到文件顶，内部引用变量须经 hoisted 声明避免暂时性死区。
const { mockLogin, mockRegister } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
}))

vi.mock('@vv/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vv/shared')>()
  return {
    ...actual,
    useUserStore: () => ({
      login: mockLogin,
      profile: { id: 2, name: '阿珍的衣柜', permissions: ['mall:user'] },
    }),
  }
})

vi.mock('@api/modules/auth', () => ({
  authApi: {
    register: mockRegister,
  },
}))

import { useAuthForm } from './useAuthForm'

describe('useAuthForm（统一登录接线 shared）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('登录成功走 userStore.login 并暴露 profile', async () => {
    mockLogin.mockResolvedValue(undefined)

    const form = reactive({ username: 'seller', password: 'seller123' })
    const { loading, error, result, submit } = useAuthForm('login', form)

    await submit()

    expect(mockLogin).toHaveBeenCalledWith({ username: 'seller', password: 'seller123' })
    expect(result.value?.name).toBe('阿珍的衣柜')
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('登录失败应返回错误', async () => {
    mockLogin.mockRejectedValue(new Error('用户名或密码错误'))

    const form = reactive({ username: 'seller', password: 'wrong' })
    const { loading, error, submit } = useAuthForm('login', form)

    await submit()

    expect(error.value?.message).toBe('用户名或密码错误')
    expect(loading.value).toBe(false)
  })

  it('注册成功走 authApi.register（不自动登录，不写 Session）', async () => {
    mockRegister.mockResolvedValue({
      id: 4,
      username: 'newbie',
      nickname: '新人',
      avatar: null,
      role: 'USER',
    })

    const form = reactive({ username: 'newbie', password: '123456', nickname: '新人' })
    const { loading, error, submit } = useAuthForm('register', form)

    await submit()

    expect(mockRegister).toHaveBeenCalledWith({
      username: 'newbie',
      password: '123456',
      nickname: '新人',
    })
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })
})
