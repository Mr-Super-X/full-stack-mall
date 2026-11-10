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
    STOCK_NOT_ENOUGH(400, "库存不足"),
    ORDER_STATE_ILLEGAL(400, "当前订单状态不允许该操作"),
    PAYMENT_STATE_ILLEGAL(400, "当前支付状态不允许回调"),
    CONSIGNMENT_DIRECT_ONLY(400, "寄卖商品请直接购买"),
    PAYOUT_STATE_ILLEGAL(400, "当前结算状态不允许该操作"),
    UNAUTHORIZED(401, "未登录或登录已过期"),
    FORBIDDEN(403, "无权限访问"),
    PRODUCT_NOT_FOUND(404, "商品不存在"),
    CONSIGNMENT_NOT_FOUND(404, "寄卖单不存在"),
    ADDRESS_NOT_FOUND(404, "地址不存在"),
    ORDER_NOT_FOUND(404, "订单不存在"),
    PAYMENT_NOT_FOUND(404, "支付单不存在"),
    CART_ITEM_NOT_FOUND(404, "购物车条目不存在"),
    PAYOUT_NOT_FOUND(404, "结算单不存在"),
    SECKILL_NOT_FOUND(404, "秒杀活动不存在"),
    SECKILL_NOT_STARTED(40001, "秒杀尚未开始或已结束"),
    SOLD_OUT(40002, "已抢完"),
    LIMIT_EXCEEDED(40003, "已达限购上限"),
    DUPLICATE_ORDER(40004, "您已参与过本场秒杀"),
    INTERNAL_ERROR(500, "系统繁忙，请稍后重试");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
