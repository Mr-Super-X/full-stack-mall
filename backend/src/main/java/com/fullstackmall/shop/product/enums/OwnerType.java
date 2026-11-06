package com.fullstackmall.shop.product.enums;

/**
 * 货源类型：PLATFORM 自营 / CONSIGNMENT 寄卖（C2C）。
 * 这是转卖商城的根字段：寄卖商品库存恒 1、带卖家与成色，自营才有库存池。
 */
public enum OwnerType {
    PLATFORM,
    CONSIGNMENT
}
