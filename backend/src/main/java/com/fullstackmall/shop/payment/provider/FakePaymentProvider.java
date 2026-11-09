package com.fullstackmall.shop.payment.provider;

import com.fullstackmall.shop.payment.entity.Payment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.util.DigestUtils;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

/**
 * 开发用模拟支付网关：本地闭环不依赖外网。
 * 签名算法 md5(paymentNo:amount:secret)——与真实网关同款"共享密钥签名"结构，
 * 教学上走通验签/幂等/状态机全流程，联调时只换实现不改业务。
 */
@Component
@Primary
public class FakePaymentProvider implements PaymentProvider {

    private final String secret;

    public FakePaymentProvider(@Value("${app.payment.secret}") String secret) {
        this.secret = secret;
    }

    @Override
    public String buildPayUrl(Payment payment) {
        return "/api/mall/payments/fake/checkout?paymentNo=" + payment.getPaymentNo()
                + "&amount=" + payment.getAmount()
                + "&sign=" + sign(payment.getPaymentNo(), payment.getAmount());
    }

    @Override
    public boolean verifySign(String paymentNo, BigDecimal amount, String sign) {
        return sign(paymentNo, amount).equals(sign);
    }

    /** 签名（public：测试与收银台页都要用同一算法构造合法签名） */
    public String sign(String paymentNo, BigDecimal amount) {
        return DigestUtils.md5DigestAsHex(
                (paymentNo + ":" + amount + ":" + secret).getBytes(StandardCharsets.UTF_8));
    }
}
