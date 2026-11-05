/**
 * 通用防抖工具（v3.2 review 新增）
 *
 * 项目角色：SearchForm 字段级防抖自动搜索的实现基础。
 * 不抽到 @/utils/ 因为：
 * - 防抖在 ProTable 内部使用最密集（其他场景暂时用不到）
 * - 保持「composables/_utils/ 与 SearchForm 强相关」的内聚性
 * - 后续真有跨模块使用再升格到 @/utils/
 *
 * 设计原则：
 * - 纯函数：返回 { invoke, cancel } 控制对，不持有隐式状态
 * - KISS：实现 < 30 行，无依赖（不引 lodash / @vueuse/core）
 * - 类型安全：泛型保留参数签名
 *
 * @see [`../../components/SearchForm.vue`](../../components/SearchForm.vue) 唯一消费方
 * @group ProTable 工具
 */

/**
 * 防抖函数 —— 在 delay ms 内多次 invoke 只触发最后一次
 *
 * @param fn 待防抖的函数
 * @param delay 延迟（毫秒），<= 0 立即执行
 * @returns { invoke, cancel } 控制器
 *   - invoke(...args): 调度 fn 在 delay 后执行
 *   - cancel(): 取消挂起的执行
 */
export function debounceFn<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): { invoke: (...args: Args) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    invoke(...args: Args): void {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        fn(...args)
        timer = null
      }, delay)
    },
    cancel(): void {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}
