package com.fullstackmall.shop.payment.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fullstackmall.shop.payment.enums.PayChannel;
import com.fullstackmall.shop.payment.enums.PaymentStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 支付单实体：paymentNo 是回调幂等键（uk）。
 * 买家付款成功 ≠ 卖家钱到手——钱的两条线见 Payout（阶段 3）。
 */
@Data
@TableName("payment")
public class Payment {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 支付流水号：P + yyyyMMddHHmmss + 4 位随机（uk，回调幂等键） */
    private String paymentNo;

    private Long orderId;

    private BigDecimal amount;

    private PayChannel provider;

    private PaymentStatus status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
