package com.fullstackmall.shop.cart.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.fullstackmall.shop.cart.entity.CartItem;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CartItemMapper extends BaseMapper<CartItem> {
}
