package com.fullstackmall.shop.seckill.controller;

import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.seckill.dto.SeckillActivityAdminDTO;
import com.fullstackmall.shop.seckill.dto.SeckillActivityCreateRequest;
import com.fullstackmall.shop.seckill.service.SeckillAdminService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 秒杀场次管理端接口：/mall/admin/** 挂 AdminInterceptor（USER 角色 403）。
 * 创建（划拨事务）→ 取消（仅 PENDING，归还库存）。
 */
@RestController
@RequestMapping("/mall/admin/seckill-activities")
public class SeckillAdminController {

    private final SeckillAdminService seckillAdminService;

    public SeckillAdminController(SeckillAdminService seckillAdminService) {
        this.seckillAdminService = seckillAdminService;
    }

    /** 场次分页（status 可空=全部） */
    @GetMapping
    public Result<PageResult<SeckillActivityAdminDTO>> page(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return Result.success(seckillAdminService.page(status, page, pageSize));
    }

    /** 创建：校验通过后事务划拨库存并落 PENDING */
    @PostMapping
    public Result<SeckillActivityAdminDTO> create(@RequestBody @Valid SeckillActivityCreateRequest request) {
        return Result.success(seckillAdminService.create(request));
    }

    /** 取消：仅 PENDING，归还划拨库存 */
    @PostMapping("/{id}/cancel")
    public Result<Void> cancel(@PathVariable Long id) {
        seckillAdminService.cancel(id);
        return Result.success(null);
    }
}
