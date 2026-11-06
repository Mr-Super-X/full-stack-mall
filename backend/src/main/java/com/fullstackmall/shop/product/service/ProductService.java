package com.fullstackmall.shop.product.service;

import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.product.dto.ProductDetailDTO;
import com.fullstackmall.shop.product.dto.ProductListRequest;
import com.fullstackmall.shop.product.dto.ProductSummaryDTO;

/**
 * 商品读服务：列表分页与详情。
 */
public interface ProductService {

    /**
     * 分页查询上架商品，支持关键词模糊、分类过滤与排序白名单。
     * categoryId 不存在时返回空分页而非报错。
     */
    PageResult<ProductSummaryDTO> pageProducts(ProductListRequest request);

    /**
     * 查询上架商品详情；不存在或已下架统一抛 {@code PRODUCT_NOT_FOUND}。
     */
    ProductDetailDTO getDetail(Long id);
}
