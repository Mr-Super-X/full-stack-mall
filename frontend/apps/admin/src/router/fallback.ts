/**
 * 路由兜底（catch-all 404）——薄封装。
 *
 * 单源实现归 @vv/shared 的 createFallbackRoute（P5 下沉：原 6 app 逐字拷贝收敛，
 * 根治逐 app 注释漂移——h5 曾残留「404 目标页是 docs 自带」的错误文案）。
 * 注册顺序约束不变：必须注册在所有业务路由之后（保证最后匹配）；单独成文件而非
 * 并入 auto-register，避免错误页模块的字典序导致 `/user/*` 被错误拦截。
 *
 * @see [`./index.ts`](./index.ts) 路由注册顺序
 * @group 路由：兜底
 */
import { createFallbackRoute } from '@vv/shared'

export const fallbackRoute = createFallbackRoute()
