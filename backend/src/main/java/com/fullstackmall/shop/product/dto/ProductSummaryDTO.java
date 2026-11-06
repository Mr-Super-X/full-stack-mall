package com.fullstackmall.shop.product.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 商品卡片出参：列表/首页区块通用，字段与前端 MallGoodsItem 平移对齐
 * （minitag→sellingPoint，另保留 garm 过渡期字段）。
 * 新模型语义：price=该商品最低规格价（"¥xx 起"），originPrice=最大划线价，
 * conditionGrade 为最低价规格成色（寄卖商品的卡片成色角标来源）。
 */
@Data
public class ProductSummaryDTO {

    private Long id;
    private String name;
    private BigDecimal price;
    private BigDecimal originPrice;
    private String imageUrl;
    private String tag;
    private String sellingPoint;
    private String garm;
    private Integer sales;
    private String ownerType;
    private String saleMode;
    private String conditionGrade;
}
