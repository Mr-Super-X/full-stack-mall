package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.dto.SeckillOrderStatusDTO;
import com.fullstackmall.shop.seckill.entity.SeckillOrderAcceptance;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper;
import com.fullstackmall.shop.seckill.mq.SeckillOrderCreateProducer;
import com.fullstackmall.shop.seckill.service.DbPessimisticDeductor;
import com.fullstackmall.shop.seckill.service.RedisStockDeductor;
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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

/**
 * 出单状态轮询契约（spec §5.4）：订单优先（CREATED+paymentNo）→ 受理表（ACCEPTED/FAILED）
 * → 全无 404；越权查他人单号一律 404 不泄露存在性（Review Focus #4）。
 */
@ExtendWith(MockitoExtension.class)
class SeckillOrderStatusServiceTest {

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

    private SeckillServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SeckillServiceImpl(seckillActivityMapper, productMapper, productItemMapper,
                productImageMapper, addressMapper, orderMapper, orderItemMapper,
                new SeckillOrderAssembler(orderMapper, paymentMapper),
                new SeckillProperties(),
                new DbPessimisticDeductor(seckillActivityMapper),
                acceptanceMapper,
                mock(RedisStockDeductor.class),
                mock(SeckillOrderCreateProducer.class));
        UserContext.set(new LoginUser(3L, "buyer", "USER"));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    @DisplayName("已建单：CREATED + paymentNo（订单表优先，含归属校验）")
    void status_created_returnsPaymentNo() {
        given(orderMapper.selectWithPaymentByOrderNo("M-Q-001"))
                .willReturn(Map.of("user_id", 3L, "payment_no", "P123456"));

        SeckillOrderStatusDTO dto = service.queryOrderStatus("M-Q-001");

        assertThat(dto.status()).isEqualTo("CREATED");
        assertThat(dto.paymentNo()).isEqualTo("P123456");
    }

    @Test
    @DisplayName("受理中：订单未建，回退受理表返 ACCEPTED（paymentNo 为 null）")
    void status_accepted_fallsBackToAcceptance() {
        given(orderMapper.selectWithPaymentByOrderNo("M-Q-002")).willReturn(null);
        SeckillOrderAcceptance acceptance = new SeckillOrderAcceptance();
        acceptance.setOrderNo("M-Q-002");
        acceptance.setUserId(3L);
        acceptance.setStatus("ACCEPTED");
        given(acceptanceMapper.selectOne(any())).willReturn(acceptance);

        SeckillOrderStatusDTO dto = service.queryOrderStatus("M-Q-002");

        assertThat(dto.status()).isEqualTo("ACCEPTED");
        assertThat(dto.paymentNo()).isNull();
    }

    @Test
    @DisplayName("FAILED：死信登记后受理表状态透传")
    void status_failed_fromAcceptance() {
        given(orderMapper.selectWithPaymentByOrderNo("M-Q-003")).willReturn(null);
        SeckillOrderAcceptance acceptance = new SeckillOrderAcceptance();
        acceptance.setOrderNo("M-Q-003");
        acceptance.setUserId(3L);
        acceptance.setStatus("FAILED");
        given(acceptanceMapper.selectOne(any())).willReturn(acceptance);

        assertThat(service.queryOrderStatus("M-Q-003").status()).isEqualTo("FAILED");
    }

    @Test
    @DisplayName("Review Focus #4 越权：他人订单号一律 404 ORDER_NOT_FOUND（不泄露存在性）")
    void status_othersOrder_returns404() {
        given(orderMapper.selectWithPaymentByOrderNo("M-Q-004"))
                .willReturn(Map.of("user_id", 99L, "payment_no", "P999"));

        assertThatThrownBy(() -> service.queryOrderStatus("M-Q-004"))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_NOT_FOUND);
    }

    @Test
    @DisplayName("全无：订单与受理表都无 → 404")
    void status_notFound_returns404() {
        given(orderMapper.selectWithPaymentByOrderNo("M-Q-005")).willReturn(null);
        given(acceptanceMapper.selectOne(any())).willReturn(null);

        assertThatThrownBy(() -> service.queryOrderStatus("M-Q-005"))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_NOT_FOUND);
    }
}
