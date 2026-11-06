package com.fullstackmall.shop.product.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.product.dto.HomeContentDTO;
import com.fullstackmall.shop.product.dto.ProductListRequest;
import com.fullstackmall.shop.product.dto.ProductSummaryDTO;
import com.fullstackmall.shop.product.entity.HomeBanner;
import com.fullstackmall.shop.product.mapper.HomeBannerMapper;
import com.fullstackmall.shop.product.service.CategoryService;
import com.fullstackmall.shop.product.service.HomeService;
import com.fullstackmall.shop.product.service.ProductService;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HomeServiceImpl implements HomeService {

    /** 平移自前端 mall.ts MALL_NOTICE；接入运营配置前为常量 */
    private static final String NOTICE = "新客立减 ¥30 · 全场满 ¥299 顺丰包邮 · 7 天无理由退换";
    private static final String FLASH_TITLE = "限时甄选（每日 10:00–22:00）";
    private static final int FLASH_LIMIT = 3;
    private static final int NEWS_LIMIT = 4;
    private static final int RECOMMEND_LIMIT = 6;

    private final HomeBannerMapper homeBannerMapper;
    private final ProductService productService;
    private final CategoryService categoryService;

    public HomeServiceImpl(HomeBannerMapper homeBannerMapper,
                           ProductService productService,
                           CategoryService categoryService) {
        this.homeBannerMapper = homeBannerMapper;
        this.productService = productService;
        this.categoryService = categoryService;
    }

    @Override
    public HomeContentDTO homeContent() {
        HomeContentDTO content = new HomeContentDTO();
        content.setNotice(NOTICE);
        content.setBanners(loadBanners());
        content.setCategories(categoryService.levelOne());
        content.setFlash(loadFlash());
        content.setNews(queryCards(null, null, NEWS_LIMIT));
        content.setRecommend(queryCards("sales_desc", null, RECOMMEND_LIMIT));
        return content;
    }

    private List<HomeContentDTO.BannerItem> loadBanners() {
        List<HomeBanner> banners = homeBannerMapper.selectList(
                Wrappers.<HomeBanner>lambdaQuery()
                        .eq(HomeBanner::getStatus, 1)
                        .orderByAsc(HomeBanner::getSort));
        return banners.stream().map(banner -> {
            HomeContentDTO.BannerItem item = new HomeContentDTO.BannerItem();
            BeanUtils.copyProperties(banner, item);
            return item;
        }).toList();
    }

    /** 限时甄选 = 存在划线价大于现价的规格（discountOnly），取前 3 */
    private HomeContentDTO.FlashSection loadFlash() {
        HomeContentDTO.FlashSection flash = new HomeContentDTO.FlashSection();
        flash.setTitle(FLASH_TITLE);
        flash.setItems(queryCards(null, true, FLASH_LIMIT));
        return flash;
    }

    /** 首页各区块统一复用商品聚合查询（卡片语义与列表一致），limit 为内部常量 */
    private List<ProductSummaryDTO> queryCards(String sort, Boolean discountOnly, int limit) {
        ProductListRequest query = new ProductListRequest();
        query.setPage(1);
        query.setPageSize(limit);
        query.setSort(sort);
        query.setDiscountOnly(discountOnly);
        PageResult<ProductSummaryDTO> result = productService.pageProducts(query);
        return result.getList();
    }
}
