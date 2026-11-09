package com.fullstackmall.shop.payment.service;

import com.fullstackmall.shop.payment.dto.NotifyRequest;
import com.fullstackmall.shop.payment.dto.PayResultDTO;

import java.util.Map;

/**
 * 支付业务。回调幂等四件套：验签 → paymentNo 查库 → 状态机单向 → 金额校验；
 * 另加订单 PAID 条件迁移守护销量累加（重复回调不重复计数）。
 */
public interface PaymentService {

    /**
     * 发起支付：CREATED → PAYING（已 PAYING 幂等复用），返回收银台地址。
     *
     * @throws com.fullstackmall.shop.common.BusinessException PAYMENT_NOT_FOUND 不存在或属于他人
     */
    PayResultDTO pay(String paymentNo);

    /**
     * 异步回调（免登录，验签鉴权）。重复回调幂等返回 success，不重复推进订单/销量。
     */
    Map<String, Object> notify(NotifyRequest req);

    /** 前端轮询支付状态 */
    PayResultDTO status(String paymentNo);
}
