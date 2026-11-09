package com.fullstackmall.shop.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 发起支付/查询状态的出参。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PayResultDTO {

    private String paymentNo;

    /** 收银台跳转地址（状态查询时为 null） */
    private String payUrl;

    private String status;
}
