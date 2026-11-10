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
import com.fullstackmall.shop.seckill.mq.SeckillOrderCreateProducer;
import com.fullstackmall.shop.seckill.mq.SeckillOrderMessage;
import com.fullstackmall.shop.seckill.service.RedisStockDeductor;
import com.fullstackmall.shop.seckill.service.SeckillDeductStrategy;
import com.fullstackmall.shop.seckill.service.SeckillOrderAssembler;
import com.fullstackmall.shop.seckill.service.SeckillProperties;
import com.fullstackmall.shop.seckill.service.SeckillService;
import com.fullstackmall.shop.seckill.service.DbPessimisticDeductor;
import com.fullstackmall.shop.seckill.entity.SeckillOrderAcceptance;
import com.fullstackmall.shop.user.context.UserContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

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
@Slf4j
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
    private final SeckillProperties seckillProperties;
    private final DbPessimisticDeductor pessimisticDeductor;
    private final com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper seckillOrderAcceptanceMapper;
    private final RedisStockDeductor redisStockDeductor;
    private final SeckillOrderCreateProducer seckillOrderCreateProducer;

    public SeckillServiceImpl(SeckillActivityMapper seckillActivityMapper,
                              ProductMapper productMapper,
                              ProductItemMapper productItemMapper,
                              ProductImageMapper productImageMapper,
                              AddressMapper addressMapper,
                              OrderMapper orderMapper,
                              OrderItemMapper orderItemMapper,
                              SeckillOrderAssembler orderAssembler,
                              SeckillProperties seckillProperties,
                              DbPessimisticDeductor pessimisticDeductor,
                              com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper seckillOrderAcceptanceMapper,
                              RedisStockDeductor redisStockDeductor,
                              SeckillOrderCreateProducer seckillOrderCreateProducer) {
        this.seckillActivityMapper = seckillActivityMapper;
        this.productMapper = productMapper;
        this.productItemMapper = productItemMapper;
        this.productImageMapper = productImageMapper;
        this.addressMapper = addressMapper;
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.orderAssembler = orderAssembler;
        this.seckillProperties = seckillProperties;
        this.pessimisticDeductor = pessimisticDeductor;
        this.seckillOrderAcceptanceMapper = seckillOrderAcceptanceMapper;
        this.redisStockDeductor = redisStockDeductor;
        this.seckillOrderCreateProducer = seckillOrderCreateProducer;
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
        // 4b 生命周期挂接：活动结束摘除 Redis 关口（失败仅 warn）
        if (seckillProperties.getStrategy() == SeckillDeductStrategy.REDIS) {
            redisStockDeductor.dropStock(activity.getId());
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
        // 5. redis 策略：Lua 预扣 + 受理落库 + 提交后发 MQ，受理即返（异步出单，spec §5.3b）
        if (seckillProperties.getStrategy() == SeckillDeductStrategy.REDIS) {
            return placeOrderRedis(userId, activity, item, req);
        }
        // 6. 扣独立池：optimistic 条件更新 / pessimistic FOR UPDATE（对照实验公平性——前后置步骤一致）
        switch (seckillProperties.getStrategy()) {
            case PESSIMISTIC -> pessimisticDeductor.deduct(activityId);
            default -> deductStock(activityId);
        }
        // 7. 建单（快照定格秒杀价；撞 uk_user_activity → 40004）——三步委托 Assembler，与 MQ 异步路径共用
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

    @Override
    @Transactional
    public void fulfillSeckillOrder(com.fullstackmall.shop.seckill.mq.SeckillOrderMessage message) {
        // 幂等查重：消息重投/重复消费直返（orderNo 即幂等键）
        Long exists = orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                .eq(Order::getOrderNo, message.orderNo()));
        if (exists != null && exists > 0) {
            return;
        }
        // 重查快照源（DB 是真相，消息不带冗余快照）
        SeckillActivity activity = seckillActivityMapper.selectById(message.activityId());
        if (activity == null) {
            throw new BusinessException(ResultCode.SECKILL_NOT_FOUND);
        }
        Product product = productMapper.selectById(activity.getProductId());
        ProductItem item = productItemMapper.selectById(message.productItemId());
        Address address = requireAddress(message.userId(), message.addressId());
        // redis 路径 sold_count 与订单同事务 +1（终审 Critical-2：缺这步则 key 自愈重建恒满血 → 超卖；
        // 条件守卫防预扣后活动库存被并发改小，行数 0 视为抢完——预扣与落库出现裂口时宁可少卖）
        int rows = seckillActivityMapper.update(null, Wrappers.<SeckillActivity>update()
                .setSql("sold_count = sold_count + 1")
                .eq("id", activity.getId())
                .ltSql("sold_count", "seckill_stock"));
        if (rows == 0) {
            throw new BusinessException(ResultCode.SOLD_OUT);
        }
        // 建单三步与同步路径完全同一套代码（对照实验公平性前提，spec §13#10）
        Order order = orderAssembler.insertOrder(message.userId(), activity, address, message.orderNo());
        OrderItem line = orderAssembler.buildLine(item, product, message.seckillPrice(),
                loadMainImage(product.getId()));
        line.setOrderId(order.getId());
        orderItemMapper.insert(line);
        orderAssembler.insertPayment(order.getId(), message.seckillPrice());
        // 受理表推进 CREATED（条件更新防并发双推）
        seckillOrderAcceptanceMapper.update(null, Wrappers.<com.fullstackmall.shop.seckill.entity.SeckillOrderAcceptance>update()
                .set("status", "CREATED")
                .eq("order_no", message.orderNo())
                .eq("status", "ACCEPTED"));
    }

    @Override
    public com.fullstackmall.shop.seckill.dto.SeckillOrderStatusDTO queryOrderStatus(String orderNo) {
        Long userId = UserContext.getRequired().userId();
        // ① 订单表优先：已建单（含支付号）——归属校验防越权探测（Review Focus #4）
        Map<String, Object> orderRow = orderMapper.selectWithPaymentByOrderNo(orderNo);
        if (orderRow != null) {
            Long ownerId = ((Number) orderRow.get("user_id")).longValue();
            if (!ownerId.equals(userId)) {
                throw new BusinessException(ResultCode.ORDER_NOT_FOUND);
            }
            return new com.fullstackmall.shop.seckill.dto.SeckillOrderStatusDTO(
                    "CREATED", (String) orderRow.get("payment_no"));
        }
        // ② 受理表回退：ACCEPTED（受理中）/ FAILED（死信登记，库存已回补）
        SeckillOrderAcceptance acceptance = seckillOrderAcceptanceMapper.selectOne(
                Wrappers.<SeckillOrderAcceptance>lambdaQuery()
                        .eq(SeckillOrderAcceptance::getOrderNo, orderNo)
                        .eq(SeckillOrderAcceptance::getUserId, userId));
        if (acceptance == null) {
            throw new BusinessException(ResultCode.ORDER_NOT_FOUND);
        }
        return new com.fullstackmall.shop.seckill.dto.SeckillOrderStatusDTO(acceptance.getStatus(), null);
    }

    /** PENDING 到点激活（条件迁移行数守卫；并发激活只放行一个）+ redis 关口初始化 */
    private void activateIfDue(SeckillActivity activity, LocalDateTime now) {
        if (activity.getStatus() == SeckillStatus.PENDING
                && activity.getStartTime() != null && !activity.getStartTime().isAfter(now)) {
            int rows = seckillActivityMapper.update(null, Wrappers.<SeckillActivity>update()
                    .set("status", SeckillStatus.ACTIVE.name())
                    .eq("id", activity.getId())
                    .eq("status", SeckillStatus.PENDING.name()));
            if (rows > 0) {
                activity.setStatus(SeckillStatus.ACTIVE);
                // 4b 生命周期挂接：激活即初始化 Redis 关口（失败仅 warn——下单路径 key 缺失自愈重建）
                if (seckillProperties.getStrategy() == SeckillDeductStrategy.REDIS) {
                    redisStockDeductor.initStock(activity.getId(),
                            activity.getSeckillStock()
                                    - (activity.getSoldCount() == null ? 0 : activity.getSoldCount()));
                }
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
     * redis 策略受理时序（spec §5.3b）：Lua 预扣（DB 事务外先行）→ 地址校验 + 受理记录（同事务）
     * → 事务提交后发 MQ（TransactionSynchronization.afterCommit，防"消息已发事务回滚"幽灵订单）
     * → 受理即返。事务回滚或发送失败均补偿 Redis INCR（Review Focus #2：漏补偿即少卖）。
     */
    private SeckillOrderResultDTO placeOrderRedis(Long userId, SeckillActivity activity,
                                                  ProductItem item, SeckillOrderRequest req) {
        String orderNo = OrderNoGenerator.orderNo();
        // 1. Lua 预扣（SOLD_OUT/LIMITED/UNAVAILABLE 直接抛，无补偿——未受理不欠库存）
        redisStockDeductor.deduct(activity.getId(), userId, orderNo);
        // 2. DB 事务段：地址校验 + 受理记录（任何异常回滚并补偿 Redis 关口）
        try {
            requireAddress(userId, req.getAddressId());
            SeckillOrderAcceptance acceptance = new SeckillOrderAcceptance();
            acceptance.setOrderNo(orderNo);
            acceptance.setActivityId(activity.getId());
            acceptance.setUserId(userId);
            acceptance.setStatus("ACCEPTED");
            seckillOrderAcceptanceMapper.insert(acceptance);
        } catch (RuntimeException e) {
            redisStockDeductor.restoreStock(activity.getId());
            throw e;
        }
        // 3. 事务提交后发送 MQ（无事务上下文时直接发——单测/无代理场景路径）
        SeckillOrderMessage mqMessage = new SeckillOrderMessage(orderNo, activity.getId(), userId,
                item.getId(), req.getAddressId(), activity.getSeckillPrice(), LocalDateTime.now());
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            Long activityId = activity.getId();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    sendAfterCommit(orderNo, activityId, mqMessage);
                }
            });
        } else {
            sendAfterCommit(orderNo, activity.getId(), mqMessage);
        }
        return new SeckillOrderResultDTO(orderNo, null);
    }

    /** MQ 发送 + 失败补偿（spec §5.3b：受理表置 FAILED + Redis 回补，告知轮询端点失败语义） */
    private void sendAfterCommit(String orderNo, Long activityId, SeckillOrderMessage mqMessage) {
        try {
            seckillOrderCreateProducer.send(mqMessage);
        } catch (Exception e) {
            log.error("[seckill] 受理后发送 MQ 失败，补偿回补（受理 FAILED + 库存 INCR）orderNo={}", orderNo, e);
            seckillOrderAcceptanceMapper.update(null, Wrappers.<SeckillOrderAcceptance>update()
                    .set("status", "FAILED")
                    .eq("order_no", orderNo)
                    .eq("status", "ACCEPTED"));
            redisStockDeductor.restoreStock(activityId);
            throw new BusinessException(ResultCode.SECKILL_UNAVAILABLE);
        }
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
