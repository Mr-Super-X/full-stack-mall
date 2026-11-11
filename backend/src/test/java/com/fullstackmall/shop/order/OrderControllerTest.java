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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    void placeOrderSuccess_shouldReturnOrderNoAndPaymentNo() throws Exception {
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
    void cartCheckoutMissingItems_shouldReturn400() throws Exception {
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
    void directBuyMissingSpec_shouldReturn400() throws Exception {
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
    void placeOrderUnauthenticated_shouldReturn401() throws Exception {
        mockMvc.perform(post("/mall/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"addressId\":1,\"source\":\"CART\",\"cartItemIds\":[1]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    // ── Task 2（阶段 3）：卖家订单列表端点 ────────────────────────

    @Test
    void sellerOrderList_shouldReturnSuccess() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        OrderDTO dto = new OrderDTO();
        dto.setId(2L);
        dto.setOrderNo("M20261109120000-4821");
        dto.setStatus("SHIPPED");
        dto.setPayAmount(new BigDecimal("680.00"));
        given(orderService.sold(org.mockito.ArgumentMatchers.isNull())).willReturn(java.util.List.of(dto));

        mockMvc.perform(get("/mall/orders/sold")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].status").value("SHIPPED"));
    }

    @Test
    void sellerOrders_shouldPassThroughStatusParam() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(orderService.sold("SHIPPED")).willReturn(java.util.List.of());

        mockMvc.perform(get("/mall/orders/sold")
                        .param("status", "SHIPPED")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        org.mockito.Mockito.verify(orderService).sold("SHIPPED");
    }

    // ── Task 3（阶段 3）：发货端点 ────────────────────────────────

    @Test
    void shipOrderSuccess_shouldReturn200() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(2L, "seller", "USER"));

        mockMvc.perform(post("/mall/orders/1/ship")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        org.mockito.Mockito.verify(orderService).ship(1L);
    }

    @Test
    void shipOrderWrongRole_shouldReturn403() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        org.mockito.Mockito.doThrow(new com.fullstackmall.shop.common.BusinessException(
                        com.fullstackmall.shop.common.ResultCode.FORBIDDEN))
                .when(orderService).ship(1L);

        mockMvc.perform(post("/mall/orders/1/ship")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403));
    }
}
