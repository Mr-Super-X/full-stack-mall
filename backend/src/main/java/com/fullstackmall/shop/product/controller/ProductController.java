package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.product.dto.ProductDetailDTO;
import com.fullstackmall.shop.product.dto.ProductListRequest;
import com.fullstackmall.shop.product.dto.ProductSummaryDTO;
import com.fullstackmall.shop.product.service.ProductService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 商品查询接口（无需登录）。
 */
@RestController
@RequestMapping("/mall/product")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping("/list")
    public Result<PageResult<ProductSummaryDTO>> list(@Valid @ModelAttribute ProductListRequest request) {
        return Result.success(productService.pageProducts(request));
    }

    @GetMapping("/{id}")
    public Result<ProductDetailDTO> detail(@PathVariable Long id) {
        return Result.success(productService.getDetail(id));
    }
}
