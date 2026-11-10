package com.fullstackmall.shop.seckill.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * C 端秒杀活动出参：live（进行中，含商品摘要与进度）+ upcoming（未开始，最多 5 条）。
 */
@Data
public class SeckillActiveDTO {

    private List<SeckillActivityDTO> live;

    private List<SeckillActivityDTO> upcoming;

    @Data
    public static class SeckillActivityDTO {
        private Long activityId;
        private Long productId;
        private Long productItemId;
        private String productTitle;
        private String imageUrl;
        private BigDecimal seckillPrice;
        /** 挂载 item 现价（原价，用于划线展示） */
        private BigDecimal originPrice;
        private Integer soldCount;
        private Integer seckillStock;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
    }
}
