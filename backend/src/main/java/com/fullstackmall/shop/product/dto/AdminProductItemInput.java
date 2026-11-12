package com.fullstackmall.shop.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * admin 创建自营商品的规格输入。同一商品内 size 不可重复（Service 层校验，
 * null size 也参与判重——多条无尺码规格没有业务意义）。
 */
@Data
public class AdminProductItemInput {

    private String size;

    private String color;

    @NotNull(message = "规格价格不能为空")
    @DecimalMin(value = "0.01", message = "规格价格必须大于 0")
    private BigDecimal price;

    /** 划线价（可空，列表"限时甄选"按 origin > price 判定） */
    private BigDecimal originPrice;

    @NotNull(message = "规格库存不能为空")
    @Min(value = 0, message = "库存不能为负")
    private Integer stock;
}
