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
 * 与 admin 的同名文件保持一致（`import.meta.glob` 字面量 `/src/modules/**`
 * 以各 app 的 vite root 为基准，跨 app 原样复用，P1-5 确认）；auth 裁剪掉
 * COMPONENT_REGISTRY（远程菜单的 name→loader 映射，auth 无远程菜单）。
 *
 * @see [`./fallback.ts`](./fallback.ts) catch-all 404 注册
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
 * 命名约束：
 *   1. 业务模块路由文件必须命名为 `routes/index.ts`（不是 `routes.ts`）
 *   2. 必须放在 `src/modules/<feature>/` 目录下
 *   3. 导出格式必须是 `export default RouteRecordRaw[]`
 *
 * 路径前缀 `/` 以 Vite 项目根为基准（Monorepo 下每个 app 的 vite root = 自身目录，
 * 因此该字面量可跨 app 原样复用）。
 *
 * 为什么不能用变量：Vite 在编译期扫描源码中 `import.meta.glob(...)` 的字面量参数，
 * 动态变量无法被静态分析。详见 https://cn.vitejs.dev/guide/features.html#glob-import
 */
const modules = import.meta.glob<RouteModuleExport>('/src/modules/**/routes/index.ts', {
  eager: true,
})

export const autoRegisteredRoutes: RouteRecordRaw[] = autoImport({
  modules,
  transform: (_, m) => m.default,
}).flat()
