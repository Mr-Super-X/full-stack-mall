package com.fullstackmall.shop.user.enums;

/**
 * 用户角色：USER 为买家/卖家同号双角色（不卖货即买家），ADMIN 可访问 /mall/admin/**。
 * 入库存 name() 字符串（MyBatis-Plus 默认枚举处理器）。
 */
public enum UserRole {
    USER,
    ADMIN
}
