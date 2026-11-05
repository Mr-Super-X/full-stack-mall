/**
 * 服务端错误适配器 —— 后端 422 响应（含 errors 字段）自动映射到表单字段红字
 *
 * 支持的响应格式（自动识别）：
 * 1. 数组格式：`{ errors: [{ path|field: 'fieldName', message: 'msg' }, ...] }`
 * 2. 对象格式：`{ errors: { fieldName: 'msg' | ['msg1', 'msg2'] } }`
 *
 * 设计要点：
 * - path/field 字段名兼容（后端两种命名都常见）
 * - 数组路径支持（`items[0].qty`）—— 与 lodash get 兼容
 * - 先清空已有错误再写入，避免旧错误残留（与 element-plus 内部行为一致）
 * - 不存在的字段静默跳过（field 可能在 schema 中已被 hidden/ignore）
 *
 * @group 表单编排：服务端错误
 */

/** 服务端响应中单个错误项的常见字段名 */
interface ServerErrorItem {
  path?: string
  field?: string
  message?: string
}

/**
 * ServerErrorResponse —— 后端 422 响应格式
 *
 * - success?: 整体成功标记（true 时清空所有服务端错误，防御性处理 success+errors 同时存在）
 * - errors?: 数组格式 [{ path|field, message }] 或对象格式 { field: msg | [msgs] }
 */
export interface ServerErrorResponse {
  /**
   * 后端整体成功标记 —— true 时清空所有服务端错误（红字）。
   * 后端 success=true 不应返回 errors；若同时存在，以 errors 为准（防御性处理）。
   */
  success?: boolean
  errors?: ServerErrorItem[] | Record<string, string | string[]>
}

/**
 * useServerError 入参 —— 错误写入 + 清错 + 已知字段过滤
 * knownFields 可选：限制只处理 schema 中存在的字段（默认不过滤，未知字段静默跳过）
 */
export interface UseServerErrorOptions {
  setFieldError: (name: string, message: string) => void
  clearValidate: (names?: string[]) => void
  /** 可选：限制只处理已知字段（默认不过滤，未知字段静默跳过） */
  knownFields?: () => readonly string[]
}

/**
 * useServerError 返回值 —— 422 响应映射到表单字段
 *
 * validateFromServer(response): 自动 clearValidate 后逐个 setFieldError，返回处理数量
 */
export interface UseServerErrorReturn {
  /** 把 422 响应映射到表单字段（自动 clearValidate 后逐个 setFieldError） */
  validateFromServer: (response: ServerErrorResponse) => number
}

/** useServerError —— 服务端 422 响应 → 表单字段错误映射 */
export function useServerError(opts: UseServerErrorOptions): UseServerErrorReturn {
  /**
   * 把 errors 数组/对象统一归一为 [path, message][] 列表
   * - 数组：[{ path|field, message }] 直接映射
   * - 对象：{ field: msg | [msg] } 拆为多对
   */
  function normalizeErrors(
    errors: ServerErrorResponse['errors']
  ): Array<{ path: string; message: string }> {
    if (!errors) return []
    if (Array.isArray(errors)) {
      const out: Array<{ path: string; message: string }> = []
      for (const e of errors) {
        if (!e) continue
        const path = e.path ?? e.field
        const message = e.message ?? ''
        if (typeof path === 'string' && path) out.push({ path, message })
      }
      return out
    }
    if (typeof errors === 'object') {
      const out: Array<{ path: string; message: string }> = []
      for (const [path, msg] of Object.entries(errors)) {
        if (Array.isArray(msg)) {
          for (const m of msg) out.push({ path, message: m })
        } else if (typeof msg === 'string') {
          out.push({ path, message: msg })
        }
      }
      return out
    }
    return []
  }

  function validateFromServer(response: ServerErrorResponse): number {
    // 提交成功：清空所有服务端错误（修复"success=true 后红字残留"问题）
    // —— 后端 success=true 不应返回 errors；若同时存在仍走 errors 路径（防御性）
    if (response.success && !response.errors) {
      opts.clearValidate(undefined)
      return 0
    }
    const items = normalizeErrors(response.errors)
    if (items.length === 0) {
      // 没有 errors 但 success 字段也未标记 —— 行为同原版：什么都不做
      return 0
    }
    // 已知字段过滤：未注册的字段静默跳过
    const known = opts.knownFields ? new Set(opts.knownFields()) : null
    const targets = known ? items.filter((it) => known.has(it.path)) : items
    if (targets.length === 0) return 0
    // 先清空已有错误（避免旧错误残留）
    opts.clearValidate(targets.map((it) => it.path))
    // 逐个写入新错误
    for (const { path, message } of targets) {
      opts.setFieldError(path, message)
    }
    return targets.length
  }

  return { validateFromServer }
}
