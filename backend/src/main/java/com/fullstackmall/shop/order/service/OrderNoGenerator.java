package com.fullstackmall.shop.order.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 订单号/支付单号生成器：前缀 + yyyyMMddHHmmss + 4 位随机。
 * uk 冲突由 Service 层捕获换号重试（≤3 次）——单机场景冲突概率极低，逻辑刻意保持简单。
 */
public final class OrderNoGenerator {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private OrderNoGenerator() {
    }

    /** 订单号：M 前缀 */
    public static String orderNo() {
        return next("M");
    }

    /** 支付单号：P 前缀 */
    public static String paymentNo() {
        return next("P");
    }

    private static String next(String prefix) {
        return prefix + LocalDateTime.now().format(FMT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }
}
