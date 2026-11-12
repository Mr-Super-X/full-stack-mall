package com.fullstackmall.shop.product.service;

import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.product.dto.AdminProductCreateRequest;
import com.fullstackmall.shop.product.dto.AdminProductDTO;
import com.fullstackmall.shop.product.dto.AdminProductUpdateRequest;

/**
 * 自营商品管理（admin）：分页列表 / 创建（product+items+images 单事务）/ 编辑与上下架。
 * 只覆盖 PLATFORM 货源——寄卖商品生命周期由寄卖单驱动，不在此处编辑。
 */
public interface AdminProductService {

    /** 分页：status 可空=全部，keyword 按名称模糊；只查自营 */
    PageResult<AdminProductDTO> page(Integer status, String keyword, int page, int pageSize);

    /** 创建自营商品：固化 PLATFORM/NORMAL/sales=0/status=1，规格至少一条 */
    AdminProductDTO create(AdminProductCreateRequest request);

    /** 编辑基础字段 + 上下架（PATCH 语义，null 不更新）；下架受秒杀挂载保护 */
    AdminProductDTO update(Long id, AdminProductUpdateRequest request);
}
