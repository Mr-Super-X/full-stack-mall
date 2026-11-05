/**
 * 路由创建配置工具（@vv/shared）。
 *
 * 文件角色：6 个 app 的 router/index.ts 中逐字重复的零差异段的单源实现。
 * P5 架构审查裁决「抽工具不抽流程」：app.use 装配序列与各 app 私有路由
 * 编排（守卫串接 / rootRedirect / 白名单）保持各 app 手写，仅纯函数零差异段
 * （base 路径解析 / scroll 行为）下沉本包，消除 5-6 份拷贝的漂移风险。
 *
 * @group 路由：创建配置
 */
import type { RouterScrollBehavior } from 'vue-router'

/**
 * 解析路由部署 base 路径（`VITE_BASE`）。
 *
 * 业务约束：vue-router basename 要求以 `/` 开头、`/` 结尾；env 缺省或形态
 * 非法时归一补全，子路径部署在 .env.production 设 `VITE_BASE=/sub-path/`。
 *
 * 下沉原因：5 个 app 的 router/index.ts + admin 的 router/config.ts 共 6 份逐字拷贝。
 */
export function resolveBasePath(): string {
  const raw = import.meta.env.VITE_BASE ?? '/'
  if (!raw.startsWith('/')) return `/${raw}`
  if (!raw.endsWith('/')) return `${raw}/`
  return raw
}

/**
 * 给跨应用跳转路径加部署前缀（同源 path 形态的仓库根）。
 *
 * 业务背景：跨 app 跳链（portal→管理后台、工作台能力演示导航到 h5/big 等）历史上
 * 硬编码根路径（`/admin/`、`/h5/h5-demo`）——同域网关（VITE_BASE=`<app>/`）下正常，
 * 但 gh-pages 形态（VITE_BASE=`<repo>/<app>/`，如 `/vue3-vite-project/admin/`）下全部
 * 404（易用性审查 P0-2：跨 app 路径未随部署形态缩放）。
 *
 * 本函数从 VITE_BASE 推「仓库根」前缀：
 * - 网关 `VITE_BASE=/admin/`     → 前缀 `/`          → `/admin/` 不变
 * - gh-pages `VITE_BASE=/repo/admin/` → 前缀 `/repo/` → `/repo/admin/`（正确）
 *
 * 实现：取 VITE_BASE 去末段（当前 app 名）即仓库根；单段 base（如 `/admin/`）根为 `/`。
 * 消费方：PortalHeader 管理后台跳链、workbench 能力演示 panelLinks、auth 登录 fallback。
 */
export function withRepoPrefix(path: string): string {
  const base = resolveBasePath() // 形如 /<app>/ 或 /<repo>/<app>/
  const segments = base.split('/').filter(Boolean) // ['admin'] 或 ['repo','admin']
  segments.pop() // 去末段（当前 app 名）→ 仓库根段
  const repoRoot = segments.length > 0 ? `/${segments.join('/')}/` : '/'
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${repoRoot}${cleanPath.slice(1)}`
}

/**
 * 从同源路径剥掉部署仓库根前缀（`withRepoPrefix` 的逆操作）。
 *
 * 业务背景：auth 登录页经 referrer 推断来源 app 时，referrer pathname 带部署
 * 前缀——gh-pages 形态（VITE_BASE=/<repo>/<app>/）下首段是 repo 名而非 app 名，
 * 直接取首段会把 repo 名误当来源 app，再经 withRepoPrefix 二次加前缀拼出
 * /<repo>/<repo>/ 404（2026-11-04 线上事故根因）。先剥前缀再取 app 段才是稳态。
 *
 * 语义（与 withRepoPrefix 同源的 repo 根推导）：
 * - 网关 `VITE_BASE=/auth/`          → 根为 `/`        → 任意 pathname 原样返回
 * - gh-pages `VITE_BASE=/repo/auth/` → 根为 `/repo/`   → `/repo/portal/` → `/portal/`
 * - pathname 恰落在仓库根（`/<repo>` 或 `/<repo>/`）→ 返回 `/`（无 app 段）
 * - 不以 repo 根开头的 pathname（异构来源）原样返回，交由调用方判空兜底
 */
export function stripRepoPrefix(pathname: string): string {
  const base = resolveBasePath() // 形如 /<app>/ 或 /<repo>/<app>/
  const segments = base.split('/').filter(Boolean)
  segments.pop() // 去末段（当前 app 名）→ 仓库根段
  if (segments.length === 0) return pathname // 根部署：无前缀可剥
  const repoRootNoSlash = `/${segments.join('/')}` // /repo
  if (pathname === repoRootNoSlash) return '/'
  if (pathname.startsWith(`${repoRootNoSlash}/`)) return pathname.slice(repoRootNoSlash.length)
  return pathname
}

/**
 * 创建各 app 统一的路由滚动行为。
 *
 * 业务语义：
 * - 浏览器前进/后退（popstate）：恢复浏览器记录的 savedPosition
 * - 目标路由带 hash 锚点：平滑滚动到对应元素
 * - 其他导航：回页面顶部
 *
 * 下沉原因：6 个 app 的 router/index.ts 逐字重复同一函数体，集中单源防止漂移。
 */
export function createDefaultScrollBehavior(): RouterScrollBehavior {
  return (to, _from, savedPosition) => {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0, left: 0 }
  }
}
