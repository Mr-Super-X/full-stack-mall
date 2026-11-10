package com.fullstackmall.shop.common;

import com.fullstackmall.shop.user.context.UserContext;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 令牌桶限流切面（spec §6）：@RateLimit 注解方法环绕——全局桶 + 用户桶双层都过才放行；
 * 超限抛 40006 RATE_LIMITED（HTTP 429 映射见 GlobalExceptionHandler）。
 * 桶状态存 Redis hash（tokens/ts），Lua 原子"计算-扣减-回写"；Redis 挂了放行 + warn（非正确性关卡）。
 */
@Slf4j
@Aspect
@Component
public class RateLimitAspect {

    /**
     * 令牌桶原子脚本：基于上次时间戳线性补充令牌（cap 截断），≥1 扣减放行。
     * TIME[1] 秒级——refill-per-second 精度即秒级（压测语义足够）。
     */
    private static final DefaultRedisScript<Long> TOKEN_BUCKET_SCRIPT = new DefaultRedisScript<>("""
            local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
            local cap = tonumber(ARGV[1])
            local refill = tonumber(ARGV[2])
            local tokens = tonumber(data[1]) or cap
            local ts = tonumber(data[2]) or 0
            local now = tonumber(redis.call('TIME')[1])
            tokens = math.min(cap, tokens + math.max(0, now - ts) * refill)
            local allowed = 0
            if tokens >= 1 then
              tokens = tokens - 1
              allowed = 1
            end
            redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
            redis.call('PEXPIRE', KEYS[1], 120000)
            return allowed
            """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final int capacity;
    private final int refillPerSecond;

    public RateLimitAspect(StringRedisTemplate redisTemplate,
                           @Value("${seckill.rate-limit.capacity}") int capacity,
                           @Value("${seckill.rate-limit.refill-per-second}") int refillPerSecond) {
        this.redisTemplate = redisTemplate;
        this.capacity = capacity;
        this.refillPerSecond = refillPerSecond;
    }

    @Around("@annotation(rateLimit)")
    public Object around(ProceedingJoinPoint pjp, RateLimit rateLimit) throws Throwable {
        // 全局桶（所有用户共享）
        if (!tryConsume("seckill:rate-limit:" + rateLimit.key())) {
            throw new BusinessException(ResultCode.RATE_LIMITED);
        }
        // 用户桶（单用户高频防护；未登录场景 UserContext 可能为空——全局桶已兜底）
        var user = UserContext.get();
        if (user != null && !tryConsume("seckill:rate-limit:" + rateLimit.key() + ":user:" + user.userId())) {
            throw new BusinessException(ResultCode.RATE_LIMITED);
        }
        return pjp.proceed();
    }

    /** 返回 true=放行；Redis 不可用放行 + warn（限流非正确性关卡，正确性由预扣/DB 守卫兜底） */
    private boolean tryConsume(String redisKey) {
        try {
            Long allowed = redisTemplate.execute(TOKEN_BUCKET_SCRIPT,
                    List.of(redisKey), String.valueOf(capacity), String.valueOf(refillPerSecond));
            return allowed != null && allowed == 1;
        } catch (RedisConnectionFailureException e) {
            log.warn("[rate-limit] Redis 不可用，限流放行（非正确性关卡）key={}", redisKey);
            return true;
        }
    }
}
