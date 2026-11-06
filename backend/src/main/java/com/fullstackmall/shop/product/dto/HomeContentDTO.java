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
}
