package com.fullstackmall.shop.cart;

import com.fullstackmall.shop.cart.controller.CartController;
import com.fullstackmall.shop.cart.dto.CartItemDTO;
import com.fullstackmall.shop.cart.service.CartService;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CartController 切片测试：购物车四接口契约 + 寄卖加购拦截 + 越权/未登录链路。
 */
@WebMvcTest(CartController.class)
class CartControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CartService cartService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void addToCart_success_shouldReturn200WithItem() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(cartService.add(any())).willReturn(item(1L, 2, false));

        mockMvc.perform(post("/mall/cart/items")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productItemId\":1,\"quantity\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.quantity").value(2));
    }

    @Test
    void addConsignmentItem_shouldReturn400WithDirectBuyHint() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(cartService.add(any()))
                .willThrow(new BusinessException(ResultCode.CONSIGNMENT_DIRECT_ONLY));

        mockMvc.perform(post("/mall/cart/items")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productItemId\":33,\"quantity\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("寄卖商品请直接购买"));
    }

    @Test
    void cartList_shouldCarryLiveInfoAndInvalidFlag() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        CartItemDTO invalid = item(2L, 1, true);
        given(cartService.list()).willReturn(List.of(item(1L, 2, false), invalid));

        mockMvc.perform(get("/mall/cart")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].invalid").value(false))
                .andExpect(jsonPath("$.data[1].invalid").value(true));
    }

    @Test
    void updateQuantity_success_shouldReturn200() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(cartService.update(eq(1L), any())).willReturn(item(1L, 5, false));

        mockMvc.perform(patch("/mall/cart/items/1")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.quantity").value(5));
    }

    @Test
    void updateOthersItem_shouldReturn404() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(cartService.update(eq(9L), any()))
                .willThrow(new BusinessException(ResultCode.CART_ITEM_NOT_FOUND));

        mockMvc.perform(patch("/mall/cart/items/9")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"quantity\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("购物车条目不存在"));
    }

    @Test
    void deleteOthersItem_shouldReturn404() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        doThrow(new BusinessException(ResultCode.CART_ITEM_NOT_FOUND))
                .when(cartService).remove(9L);

        mockMvc.perform(delete("/mall/cart/items/9")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    void unauthenticatedAccess_shouldReturn401() throws Exception {
        mockMvc.perform(get("/mall/cart"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    private CartItemDTO item(Long id, int quantity, boolean invalid) {
        CartItemDTO dto = new CartItemDTO();
        dto.setId(id);
        dto.setProductItemId(id);
        dto.setQuantity(quantity);
        dto.setChecked(true);
        dto.setProductName("陶土色垂感风衣");
        dto.setPrice(new BigDecimal("399.00"));
        dto.setStock(200);
        dto.setConditionGrade("NEW");
        dto.setOwnerType("PLATFORM");
        dto.setInvalid(invalid);
        return dto;
    }
}
