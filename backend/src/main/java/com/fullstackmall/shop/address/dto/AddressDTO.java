package com.fullstackmall.shop.address.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 地址出参（下单时快照进订单 addressSnapshot 的来源）。
 */
@Data
public class AddressDTO {

    private Long id;
    private String receiverName;
    private String phone;
    private String province;
    private String city;
    private String district;
    private String detail;
    private Boolean isDefault;
    private LocalDateTime createTime;
}
