package com.fullstackmall.shop.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 支付异步回调入参（FakeProvider 形态；接支付宝沙箱时由 provider 层做参数映射，业务层不变）。
 */
@Data
public class NotifyRequest {

    @NotBlank(message = "支付单号不能为空")
    private String paymentNo;

    @NotBlank(message = "网关流水号不能为空")
    private String tradeNo;

    @NotNull(message = "回调金额不能为空")
    private BigDecimal amount;

    @NotNull(message = "支付结果不能为空")
    private Boolean success;

    @NotBlank(message = "签名不能为空")
    private String sign;
}
