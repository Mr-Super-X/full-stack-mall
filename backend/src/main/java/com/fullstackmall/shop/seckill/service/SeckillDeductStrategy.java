package com.fullstackmall.shop.seckill.service;

/**
 * 秒杀扣库存实现策略（spec §3 配置开关）：同一 placeOrder 契约下的三种实现，
 * 对照实验（压测拐点曲线）的分派维度。
 */
public enum SeckillDeductStrategy {

    /** 4a 条件更新（乐观并发控制）：默认策略，正确性由原子 UPDATE 行数守卫 */
    OPTIMISTIC,

    /** FOR UPDATE 行锁（悲观锁对照组）：压测教学用途，故意保留锁等待/死锁风险 */
    PESSIMISTIC,

    /** Redis Lua 预扣 + RabbitMQ 异步出单（4b 主形态，Task 9 填充） */
    REDIS
}
