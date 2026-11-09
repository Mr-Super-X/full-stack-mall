package com.fullstackmall.shop.order.enums;

/**
 * 订单玩法类型：type 是玩法维度不是货源维度——寄卖直购订单 type=NORMAL，
 * 货源由 OrderItem.sellerId 区分（设计文档 §4.4；秒杀/众筹/订阅为 v2 占位）。
 */
public enum OrderType {
    NORMAL,
    SECKILL,
    CROWDFUND,
    SUBSCRIPTION
}
