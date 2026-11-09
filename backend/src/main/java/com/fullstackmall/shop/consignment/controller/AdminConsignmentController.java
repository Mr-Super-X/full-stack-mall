package com.fullstackmall.shop.consignment.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.consignment.dto.ConsignmentDTO;
import com.fullstackmall.shop.consignment.dto.ReviewRequest;
import com.fullstackmall.shop.consignment.service.ConsignmentService;
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
 * 寄卖管理端接口：/mall/admin/** 挂 AdminInterceptor（USER 角色 403）。
 * MVP 无"开始审核"动作：提交（SUBMITTED）即入审核池。
 */
@RestController
@RequestMapping("/mall/admin/consignments")
public class AdminConsignmentController {

    private final ConsignmentService consignmentService;

    public AdminConsignmentController(ConsignmentService consignmentService) {
        this.consignmentService = consignmentService;
    }

    /** 审核池：缺省查 SUBMITTED（提交即入池；缺省值在契约层表达，Service 不再判空） */
    @GetMapping
    public Result<List<ConsignmentDTO>> list(@RequestParam(defaultValue = "SUBMITTED") String status) {
        return Result.success(consignmentService.adminList(status));
    }

    /** 核价（approve=true → PRICED）或驳回（approve=false → REJECTED） */
    @PostMapping("/{id}/review")
    public Result<ConsignmentDTO> review(@PathVariable Long id, @Valid @RequestBody ReviewRequest req) {
        return Result.success(consignmentService.review(id, req));
    }
}
