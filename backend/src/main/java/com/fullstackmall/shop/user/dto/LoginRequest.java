package com.fullstackmall.shop.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 登录入参。失败文案统一为"用户名或密码错误"，不区分用户不存在与密码错误，防账号枚举。
 */
@Data
public class LoginRequest {

    @NotBlank(message = "用户名不能为空")
    private String username;

    @NotBlank(message = "密码不能为空")
    private String password;
}
