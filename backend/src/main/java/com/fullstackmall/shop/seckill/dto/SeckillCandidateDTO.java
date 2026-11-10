package com.fullstackmall.shop.seckill.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 秒杀挂载候选商品出参（admin 新建 dialog 下拉）：
 * 仅单 SKU 自营且有库存的商品可参与秒杀（spec §3.1 挂载约束）。
 */
@Data
public class SeckillCandidateDTO {

    private Long productId;

    private String title;

    /** 挂载 item（唯一 SKU） */
    private Long itemId;

    /** 当前可划拨库存 */
    private Integer stock;

    private BigDecimal price;
}
