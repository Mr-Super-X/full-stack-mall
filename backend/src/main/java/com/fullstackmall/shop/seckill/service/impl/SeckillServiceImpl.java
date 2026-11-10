package com.fullstackmall.shop.seckill.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.enums.OrderType;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.order.service.OrderNoGenerator;
import com.fullstackmall.shop.payment.entity.Payment;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.dto.SeckillActiveDTO;
import com.fullstackmall.shop.seckill.dto.SeckillOrderRequest;
import com.fullstackmall.shop.seckill.dto.SeckillOrderResultDTO;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.enums.SeckillStatus;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.service.SeckillOrderAssembler;
import com.fullstackmall.shop.seckill.service.SeckillService;
import com.fullstackmall.shop.user.context.UserContext;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
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
    private final AddressMapper addressMapper;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final SeckillOrderAssembler orderAssembler;

    public SeckillServiceImpl(SeckillActivityMapper seckillActivityMapper,
                              ProductMapper productMapper,
                              ProductItemMapper productItemMapper,
                              ProductImageMapper productImageMapper,
                              AddressMapper addressMapper,
                              OrderMapper orderMapper,
                              OrderItemMapper orderItemMapper,
                              SeckillOrderAssembler orderAssembler) {
        this.seckillActivityMapper = seckillActivityMapper;
        this.productMapper = productMapper;
        this.productItemMapper = productItemMapper;
        this.productImageMapper = productImageMapper;
        this.addressMapper = addressMapper;
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.orderAssembler = orderAssembler;
    }

    @Override
    @Transactional
    public SeckillActiveDTO active() {
        LocalDateTime now = LocalDateTime.now();
        List<SeckillActivity> actives = seckillActivityMapper.selectList(Wrappers.<SeckillActivity>lambdaQuery()
                .eq(SeckillActivity::getStatus, SeckillStatus.ACTIVE));
        List<SeckillActivity> pendings = seckillActivityMapper.selectList(Wrappers.<SeckillActivity>lambdaQuery()
                .eq(SeckillActivity::getStatus, SeckillStatus.PENDING));

        // 过期 ACTIVE 惰性推进 ENDED + 归还剩余（同一事务）；到点 PENDING 惰性激活
        List<SeckillActivity> lives = new java.util.ArrayList<>();
        for (SeckillActivity activity : actives) {
            if (activity.getEndTime() != null && activity.getEndTime().isBefore(now)) {
                settleEnded(activity);
            } else {
                lives.add(activity);
            }
        }
        List<SeckillActivity> upcomingList = new ArrayList<>();
        for (SeckillActivity pending : pendings) {
            activateIfDue(pending, now);
            if (pending.getStatus() == SeckillStatus.ACTIVE) {
                if (pending.getEndTime() != null && pending.getEndTime().isBefore(now)) {
                    settleEnded(pending);
                } else {
                    lives.add(pending);
                }
            } else if (pending.getStartTime() != null && pending.getStartTime().isAfter(now)) {
                upcomingList.add(pending);
            }
        }

        SeckillActiveDTO dto = new SeckillActiveDTO();
        dto.setLive(assembleLive(lives));
        dto.setUpcoming(upcomingList.stream()
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

    @Override
    public SeckillActiveDTO.SeckillActivityDTO findActiveItemByProductId(Long productId) {
        SeckillActivity activity = findActiveByProductId(productId);
        if (activity == null) {
            return null;
        }
        return toLiveDTO(activity, productMapper.selectById(productId),
                soleItem(productId), loadMainImage(productId));
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

        return lives.stream().map(a -> toLiveDTO(a, products.get(a.getProductId()),
                items.get(a.getProductId()), mainImages.get(a.getProductId()))).toList();
    }

    /** 单活动装配（assembleLive 批量回填与 findActiveItemByProductId 单查共用） */
    private SeckillActiveDTO.SeckillActivityDTO toLiveDTO(
            SeckillActivity a, Product product, ProductItem item, String imageUrl) {
        SeckillActiveDTO.SeckillActivityDTO dto = new SeckillActiveDTO.SeckillActivityDTO();
        dto.setActivityId(a.getId());
        dto.setProductId(a.getProductId());
        dto.setProductTitle(product != null ? product.getName() : null);
        dto.setProductItemId(item != null ? item.getId() : null);
        dto.setOriginPrice(item != null ? item.getPrice() : null);
        dto.setImageUrl(imageUrl);
        dto.setSeckillPrice(a.getSeckillPrice());
        dto.setSoldCount(a.getSoldCount());
        dto.setSeckillStock(a.getSeckillStock());
        dto.setStartTime(a.getStartTime());
        dto.setEndTime(a.getEndTime());
        return dto;
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

    // ── 秒杀下单（spec §3.4 七步事务）─────────────────────────────

    @Override
    @Transactional
    public SeckillOrderResultDTO placeOrder(Long activityId, SeckillOrderRequest req) {
        Long userId = UserContext.getRequired().userId();
        LocalDateTime now = LocalDateTime.now();
        // 1. 查活动
        SeckillActivity activity = seckillActivityMapper.selectById(activityId);
        if (activity == null) {
            throw new BusinessException(ResultCode.SECKILL_NOT_FOUND);
        }
        // 2. 惰性推进：到点 PENDING 激活；过期 ACTIVE 推进 ENDED + 归还；其余非 ACTIVE 态拒绝
        activateIfDue(activity, now);
        if (activity.getStatus() == SeckillStatus.ACTIVE
                && activity.getEndTime() != null && activity.getEndTime().isBefore(now)) {
            settleEnded(activity);
        }
        if (activity.getStatus() != SeckillStatus.ACTIVE
                || activity.getStartTime() == null || activity.getStartTime().isAfter(now)
                || activity.getEndTime() == null || activity.getEndTime().isBefore(now)) {
            throw new BusinessException(ResultCode.SECKILL_NOT_STARTED);
        }
        // 3. 挂载校验：商品在售 + item 为挂载商品唯一 SKU 且与入参匹配
        Product product = productMapper.selectById(activity.getProductId());
        ProductItem item = soleItem(activity.getProductId());
        if (product == null || product.getStatus() != 1 || item == null
                || !item.getId().equals(req.getProductItemId())) {
            throw new BusinessException(ResultCode.SECKILL_NOT_STARTED, "秒杀商品已下架或规格不匹配");
        }
        // 4. 限购（先查数体验层；并发兜底靠 uk_user_activity 撞线 → 40004）
        Long orderCount = orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                .eq(Order::getUserId, userId)
                .eq(Order::getSeckillActivityId, activityId));
        if (orderCount != null && orderCount >= 1) {
            throw new BusinessException(ResultCode.LIMIT_EXCEEDED);
        }
        // 5. 扣独立池（条件更新行数守卫）
        deductStock(activityId);
        // 6. 建单（快照定格秒杀价；撞 uk_user_activity → 40004）——三步委托 Assembler，与 MQ 异步路径共用
        try {
            Address address = requireAddress(userId, req.getAddressId());
            Order order = insertOrderWithRetry(userId, activity, address);
            OrderItem line = orderAssembler.buildLine(item, product,
                    activity.getSeckillPrice(), loadMainImage(product.getId()));
            line.setOrderId(order.getId());
            orderItemMapper.insert(line);
            Payment payment = orderAssembler.insertPayment(order.getId(), activity.getSeckillPrice());
            return new SeckillOrderResultDTO(order.getOrderNo(), payment.getPaymentNo());
        } catch (DuplicateKeyException e) {
            throw new BusinessException(ResultCode.DUPLICATE_ORDER);
        }
    }

    /** 扣减独立池（4b 演进位：Redis DECR + Lua 替换本方法内部实现） */
    @Override
    public void deductStock(Long activityId) {
        int rows = seckillActivityMapper.update(null, Wrappers.<SeckillActivity>update()
                .setSql("sold_count = sold_count + 1")
                .eq("id", activityId)
                .ltSql("sold_count", "seckill_stock"));
        if (rows == 0) {
            throw new BusinessException(ResultCode.SOLD_OUT);
        }
    }

    /** PENDING 到点激活（条件迁移行数守卫；并发激活只放行一个） */
    private void activateIfDue(SeckillActivity activity, LocalDateTime now) {
        if (activity.getStatus() == SeckillStatus.PENDING
                && activity.getStartTime() != null && !activity.getStartTime().isAfter(now)) {
            int rows = seckillActivityMapper.update(null, Wrappers.<SeckillActivity>update()
                    .set("status", SeckillStatus.ACTIVE.name())
                    .eq("id", activity.getId())
                    .eq("status", SeckillStatus.PENDING.name()));
            if (rows > 0) {
                activity.setStatus(SeckillStatus.ACTIVE);
            }
        }
    }

    private Address requireAddress(Long userId, Long addressId) {
        Address address = addressMapper.selectOne(Wrappers.<Address>lambdaQuery()
                .eq(Address::getId, addressId)
                .eq(Address::getUserId, userId));
        if (address == null) {
            throw new BusinessException(ResultCode.ADDRESS_NOT_FOUND);
        }
        return address;
    }

    /**
     * 同步路径 orderNo uk 撞库换号重试 ≤3 次（异步路径 orderNo 预生成，不存在 uk 冲突问题，
     * 直接走 Assembler 单发）。uk_user_activity 撞线由调用方转 40004。
     */
    private Order insertOrderWithRetry(Long userId, SeckillActivity activity, Address address) {
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                return orderAssembler.insertOrder(userId, activity, address, OrderNoGenerator.orderNo());
            } catch (DuplicateKeyException e) {
                if (attempt == 2) {
                    throw e;
                }
            }
        }
        throw new BusinessException(ResultCode.INTERNAL_ERROR);
    }

    private String loadMainImage(Long productId) {
        ProductImage image = productImageMapper.selectOne(Wrappers.<ProductImage>lambdaQuery()
                .eq(ProductImage::getProductId, productId)
                .orderByAsc(ProductImage::getSort)
                .last("LIMIT 1"));
        return image != null ? image.getUrl() : null;
    }

    private ProductItem soleItem(Long productId) {
        List<ProductItem> items = productItemMapper.selectList(Wrappers.<ProductItem>lambdaQuery()
                .eq(ProductItem::getProductId, productId));
        return items.isEmpty() ? null : items.get(0);
    }
}
