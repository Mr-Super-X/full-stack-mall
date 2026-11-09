package com.fullstackmall.shop.cart.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

/**
 * 购物车修改入参：quantity 与 checked 至少其一非空（Service 层校验，DTO 只做范围约束）。
 */
@Data
public class UpdateCartItemRequest {

    @Min(value = 1, message = "数量至少为 1")
    @Max(value = 99, message = "数量不能超过 99")
    private Integer quantity;

    private Boolean checked;
}
