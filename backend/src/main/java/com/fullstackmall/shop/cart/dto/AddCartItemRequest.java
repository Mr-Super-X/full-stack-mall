package com.fullstackmall.shop.cart.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 加购入参。
 */
@Data
public class AddCartItemRequest {

    @NotNull(message = "商品规格不能为空")
    private Long productItemId;

    @NotNull(message = "数量不能为空")
    @Min(value = 1, message = "数量至少为 1")
    @Max(value = 99, message = "数量不能超过 99")
    private Integer quantity;
}
