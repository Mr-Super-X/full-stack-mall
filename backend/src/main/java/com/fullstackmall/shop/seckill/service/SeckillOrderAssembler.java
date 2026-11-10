package com.fullstackmall.shop.seckill.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.enums.OrderType;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.payment.entity.Payment;
import com.fullstackmall.shop.payment.enums.PayChannel;
import com.fullstackmall.shop.payment.enums.PaymentStatus;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 秒杀建单三步（订单行 / 明细快照 / 支付单）：4a 同步路径与 4b MQ 消费者共用——
 * 两条路径必须落出完全一致的行（对照实验公平性前提，spec §13#10）。
 *
 * orderNo 由调用方传入（异步路径预生成并充当幂等键）；orderNo uk 撞库重试
 * 是同步路径的健壮性职责，由调用方负责（见 SeckillServiceImpl.insertOrderWithRetry），本类单发直插。
 */
@Component
public class SeckillOrderAssembler {

    /** 秒杀单超时关单分钟数（与常规单一致，惰性关单在 OrderServiceImpl 触发） */
    private static final int ORDER_EXPIRE_MINUTES = 15;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final OrderMapper orderMapper;
    private final PaymentMapper paymentMapper;

    public SeckillOrderAssembler(OrderMapper orderMapper, PaymentMapper paymentMapper) {
        this.orderMapper = orderMapper;
        this.paymentMapper = paymentMapper;
    }

    /** 订单行：类型/状态/秒杀价定格/地址快照/超时窗，orderNo 用调用方传入值 */
    public Order insertOrder(Long userId, SeckillActivity activity, Address address, String orderNo) {
        Order order = new Order();
        order.setUserId(userId);
        order.setType(OrderType.SECKILL);
        order.setSeckillActivityId(activity.getId());
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setPayAmount(activity.getSeckillPrice());
        order.setOrderNo(orderNo);
        order.setAddressSnapshot(addressJson(address));
        order.setExpiredAt(LocalDateTime.now().plusMinutes(ORDER_EXPIRE_MINUTES));
        orderMapper.insert(order);
        return order;
    }

    /** 快照行：成交价定格传入价（快照铁律——活动结束/改价不回联） */
    public OrderItem buildLine(ProductItem item, Product product, BigDecimal seckillPrice, String imageUrl) {
        OrderItem line = new OrderItem();
        line.setProductItemId(item.getId());
        line.setPrice(seckillPrice);
        line.setQuantity(1);
        line.setSellerId(null);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("title", product.getName());
        snapshot.put("imageUrl", imageUrl);
        snapshot.put("conditionGrade", item.getConditionGrade() != null ? item.getConditionGrade().name() : null);
        snapshot.put("size", item.getSize());
        snapshot.put("color", item.getColor());
        snapshot.put("brand", product.getBrand());
        snapshot.put("ownerType", product.getOwnerType() != null ? product.getOwnerType().name() : null);
        try {
            line.setItemSnapshot(OBJECT_MAPPER.writeValueAsString(snapshot));
        } catch (Exception e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR);
        }
        return line;
    }

    /** 支付单：CREATED 态 FakeProvider（前端据此发起收银台） */
    public Payment insertPayment(Long orderId, BigDecimal amount) {
        Payment payment = new Payment();
        payment.setPaymentNo(com.fullstackmall.shop.order.service.OrderNoGenerator.paymentNo());
        payment.setOrderId(orderId);
        payment.setAmount(amount);
        payment.setProvider(PayChannel.FAKE);
        payment.setStatus(PaymentStatus.CREATED);
        paymentMapper.insert(payment);
        return payment;
    }

    private String addressJson(Address address) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("receiverName", address.getReceiverName());
            snapshot.put("phone", address.getPhone());
            snapshot.put("province", address.getProvince());
            snapshot.put("city", address.getCity());
            snapshot.put("district", address.getDistrict());
            snapshot.put("detail", address.getDetail());
            return OBJECT_MAPPER.writeValueAsString(snapshot);
        } catch (Exception e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR);
        }
    }
}
