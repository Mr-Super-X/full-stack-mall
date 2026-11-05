/**
 * 用户登录态 + profile + 权限码（全局共享 store）。
 *
 * 设计要点：
 * - httpOnly 凭证：cookie 由后端管理，前端不可读；用 `Session.get('auth')` 标记位供守卫同步判断
 * - 乐观退出：先清本地状态（用户立即"已退出"），后端 logout fire-and-forget
 * - 不依赖 router 实例：避免 store → router → guards → store 的循环依赖
 * - 复位钩子注入（P1-3 包化）：守卫状态 / 路由 UI store 归 app 私有，本包不反向依赖 app；
 *   app 侧经 `registerLocalStateResetHook` 挂接清理逻辑（admin 接线点：router/guards/auth.ts）
 *
 * @see `./composables/useAuth`（本包内文件）—— 权限判断上层封装
 * @see `@vv/ui/composables/useLogout` —— 退出登录流程（弹窗族在 ui 包，原 @composables 路径双重错误）
 * @see [`./dict.ts`](./dict.ts) 登录后字典预加载
 * @group 状态管理：用户登录
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi, type LoginPayload, type UserProfile } from '../../api/modules/auth.ts'
import { Session } from '../../utils/storage.ts'
import { globalAbort } from '../../api/global-abort.ts'
import { useDictStore } from './dict'

/**
 * 本地登录态复位时的附加清理钩子注册表（app 侧在启动期注册）。
 *
 * 典型注册项：admin 的守卫状态复位（resetAuthGuardState）+ 路由 UI store $reset。
 * 钩子由 resetLocalState 逐个调用；单个钩子抛错仅 warn，不阻断其余钩子。
 *
 * @returns 反注册函数（测试 / HMR 场景用）
 */
const localStateResetHooks = new Set<() => void>()
export function registerLocalStateResetHook(hook: () => void): () => void {
  localStateResetHooks.add(hook)
  return () => {
    localStateResetHooks.delete(hook)
  }
}

export const useUserStore = defineStore('user', () => {
  // httpOnly 模式（2026-08-12 改造）：凭证 cookie 前端不可读，
  // 用 sessionStorage 登录标记供守卫同步判断；真正凭证校验由后端完成
  const authenticated = ref<boolean>(Session.get<boolean>('auth') ?? false)
  const profile = ref<UserProfile | null>(null)
  const permissions = ref<string[]>([])

  const isLoggedIn = computed(() => authenticated.value)

  async function login(credentials: LoginPayload) {
    // 登录成功：后端已 Set-Cookie 凭证，前端只写登录标记
    await authApi.login(credentials)
    Session.set('auth', true)
    authenticated.value = true
    await fetchProfile()
    // 登录成功后预加载常用字典（失败不阻塞登录流程，5min TTL 兜底）
    try {
      await useDictStore().preloadDict()
    } catch (err) {
      console.warn('[user] 字典预加载失败（不阻塞登录流程）:', err)
    }
  }

  /**
   * 拉取 profile 并写回 store（含权限列表）。
   *
   * @param options.silent 透传 authApi：门户头部「探测登录态」场景传 true——
   *   请求失败不触发全局错误反馈（toast/网络横幅），由调用方 .catch 降级。
   *   守卫等强依赖场景不传，错误照常上报。
   */
  async function fetchProfile(options?: { silent?: boolean }) {
    const p = await authApi.fetchProfile(options)
    profile.value = p
    permissions.value = p.permissions
    // 探测成功即证明 cookie 会话真实有效；本 origin 标记缺失时补写——cookie 不按
    // 端口隔离而 sessionStorage 按端口隔离，跨端口/首次经网关访问时（portal 探测
    // 成功后跳 admin），守卫（Session.get('auth')）才有同步判定依据
    if (!Session.get<boolean>('auth')) Session.set('auth', true)
  }

  /**
   * 清空本地登录态（不动后端凭证 cookie）。
   * 供 logout 与守卫在凭证失效（fetchProfile 401）时调用。
   *
   * 注意：最后调用 globalAbort.reset() 创建新的 controller，
   * 避免重新登录后所有请求因仍处于 aborted 状态被立即取消。
   */
  function resetLocalState(): void {
    Session.remove('auth')
    authenticated.value = false
    profile.value = null
    permissions.value = []
    globalAbort.abort('logout')
    // app 侧注册的复位钩子（守卫状态 / 路由 UI store 等；单钩子失败不阻断其余）
    for (const hook of localStateResetHooks) {
      try {
        hook()
      } catch (err) {
        console.warn('[user] 登录态复位钩子执行失败（已跳过，不影响其余钩子）:', err)
      }
    }
    // 为下一个 session 准备：创建新的 AbortController，否则重新登录的请求会全部 abort
    globalAbort.reset()
  }

  /**
   * 乐观退出（2026-08-12 改造）：先清本地登录态（用户立即"已退出"），
   * 后端 logout 请求 fire-and-forget——弱网/后端故障时用户也能正常退出。
   * 凭证 cookie 由后端响应 `Set-Cookie: Max-Age=0` 清除；请求失败时凭证
   * 会自然过期，且后续请求 401 会再次触发 refresh 失败 → performLogout 兜底。
   *
   * 跳转职责在调用方（useLogout / 守卫），store 不依赖 router 实例，
   * 避免 store → router → guards → store 的循环依赖。
   */
  async function logout(): Promise<void> {
    resetLocalState()
    try {
      await authApi.logout()
    } catch (err) {
      console.warn('[user] 后端 logout 请求失败（本地已退出，不影响）:', err)
    }
  }

  return {
    authenticated,
    profile,
    permissions,
    isLoggedIn,
    login,
    fetchProfile,
    logout,
    resetLocalState,
  }
})
