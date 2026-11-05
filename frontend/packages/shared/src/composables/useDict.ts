/**
 * 字典 Composable —— 业务侧唯一入口（契约形态）。
 *
 * 用法（与旧版单 key 形态的差异）：
 * ```ts
 * // 一次声明多个字典，按 code 解构出 Ref<DictItem[]>
 * const { gender, user_status, refreshDict } = useDict('gender', 'user_status')
 * ```
 *
 * 设计决策：
 * - 为什么是多 code 可变参数 + 按 code 解构（RuoYi 系风格）：
 *   业务页常见「一个表单消费 3~5 个字典」。旧版 `useDict('x')` 单 key 返回
 *   需多次调用，且每个实例一套 options/loading/getLabel 命名，解构噪音大；
 *   契约形态下每个字典一个具名 Ref，template 里直接 `v-for="i in gender"`，
 *   新增字典 = 参数 + 解构各加一处，类型由泛型 T 精确推导到字面量 code
 * - 为什么返回的 Ref 用 computed 实现：字典数据所有权在 store（单一数据源），
 *   composable 只建「视图」—— refresh 写入 store 后，所有 useDict 实例的
 *   Ref 自动同步，不存在多实例数据漂移
 * - 为什么 refresh 命名 refreshDict(code)：多字典共用一个刷新入口，
 *   语义明确「刷新的是某个字典」而非组件局部状态
 *
 * @param codes 一个或多个字典 code（如 `'gender'` / `'user_status'`）
 * @returns 按 code 命名的 `Ref<DictItem[]>` 组合 + `refreshDict` 强制刷新方法
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { gender, user_status } = useDict('gender', 'user_status')
 * </script>
 *
 * <template>
 *   <el-option v-for="i in gender" :key="i.value" :value="i.value" :label="i.label" />
 * </template>
 * ```
 *
 * @see [`src/store/modules/dict`](../store/modules/dict.ts) 缓存 / 防抖池 / fetchDict
 * @see [`src/types/dict.ts`](../types/dict.ts) DictItem 契约结构
 * @group 字典组合式 API
 */

import { computed } from 'vue'
import type { Ref } from 'vue'
import { useDictStore } from '../store/modules/dict.ts'
import type { DictItem } from '../types/dict.ts'

/**
 * useDict 返回值：按 code 命名的 Ref 组合 + refreshDict。
 * 泛型 T 保留调用处的 code 字面量，解构出的每个 Ref 类型精确为 `Ref<DictItem[]>`。
 *
 * 注意：`refreshDict` 为保留字，字典 code 请勿命名为 `'refreshDict'`。
 *
 * @group 字典组合式 API
 */
export type UseDictReturn<T extends string> = Record<T, Ref<DictItem[]>> & {
  /** 强制刷新指定字典（忽略 5min 缓存重新拉取；失败降级返回 []，不抛出） */
  refreshDict: (code: string) => Promise<DictItem[]>
}

/**
 * 获取一个或多个字典的响应式引用 + 强制刷新方法。
 *
 * setup 阶段对每个 code 触发一次 lazy fetch（首次访问才发请求），
 * 多组件并发请求同一字典由 store 防抖池自动合并；
 * 请求失败仅 console.error（不静默吞错），Ref 保持 [] 保证 UI 可渲染。
 *
 * @param codes 一个或多个字典 code
 * @returns 按 code 解构的 Ref 组合 + refreshDict
 *
 * @group 字典组合式 API
 */
export function useDict<T extends string>(...codes: T[]): UseDictReturn<T> {
  const store = useDictStore()
  const result = {} as Record<T, Ref<DictItem[]>>

  for (const code of codes) {
    // computed 视图：读 store.dicts，随 refresh / preload 写入自动同步
    result[code] = computed(() => store.dicts[code] ?? [])
    // lazy fetch：fire-and-forget，失败已 catch（unhandled rejection 会污染控制台）
    store.fetchDict(code).catch((err: unknown) => {
      console.error(`[useDict] 字典 "${code}" 加载失败：`, err)
    })
  }

  /** 强制刷新（忽略缓存）。失败同样降级为空数组，由调用方决定是否感知。 */
  function refreshDict(code: string): Promise<DictItem[]> {
    return store.fetchDict(code, true).catch((err: unknown) => {
      console.error(`[useDict] 字典 "${code}" 刷新失败：`, err)
      return []
    })
  }

  return { ...result, refreshDict } as UseDictReturn<T>
}
