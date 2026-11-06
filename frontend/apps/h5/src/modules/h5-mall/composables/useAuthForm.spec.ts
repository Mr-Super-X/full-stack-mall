import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'

import type { UserInfo } from '../apis/index'

// mock API 层与 Session
vi.mock('../apis/index', () => ({
  h5MallApi: {
    login: vi.fn(),
    register: vi.fn(),
  },
}))
vi.mock('@vv/shared', () => ({
  Session: {
    set: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
  },
}))

import { h5MallApi } from '../apis/index'
import { Session } from '@vv/shared'
import { useAuthForm } from './useAuthForm'

describe('useAuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('登录成功应写入 Session auth 标记并返回用户信息', async () => {
    const mockUser: UserInfo = { id: 2, username: 'seller', nickname: '阿珍的衣柜', role: 'USER' }
    vi.mocked(h5MallApi.login).mockResolvedValue(mockUser)

    const form = reactive({ username: 'seller', password: 'seller123' })
    const { loading, error, submit } = useAuthForm('login', form)

    await submit()

    expect(h5MallApi.login).toHaveBeenCalledWith({ username: 'seller', password: 'seller123' })
    expect(Session.set).toHaveBeenCalledWith('auth', true)
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('登录失败应返回错误且不写 Session', async () => {
    vi.mocked(h5MallApi.login).mockRejectedValue(new Error('用户名或密码错误'))

    const form = reactive({ username: 'seller', password: 'wrong' })
    const { loading, error, submit } = useAuthForm('login', form)

    await submit()

    expect(error.value).toBeTruthy()
    expect(Session.set).not.toHaveBeenCalled()
    expect(loading.value).toBe(false)
  })

  it('注册成功应返回用户信息（不写 Session，不自动登录）', async () => {
    const mockUser: UserInfo = { id: 4, username: 'newbie', nickname: '新人', role: 'USER' }
    vi.mocked(h5MallApi.register).mockResolvedValue(mockUser)

    const form = reactive({ username: 'newbie', password: '123456', nickname: '新人' })
    const { loading, error, submit } = useAuthForm('register', form)

    await submit()

    expect(h5MallApi.register).toHaveBeenCalledWith({
      username: 'newbie',
      password: '123456',
      nickname: '新人',
    })
    expect(Session.set).not.toHaveBeenCalled()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })
})
