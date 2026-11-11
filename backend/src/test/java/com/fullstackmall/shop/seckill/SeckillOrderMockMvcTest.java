package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.seckill.controller.SeckillController;
import com.fullstackmall.shop.seckill.dto.SeckillOrderResultDTO;
import com.fullstackmall.shop.seckill.service.SeckillService;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 秒杀下单契约切片测试：四错误码信封透传 + 成功出参形状（401 链在 Task 7 端到端覆盖）。
 */
@WebMvcTest(SeckillController.class)
class SeckillOrderMockMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private SeckillService seckillService;

    /** WebMvcConfig 注册拦截器需要 JwtService；@WebMvcTest 不加载该 @Component，打桩补齐 */
    @MockitoBean
    private JwtService jwtService;

    @Test
    void placeOrderSuccess_returnsOrderNoAndPaymentNo() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(seckillService.placeOrder(eq(1L), any()))
                .willReturn(new SeckillOrderResultDTO("M20261110120000-0001", "P20261110120000-0001"));

        mockMvc.perform(post("/mall/seckill/1/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":5,\"productItemId\":36}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.orderNo").value("M20261110120000-0001"))
                .andExpect(jsonPath("$.data.paymentNo").value("P20261110120000-0001"));
    }

    @Test
    void notStartedOrEnded_transmits40001() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(seckillService.placeOrder(eq(1L), any()))
                .willThrow(new BusinessException(ResultCode.SECKILL_NOT_STARTED));

        mockMvc.perform(post("/mall/seckill/1/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":5,\"productItemId\":36}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40001))
                .andExpect(jsonPath("$.message").value("秒杀尚未开始或已结束"));
    }

    @Test
    void soldOut_transmits40002() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(seckillService.placeOrder(eq(1L), any()))
                .willThrow(new BusinessException(ResultCode.SOLD_OUT));

        mockMvc.perform(post("/mall/seckill/1/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":5,\"productItemId\":36}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40002));
    }

    @Test
    void limitExceeded_transmits40003() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(seckillService.placeOrder(eq(1L), any()))
                .willThrow(new BusinessException(ResultCode.LIMIT_EXCEEDED));

        mockMvc.perform(post("/mall/seckill/1/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":5,\"productItemId\":36}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40003));
    }

    @Test
    void duplicateParticipation_transmits40004() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(seckillService.placeOrder(eq(1L), any()))
                .willThrow(new BusinessException(ResultCode.DUPLICATE_ORDER));

        mockMvc.perform(post("/mall/seckill/1/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":5,\"productItemId\":36}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40004));
    }

    @Test
    void activityNotFound_transmits404() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(seckillService.placeOrder(eq(9L), any()))
                .willThrow(new BusinessException(ResultCode.SECKILL_NOT_FOUND));

        mockMvc.perform(post("/mall/seckill/9/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":5,\"productItemId\":36}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }
}
