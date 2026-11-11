package com.fullstackmall.shop.product.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.dto.ProductDetailDTO;
import com.fullstackmall.shop.product.dto.ProductItemDTO;
import com.fullstackmall.shop.product.dto.ProductSummaryDTO;
import com.fullstackmall.shop.product.service.ProductService;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProductController.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProductService productService;

    /** WebMvcConfig 注册拦截器需要 JwtService；@WebMvcTest 不加载该 @Component，打桩补齐 */
    @MockitoBean
    private JwtService jwtService;

    @Test
    void pagedList_shouldReturnAgreedEnvelopeAndPageShape() throws Exception {
        ProductSummaryDTO item = new ProductSummaryDTO();
        item.setId(1L);
        item.setName("陶土色垂感风衣 · 中长款双面呢");
        item.setPrice(new BigDecimal("399.00"));
        item.setConditionGrade("NEW");
        item.setOwnerType("PLATFORM");
        Page<ProductSummaryDTO> page = new Page<>(1, 4, 13);
        page.setRecords(List.of(item));
        given(productService.pageProducts(any())).willReturn(PageResult.of(page));

        mockMvc.perform(get("/mall/product/list")
                        .param("page", "1")
                        .param("pageSize", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("ok"))
                .andExpect(jsonPath("$.data.list[0].id").value(1))
                .andExpect(jsonPath("$.data.list[0].conditionGrade").value("NEW"))
                .andExpect(jsonPath("$.data.list[0].ownerType").value("PLATFORM"))
                .andExpect(jsonPath("$.data.total").value(13))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.pageSize").value(4));
    }

    @Test
    void blankKeyword_shouldQueryNormally() throws Exception {
        Page<ProductSummaryDTO> page = new Page<>(1, 10, 0);
        page.setRecords(List.of());
        given(productService.pageProducts(any())).willReturn(PageResult.of(page));

        mockMvc.perform(get("/mall/product/list")
                        .param("page", "1")
                        .param("pageSize", "10")
                        .param("keyword", "  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(0));
    }

    @Test
    void pageZero_shouldReturn400() throws Exception {
        mockMvc.perform(get("/mall/product/list")
                        .param("page", "0")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void detail_shouldReturnNormally() throws Exception {
        ProductItemDTO sku = new ProductItemDTO();
        sku.setId(1L);
        sku.setSize("M");
        sku.setColor("陶土色");
        sku.setConditionGrade("NEW");
        sku.setPrice(new BigDecimal("399.00"));
        sku.setStock(200);
        ProductDetailDTO detail = new ProductDetailDTO();
        detail.setId(1L);
        detail.setName("陶土色垂感风衣 · 中长款双面呢");
        detail.setPrice(new BigDecimal("399.00"));
        detail.setOwnerType("PLATFORM");
        detail.setSaleMode("NORMAL");
        detail.setItems(List.of(sku));
        detail.setImages(List.of("https://picsum.photos/seed/mall-p1-1/750/750"));
        given(productService.getDetail(1L)).willReturn(detail);

        mockMvc.perform(get("/mall/product/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.name").value("陶土色垂感风衣 · 中长款双面呢"))
                .andExpect(jsonPath("$.data.price").value(399.00))
                .andExpect(jsonPath("$.data.ownerType").value("PLATFORM"))
                .andExpect(jsonPath("$.data.saleMode").value("NORMAL"))
                .andExpect(jsonPath("$.data.items[0].price").value(399.00))
                .andExpect(jsonPath("$.data.items[0].conditionGrade").value("NEW"))
                .andExpect(jsonPath("$.data.images[0]").isString());
    }

    @Test
    void detailNotFound_shouldReturn404WithUnifiedMessage() throws Exception {
        given(productService.getDetail(999L)).willThrow(new BusinessException(ResultCode.PRODUCT_NOT_FOUND));

        mockMvc.perform(get("/mall/product/999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("商品不存在"));
    }
}
