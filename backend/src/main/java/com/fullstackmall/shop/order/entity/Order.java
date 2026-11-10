package com.fullstackmall.shop.order.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.enums.OrderType;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单实体（表名 orders 避 MySQL 保留字 order）。
 * 地址快照存 JSON 字符串——下单后用户改地址簿不影响历史订单（快照铁律）。
 */
@Data
@TableName("orders")
public class Order {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 订单号：M + yyyyMMddHHmmss + 4 位随机（uk，冲突重试 3 次） */
    private String orderNo;

    private Long userId;

    private OrderType type;

    private OrderStatus status;

    /** 应付总额（快照，= Σ 明细 price × quantity） */
    private BigDecimal payAmount;

    /** 地址快照 JSON 字符串（收货人/电话/省市区/详细地址） */
    private String addressSnapshot;

    /** 超时关单时间（createTime + 15 分钟；惰性关单触发点） */
    private LocalDateTime expiredAt;

    /** 秒杀场次 id（type=SECKILL 时非空；uk_user_activity 一人一场兜底限购） */
    private Long seckillActivityId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
