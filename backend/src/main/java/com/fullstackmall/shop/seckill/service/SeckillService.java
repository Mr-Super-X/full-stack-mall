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

    /** 详情页插件出参：装配好的生效活动（含商品摘要），无则 null */
    com.fullstackmall.shop.seckill.dto.SeckillActiveDTO.SeckillActivityDTO findActiveItemByProductId(Long productId);

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

    /**
     * 异步出单消费事务（spec §5.3）：幂等查重 → 重查快照源 → 建单三步（Assembler 与同步路径共用）
     * → 受理表推进 CREATED。事务边界=本方法（经代理），消费者只管 ack/nack。
     *
     * @throws org.springframework.dao.DuplicateKeyException 撞 uk_user_activity
     *         （并发重复消费语义）——由调用方转 ack 不回流
     */
    void fulfillSeckillOrder(com.fullstackmall.shop.seckill.mq.SeckillOrderMessage message);

    /**
     * 出单状态轮询（spec §5.4）：订单表优先（CREATED + paymentNo，含归属校验——他人单号一律 404
     * 不泄露存在性）→ 受理表回退（ACCEPTED/FAILED）→ 全无 404 ORDER_NOT_FOUND。
     */
    com.fullstackmall.shop.seckill.dto.SeckillOrderStatusDTO queryOrderStatus(String orderNo);
}
