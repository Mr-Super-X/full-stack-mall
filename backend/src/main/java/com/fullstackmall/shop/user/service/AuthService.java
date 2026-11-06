package com.fullstackmall.shop.user.service;

import com.fullstackmall.shop.user.dto.LoginRequest;
import com.fullstackmall.shop.user.dto.RegisterRequest;
import com.fullstackmall.shop.user.dto.UserInfoDTO;

/**
 * 认证业务：注册/登录/当前用户。token 签发不落本层（Controller 组合 JwtService 写 Cookie）。
 */
public interface AuthService {

    /**
     * 注册新用户（角色恒为 USER；管理员账号由种子产生，不开放注册）。
     *
     * @throws com.fullstackmall.shop.common.BusinessException USERNAME_EXISTS 用户名已被注册（数据库 CI，大小写不敏感）
     */
    UserInfoDTO register(RegisterRequest req);

    /**
     * 校验用户名密码。用户不存在与密码错误统一抛 BAD_CREDENTIALS 同文案，防账号枚举。
     */
    UserInfoDTO login(LoginRequest req);

    /**
     * 按 id 查当前用户信息；查不到视为会话失效，抛 UNAUTHORIZED。
     */
    UserInfoDTO infoOf(Long userId);
}
