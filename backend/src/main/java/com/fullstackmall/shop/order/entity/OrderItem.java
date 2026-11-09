package com.fullstackmall.shop.order.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单明细实体：快照是铁律——itemSnapshot 定格下单瞬间的标题/图/成色/规格，
 * price 为成交价；展示永不回联商品实时数据（卖家改价改标题不影响历史订单）。
 * sellerId 冗余（寄卖件记录卖家，阶段 3 结算不用回联商品）。
 */
@Data
@TableName("order_item")
public class OrderItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long orderId;

    private Long productItemId;

    /** 快照 JSON 字符串：{title, imageUrl, conditionGrade, size, color, brand, ownerType} */
    private String itemSnapshot;

    /** 成交价快照 */
    private BigDecimal price;

    private Integer quantity;

    /** 寄卖件卖家 user.id；自营为 null */
    private Long sellerId;

    private LocalDateTime createTime;
}
