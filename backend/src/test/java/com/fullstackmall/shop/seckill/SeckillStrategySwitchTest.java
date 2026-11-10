package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
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
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.service.DbPessimisticDeductor;
import com.fullstackmall.shop.seckill.service.SeckillDeductStrategy;
import com.fullstackmall.shop.seckill.service.SeckillOrderAssembler;
import com.fullstackmall.shop.seckill.service.SeckillProperties;
import com.fullstackmall.shop.seckill.service.impl.SeckillServiceImpl;
import com.fullstackmall.shop.user.context.UserContext;
import com.fullstackmall.shop.user.context.LoginUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * seckill.strategy 配置分派契约：同一 placeOrder 入口按策略走三种扣减实现
 * （对照实验公平性——除扣减段外，前置校验与建单三步完全一致）。
 */
@ExtendWith(MockitoExtension.class)
class SeckillStrategySwitchTest {

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
    private DbPessimisticDeductor pessimisticDeductor;

    private final SeckillProperties properties = new SeckillProperties();

    private SeckillServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SeckillServiceImpl(seckillActivityMapper, productMapper, productItemMapper,
                productImageMapper, addressMapper, orderMapper, orderItemMapper,
                new SeckillOrderAssembler(orderMapper, paymentMapper),
                properties, pessimisticDeductor);
        UserContext.set(new LoginUser(3L, "buyer", "USER"));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    private SeckillActivity activeActivity() {
        SeckillActivity a = new SeckillActivity();
        a.setId(1L);
        a.setProductId(16L);
        a.setSeckillPrice(new BigDecimal("299.40"));
        a.setSeckillStock(10);
        a.setSoldCount(0);
        a.setStatus(SeckillStatus.ACTIVE);
        a.setStartTime(LocalDateTime.now().minusHours(1));
        a.setEndTime(LocalDateTime.now().plusHours(7));
        return a;
    }

    /** 前置 1-4 步 stub（三策略共用：查活动→校验→限购查数） */
    private void stubPrerequisites() {
        given(seckillActivityMapper.selectById(1L)).willReturn(activeActivity());
        Product product = new Product();
        product.setId(16L);
        product.setName("复古做旧牛仔夹克");
        product.setStatus(1);
        given(productMapper.selectById(16L)).willReturn(product);
        ProductItem item = new ProductItem();
        item.setId(1601L);
        item.setProductId(16L);
        given(productItemMapper.selectList(any())).willReturn(List.of(item));
        given(orderMapper.selectCount(any())).willReturn(0L);
    }

    /** 第 6 步建单 stub（optimistic/pessimistic 走到：地址+主图） */
    private void stubAddressAndImage() {
        Address address = new Address();
        address.setReceiverName("张三");
        given(addressMapper.selectOne(any())).willReturn(address);
        ProductImage image = new ProductImage();
        image.setUrl("https://img/p16.jpg");
        given(productImageMapper.selectOne(any())).willReturn(image);
    }

    /** optimistic 条件更新 stub（仅默认策略走到） */
    private void stubConditionUpdate() {
        given(seckillActivityMapper.update(any(), any())).willReturn(1);
    }

    private SeckillOrderRequest request() {
        SeckillOrderRequest req = new SeckillOrderRequest();
        req.setAddressId(7L);
        req.setProductItemId(1601L);
        return req;
    }

    @Test
    @DisplayName("默认 optimistic：走 4a 条件更新扣减，pessimisticDeductor 零交互")
    void defaultStrategy_usesOptimisticConditionUpdate() {
        stubPrerequisites();
        stubAddressAndImage();
        stubConditionUpdate();

        service.placeOrder(1L, request());

        verify(seckillActivityMapper, org.mockito.Mockito.atLeastOnce())
                .update(org.mockito.ArgumentMatchers.isNull(), any());
        verify(pessimisticDeductor, never()).deduct(any());
    }

    @Test
    @DisplayName("pessimistic：走 FOR UPDATE 对照组 deductor")
    void pessimisticStrategy_delegatesToForUpdateDeductor() {
        properties.setStrategy(SeckillDeductStrategy.PESSIMISTIC);
        stubPrerequisites();
        stubAddressAndImage();

        service.placeOrder(1L, request());

        verify(pessimisticDeductor).deduct(1L);
    }

    @Test
    @DisplayName("redis：本期占位抛 INTERNAL_ERROR（Task 9 填充真实实现）")
    void redisStrategy_throwsPlaceholder() {
        properties.setStrategy(SeckillDeductStrategy.REDIS);
        stubPrerequisites();

        assertThatThrownBy(() -> service.placeOrder(1L, request()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.INTERNAL_ERROR);
    }
}
