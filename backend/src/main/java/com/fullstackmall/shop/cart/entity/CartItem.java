package com.fullstackmall.shop.cart.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 购物车条目实体：uk(user_id, product_item_id)——同一用户同一规格仅一行，重复加购叠加数量。
 * 仅承载自营商品；寄卖商品（库存恒 1）加购被 Service 拦截（CONSIGNMENT_DIRECT_ONLY）。
 */
@Data
@TableName("cart_item")
public class CartItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long productItemId;

    private Integer quantity;

    /** 1 选中（结算范围） 0 未选中 */
    private Integer checked;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
