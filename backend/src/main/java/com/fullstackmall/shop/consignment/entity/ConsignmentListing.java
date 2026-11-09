package com.fullstackmall.shop.consignment.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fullstackmall.shop.consignment.enums.ConsignmentStatus;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 寄卖单实体：本项目的灵魂表。与 Product 是两个实体——审核历史留在寄卖单，
 * 卖家确认定价那一刻才"铸造"出 Product（accept 时写 listedProductId）。
 * images 为 JSON 列，Java 侧用 String 承载（Service 层 Jackson 序列化/解析）。
 */
@Data
@TableName("consignment_listing")
public class ConsignmentListing {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long sellerId;

    /** 分类（铸造 product 用，product.category_id NOT NULL） */
    private Long categoryId;

    private String brand;

    private String title;

    private String size;

    /** 成色：寄卖必填（LIKE_NEW/GOOD/FAIR；全新物品请走自营） */
    private ConditionGrade conditionGrade;

    /** 图床 URL 数组的 JSON 字符串（MVP 不做真实上传） */
    private String images;

    private String description;

    private BigDecimal expectedPrice;

    private BigDecimal platformPrice;

    /** 抽佣百分比，如 15.00 表示 15% */
    private BigDecimal commissionRate;

    private ConsignmentStatus status;

    private String rejectReason;

    private Long listedProductId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
