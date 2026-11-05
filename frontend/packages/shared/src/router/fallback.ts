/**
 * 路由兜底工厂（@vv/shared 单源）。
 *
 * 文件角色：catch-all 404 兜底路由的跨 app 单源实现。
 * 必须注册在所有业务路由**之后**（保证最后匹配）；单独成工厂而非并入各 app 的
 * auto-register，避免错误页模块的字典序导致 `/user/*` 被错误拦截。
 *
 * 下沉原因（P5）：原 6 个 app 的 router/fallback.ts 近乎逐字重复（仅注释差异），
 * h5 甚至出现「404 目标页是 docs 自带」的文案漂移——收敛为工厂后实现与注释只维护一份，
 * 各 app 的 fallback.ts 退化为薄封装（维持 `./fallback` 导入路径不变）。
 *
 * @group 路由：兜底
 */

import type { RouteRecordRaw } from 'vue-router'

/**
 * 创建 catch-all 404 兜底路由：捕获所有未匹配路径并重定向到本 app 的 NotFound 页。
 *
 * @param notFoundPath - 404 目标路径（各 app NotFound 路由的 path，6 app 均为 `/404`）
 */
export function createFallbackRoute(notFoundPath = '/404'): RouteRecordRaw {
  return {
    path: '/:pathMatch(.*)*',
    redirect: notFoundPath,
  }
}
