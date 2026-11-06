package com.fullstackmall.shop.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.enums.SaleMode;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 商品表实体：仅映射 product 表，不直接出 Controller（出参用 DTO）。
 * 价格/库存/图片已下沉至 product_item / product_image——寄卖单件（库存恒 1）
 * 与自营多规格统一由 ProductItem 承载；ownerType/saleMode 是两种货源与四种玩法的根字段。
 */
@Data
@TableName("product")
public class Product {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long categoryId;

    private OwnerType ownerType;

    private SaleMode saleMode;

    /** 寄卖商品卖家 user.id；自营为 null */
    private Long sellerId;

    private String brand;

    private String name;

    private String tag;

    private String sellingPoint;

    /** 前端线稿图标 key（mall-g-* 后缀），原型过渡期字段，接真实图后可废弃 */
    private String garm;

    private Integer sales;

    /** 1 上架 0 下架，仅上架商品对外可见 */
    private Integer status;

    private String detailHtml;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
