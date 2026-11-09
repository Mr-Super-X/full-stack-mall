package com.fullstackmall.shop.order.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * 下单入参：统一端点两模式。
 * CART（购物车结算）必须带 cartItemIds；DIRECT（寄卖直购）必须带 productItemId。
 * 模式内必填由 Service 层交叉校验（DTO 表达不了条件必填）。
 */
@Data
public class CreateOrderRequest {

    @NotNull(message = "收货地址不能为空")
    private Long addressId;

    @NotNull(message = "下单来源不能为空")
    private Source source;

    /** CART 模式必填：结算的购物车条目 id 列表 */
    private List<Long> cartItemIds;

    /** DIRECT 模式必填：寄卖商品规格 id（数量恒 1） */
    private Long productItemId;

    public enum Source {
        CART,
        DIRECT
    }
}
