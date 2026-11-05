/**
 * app 路由实例的依赖注入点（DI seam）。
 *
 * 为什么存在：@vv/shared 是纯库包，不得反向 import 任何 app 内部模块；
 * 但 useAppRouter / http 拦截器（401 登出跳转）运行时需要拿到 app 的 router 实例。
 * 由 app 侧在 createRouter 后立即 registerAppRouter(router) 完成接线
 * （admin 接线点：apps/admin/src/router/index.ts）。
 *
 * 时序承诺：所有读取都发生在导航/请求期（守卫在 createRouter 之后才执行），
 * 晚于注册点；模块 import 期不读实例。
 *
 * @group 路由：实例注入
 */
import type { Router } from 'vue-router'

let appRouterInstance: Router | null = null

/**
 * 注册 app 的 router 实例（app 启动期调用一次）。
 * 重复注册以最后一次为准（HMR / 测试重建场景安全）。
 */
export function registerAppRouter(router: Router): void {
  appRouterInstance = router
}

/**
 * 读取已注册的 router 实例。
 * 未注册即抛错（调用时机早于 app 启动完成属于编程错误，必须尽早暴露）。
 */
export function getAppRouter(): Router {
  if (!appRouterInstance) {
    throw new Error(
      '[@vv/shared] router 实例未注册：请在 createRouter 后调用 registerAppRouter(router)'
    )
  }
  return appRouterInstance
}
