package com.fullstackmall.shop.seckill.mq;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 异步出单消息（spec §5.2）：orderNo 为幂等键（Controller 预生成）；
 * 其余字段供消费者重查快照源（DB 是真相，消息不带冗余快照）。
 */
public record SeckillOrderMessage(
        String orderNo,
        Long activityId,
        Long userId,
        Long productItemId,
        Long addressId,
        BigDecimal seckillPrice,
        LocalDateTime deductedAt) {
}
