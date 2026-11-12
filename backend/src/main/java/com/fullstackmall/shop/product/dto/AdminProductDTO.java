package com.fullstackmall.shop.product.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * admin 商品出参：主字段 + 规格明细（列表/编辑回填共用；量小不做摘要裁剪）。
 */
@Data
public class AdminProductDTO {

    private Long id;

    private Long categoryId;

    private String brand;

    private String name;

    private String tag;

    private String sellingPoint;

    private String detailHtml;

    /** 1 上架 0 下架 */
    private Integer status;

    private Integer sales;

    private List<AdminProductItemDTO> items;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
