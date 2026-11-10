package com.fullstackmall.shop.seckill.service.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.dto.SeckillActivityAdminDTO;
import com.fullstackmall.shop.seckill.dto.SeckillActivityCreateRequest;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.service.SeckillAdminService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 秒杀场次管理实现。划拨/归还走字符串列名 UpdateWrapper（条件更新行数守卫，
 * 同 OrderServiceImpl 既定风格）；状态迁移唯一关口是条件 UPDATE 影响行数。
 */
@Service
public class SeckillAdminServiceImpl implements SeckillAdminService {

    private final SeckillActivityMapper seckillActivityMapper;
    private final ProductMapper productMapper;
    private final ProductItemMapper productItemMapper;

    public SeckillAdminServiceImpl(SeckillActivityMapper seckillActivityMapper,
                                   ProductMapper productMapper,
                                   ProductItemMapper productItemMapper) {
        this.seckillActivityMapper = seckillActivityMapper;
        this.productMapper = productMapper;
        this.productItemMapper = productItemMapper;
    }

    @Override
    @Transactional
    public SeckillActivityAdminDTO create(SeckillActivityCreateRequest req) {
        // 限购固化：本期仅允许 1（uk_user_activity 语义自洽，放开限购是 v2 话题）
        if (req.getLimitPerUser() == null || req.getLimitPerUser() != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "本期限购固定为 1 件");
        }
        if (req.getStartTime() == null || req.getEndTime() == null
                || !req.getStartTime().isBefore(req.getEndTime())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "起止时间不合法");
        }
        Product product = productMapper.selectById(req.getProductId());
        if (product == null || product.getOwnerType() != OwnerType.PLATFORM || product.getStatus() != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "秒杀仅支持上架中的单 SKU 自营商品");
        }
        List<ProductItem> items = productItemMapper.selectList(Wrappers.<ProductItem>lambdaQuery()
                .eq(ProductItem::getProductId, req.getProductId()));
        if (items.size() != 1) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "秒杀仅支持单 SKU 商品");
        }
        ProductItem item = items.get(0);
        // 划拨：stock = stock - N WHERE id AND stock >= N；行数 0 即存量不足或被并发划拨抢占
        int rows = productItemMapper.update(null, Wrappers.<ProductItem>update()
                .setSql("stock = stock - " + req.getSeckillStock() + ", version = version + 1")
                .eq("id", item.getId())
                .ge("stock", req.getSeckillStock()));
        if (rows == 0) {
            throw new BusinessException(ResultCode.STOCK_NOT_ENOUGH);
        }

        SeckillActivity activity = new SeckillActivity();
        activity.setProductId(req.getProductId());
        activity.setSeckillPrice(req.getSeckillPrice());
        activity.setSeckillStock(req.getSeckillStock());
        activity.setSoldCount(0);
        activity.setStartTime(req.getStartTime());
        activity.setEndTime(req.getEndTime());
        activity.setLimitPerUser(1);
        activity.setStatus(SeckillStatus.PENDING);
        seckillActivityMapper.insert(activity);
        return toAdminDTO(activity, product.getName());
    }

    @Override
    @Transactional
    public void cancel(Long activityId) {
        SeckillActivity activity = seckillActivityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(ResultCode.SECKILL_NOT_FOUND);
        }
        int rows = seckillActivityMapper.update(null, Wrappers.<SeckillActivity>update()
                .set("status", SeckillStatus.CANCELLED.name())
                .eq("id", activityId)
                .eq("status", SeckillStatus.PENDING.name()));
        if (rows == 0) {
            throw new BusinessException(ResultCode.CONSIGNMENT_STATE_ILLEGAL);
        }
        // 归还未售部分（PENDING 期 soldCount 恒 0，防御未来变更用差值）
        int remain = activity.getSeckillStock() - (activity.getSoldCount() == null ? 0 : activity.getSoldCount());
        if (remain > 0) {
            ProductItem item = soleItem(activity.getProductId());
            if (item != null) {
                productItemMapper.update(null, Wrappers.<ProductItem>update()
                        .setSql("stock = stock + " + remain + ", version = version + 1")
                        .eq("id", item.getId()));
            }
        }
    }

    @Override
    public PageResult<SeckillActivityAdminDTO> page(String status, int page, int pageSize) {
        IPage<SeckillActivity> result = seckillActivityMapper.selectPage(new Page<>(page, pageSize),
                Wrappers.<SeckillActivity>lambdaQuery()
                        .eq(StringUtils.hasText(status), SeckillActivity::getStatus, status)
                        .orderByDesc(SeckillActivity::getId));
        List<SeckillActivity> records = result.getRecords();
        // 商品标题批量回填，禁 N+1
        Map<Long, String> titles = records.isEmpty() ? Map.of()
                : productMapper.selectBatchIds(records.stream().map(SeckillActivity::getProductId).distinct().toList())
                        .stream().collect(Collectors.toMap(Product::getId, Product::getName, (a, b) -> a));
        PageResult<SeckillActivityAdminDTO> dto = new PageResult<>();
        dto.setList(records.stream()
                .map(a -> toAdminDTO(a, titles.get(a.getProductId()))).toList());
        dto.setTotal(result.getTotal());
        dto.setPage(result.getCurrent());
        dto.setPageSize(result.getSize());
        return dto;
    }

    private ProductItem soleItem(Long productId) {
        List<ProductItem> items = productItemMapper.selectList(Wrappers.<ProductItem>lambdaQuery()
                .eq(ProductItem::getProductId, productId));
        return items.isEmpty() ? null : items.get(0);
    }

    private SeckillActivityAdminDTO toAdminDTO(SeckillActivity activity, String productTitle) {
        SeckillActivityAdminDTO dto = new SeckillActivityAdminDTO();
        dto.setId(activity.getId());
        dto.setProductId(activity.getProductId());
        dto.setProductTitle(productTitle);
        dto.setSeckillPrice(activity.getSeckillPrice());
        dto.setSeckillStock(activity.getSeckillStock());
        dto.setSoldCount(activity.getSoldCount());
        dto.setStartTime(activity.getStartTime());
        dto.setEndTime(activity.getEndTime());
        dto.setLimitPerUser(activity.getLimitPerUser());
        dto.setStatus(activity.getStatus() != null ? activity.getStatus().name() : null);
        return dto;
    }
}
