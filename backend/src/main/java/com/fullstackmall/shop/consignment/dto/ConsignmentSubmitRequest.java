package com.fullstackmall.shop.consignment.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 寄卖提交入参。成色仅接受 LIKE_NEW/GOOD/FAIR（全新物品走自营渠道，不在寄卖范围）。
 */
@Data
public class ConsignmentSubmitRequest {

    @NotBlank(message = "品牌不能为空")
    private String brand;

    @NotBlank(message = "标题不能为空")
    private String title;

    @NotNull(message = "分类不能为空")
    private Long categoryId;

    @NotBlank(message = "成色不能为空")
    @Pattern(regexp = "LIKE_NEW|GOOD|FAIR", message = "成色仅支持 LIKE_NEW/GOOD/FAIR")
    private String conditionGrade;

    private String size;

    @NotEmpty(message = "至少需要 1 张实拍图")
    @Size(max = 9, message = "最多 9 张图片")
    private List<@NotBlank(message = "图片 URL 不能为空") String> images;

    private String description;

    @NotNull(message = "期望价不能为空")
    @DecimalMin(value = "0.01", message = "期望价必须大于 0")
    private BigDecimal expectedPrice;
}
