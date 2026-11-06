package com.fullstackmall.shop.product.service;

import com.fullstackmall.shop.product.dto.CategoryTreeDTO;

import java.util.List;

/**
 * 分类读服务。
 */
public interface CategoryService {

    /**
     * 全部分类（启用状态）两级树，一级按 sort 升序。
     */
    List<CategoryTreeDTO> tree();

    /**
     * 仅一级分类节点（首页金刚区使用），由 tree() 派生。
     */
    List<CategoryTreeDTO> levelOne();
}
