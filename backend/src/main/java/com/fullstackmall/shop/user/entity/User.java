package com.fullstackmall.shop.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fullstackmall.shop.user.enums.UserRole;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户表实体：仅映射 user 表，不出 Controller（出参用 UserInfoDTO，绝不外泄 password）。
 */
@Data
@TableName("user")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 登录名，数据库 UNIQUE + CI 校对（大小写不敏感） */
    private String username;

    /** BCrypt 哈希，禁止明文入库 */
    private String password;

    private String nickname;

    private String avatar;

    private UserRole role;

    /** 1 正常 0 禁用 */
    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
