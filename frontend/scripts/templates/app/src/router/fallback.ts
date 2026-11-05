/**
 * 路由兜底（catch-all 404）——薄封装。
 *
 * 单源实现归 @vv/shared 的 createFallbackRoute；注册顺序约束不变：必须注册在
 * 所有业务路由之后（保证最后匹配）；单独成文件而非并入 auto-register，避免
 * 错误页模块的字典序导致业务路由被错误拦截。
 *
 * @see [`./index.ts`](./index.ts) 路由注册顺序
 * @group 路由：兜底
 */
import { createFallbackRoute } from '@vv/shared'

export const fallbackRoute = createFallbackRoute()
