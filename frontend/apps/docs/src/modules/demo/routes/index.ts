// demo 模块路由（docs 应用唯一业务模块，始终注册）
//
// P2 变更：模块物理独立到 apps/docs 后，「常规 prod tree-shake 剔除」的 DEV 门控
// 失去存在意义——docs 本身就是全量 demo 站点，不再与 admin 共享构建图。
// isDemoRoutesEnabled / VITE_DEMO_NO_AUTH 环境判断随门控一并删除。
// cspell:disable xform — demo 辅助 .ts 文件按 kebab-case 命名（xform-api 等），
//                          与 AutoImport 标准不同，不算可拼写错误
//
// 全部自动化：扫描 examples/ 下所有 .vue 入口自动注册 children 路由。
// 加新 demo 组件**只需在 examples/ 目录新建 PascalCase.vue** ——
// 路由名 / path / meta.title 自动派生，sidebar 自动出现，无需改本文件。
//
// 支持三种文件组织方式（glob 同时扫）：
//   examples/AsyncState.vue           → path: 'async-state',     name: 'DemoAsyncState'
//   examples/ErrorBoundary/index.vue  → path: 'error-boundary',  name: 'DemoErrorBoundary'
//                                       （剥掉 index.vue 后缀，取父目录名）
//   examples/XForm/XFormArray.vue     → path: 'x-form-array',    name: 'DemoXFormArray'
//                                       （按组件建子目录，每个 .vue 各自注册成路由）
//   examples/XForm/XFormOverview.vue  → path: 'x-form-overview', name: 'DemoXFormOverview'
//                                       （组件子目录下 Overview 文件作为该组件的「总览」入口）
//   examples/MyButton/index.vue       → path: 'my-button',       name: 'DemoMyButton'
//                                       （组件子目录的 index 作为该组件的「总览」入口，
//                                        与按文件命名 Overview 等价，方案二选一）
//
import type { RouteRecordRaw } from 'vue-router'
import type { Component } from 'vue'
import { pascalCase, kebabCase, autoImport } from '@utils'
// routeNames 提取收敛 @vv/shared 单源（2026-10-23 重复性审查：5 app 三份拷贝+变体+字面量统一）
import { collectRouteNames } from '@vv/shared'

// Vite import.meta.glob 扫描 examples 下所有 .vue 入口
// 路径相对当前文件（routes/index.ts），examples 在父目录 → 用 '../examples/...'
// 路径必须是字面量字符串（Vite 编译期限制）。
//
// DEMO 门控：未启用时整个表达式替换为 {}，import.meta.glob 不展开，
// examples 文件不进 bundle，整模块 tree-shake 干净。
//
// ★ 第三条 `../examples/*/*.vue` 支持「按组件建子目录」模式：
//   例如 XForm 目录下 56 个 XForm*.vue + 6 个 XForm/*.ts 辅助文件，
//   各自派生为独立路由（.ts 不进 glob）；XForm/index.vue 派生为该组件总览页。
//   文件名包含完整 PascalCase（如 XFormArray），不会与父目录重复。
const exampleModules: Record<string, () => Promise<{ default: Component }>> = import.meta.glob<{
  default: Component
}>(['../examples/*.vue', '../examples/*/index.vue', '../examples/*/*.vue'])

/** 从 glob 返回的 key 中提取组件名（剥目录与 .vue 后缀） */
function deriveComponentName(filePath: string): string {
  // '../examples/AsyncState.vue'         → ['..', 'examples', 'AsyncState.vue']
  // '../examples/MyButton/index.vue'     → ['..', 'examples', 'MyButton', 'index.vue']
  const segments = filePath.split('/')
  const last = segments[segments.length - 1]!
  // 文件夹 + index.vue 形式：取父目录名
  if (last === 'index.vue') return segments[segments.length - 2]!
  // 直接 .vue 文件：去掉后缀
  return last.replace(/\.vue$/, '')
}

/** 把 glob 扫描结果转为 RouteRecordRaw 数组 */
function buildExampleRoutes(): RouteRecordRaw[] {
  return autoImport({
    modules: exampleModules,
    transform: (filePath, component) => {
      const fileName = deriveComponentName(filePath)
      return {
        path: kebabCase(fileName),
        name: 'Demo' + pascalCase(fileName),
        component: component as () => Promise<unknown>,
        meta: { title: pascalCase(fileName), icon: 'document' },
      }
    },
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

const exampleRoutes = buildExampleRoutes()
/**
 * 默认 redirect 目标：用函数式 redirect 异步解析。
 *
 * v3.0 修复根因：
 * 之前用 `redirect: { name: defaultChildName }`（vue-router 4 在 redirect 时同步解析 name
 * → 目标 route 的 component 是异步 import chunk → first-load 时 chunk 加载未完成
 * → redirect 失败 → router.onError 跳 /500）。
 * 直接访问各 demo 路径正常，仅 redirect 触发的 SPA 跳转有问题。
 *
 * 治本方案：函数式 redirect 在路由守卫阶段触发，可等待目标 route 完成注册。
 * fallback：当 exampleRoutes 为空或解析失败时，跳到 /demo（避免无限循环）。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/demo',
    name: 'Demo',
    // 路由级布局：DocLayout 固定为父组件，子路由切换不重挂载侧栏（见 layouts/DemoDocs.vue）
    component: () => import('../layouts/DemoDocs.vue'),
    redirect: () => {
      // exampleRoutes[0] 是按字母序排序的第一个 demo（demo 模块内部保证非空，
      // 若空则 fallback 到 /demo 自身，无限循环由 ErrorBoundary 兜底）
      const firstPath = exampleRoutes[0]?.path
      return firstPath ? { path: `/demo/${firstPath}` } : '/demo'
    },
    meta: { title: '组件示例', titleKey: 'menu.demo', icon: 'magic-stick' },
    children: exampleRoutes,
  },
]

/**
 * 全部 demo 路由 name（供 docs 白名单吸收）。
 * 提取逻辑单源在 @vv/shared `collectRouteNames`（递归拍平 children，新增 demo 自动跟随）。
 */
export const routeNames: readonly string[] = collectRouteNames(routes)

export default routes
