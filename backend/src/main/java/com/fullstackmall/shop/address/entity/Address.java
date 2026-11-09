package com.fullstackmall.shop.address.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 收货地址实体：仅映射 address 表，不出 Controller（出参用 AddressDTO）。
 */
@Data
@TableName("address")
public class Address {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String receiverName;

    private String phone;

    private String province;

    private String city;

    private String district;

    private String detail;

    /** 1 默认 0 非默认（同用户最多一个默认，由 Service 事务保证互斥） */
    private Integer isDefault;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
