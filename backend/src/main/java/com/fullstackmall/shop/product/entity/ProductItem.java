package com.fullstackmall.shop.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 商品规格/单件表实体：统一承载自营多规格（S/M/L 多条）与寄卖单件（一条、stock 恒 1）。
 * version 为阶段 2 下单扣减的乐观锁备用字段（MP 乐观锁插件届时再注册）。
 */
@Data
@TableName("product_item")
public class ProductItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long productId;

    /** 尺码/规格；寄卖单件可为 null */
    private String size;

    private String color;

    /** 成色：自营新品 NEW；寄卖商品必填 */
    private ConditionGrade conditionGrade;

    private BigDecimal price;

    private BigDecimal originPrice;

    private Integer stock;

    private Integer version;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
