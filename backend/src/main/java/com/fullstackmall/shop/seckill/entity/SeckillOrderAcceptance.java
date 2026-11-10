package com.fullstackmall.shop.seckill.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 秒杀受理登记（spec §5.4）：异步出单受理即落库——重启不丢受理记录，
 * 对照表"少卖数"有据可查（ACCEPTED 且无对应订单 = 少卖）；CREATED/FAILED 由消费者与 DLX 监听器推进。
 */
@Data
@TableName("seckill_order_acceptance")
public class SeckillOrderAcceptance {

    /** 受理订单号（业务主键，Controller 预生成）——字符串主键，INPUT 非自增 */
    @TableId(value = "order_no", type = IdType.INPUT)
    private String orderNo;
    private Long activityId;
    private Long userId;
    /** ACCEPTED 已受理待出单 / CREATED 订单已建 / FAILED 死信登记（库存已回补） */
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
