/**
 * 路由自动注册。
 *
 * 自动扫描 `src/modules/<dir>/routes/index.ts` 并注册到全局路由。
 * 业务模块无需在 `router/index.ts` 中手动 import —— 新增页面后自动生效。
 *
 * 使用 Vite `import.meta.glob` 特性（构建期扫描，不影响运行时性能）：
 * - 路径以 `/` 开头表示项目根
 * - `eager: true` 表示同步加载（路由配置需要立即可用）
 * - 返回值是 `{ [path]: Module }` 字典
 *
 * 排除规则：
 * - error 模块的具名错误页走自动注册（`src/modules/error/routes/index.ts`）
 * - catch-all 404 兜底单独在 `router/fallback.ts` 注册（保证最后匹配）
 *
 * 新增业务模块的标准流程（无需改 router 目录）：
 * 1. 创建 `src/modules/<feature>/routes/index.ts`
 * 2. ~~在 types.ts 追加 RouteName~~（2026-07-24 方案 A 移除）
 * 3. ~~在 component-registry.ts 追加同名映射~~（已合并到本文件）
 * 4. 完成 —— 路由自动可用
 * （`scripts/check-routes.ts` 可一键校验）
 *
 * @see [`./fallback.ts`](./fallback.ts) catch-all 404 注册
 * @see [`./remote.ts`](./remote.ts) `COMPONENT_REGISTRY` 使用方
 * @group 路由：自动注册
 */

import type { RouteRecordRaw } from 'vue-router'
import { autoImport } from '@vv/shared'

interface RouteModuleExport {
  default: RouteRecordRaw[]
}

/**
 * Vite `import.meta.glob` 路径（必须是字面量字符串，Vite 编译期限制）。
 *
 * 命名约束（修改本字符串前请同步更新 docs/07-路由模块设计.md）：
 *   1. 业务模块路由文件必须命名为 `routes/index.ts`（不是 `routes.ts`）
 *   2. 必须放在 `src/modules/<feature>/` 目录下
 *   3. 导出格式必须是 `export default RouteRecordRaw[]`
 *
 * 路径前缀 `/` 以 Vite 项目根为基准（Monorepo 下每个 app 的 vite root = 自身目录，
 * 因此该字面量可跨 app 原样复用——docs/portal/h5/big 抽离时无需改写；
 * 曾评估的相对字面量方案（'../modules/**'）无此优势，P1-5 确认不采纳）。
 *
 * 为什么不能用变量：Vite 在编译期扫描源码中 `import.meta.glob(...)` 的字面量参数，
 * 动态变量无法被静态分析。详见 https://cn.vitejs.dev/guide/features.html#glob-import
 */
const modules = import.meta.glob<RouteModuleExport>('/src/modules/**/routes/index.ts', {
  eager: true,
})

/**
 * 路由 name → 视图组件 loader 的映射（从 autoRegisteredRoutes 派生）。
 *
 * 设计要点：
 *   - 替代了原本的 src/router/component-registry.ts
 *   - 单一 source of truth：路由配置 routes/index.ts
 *   - 新增业务路由**只需在 routes/index.ts 写一次**（无需同步 component-registry）
 *   - 类型：Record<string, ...>，避免 auto-register 反向依赖 RouteName 联合类型
 *   - 远程菜单（router/remote.ts）通过此映射按 name 查找 component loader
 *
 * 边界处理：
 *   - 跳过无 name 或无 component 的路由（如 layout 包裹层、catch-all 兜底）
 *   - 重复 name 时 console.warn + 后注册覆盖前者
 *   - 递归处理 routes.children（嵌套路由同样提取）
 */
export const autoRegisteredRoutes: RouteRecordRaw[] = autoImport({
  modules,
  transform: (_, m) => m.default,
}).flat()

export const COMPONENT_REGISTRY: Record<string, () => Promise<unknown>> = (() => {
  const map: Record<string, () => Promise<unknown>> = {}
  const visit = (routes: RouteRecordRaw[]): void => {
    for (const route of routes) {
      if (route.name && route.component) {
        const name = String(route.name)
        if (map[name]) {
          console.warn(`[router/auto-register] 重复的路由 name: ${name}（后注册会覆盖）`)
        }
        map[name] = route.component as () => Promise<unknown>
      }
      if (route.children?.length) visit(route.children)
    }
  }
  visit(autoRegisteredRoutes)
  return map
})()
