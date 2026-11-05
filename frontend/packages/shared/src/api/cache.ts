/**
 * 简单内存缓存（GET 请求专用）。
 *
 * 设计要点：
 * - 单例 Map + TTL 过期
 * - key 由 method + url + params 自动生成
 * - POST/PUT/PATCH/DELETE 不缓存（写操作必须每次执行）
 * - 跨用户/会话共享缓存（适合项目内通用列表）
 *
 * 不替代专业缓存方案（如 SWR、vue-query），仅做"防重复请求"级别的兜底。
 *
 * @group 网络基建：缓存
 */

/** 缓存条目 */
interface CacheEntry<T = unknown> {
  data: T
  expires: number
}

/** 单例缓存 Map */
const store = new Map<string, CacheEntry>()

/**
 * 生成缓存 key：method + url + sortedParams
 */
export function buildCacheKey(method: string, url: string, params?: unknown): string {
  const paramsStr = params ? JSON.stringify(sortKeys(params)) : ''
  return `${method.toLowerCase()}|${url}|${paramsStr}`
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.keys(value as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((value as Record<string, unknown>)[k])
        return acc
      }, {})
  }
  return value
}

/**
 * 读取缓存（过期则返回 null 并自动清理）。
 * 过期时间内部按毫秒存储；外部 API 按秒。
 */
export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

/**
 * 写入缓存（ttl **秒**后过期）。
 * 设计：选择秒为单位（而非毫秒），与 Redis EXPIRE / HTTP cache-control
 * max-age 一致，业务侧写 `ttl: 30` 直观表达"30 秒后过期"。
 * 内部统一转毫秒存储。
 */
export function cacheSet<T>(key: string, data: T, ttl: number): void {
  store.set(key, { data, expires: Date.now() + ttl * 1000 })
}

/**
 * 清除缓存。
 * - 不传 keyPrefix：清空全部
 * - 传 keyPrefix：清除所有以此前缀开头的 key（用于写操作失效相关 GET 缓存）
 */
export function cacheClear(keyPrefix?: string): void {
  if (!keyPrefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key)
  }
}

/** 仅供测试使用：清空所有缓存 */
export function _resetCache(): void {
  store.clear()
}
