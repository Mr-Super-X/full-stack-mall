package com.fullstackmall.shop.product.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.product.dto.CategoryTreeDTO;
import com.fullstackmall.shop.product.entity.ProductCategory;
import com.fullstackmall.shop.product.mapper.ProductCategoryMapper;
import com.fullstackmall.shop.product.service.CategoryService;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class CategoryServiceImpl implements CategoryService {

    private final ProductCategoryMapper categoryMapper;

    public CategoryServiceImpl(ProductCategoryMapper categoryMapper) {
        this.categoryMapper = categoryMapper;
    }

    @Override
    public List<CategoryTreeDTO> tree() {
        List<ProductCategory> categories = categoryMapper.selectList(
                Wrappers.<ProductCategory>lambdaQuery()
                        .eq(ProductCategory::getStatus, 1)
                        .orderByAsc(ProductCategory::getSort)
                        .orderByAsc(ProductCategory::getId));

        // 两级结构：先按 parentId 聚合二级节点，再顺序组装一级根节点
        Map<Long, List<CategoryTreeDTO>> childrenMap = new HashMap<>();
        for (ProductCategory category : categories) {
            if (category.getParentId() != 0) {
                childrenMap.computeIfAbsent(category.getParentId(), key -> new ArrayList<>())
                        .add(toDTO(category));
            }
        }
        List<CategoryTreeDTO> roots = new ArrayList<>();
        for (ProductCategory category : categories) {
            if (category.getParentId() == 0) {
                CategoryTreeDTO root = toDTO(category);
                root.setChildren(childrenMap.getOrDefault(category.getId(), List.of()));
                roots.add(root);
            }
        }
        return roots;
    }

    @Override
    public List<CategoryTreeDTO> levelOne() {
        return tree().stream()
                .peek(root -> root.setChildren(null))
                .toList();
    }

    private CategoryTreeDTO toDTO(ProductCategory category) {
        CategoryTreeDTO dto = new CategoryTreeDTO();
        BeanUtils.copyProperties(category, dto);
        return dto;
    }
}
