package com.fullstackmall.shop.product.dto;

import lombok.Data;

/**
 * admin 编辑商品入参（PATCH 语义：null 字段不更新——MP updateById 忽略 null）。
 * 只开放基础字段与上下架；规格/库存编辑本期不做（涉及库存一致性，无运营场景）。
 * status：1 上架 / 0 下架，下架受秒杀活动挂载保护（Service 层复核）。
 */
@Data
public class AdminProductUpdateRequest {

    private Long categoryId;

    private String brand;

    private String name;

    private String tag;

    private String sellingPoint;

    private String detailHtml;

    private Integer status;
}
