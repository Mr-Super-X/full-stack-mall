/**
 * 路由 UI 状态 store。
 *
 * 管理路由相关的临时 UI 状态（如远程菜单加载状态、路由错误等）。
 * 与 userStore 分离的原因：路由 UI 状态与用户登录态生命周期不同，且不需要持久化。
 *
 * - isLoadingRemoteMenu：remote 模式下守卫正在拉取后端菜单时为 true，
 *   业务组件可据此显示 Loading 骨架屏
 * - lastRouteError：最近一次路由错误（动态 import 失败等），用于错误页展示
 *
 * @see [`../../router/guards/remote-menu.ts`](../../router/guards/remote-menu.ts) 消费方
 * @see [`./user.ts`](./user.ts) 登出时 $reset
 * @group 状态管理：路由 UI
 */
export const useRouterStore = defineStore('router-ui', () => {
  const isLoadingRemoteMenu = ref(false)
  const lastRouteError = ref<Error | null>(null)

  function setLoadingRemoteMenu(value: boolean): void {
    isLoadingRemoteMenu.value = value
  }

  function setLastRouteError(error: Error | null): void {
    lastRouteError.value = error
  }

  function $reset(): void {
    isLoadingRemoteMenu.value = false
    lastRouteError.value = null
  }

  return {
    isLoadingRemoteMenu,
    lastRouteError,
    setLoadingRemoteMenu,
    setLastRouteError,
    $reset,
  }
})
