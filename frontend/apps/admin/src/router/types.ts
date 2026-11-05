/**
 * 路由类型定义。
 *
 * 设计变更（2026-07-24 方案 A）：
 * - 移除 RouteName 联合类型（单一事实源是 `routes/index.ts`）
 * - `auto-register.ts` 通过 `import.meta.glob` 派生所有 name
 * - 拼写校验靠 zod runtime（`remote.ts`）+ `pushByNameStrict` dev 校验
 * - 不再有"加新模块要同步 types.ts"的负担
 *
 * 校验脚本：`scripts/check-routes.ts`（`pnpm check:routes`）
 * - 不再读 RouteName 联合
 * - 改为校验"whitelist ⊆ 实际 routes name + 系统路由必存在"
 *
 * @see [`./auto-register.ts`](./auto-register.ts) 派生所有 name
 * @see [`./remote.ts`](./remote.ts) zod runtime 校验
 * @group 路由类型
 */

import type { RouteMeta } from 'vue-router'

/**
 * 扩展 vue-router 内置 RouteMeta，使所有路由声明处 meta 自动获得类型补全。
 *
 * 设计要点：
 *  - 直接 `declare module 'vue-router'` 让 vue-router 的 RouteMeta 在 .ts 类型空间内被推断
 *  - 索引签名 `[key: string]: unknown` 允许业务自定义 meta 字段（如 `meta.tabs` / `meta.dialog`）
 *  - `hidden` 不出现在 RouteMeta 中——仅用于后端菜单 JSON 协议（RemoteMenuItem.meta.hidden），
 *    远程加载时由 src/router/remote.ts 转换为前端的 `meta.visible: false`
 *  - `permissions` 用字符串数组，AND 语义（全部满足才放行），由 useAuth().hasPerm(code) 校验
 *
 * 业务侧使用：
 *  ```ts
 *  const { titleKey, requiresAuth, permissions } = to.meta
 *  ```
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 菜单标题（兜底字符串，i18n 模式优先用 titleKey） */
    title?: string
    /** 菜单标题的 i18n key（推荐做法，i18n 不可用时 fallback 到 title） */
    titleKey?: string
    /** 菜单图标（Element Plus icon 名，如 'odometer' / 'user'） */
    icon?: string
    /** 是否需要登录态（true = 必须登录；false 或缺失 = 视为白名单同等，仅是宽松标记） */
    requiresAuth?: boolean
    /** 业务权限码数组（AND 语义：所有权限都满足才放行） */
    permissions?: string[]
    /** 路由可见性，false 时菜单隐藏且禁止直接访问（hidden 后端菜单转换目标） */
    visible?: boolean
    /**
     * 菜单可见性（**仅作用于侧边栏渲染过滤，不影响路由守卫**）。
     *
     * 与 `visible` 的语义差异：
     *   - `visible: false` → 菜单隐藏 **+ 守卫拦截直访**（双屏蔽，用于"真隐藏"页面，如隐藏订单详情）
     *   - `menuVisible: false` → **仅菜单隐藏**，路由仍可被 URL 直访（场景：客服邮件链接直达运营报表）
     *
     * 设计动机：reports 模块注释承诺"运营报表不希望出现在侧边栏，但客服可通过邮件链接直达"，
     * 但 `visible` 是双语义字段无法单独表达"只藏菜单不禁访问"，故新增本字段解耦。
     *
     * @see {@link file://./guards/visibility.ts} 守卫消费 `visible`（不消费 `menuVisible`）
     * @see {@link file://../layouts/default/config/menu.ts} isMenuHidden 消费 `menuVisible`
     */
    menuVisible?: boolean
    /** keepAlive 缓存开关（业务页面切换时是否保留组件实例） */
    keepAlive?: boolean
    /** 面包屑是否展示（侧边栏无关，紧凑型页面用 false） */
    breadcrumb?: boolean
    /** 多页签固定（设为 true 后 tags-view 该 tag 不显示关闭按钮且不可关闭，如 Home） */
    affix?: boolean
    /**
     * 多页签排除（true = 不加入 TagsView 页签）。
     *
     * 声明式替代历史上的 store 硬编码名单（NO_TAGS_ROUTE_NAMES，2026-10-15 迁移）：
     * 系统页（403/404/500；P4 起 Login 迁 apps/auth，不再注册于 admin）；
     * 门户落地页（Home）与免登录演示页（h5-demo、big-demo 系列）
     * 已随 P3 各应用抽离随迁，admin 内不再注册——本字段现仅系统页消费
     * 均由路由作者在本字段声明——新增排除页只改路由 meta，零成本。
     *
     * 与 `affix` 的关系：noTags 只管 afterEach 动态加入路径（toTag）；affix 预置走
     * filterAffixRoutes 直读路由表。两者正交，同配 true 会被 affix 初始化钉进页签，勿同配。
     */
    noTags?: boolean
    /** 业务自定义字段透传（adapter / 标签页 / 对话框路由等） */
    [key: string]: unknown
  }
}

/** 类型别名：便于代码阅读（AppRouteMeta / RouteMeta 等价） */
export type AppRouteMeta = RouteMeta

/**
 * 路由 name 类型（2026-07-24 方案 A 简化为 string）。
 *
 * 原本是联合类型（10 个 RouteName 字面量），移除原因：
 *   - 单一事实源是 src/modules/<feature>/routes/index.ts，无需在 types.ts 重复声明
 *   - 新增业务模块零成本接入（无需手动追加联合类型）
 *   - 拼写校验靠 zod runtime 校验 + pushByNameStrict dev 模式 throw
 *
 * 仍保留此类型别名：业务侧既有用法（useAppRouter 等）无需改动，
 * 未来若重新引入联合类型也只需改这一行。
 */
export type RouteName = string

/**
 * RemoteMenuItem 契约已随 P1-3 下沉到 @vv/shared（api/modules/menu.ts，
 * 与菜单请求出口同址）。此处 re-export 保持 remote.ts / mock 等既有消费方零改动。
 *
 * zod schema 已在 src/router/remote.ts:34 实现（RemoteMenuItemSchema），
 * 运行时校验由 remote.ts 守卫加载时执行。
 */
export type { RemoteMenuItem } from '@api/modules/menu'
