package com.fullstackmall.shop.seckill.service;

import com.fullstackmall.shop.seckill.dto.SeckillActiveDTO;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;

/**
 * 秒杀 C 端读模型：活动查询（惰性推进）与商品生效活动。
 */
public interface SeckillService {

    /**
     * 活动列表：live（进行中）+ upcoming（未开始 ≤5）。
     * 过期 ACTIVE 场在本方法内惰性推进 ENDED 并归还剩余库存（@Transactional 原子）。
     */
    SeckillActiveDTO active();

    /** 商品当前生效中的秒杀活动（ACTIVE 且时间窗内），无则 null——详情页插件出参用 */
    SeckillActivity findActiveByProductId(Long productId);
}
