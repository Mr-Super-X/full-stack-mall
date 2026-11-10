package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.dto.SeckillActiveDTO;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.service.impl.SeckillServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * SeckillServiceImpl 真逻辑单测：live/upcoming 分组、过期场惰性推进 ENDED + 归还
 * （同事务原子性由 @Transactional 承载）、findActiveByProductId 时间窗。
 */
@ExtendWith(MockitoExtension.class)
class SeckillServiceImplTest {

    @Mock
    private SeckillActivityMapper seckillActivityMapper;
    @Mock
    private ProductMapper productMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductImageMapper productImageMapper;
    @Mock
    private com.fullstackmall.shop.address.mapper.AddressMapper addressMapper;
    @Mock
    private com.fullstackmall.shop.order.mapper.OrderMapper orderMapper;
    @Mock
    private com.fullstackmall.shop.order.mapper.OrderItemMapper orderItemMapper;
    @Mock
    private com.fullstackmall.shop.payment.mapper.PaymentMapper paymentMapper;
    @Mock
    private com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper seckillOrderAcceptanceMapper;

    private SeckillServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SeckillServiceImpl(
                seckillActivityMapper, productMapper, productItemMapper, productImageMapper,
                addressMapper, orderMapper, orderItemMapper,
                new com.fullstackmall.shop.seckill.service.SeckillOrderAssembler(orderMapper, paymentMapper),
                new com.fullstackmall.shop.seckill.service.SeckillProperties(),
                new com.fullstackmall.shop.seckill.service.DbPessimisticDeductor(seckillActivityMapper),
                seckillOrderAcceptanceMapper);
    }

    @Test
    void 过期进行中场被推进已结束并归还_不出现在live() {
        SeckillActivity expired = activity(1L, SeckillStatus.ACTIVE,
                LocalDateTime.now().minusDays(1), LocalDateTime.now().minusHours(1));
        given(seckillActivityMapper.selectList(any())).willReturn(List.of(expired), List.of());
        given(seckillActivityMapper.update(eq(null), any())).willReturn(1);
        given(productItemMapper.selectList(any())).willReturn(List.of(item(499, 15)));

        SeckillActiveDTO result = service.active();

        assertThat(result.getLive()).isEmpty();
        assertThat(result.getUpcoming()).isEmpty();
        // 推进 ENDED + 归还剩余库存（5 - 0 = 5）都被执行
        verify(seckillActivityMapper).update(eq(null), any());
        verify(productItemMapper).update(eq(null), any());
    }

    @Test
    void 进行中场进live_含商品摘要与进度() {
        SeckillActivity live = activity(1L, SeckillStatus.ACTIVE,
                LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(7));
        given(seckillActivityMapper.selectList(any())).willReturn(List.of(live), List.of());
        given(productMapper.selectBatchIds(any())).willReturn(List.of(product()));
        given(productItemMapper.selectList(any())).willReturn(List.of(item(499, 15)));
        ProductImage image = new ProductImage();
        image.setProductId(16L);
        image.setUrl("https://picsum.photos/seed/mall-p16-1/750/750");
        given(productImageMapper.selectList(any())).willReturn(List.of(image));

        SeckillActiveDTO result = service.active();

        assertThat(result.getLive()).hasSize(1);
        SeckillActiveDTO.SeckillActivityDTO dto = result.getLive().get(0);
        assertThat(dto.getActivityId()).isEqualTo(1L);
        assertThat(dto.getProductTitle()).isEqualTo("复古做旧牛仔夹克 · 秒杀进行中");
        assertThat(dto.getOriginPrice()).isEqualByComparingTo(new BigDecimal("499.00"));
        assertThat(dto.getSeckillPrice()).isEqualByComparingTo(new BigDecimal("299.40"));
        assertThat(dto.getSoldCount()).isEqualTo(0);
        assertThat(dto.getSeckillStock()).isEqualTo(5);
        assertThat(dto.getImageUrl()).isNotBlank();
        // 未过期场不做归还
        verify(productItemMapper, never()).update(eq(null), any());
    }

    @Test
    void 待开始场进upcoming_上限5条() {
        List<SeckillActivity> pendings = java.util.stream.IntStream.rangeClosed(1, 6)
                .mapToObj(i -> activity((long) i, SeckillStatus.PENDING,
                        LocalDateTime.now().plusHours(3), LocalDateTime.now().plusHours(10)))
                .toList();
        given(seckillActivityMapper.selectList(any())).willReturn(List.of(), pendings);

        SeckillActiveDTO result = service.active();

        assertThat(result.getUpcoming()).hasSize(5);
        assertThat(result.getLive()).isEmpty();
    }

    @Test
    void 按商品查生效活动_窗口外返回null() {
        given(seckillActivityMapper.selectOne(any())).willReturn(null);

        assertThat(service.findActiveByProductId(16L)).isNull();
    }

    @Test
    void 按商品查生效活动_窗口内返回活动() {
        SeckillActivity live = activity(1L, SeckillStatus.ACTIVE,
                LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(7));
        given(seckillActivityMapper.selectOne(any())).willReturn(live);

        assertThat(service.findActiveByProductId(16L)).isSameAs(live);
    }

    private Product product() {
        Product product = new Product();
        product.setId(16L);
        product.setName("复古做旧牛仔夹克 · 秒杀进行中");
        return product;
    }

    private ProductItem item(int price, int stock) {
        ProductItem item = new ProductItem();
        item.setId(36L);
        item.setProductId(16L);
        item.setPrice(new BigDecimal(price));
        item.setStock(stock);
        return item;
    }

    private SeckillActivity activity(Long id, SeckillStatus status, LocalDateTime start, LocalDateTime end) {
        SeckillActivity activity = new SeckillActivity();
        activity.setId(id);
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
}
