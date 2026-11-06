package com.fullstackmall.shop.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 商品图片表实体：寄卖商品需要多角度成色实拍，故从 product 单字段拆表。
 * sort=0 为主图。
 */
@Data
@TableName("product_image")
public class ProductImage {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long productId;

    private String url;

    private Integer sort;

    private LocalDateTime createTime;
}
