package com.fullstackmall.shop.seckill.enums;

/**
 * 秒杀场次状态：PENDING（未开始，未划拨）→ ACTIVE（进行中）→ ENDED（已结束，剩余已归还）；
 * PENDING 可被 admin 取消 → CANCELLED（全额归还）。
 * 状态推进全部惰性（查询/写入路径触发，无调度器，同惰性关单哲学）。
 */
public enum SeckillStatus {
    PENDING,
    ACTIVE,
    ENDED,
    CANCELLED
}
