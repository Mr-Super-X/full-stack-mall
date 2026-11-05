/**
 * runElFormValidate —— 包装 el-form.validate 的 Promise 回调双轨
 *
 * element-plus 2.x 的 validate 即使传入 callback 仍会 reject errorsMap（微任务），
 * 直接 await 会产生 unhandled rejection。统一用 Promise 包装：callback 优先 resolve，
 * reject 兜底 resolve(false)。此前 use-form-validation 两处各自手写同一模式。
 *
 * @group XForm 工具
 */

/**
 * 跑 el-form validate 并归一化为 Promise<boolean>
 *
 * @param efValidate el-form 实例的 validate 方法（调用方需先自行守卫未绑定场景）
 * @returns true=校验通过；false=校验失败或 EP reject（errorsMap 兜底）
 */
export function runElFormValidate(
  efValidate: (callback?: (valid: boolean) => void) => Promise<boolean>
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const maybePromise = efValidate((v: boolean) => resolve(v))
    // 关键：el-form 2.x 即使传 callback 仍 reject errorsMap（避免 unhandled rejection）
    Promise.resolve(maybePromise).catch(() => resolve(false))
  })
}
