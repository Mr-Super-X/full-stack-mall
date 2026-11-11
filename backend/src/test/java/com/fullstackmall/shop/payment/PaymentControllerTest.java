package com.fullstackmall.shop.payment;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.payment.controller.PaymentController;
import com.fullstackmall.shop.payment.dto.PayResultDTO;
import com.fullstackmall.shop.payment.service.PaymentService;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PaymentController 切片测试：pay 契约 + notify 免登录可达（回调路径放行验签）+ 轮询。
 */
@WebMvcTest(PaymentController.class)
class PaymentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PaymentService paymentService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void initiatePay_shouldReturnCashierUrl() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(paymentService.pay("P20261109120000-4821")).willReturn(
                new PayResultDTO("P20261109120000-4821",
                        "/api/mall/payments/fake/checkout?paymentNo=P20261109120000-4821&amount=798.00&sign=abc",
                        "PAYING"));

        mockMvc.perform(post("/mall/payments/P20261109120000-4821/pay")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.payUrl").isString())
                .andExpect(jsonPath("$.data.status").value("PAYING"));
    }

    @Test
    void notifyAccessibleWithoutLogin_shouldReturnSuccess() throws Exception {
        // 免登录：notify 是支付网关→商户服务器调用，无 Cookie，靠验签鉴权
        given(paymentService.notify(any())).willReturn(Map.of("success", true));

        mockMvc.perform(post("/mall/payments/fake/notify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"paymentNo\":\"P1\",\"tradeNo\":\"T1\",\"amount\":798.00,\"success\":true,\"sign\":\"x\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.success").value(true));
    }

    @Test
    void pollPaymentStatus() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(paymentService.status("P1")).willReturn(
                new PayResultDTO("P1", null, "SUCCESS"));

        mockMvc.perform(get("/mall/payments/P1")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("SUCCESS"));
    }

    @Test
    void payNonExistentPayment_shouldReturn404() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(paymentService.pay("P9")).willThrow(new BusinessException(ResultCode.PAYMENT_NOT_FOUND));

        mockMvc.perform(post("/mall/payments/P9/pay")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    void cashierParams_mustBeHtmlEscaped() {
        // 存储型 XSS 防线：paymentNo 含脚本注入载荷时，输出必须转义（终审 CRITICAL）
        PaymentController controller = new PaymentController(paymentService);
        String html = controller.checkout("';alert(document.cookie);//", java.math.BigDecimal.ONE, "x");

        org.assertj.core.api.Assertions.assertThat(html).doesNotContain("';alert(document.cookie);//");
        // 单引号被转义为 &#39;（断言转义发生而非特定字符）
        org.assertj.core.api.Assertions.assertThat(html).contains("&#39;");
    }
}
