package com.fullstackmall.shop.product.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * admin 创建自营商品的图片输入。sort 可空——Service 按提交顺序补位（0 为主图）。
 */
@Data
public class AdminProductImageInput {

    @NotBlank(message = "图片 URL 不能为空")
    private String url;

    private Integer sort;
}
