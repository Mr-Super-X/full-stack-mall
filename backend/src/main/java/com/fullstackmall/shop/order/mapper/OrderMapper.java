package com.fullstackmall.shop.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.fullstackmall.shop.order.entity.Order;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.Map;

@Mapper
public interface OrderMapper extends BaseMapper<Order> {

    /**
     * 出单状态轮询（4b）：orders LEFT JOIN payment 一次取回归属校验字段与支付号。
     * Map 键：user_id / payment_no（无支付单时 null）。
     */
    @Select("SELECT o.user_id AS user_id, p.payment_no AS payment_no "
            + "FROM orders o LEFT JOIN payment p ON p.order_id = o.id "
            + "WHERE o.order_no = #{orderNo}")
    Map<String, Object> selectWithPaymentByOrderNo(String orderNo);
}
