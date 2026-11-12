package com.fullstackmall.shop.product.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * admin 商品规格出参：展示成交价/划线价/库存，供商品管理页与秒杀候选参照。
 */
@Data
public class AdminProductItemDTO {

    private Long id;

    private String size;

    private String color;

    private String conditionGrade;

    private BigDecimal price;

    private BigDecimal originPrice;

    private Integer stock;
}
