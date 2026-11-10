package com.fullstackmall.shop.seckill.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 秒杀直购入参（登录态）。quantity 恒 1 不接受入参（单 SKU 单件）。
 */
@Data
public class SeckillOrderRequest {

    @NotNull(message = "地址不能为空")
    private Long addressId;

    /** 必须为活动挂载商品的唯一 SKU（Service 复核匹配） */
    @NotNull(message = "商品规格不能为空")
    private Long productItemId;
}
