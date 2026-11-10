package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.enums.OrderType;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.order.service.OrderNoGenerator;
import com.fullstackmall.shop.payment.entity.Payment;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.dto.SeckillOrderRequest;
import com.fullstackmall.shop.seckill.dto.SeckillOrderResultDTO;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper;
import com.fullstackmall.shop.seckill.service.impl.SeckillServiceImpl;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.context.UserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * SeckillServiceImpl.placeOrder 七步事务真逻辑单测：四错误码各自触发路径 +
 * 建单快照（type=SECKILL、payAmount=秒杀价、item.price 定格）+ uk 撞线 40004。
 */
@ExtendWith(MockitoExtension.class)
class SeckillPlaceOrderTest {

    @Mock
    private SeckillActivityMapper seckillActivityMapper;
    @Mock
    private ProductMapper productMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductImageMapper productImageMapper;
    @Mock
    private AddressMapper addressMapper;
    @Mock
    private OrderMapper orderMapper;
    @Mock
    private OrderItemMapper orderItemMapper;
    @Mock
    private PaymentMapper paymentMapper;
    @Mock
    private SeckillOrderAcceptanceMapper seckillOrderAcceptanceMapper;

    private SeckillServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SeckillServiceImpl(seckillActivityMapper, productMapper, productItemMapper,
                productImageMapper, addressMapper, orderMapper, orderItemMapper,
                new com.fullstackmall.shop.seckill.service.SeckillOrderAssembler(orderMapper, paymentMapper),
                new com.fullstackmall.shop.seckill.service.SeckillProperties(),
                new com.fullstackmall.shop.seckill.service.DbPessimisticDeductor(seckillActivityMapper),
                seckillOrderAcceptanceMapper);
        UserContext.set(new LoginUser(3L, "buyer", "USER"));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void 活动不存在应抛404() {
        given(seckillActivityMapper.selectById(9L)).willReturn(null);

        assertThatThrownBy(() -> service.placeOrder(9L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.SECKILL_NOT_FOUND);
    }

    @Test
    void 未开始应抛40001() {
        given(seckillActivityMapper.selectById(1L))
                .willReturn(activity(SeckillStatus.PENDING, nowMinusHours(1), nowPlusHours(3)));

        assertThatThrownBy(() -> service.placeOrder(1L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.SECKILL_NOT_STARTED);
    }

    @Test
    void 已过期应推进已结束并归还后抛40001() {
        given(seckillActivityMapper.selectById(1L))
                .willReturn(activity(SeckillStatus.ACTIVE, nowMinusHours(24), nowMinusHours(1)));
        given(seckillActivityMapper.update(any(), any())).willReturn(1);
        given(productItemMapper.selectList(any())).willReturn(List.of(item()));

        assertThatThrownBy(() -> service.placeOrder(1L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.SECKILL_NOT_STARTED);
        verify(seckillActivityMapper).update(any(), any());
        verify(productItemMapper).update(any(), any());
    }

    @Test
    void 商品已下架应抛40001() {
        given(seckillActivityMapper.selectById(1L))
                .willReturn(activity(SeckillStatus.ACTIVE, nowMinusHours(1), nowPlusHours(7)));
        Product offShelf = platformProduct();
        offShelf.setStatus(0);
        given(productMapper.selectById(16L)).willReturn(offShelf);

        assertThatThrownBy(() -> service.placeOrder(1L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.SECKILL_NOT_STARTED);
    }

    @Test
    void 已达限购应抛40003() {
        given(seckillActivityMapper.selectById(1L))
                .willReturn(activity(SeckillStatus.ACTIVE, nowMinusHours(1), nowPlusHours(7)));
        given(productMapper.selectById(16L)).willReturn(platformProduct());
        given(productItemMapper.selectList(any())).willReturn(List.of(item()));
        given(orderMapper.selectCount(any())).willReturn(1L);

        assertThatThrownBy(() -> service.placeOrder(1L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.LIMIT_EXCEEDED);
    }

    @Test
    void 独立池耗尽应抛40002() {
        given(seckillActivityMapper.selectById(1L))
                .willReturn(activity(SeckillStatus.ACTIVE, nowMinusHours(1), nowPlusHours(7)));
        given(productMapper.selectById(16L)).willReturn(platformProduct());
        given(productItemMapper.selectList(any())).willReturn(List.of(item()));
        given(orderMapper.selectCount(any())).willReturn(0L);
        given(seckillActivityMapper.update(any(), any())).willReturn(0);

        assertThatThrownBy(() -> service.placeOrder(1L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.SOLD_OUT);
        // 池已空不再建单
        verify(orderMapper, never()).insert(any(Order.class));
    }

    @Test
    void 成功下单_订单定格秒杀价并建支付单() {
        SeckillActivity activity = activity(SeckillStatus.ACTIVE, nowMinusHours(1), nowPlusHours(7));
        given(seckillActivityMapper.selectById(1L)).willReturn(activity);
        given(productMapper.selectById(16L)).willReturn(platformProduct());
        given(productItemMapper.selectList(any())).willReturn(List.of(item()));
        given(orderMapper.selectCount(any())).willReturn(0L);
        given(seckillActivityMapper.update(any(), any())).willReturn(1);
        given(addressMapper.selectOne(any())).willReturn(address());
        ProductImage image = new ProductImage();
        image.setProductId(16L);
        image.setUrl("https://picsum.photos/seed/mall-p16-1/750/750");
        given(productImageMapper.selectOne(any())).willReturn(image);

        SeckillOrderResultDTO result = service.placeOrder(1L, request());

        assertThat(result.getOrderNo()).startsWith("M");
        assertThat(result.getPaymentNo()).startsWith("P");
        // 订单：type=SECKILL + 挂活动 + 应付=秒杀价
        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderMapper).insert(orderCaptor.capture());
        assertThat(orderCaptor.getValue().getType()).isEqualTo(OrderType.SECKILL);
        assertThat(orderCaptor.getValue().getSeckillActivityId()).isEqualTo(1L);
        assertThat(orderCaptor.getValue().getPayAmount()).isEqualByComparingTo(new BigDecimal("299.40"));
        // 快照行：price 定格秒杀价（非 item 原价 499）
        ArgumentCaptor<OrderItem> lineCaptor = ArgumentCaptor.forClass(OrderItem.class);
        verify(orderItemMapper).insert(lineCaptor.capture());
        assertThat(lineCaptor.getValue().getPrice()).isEqualByComparingTo(new BigDecimal("299.40"));
        assertThat(lineCaptor.getValue().getQuantity()).isEqualTo(1);
        // 支付单：CREATED 且金额=秒杀价
        ArgumentCaptor<Payment> paymentCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentMapper).insert(paymentCaptor.capture());
        assertThat(paymentCaptor.getValue().getAmount()).isEqualByComparingTo(new BigDecimal("299.40"));
    }

    @Test
    void 撞活动唯一键应抛40004() {
        given(seckillActivityMapper.selectById(1L))
                .willReturn(activity(SeckillStatus.ACTIVE, nowMinusHours(1), nowPlusHours(7)));
        given(productMapper.selectById(16L)).willReturn(platformProduct());
        given(productItemMapper.selectList(any())).willReturn(List.of(item()));
        given(orderMapper.selectCount(any())).willReturn(0L);
        given(seckillActivityMapper.update(any(), any())).willReturn(1);
        given(addressMapper.selectOne(any())).willReturn(address());
        given(orderMapper.insert(any(Order.class))).willThrow(new DuplicateKeyException("uk_user_activity"));

        assertThatThrownBy(() -> service.placeOrder(1L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.DUPLICATE_ORDER);
    }

    private LocalDateTime nowMinusHours(int h) {
        return LocalDateTime.now().minusHours(h);
    }

    private LocalDateTime nowPlusHours(int h) {
        return LocalDateTime.now().plusHours(h);
    }

    private SeckillActivity activity(SeckillStatus status, LocalDateTime start, LocalDateTime end) {
        SeckillActivity activity = new SeckillActivity();
        activity.setId(1L);
        activity.setProductId(16L);
        activity.setSeckillPrice(new BigDecimal("299.40"));
        activity.setSeckillStock(5);
        activity.setSoldCount(0);
        activity.setStartTime(start);
        activity.setEndTime(end);
        activity.setLimitPerUser(1);
        activity.setStatus(status);
        return activity;
    }

    private Product platformProduct() {
        Product product = new Product();
        product.setId(16L);
        product.setName("复古做旧牛仔夹克 · 秒杀进行中");
        product.setOwnerType(OwnerType.PLATFORM);
        product.setStatus(1);
        return product;
    }

    private ProductItem item() {
        ProductItem item = new ProductItem();
        item.setId(36L);
        item.setProductId(16L);
        item.setPrice(new BigDecimal("499.00"));
        item.setStock(15);
        return item;
    }

    private Address address() {
        Address address = new Address();
        address.setId(5L);
        address.setUserId(3L);
        address.setReceiverName("买家小王");
        address.setPhone("13800000000");
        address.setProvince("广东省");
        address.setCity("广州市");
        address.setDistrict("天河区");
        address.setDetail("体育西路 100 号");
        return address;
    }

    private SeckillOrderRequest request() {
        SeckillOrderRequest req = new SeckillOrderRequest();
        req.setAddressId(5L);
        req.setProductItemId(36L);
        return req;
    }
}
