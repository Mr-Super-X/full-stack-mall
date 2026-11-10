package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.dto.SeckillOrderRequest;
import com.fullstackmall.shop.seckill.dto.SeckillOrderResultDTO;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.entity.SeckillOrderAcceptance;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper;
import com.fullstackmall.shop.seckill.mq.SeckillOrderCreateProducer;
import com.fullstackmall.shop.seckill.mq.SeckillOrderMessage;
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
import org.springframework.amqp.AmqpException;
import org.springframework.dao.DuplicateKeyException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * redis 策略受理时序契约（spec §5.3b）：预扣→受理表同事务→提交后发 MQ→失败补偿；
 * Review Focus #2：DB 事务回滚（预扣后撞 DuplicateKey）必须补偿 INCR，否则少卖。
 */
@ExtendWith(MockitoExtension.class)
class SeckillRedisPlaceOrderTest {

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
    @Mock
    private SeckillOrderCreateProducer producer;

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
                producer);
        UserContext.set(new LoginUser(3L, "buyer", "USER"));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    private SeckillActivity activeActivity() {
        SeckillActivity a = new SeckillActivity();
        a.setId(16L);
        a.setProductId(16L);
        a.setSeckillPrice(new BigDecimal("299.40"));
        a.setSeckillStock(10);
        a.setStatus(SeckillStatus.ACTIVE);
        a.setStartTime(LocalDateTime.now().minusHours(1));
        a.setEndTime(LocalDateTime.now().plusHours(7));
        return a;
    }

    private void stubPrerequisites() {
        given(seckillActivityMapper.selectById(16L)).willReturn(activeActivity());
        Product product = new Product();
        product.setId(16L);
        product.setStatus(1);
        given(productMapper.selectById(16L)).willReturn(product);
        ProductItem item = new ProductItem();
        item.setId(1601L);
        given(productItemMapper.selectList(any())).willReturn(List.of(item));
        given(orderMapper.selectCount(any())).willReturn(0L);
    }

    private SeckillOrderRequest request() {
        SeckillOrderRequest req = new SeckillOrderRequest();
        req.setAddressId(7L);
        req.setProductItemId(1601L);
        return req;
    }

    @Test
    @DisplayName("受理成功：预扣→受理记录→发 MQ；返回 orderNo 且 paymentNo=null（受理态标识）")
    void redisPath_acceptsAndSends() {
        stubPrerequisites();
        Address address = new Address();
        address.setReceiverName("张三");
        given(addressMapper.selectOne(any())).willReturn(address);

        SeckillOrderResultDTO result = service.placeOrder(16L, request());

        assertThat(result.getOrderNo()).startsWith("M");
        assertThat(result.getPaymentNo()).isNull();
        verify(redisStockDeductor).deduct(eq(16L), eq(3L), eq(result.getOrderNo()));
        verify(acceptanceMapper).insert(any(SeckillOrderAcceptance.class));
        verify(producer).send(any(SeckillOrderMessage.class));
        // 异步路径不建单
        verify(orderMapper, never()).insert(any(Order.class));
    }

    @Test
    @DisplayName("发送 MQ 失败：受理表置 FAILED + Redis 回补 + 抛 40005")
    void redisPath_sendFails_compensates() {
        stubPrerequisites();
        Address address = new Address();
        address.setReceiverName("张三");
        given(addressMapper.selectOne(any())).willReturn(address);
        doThrow(new AmqpException("broker down")).when(producer).send(any(SeckillOrderMessage.class));

        assertThatThrownBy(() -> service.placeOrder(16L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.SECKILL_UNAVAILABLE);

        verify(acceptanceMapper).update(any(), any());
        verify(redisStockDeductor).restoreStock(16L);
    }

    @Test
    @DisplayName("Review Focus #2：预扣后事务回滚（受理记录撞 uk）→ Redis INCR 补偿，防少卖")
    void redisPath_txRollback_restoresRedis() {
        stubPrerequisites();
        Address address = new Address();
        address.setReceiverName("张三");
        given(addressMapper.selectOne(any())).willReturn(address);
        doThrow(new DuplicateKeyException("uk_order_no")).when(acceptanceMapper).insert(any(SeckillOrderAcceptance.class));

        assertThatThrownBy(() -> service.placeOrder(16L, request()))
                .isInstanceOf(DuplicateKeyException.class);

        verify(redisStockDeductor).restoreStock(16L);
        verify(producer, never()).send(any());
        verify(acceptanceMapper, never()).update(any(), any());
    }
}
