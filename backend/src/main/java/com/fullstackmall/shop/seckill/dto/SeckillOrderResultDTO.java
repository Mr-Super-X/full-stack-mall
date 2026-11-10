package com.fullstackmall.shop.seckill.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 秒杀下单出参：订单号 + 支付单号（前端直跳 FakeProvider 收银台）。
 */
@Data
@AllArgsConstructor
public class SeckillOrderResultDTO {

    private String orderNo;

    private String paymentNo;
}
