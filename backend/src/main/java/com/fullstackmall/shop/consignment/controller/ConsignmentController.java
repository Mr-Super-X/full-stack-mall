package com.fullstackmall.shop.consignment.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.consignment.dto.ConsignmentDTO;
import com.fullstackmall.shop.consignment.dto.ConsignmentSubmitRequest;
import com.fullstackmall.shop.consignment.service.ConsignmentService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 寄卖 C 端接口：全部需登录（/mall/consignments/** 挂 AuthInterceptor）。
 * accept 为卖家确认定价（铸造上架），是寄卖状态机的关键流转点。
 */
@RestController
@RequestMapping("/mall/consignments")
public class ConsignmentController {

    private final ConsignmentService consignmentService;

    public ConsignmentController(ConsignmentService consignmentService) {
        this.consignmentService = consignmentService;
    }

    @PostMapping
    public Result<ConsignmentDTO> submit(@Valid @RequestBody ConsignmentSubmitRequest req) {
        return Result.success(consignmentService.submit(req));
    }

    @GetMapping("/mine")
    public Result<List<ConsignmentDTO>> mine() {
        return Result.success(consignmentService.mine());
    }

    @GetMapping("/{id}")
    public Result<ConsignmentDTO> detail(@PathVariable Long id) {
        return Result.success(consignmentService.detail(id));
    }

    @PostMapping("/{id}/accept")
    public Result<ConsignmentDTO> accept(@PathVariable Long id) {
        return Result.success(consignmentService.accept(id));
    }
}
