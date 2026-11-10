package com.fullstackmall.shop.product.dto;

import lombok.Data;

import java.util.List;

/**
 * 首页聚合出参：平移前端 mall.ts 的五个区块（notice/banners/categories/flash/news/recommend），
 * 各区块允许空集合，整体恒为 200。
 */
@Data
public class HomeContentDTO {

    private String notice;
    private List<BannerItem> banners;
    private List<CategoryTreeDTO> categories;
    private FlashSection flash;
    /** 限时秒杀区块（live ≤2 场 + 预告计数）；无进行中场时 live 为空数组 */
    private SeckillSection seckill;
    private List<ProductSummaryDTO> news;
    private List<ProductSummaryDTO> recommend;

    @Data
    public static class BannerItem {
        private Long id;
        private String title;
        private String picUrl;
        private String linkUrl;
    }

    @Data
    public static class FlashSection {
        private String title;
        private List<ProductSummaryDTO> items;
    }

    @Data
    public static class SeckillSection {
        private String title;
        private List<com.fullstackmall.shop.seckill.dto.SeckillActiveDTO.SeckillActivityDTO> live;
        private int upcomingCount;
    }
}
