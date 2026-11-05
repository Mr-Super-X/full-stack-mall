/**
 * 通用 auto-import helper：扫描模块 + 过滤 + 转换。
 *
 * 设计要点：
 * - 调用方负责 `import.meta.glob(...)`（Vite 编译期字面量要求，无法 mock）
 * - 本 helper 只负责 filter + transform，逻辑可单测覆盖
 * - 适用于：路由聚合、组件注册、指令安装、插件加载等场景
 *
 * ⚠️ 重要：spec/test 文件必须在 import.meta.glob 的 **pattern 层级** 排除（`<dir>/*.spec.ts` 用 ! 前缀），
 * 不能依赖 filter 阶段——因为 import.meta.glob + eager:true 在加载时已 import 所有匹配文件，
 * filter 只决定是否处理，**无法阻止加载**。filter 阶段排除只能作为业务特定补充。
 *
 * @example 路由聚合（glob pattern 用 ! 排除 spec）
 * ```ts
 * const modules = import.meta.glob<RouteModuleExport>(
 *   ['/src/modules/DIR/routes/index.ts', '!/src/modules/DIR/routes/*.spec.ts'],
 *   { eager: true }
 * )
 * export const autoRegisteredRoutes = autoImport({
 *   modules,
 *   transform: (_, m) => m.default,
 * }).flat()
 * ```
 *
 * @example Vue 组件注册
 * ```ts
 * const modules = import.meta.glob<{ default: Component }>(
 *   ['./common/COMPONENT.{vue,Vue}', '!./common/<dir>/*.spec.ts'],
 *   { eager: true }
 * )
 * for (const _ of autoImport({
 *   modules,
 *   filter: (path) => isExcluded(path),  // filter 只做业务特定排除
 *   transform: (path, mod) => app.component(deriveName(path), mod.default),
 * })) {}
 * ```
 *
 * @example 指令安装
 * ```ts
 * const modules = import.meta.glob<DirectiveModule>(
 *   ['./*.ts', '!./<dir>/*.spec.ts'],  // spec 在加载阶段就排除
 *   { eager: true }
 * )
 * export default (app: App) => {
 *   autoImport({
 *     modules,
 *     filter: (path) => path.endsWith('/index.ts') || path.includes('/_'),
 *     transform: (_, mod) => mod.default?.install(app),
 *   })
 * }
 * ```
 *
 * @see [`src/router/auto-register.ts`](../router/auto-register.ts) 路由聚合场景
 * @see [`src/directives/index.ts`](../directives/index.ts) 指令安装场景
 * @group 自动导入
 */

export interface AutoImportOptions<M, R = void> {
  /** Vite import.meta.glob 扫描结果（key 为模块路径，value 为模块对象） */
  modules: Record<string, M>
  /**
   * 跳过模块的过滤器（基于路径）。
   * 返回 true 跳过；返回 false 继续处理。
   * ⚠️ 注意：filter 在 transform 阶段执行，无法阻止文件加载。
   * 测试文件排除请在 glob pattern 层级完成（`!./DIR/*.spec.ts`）。
   */
  filter?: (path: string) => boolean
  /**
   * 对每个未被过滤的模块执行的处理。
   * 返回值会收集到结果数组中。
   */
  transform: (path: string, mod: M) => R
}

/**
 * 遍历已过滤的模块，对每个模块调用 transform，返回所有结果。
 *
 * 与 `import.meta.glob` 配合：
 * - glob 表达式必须是字面量字符串（Vite 编译期要求）
 * - 本函数仅做 filter + transform 编排，与构建解耦便于测试
 */
export function autoImport<M, R = void>(options: AutoImportOptions<M, R>): R[] {
  const results: R[] = []
  for (const [path, mod] of Object.entries(options.modules)) {
    if (options.filter?.(path)) continue
    results.push(options.transform(path, mod))
  }
  return results
}
