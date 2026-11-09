package com.fullstackmall.shop.payout.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.payout.dto.PayoutDTO;
import com.fullstackmall.shop.payout.service.PayoutService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 结算管理端接口：/mall/admin/** 挂 AdminInterceptor（USER 角色 403）。
 * 三步审批：PENDING → confirm(CONFIRMED) → pay(PAID)。
 */
@RestController
@RequestMapping("/mall/admin/payouts")
public class AdminPayoutController {

    private final PayoutService payoutService;

    public AdminPayoutController(PayoutService payoutService) {
        this.payoutService = payoutService;
    }

    /** 结算单列表（缺省查 PENDING 待初审；缺省值在契约层表达，Service 不再判空） */
    @GetMapping
    public Result<List<PayoutDTO>> list(@RequestParam(defaultValue = "PENDING") String status) {
        return Result.success(payoutService.adminList(status));
    }

    /** 初审：PENDING → CONFIRMED */
    @PostMapping("/{id}/confirm")
    public Result<PayoutDTO> confirm(@PathVariable Long id) {
        return Result.success(payoutService.confirm(id));
    }

    /** 打款：CONFIRMED → PAID（同事务联动寄卖单 SETTLED） */
    @PostMapping("/{id}/pay")
    public Result<PayoutDTO> pay(@PathVariable Long id) {
        return Result.success(payoutService.pay(id));
    }
}
