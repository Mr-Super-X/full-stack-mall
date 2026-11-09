package com.fullstackmall.shop.cart.service;

import com.fullstackmall.shop.cart.dto.AddCartItemRequest;
import com.fullstackmall.shop.cart.dto.CartItemDTO;
import com.fullstackmall.shop.cart.dto.UpdateCartItemRequest;

import java.util.List;

/**
 * 购物车业务：仅自营商品可入；寄卖商品（库存恒 1）加购抛 CONSIGNMENT_DIRECT_ONLY。
 * 归属边界：全部操作限定当前登录用户，他人条目按 404 处理防探测。
 */
public interface CartService {

    /** 本人购物车列表 + 实时商品信息 + invalid 失效标记（下架或缺货） */
    List<CartItemDTO> list();

    /**
     * 加购；uk(user, productItem) 已存在则数量叠加。
     *
     * @throws com.fullstackmall.shop.common.BusinessException CONSIGNMENT_DIRECT_ONLY 寄卖商品
     */
    CartItemDTO add(AddCartItemRequest req);

    /**
     * 修改数量/选中态；仅本人可操作。
     *
     * @throws com.fullstackmall.shop.common.BusinessException CART_ITEM_NOT_FOUND 不存在或属于他人
     */
    CartItemDTO update(Long id, UpdateCartItemRequest req);

    /**
     * 删除条目；仅本人可操作。
     *
     * @throws com.fullstackmall.shop.common.BusinessException CART_ITEM_NOT_FOUND 不存在或属于他人
     */
    void remove(Long id);
}
