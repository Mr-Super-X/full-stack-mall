package com.fullstackmall.shop.seckill.dto;

/**
 * 出单状态轮询出参（spec §5.4）：status=ACCEPTED（受理中）/CREATED（已建单）/FAILED（死信登记）；
 * paymentNo 仅 CREATED 态非空（前端据此跳收银台）。
 */
public record SeckillOrderStatusDTO(String status, String paymentNo) {
}
