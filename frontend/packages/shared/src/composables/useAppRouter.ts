/**
 * 路由组合式函数（业务侧高层 API）。
 *
 * 在 vue-router 的 `useRouter()` 之上封装业务级常用操作：
 * - `pushWithTitle`：跳转路由并写入 document.title（i18n 友好）
 * - `pushByName`：按 RouteName 类型安全跳转（无需记字符串）
 * - `replaceByName`：同上但用 replace（不留历史）
 * - `back`：安全返回（带 fallback）
 * - `addDynamicRoute`：远程菜单加载时按 name 注册（wrapper）
 * - `withErrorToast`：把 router.push 失败包装为 toast（避免裸 Promise rejection）
 *
 * 设计要点：
 * - 文件名 `useAppRouter.ts` 与导出名 `useAppRouter` 一致，**区别于 vue-router 的 `useRouter`**
 *   （参见 [[composable-useapprouter-naming]] 记忆）
 * - 不在 store 添加 router mutation（保持 router 单例由 vue-router 管）
 * - 所有 async 操作都 catch 错误并 toast，避免上层每处重复 try/catch
 * - 包化（P1-3）：router 实例经 `registerAppRouter` 由 app 侧注入（DI seam，见
 *   ../app-router.ts）；本包不得反向 import app 的 router 模块
 *
 * @see [`../app-router.ts`](../app-router.ts) router 实例注入点
 * @group 路由组合式 API
 */

import { ElMessage } from 'element-plus'
// 显式 import 不经 AutoImport resolver 的 importStyle 注入，消息样式须自行携带
import 'element-plus/es/components/message/style/css'
import { getAppRouter } from '../app-router.ts'
import { resolveRouteTitle } from '../router-title.ts'
// ElMessage 显式 import（packages 生产源码不依赖宿主 AutoImport，见 shared README「宿主装配契约」）
import { useI18n } from 'vue-i18n'
// handleRouterError 等模块级兜底 toast 无 setup 作用域的 t() 可用——引 i18n 实例走 global.t
// （与 http-errors 同方案；useI18n 仅在函数体内有 setup 上下文处使用——2026-10-29）
import { i18n } from '../locales/index.ts'
import type { RouteLocationRaw, RouteLocationNamedRaw, RouteRecordRaw, Router } from 'vue-router'

/**
 * 应用层路由 composable。
 *
 * 业务侧推荐使用本 composable 而非直接 import router 实例，以便：
 * - 集中错误处理（toast）
 * - i18n title 自动写入 document.title
 * - 类型安全的 pushByName + RouteName 联合类型检查
 *
 * @group 路由组合式 API
 */
export function useAppRouter(): {
  /** vue-router 实例（兼容旧 API） */
  router: Router
  /** 类型安全的按 name 跳转（2026-07-24 方案 A：name: string，校验靠 zod + pushByNameStrict） */
  pushByName: (name: string, params?: RouteLocationNamedRaw['params']) => Promise<void>
  /** dev 模式严格版：未注册路由立即 throw */
  pushByNameStrict: (name: string, params?: RouteLocationNamedRaw['params']) => Promise<void>
  /** 类型安全的按 name replace */
  replaceByName: (name: string, params?: RouteLocationNamedRaw['params']) => Promise<void>
  /** 跳转并设置 document.title（i18n 友好） */
  pushWithTitle: (to: RouteLocationRaw) => Promise<void>
  /** 安全返回（带 fallback） */
  back: (fallback?: RouteLocationRaw) => Promise<void>
  /** 远程菜单动态注入（wrapper） */
  addDynamicRoute: (route: RouteRecordRaw) => void
  /** 把 router 操作失败的 Promise rejection 包成 toast */
  withErrorToast: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => T
  /** 快捷方法集：常用错误页 + 首页 */
  goHome: () => Promise<void>
  goLogin: (returnUrl?: string) => Promise<void>
  go403: () => Promise<void>
  go404: () => Promise<void>
  go500: () => Promise<void>
} {
  // 运行期取注入的 app router 实例（注册点：app 的 router/index.ts，createRouter 之后）。
  // 调用时机晚于注册（setup / 事件回调 / 守卫执行期），模块 import 期不读取。
  const router = getAppRouter()

  /**
   * 类型安全的按 name 跳转（2026-07-24 方案 A：name 改 string）。
   *
   * 拼写校验：
   *   - 编译期：name: string（无联合类型约束）
   *   - dev 模式运行时：用 pushByNameStrict 兜底（未注册 throw）
   *   - 远程菜单：zod schema 在 remote.ts 校验
   *
   * @example
   *   await pushByName('UserList', { id: 1 })
   */
  async function pushByName(
    name: string,
    params: RouteLocationNamedRaw['params'] = {}
  ): Promise<void> {
    try {
      await router.push({ name, params })
    } catch (err) {
      handleRouterError(err)
    }
  }

  /**
   * 开发期严格版按 name 跳转（替代原 RouteName 联合类型约束）。
   *
   * 与 pushByName 的区别：
   *   - dev 模式（import.meta.env.DEV）：若 name 不在已注册路由中，立即抛 Error
   *   - prod 模式：与 pushByName 行为一致（toast + 不抛）
   *
   * 用法：业务侧在明确知道目标路由必须存在时用 strict 版本，
   * 尽早暴露路由拼写错误或未注册路由。
   *
   * @example
   *   await pushByNameStrict('OrdersList')  // dev 模式：未注册立即 throw
   */
  async function pushByNameStrict(
    name: string,
    params: RouteLocationNamedRaw['params'] = {}
  ): Promise<void> {
    if (import.meta.env.DEV) {
      const exists = router.resolve({ name }).name === name
      if (!exists) {
        const err = new Error(
          `[useAppRouter] pushByNameStrict: 路由 "${name}" 未注册或未注入。请检查 routes/index.ts。`
        )
        console.error(err)
        throw err
      }
    }
    return pushByName(name, params)
  }

  async function replaceByName(
    name: string,
    params: RouteLocationNamedRaw['params'] = {}
  ): Promise<void> {
    try {
      await router.replace({ name, params })
    } catch (err) {
      handleRouterError(err)
    }
  }

  /**
   * 通用跳转 + 设置 document.title。
   *
   * title 来源：route.meta.titleKey 优先（i18n 查找），fallback 到 title / name。
   *
   * 实现要点：用 `router.currentRoute.value` 读取跳转后的路由，而非依赖 `router.push`
   * 的返回值。原因：vue-router 的 push 返回类型是 `NavigationFailure | void | undefined`，
   * 无法在编译期 narrowing 到 RouteLocationNormalized（NavigationFailure 没有 `meta` 字段）。
   * `currentRoute.value` 始终是完整 RouteLocationNormalized 类型，类型安全。
   *
   * 守卫可能二次跳转（return { path: '/login' } 等），此时 currentRoute 反映最终位置，符合预期。
   */
  async function pushWithTitle(to: RouteLocationRaw): Promise<void> {
    try {
      // i18n 在 setup 上下文捕获 t 函数（不传 t 时 resolveRouteTitle 走 fallback 链）
      const { t } = useI18n()
      await router.push(to)
      // 跳转完成后读取当前路由（一定是 RouteLocationNormalized，无需 any 转换）
      const newTitle = resolveRouteTitle(router.currentRoute.value, t)
      if (newTitle) document.title = newTitle
    } catch (err) {
      handleRouterError(err)
    }
  }

  /**
   * 安全返回。如果 history 为空（如直接刷新进入 SPA），fallback 到指定路由。
   *
   * @param fallback 当前 history 为空时的兜底跳转（默认首页 '/'）
   */
  async function back(fallback: RouteLocationRaw = { path: '/' }): Promise<void> {
    try {
      if (window.history.length > 1) {
        router.back()
      } else {
        await router.push(fallback)
      }
    } catch (err) {
      handleRouterError(err)
    }
  }

  /**
   * 远程菜单加载时按 route 对象注入（包装 router.addRoute）。
   * 业务层调用点：路由守卫的 ensureRemoteMenuLoaded。
   */
  function addDynamicRoute(route: RouteRecordRaw): void {
    router.addRoute(route)
  }

  /**
   * 高阶函数：把 router 异步操作的错误统一 toast。
   *
   * @example
   *   const safePush = withErrorToast(router.push)
   *   await safePush({ name: 'UserList' })
   */
  function withErrorToast<T extends (...args: never[]) => Promise<unknown>>(fn: T): T {
    return ((...args: never[]) => {
      try {
        return fn(...args).catch((err: unknown) => handleRouterError(err))
      } catch (err) {
        handleRouterError(err)
        return Promise.resolve()
      }
    }) as T
  }

  /**
   * 快捷跳转：常用错误页 + 首页 + 登录页。
   *
   * 设计要点：用 RouteName 联合类型约束（拼写错误编译期暴露）；
   * 错误时静默（被 withErrorToast 包装统一 toast）。
   *
   * @example
   *   const { goHome, goLogin, go403 } = useAppRouter()
   *   await goHome()
   *   await goLogin('/user/list')  // 登录后回 redirect
   *   await go403()                 // 无权限时
   */
  async function goHome(): Promise<void> {
    return pushByName('Home')
  }

  async function goLogin(returnUrl?: string): Promise<void> {
    const query = returnUrl ? { redirect: returnUrl } : undefined
    return pushByName('Login', query)
  }

  async function go403(): Promise<void> {
    return pushByName('Forbidden')
  }

  async function go404(): Promise<void> {
    return pushByName('NotFound')
  }

  async function go500(): Promise<void> {
    return pushByName('ServerError')
  }

  /** 统一错误处理：toast + console.error */
  function handleRouterError(err: unknown): void {
    // 跳当前路由（vue-router 在重复导航时抛 NavigationFailure，跳当前路由是正常情况，不报错）
    const errMessage = err instanceof Error ? err.message : String(err)
    if (/Avoided redundant navigation/i.test(errMessage)) return
    console.error('[useAppRouter] 路由操作失败:', err)
    if (typeof ElMessage !== 'undefined') {
      // 逻辑层 toast 走 i18n.global.t（composable 内无 setup 上下文约束，同 http-errors 方案——2026-10-29）
      ElMessage.error(i18n.global.t('common.routerPushFailed'))
    }
  }

  return {
    router,
    pushByName,
    pushByNameStrict,
    replaceByName,
    pushWithTitle,
    back,
    addDynamicRoute,
    withErrorToast,
    goHome,
    goLogin,
    go403,
    go404,
    go500,
  }
}
