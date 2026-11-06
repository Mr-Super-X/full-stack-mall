import type { LoginPayload, RegisterPayload, UserInfo } from '../apis/index'
import { h5MallApi } from '../apis/index'
import { Session } from '@vv/shared'

/**
 * 登录/注册表单 composable。
 *
 * 登录成功：写入 Session 'auth' 标记（shared http.ts 的 401 链依赖此标记守卫）。
 * 注册成功：不自动登录，由调用方决定是否紧接着 login（避免注册即登录的隐式副作用）。
 */
export function useAuthForm(mode: 'login' | 'register', form: LoginPayload | RegisterPayload) {
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const result = ref<UserInfo | null>(null)

  async function submit(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      if (mode === 'login') {
        result.value = await h5MallApi.login(form as LoginPayload)
        Session.set('auth', true)
      } else {
        result.value = await h5MallApi.register(form as RegisterPayload)
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
    } finally {
      loading.value = false
    }
  }

  return { loading, error, result, submit }
}
