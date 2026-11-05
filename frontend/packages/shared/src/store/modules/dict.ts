/**
 * 字典状态管理（业务层缓存 + Promise 防抖池）。
 *
 * 三级缓存 / 合并体系（自上而下）：
 *   1. http.ts 拦截器：30s GET 内存缓存（网络层，防雪崩）
 *   2. 本 store：5min 业务层缓存（跨页面共享；字典变更低频，TTL 更宽松）
 *   3. pending 防抖池：`Map<code, Promise>`，进行中的请求被并发调用共享
 *
 * 为什么用 Promise 防抖池替代旧版的 16ms setInterval 轮询：
 * - 旧版「loading Set + 轮询等待」是让后来的调用反复询问「好了没」，
 *   有级联延迟（最坏 16ms × N）、setInterval 在边界场景的清理负担、实现绕
 * - 防抖池直接让后来的调用 await **同一个 Promise 实例**：
 *   零延迟、无定时器、finally 自动出池，并发语义由事件循环天然保证
 *
 * 业务侧不要直接调 dictApi.getDict，统一通过 useDict / 本 store。
 *
 * @see `@vv/shared` composables/useDict —— 业务侧消费封装
 * @see [`./user.ts`](./user.ts) 登录后触发 preloadDict
 * @group 状态管理：字典
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { dictApi } from '../../api/modules/dict.ts'
import type { DictItem } from '../../types/dict.ts'

/** 业务层缓存时间（毫秒）。比 http.ts 网络层 30s 更长，避免重复进入业务逻辑。 */
const STORE_TTL_MS = 5 * 60 * 1000

/** 登录后立即预加载的字典列表（新业务字典按需加入）。 */
export const PRELOAD_DICT_KEYS: readonly string[] = ['user_status', 'role']

export const useDictStore = defineStore('dict', () => {
  const dicts = ref<Record<string, DictItem[]>>({})
  const lastFetchAt = ref<Record<string, number>>({})
  /** 驱动 UI loading 态的响应式集合（哪些字典正在加载） */
  const loading = ref<Set<string>>(new Set())

  /**
   * Promise 防抖池（刻意非响应式）：code → 进行中的请求。
   * 同一 code 的并发调用在池内共享同一个 Promise —— 网络层只发一次请求；
   * 经 Pinia action 包装后外部拿到的实例可能是重新包装的 Promise，
   * 但 resolve 值与池中一致（已用最小实验验证，勿试图对外断言实例同一性）。
   * 用普通 Map 而非 ref —— 它只做并发控制，不需要驱动 UI 重渲染。
   */
  const pending = new Map<string, Promise<DictItem[]>>()

  /**
   * 拉取一个字典（缓存命中直接返回；未命中 / 过期发请求；并发共享进行中的请求）。
   *
   * 注意：刻意不用 `async function` —— async 函数的 `return inFlight` 会把池中
   * Promise 展开再包成新实例，并发方就拿不到同一个 Promise 了；
   * 普通函数 `return inFlight` 才是透传同一实例，这也是「防抖池」的精确语义。
   *
   * @param code 字典 code（如 `'user_status'`）
   * @param force 强制刷新（忽略 5min 缓存），refreshDict() 会传 true
   * @returns 字典项数组（请求失败时 reject，由调用方决定如何处理）
   */
  function fetchDict(code: string, force = false): Promise<DictItem[]> {
    if (!force) {
      // 缓存命中：TTL 内且已有数据，直接返回（离开页面不销毁的全局内存缓存）
      const last = lastFetchAt.value[code]
      if (last && Date.now() - last < STORE_TTL_MS && dicts.value[code]) {
        return Promise.resolve(dicts.value[code]!)
      }
      // 防抖池命中：相同 code 已有请求在进行，共享其 Promise（并发合并，不发第二次请求）
      const inFlight = pending.get(code)
      if (inFlight) return inFlight
    }

    const requestPromise = dictApi
      .getDict(code)
      .then((data) => {
        dicts.value[code] = data
        lastFetchAt.value[code] = Date.now()
        return data
      })
      .finally(() => {
        loading.value.delete(code)
        pending.delete(code)
      })

    loading.value.add(code)
    pending.set(code, requestPromise)
    return requestPromise
  }

  /**
   * 批量预加载（登录后 user store 调用）。
   * Promise.all 并发，防抖池保证 PRELOAD_DICT_KEYS 内的重复 code 也只发一次请求；
   * 某一项失败会 reject，由调用方（user.ts login）的 try/catch 兜底。
   */
  async function preloadDict(codes: readonly string[] = PRELOAD_DICT_KEYS): Promise<void> {
    await Promise.all(codes.map((code) => fetchDict(code)))
  }

  /**
   * 从已加载字典中查 value 对应的 label。
   * 未找到兜底为 String(value)，字典未加载也走兜底 —— 保证 UI 渲染永不报错。
   */
  function getLabel(code: string, value: string | number | null | undefined): string {
    if (value === null || value === undefined) return ''
    const list = dicts.value[code]
    if (!list) return String(value)
    const entry = list.find((e) => e.value === value)
    return entry?.label ?? String(value)
  }

  /** 清空全部缓存（用户登出 / 切换账号时调用）。 */
  function clear(): void {
    dicts.value = {}
    lastFetchAt.value = {}
    loading.value.clear()
  }

  return { dicts, loading, lastFetchAt, fetchDict, preloadDict, getLabel, clear }
})
