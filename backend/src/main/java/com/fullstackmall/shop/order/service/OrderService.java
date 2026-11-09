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
     * 卖家视角订单列表：仅含 OrderItem.sellerId == 当前用户的订单，
     * 且明细行只保留我卖的（不发"我作为买家"的订单）。status 可空查全部，按订单 id desc。
     */
    List<OrderDTO> sold(String status);

    /**
     * 发货（PAID → SHIPPED 条件迁移）。
     * 主体鉴权：订单含寄卖明细（sellerId 非空）必须该卖家本人发（否则 404 防探测）；
     * 全自营订单必须 ADMIN（否则 403）。
     *
     * @throws com.fullstackmall.shop.common.BusinessException ORDER_NOT_FOUND / FORBIDDEN / ORDER_STATE_ILLEGAL
     */
    void ship(Long id);

    /**
     * 确认收货（SHIPPED → COMPLETED 条件迁移），同事务按寄卖明细生成结算单（Payout PENDING）。
     * 佣金率经 orderItem → product → consignment_listing.listed_product_id 回联；
     * uk(order_item_id) 幂等：已存在结算单则跳过（重复 confirm 不重复生成）。
     */
    void confirm(Long id);

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
