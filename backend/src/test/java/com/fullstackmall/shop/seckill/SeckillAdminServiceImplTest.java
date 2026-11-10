package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.dto.SeckillActivityCreateRequest;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.service.impl.SeckillAdminServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * SeckillAdminServiceImpl 真逻辑单测：划拨事务（单 SKU 校验/条件更新行数守卫）、
 * 取消归还、限购固化（limit 恒 1）。
 */
@ExtendWith(MockitoExtension.class)
class SeckillAdminServiceImplTest {

    @Mock
    private SeckillActivityMapper seckillActivityMapper;
    @Mock
    private ProductMapper productMapper;
    @Mock
    private ProductItemMapper productItemMapper;

    private SeckillAdminServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new SeckillAdminServiceImpl(seckillActivityMapper, productMapper, productItemMapper);
    }

    @Test
    void 创建划拨成功_条件扣减库存且活动落库为待开始() {
        given(productMapper.selectById(16L)).willReturn(platformProduct());
        given(productItemMapper.selectList(any())).willReturn(List.of(item(20)));
        given(productItemMapper.update(eq(null), any())).willReturn(1);

        var result = service.create(request(16L, 5, 1));

        // 划拨：update 被调用（行数守卫行为由给定 1/0 驱动断言，wrapper 内部参数结构是 MP 实现细节）
        verify(productItemMapper).update(eq(null), any());
        // 活动行：PENDING + soldCount=0
        ArgumentCaptor<SeckillActivity> insertCaptor = ArgumentCaptor.forClass(SeckillActivity.class);
        verify(seckillActivityMapper).insert(insertCaptor.capture());
        assertThat(insertCaptor.getValue().getStatus()).isEqualTo(SeckillStatus.PENDING);
        assertThat(insertCaptor.getValue().getSoldCount()).isEqualTo(0);
        assertThat(result.getStatus()).isEqualTo("PENDING");
        assertThat(result.getSeckillStock()).isEqualTo(5);
    }

    @Test
    void 创建挂载多SKU商品应拒绝() {
        given(productMapper.selectById(1L)).willReturn(platformProduct());
        given(productItemMapper.selectList(any())).willReturn(List.of(item(20), item(20)));

        assertThatThrownBy(() -> service.create(request(1L, 5, 1)))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    @Test
    void 创建划拨超库存应抛库存不足() {
        given(productMapper.selectById(16L)).willReturn(platformProduct());
        given(productItemMapper.selectList(any())).willReturn(List.of(item(3)));
        given(productItemMapper.update(eq(null), any())).willReturn(0);

        assertThatThrownBy(() -> service.create(request(16L, 5, 1)))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.STOCK_NOT_ENOUGH);
    }

    @Test
    void 创建限购大于1应拒绝() {
        assertThatThrownBy(() -> service.create(request(16L, 5, 2)))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    @Test
    void 取消待开始场_归还划拨库存且置已取消() {
        SeckillActivity activity = activity(SeckillStatus.PENDING);
        given(seckillActivityMapper.selectById(1L)).willReturn(activity);
        given(seckillActivityMapper.update(eq(null), any())).willReturn(1);
        given(productItemMapper.selectList(any())).willReturn(List.of(item(15)));

        service.cancel(1L);

        // 归还：挂载 item 收到回补 update（行数守卫与状态迁移由 update 返回值驱动）
        verify(productItemMapper).update(eq(null), any());
    }

    @Test
    void 取消进行中场应拒绝() {
        given(seckillActivityMapper.selectById(1L)).willReturn(activity(SeckillStatus.ACTIVE));
        given(seckillActivityMapper.update(eq(null), any())).willReturn(0);

        assertThatThrownBy(() -> service.cancel(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.CONSIGNMENT_STATE_ILLEGAL);
        verify(productItemMapper, never()).update(eq(null), any());
    }

    private Product platformProduct() {
        Product product = new Product();
        product.setId(16L);
        product.setOwnerType(OwnerType.PLATFORM);
        product.setStatus(1);
        return product;
    }

    private ProductItem item(int stock) {
        ProductItem item = new ProductItem();
        item.setId(36L);
        item.setProductId(16L);
        item.setStock(stock);
        return item;
    }

    @Test
    void 候选商品_仅保留单SKU自营且有库存() {
        Product p1 = platformProduct();
        p1.setId(16L);
        Product p2 = platformProduct();
        p2.setId(17L);
        Product consign = platformProduct();
        consign.setId(99L);
        consign.setOwnerType(com.fullstackmall.shop.product.enums.OwnerType.CONSIGNMENT);
        Product noStock = platformProduct();
        noStock.setId(100L);
        given(productMapper.selectList(any())).willReturn(List.of(p1, p2, consign, noStock));
        // p1 单 SKU 有库存（入选）；p2 多 SKU（排除）；consign 单 SKU（寄卖排除）；
        // p100 单 SKU 但库存 0（排除）
        given(productItemMapper.selectList(any())).willReturn(List.of(
                itemOf(36L, 16L, 15), itemOf(37L, 17L, 10), itemOf(38L, 17L, 10),
                itemOf(39L, 99L, 1), itemOf(40L, 100L, 0)));

        var result = service.candidates();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getProductId()).isEqualTo(16L);
        assertThat(result.get(0).getItemId()).isEqualTo(36L);
        assertThat(result.get(0).getStock()).isEqualTo(15);
    }

    private ProductItem itemOf(Long id, Long productId, int stock) {
        ProductItem item = new ProductItem();
        item.setId(id);
        item.setProductId(productId);
        item.setStock(stock);
        item.setPrice(new BigDecimal("499.00"));
        return item;
    }

    private SeckillActivity activity(SeckillStatus status) {
        SeckillActivity activity = new SeckillActivity();
        activity.setId(1L);
        activity.setProductId(16L);
        activity.setSeckillStock(5);
        activity.setSoldCount(0);
        activity.setStatus(status);
        return activity;
    }

    private SeckillActivityCreateRequest request(Long productId, int stock, int limit) {
        SeckillActivityCreateRequest req = new SeckillActivityCreateRequest();
        req.setProductId(productId);
        req.setSeckillPrice(new BigDecimal("299.40"));
        req.setSeckillStock(stock);
        req.setStartTime(LocalDateTime.now().plusHours(1));
        req.setEndTime(LocalDateTime.now().plusHours(3));
        req.setLimitPerUser(limit);
        return req;
    }
}
