package com.fullstackmall.shop.product.dto;

import lombok.Data;

import java.util.List;

/**
 * 分类树节点：两级结构，children 仅一级分类节点填充。
 */
@Data
public class CategoryTreeDTO {

    private Long id;
    private Long parentId;
    private String name;
    private String icon;
    private List<CategoryTreeDTO> children;
}
