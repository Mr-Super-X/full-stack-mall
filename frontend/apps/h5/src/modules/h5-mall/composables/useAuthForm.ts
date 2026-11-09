import { computed } from 'vue'
import { useUserStore } from '@vv/shared'
// @api 别名指 @vv/shared/src/api（§1.6.2 既定例外：shared barrel 刻意不聚合 api 值导出，
// http.ts 模块加载即建 axios 实例有副作用）；authApi 值只能经别名路径消费
import { authApi } from '@api/modules/auth'

/**
 * 登录/注册表单 composable（统一登录接线 shared 契约，计划 07 v2）。
 *
 * 登录成功：走 shared `userStore.login`（内部链 authApi.login → Session 标记 → fetchProfile
 * 填充 shared profile + permissions → 字典预加载）——h5 不再维护平行登录态，与 apps/admin /
 * apps/auth 共用同一套会话与权限模型。`result` 暴露登录后的 profile（computed 自 store）。
 * 注册成功：走 shared `authApi.register`（不自动登录，由调用方决定是否紧接着 login）。
 */
export function useAuthForm(
  mode: 'login' | 'register',
  form: { username: string; password: string; nickname?: string }
) {
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const userStore = useUserStore()
  const result = computed(() => userStore.profile)

  async function submit(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      if (mode === 'login') {
        await userStore.login({ username: form.username, password: form.password })
      } else {
        await authApi.register({
          username: form.username,
          password: form.password,
          ...(form.nickname ? { nickname: form.nickname } : {}),
        })
      }
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
    } finally {
      loading.value = false
    }
  }

  return { loading, error, result, submit }
}
