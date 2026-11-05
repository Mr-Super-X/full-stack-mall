/**
 * storage 工具（Local + Session）
 *
 * 命名空间：所有 key 自动加 `<APP_NAMESPACE>:` 前缀，避免多项目共用
 * localStorage 时冲突（多团队 / 多应用部署在同一域名下尤其重要）。
 *
 * 设计要点：
 * - Local：localStorage 浏览器永久缓存（关闭浏览器后仍保留）
 * - Session：sessionStorage 浏览器临时缓存（关闭标签页即失效）
 *
 * 认证模式（2026-08-12 httpOnly 改造）：
 * - 凭证 token 由后端通过 `Set-Cookie: HttpOnly` 下发，前端 JS 不可读、不存储，
 *   请求时由浏览器自动携带（配合 http.ts 的 withCredentials）
 * - 前端仅在 sessionStorage 维护无敏感信息的登录标记（key: 'auth'），
 *   供路由守卫同步判断登录态；真正的凭证校验由后端完成
 * - 登出时凭证 cookie 由后端 `Set-Cookie: Max-Age=0` 清除（HttpOnly cookie
 *   无法被 JS 删除），前端只清登录标记
 *
 * 安全要点：
 * - `clear()` / `Session.clear()` 只清除本项目 namespace 的 key（不破坏其他项目 / 其他路径的数据）
 * - `get()` 在 JSON.parse 失败时自动清除脏数据 + 返回 null（避免 SyntaxError 冒泡到 ErrorBoundary）
 *
 * @see [`src/api/http.ts`](../api/http.ts) `withCredentials` 配置（cookie 自动携带）
 * @see [`src/router/guards/auth.ts`](../router/guards/auth.ts) 登录态守卫（读取 Session 'auth'）
 * @group 浏览器存储
 */

/**
 * 应用命名空间（隔离多项目共用同一 storage 域）
 * 数据源：独立的 VITE_STORAGE_NAMESPACE（与展示用的 VITE_APP_TITLE 解耦），
 * fallback 硬编码 'vue3-vite-project' 兜底。
 * 配置示例（.env.development）：VITE_STORAGE_NAMESPACE=vue3-vite-project
 */
const APP_NAMESPACE = import.meta.env.VITE_STORAGE_NAMESPACE || 'vue3-vite-project'

/** 给业务 key 加 namespace 前缀 */
function setKey(key: string): string {
  return `${APP_NAMESPACE}:${key}`
}

/**
 * 导出加前缀后的完整 key——供绕过 Local/Session 封装、直接操作 localStorage 的
 * 场景使用（如 Pinia persistedstate 的 persist.key、主题初始读取），
 * 保证与 Local/Session 写入的 key 命名规则一致。
 */
export function namespacedStorageKey(key: string): string {
  return setKey(key)
}

/** 通用的"只清本项目 namespace"遍历删除函数（Local/Session 复用） */
function clearByNamespace(storage: Storage): void {
  const prefix = `${APP_NAMESPACE}:`
  // 倒序遍历删除：避免 length 变化导致索引错位
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i)
    if (key !== null && key.startsWith(prefix)) {
      storage.removeItem(key)
    }
  }
}

/**
 * JSON.parse 安全包装：失败时 console.warn + 清理脏数据 + 返回 null
 */
function safeParse<T>(raw: string, key: string, kind: 'Local' | 'Session'): T | null {
  try {
    return JSON.parse(raw) as T
  } catch (err) {
    console.warn(`[storage] ${kind}.get('${key}') JSON.parse 失败，清除脏数据:`, err)
    // 清理脏数据避免下次再 parse 失败
    if (kind === 'Local') {
      window.localStorage.removeItem(setKey(key))
    } else {
      window.sessionStorage.removeItem(setKey(key))
    }
    return null
  }
}

/**
 * window.localStorage 浏览器永久缓存
 */
export const Local = {
  set<T>(key: string, val: T): void {
    window.localStorage.setItem(setKey(key), JSON.stringify(val))
  },
  get<T = unknown>(key: string): T | null {
    const json = window.localStorage.getItem(setKey(key))
    if (json === null) return null
    return safeParse<T>(json, key, 'Local')
  },
  remove(key: string): void {
    window.localStorage.removeItem(setKey(key))
  },
  /** 只清本项目 namespace 的 key（不破坏其他应用的数据） */
  clear(): void {
    clearByNamespace(window.localStorage)
  },
}

/**
 * window.sessionStorage 浏览器临时缓存
 *
 * 登录标记约定：key 'auth'（boolean），仅表示"已完成登录动作"，
 * 不含任何凭证信息；凭证是 httpOnly cookie，由后端全权管理。
 */
export const Session = {
  set<T>(key: string, val: T): void {
    window.sessionStorage.setItem(setKey(key), JSON.stringify(val))
  },
  get<T = unknown>(key: string): T | null {
    const json = window.sessionStorage.getItem(setKey(key))
    if (json === null) return null
    return safeParse<T>(json, key, 'Session')
  },
  remove(key: string): void {
    window.sessionStorage.removeItem(setKey(key))
  },
  /** 只清本项目 namespace 的 key（不破坏其他应用的数据） */
  clear(): void {
    clearByNamespace(window.sessionStorage)
  },
}
