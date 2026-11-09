package com.fullstackmall.shop.consignment.enums;

/**
 * 寄卖单状态机：SUBMITTED → PRICED → LISTED → SOLD → SETTLED，↘ REJECTED。
 * MVP 简化（设计文档 §5 注释）：REVIEWING 中间态保留枚举但不强制经过——
 * 无"开始审核"动作，SUBMITTED 即入审核池，admin review 允许 SUBMITTED/REVIEWING 直接流转。
 */
public enum ConsignmentStatus {
    SUBMITTED,
    REVIEWING,
    PRICED,
    LISTED,
    SOLD,
    SETTLED,
    REJECTED
}
