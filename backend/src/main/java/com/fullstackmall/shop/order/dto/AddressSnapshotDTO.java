package com.fullstackmall.shop.order.dto;

import lombok.Data;

/**
 * 地址快照出参（下单瞬间定格，与地址簿后续变更无关）。
 */
@Data
public class AddressSnapshotDTO {

    private String receiverName;
    private String phone;
    private String province;
    private String city;
    private String district;
    private String detail;
}
