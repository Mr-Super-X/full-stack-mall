/**
 * 角色枚举 —— 系统中所有可用的角色标识。
 *
 * 角色字符串值（`'super_admin'` 等）是**持久化到后端的原始标识**，不与显示文案耦合。
 * 显示文案统一通过 {@link ROLE_LABELS} 映射，修改显示文案不会影响后端存储。
 *
 * @see {@link ROLE_LABELS} 角色显示文案映射
 * @see [`src/composables/useAuth.ts`](../composables/useAuth.ts) 权限判断消费方
 * @see [`src/directives/permission.ts`](../directives/permission.ts) v-permission 指令消费方
 * @group 角色权限
 */

/** 系统角色枚举。值是后端持久化的原始标识，UI 文案见 {@link ROLE_LABELS} */
export enum RoleEnum {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

/**
 * 角色 → 显示文案映射。
 *
 * 之所以独立成常量而非塞进 enum 注释：① enum 值是后端契约不能改；② UI 文案会随 i18n 调整，
 * 分开维护避免改文案时误改契约。值用中文硬编码是临时方案，长期应迁到 `locales/` 走 i18n。
 */
export const ROLE_LABELS: Record<RoleEnum, string> = {
  [RoleEnum.SUPER_ADMIN]: '超级管理员',
  [RoleEnum.ADMIN]: '管理员',
  [RoleEnum.USER]: '普通用户',
  [RoleEnum.GUEST]: '访客',
}
