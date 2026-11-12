package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.product.dto.AdminProductCreateRequest;
import com.fullstackmall.shop.product.dto.AdminProductDTO;
import com.fullstackmall.shop.product.dto.AdminProductUpdateRequest;
import com.fullstackmall.shop.product.service.AdminProductService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 自营商品管理端接口：/mall/admin/** 挂 AdminInterceptor（USER 角色 403）。
 * 创建（三表单事务）→ 编辑/上下架（下架受秒杀挂载保护）。
 */
@RestController
@RequestMapping("/mall/admin/products")
public class AdminProductController {

    private final AdminProductService adminProductService;

    public AdminProductController(AdminProductService adminProductService) {
        this.adminProductService = adminProductService;
    }

    /** 分页（status 可空=全部；keyword 按名称模糊） */
    @GetMapping
    public Result<PageResult<AdminProductDTO>> page(
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return Result.success(adminProductService.page(status, keyword, page, pageSize));
    }

    /** 创建自营商品（product+items+images 单事务，新建即上架） */
    @PostMapping
    public Result<AdminProductDTO> create(@RequestBody @Valid AdminProductCreateRequest request) {
        return Result.success(adminProductService.create(request));
    }

    /** 编辑基础字段 + 上下架（PATCH 语义，null 字段不更新） */
    @PatchMapping("/{id}")
    public Result<AdminProductDTO> update(@PathVariable Long id,
                                          @RequestBody @Valid AdminProductUpdateRequest request) {
        return Result.success(adminProductService.update(id, request));
    }
}
