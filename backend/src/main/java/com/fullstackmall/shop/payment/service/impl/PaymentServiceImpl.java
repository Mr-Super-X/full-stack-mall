package com.fullstackmall.shop.payment.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.consignment.enums.ConsignmentStatus;
import com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.payment.dto.NotifyRequest;
import com.fullstackmall.shop.payment.dto.PayResultDTO;
import com.fullstackmall.shop.payment.entity.Payment;
import com.fullstackmall.shop.payment.enums.PaymentStatus;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.payment.provider.PaymentProvider;
import com.fullstackmall.shop.payment.service.PaymentService;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.user.context.UserContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 支付业务实现。幂等语义：
 * - paymentNo 已 SUCCESS → 直接返回（重复回调无害）
 * - 状态机只许 CREATED/PAYING → SUCCESS 单向迁移
 * - 订单 PAID 用条件迁移（PENDING_PAYMENT → PAID），行数 0 说明并发/重复已推进 → 跳过销量累加
 */
@Slf4j
@Service
public class PaymentServiceImpl implements PaymentService {

    private final PaymentMapper paymentMapper;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final ProductItemMapper productItemMapper;
    private final ProductMapper productMapper;
    private final PaymentProvider paymentProvider;
    private final ConsignmentListingMapper consignmentListingMapper;

    public PaymentServiceImpl(PaymentMapper paymentMapper, OrderMapper orderMapper,
                              OrderItemMapper orderItemMapper, ProductItemMapper productItemMapper,
                              ProductMapper productMapper, PaymentProvider paymentProvider,
                              ConsignmentListingMapper consignmentListingMapper) {
        this.paymentMapper = paymentMapper;
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.productItemMapper = productItemMapper;
        this.productMapper = productMapper;
        this.paymentProvider = paymentProvider;
        this.consignmentListingMapper = consignmentListingMapper;
    }

    @Override
    @Transactional
    public PayResultDTO pay(String paymentNo) {
        Long userId = UserContext.getRequired().userId();
        Payment payment = requirePayment(paymentNo);
        // 归属校验：支付单须属于本人订单（他人支付单按 404 防探测）
        Order order = requireOwnedOrder(userId, payment.getOrderId());
        // 过期校验：超过关单时间未支付的订单拒绝发起（防"钱付了单关了"）
        if (order.getExpiredAt() != null && order.getExpiredAt().isBefore(java.time.LocalDateTime.now())) {
            throw new BusinessException(ResultCode.PAYMENT_STATE_ILLEGAL);
        }
        if (payment.getStatus() == PaymentStatus.CREATED) {
            migratePaymentStatus(payment.getId(), PaymentStatus.PAYING, PaymentStatus.CREATED);
            payment.setStatus(PaymentStatus.PAYING);
        } else if (payment.getStatus() != PaymentStatus.PAYING) {
            throw new BusinessException(ResultCode.PAYMENT_STATE_ILLEGAL);
        }
        return new PayResultDTO(paymentNo, paymentProvider.buildPayUrl(payment), payment.getStatus().name());
    }

    @Override
    @Transactional
    public Map<String, Object> notify(NotifyRequest req) {
        // 1. 验签：回调的可信来源是签名而非登录态
        if (!paymentProvider.verifySign(req.getPaymentNo(), req.getAmount(), req.getSign())) {
            log.warn("支付回调验签失败：paymentNo={}", req.getPaymentNo());
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        // 2. 幂等键查库
        Payment payment = paymentMapper.selectOne(Wrappers.<Payment>lambdaQuery()
                .eq(Payment::getPaymentNo, req.getPaymentNo()));
        if (payment == null) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_FOUND);
        }
        // 3. 重复回调幂等：已 SUCCESS 直接返回，不重复推进
        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            return Map.of("success", true, "message", "重复回调已忽略");
        }
        // 4. 状态机单向：仅 CREATED/PAYING 可迁移
        if (payment.getStatus() != PaymentStatus.CREATED && payment.getStatus() != PaymentStatus.PAYING) {
            throw new BusinessException(ResultCode.PAYMENT_STATE_ILLEGAL);
        }
        // 5. 金额校验：回调金额必须等于应付（篡改检测）
        if (payment.getAmount().compareTo(req.getAmount()) != 0) {
            log.warn("支付回调金额不符：paymentNo={}, 应付={}, 回调={}",
                    payment.getPaymentNo(), payment.getAmount(), req.getAmount());
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        // 6. 订单状态检查：已取消（惰性关单后）拒绝推进
        // TODO(Refund v2): 此分支代表"用户已扣款但订单已关"——需退款流水追踪（设计文档 §4.5 钱的两条线）
        Order order = orderMapper.selectById(payment.getOrderId());
        if (order == null) {
            throw new BusinessException(ResultCode.ORDER_NOT_FOUND);
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            log.error("订单已取消但收到支付成功回调（资金黑洞待退款追踪）：orderNo={}, paymentNo={}, amount={}",
                    order.getOrderNo(), payment.getPaymentNo(), payment.getAmount());
            throw new BusinessException(ResultCode.PAYMENT_STATE_ILLEGAL);
        }
        // 7. 按回调结果分流：失败 → FAILED（不得误标成功，否则后续幂等分支会永远返回成功）
        if (!Boolean.TRUE.equals(req.getSuccess())) {
            migratePaymentStatus(payment.getId(), PaymentStatus.FAILED, PaymentStatus.CREATED, PaymentStatus.PAYING);
            return Map.of("success", false, "message", "支付未完成");
        }
        // 8. 迁移：支付单 SUCCESS + 订单 PAID 条件迁移（行数 1 才累加销量，防重复计数）
        migratePaymentStatus(payment.getId(), PaymentStatus.SUCCESS, PaymentStatus.CREATED, PaymentStatus.PAYING);
        if (migrateOrderPaid(order.getId())) {
            accrueSales(order.getId());
            // 售出联动：寄卖明细对应寄卖单 LISTED→SOLD（C2C 状态机闭环，幂等容忍）
            markConsignmentsSold(order.getId());
        }
        return Map.of("success", true);
    }

    @Override
    public PayResultDTO status(String paymentNo) {
        Long userId = UserContext.getRequired().userId();
        Payment payment = requirePayment(paymentNo);
        // 归属校验（终审 CRITICAL 修复）：status 与 pay 同口径——他人支付单按 404 防探测
        requireOwnedOrder(userId, payment.getOrderId());
        return new PayResultDTO(paymentNo, null, payment.getStatus().name());
    }

    private Payment requirePayment(String paymentNo) {
        Payment payment = paymentMapper.selectOne(Wrappers.<Payment>lambdaQuery()
                .eq(Payment::getPaymentNo, paymentNo));
        if (payment == null) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_FOUND);
        }
        return payment;
    }

    /** 归属双条件取订单：id + userId 双条件，查不到按 404（不暴露存在性） */
    private Order requireOwnedOrder(Long userId, Long orderId) {
        Order order = orderMapper.selectOne(Wrappers.<Order>lambdaQuery()
                .eq(Order::getId, orderId)
                .eq(Order::getUserId, userId));
        if (order == null) {
            throw new BusinessException(ResultCode.PAYMENT_NOT_FOUND);
        }
        return order;
    }

    /** 支付单状态条件迁移（字符串列名，同订单/寄卖同范式） */
    private void migratePaymentStatus(Long paymentId, PaymentStatus to, PaymentStatus... from) {
        int rows = paymentMapper.update(null, Wrappers.<Payment>update()
                .set("status", to.name())
                .eq("id", paymentId)
                .in("status", java.util.Arrays.stream(from).map(Enum::name).toList()));
        if (rows == 0) {
            throw new BusinessException(ResultCode.PAYMENT_STATE_ILLEGAL);
        }
    }

    /** 订单 PAID 条件迁移：行数 1 = 本次回调真正推进；0 = 并发/重复已推进（跳过销量防重复计数） */
    private boolean migrateOrderPaid(Long orderId) {
        int rows = orderMapper.update(null, Wrappers.<Order>update()
                .set("status", OrderStatus.PAID.name())
                .eq("id", orderId)
                .eq("status", OrderStatus.PENDING_PAYMENT.name()));
        return rows == 1;
    }

    /** 销量累加：仅订单真正转 PAID 时调用（明细行 × quantity 累加到商品 sales） */
    private void accrueSales(Long orderId) {
        List<OrderItem> lines = orderItemMapper.selectList(Wrappers.<OrderItem>lambdaQuery()
                .eq(OrderItem::getOrderId, orderId));
        for (OrderItem line : lines) {
            ProductItem item = productItemMapper.selectById(line.getProductItemId());
            if (item == null) {
                continue;
            }
            productMapper.update(null, Wrappers.<com.fullstackmall.shop.product.entity.Product>update()
                    .setSql("sales = sales + " + line.getQuantity())
                    .eq("id", item.getProductId()));
        }
    }

    /**
     * 售出联动：订单转 PAID 后，寄卖明细（sellerId 非空）对应寄卖单 LISTED→SOLD。
     * 链路：OrderItem.productItemId → productItem.productId → consignment_listing.listed_product_id。
     * 幂等容忍：条件迁移行数 0（并发已迁/单不存在）只记 debug，不影响支付主流程。
     */
    private void markConsignmentsSold(Long orderId) {
        List<OrderItem> lines = orderItemMapper.selectList(Wrappers.<OrderItem>lambdaQuery()
                .eq(OrderItem::getOrderId, orderId));
        for (OrderItem line : lines) {
            if (line.getSellerId() == null) {
                continue; // 自营明细无寄卖单联动
            }
            ProductItem item = productItemMapper.selectById(line.getProductItemId());
            if (item == null) {
                continue;
            }
            int rows = consignmentListingMapper.update(null,
                    Wrappers.<com.fullstackmall.shop.consignment.entity.ConsignmentListing>update()
                            .set("status", ConsignmentStatus.SOLD.name())
                            .eq("listed_product_id", item.getProductId())
                            .eq("status", ConsignmentStatus.LISTED.name()));
            if (rows == 0) {
                log.debug("寄卖单已售出或不存在，跳过联动：orderId={}, productId={}", orderId, item.getProductId());
            }
        }
    }
}
