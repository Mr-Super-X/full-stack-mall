package com.fullstackmall.shop.seckill.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 创建秒杀场次入参（admin）。
 * 挂载约束与限购固化在 Service 层复核（单 SKU 自营、limit 恒 1）。
 */
@Data
public class SeckillActivityCreateRequest {

    @NotNull(message = "商品不能为空")
    private Long productId;

    @NotNull(message = "秒杀价不能为空")
    @DecimalMin(value = "0.01", message = "秒杀价必须大于 0")
    private BigDecimal seckillPrice;

    @NotNull(message = "划拨库存不能为空")
    @Min(value = 1, message = "划拨库存至少 1 件")
    private Integer seckillStock;

    @NotNull(message = "开始时间不能为空")
    private LocalDateTime startTime;

    @NotNull(message = "结束时间不能为空")
    private LocalDateTime endTime;

    /** 每人限购（本期固化恒 1，Service 层拒绝其他值） */
    @NotNull(message = "限购数不能为空")
    private Integer limitPerUser;
}
