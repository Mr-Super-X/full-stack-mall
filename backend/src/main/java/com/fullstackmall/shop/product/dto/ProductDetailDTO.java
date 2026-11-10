package com.fullstackmall.shop.product.dto;

import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 商品详情出参：卡片字段 + 详情页专属字段。
 * 库存/价格粒度在 items（规格）上；寄卖商品 items 恒 1 条且带成色。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class ProductDetailDTO extends ProductSummaryDTO {

    private Long categoryId;

    /** 寄卖商品卖家 id，前端卖家卡片用（卖家信息展示为阶段 2 寄卖插件） */
    private Long sellerId;

    private String detailHtml;

    private LocalDateTime createTime;

    /** 全部在售规格，按 price 升序 */
    private List<ProductItemDTO> items;

    /** 图片 URL 列表，按 sort 升序（首图即主图） */
    private List<String> images;

    /** 生效中的秒杀活动（saleMode=SECKILL 且窗口内才非空）；详情页插件渲染倒计时/进度用 */
    private com.fullstackmall.shop.seckill.dto.SeckillActiveDTO.SeckillActivityDTO activeSeckill;
}
