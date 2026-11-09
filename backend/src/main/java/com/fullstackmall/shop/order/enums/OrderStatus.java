package com.fullstackmall.shop.order.enums;

/**
 * 订单状态机：待支付 → 已支付 → 已发货 → 已完成；待支付 → 已取消（超时惰性关单/主动取消）。
 * 状态迁移一律条件更新（WHERE 前置状态），数据库兜底并发（同 plan-04 migrateStatus 范式）。
 */
public enum OrderStatus {
    PENDING_PAYMENT,
    PAID,
    SHIPPED,
    COMPLETED,
    CANCELLED
}
