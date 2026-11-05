/**
 * 认证 API（登录/获取个人信息/登出）。
 *
 * 认证模式（httpOnly 改造）：
 * - 登录成功后凭证由后端 `Set-Cookie: HttpOnly` 下发，前端 JS 不可读
 * - `login` / `logout` 响应体不含 token 字段，仅含必要的 profile 信息
 * - `fetchProfile` 返回当前用户的 profile + 权限列表（用于路由守卫鉴权）
 *
 * @see [`src/store/modules/user`](../../store/modules/user) profile / permissions 持久化
 * @see [`src/api/token-refresh.ts`](../token-refresh.ts) 401 自动续期
 * @group 业务 API：认证
 */

import { z } from 'zod'
import { request } from '../http'
import { requestValidated } from '../validator'

export interface LoginPayload {
  username: string
  password: string
}

/**
 * 登录端点路径单源（2026-10-28，security-reviewer 审查项）：
 * http.ts 的 401 refresh 链据此识别「登录端点」并豁免（密码错误的 401 无可 refresh 的
 * 凭证，refresh 必失败——见 http.ts isLoginRequestUrl）。后端契约变更只改此处一处。
 */
export const LOGIN_URL = '/auth/login'

/**
 * 登录响应 schema（httpOnly 模式）：
 * 凭证 token 由后端 Set-Cookie 下发，响应体仅含必要的 profile 信息。
 * `.passthrough()` 保留后端新增字段（前向兼容，不裁剪未知键）。
 *
 * @group 业务 API：认证
 */
export const loginResultSchema = z
  .object({
    profile: z.object({ id: z.number(), name: z.string() }).passthrough(),
  })
  .passthrough()

/**
 * 当前用户 profile + 权限列表 schema（路由守卫鉴权依赖此接口）。
 * `.passthrough()` 保留后端新增字段。
 *
 * @group 业务 API：认证
 */
export const userProfileSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    permissions: z.array(z.string()),
  })
  .passthrough()

/** 登录响应类型（z.infer 推导，与 loginResultSchema 同源） */
export type LoginResult = z.infer<typeof loginResultSchema>
/** 当前用户 profile 类型（z.infer 推导，与 userProfileSchema 同源） */
export type UserProfile = z.infer<typeof userProfileSchema>

export const authApi = {
  /**
   * 登录。
   *
   * 副作用：后端 `Set-Cookie: HttpOnly` 自动写入凭证；
   * `Session.set('auth', true)` 由 store 同步写入（路由守卫读取用）。
   *
   * @group 业务 API：认证
   */
  login: (data: LoginPayload) =>
    requestValidated(loginResultSchema, { url: LOGIN_URL, method: 'post', data }),

  /**
   * 获取当前用户的 profile + 权限列表。
   * 路由守卫鉴权（`router/guards/permission.ts`）依赖此接口。
   *
   * @param options.silent 静默探测标记：门户头部等「探测登录态」场景传 true——
   *   请求失败（如无后端时 502）不触发全局错误反馈（toast/网络横幅），
   *   由调用方 .catch 自行降级（保持登录按钮态）。守卫场景不传，错误照常上报。
   * @group 业务 API：认证
   */
  fetchProfile: (options?: { silent?: boolean }) =>
    requestValidated(userProfileSchema, {
      url: '/auth/profile',
      method: 'get',
      silent: options?.silent,
    }),

  /**
   * 登出。
   * 副作用：后端 `Set-Cookie: Max-Age=0` 清除 cookie；前端清 Session 'auth' 标记。
   *
   * @group 业务 API：认证
   */
  logout: () => request<void>({ url: '/auth/logout', method: 'post' }),
}
