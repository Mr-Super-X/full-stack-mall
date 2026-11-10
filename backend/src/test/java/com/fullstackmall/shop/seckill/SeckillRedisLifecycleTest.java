package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.cart.mapper.CartItemMapper;
import com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.enums.OrderType;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.order.service.impl.OrderServiceImpl;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.payout.mapper.PayoutMapper;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper;
import com.fullstackmall.shop.seckill.mq.SeckillOrderCreateProducer;
import com.fullstackmall.shop.seckill.service.DbPessimisticDeductor;
import com.fullstackmall.shop.seckill.service.RedisStockDeductor;
import com.fullstackmall.shop.seckill.service.SeckillDeductStrategy;
import com.fullstackmall.shop.seckill.service.SeckillOrderAssembler;
import com.fullstackmall.shop.seckill.service.SeckillProperties;
import com.fullstackmall.shop.seckill.service.impl.SeckillServiceImpl;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.context.UserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Redis 库存 key 生命周期挂接（spec §4.3）：激活 SET / 关单 INCR / 结束 DEL——
 * 全部失败仅 warn 不阻断主流程（Redis 是关口不是真相）；非 redis 策略零交互。
 */
@ExtendWith(MockitoExtension.class)
class SeckillRedisLifecycleTest {

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
    private SeckillOrderAcceptanceMapper acceptanceMapper;
    @Mock
    private RedisStockDeductor redisStockDeductor;

    private final SeckillProperties properties = new SeckillProperties();

    private SeckillServiceImpl service;

    @BeforeEach
    void setUp() {
        properties.setStrategy(SeckillDeductStrategy.REDIS);
        service = new SeckillServiceImpl(seckillActivityMapper, productMapper, productItemMapper,
                productImageMapper, addressMapper, orderMapper, orderItemMapper,
                new SeckillOrderAssembler(orderMapper, paymentMapper),
                properties,
                new DbPessimisticDeductor(seckillActivityMapper),
                acceptanceMapper,
                redisStockDeductor,
                mock(SeckillOrderCreateProducer.class));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    private SeckillActivity activity(long id, SeckillStatus status, int stock, int sold) {
        SeckillActivity a = new SeckillActivity();
        a.setId(id);
        a.setProductId(16L);
        a.setSeckillStock(stock);
        a.setSoldCount(sold);
        a.setSeckillPrice(new BigDecimal("299.40"));
        a.setStatus(status);
        return a;
    }

    @Test
    @DisplayName("激活挂接：PENDING 到点惰性激活 → initStock(id, stock-sold) 初始化关口")
    void activate_initStock() {
        SeckillActivity pending = activity(2L, SeckillStatus.PENDING, 10, 0);
        pending.setStartTime(LocalDateTime.now().minusMinutes(5));
        pending.setEndTime(LocalDateTime.now().plusHours(5));
        given(seckillActivityMapper.selectList(any())).willReturn(List.of(), List.of(pending));
        given(seckillActivityMapper.update(any(), any())).willReturn(1);

        service.active();

        verify(redisStockDeductor).initStock(2L, 10);
    }

    @Test
    @DisplayName("结束挂接：过期 ACTIVE 推进 ENDED → dropStock(id) 摘除关口")
    void settleEnded_dropStock() {
        SeckillActivity expired = activity(1L, SeckillStatus.ACTIVE, 10, 3);
        expired.setStartTime(LocalDateTime.now().minusDays(1));
        expired.setEndTime(LocalDateTime.now().minusHours(1));
        given(seckillActivityMapper.selectList(any())).willReturn(List.of(expired), List.of());
        given(seckillActivityMapper.update(any(), any())).willReturn(1);
        given(productItemMapper.selectList(any())).willReturn(List.of(new com.fullstackmall.shop.product.entity.ProductItem()));

        service.active();

        verify(redisStockDeductor).dropStock(1L);
    }

    @Test
    @DisplayName("关单挂接（OrderServiceImpl）：秒杀单取消回补独立池 + Redis INCR 关口")
    void restock_restoreStock() {
        Order order = new Order();
        order.setId(100L);
        order.setUserId(3L);
        order.setType(OrderType.SECKILL);
        order.setSeckillActivityId(16L);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        OrderServiceImpl orderService = new OrderServiceImpl(orderMapper, orderItemMapper,
                mock(CartItemMapper.class), productItemMapper, productMapper, productImageMapper,
                paymentMapper, addressMapper, mock(PayoutMapper.class),
                mock(ConsignmentListingMapper.class), seckillActivityMapper,
                properties, redisStockDeductor);
        UserContext.set(new LoginUser(3L, "buyer", "USER"));
        given(orderMapper.selectOne(any())).willReturn(order);
        given(orderMapper.update(any(), any())).willReturn(1);
        given(seckillActivityMapper.update(any(), any())).willReturn(1);

        orderService.cancel(100L);

        verify(seckillActivityMapper).update(any(), any());
        verify(redisStockDeductor).restoreStock(16L);
    }

    @Test
    @DisplayName("非 redis 策略：三挂接点全部零交互（ObjectProvider 延迟取用语义）")
    void nonRedisStrategy_noRedisInteraction() {
        properties.setStrategy(SeckillDeductStrategy.OPTIMISTIC);
        SeckillActivity pending = activity(2L, SeckillStatus.PENDING, 10, 0);
        pending.setStartTime(LocalDateTime.now().minusMinutes(5));
        pending.setEndTime(LocalDateTime.now().plusHours(5));
        given(seckillActivityMapper.selectList(any())).willReturn(List.of(), List.of(pending));
        given(seckillActivityMapper.update(any(), any())).willReturn(1);

        service.active();

        verify(redisStockDeductor, never()).initStock(anyLong(), anyInt());
        verify(redisStockDeductor, never()).dropStock(anyLong());
        verify(redisStockDeductor, never()).restoreStock(anyLong());
    }
}
