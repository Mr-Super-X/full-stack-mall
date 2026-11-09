package com.fullstackmall.shop.payout.enums;

/**
 * 结算状态机（用户拍板三步完整态）：PENDING 待初审 → CONFIRMED 已初审 → PAID 已打款。
 */
public enum PayoutStatus {
    PENDING,
    CONFIRMED,
    PAID
}
