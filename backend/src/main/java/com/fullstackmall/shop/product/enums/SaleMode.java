package com.fullstackmall.shop.product.enums;

/**
 * 售卖玩法：NORMAL 普通 / SECKILL 秒杀 / CROWDFUND 众筹（v2 占位）/ SUBSCRIPTION 订阅盲盒（v2 占位）。
 * 枚举先行，v2 加玩法不改表结构。
 */
public enum SaleMode {
    NORMAL,
    SECKILL,
    CROWDFUND,
    SUBSCRIPTION
}
