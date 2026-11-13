package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.product.service.SearchService;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.greaterThan;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 搜索接口切片测试：匿名可访问 + 信封 + 三个端点（联想/热搜/埋点）。
 */
@WebMvcTest(SearchController.class)
class SearchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SearchService searchService;

    /** WebMvcConfig 注册拦截器需要 JwtService；@WebMvcTest 不加载该 @Component，打桩补齐（对齐 OrderControllerTest 既定模式） */
    @MockitoBean
    private JwtService jwtService;

    @Test
    void suggest_shouldReturnAgreedEnvelope() throws Exception {
        given(searchService.suggest(anyString())).willReturn(List.of("法式连衣裙", "真丝连衣裙"));

        mockMvc.perform(get("/mall/search/suggest").param("keyword", "连衣裙"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0]").value("法式连衣裙"))
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void suggest_blankKeyword_should400() throws Exception {
        // 信封契约：HTTP 200 + body code=400（与 handleValidation 既有行为对齐）
        mockMvc.perform(get("/mall/search/suggest").param("keyword", "  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void hotWordsAnonymous_shouldReturnNonEmptyArray() throws Exception {
        given(searchService.hotWords()).willReturn(List.of("棉麻衬衫", "连衣裙"));

        mockMvc.perform(get("/mall/search/hot-words"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(greaterThan(0)));
    }

    @Test
    void track_validBody_shouldInvokeService() throws Exception {
        mockMvc.perform(post("/mall/search/track")
                        .contentType("application/json")
                        .content("{\"keyword\":\"风衣\",\"resultCount\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        verify(searchService).track(any());
    }

    @Test
    void track_blankKeyword_should400() throws Exception {
        // 信封契约：HTTP 200 + body code=400
        mockMvc.perform(post("/mall/search/track")
                        .contentType("application/json")
                        .content("{\"keyword\":\"  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }
}
