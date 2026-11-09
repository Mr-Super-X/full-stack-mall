package com.fullstackmall.shop.payout.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.consignment.entity.ConsignmentListing;
import com.fullstackmall.shop.consignment.enums.ConsignmentStatus;
import com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.payout.dto.PayoutDTO;
import com.fullstackmall.shop.payout.entity.Payout;
import com.fullstackmall.shop.payout.enums.PayoutStatus;
import com.fullstackmall.shop.payout.mapper.PayoutMapper;
import com.fullstackmall.shop.payout.service.PayoutService;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * 结算业务实现。状态迁移走条件更新（字符串列名 UpdateWrapper，同订单/寄卖同范式）；
 * 打款与寄卖单 SETTLED 联动同在一个 @Transactional——任一失败整体回滚，不留中间态。
 */
@Service
public class PayoutServiceImpl implements PayoutService {

    private final PayoutMapper payoutMapper;
    private final OrderItemMapper orderItemMapper;
    private final ProductItemMapper productItemMapper;
    private final ConsignmentListingMapper consignmentListingMapper;

    public PayoutServiceImpl(PayoutMapper payoutMapper, OrderItemMapper orderItemMapper,
                             ProductItemMapper productItemMapper,
                             ConsignmentListingMapper consignmentListingMapper) {
        this.payoutMapper = payoutMapper;
        this.orderItemMapper = orderItemMapper;
        this.productItemMapper = productItemMapper;
        this.consignmentListingMapper = consignmentListingMapper;
    }

    @Override
    public List<PayoutDTO> adminList(String status) {
        PayoutStatus target;
        try {
            target = PayoutStatus.valueOf(StringUtils.hasText(status) ? status : "PENDING");
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        List<Payout> payouts = payoutMapper.selectList(Wrappers.<Payout>lambdaQuery()
                .eq(Payout::getStatus, target)
                .orderByDesc(Payout::getId));
        return payouts.stream().map(this::toDTO).toList();
    }

    @Override
    @Transactional
    public PayoutDTO confirm(Long id) {
        Payout payout = requirePayout(id);
        migrateStatus(id, PayoutStatus.CONFIRMED, PayoutStatus.PENDING);
        payout.setStatus(PayoutStatus.CONFIRMED);
        return toDTO(payout);
    }

    @Override
    @Transactional
    public PayoutDTO pay(Long id) {
        Payout payout = requirePayout(id);
        migrateStatus(id, PayoutStatus.PAID, PayoutStatus.CONFIRMED);
        // 联动寄卖单 SOLD→SETTLED（同事务；行数 0 幂等容忍——并发已结算/寄卖单已归档）
        OrderItem line = orderItemMapper.selectById(payout.getOrderItemId());
        if (line != null) {
            ProductItem item = productItemMapper.selectById(line.getProductItemId());
            if (item != null) {
                consignmentListingMapper.update(null, Wrappers.<ConsignmentListing>update()
                        .set("status", ConsignmentStatus.SETTLED.name())
                        .eq("listed_product_id", item.getProductId())
                        .eq("status", ConsignmentStatus.SOLD.name()));
            }
        }
        payout.setStatus(PayoutStatus.PAID);
        return toDTO(payout);
    }

    /** 按 id 取结算单；不存在一律 404 */
    private Payout requirePayout(Long id) {
        Payout payout = payoutMapper.selectById(id);
        if (payout == null) {
            throw new BusinessException(ResultCode.PAYOUT_NOT_FOUND);
        }
        return payout;
    }

    /** 结算状态条件迁移：UPDATE ... SET status=to WHERE id=? AND status=from，行数 0 即非法流转 */
    private void migrateStatus(Long id, PayoutStatus to, PayoutStatus from) {
        int rows = payoutMapper.update(null, Wrappers.<Payout>update()
                .set("status", to.name())
                .eq("id", id)
                .eq("status", from.name()));
        if (rows == 0) {
            throw new BusinessException(ResultCode.PAYOUT_STATE_ILLEGAL);
        }
    }

    private PayoutDTO toDTO(Payout payout) {
        PayoutDTO dto = new PayoutDTO();
        BeanUtils.copyProperties(payout, dto);
        dto.setStatus(payout.getStatus().name());
        return dto;
    }
}
