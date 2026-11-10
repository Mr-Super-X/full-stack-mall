package com.fullstackmall.shop.seckill.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
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
import com.fullstackmall.shop.seckill.service.SeckillService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 秒杀 C 端读模型实现。过期场推进 ENDED + 归还必须与读路径同一事务（原子性：
 * 崩溃不能出现"已 ENDED 未归还"）；live 装配批量回填商品/主图/挂载 item，禁 N+1。
 */
@Service
public class SeckillServiceImpl implements SeckillService {

    /** upcoming 展示上限（spec §3.3） */
    private static final int UPCOMING_LIMIT = 5;

    private final SeckillActivityMapper seckillActivityMapper;
    private final ProductMapper productMapper;
    private final ProductItemMapper productItemMapper;
    private final ProductImageMapper productImageMapper;

    public SeckillServiceImpl(SeckillActivityMapper seckillActivityMapper,
                              ProductMapper productMapper,
                              ProductItemMapper productItemMapper,
                              ProductImageMapper productImageMapper) {
        this.seckillActivityMapper = seckillActivityMapper;
        this.productMapper = productMapper;
        this.productItemMapper = productItemMapper;
        this.productImageMapper = productImageMapper;
    }

    @Override
    @Transactional
    public SeckillActiveDTO active() {
        LocalDateTime now = LocalDateTime.now();
        List<SeckillActivity> actives = seckillActivityMapper.selectList(Wrappers.<SeckillActivity>lambdaQuery()
                .eq(SeckillActivity::getStatus, SeckillStatus.ACTIVE));
        List<SeckillActivity> pendings = seckillActivityMapper.selectList(Wrappers.<SeckillActivity>lambdaQuery()
                .eq(SeckillActivity::getStatus, SeckillStatus.PENDING));

        // 过期 ACTIVE 惰性推进 ENDED + 归还剩余（同一事务）
        List<SeckillActivity> lives = new java.util.ArrayList<>();
        for (SeckillActivity activity : actives) {
            if (activity.getEndTime() != null && activity.getEndTime().isBefore(now)) {
                settleEnded(activity);
            } else {
                lives.add(activity);
            }
        }

        SeckillActiveDTO dto = new SeckillActiveDTO();
        dto.setLive(assembleLive(lives));
        dto.setUpcoming(pendings.stream()
                .filter(a -> a.getStartTime() != null && a.getStartTime().isAfter(now))
                .limit(UPCOMING_LIMIT)
                .map(this::toUpcomingDTO)
                .toList());
        return dto;
    }

    @Override
    public SeckillActivity findActiveByProductId(Long productId) {
        LocalDateTime now = LocalDateTime.now();
        return seckillActivityMapper.selectOne(Wrappers.<SeckillActivity>lambdaQuery()
                .eq(SeckillActivity::getProductId, productId)
                .eq(SeckillActivity::getStatus, SeckillStatus.ACTIVE)
                .le(SeckillActivity::getStartTime, now)
                .ge(SeckillActivity::getEndTime, now)
                .orderByDesc(SeckillActivity::getId)
                .last("LIMIT 1"));
    }

    /** 推进 ENDED（条件迁移行数守卫）+ 归还 product_item 未售库存 */
    private void settleEnded(SeckillActivity activity) {
        int rows = seckillActivityMapper.update(null, Wrappers.<SeckillActivity>update()
                .set("status", SeckillStatus.ENDED.name())
                .eq("id", activity.getId())
                .eq("status", SeckillStatus.ACTIVE.name()));
        if (rows == 0) {
            throw new BusinessException(ResultCode.CONSIGNMENT_STATE_ILLEGAL);
        }
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

    /** live 装配：商品标题/主图/挂载 item（原价与 productItemId）批量回填，禁 N+1 */
    private List<SeckillActiveDTO.SeckillActivityDTO> assembleLive(List<SeckillActivity> lives) {
        List<Long> productIds = lives.stream().map(SeckillActivity::getProductId).distinct().toList();
        if (productIds.isEmpty()) {
            return List.of();
        }
        Map<Long, Product> products = productMapper.selectBatchIds(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity(), (a, b) -> a));
        Map<Long, ProductItem> items = productItemMapper.selectList(Wrappers.<ProductItem>lambdaQuery()
                        .in(ProductItem::getProductId, productIds)).stream()
                .collect(Collectors.toMap(ProductItem::getProductId, Function.identity(), (a, b) -> a));
        Map<Long, String> mainImages = productImageMapper.selectList(Wrappers.<ProductImage>lambdaQuery()
                        .in(ProductImage::getProductId, productIds)).stream()
                .sorted(Comparator.comparingInt(p -> p.getSort() == null ? 0 : p.getSort()))
                .collect(Collectors.toMap(ProductImage::getProductId, ProductImage::getUrl, (a, b) -> a));

        return lives.stream().map(a -> {
            SeckillActiveDTO.SeckillActivityDTO dto = new SeckillActiveDTO.SeckillActivityDTO();
            dto.setActivityId(a.getId());
            dto.setProductId(a.getProductId());
            Product product = products.get(a.getProductId());
            dto.setProductTitle(product != null ? product.getName() : null);
            ProductItem item = items.get(a.getProductId());
            dto.setProductItemId(item != null ? item.getId() : null);
            dto.setOriginPrice(item != null ? item.getPrice() : null);
            dto.setImageUrl(mainImages.get(a.getProductId()));
            dto.setSeckillPrice(a.getSeckillPrice());
            dto.setSoldCount(a.getSoldCount());
            dto.setSeckillStock(a.getSeckillStock());
            dto.setStartTime(a.getStartTime());
            dto.setEndTime(a.getEndTime());
            return dto;
        }).toList();
    }

    private SeckillActiveDTO.SeckillActivityDTO toUpcomingDTO(SeckillActivity a) {
        SeckillActiveDTO.SeckillActivityDTO dto = new SeckillActiveDTO.SeckillActivityDTO();
        dto.setActivityId(a.getId());
        dto.setProductId(a.getProductId());
        dto.setSeckillPrice(a.getSeckillPrice());
        dto.setSoldCount(a.getSoldCount());
        dto.setSeckillStock(a.getSeckillStock());
        dto.setStartTime(a.getStartTime());
        dto.setEndTime(a.getEndTime());
        return dto;
    }

    private ProductItem soleItem(Long productId) {
        List<ProductItem> items = productItemMapper.selectList(Wrappers.<ProductItem>lambdaQuery()
                .eq(ProductItem::getProductId, productId));
        return items.isEmpty() ? null : items.get(0);
    }
}
