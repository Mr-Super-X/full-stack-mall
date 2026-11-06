package com.fullstackmall.shop.product.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 规格/单件出参：详情页规格选择与寄卖单件通用。
 */
@Data
public class ProductItemDTO {

    private Long id;
    private String size;
    private String color;
    private String conditionGrade;
    private BigDecimal price;
    private BigDecimal originPrice;
    private Integer stock;
}
