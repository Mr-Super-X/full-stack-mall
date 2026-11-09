package com.fullstackmall.shop.consignment.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 管理端核价/驳回入参。approve=true 时必须带 platformPrice + commissionRate；
 * approve=false 时必须带 rejectReason（字段级交叉校验在 Service 层，DTO 只做非空约束）。
 */
@Data
public class ReviewRequest {

    @NotNull(message = "审核结论不能为空")
    private Boolean approve;

    /** 平台核价（approve=true 必填） */
    @DecimalMin(value = "0.01", message = "核价必须大于 0")
    private BigDecimal platformPrice;

    /** 抽佣百分比 0~100（approve=true 必填） */
    @DecimalMin(value = "0", message = "抽佣比例不能为负")
    @DecimalMax(value = "100", message = "抽佣比例不能超过 100")
    private BigDecimal commissionRate;

    /** 驳回原因（approve=false 必填） */
    private String rejectReason;
}
