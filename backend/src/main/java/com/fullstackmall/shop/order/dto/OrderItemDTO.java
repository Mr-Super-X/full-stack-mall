package com.fullstackmall.shop.order.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 订单明细出参：snapshot 已解析为字段（定格下单瞬间，不回联实时商品）。
 */
@Data
public class OrderItemDTO {

    private Long productItemId;
    private BigDecimal price;
    private Integer quantity;
    private Long sellerId;

    // ── 快照字段（下单瞬间定格） ──
    private String title;
    private String imageUrl;
    private String conditionGrade;
    private String size;
    private String color;
    private String brand;
    private String ownerType;
}
