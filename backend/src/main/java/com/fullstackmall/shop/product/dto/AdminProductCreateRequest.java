package com.fullstackmall.shop.product.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * admin 创建自营商品入参。货源/玩法固化字段（PLATFORM/NORMAL/sales=0/status=1）
 * 不在入参暴露——本接口只造平台自营新品（基准 §2 两种货源的边界）。
 */
@Data
public class AdminProductCreateRequest {

    @NotNull(message = "类目不能为空")
    private Long categoryId;

    private String brand;

    @NotBlank(message = "商品名不能为空")
    private String name;

    /** 角标（如 -27%、本季主打，可空） */
    private String tag;

    /** 卡内小标签（材质/卖点，可空） */
    private String sellingPoint;

    private String detailHtml;

    @Valid
    @NotEmpty(message = "至少需要一个规格")
    private List<AdminProductItemInput> items;

    @Valid
    private List<AdminProductImageInput> images;
}
