package com.fullstackmall.shop.payout.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fullstackmall.shop.payout.enums.PayoutStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 卖家结算单：买家确认收货时按寄卖明细生成（钱的两条线——买家付款 ≠ 卖家钱到手）。
 * uk(order_item_id) 唯一约束兜底幂等（重复 confirm 不重复生成）。
 */
@Data
@TableName("payout")
public class Payout {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long sellerId;

    private Long orderItemId;

    /** 卖家应得 = 成交价 × (1 - 抽佣率)，两位小数 */
    private BigDecimal sellerAmount;

    /** 平台抽佣金额（sellerAmount + commission = 成交价 恒等） */
    private BigDecimal commission;

    private PayoutStatus status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
