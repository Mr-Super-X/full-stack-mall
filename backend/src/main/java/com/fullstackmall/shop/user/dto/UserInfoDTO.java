package com.fullstackmall.shop.user.dto;

import lombok.Data;

/**
 * 出参：当前登录用户信息（register/login/me 共用）。绝不含 password。
 * role 为字符串（"USER"/"ADMIN"），前端按此判断管理端入口。
 */
@Data
public class UserInfoDTO {

    private Long id;

    private String username;

    private String nickname;

    private String avatar;

    private String role;
}
