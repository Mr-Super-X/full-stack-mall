package com.fullstackmall.shop.common;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Redis 令牌桶限流（spec §6）：双层桶（全局 + 按用户），容量/速率经
 * {@code seckill.rate-limit.capacity/refill-per-second} 配置——参数来自压测校准（拐点并发 70%）。
 * Redis 不可用时限流放行（warn）——限流非正确性关卡，正确性由 Redis 预扣/DB 守卫保证。
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {

    /** 业务键：Redis key = seckill:rate-limit:{key}（全局）/ seckill:rate-limit:{key}:user:{userId}（用户层） */
    String key();
}
