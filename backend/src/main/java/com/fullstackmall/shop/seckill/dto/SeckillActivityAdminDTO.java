package com.fullstackmall.shop.seckill.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * admin 视角秒杀场次出参（含挂载商品标题与库存进度）。
 */
@Data
public class SeckillActivityAdminDTO {

    private Long id;

    private Long productId;

    /** 挂载商品标题（批量回填，禁 N+1） */
    private String productTitle;

    private BigDecimal seckillPrice;

    private Integer seckillStock;

    private Integer soldCount;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer limitPerUser;

    private String status;
}
