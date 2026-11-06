package com.fullstackmall.shop.user.context;

/**
 * 已登录用户快照：由 JWT 解析而来，请求生命周期内有效。
 * 边界：仅承载身份（不含权限计算），权限判断按 role 由调用方负责。
 */
public record LoginUser(Long userId, String username, String role) {
}
