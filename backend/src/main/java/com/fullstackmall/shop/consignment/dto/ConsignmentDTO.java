package com.fullstackmall.shop.consignment.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 寄卖单出参：images 已从 JSON 列解析为数组。
 */
@Data
public class ConsignmentDTO {

    private Long id;
    private String brand;
    private String title;
    private Long categoryId;
    private String conditionGrade;
    private String size;
    private List<String> images;
    private String description;
    private BigDecimal expectedPrice;
    private BigDecimal platformPrice;
    private BigDecimal commissionRate;
    private String status;
    private String rejectReason;
    private Long listedProductId;
    private LocalDateTime createTime;
}
