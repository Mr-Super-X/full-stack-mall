package com.fullstackmall.shop.payout;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.consignment.entity.ConsignmentListing;
import com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.payout.entity.Payout;
import com.fullstackmall.shop.payout.enums.PayoutStatus;
import com.fullstackmall.shop.payout.mapper.PayoutMapper;
import com.fullstackmall.shop.payout.service.PayoutService;
import com.fullstackmall.shop.payout.service.impl.PayoutServiceImpl;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

/**
 * PayoutServiceImpl 审批真逻辑单测：三步状态机（PENDING→CONFIRMED→PAID）
 * + 跳级拦截 + 重复操作拦截 + 打款联动寄卖单 SETTLED（同事务）。
 */
@ExtendWith(MockitoExtension.class)
class PayoutServiceImplTest {

    @Mock
    private PayoutMapper payoutMapper;
    @Mock
    private OrderItemMapper orderItemMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ConsignmentListingMapper consignmentListingMapper;

    private PayoutService payoutService;

    @BeforeEach
    void setUp() {
        payoutService = new PayoutServiceImpl(
                payoutMapper, orderItemMapper, productItemMapper, consignmentListingMapper);
    }

    @Test
    void firstReview_shouldTransitionToConfirmed() {
        given(payoutMapper.selectById(1L)).willReturn(payout(PayoutStatus.PENDING));
        given(payoutMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        var result = payoutService.confirm(1L);

        assertThat(result.getStatus()).isEqualTo("CONFIRMED");
        ArgumentCaptor<com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<Payout>> captor =
                ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper.class);
        verify(payoutMapper).update(org.mockito.ArgumentMatchers.isNull(), captor.capture());
        assertThat(captor.getValue().getParamNameValuePairs().values()).contains("CONFIRMED");
    }

    @Test
    void payWithoutFirstReview_shouldThrowIllegalTransition() {
        // 跳级语义：条件迁移 WHERE status='CONFIRMED' 命中 0 行（当前是 PENDING）
        given(payoutMapper.selectById(1L)).willReturn(payout(PayoutStatus.PENDING));
        given(payoutMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        assertThatThrownBy(() -> payoutService.pay(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.PAYOUT_STATE_ILLEGAL);
    }

    @Test
    void paySuccess_shouldTransitionConsignmentToSettled() {
        given(payoutMapper.selectById(1L)).willReturn(payout(PayoutStatus.CONFIRMED));
        given(payoutMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        OrderItem line = new OrderItem();
        line.setId(9L);
        line.setProductItemId(35L);
        line.setSellerId(2L);
        given(orderItemMapper.selectById(9L)).willReturn(line);
        ProductItem item = new ProductItem();
        item.setId(35L);
        item.setProductId(14L);
        given(productItemMapper.selectById(35L)).willReturn(item);
        given(consignmentListingMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        var result = payoutService.pay(1L);

        assertThat(result.getStatus()).isEqualTo("PAID");
        // 寄卖单联动：set status=SETTLED，条件 listed_product_id=14 AND status=SOLD
        ArgumentCaptor<com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper<ConsignmentListing>> captor =
                ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper.class);
        verify(consignmentListingMapper).update(org.mockito.ArgumentMatchers.isNull(), captor.capture());
        assertThat(captor.getValue().getParamNameValuePairs().values()).contains("SETTLED");
    }

    @Test
    void duplicatePay_shouldThrowIllegalTransition() {
        given(payoutMapper.selectById(1L)).willReturn(payout(PayoutStatus.PAID));
        given(payoutMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        assertThatThrownBy(() -> payoutService.pay(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.PAYOUT_STATE_ILLEGAL);
    }

    @Test
    void payoutNotFound_shouldThrow404() {
        given(payoutMapper.selectById(9L)).willReturn(null);

        assertThatThrownBy(() -> payoutService.confirm(9L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.PAYOUT_NOT_FOUND);
    }

    private Payout payout(PayoutStatus status) {
        Payout payout = new Payout();
        payout.setId(1L);
        payout.setSellerId(2L);
        payout.setOrderItemId(9L);
        payout.setSellerAmount(new BigDecimal("10880.00"));
        payout.setCommission(new BigDecimal("1920.00"));
        payout.setStatus(status);
        return payout;
    }
}
