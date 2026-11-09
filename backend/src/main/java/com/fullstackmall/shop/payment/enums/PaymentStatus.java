package com.fullstackmall.shop.payment.enums;

/**
 * 支付单状态机：CREATED → PAYING → SUCCESS / FAILED。
 * 一单可多次尝试支付；状态迁移只许单向（CREATED/PAYING → SUCCESS），回调幂等靠此约束。
 */
public enum PaymentStatus {
    CREATED,
    PAYING,
    SUCCESS,
    FAILED
}
