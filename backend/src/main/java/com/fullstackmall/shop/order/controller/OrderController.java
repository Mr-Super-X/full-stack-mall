package com.fullstackmall.shop.order.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.order.dto.CreateOrderRequest;
import com.fullstackmall.shop.order.dto.OrderDTO;
import com.fullstackmall.shop.order.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 订单接口：全部需登录（/mall/orders/** 挂 AuthInterceptor）。
 */
@RestController
@RequestMapping("/mall/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public Result<OrderDTO> create(@Valid @RequestBody CreateOrderRequest req) {
        return Result.success(orderService.create(req));
    }

    /** 订单列表；status 可空查全部（先批量惰性关单再过滤） */
    @GetMapping
    public Result<List<OrderDTO>> list(@RequestParam(required = false) String status) {
        return Result.success(orderService.list(status));
    }

    /** 订单详情（仅本人；触发惰性关单） */
    @GetMapping("/{id}")
    public Result<OrderDTO> detail(@PathVariable Long id) {
        return Result.success(orderService.detail(id));
    }

    /** 主动取消（PENDING_PAYMENT → CANCELLED + 还库存） */
    @PostMapping("/{id}/cancel")
    public Result<Void> cancel(@PathVariable Long id) {
        orderService.cancel(id);
        return Result.success(null);
    }
}
