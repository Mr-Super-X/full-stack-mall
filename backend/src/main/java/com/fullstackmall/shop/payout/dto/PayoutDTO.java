package com.fullstackmall.shop.payout.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 结算单出参（管理端审批列表/操作结果）。
 */
@Data
public class PayoutDTO {

    private Long id;
    private Long sellerId;
    private Long orderItemId;
    private BigDecimal sellerAmount;
    private BigDecimal commission;
    private String status;
    private LocalDateTime createTime;
}
