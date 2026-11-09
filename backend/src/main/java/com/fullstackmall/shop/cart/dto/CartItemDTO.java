package com.fullstackmall.shop.cart.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 购物车条目出参：购物车行信息 + 商品实时信息（名称/图/价/库存/货源）+ invalid 失效标记。
 * invalid 语义：商品已下架或库存 < 1——前端灰显且禁止勾选结算，不物理删除（用户可手动清）。
 */
@Data
public class CartItemDTO {

    private Long id;
    private Long productItemId;
    private Integer quantity;
    private Boolean checked;

    // ── 实时商品信息（下单前最后一次确认价；快照在订单侧，不在此） ──
    private String productName;
    private String imageUrl;
    private BigDecimal price;
    private Integer stock;
    private String conditionGrade;
    private String ownerType;

    /** true=已失效（下架或缺货），前端灰显禁选 */
    private Boolean invalid;
}
