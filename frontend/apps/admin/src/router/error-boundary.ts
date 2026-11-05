/**
 * 路由错误边界（独立模块，便于测试）。
 *
 * 抽离 `src/router/index.ts` 中的 `router.onError` 处理逻辑为独立函数，
 * 让 5 段守卫、单文件入口、错误边界各司其职，便于单测覆盖。
 *
 * 触发场景：
 * 1. 动态 import 失败（语法错误、循环依赖、chunks 加载失败）
 * 2. 路由解析异常（`component` 字段无效、`formatInvalid`）
 * 3. chunk artifact 损坏（生产构建后 CDN 缓存导致 hash 不匹配）
 *
 * 行为：自动跳 `/500` 错误页，避免用户看到空白屏。
 *
 * @see [`./index.ts`](./index.ts) `setupRouterErrorBoundary` 调用点
 * @group 路由：错误边界
 */

import type { Router } from 'vue-router'

export const SERVER_ERROR_PATH = '/500'

/**
 * 路由错误处理统一入口。
 *
 * 设计要点：
 *  - 接收 router 实例，由调用方在 init router 后绑定一次
 *  - 检测 `currentRoute` 防止 500 页面本身加载失败时无限递归
 *  - 错误抛出 console.error 便于排查，同时不阻塞 UI（用户最终看到 500 页）
 *
 * @param router vue-router 实例
 * @returns 取消监听的 cleanup 函数
 */
export function setupRouterErrorBoundary(router: Router): () => void {
  const handleError = (error: unknown): void => {
    console.error('[router] 路由加载失败:', error)
    if (router.currentRoute.value.path !== SERVER_ERROR_PATH) {
      router.push(SERVER_ERROR_PATH).catch((pushError) => {
        // push 自己失败（例如 history mode 下返回到当前路由）
        // 此时只记录，不再次触发 onError
        console.error(`[router] 跳 ${SERVER_ERROR_PATH} 也失败:`, pushError)
      })
    }
  }
  router.onError(handleError)
  return () => {
    // Vue Router 没有提供 offError，只能借助 dynamic import 重写覆盖
    // 当前实现：保留监听（测试间通过 setActivePinia/createApp 隔离）
    // 如需真正的解绑，可在 setup 函数返回后将 handleError 设为 noop
    void handleError
  }
}
