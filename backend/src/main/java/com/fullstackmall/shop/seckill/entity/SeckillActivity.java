package com.fullstackmall.shop.seckill.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 秒杀场次实体（表结构见 init.sql §玩法域，阶段 0 已建成）。
 * 独立库存池：创建（PENDING）时从挂载的 product_item 划拨，活动期间只扣本表
 * sold_count（条件更新防超卖），结束/取消归还剩余——与常规库存生命周期解耦
 * （设计基准 §11.3）。
 */
@Data
@TableName("seckill_activity")
public class SeckillActivity {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 挂载商品（仅允许单 SKU 自营商品，Service 层校验） */
    private Long productId;

    /** 秒杀价（下单快照定格到 order_item.price，活动结束不回联） */
    private BigDecimal seckillPrice;

    /** 独立库存池（划拨量） */
    private Integer seckillStock;

    /** 已售计数（条件更新 sold_count < seckill_stock 防超卖） */
    private Integer soldCount;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    /** 每人限购件数（本期固化恒 1，创建时后端校验） */
    private Integer limitPerUser;

    private SeckillStatus status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
