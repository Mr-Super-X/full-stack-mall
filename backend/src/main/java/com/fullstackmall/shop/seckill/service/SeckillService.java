package com.fullstackmall.shop.seckill.service;

import com.fullstackmall.shop.seckill.dto.SeckillActiveDTO;
import com.fullstackmall.shop.seckill.dto.SeckillOrderRequest;
import com.fullstackmall.shop.seckill.dto.SeckillOrderResultDTO;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;

/**
 * 秒杀 C 端读模型与下单：活动查询（惰性推进）、商品生效活动、秒杀直购。
 */
public interface SeckillService {

    /**
     * 活动列表：live（进行中）+ upcoming（未开始 ≤5）。
     * 过期 ACTIVE 场在本方法内惰性推进 ENDED 并归还剩余库存（@Transactional 原子）；
     * 到点的 PENDING 场惰性激活为 ACTIVE。
     */
    SeckillActiveDTO active();

    /** 商品当前生效中的秒杀活动（ACTIVE 且时间窗内），无则 null——详情页插件出参用 */
    SeckillActivity findActiveByProductId(Long productId);

    /**
     * 秒杀直购（spec §3.4 七步事务：查活动→惰性推进→挂载校验→限购→扣池→建单→返回）。
     *
     * @throws com.fullstackmall.shop.common.BusinessException
     *         SECKILL_NOT_FOUND / 40001 SECKILL_NOT_STARTED / 40002 SOLD_OUT /
     *         40003 LIMIT_EXCEEDED / 40004 DUPLICATE_ORDER
     */
    SeckillOrderResultDTO placeOrder(Long activityId, SeckillOrderRequest request);

    /**
     * 扣减独立池（4b 演进位：Redis 预扣替换本方法内部实现，签名不变）。
     *
     * @throws com.fullstackmall.shop.common.BusinessException SOLD_OUT（条件更新行数 0）
     */
    void deductStock(Long activityId);
}
