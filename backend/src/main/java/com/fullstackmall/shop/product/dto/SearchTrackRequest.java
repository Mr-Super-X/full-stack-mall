package com.fullstackmall.shop.product.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 搜索埋点请求（POST /mall/search/track，匿名可访问）。
 * 两种场景共用：搜索完成（resultCount 非空）/ 点击搜索结果（clickProductId 非空）。
 */
@Data
public class SearchTrackRequest {

    /** 用户原始输入词；服务端 sanitize 后落库 */
    @NotBlank(message = "keyword 不能为空")
    @Size(max = 50, message = "keyword 长度不能超过 50")
    private String keyword;

    /** 结果数（搜索完成时上报）；点击场景不传 */
    @Min(value = 0, message = "resultCount 不能为负")
    private Integer resultCount;

    /** 点击的商品 id（点击搜索结果时上报）；纯搜索场景不传 */
    private Long clickProductId;
}
