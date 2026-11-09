package com.fullstackmall.shop.common;

import lombok.Getter;

/**
 * 业务结果码：与前端约定 code=200 成功，其余 code 由前端按错误处理；
 * 消息直接面向用户展示，新增码时请使用用户可读的文案。
 */
@Getter
public enum ResultCode {

    SUCCESS(200, "ok"),
    BAD_REQUEST(400, "请求参数不合法"),
    USERNAME_EXISTS(400, "用户名已被注册"),
    BAD_CREDENTIALS(400, "用户名或密码错误"),
    CONSIGNMENT_STATE_ILLEGAL(400, "当前状态不允许该操作"),
    UNAUTHORIZED(401, "未登录或登录已过期"),
    FORBIDDEN(403, "无权限访问"),
    PRODUCT_NOT_FOUND(404, "商品不存在"),
    CONSIGNMENT_NOT_FOUND(404, "寄卖单不存在"),
    ADDRESS_NOT_FOUND(404, "地址不存在"),
    INTERNAL_ERROR(500, "系统繁忙，请稍后重试");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
