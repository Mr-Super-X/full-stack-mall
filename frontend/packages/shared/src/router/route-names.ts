/**
 * 路由 name 递归提取工具 —— 模块 routes 文件的 routeNames 单源实现。
 *
 * 背景（2026-10-23 重复性审查）：5 个 app 的模块 routes 曾各写一份 name 提取——
 * auth/portal/docs 三份递归 visit IIFE 逐字相同，h5 是 flatMap 一层 children 变体，
 * big 是硬编码字面量（新增子路由时白名单不跟随，漂移面最大）。全部统一走本函数：
 * 递归拍平嵌套 children，只收集字符串 name（符号 name 不参与白名单语义）。
 *
 * 消费方约定：模块 routes/index.ts 里 `export const routeNames = collectRouteNames(routes)`，
 * 各 app `src/router/whitelist.ts` 经 `...routeNames` 全量吸收（check:routes A 校验同源）。
 *
 * @group 路由工具
 */
import type { RouteRecordRaw } from 'vue-router'

/**
 * 从路由数组递归提取所有字符串 name（嵌套 children 一并拍平）。
 *
 * @param routes - 路由记录数组（通常为模块 routes 常量）
 * @returns 扁平 name 列表（只含字符串 name；符号 name 被跳过——白名单语义只认字符串）
 */
export function collectRouteNames(routes: readonly RouteRecordRaw[]): readonly string[] {
  const names: string[] = []
  const visit = (records: readonly RouteRecordRaw[]): void => {
    for (const record of records) {
      if (typeof record.name === 'string') names.push(record.name)
      if (record.children?.length) visit(record.children)
    }
  }
  visit(routes)
  return names
}
