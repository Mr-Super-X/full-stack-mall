package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.product.dto.CategoryTreeDTO;
import com.fullstackmall.shop.product.dto.HomeContentDTO;
import com.fullstackmall.shop.product.dto.ProductSummaryDTO;
import com.fullstackmall.shop.product.service.HomeService;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(HomeController.class)
class HomeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private HomeService homeService;

    /** WebMvcConfig 注册拦截器需要 JwtService；@WebMvcTest 不加载该 @Component，打桩补齐 */
    @MockitoBean
    private JwtService jwtService;

    @Test
    void 首页聚合应包含五个区块() throws Exception {
        HomeContentDTO.BannerItem banner = new HomeContentDTO.BannerItem();
        banner.setId(1L);
        banner.setTitle("新客立减 ¥30");
        banner.setPicUrl("https://example.com/b1.jpg");

        CategoryTreeDTO category = new CategoryTreeDTO();
        category.setId(2L);
        category.setName("女装");

        ProductSummaryDTO item = new ProductSummaryDTO();
        item.setId(7L);
        item.setName("云朵感圆领针织");

        HomeContentDTO.FlashSection flash = new HomeContentDTO.FlashSection();
        flash.setTitle("限时甄选（每日 10:00–22:00）");
        flash.setItems(List.of(item));

        HomeContentDTO content = new HomeContentDTO();
        content.setNotice("新客立减 ¥30 · 全场满 ¥299 顺丰包邮 · 7 天无理由退换");
        content.setBanners(List.of(banner));
        content.setCategories(List.of(category));
        content.setFlash(flash);
        content.setNews(List.of(item));
        content.setRecommend(List.of(item));
        given(homeService.homeContent()).willReturn(content);

        mockMvc.perform(get("/mall/home/content"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.notice").isString())
                .andExpect(jsonPath("$.data.banners[0].title").value("新客立减 ¥30"))
                .andExpect(jsonPath("$.data.categories[0].name").value("女装"))
                .andExpect(jsonPath("$.data.flash.items[0].name").value("云朵感圆领针织"))
                .andExpect(jsonPath("$.data.news[0].id").value(7))
                .andExpect(jsonPath("$.data.recommend[0].id").value(7));
    }

    @Test
    void 区块为空数组时整体仍应200() throws Exception {
        HomeContentDTO content = new HomeContentDTO();
        content.setNotice("notice");
        content.setBanners(List.of());
        content.setCategories(List.of());
        HomeContentDTO.FlashSection flash = new HomeContentDTO.FlashSection();
        flash.setTitle("限时甄选（每日 10:00–22:00）");
        flash.setItems(List.of());
        content.setFlash(flash);
        content.setNews(List.of());
        content.setRecommend(List.of());
        given(homeService.homeContent()).willReturn(content);

        mockMvc.perform(get("/mall/home/content"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.banners.length()").value(0))
                .andExpect(jsonPath("$.data.flash.items.length()").value(0));
    }
}
