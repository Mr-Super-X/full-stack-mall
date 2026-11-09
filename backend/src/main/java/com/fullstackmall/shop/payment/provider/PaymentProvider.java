package com.fullstackmall.shop.payment.provider;

import com.fullstackmall.shop.payment.entity.Payment;

import java.math.BigDecimal;

/**
 * 支付网关抽象（设计文档 §7.3）：本地开发用 FakeProvider 闭环，联调切 AlipaySandboxProvider。
 * 验签语义与真实网关一致——回调的可信来源不是登录态而是签名。
 */
public interface PaymentProvider {

    /** 构造收银台跳转地址（前端/浏览器打开后引导完成支付） */
    String buildPayUrl(Payment payment);

    /** 校验异步回调签名（md5(paymentNo:amount:secret)，与支付宝 sign 同款职责） */
    boolean verifySign(String paymentNo, BigDecimal amount, String sign);
}
