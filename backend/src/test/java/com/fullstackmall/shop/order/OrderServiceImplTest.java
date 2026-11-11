package com.fullstackmall.shop.order;

import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.cart.entity.CartItem;
import com.fullstackmall.shop.cart.mapper.CartItemMapper;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.dto.CreateOrderRequest;
import com.fullstackmall.shop.order.dto.OrderDTO;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.order.service.OrderService;
import com.fullstackmall.shop.order.service.impl.OrderServiceImpl;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.enums.SaleMode;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.context.UserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * OrderServiceImpl.create 真逻辑单测（CART 模式）：
 * 快照铁律、条件扣库存回滚、清购物车行、支付单创建、订单号生成。
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceImplTest {

    @Mock
    private OrderMapper orderMapper;
    @Mock
    private OrderItemMapper orderItemMapper;
    @Mock
    private CartItemMapper cartItemMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductMapper productMapper;
    @Mock
    private ProductImageMapper productImageMapper;
    @Mock
    private PaymentMapper paymentMapper;
    @Mock
    private AddressMapper addressMapper;
    @Mock
    private com.fullstackmall.shop.payout.mapper.PayoutMapper payoutMapper;
    @Mock
    private com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper consignmentListingMapper;
    @Mock
    private com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper seckillActivityMapper;
    @Mock
    private com.fullstackmall.shop.seckill.service.RedisStockDeductor redisStockDeductor;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderServiceImpl(orderMapper, orderItemMapper, cartItemMapper,
                productItemMapper, productMapper, productImageMapper, paymentMapper, addressMapper,
                payoutMapper, consignmentListingMapper, seckillActivityMapper,
                new com.fullstackmall.shop.seckill.service.SeckillProperties(),
                redisStockDeductor);
        UserContext.set(new LoginUser(3L, "buyer", "USER"));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void seckillOrderTimeoutClose_shouldReplenishSeckillPoolOnly() {
        Order expired = new Order();
        expired.setId(7L);
        expired.setUserId(3L);
        expired.setType(com.fullstackmall.shop.order.enums.OrderType.SECKILL);
        expired.setSeckillActivityId(9L);
        expired.setStatus(OrderStatus.PENDING_PAYMENT);
        expired.setExpiredAt(java.time.LocalDateTime.now().minusMinutes(1));
        given(orderMapper.selectList(any())).willReturn(List.of(expired));
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        given(seckillActivityMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        orderService.list(null);

        // 秒杀单回补独立池（sold_count - 1，条件 sold_count > 0 防负）
        verify(seckillActivityMapper).update(org.mockito.ArgumentMatchers.isNull(), any());
        // 常规库存不动
        verify(productItemMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void normalOrderTimeoutClose_shouldReplenishNormalStockOnly() {
        Order expired = new Order();
        expired.setId(8L);
        expired.setUserId(3L);
        expired.setType(com.fullstackmall.shop.order.enums.OrderType.NORMAL);
        expired.setStatus(OrderStatus.PENDING_PAYMENT);
        expired.setExpiredAt(java.time.LocalDateTime.now().minusMinutes(1));
        given(orderMapper.selectList(any())).willReturn(List.of(expired));
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        com.fullstackmall.shop.order.entity.OrderItem line = new com.fullstackmall.shop.order.entity.OrderItem();
        line.setProductItemId(36L);
        line.setQuantity(2);
        given(orderItemMapper.selectList(any())).willReturn(List.of(line));
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        orderService.list(null);

        verify(productItemMapper).update(org.mockito.ArgumentMatchers.isNull(), any());
        verify(seckillActivityMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void cartCheckoutSuccess_shouldWriteOrderDeductStockClearCartAndCreatePayment() {
        given(cartItemMapper.selectList(any())).willReturn(List.of(cartRow(1L, 1L, 2)));
        given(addressMapper.selectOne(any())).willReturn(address());
        given(productItemMapper.selectBatchIds(any())).willReturn(List.of(platformItem(1L, 200, "399.00")));
        given(productMapper.selectBatchIds(any())).willReturn(List.of(platformProduct()));
        given(productImageMapper.selectList(any())).willReturn(
                List.of(mainImage(1L, "https://img.example/p1.jpg")));
        // 条件扣库存成功（影响 1 行）
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        OrderDTO result = orderService.create(cartRequest());

        // 订单号 M 开头；支付单号 P 开头；金额 = 399 × 2
        assertThat(result.getOrderNo()).startsWith("M");
        assertThat(result.getPaymentNo()).startsWith("P");
        assertThat(result.getPayAmount()).isEqualByComparingTo("798.00");

        // 三写：订单 + 明细 + 支付单
        verify(orderMapper).insert(any(Order.class));
        ArgumentCaptor<com.fullstackmall.shop.order.entity.OrderItem> itemCaptor =
                ArgumentCaptor.forClass(com.fullstackmall.shop.order.entity.OrderItem.class);
        verify(orderItemMapper).insert(itemCaptor.capture());
        assertThat(itemCaptor.getValue().getItemSnapshot()).contains("陶土色垂感风衣");
        assertThat(itemCaptor.getValue().getItemSnapshot()).contains("https://img.example/p1.jpg");
        assertThat(itemCaptor.getValue().getPrice()).isEqualByComparingTo("399.00");
        verify(paymentMapper).insert(any(com.fullstackmall.shop.payment.entity.Payment.class));

        // 清购物车行
        verify(cartItemMapper).deleteBatchIds(any());
    }

    @Test
    void insufficientStock_shouldRollbackAndNotWriteOrder() {
        given(cartItemMapper.selectList(any())).willReturn(List.of(cartRow(1L, 1L, 2)));
        given(addressMapper.selectOne(any())).willReturn(address());
        given(productItemMapper.selectBatchIds(any())).willReturn(List.of(platformItem(1L, 1, "399.00")));
        given(productMapper.selectBatchIds(any())).willReturn(List.of(platformProduct()));
        // 条件扣库存命中 0 行（stock 1 < 2）
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        assertThatThrownBy(() -> orderService.create(cartRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.STOCK_NOT_ENOUGH);

        verify(orderMapper, never()).insert(any(Order.class));
        verify(paymentMapper, never()).insert(any(com.fullstackmall.shop.payment.entity.Payment.class));
        verify(cartItemMapper, never()).deleteBatchIds(any());
    }

    @Test
    void cartCheckoutWithOthersItem_shouldThrow404() {
        given(addressMapper.selectOne(any())).willReturn(address());
        // 归属双条件查询只返回部分行（其余属于他人）
        given(cartItemMapper.selectList(any())).willReturn(List.of());

        assertThatThrownBy(() -> orderService.create(cartRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.CART_ITEM_NOT_FOUND);
    }

    @Test
    void addressNotOwned_shouldThrow404() {
        given(addressMapper.selectOne(any())).willReturn(null);

        assertThatThrownBy(() -> orderService.create(cartRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ADDRESS_NOT_FOUND);
    }

    @Test
    void cartCheckoutMissingItems_shouldThrowBadRequest() {
        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.CART);
        // cartItemIds 缺失

        assertThatThrownBy(() -> orderService.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    // ── Task 3：DIRECT 寄卖直购 ─────────────────────────────────

    @Test
    void consignmentDirectBuySuccess_shouldSetQuantityOneAndSnapshotSeller() {
        given(addressMapper.selectOne(any())).willReturn(address());
        ProductItem consignmentItem = platformItem(33L, 1, "12800.00");
        consignmentItem.setProductId(14L);
        given(productItemMapper.selectById(33L)).willReturn(consignmentItem);
        Product consignment = platformProduct();
        consignment.setId(14L);
        consignment.setOwnerType(OwnerType.CONSIGNMENT);
        consignment.setSellerId(2L);
        given(productMapper.selectById(14L)).willReturn(consignment);
        given(productImageMapper.selectList(any())).willReturn(
                List.of(mainImage(14L, "https://img.example/p14.jpg")));
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.DIRECT);
        req.setProductItemId(33L);

        OrderDTO result = orderService.create(req);

        assertThat(result.getType()).isEqualTo("NORMAL");
        assertThat(result.getPayAmount()).isEqualByComparingTo("12800.00");
        ArgumentCaptor<com.fullstackmall.shop.order.entity.OrderItem> itemCaptor =
                ArgumentCaptor.forClass(com.fullstackmall.shop.order.entity.OrderItem.class);
        verify(orderItemMapper).insert(itemCaptor.capture());
        assertThat(itemCaptor.getValue().getQuantity()).isEqualTo(1);
        assertThat(itemCaptor.getValue().getSellerId()).isEqualTo(2L);
        verify(paymentMapper).insert(any(com.fullstackmall.shop.payment.entity.Payment.class));
    }

    @Test
    void directBuySelfOperatedItem_shouldThrowBadRequest() {
        given(addressMapper.selectOne(any())).willReturn(address());
        given(productItemMapper.selectById(1L)).willReturn(platformItem(1L, 200, "399.00"));
        given(productMapper.selectById(1L)).willReturn(platformProduct());

        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.DIRECT);
        req.setProductItemId(1L);

        assertThatThrownBy(() -> orderService.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    @Test
    void directBuySoldConsignment_shouldThrowStockNotEnough() {
        given(addressMapper.selectOne(any())).willReturn(address());
        ProductItem soldOutItem = platformItem(33L, 0, "12800.00");
        soldOutItem.setProductId(14L);
        given(productItemMapper.selectById(33L)).willReturn(soldOutItem);
        Product consignment = platformProduct();
        consignment.setId(14L);
        consignment.setOwnerType(OwnerType.CONSIGNMENT);
        consignment.setSellerId(2L);
        given(productMapper.selectById(14L)).willReturn(consignment);
        // 条件扣库存命中 0 行（stock 0 < 1）
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.DIRECT);
        req.setProductItemId(33L);

        assertThatThrownBy(() -> orderService.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.STOCK_NOT_ENOUGH);
        verify(orderMapper, never()).insert(any(Order.class));
    }

    // ── Task 4：查询 / 惰性关单 / cancel ────────────────────────

    @Test
    void queryExpiredOrder_shouldMarkCancelledAndReplenishStock() {
        Order expired = order(1L, OrderStatus.PENDING_PAYMENT, java.time.LocalDateTime.now().minusMinutes(20));
        given(orderMapper.selectOne(any())).willReturn(expired);
        // 条件迁移 CANCELLED 成功
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        given(orderItemMapper.selectList(any())).willReturn(List.of(orderLine(1L, 2)));
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        OrderDTO result = orderService.detail(1L);

        assertThat(result.getStatus()).isEqualTo("CANCELLED");
        // 库存回补被调用（stock + 2）
        verify(productItemMapper, atLeastOnce()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void queryUnexpiredOrder_shouldNotClose() {
        Order fresh = order(1L, OrderStatus.PENDING_PAYMENT, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectOne(any())).willReturn(fresh);
        given(orderItemMapper.selectList(any())).willReturn(List.of(orderLine(1L, 2)));

        OrderDTO result = orderService.detail(1L);

        assertThat(result.getStatus()).isEqualTo("PENDING_PAYMENT");
        verify(orderMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void cancelPaidOrder_shouldThrowIllegalTransition() {
        given(orderMapper.selectOne(any()))
                .willReturn(order(1L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10)));

        assertThatThrownBy(() -> orderService.cancel(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_STATE_ILLEGAL);
    }

    @Test
    void cancelPendingOrderSuccess_shouldReplenishStock() {
        Order pending = order(1L, OrderStatus.PENDING_PAYMENT, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectOne(any())).willReturn(pending);
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        given(orderItemMapper.selectList(any())).willReturn(List.of(orderLine(1L, 2)));
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        orderService.cancel(1L);

        verify(productItemMapper, atLeastOnce()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void queryOthersOrder_shouldThrow404() {
        given(orderMapper.selectOne(any())).willReturn(null);

        assertThatThrownBy(() -> orderService.detail(9L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_NOT_FOUND);
    }

    // ── Task 2（阶段 3）：卖家订单列表 ────────────────────────────

    @Test
    void sellerOrderList_shouldOnlyContainMySoldOrdersAndLines() {
        // 我卖的寄卖明细（sellerId=3，寄卖 DIRECT 单）
        com.fullstackmall.shop.order.entity.OrderItem myLine = orderLine(35L, 1);
        myLine.setOrderId(2L);
        myLine.setSellerId(3L);
        myLine.setItemSnapshot("{\"title\":\"中古 Chanel CF\"}");
        given(orderItemMapper.selectList(any())).willReturn(List.of(myLine));
        Order myOrder = order(2L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectBatchIds(any())).willReturn(List.of(myOrder));
        // 自营订单（sellerId 全 null）不在我卖查询结果——selectList(eq sellerId=3) 只返回我的行

        List<OrderDTO> result = orderService.sold(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo(2L);
        assertThat(result.get(0).getItems()).hasSize(1);
        assertThat(result.get(0).getItems().get(0).getSellerId()).isEqualTo(3L);
        // 查询参数只含我卖订单 id（captor 断言 selectBatchIds 只查 [2]）
        org.mockito.ArgumentCaptor<java.util.Collection<Long>> idsCaptor =
                org.mockito.ArgumentCaptor.forClass(java.util.Collection.class);
        verify(orderMapper).selectBatchIds(idsCaptor.capture());
        assertThat(idsCaptor.getValue()).containsExactly(2L);
    }

    @Test
    void sellerOrders_shouldFilterByStatus() {
        com.fullstackmall.shop.order.entity.OrderItem lineA = orderLine(35L, 1);
        lineA.setOrderId(2L);
        lineA.setSellerId(3L);
        com.fullstackmall.shop.order.entity.OrderItem lineB = orderLine(36L, 1);
        lineB.setOrderId(3L);
        lineB.setSellerId(3L);
        given(orderItemMapper.selectList(any())).willReturn(List.of(lineA, lineB));
        Order paidOrder = order(2L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10));
        Order pendingOrder = order(3L, OrderStatus.PENDING_PAYMENT, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectBatchIds(any())).willReturn(List.of(paidOrder, pendingOrder));

        List<OrderDTO> result = orderService.sold("PAID");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo("PAID");
    }

    @Test
    void sellerOrders_shouldReturnEmptyListWhenNoSales() {
        given(orderItemMapper.selectList(any())).willReturn(List.of());

        List<OrderDTO> result = orderService.sold(null);

        assertThat(result).isEmpty();
    }

    // ── Task 3（阶段 3）：发货（主体鉴权 + 状态迁移） ────────────

    @Test
    void sellerShipOwnConsignment_shouldSucceedAndMarkShipped() {
        Order paid = order(1L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectById(1L)).willReturn(paid);
        com.fullstackmall.shop.order.entity.OrderItem myConsignment = orderLine(35L, 1);
        myConsignment.setSellerId(3L); // 当前用户(buyer id=3)即卖家
        given(orderItemMapper.selectList(any())).willReturn(List.of(myConsignment));
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        orderService.ship(1L);

        verify(orderMapper).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void nonSellerShipConsignment_shouldThrow404() {
        // 寄卖件属于卖家 B（sellerId=2），当前用户是买家（id=3）或其他卖家 A
        Order paid = order(1L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectById(1L)).willReturn(paid);
        com.fullstackmall.shop.order.entity.OrderItem othersConsignment = orderLine(35L, 1);
        othersConsignment.setSellerId(2L);
        given(orderItemMapper.selectList(any())).willReturn(List.of(othersConsignment));

        assertThatThrownBy(() -> orderService.ship(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_NOT_FOUND);
    }

    @Test
    void normalUserShipSelfOperatedItem_shouldThrow403() {
        Order paid = order(1L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectById(1L)).willReturn(paid);
        com.fullstackmall.shop.order.entity.OrderItem platformLine = orderLine(1L, 1);
        platformLine.setSellerId(null); // 自营件
        given(orderItemMapper.selectList(any())).willReturn(List.of(platformLine));

        assertThatThrownBy(() -> orderService.ship(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.FORBIDDEN);
    }

    @Test
    void adminShipSelfOperatedItem_shouldSucceedAndMarkShipped() {
        UserContext.set(new LoginUser(1L, "admin", "ADMIN"));
        Order paid = order(1L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectById(1L)).willReturn(paid);
        com.fullstackmall.shop.order.entity.OrderItem platformLine = orderLine(1L, 1);
        platformLine.setSellerId(null);
        given(orderItemMapper.selectList(any())).willReturn(List.of(platformLine));
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        orderService.ship(1L);

        verify(orderMapper).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void shipUnpaidOrder_shouldThrowIllegalTransition() {
        // 并发/重复发货语义：条件迁移 WHERE status='PAID' 命中 0 行
        Order pending = order(1L, OrderStatus.PENDING_PAYMENT, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectById(1L)).willReturn(pending);
        com.fullstackmall.shop.order.entity.OrderItem line = orderLine(35L, 1);
        line.setSellerId(3L);
        given(orderItemMapper.selectList(any())).willReturn(List.of(line));
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        assertThatThrownBy(() -> orderService.ship(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_STATE_ILLEGAL);
    }

    // ── Task 4（阶段 3）：确认收货 + Payout 生成 ──────────────────

    @Test
    void confirmReceipt_shouldCreatePayoutAndSplitIdentically() {
        Order shipped = order(1L, OrderStatus.SHIPPED, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectOne(any())).willReturn(shipped);
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        // 寄卖明细：卖家 2、成交价 12800、1 件、寄卖商品 14 的单件
        com.fullstackmall.shop.order.entity.OrderItem consignmentLine = orderLine(35L, 1);
        consignmentLine.setPrice(new BigDecimal("12800.00"));
        consignmentLine.setSellerId(2L);
        given(orderItemMapper.selectList(any())).willReturn(List.of(consignmentLine));
        given(payoutMapper.selectCount(any())).willReturn(0L);
        ProductItem consignmentItem = platformItem(35L, 1, "12800.00");
        consignmentItem.setProductId(14L);
        given(productItemMapper.selectById(35L)).willReturn(consignmentItem);
        com.fullstackmall.shop.consignment.entity.ConsignmentListing listing =
                new com.fullstackmall.shop.consignment.entity.ConsignmentListing();
        listing.setCommissionRate(new BigDecimal("15.00"));
        given(consignmentListingMapper.selectOne(any())).willReturn(listing);

        orderService.confirm(1L);

        org.mockito.ArgumentCaptor<com.fullstackmall.shop.payout.entity.Payout> captor =
                org.mockito.ArgumentCaptor.forClass(com.fullstackmall.shop.payout.entity.Payout.class);
        verify(payoutMapper).insert(captor.capture());
        com.fullstackmall.shop.payout.entity.Payout payout = captor.getValue();
        assertThat(payout.getSellerId()).isEqualTo(2L);
        assertThat(payout.getCommission()).isEqualByComparingTo("1920.00");
        assertThat(payout.getSellerAmount()).isEqualByComparingTo("10880.00");
        // 拆账恒等：sellerAmount + commission == price × quantity
        assertThat(payout.getSellerAmount().add(payout.getCommission()))
                .isEqualByComparingTo("12800.00");
        assertThat(payout.getStatus().name()).isEqualTo("PENDING");
    }

    @Test
    void confirmReceiptWithExistingPayout_shouldNotDuplicate() {
        Order shipped = order(1L, OrderStatus.SHIPPED, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectOne(any())).willReturn(shipped);
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        com.fullstackmall.shop.order.entity.OrderItem consignmentLine = orderLine(35L, 1);
        consignmentLine.setSellerId(2L);
        given(orderItemMapper.selectList(any())).willReturn(List.of(consignmentLine));
        // uk(order_item_id) 已存在（并发 confirm 已生成过）
        given(payoutMapper.selectCount(any())).willReturn(1L);

        orderService.confirm(1L);

        verify(payoutMapper, never()).insert(any(com.fullstackmall.shop.payout.entity.Payout.class));
    }

    @Test
    void confirmReceiptUnshipped_shouldThrowIllegalTransition() {
        Order paid = order(1L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectOne(any())).willReturn(paid);
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        assertThatThrownBy(() -> orderService.confirm(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_STATE_ILLEGAL);
        verify(payoutMapper, never()).insert(any(com.fullstackmall.shop.payout.entity.Payout.class));
    }

    // ── Task 4 桩 ───────────────────────────────────────────────

    private Order order(Long id, OrderStatus status, java.time.LocalDateTime expiredAt) {
        Order order = new Order();
        order.setId(id);
        order.setOrderNo("M20261109120000-4821");
        order.setUserId(3L);
        order.setType(com.fullstackmall.shop.order.enums.OrderType.NORMAL);
        order.setStatus(status);
        order.setPayAmount(new BigDecimal("798.00"));
        order.setExpiredAt(expiredAt);
        return order;
    }

    private com.fullstackmall.shop.order.entity.OrderItem orderLine(Long productItemId, int quantity) {
        com.fullstackmall.shop.order.entity.OrderItem line = new com.fullstackmall.shop.order.entity.OrderItem();
        line.setId(1L);
        line.setOrderId(1L);
        line.setProductItemId(productItemId);
        line.setPrice(new BigDecimal("399.00"));
        line.setQuantity(quantity);
        line.setItemSnapshot("{\"title\":\"陶土色垂感风衣\"}");
        return line;
    }

    // ── 桩与构造 ────────────────────────────────────────────────

    private CreateOrderRequest cartRequest() {
        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.CART);
        req.setCartItemIds(List.of(1L));
        return req;
    }

    private CartItem cartRow(Long id, Long productItemId, int quantity) {
        CartItem row = new CartItem();
        row.setId(id);
        row.setUserId(3L);
        row.setProductItemId(productItemId);
        row.setQuantity(quantity);
        row.setChecked(1);
        return row;
    }

    private Address address() {
        Address addr = new Address();
        addr.setId(1L);
        addr.setUserId(3L);
        addr.setReceiverName("张三");
        addr.setPhone("13800138000");
        addr.setProvince("浙江省");
        addr.setCity("杭州市");
        addr.setDistrict("西湖区");
        addr.setDetail("天目里 3 幢 101");
        return addr;
    }

    private ProductItem platformItem(Long id, int stock, String price) {
        ProductItem item = new ProductItem();
        item.setId(id);
        item.setProductId(1L);
        item.setSize("M");
        item.setColor("陶土色");
        item.setConditionGrade(ConditionGrade.NEW);
        item.setPrice(new BigDecimal(price));
        item.setStock(stock);
        return item;
    }

    private Product platformProduct() {
        Product product = new Product();
        product.setId(1L);
        product.setOwnerType(OwnerType.PLATFORM);
        product.setSaleMode(SaleMode.NORMAL);
        product.setBrand("拙衣");
        product.setName("陶土色垂感风衣");
        product.setStatus(1);
        return product;
    }

    private ProductImage mainImage(Long productId, String url) {
        ProductImage image = new ProductImage();
        image.setProductId(productId);
        image.setUrl(url);
        image.setSort(0);
        return image;
    }
}
