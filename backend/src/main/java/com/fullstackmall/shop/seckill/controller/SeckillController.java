package com.fullstackmall.shop.seckill.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.seckill.dto.SeckillActiveDTO;
import com.fullstackmall.shop.seckill.dto.SeckillOrderRequest;
import com.fullstackmall.shop.seckill.dto.SeckillOrderResultDTO;
import com.fullstackmall.shop.seckill.service.SeckillService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 秒杀 C 端接口。GET /mall/seckill/active 匿名可访问（不挂 AuthInterceptor），
 * 下单写路径 POST /mall/seckill/{id}/orders 在 WebMvcConfig 登记 Auth（Task 7）。
 */
@RestController
@RequestMapping("/mall/seckill")
public class SeckillController {

    private final SeckillService seckillService;

    public SeckillController(SeckillService seckillService) {
        this.seckillService = seckillService;
    }

    /** 进行中 + 预告场（过期场读路径惰性推进并归还） */
    @GetMapping("/active")
    public Result<SeckillActiveDTO> active() {
        return Result.success(seckillService.active());
    }

    /** 秒杀直购：成功返回订单号 + 支付单号，前端直跳收银台 */
    @PostMapping("/{activityId}/orders")
    public Result<SeckillOrderResultDTO> placeOrder(
            @PathVariable Long activityId, @RequestBody @Valid SeckillOrderRequest request) {
        return Result.success(seckillService.placeOrder(activityId, request));
    }
}
