package com.fullstackmall.shop.payout.service;

import com.fullstackmall.shop.payout.dto.PayoutDTO;

import java.util.List;

/**
 * 结算业务（管理端）。三步状态机：PENDING 待初审 → CONFIRMED 已初审 → PAID 已打款。
 */
public interface PayoutService {

    /** 结算单列表（缺省查 PENDING 待初审） */
    List<PayoutDTO> adminList(String status);

    /**
     * 初审：PENDING → CONFIRMED（条件迁移）。
     *
     * @throws com.fullstackmall.shop.common.BusinessException PAYOUT_NOT_FOUND / PAYOUT_STATE_ILLEGAL
     */
    PayoutDTO confirm(Long id);

    /**
     * 打款：CONFIRMED → PAID（条件迁移），同事务联动寄卖单 SOLD→SETTLED。
     *
     * @throws com.fullstackmall.shop.common.BusinessException PAYOUT_NOT_FOUND / PAYOUT_STATE_ILLEGAL
     */
    PayoutDTO pay(Long id);
}
