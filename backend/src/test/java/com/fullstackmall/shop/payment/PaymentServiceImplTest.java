package com.fullstackmall.shop.payment;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.enums.OrderType;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.payment.dto.NotifyRequest;
import com.fullstackmall.shop.payment.entity.Payment;
import com.fullstackmall.shop.payment.enums.PayChannel;
import com.fullstackmall.shop.payment.enums.PaymentStatus;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.payment.provider.FakePaymentProvider;
import com.fullstackmall.shop.payment.service.PaymentService;
import com.fullstackmall.shop.payment.service.impl.PaymentServiceImpl;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * PaymentServiceImpl.notify 真逻辑单测：幂等四件套（验签/查库/状态机单向/金额校验）
 * + PAID 条件迁移守护 sales 累加（重复回调不重复计数）。
 * FakePaymentProvider 用真实实例（md5 验签是真实行为，不 mock）。
 */
@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    private static final String SECRET = "test-payment-secret";

    @Mock
    private PaymentMapper paymentMapper;
    @Mock
    private OrderMapper orderMapper;
    @Mock
    private OrderItemMapper orderItemMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductMapper productMapper;
    @Mock
    private com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper consignmentListingMapper;

    private PaymentService paymentService;
    private FakePaymentProvider fakeProvider;

    @BeforeEach
    void setUp() {
        fakeProvider = new FakePaymentProvider(SECRET);
        paymentService = new PaymentServiceImpl(
                paymentMapper, orderMapper, orderItemMapper, productItemMapper, productMapper,
                fakeProvider, consignmentListingMapper);
    }

    @Test
    void duplicateCallbackOnSuccessPayment_shouldReturnIdempotentWithoutReprocessing() {
        Payment success = payment(PaymentStatus.SUCCESS);
        given(paymentMapper.selectOne(any())).willReturn(success);

        Map<String, Object> result = paymentService.notify(notifyReq(success));

        assertThat(result.get("success")).isEqualTo(true);
        assertThat(String.valueOf(result.get("message"))).contains("重复");
        // 不重复推进订单与销量
        verify(orderMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
        verify(productMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void callbackAmountMismatch_shouldReturn400WithoutAdvancing() {
        Payment created = payment(PaymentStatus.CREATED);
        given(paymentMapper.selectOne(any())).willReturn(created);
        NotifyRequest req = notifyReq(created);
        // 篡改金额但签名按篡改后金额重签（验签通过）——真正命中"金额校验"路径而非验签失败
        req.setAmount(new BigDecimal("1.00"));
        req.setSign(fakeProvider.sign(created.getPaymentNo(), new BigDecimal("1.00")));

        assertThatThrownBy(() -> paymentService.notify(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
        verify(orderMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void invalidSignature_shouldReturn400() {
        Payment created = payment(PaymentStatus.CREATED);
        NotifyRequest req = notifyReq(created);
        req.setSign("forged-sign");

        assertThatThrownBy(() -> paymentService.notify(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
        verify(paymentMapper, never()).selectOne(any());
    }

    @Test
    void normalCallback_shouldMarkSuccessAndAccumulateSales() {
        Payment created = payment(PaymentStatus.CREATED);
        given(paymentMapper.selectOne(any())).willReturn(created);
        Order pending = order(OrderStatus.PENDING_PAYMENT);
        given(orderMapper.selectById(created.getOrderId())).willReturn(pending);
        // 支付单迁移成功 + 订单 PAID 条件迁移成功（行数 1）
        given(paymentMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        OrderItem line = new OrderItem();
        line.setProductItemId(1L);
        line.setQuantity(2);
        given(orderItemMapper.selectList(any())).willReturn(List.of(line));
        ProductItem item = new ProductItem();
        item.setId(1L);
        item.setProductId(1L);
        given(productItemMapper.selectById(1L)).willReturn(item);

        Map<String, Object> result = paymentService.notify(notifyReq(created));

        assertThat(result.get("success")).isEqualTo(true);
        // 销量累加被调用（sales + 2）
        verify(productMapper).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void duplicateAdvanceWhenOrderPaid_shouldSkipSalesAccumulation() {
        Payment created = payment(PaymentStatus.CREATED);
        given(paymentMapper.selectOne(any())).willReturn(created);
        given(orderMapper.selectById(created.getOrderId())).willReturn(order(OrderStatus.PENDING_PAYMENT));
        given(paymentMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        // 订单 PAID 条件迁移命中 0 行（并发回调已推进过）
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        paymentService.notify(notifyReq(created));

        // 防重复计数：迁移失败不累加销量
        verify(productMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void callbackOnCancelledOrder_shouldReject() {
        Payment created = payment(PaymentStatus.CREATED);
        given(paymentMapper.selectOne(any())).willReturn(created);
        given(orderMapper.selectById(created.getOrderId())).willReturn(order(OrderStatus.CANCELLED));

        assertThatThrownBy(() -> paymentService.notify(notifyReq(created)))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.PAYMENT_STATE_ILLEGAL);
        verify(paymentMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    // ── Task 1（阶段 3）：售出联动（订单 PAID → 寄卖单 SOLD） ──────────

    @Test
    void paymentSuccess_shouldTransitionConsignmentLineToSold() {
        Payment created = payment(PaymentStatus.CREATED);
        given(paymentMapper.selectOne(any())).willReturn(created);
        given(orderMapper.selectById(created.getOrderId())).willReturn(order(OrderStatus.PENDING_PAYMENT));
        given(paymentMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        // 寄卖明细（sellerId 非空，寄卖商品 14 的单件）
        OrderItem consignmentLine = new OrderItem();
        consignmentLine.setProductItemId(35L);
        consignmentLine.setSellerId(2L);
        consignmentLine.setQuantity(1);
        given(orderItemMapper.selectList(any())).willReturn(List.of(consignmentLine));
        ProductItem consignmentItem = new ProductItem();
        consignmentItem.setId(35L);
        consignmentItem.setProductId(14L);
        given(productItemMapper.selectById(35L)).willReturn(consignmentItem);
        // 寄卖单迁移成功（LISTED→SOLD）
        given(consignmentListingMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        paymentService.notify(notifyReq(created));

        // 寄卖单迁移被调用：set status=SOLD，条件 listed_product_id=14 AND status=LISTED
        org.mockito.ArgumentCaptor<com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<com.fullstackmall.shop.consignment.entity.ConsignmentListing>> captor =
                org.mockito.ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper.class);
        verify(consignmentListingMapper).update(org.mockito.ArgumentMatchers.isNull(), captor.capture());
        assertThat(captor.getValue().getParamNameValuePairs().values()).contains("SOLD");
    }

    @Test
    void consignmentTransitionZeroRows_shouldTolerateIdempotently() {
        Payment created = payment(PaymentStatus.CREATED);
        given(paymentMapper.selectOne(any())).willReturn(created);
        given(orderMapper.selectById(created.getOrderId())).willReturn(order(OrderStatus.PENDING_PAYMENT));
        given(paymentMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        OrderItem consignmentLine = new OrderItem();
        consignmentLine.setProductItemId(35L);
        consignmentLine.setSellerId(2L);
        consignmentLine.setQuantity(1);
        given(orderItemMapper.selectList(any())).willReturn(List.of(consignmentLine));
        ProductItem consignmentItem = new ProductItem();
        consignmentItem.setId(35L);
        consignmentItem.setProductId(14L);
        given(productItemMapper.selectById(35L)).willReturn(consignmentItem);
        // 并发场景：寄卖单已被另一请求迁移（行数 0）——幂等容忍，不得炸主流程
        given(consignmentListingMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        Map<String, Object> result = paymentService.notify(notifyReq(created));

        assertThat(result.get("success")).isEqualTo(true);
    }

    // ── 终审 fix pass ─────────────────────────────────────────

    @Test
    void failedCallback_shouldMarkFailedNotSuccess() {
        Payment paying = payment(PaymentStatus.PAYING);
        given(paymentMapper.selectOne(any())).willReturn(paying);
        given(paymentMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        // step 6 订单检查需要订单存在且未取消
        given(orderMapper.selectById(paying.getOrderId())).willReturn(order(OrderStatus.PENDING_PAYMENT));
        NotifyRequest req = notifyReq(paying);
        req.setSuccess(false); // 失败回调

        Map<String, Object> result = paymentService.notify(req);

        assertThat(result.get("success")).isEqualTo(false);
        // 迁移到 FAILED：UpdateWrapper 值是参数化的（占位符），从参数映射断言含 FAILED
        org.mockito.ArgumentCaptor<com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<Payment>> captor =
                org.mockito.ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper.class);
        verify(paymentMapper).update(org.mockito.ArgumentMatchers.isNull(), captor.capture());
        assertThat(captor.getValue().getParamNameValuePairs().values()).contains("FAILED");
        // 订单不推进
        verify(orderMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void queryOthersPaymentStatus_shouldThrow404() {
        com.fullstackmall.shop.user.context.UserContext.set(
                new com.fullstackmall.shop.user.context.LoginUser(3L, "buyer", "USER"));
        try {
            Payment payment = payment(PaymentStatus.PAYING);
            given(paymentMapper.selectOne(any())).willReturn(payment);
            // 归属双条件查询返回空（支付单属于他人）
            given(orderMapper.selectOne(any())).willReturn(null);

            assertThatThrownBy(() -> paymentService.status(payment.getPaymentNo()))
                    .isInstanceOf(BusinessException.class)
                    .extracting("resultCode").isEqualTo(ResultCode.PAYMENT_NOT_FOUND);
        } finally {
            com.fullstackmall.shop.user.context.UserContext.clear();
        }
    }

    @Test
    void payExpiredOrder_shouldReject() {
        com.fullstackmall.shop.user.context.UserContext.set(
                new com.fullstackmall.shop.user.context.LoginUser(3L, "buyer", "USER"));
        try {
            Payment created = payment(PaymentStatus.CREATED);
            given(paymentMapper.selectOne(any())).willReturn(created);
            Order expired = order(OrderStatus.PENDING_PAYMENT);
            expired.setExpiredAt(java.time.LocalDateTime.now().minusMinutes(1));
            given(orderMapper.selectOne(any())).willReturn(expired);

            assertThatThrownBy(() -> paymentService.pay(created.getPaymentNo()))
                    .isInstanceOf(BusinessException.class)
                    .extracting("resultCode").isEqualTo(ResultCode.PAYMENT_STATE_ILLEGAL);
        } finally {
            com.fullstackmall.shop.user.context.UserContext.clear();
        }
    }

    // ── 桩与构造 ────────────────────────────────────────────────

    private Payment payment(PaymentStatus status) {
        Payment payment = new Payment();
        payment.setId(1L);
        payment.setPaymentNo("P20261109120000-4821");
        payment.setOrderId(1L);
        payment.setAmount(new BigDecimal("798.00"));
        payment.setProvider(PayChannel.FAKE);
        payment.setStatus(status);
        return payment;
    }

    private Order order(OrderStatus status) {
        Order order = new Order();
        order.setId(1L);
        order.setOrderNo("M20261109120000-4821");
        order.setUserId(3L);
        order.setType(OrderType.NORMAL);
        order.setStatus(status);
        order.setPayAmount(new BigDecimal("798.00"));
        return order;
    }

    private NotifyRequest notifyReq(Payment payment) {
        NotifyRequest req = new NotifyRequest();
        req.setPaymentNo(payment.getPaymentNo());
        req.setTradeNo("FAKE-1700000000000");
        req.setAmount(payment.getAmount());
        req.setSuccess(true);
        req.setSign(fakeProvider.sign(payment.getPaymentNo(), payment.getAmount()));
        return req;
    }
}
