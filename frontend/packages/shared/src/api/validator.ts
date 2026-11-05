import type { z } from 'zod'
import type { AxiosRequestConfig } from 'axios'
import { ApiError } from './types/error'
import { request } from './http'

/**
 * Zod 响应验证工具。
 *
 * 设计要点：
 * - 后端 schema 变更时启动期/首次请求即失败（不再等用户操作时崩）
 * - 验证失败抛 ApiError（code=500, message="数据格式异常"），不 toast（避免吓到用户）
 * - console.error 记录详细错误便于排障
 * - 业务侧按需配 schema；不配置 schema 的接口行为零变化
 *
 * @example 单 endpoint 配 schema
 * ```ts
 * import { z } from 'zod'
 * import { requestValidated } from '@api/validator'
 *
 * const EquipmentSchema = z.object({
 *   id: z.number(),
 *   deviceName: z.string(),
 * })
 *
 * const item = await requestValidated(EquipmentSchema, {
 *   url: '/equipment/1',
 *   method: 'get',
 * })
 * ```
 *
 * @see [`src/api/http.ts`](./http.ts) `request<T>` 底层实现
 * @group 网络基建：响应验证
 */

/**
 * 用 Zod schema 验证数据。
 * 失败抛 ApiError（code=500, message=详细错误 + "数据格式异常"）
 */
export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    console.error('[validator] schema 验证失败:', issues, result.error.issues)
    throw new ApiError({
      code: 500,
      message: `数据格式异常：${issues || 'unknown'}`,
    })
  }
  return result.data as z.infer<T>
}

/**
 * 包装 request<T>：先发请求，响应后用 schema 验证 body.data。
 *
 * 业务侧拿到的是 schema.infer<T>（运行时 + 编译期双保险）。
 */
export async function requestValidated<T extends z.ZodTypeAny>(
  schema: T,
  config: AxiosRequestConfig
): Promise<z.infer<T>> {
  const raw = await request<unknown>(config)
  return validate(schema, raw)
}
