/**
 * 接口加载菜单（remote 模式）。
 *
 * 工作流：
 * 1. `fetchRemoteRoutes()` 调用 `/mock/menu` 拉取菜单 JSON（带超时 + 重试）
 * 2. `convertMenu()` 把 JSON 转换为 Vue Router 路由配置
 * 3. 在守卫中 `router.addRoute()` 注入
 *
 * 失败策略：
 * - `fetchRemoteRoutes()` 内部捕获异常，返回空数组 + console.warn
 * - 由守卫负责 fallback：返回空数组时 console.warn + 保持 local 菜单
 *
 * 后端菜单 JSON 约定（详见 `src/router/types.ts`）：
 * ```ts
 * { name: RouteName; path: string; meta?: RouteMeta; children?: RemoteMenuItem[] }
 * ```
 *
 * @see [`./types.ts`](./types.ts) `RemoteMenuItem` 类型与 `RouteMeta` 扩展
 * @see [`./guards/remote-menu.ts`](./guards/remote-menu.ts) 守卫懒加载入口
 * @group 路由：远程菜单
 */

import type { RouteRecordRaw } from 'vue-router'
import { z } from 'zod'
import { menuApi } from '@api/modules/menu'
import { withRetry } from '@api/retry'
import { COMPONENT_REGISTRY } from './auto-register'
import type { RouteName, RemoteMenuItem } from './types'

/**
 * 远程菜单 Zod schema（2026-07-24 审计补齐 + 修复递归嵌套 bug + 修复 strict TS 冲突）。
 *
 * 用途：fetchRemoteRoutes 拿到的后端 JSON 用此 schema 校验整体结构，
 * 失败 console.warn + 逐项校验兜底（容错优先）。
 *
 * 设计要点：
 *   - 基础形状（remoteMenuItemBase）= 普通 z.object，无 children 字段
 *   - 递归形状 = base.extend({ children: z.array(自身).optional() }) 通过 z.lazy
 *   - 顶层 array 容器（remoteMenuArraySchema）= z.array(item)
 *   - 类型标注用 z.ZodType<unknown>（zod 推断）—— 避免与 RemoteMenuItem interface 在
 *     exactOptionalPropertyTypes 严格 TS 下的 meta?: undefined 冲突
 *   - parse 后用 `as RemoteMenuItem[]` 类型断言兜底（zod 已运行时校验，安全）
 *   - 用 z.string() 替代 RouteName 联合类型校验（zod 对 string union 处理麻烦，
 *     name 不在 COMPONENT_REGISTRY 时 convertItem 也会跳过 + warn，等价兜底）
 *   - meta.passthrough() 允许业务自定义字段
 */
const remoteMenuItemBase = z.object({
  name: z.string(),
  path: z.string().min(1),
  meta: z
    .object({
      hidden: z.boolean().optional(),
      title: z.string().optional(),
      titleKey: z.string().optional(),
      icon: z.string().optional(),
      requiresAuth: z.boolean().optional(),
      permissions: z.array(z.string()).optional(),
      visible: z.boolean().optional(),
      keepAlive: z.boolean().optional(),
      breadcrumb: z.boolean().optional(),
      affix: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
})

/** 单个菜单项的 zod schema（递归 children）。 */
const RemoteMenuItemSchema: z.ZodType<unknown> = z.lazy(() =>
  remoteMenuItemBase.extend({
    children: z.array(RemoteMenuItemSchema).optional(),
  })
)

/** 顶层菜单数组 schema（用于校验 fetchRemoteRoutes 拿到的整体 JSON）。 */
const remoteMenuArraySchema = z.array(RemoteMenuItemSchema)

/**
 * 远程菜单加载的默认参数（可被 fetchRemoteRoutes 调用方覆盖）。
 */
const DEFAULT_REMOTE_RETRIES = 2
const DEFAULT_REMOTE_TIMEOUT_MS = 5000

/**
 * 加载远程菜单的运行时选项。
 */
export interface FetchRemoteRoutesOptions {
  /** 额外重试次数（不含首次），默认 2（共 3 次） */
  retries?: number
  /** 单次请求超时（毫秒），默认 5000 */
  timeoutMs?: number
  /** 首次重试前的延迟（毫秒），默认 300 */
  baseDelay?: number
}

/**
 * 拉取后端菜单 JSON，转换为 Vue Router 路由配置。
 *
 * 行为：
 *  - 用 withRetry 包装请求，失败自动指数退避（默认 2 次重试）
 *  - 通过 menuApi.getMenu({ timeout: timeoutMs }) 控制单次超时
 *  - 网络/超时错误最终 fallback：返回空数组 + console.warn，由调用方决定
 *
 * @param opts 加载选项（重试次数 / 超时 / 退避延迟）
 * @returns 路由数组（空数组表示回退到 local 菜单）
 */
export async function fetchRemoteRoutes(
  opts: FetchRemoteRoutesOptions = {}
): Promise<RouteRecordRaw[]> {
  const retries = opts.retries ?? DEFAULT_REMOTE_RETRIES
  const timeoutMs = opts.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS
  const baseDelay = opts.baseDelay ?? 300

  try {
    const menu = await withRetry(() => menuApi.getMenu({ timeout: timeoutMs }), {
      retries,
      baseDelay,
    })
    return validateAndConvertMenu(menu)
  } catch (err) {
    console.warn('[router/remote] 接口加载菜单失败（已重试）:', err)
    return []
  }
}

/**
 * 用 Zod schema 校验后端返回的菜单数组，校验通过后转 Vue Router 路由。
 *
 * 行为：
 *   - 整体校验失败（如返回非数组）→ console.warn + 返回空数组
 *   - 单个 item 校验失败 → 该 item 被跳过（不影响其他）
 *
 * 失败时不影响菜单加载（与旧行为兼容），仅 console.warn 便于排查。
 */
function validateAndConvertMenu(raw: unknown): RouteRecordRaw[] {
  const result = remoteMenuArraySchema.safeParse(raw)
  if (!result.success) {
    console.warn(
      '[router/remote] 菜单 JSON 格式异常，使用部分可用项:',
      result.error.issues.slice(0, 5)
    )
    // 尽力而为：尝试逐项校验（容错）
    if (Array.isArray(raw)) {
      const valid: RemoteMenuItem[] = []
      for (const item of raw) {
        const single = RemoteMenuItemSchema.safeParse(item)
        if (single.success) valid.push(item as RemoteMenuItem)
      }
      return convertMenu(valid)
    }
    return []
  }
  // zod 已运行时校验，类型断言兜底（避免与 RemoteMenuItem interface 的 meta?: 不含 undefined 冲突）
  return convertMenu(result.data as RemoteMenuItem[])
}

/**
 * 把后端菜单 JSON 转换为 Vue Router 路由配置。
 * 未知 name（不在 COMPONENT_REGISTRY 中）的项会被跳过并 warn。
 */
function convertMenu(menu: RemoteMenuItem[]): RouteRecordRaw[] {
  const result: RouteRecordRaw[] = []
  for (const item of menu) {
    const route = convertItem(item)
    if (route) result.push(route)
  }
  return result
}

function convertItem(item: RemoteMenuItem): RouteRecordRaw | null {
  const loader = COMPONENT_REGISTRY[item.name as RouteName]
  if (!loader) {
    console.warn(`[router/remote] 未注册的路由 name: ${item.name}（routes/index.ts 中未声明）`)
    return null
  }

  // 后端 hidden: true → 转换为前端约定的 meta.visible: false
  // 守卫（guards/auth.ts）检查到 visible: false 时跳 /404，
  // 实现"菜单不可见 → 路由不可访问"的双轨收紧。
  let meta: RouteRecordRaw['meta'] | undefined
  if (item.meta) {
    if (item.meta.hidden) {
      // 删除 hidden 字段，加 visible: false 标记
      const { hidden: _hidden, ...rest } = item.meta
      meta = { ...rest, visible: false }
    } else {
      meta = item.meta
    }
  }

  // 注意：tsconfig 启用了 exactOptionalPropertyTypes，
  // `meta?: RouteMeta` 与 `meta: RouteMeta | undefined` 不兼容。
  // 用条件展开：仅在 meta 实际存在时才设置 meta 属性（不显式赋 undefined）。
  return {
    path: item.path,
    name: item.name,
    component: loader as RouteRecordRaw['component'],
    ...(meta ? { meta } : {}),
    ...(item.children ? { children: convertMenu(item.children) } : {}),
  } as RouteRecordRaw
}
