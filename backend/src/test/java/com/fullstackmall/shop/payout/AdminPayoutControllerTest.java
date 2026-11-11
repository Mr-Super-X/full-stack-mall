package com.fullstackmall.shop.payout;

import com.fullstackmall.shop.payout.controller.AdminPayoutController;
import com.fullstackmall.shop.payout.dto.PayoutDTO;
import com.fullstackmall.shop.payout.service.PayoutService;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AdminPayoutController 切片测试：审批三端点契约 + USER 角色 403 真实拦截链。
 */
@WebMvcTest(AdminPayoutController.class)
class AdminPayoutControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PayoutService payoutService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void payoutListDefault_shouldQueryPending() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        given(payoutService.adminList("PENDING")).willReturn(List.of(dto("PENDING")));

        mockMvc.perform(get("/mall/admin/payouts")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].status").value("PENDING"));

        verify(payoutService).adminList("PENDING");
    }

    @Test
    void firstReviewSuccess_shouldReturnConfirmed() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        given(payoutService.confirm(1L)).willReturn(dto("CONFIRMED"));

        mockMvc.perform(post("/mall/admin/payouts/1/confirm")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("CONFIRMED"));
    }

    @Test
    void paySuccess_shouldReturnPaid() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        given(payoutService.pay(1L)).willReturn(dto("PAID"));

        mockMvc.perform(post("/mall/admin/payouts/1/pay")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("PAID"));
    }

    @Test
    void normalUserCallingAdminApi_shouldReturn403() throws Exception {
        // buyer（USER 角色）走真实双层拦截链：Auth 解析身份 → Admin 拦角色
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));

        mockMvc.perform(get("/mall/admin/payouts")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("无权限访问"));
    }

    private PayoutDTO dto(String status) {
        PayoutDTO dto = new PayoutDTO();
        dto.setId(1L);
        dto.setSellerId(2L);
        dto.setOrderItemId(9L);
        dto.setSellerAmount(new BigDecimal("10880.00"));
        dto.setCommission(new BigDecimal("1920.00"));
        dto.setStatus(status);
        return dto;
    }
}
