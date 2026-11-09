package com.fullstackmall.shop.order.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 订单出参：订单头 + 明细（快照解析后）+ 支付单号。
 */
@Data
public class OrderDTO {

    private Long id;
    private String orderNo;
    private String type;
    private String status;
    private BigDecimal payAmount;
    private LocalDateTime expiredAt;
    private LocalDateTime createTime;

    /** 支付单号（下单同事务创建，前端据此发起支付） */
    private String paymentNo;

    private List<OrderItemDTO> items;

    /** 地址快照（解析后对象） */
    private AddressSnapshotDTO address;
}
