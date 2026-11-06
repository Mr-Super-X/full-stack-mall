package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.product.dto.CategoryTreeDTO;
import com.fullstackmall.shop.product.service.CategoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 商品分类查询接口（无需登录）。
 */
@RestController
@RequestMapping("/mall/product/category")
public class CategoryController {

    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping("/tree")
    public Result<List<CategoryTreeDTO>> tree() {
        return Result.success(categoryService.tree());
    }
}
