/**
 * 认证 API（登录/注册/获取个人信息/登出）——统一登录接线商城后端（计划 07 v2）。
 *
 * 契约归属：本文件是 monorepo 唯一认证契约（单一事实源），四个端点指向转卖商城后端
 * `/mall/auth/*`；apps/auth 登录页 / apps/admin 守卫 / apps/h5 登录全部经 `userStore`
 * 消费本契约，不再各自维护平行认证客户端。
 *
 * 数据映射（role → permissions 唯一映射点）：
 * - 后端返回商城 `UserInfoDTO = {id, username, nickname, avatar, role}`
 * - 前端消费 shared `UserProfile = {id, name, permissions[]}`
 * - `userProfileSchema.transform`：name = nickname ?? username；permissions = ROLE_PERMISSIONS[role] ?? []
 * - 未知 role → 空权限数组（不静默放行，Review Focus #1：seller 登录成功但访问后台被 /403 拦）
 *
 * httpOnly 模式：
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

/** 角色→权限码唯一映射（计划 07 v2）：ADMIN 得商城后台权限，USER 得买家权限 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['mall:admin'],
  USER: ['mall:user'],
}

/** 登录端点路径单源：http.ts 的 401 refresh 链据此识别「登录端点」并豁免 */
export const LOGIN_URL = '/mall/auth/login'
/** 注册端点（商城后端 RegisterRequest 兼容 LoginPayload：username/password 必填，nickname 可选） */
export const MALL_REGISTER_URL = '/mall/auth/register'
/** 当前用户信息端点（商城 UserInfoDTO 形状） */
export const PROFILE_URL = '/mall/auth/me'
/** 登出端点（后端 Set-Cookie Max-Age=0 清除 HttpOnly cookie） */
export const LOGOUT_URL = '/mall/auth/logout'

/** 商城当前用户信息（与后端 UserInfoDTO 字段一一对齐；passthrough 保留后端新增字段） */
const mallUserSchema = z
  .object({
    id: z.number(),
    username: z.string(),
    nickname: z.string().nullable(),
    avatar: z.string().nullable(),
    role: z.string(),
  })
  .passthrough()

/**
 * 登录响应 schema：商城 UserInfoDTO 形状（passthrough 前向兼容）。
 */
export const loginResultSchema = mallUserSchema

/**
 * 当前用户 profile + 权限列表 schema（路由守卫鉴权依赖此接口）。
 * transform：商城 UserInfoDTO → shared UserProfile（name/permissions 归一）。
 * 输出收敛为 {id,name,permissions}（显式 pick）——避免 transform 前字段（username/nickname/
 * avatar/role）泄漏进 UserProfile 类型，导致消费方（login.spec/user.spec）夹具缺字段报错。
 */
export const userProfileSchema = mallUserSchema.transform((dto) => ({
  id: dto.id,
  name: dto.nickname ?? dto.username,
  permissions: ROLE_PERMISSIONS[dto.role] ?? [],
}))

/** 登录响应类型（z.infer 推导，与 loginResultSchema 同源） */
export type LoginResult = z.infer<typeof loginResultSchema>
/** 当前用户 profile 类型（z.infer 推导，含 transform 输出形状） */
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
   * 注册（商城后端）。成功返回用户信息（不自动登录，调用方决定是否紧接着 login）。
   *
   * @group 业务 API：认证
   */
  register: (data: LoginPayload & { nickname?: string }) =>
    requestValidated(loginResultSchema, { url: MALL_REGISTER_URL, method: 'post', data }),

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
      url: PROFILE_URL,
      method: 'get',
      silent: options?.silent,
    }),

  /**
   * 登出。
   * 副作用：后端 `Set-Cookie: Max-Age=0` 清除 cookie；前端清 Session 'auth' 标记。
   *
   * @group 业务 API：认证
   */
  logout: () => request<void>({ url: LOGOUT_URL, method: 'post' }),
}
