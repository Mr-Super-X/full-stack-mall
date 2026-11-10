package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
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
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.entity.SeckillOrderAcceptance;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper;
import com.fullstackmall.shop.seckill.mq.SeckillOrderMessage;
import com.fullstackmall.shop.seckill.service.DbPessimisticDeductor;
import com.fullstackmall.shop.seckill.service.SeckillOrderAssembler;
import com.fullstackmall.shop.seckill.service.SeckillProperties;
import com.fullstackmall.shop.seckill.service.impl.SeckillServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 异步出单消费事务契约（SeckillService.fulfillSeckillOrder）：
 * ①消息→订单/明细/支付/受理表 CREATED 全链路 ②同 orderNo 重复消费幂等直返 ③建单撞 uk 视为已消费。
 */
@ExtendWith(MockitoExtension.class)
class SeckillFulfillTest {

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
    private com.fullstackmall.shop.seckill.service.RedisStockDeductor redisStockDeductor;
    @Mock
    private com.fullstackmall.shop.seckill.mq.SeckillOrderCreateProducer seckillOrderCreateProducer;

    private SeckillServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SeckillServiceImpl(seckillActivityMapper, productMapper, productItemMapper,
                productImageMapper, addressMapper, orderMapper, orderItemMapper,
                new SeckillOrderAssembler(orderMapper, paymentMapper),
                new SeckillProperties(),
                new DbPessimisticDeductor(seckillActivityMapper),
                acceptanceMapper,
                redisStockDeductor,
                seckillOrderCreateProducer);
    }

    private SeckillOrderMessage message() {
        return new SeckillOrderMessage("M-FUL-001", 16L, 3L, 1601L, 7L,
                new BigDecimal("299.40"), LocalDateTime.now().minusSeconds(5));
    }

    private void stubSnapshotSources() {
        SeckillActivity activity = new SeckillActivity();
        activity.setId(16L);
        activity.setProductId(16L);
        activity.setSeckillPrice(new BigDecimal("299.40"));
        given(seckillActivityMapper.selectById(16L)).willReturn(activity);
        Product product = new Product();
        product.setId(16L);
        product.setName("复古做旧牛仔夹克");
        given(productMapper.selectById(16L)).willReturn(product);
        ProductItem item = new ProductItem();
        item.setId(1601L);
        given(productItemMapper.selectById(1601L)).willReturn(item);
        Address address = new Address();
        address.setReceiverName("张三");
        given(addressMapper.selectOne(any())).willReturn(address);
        ProductImage image = new ProductImage();
        image.setUrl("https://img/p16.jpg");
        given(productImageMapper.selectOne(any())).willReturn(image);
        given(orderMapper.insert(any(Order.class))).willAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(9001L);
            return 1;
        });
    }

    @Test
    @DisplayName("正常消费：订单/明细/支付落库 + 受理表推进 CREATED（orderNo 用消息值不重新生成）")
    void fulfill_createsOrderLinePaymentAndMarksCreated() {
        stubSnapshotSources();

        service.fulfillSeckillOrder(message());

        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderMapper).insert(orderCaptor.capture());
        assertThat(orderCaptor.getValue().getOrderNo()).isEqualTo("M-FUL-001");
        assertThat(orderCaptor.getValue().getPayAmount()).isEqualByComparingTo("299.40");
        verify(orderItemMapper).insert(any(OrderItem.class));
        verify(paymentMapper).insert(any(com.fullstackmall.shop.payment.entity.Payment.class));
        verify(acceptanceMapper).update(any(), any());
    }

    @Test
    @DisplayName("幂等：同 orderNo 消息重复消费，订单只落一次（查重直返，建单三步零调用）")
    void fulfill_duplicateMessage_skipsCreation() {
        given(orderMapper.selectCount(any())).willReturn(1L);

        service.fulfillSeckillOrder(message());

        verify(orderMapper, never()).insert(any(Order.class));
        verify(orderItemMapper, never()).insert(any(OrderItem.class));
        verify(paymentMapper, never()).insert(any(com.fullstackmall.shop.payment.entity.Payment.class));
    }

    @Test
    @DisplayName("撞 uk_user_activity（并发重复消费）：异常向上抛由消费者转 ack 不回流")
    void fulfill_duplicateKey_propagates() {
        given(orderMapper.selectCount(any())).willReturn(0L);
        given(seckillActivityMapper.selectById(16L)).willAnswer(inv -> {
            SeckillActivity a = new SeckillActivity();
            a.setId(16L);
            a.setProductId(16L);
            a.setSeckillPrice(new BigDecimal("299.40"));
            return a;
        });
        Product product = new Product();
        product.setId(16L);
        given(productMapper.selectById(16L)).willReturn(product);
        ProductItem item = new ProductItem();
        item.setId(1601L);
        given(productItemMapper.selectById(1601L)).willReturn(item);
        Address address = new Address();
        address.setReceiverName("张三");
        given(addressMapper.selectOne(any())).willReturn(address);
        org.mockito.Mockito.doThrow(new DuplicateKeyException("uk_user_activity"))
                .when(orderMapper).insert(any(Order.class));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.fulfillSeckillOrder(message()))
                .isInstanceOf(DuplicateKeyException.class);
    }
}
