package com.fullstackmall.shop.product.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 商品分页列表请求参数（GET query）。
 */
@Data
public class ProductListRequest {

    @NotNull(message = "page 不能为空")
    @Min(value = 1, message = "page 必须大于等于 1")
    private Integer page = 1;

    @NotNull(message = "pageSize 不能为空")
    @Min(value = 1, message = "pageSize 必须大于等于 1")
    @Max(value = 50, message = "pageSize 不能超过 50")
    private Integer pageSize = 10;

    /** 关键词：Service 层 trim 后为空则不参与筛选 */
    @Size(max = 50, message = "keyword 长度不能超过 50")
    private String keyword;

    /** 一级分类 id，不存在时返回空分页而非报错 */
    private Long categoryId;

    /** 排序白名单：newest（默认）/ price_asc / price_desc / sales_desc；非法值静默回退 newest */
    private String sort;

    /** 只看折扣商品（存在 origin_price > price 的规格）；首页"限时甄选"区块复用列表查询用。对外可传 */
    private Boolean discountOnly;

    /** 成色筛选（存在该成色的规格即命中）：NEW / LIKE_NEW / GOOD / FAIR；非法值静默忽略（同 sort 回退风格） */
    @Size(max = 16, message = "conditionGrade 长度不能超过 16")
    private String conditionGrade;

    /** 展示价（最低规格价）下限，与 priceMax 组成闭区间；仅当 min &lt;= max 时生效 */
    @DecimalMin(value = "0", message = "priceMin 不能为负")
    private BigDecimal priceMin;

    /** 展示价（最低规格价）上限；仅当 min &lt;= max 时生效 */
    @DecimalMin(value = "0", message = "priceMax 不能为负")
    private BigDecimal priceMax;
}
