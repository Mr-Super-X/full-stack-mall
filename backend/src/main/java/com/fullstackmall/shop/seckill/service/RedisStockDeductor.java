package com.fullstackmall.shop.seckill.service;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Redis Lua 预扣（spec §4 关口）：`seckill:stock:{id}` 原子扣减 +
 * `seckill:order:{id}:{userId}` 占位（TTL 900s 对齐订单超时）。DB 仍是真相源：
 * key 缺失时以 (seckill_stock - sold_count) 自愈重建；回补失败仅 warn 不阻断主流程。
 *
 * Redis 宕机抛 40005 SECKILL_UNAVAILABLE——不降级到 DB（spec §4.4 取舍声明：
 * 降级会让双写真相分裂，宁可拒绝不可超卖）。
 */
@Slf4j
@Component
public class RedisStockDeductor {

    private static final String STOCK_KEY = "seckill:stock:";
    private static final String ORDER_KEY = "seckill:order:";
    /** 占位 TTL = 订单 15min 超时（关单后资格不释放的兜底清理，spec §4.2） */
    private static final long PLACEHOLDER_TTL_SECONDS = 900;

    /**
     * 三分支原子脚本（spec §4.2）：返回 1 成功 / 0 抢完 / -1 key 缺失 / -2 已占位。
     * 判库存与占位在同一 RTT，超卖在 Redis 层物理不可能。
     * 注意：SET NX 失败 Redis 返 Lua false（不是 0），必须显式 == false——
     * Lua 里 false == 0 为 false，用 == 0 判断会让限购占位失效（实测踩坑，勿改回）。
     */
    private static final DefaultRedisScript<Long> DEDUCT_SCRIPT = new DefaultRedisScript<>("""
            local stock = tonumber(redis.call('GET', KEYS[1]) or -1)
            if stock < 0 then
              return -1
            end
            if stock == 0 then
              return 0
            end
            if redis.call('SET', KEYS[2], ARGV[1], 'NX', 'EX', 900) == false then
              return -2
            end
            redis.call('DECR', KEYS[1])
            return 1
            """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final SeckillActivityMapper seckillActivityMapper;

    public RedisStockDeductor(StringRedisTemplate redisTemplate,
                              SeckillActivityMapper seckillActivityMapper) {
        this.redisTemplate = redisTemplate;
        this.seckillActivityMapper = seckillActivityMapper;
    }

    /**
     * 预扣入口（strategy=redis 的 placeOrder 第 5 步）：
     * OK 静默返回；SOLD_OUT / LIMIT_EXCEEDED / SECKILL_* 抛 BusinessException（与 4a 错误码穿透一致）。
     */
    public void deduct(Long activityId, Long userId, String orderNo) {
        Long result = executeDeduct(activityId, userId, orderNo);
        if (result != null && result == -1) {
            // key 缺失自愈：DB 是真相源，SET NX 重建一次再重试（spec §4.2 裁决）
            SeckillActivity activity = seckillActivityMapper.selectById(activityId);
            if (activity == null) {
                throw new BusinessException(ResultCode.SECKILL_NOT_FOUND);
            }
            int remain = activity.getSeckillStock()
                    - (activity.getSoldCount() == null ? 0 : activity.getSoldCount());
            initStock(activityId, remain);
            result = executeDeduct(activityId, userId, orderNo);
        }
        long code = result == null ? -1 : result;
        switch ((int) code) {
            case 1 -> { /* OK */ }
            case 0 -> throw new BusinessException(ResultCode.SOLD_OUT);
            case -2 -> throw new BusinessException(ResultCode.LIMIT_EXCEEDED);
            default -> throw new BusinessException(ResultCode.SECKILL_NOT_STARTED, "秒杀库存未初始化");
        }
    }

    /** 活动激活时初始化关口（SET NX——已有值不覆盖，防并发激活互相踩） */
    public void initStock(Long activityId, int remain) {
        try {
            redisTemplate.opsForValue().setIfAbsent(STOCK_KEY + activityId, String.valueOf(remain));
        } catch (RedisConnectionFailureException e) {
            log.warn("[seckill] initStock 失败（Redis 不可用）activityId={} remain={}", activityId, remain, e);
        }
    }

    /** 关单/死信回补：stock+1（key 不存在静默跳过——关口可后续重建） */
    public void restoreStock(Long activityId) {
        try {
            redisTemplate.opsForValue().increment(STOCK_KEY + activityId);
        } catch (RedisConnectionFailureException e) {
            log.warn("[seckill] restoreStock 失败（Redis 不可用）activityId={}", activityId, e);
        }
    }

    /** 活动推进 ENDED/CANCELLED 时摘除关口（读路径此后走 DB 惰性推进语义） */
    public void dropStock(Long activityId) {
        try {
            redisTemplate.delete(STOCK_KEY + activityId);
        } catch (RedisConnectionFailureException e) {
            log.warn("[seckill] dropStock 失败（Redis 不可用）activityId={}", activityId, e);
        }
    }

    private Long executeDeduct(Long activityId, Long userId, String orderNo) {
        try {
            return redisTemplate.execute(DEDUCT_SCRIPT,
                    List.of(STOCK_KEY + activityId, ORDER_KEY + activityId + ":" + userId),
                    orderNo);
        } catch (RedisConnectionFailureException e) {
            // 4.4 取舍：Redis 宕机拒绝服务，不降级 DB（防双写真相分裂）
            throw new BusinessException(ResultCode.SECKILL_UNAVAILABLE);
        }
    }
}
