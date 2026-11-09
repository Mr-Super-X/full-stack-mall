package com.fullstackmall.shop.order;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.controller.OrderController;
import com.fullstackmall.shop.order.dto.OrderDTO;
import com.fullstackmall.shop.order.service.OrderService;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * OrderController 切片测试：下单契约（入参校验/返回值形状/未登录拦截）。
 */
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private OrderService orderService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void 下单成功应返回订单号与支付单号() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        OrderDTO dto = new OrderDTO();
        dto.setId(1L);
        dto.setOrderNo("M20261109120000-4821");
        dto.setPaymentNo("P20261109120000-4821");
        dto.setStatus("PENDING_PAYMENT");
        dto.setPayAmount(new BigDecimal("798.00"));
        given(orderService.create(any())).willReturn(dto);

        mockMvc.perform(post("/mall/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":1,\"source\":\"CART\",\"cartItemIds\":[1,2]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.orderNo").isString())
                .andExpect(jsonPath("$.data.paymentNo").isString())
                .andExpect(jsonPath("$.data.status").value("PENDING_PAYMENT"));
    }

    @Test
    void 购物车模式缺条目应返回400() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        // Service 层对模式内必填做交叉校验，缺失即抛参数错误（Controller 契约=异常透传为 400 信封）
        given(orderService.create(any())).willThrow(new BusinessException(ResultCode.BAD_REQUEST));

        mockMvc.perform(post("/mall/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":1,\"source\":\"CART\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void 直购模式缺规格应返回400() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(orderService.create(any())).willThrow(new BusinessException(ResultCode.BAD_REQUEST));

        mockMvc.perform(post("/mall/orders")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":1,\"source\":\"DIRECT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void 未登录下单应返回401() throws Exception {
        mockMvc.perform(post("/mall/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":1,\"source\":\"CART\",\"cartItemIds\":[1]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }
}
