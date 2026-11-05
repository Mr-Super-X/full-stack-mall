/**
 * 路由全局配置（单一事实来源）。
 *
 * 配置项：
 * - `menuSource`：菜单加载方式（`'local'` = 本地静态；`'remote'` = 接口动态）
 *   - 默认 `'remote'`（贴近生产，强制走接口）
 *   - 切换 local：通过 `pnpm dev:local` 命令（自动设 `VITE_MENU_SOURCE=local`）
 *   - **`pnpm dev:local`（cross-env）优先级高于 .env**——完整优先级矩阵与机制详见 docs/07 §环境变量优先级矩阵
 *
 * - `historyMode`：history 模式（`'web'` = `createWebHistory`；`'hash'` = `createWebHashHistory`）
 *   - 默认 `'web'`（主流，URL 干净）
 *   - 子路径部署（`http://host/sub-path/`）→ 用 hash 避免后端 rewrite 复杂性
 *   - SSR 场景 → 必须用 web + 服务器端 basename 配置
 *
 * @see [`./index.ts`](./index.ts) 创建 router 时读取本配置
 * @group 路由配置
 */

// base 路径解析自 P5 起归 @vv/shared（与 5 个兄弟 app 的 router/index.ts 单源同实现）
import { resolveBasePath } from '@vv/shared'

export type MenuSource = 'local' | 'remote'
export type HistoryMode = 'web' | 'hash'

/** 解析菜单来源（`VITE_MENU_SOURCE` → `MenuSource`）。默认 `'remote'`。 */
function resolveMenuSource(): MenuSource {
  const raw = import.meta.env.VITE_MENU_SOURCE
  if (raw === 'remote' || raw === 'local') return raw
  // 默认：remote（贴近生产，强制走接口；本地无 mock 时启动会失败）
  return 'remote'
}

/** 解析 history 模式（`VITE_HISTORY_MODE` → `HistoryMode`）。默认 `'web'`。 */
function resolveHistoryMode(): HistoryMode {
  const raw = import.meta.env.VITE_HISTORY_MODE
  if (raw === 'hash' || raw === 'web') return raw
  // 默认：web history（主流，需要后端 SPA fallback，见 README nginx 配置）
  return 'web'
}

export const ROUTER_CONFIG = {
  source: resolveMenuSource(),
  historyMode: resolveHistoryMode(),
  base: resolveBasePath(),
} as const
