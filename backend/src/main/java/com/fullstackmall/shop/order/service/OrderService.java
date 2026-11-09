package com.fullstackmall.shop.order.service;

import com.fullstackmall.shop.order.dto.CreateOrderRequest;
import com.fullstackmall.shop.order.dto.OrderDTO;

import java.util.List;

/**
 * 订单业务。归属边界：查询/取消仅限本人订单，他人订单按 404 处理防探测。
 */
public interface OrderService {

    /**
     * 下单（CART 购物车结算 / DIRECT 寄卖直购）：
     * 单一事务——快照明细 + 条件扣库存（行数 0 即回滚）+ CART 清购物车行 + 建支付单(CREATED)。
     */
    OrderDTO create(CreateOrderRequest req);

    /** 本人订单列表（先批量惰性关单再过滤）；status 可空查全部 */
    List<OrderDTO> list(String status);

    /**
     * 订单详情（仅本人）；触发惰性关单（超时未支付 → CANCELLED + 还库存）。
     *
     * @throws com.fullstackmall.shop.common.BusinessException ORDER_NOT_FOUND 不存在或属于他人
     */
    OrderDTO detail(Long id);

    /**
     * 主动取消（PENDING_PAYMENT → CANCELLED + 还库存）；其他状态抛 ORDER_STATE_ILLEGAL。
     */
    void cancel(Long id);
}
