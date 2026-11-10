package com.fullstackmall.shop.order.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.cart.entity.CartItem;
import com.fullstackmall.shop.cart.mapper.CartItemMapper;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.dto.AddressSnapshotDTO;
import com.fullstackmall.shop.order.dto.CreateOrderRequest;
import com.fullstackmall.shop.order.dto.OrderDTO;
import com.fullstackmall.shop.order.dto.OrderItemDTO;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.enums.OrderType;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.order.service.OrderNoGenerator;
import com.fullstackmall.shop.order.service.OrderService;
import com.fullstackmall.shop.consignment.entity.ConsignmentListing;
import com.fullstackmall.shop.consignment.enums.ConsignmentStatus;
import com.fullstackmall.shop.consignment.mapper.ConsignmentListingMapper;
import com.fullstackmall.shop.payment.entity.Payment;
import com.fullstackmall.shop.payout.entity.Payout;
import com.fullstackmall.shop.payout.enums.PayoutStatus;
import com.fullstackmall.shop.payout.mapper.PayoutMapper;
import com.fullstackmall.shop.payment.enums.PayChannel;
import com.fullstackmall.shop.payment.enums.PaymentStatus;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.user.context.UserContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 订单业务实现。下单是单一事务（快照 + 条件扣库存 + 清购物车 + 建支付单）；
 * 扣减与状态迁移一律字符串列名 UpdateWrapper 条件更新（纯单测无 Lambda 缓存依赖）。
 */
@Slf4j
@Service
public class OrderServiceImpl implements OrderService {

    /** 超时关单分钟数（惰性关单：查询时发现超时未支付即取消 + 还库存） */
    private static final int ORDER_EXPIRE_MINUTES = 15;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final CartItemMapper cartItemMapper;
    private final ProductItemMapper productItemMapper;
    private final ProductMapper productMapper;
    private final ProductImageMapper productImageMapper;
    private final PaymentMapper paymentMapper;
    private final AddressMapper addressMapper;
    private final PayoutMapper payoutMapper;
    private final ConsignmentListingMapper consignmentListingMapper;
    private final SeckillActivityMapper seckillActivityMapper;
    private final com.fullstackmall.shop.seckill.service.SeckillProperties seckillProperties;
    private final com.fullstackmall.shop.seckill.service.RedisStockDeductor redisStockDeductor;

    public OrderServiceImpl(OrderMapper orderMapper, OrderItemMapper orderItemMapper,
                            CartItemMapper cartItemMapper, ProductItemMapper productItemMapper,
                            ProductMapper productMapper, ProductImageMapper productImageMapper,
                            PaymentMapper paymentMapper, AddressMapper addressMapper,
                            PayoutMapper payoutMapper, ConsignmentListingMapper consignmentListingMapper,
                            SeckillActivityMapper seckillActivityMapper,
                            com.fullstackmall.shop.seckill.service.SeckillProperties seckillProperties,
                            com.fullstackmall.shop.seckill.service.RedisStockDeductor redisStockDeductor) {
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.cartItemMapper = cartItemMapper;
        this.productItemMapper = productItemMapper;
        this.productMapper = productMapper;
        this.productImageMapper = productImageMapper;
        this.paymentMapper = paymentMapper;
        this.addressMapper = addressMapper;
        this.payoutMapper = payoutMapper;
        this.consignmentListingMapper = consignmentListingMapper;
        this.seckillActivityMapper = seckillActivityMapper;
        this.seckillProperties = seckillProperties;
        this.redisStockDeductor = redisStockDeductor;
    }

    @Override
    @Transactional
    public OrderDTO create(CreateOrderRequest req) {
        Long userId = UserContext.getRequired().userId();
        if (req.getSource() == CreateOrderRequest.Source.DIRECT) {
            if (req.getProductItemId() == null) {
                throw new BusinessException(ResultCode.BAD_REQUEST);
            }
            return directCreate(userId, req);
        }
        if (req.getCartItemIds() == null || req.getCartItemIds().isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        return cartCreate(userId, req);
    }

    // ── CART：购物车结算 ─────────────────────────────────────────

    private OrderDTO cartCreate(Long userId, CreateOrderRequest req) {
        Address address = requireAddress(userId, req.getAddressId());

        // 购物车行归属双条件（id ∈ ids AND user_id = 本人）；行数不符说明含他人条目
        List<CartItem> rows = cartItemMapper.selectList(Wrappers.<CartItem>lambdaQuery()
                .in(CartItem::getId, req.getCartItemIds())
                .eq(CartItem::getUserId, userId));
        if (rows.size() != req.getCartItemIds().size()) {
            throw new BusinessException(ResultCode.CART_ITEM_NOT_FOUND);
        }

        Map<Long, ProductItem> itemMap = productItemMapper.selectBatchIds(
                        rows.stream().map(CartItem::getProductItemId).toList())
                .stream().collect(Collectors.toMap(ProductItem::getId, Function.identity()));
        List<Long> productIds = itemMap.values().stream().map(ProductItem::getProductId).distinct().toList();
        Map<Long, Product> productMap = productMapper.selectBatchIds(productIds)
                .stream().collect(Collectors.toMap(Product::getId, Function.identity()));
        Map<Long, String> mainImages = loadMainImages(productIds);

        // 逐行：失效校验 + 条件扣库存 + 快照行 + 累计金额
        BigDecimal payAmount = BigDecimal.ZERO;
        List<OrderItem> lines = new ArrayList<>();
        for (CartItem row : rows) {
            ProductItem item = itemMap.get(row.getProductItemId());
            Product product = item != null ? productMap.get(item.getProductId()) : null;
            if (item == null || product == null
                    || product.getStatus() == null || product.getStatus() != 1) {
                throw new BusinessException(ResultCode.STOCK_NOT_ENOUGH);
            }
            deductStock(item.getId(), row.getQuantity());
            lines.add(buildSnapshotLine(item, product, mainImages.get(product.getId()), row.getQuantity()));
            payAmount = payAmount.add(item.getPrice().multiply(BigDecimal.valueOf(row.getQuantity())));
        }

        Order order = insertOrderWithRetry(userId, payAmount, address);
        for (OrderItem line : lines) {
            line.setOrderId(order.getId());
            orderItemMapper.insert(line);
        }
        // 结算后清掉已下单的购物车行
        cartItemMapper.deleteBatchIds(req.getCartItemIds());

        Payment payment = insertPayment(order.getId(), payAmount);
        return toDTO(order, lines, payment);
    }

    // ── DIRECT：寄卖直购（库存恒 1，quantity 恒 1，不走购物车） ───────

    private OrderDTO directCreate(Long userId, CreateOrderRequest req) {
        Address address = requireAddress(userId, req.getAddressId());
        ProductItem item = productItemMapper.selectById(req.getProductItemId());
        if (item == null) {
            throw new BusinessException(ResultCode.PRODUCT_NOT_FOUND);
        }
        Product product = requireProduct(item.getProductId());
        if (product.getOwnerType() != OwnerType.CONSIGNMENT) {
            // 自营商品有库存池，必须走购物车批量结算；直购通道只服务寄卖单件
            throw new BusinessException(ResultCode.BAD_REQUEST);
        }
        // 条件扣库存：寄卖 stock 1→0，命中 0 行即已被他人抢先（并发/重复下单兜底）
        deductStock(item.getId(), 1);

        Map<Long, String> mainImages = loadMainImages(List.of(product.getId()));
        OrderItem line = buildSnapshotLine(item, product, mainImages.get(product.getId()), 1);
        Order order = insertOrderWithRetry(userId, item.getPrice(), address);
        line.setOrderId(order.getId());
        orderItemMapper.insert(line);

        Payment payment = insertPayment(order.getId(), item.getPrice());
        return toDTO(order, List.of(line), payment);
    }

    private Product requireProduct(Long id) {
        Product product = productMapper.selectById(id);
        if (product == null) {
            throw new BusinessException(ResultCode.PRODUCT_NOT_FOUND);
        }
        return product;
    }

    // ── 共用件 ──────────────────────────────────────────────────

    private Address requireAddress(Long userId, Long addressId) {
        Address address = addressMapper.selectOne(Wrappers.<Address>lambdaQuery()
                .eq(Address::getId, addressId)
                .eq(Address::getUserId, userId));
        if (address == null) {
            throw new BusinessException(ResultCode.ADDRESS_NOT_FOUND);
        }
        return address;
    }

    /** 条件扣库存：UPDATE...SET stock=stock-q, version=version+1 WHERE id=? AND stock>=q；行数 0 即回滚 */
    private void deductStock(Long itemId, int quantity) {
        int rows = productItemMapper.update(null, Wrappers.<ProductItem>update()
                .setSql("stock = stock - " + quantity + ", version = version + 1")
                .eq("id", itemId)
                .ge("stock", quantity));
        if (rows == 0) {
            throw new BusinessException(ResultCode.STOCK_NOT_ENOUGH);
        }
    }

    /** 快照行构造：定格下单瞬间的标题/图/成色/规格/品牌/货源 + 成交价 + 卖家 */
    private OrderItem buildSnapshotLine(ProductItem item, Product product, String imageUrl, int quantity) {
        OrderItem line = new OrderItem();
        line.setProductItemId(item.getId());
        line.setPrice(item.getPrice());
        line.setQuantity(quantity);
        line.setSellerId(product.getOwnerType() == OwnerType.CONSIGNMENT ? product.getSellerId() : null);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("title", product.getName());
        snapshot.put("imageUrl", imageUrl);
        snapshot.put("conditionGrade", item.getConditionGrade() != null ? item.getConditionGrade().name() : null);
        snapshot.put("size", item.getSize());
        snapshot.put("color", item.getColor());
        snapshot.put("brand", product.getBrand());
        snapshot.put("ownerType", product.getOwnerType() != null ? product.getOwnerType().name() : null);
        try {
            line.setItemSnapshot(OBJECT_MAPPER.writeValueAsString(snapshot));
        } catch (Exception e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR);
        }
        return line;
    }

    /** 订单写入（订单号 uk 冲突换号重试 ≤3 次） */
    private Order insertOrderWithRetry(Long userId, BigDecimal payAmount, Address address) {
        Order order = new Order();
        order.setUserId(userId);
        order.setType(OrderType.NORMAL);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setPayAmount(payAmount);
        order.setAddressSnapshot(addressJson(address));
        order.setExpiredAt(LocalDateTime.now().plusMinutes(ORDER_EXPIRE_MINUTES));
        for (int attempt = 0; attempt < 3; attempt++) {
            order.setOrderNo(OrderNoGenerator.orderNo());
            try {
                orderMapper.insert(order);
                return order;
            } catch (DuplicateKeyException e) {
                if (attempt == 2) {
                    throw e;
                }
            }
        }
        throw new BusinessException(ResultCode.INTERNAL_ERROR);
    }

    /** 下单同事务建支付单（CREATED，前端据此发起 pay） */
    private Payment insertPayment(Long orderId, BigDecimal amount) {
        Payment payment = new Payment();
        payment.setPaymentNo(OrderNoGenerator.paymentNo());
        payment.setOrderId(orderId);
        payment.setAmount(amount);
        payment.setProvider(PayChannel.FAKE);
        payment.setStatus(PaymentStatus.CREATED);
        paymentMapper.insert(payment);
        return payment;
    }

    private Map<Long, String> loadMainImages(List<Long> productIds) {
        if (productIds.isEmpty()) {
            return Map.of();
        }
        return productImageMapper.selectList(Wrappers.<ProductImage>lambdaQuery()
                        .in(ProductImage::getProductId, productIds)
                        .eq(ProductImage::getSort, 0))
                .stream().collect(Collectors.toMap(
                        ProductImage::getProductId, ProductImage::getUrl, (a, b) -> a));
    }

    private String addressJson(Address address) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("receiverName", address.getReceiverName());
            snapshot.put("phone", address.getPhone());
            snapshot.put("province", address.getProvince());
            snapshot.put("city", address.getCity());
            snapshot.put("district", address.getDistrict());
            snapshot.put("detail", address.getDetail());
            return OBJECT_MAPPER.writeValueAsString(snapshot);
        } catch (Exception e) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR);
        }
    }

    // ── 查询 / 惰性关单 / 主动取消 ────────────────────────────────

    @Override
    @Transactional
    public List<OrderDTO> list(String status) {
        Long userId = UserContext.getRequired().userId();
        List<Order> orders = orderMapper.selectList(Wrappers.<Order>lambdaQuery()
                .eq(Order::getUserId, userId)
                .orderByDesc(Order::getId));
        // 惰性关单：过期未支付的批量关单（同事务，迁移 + 回补）
        orders.stream()
                .filter(o -> o.getStatus() == OrderStatus.PENDING_PAYMENT)
                .filter(o -> o.getExpiredAt() != null && o.getExpiredAt().isBefore(LocalDateTime.now()))
                .forEach(this::closeExpiredOrder);
        return orders.stream()
                .filter(o -> !org.springframework.util.StringUtils.hasText(status)
                        || o.getStatus().name().equals(status))
                .map(o -> toDTO(o, loadLines(o.getId()), loadPayment(o.getId())))
                .toList();
    }

    @Override
    public List<OrderDTO> sold(String status) {
        Long sellerId = UserContext.getRequired().userId();
        List<OrderItem> myLines = orderItemMapper.selectList(Wrappers.<OrderItem>lambdaQuery()
                .eq(OrderItem::getSellerId, sellerId));
        if (myLines.isEmpty()) {
            return List.of();
        }
        List<Long> orderIds = myLines.stream().map(OrderItem::getOrderId).distinct().toList();
        List<Order> orders = orderMapper.selectBatchIds(orderIds).stream()
                .filter(o -> !org.springframework.util.StringUtils.hasText(status)
                        || o.getStatus().name().equals(status))
                .sorted(Comparator.comparing(Order::getId).reversed())
                .toList();
        Map<Long, List<OrderItem>> linesByOrder = myLines.stream()
                .collect(java.util.stream.Collectors.groupingBy(OrderItem::getOrderId));
        // 支付单批量加载（终审 HIGH 修复：避免逐单 selectOne 的 N+1）
        Map<Long, Payment> paymentByOrder = paymentMapper.selectList(Wrappers.<Payment>lambdaQuery()
                        .in(Payment::getOrderId, orderIds))
                .stream().collect(java.util.stream.Collectors.toMap(
                        Payment::getOrderId, p -> p, (a, b) -> a));
        return orders.stream()
                .map(o -> toDTO(o, linesByOrder.getOrDefault(o.getId(), List.of()),
                        paymentByOrder.get(o.getId())))
                .toList();
    }

    @Override
    @Transactional
    public OrderDTO detail(Long id) {
        Order order = requireOwnedOrder(id);
        // 惰性关单：超时未支付即取消 + 还库存（查询触发，无需定时任务）
        closeExpiredOrder(order);
        return toDTO(order, loadLines(order.getId()), loadPayment(order.getId()));
    }

    @Override
    @Transactional
    public void ship(Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException(ResultCode.ORDER_NOT_FOUND);
        }
        List<OrderItem> lines = loadLines(id);
        boolean hasConsignment = lines.stream().anyMatch(l -> l.getSellerId() != null);
        com.fullstackmall.shop.user.context.LoginUser current = UserContext.getRequired();
        if (hasConsignment) {
            // 寄卖件：必须该卖家本人发货（404 口径，不暴露"这单是别人卖的"这一存在性）
            boolean isSeller = lines.stream()
                    .filter(l -> l.getSellerId() != null)
                    .allMatch(l -> l.getSellerId().equals(current.userId()));
            if (!isSeller) {
                throw new BusinessException(ResultCode.ORDER_NOT_FOUND);
            }
        } else if (!"ADMIN".equals(current.role())) {
            // 全自营件：必须平台管理员发货（寄卖不进购物车，订单主体天然单一）
            throw new BusinessException(ResultCode.FORBIDDEN);
        }
        // 条件迁移 PAID→SHIPPED（行数 0：并发重复发货/未支付）
        migrateOrderStatus(id, OrderStatus.SHIPPED, OrderStatus.PAID);
    }

    @Override
    @Transactional
    public void confirm(Long id) {
        Order order = requireOwnedOrder(id);
        // 条件迁移 SHIPPED→COMPLETED（行数 0：未发货/重复确认）
        migrateOrderStatus(id, OrderStatus.COMPLETED, OrderStatus.SHIPPED);
        // 同事务：寄卖明细（sellerId 非空）逐个生成结算单（钱的两条线：收货才结算）
        List<OrderItem> lines = loadLines(id);
        for (OrderItem line : lines) {
            if (line.getSellerId() == null) {
                continue;
            }
            // 幂等：uk(order_item_id) 已存在则跳过（并发/重复 confirm 不重复生成、不报错）
            Long exists = payoutMapper.selectCount(Wrappers.<Payout>lambdaQuery()
                    .eq(Payout::getOrderItemId, line.getId()));
            if (exists != null && exists > 0) {
                continue;
            }
            ProductItem item = productItemMapper.selectById(line.getProductItemId());
            if (item == null) {
                continue;
            }
            // 佣金率回联寄卖单（铸造商品时挂在 listed_product_id 上；REJECTED 历史不参与结算）
            ConsignmentListing listing = consignmentListingMapper.selectOne(
                    Wrappers.<ConsignmentListing>lambdaQuery()
                            .eq(ConsignmentListing::getListedProductId, item.getProductId())
                            .ne(ConsignmentListing::getStatus, ConsignmentStatus.REJECTED));
            BigDecimal rate = listing != null && listing.getCommissionRate() != null
                    ? listing.getCommissionRate() : BigDecimal.ZERO;
            BigDecimal gross = line.getPrice().multiply(BigDecimal.valueOf(line.getQuantity()));
            BigDecimal commission = gross.multiply(rate)
                    .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            BigDecimal sellerAmount = gross.subtract(commission);
            Payout payout = new Payout();
            payout.setSellerId(line.getSellerId());
            payout.setOrderItemId(line.getId());
            payout.setSellerAmount(sellerAmount);
            payout.setCommission(commission);
            payout.setStatus(PayoutStatus.PENDING);
            payoutMapper.insert(payout);
        }
    }

    @Override
    @Transactional
    public void cancel(Long id) {
        Order order = requireOwnedOrder(id);
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw new BusinessException(ResultCode.ORDER_STATE_ILLEGAL);
        }
        // 条件迁移（并发/重复取消兜底：已是 CANCELLED 时命中 0 行）
        migrateOrderStatus(order.getId(), OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT);
        restock(order);
    }

    /** 单体惰性关单：PENDING_PAYMENT 且 expiredAt 已过 → CANCELLED + 回补库存 */
    private void closeExpiredOrder(Order order) {
        if (order.getStatus() == OrderStatus.PENDING_PAYMENT
                && order.getExpiredAt() != null
                && order.getExpiredAt().isBefore(LocalDateTime.now())) {
            migrateOrderStatus(order.getId(), OrderStatus.CANCELLED, OrderStatus.PENDING_PAYMENT);
            restock(order);
            order.setStatus(OrderStatus.CANCELLED);
        }
    }

    /** 订单状态条件迁移（字符串列名 UpdateWrapper，同 plan-04 Ruling：并发只放行一个） */
    private void migrateOrderStatus(Long orderId, OrderStatus to, OrderStatus... from) {
        int rows = orderMapper.update(null, Wrappers.<Order>update()
                .set("status", to.name())
                .eq("id", orderId)
                .in("status", java.util.Arrays.stream(from).map(Enum::name).toList()));
        if (rows == 0) {
            throw new BusinessException(ResultCode.ORDER_STATE_ILLEGAL);
        }
    }

    /**
     * 回补库存：秒杀单回补活动独立池（sold_count - 1，条件 sold_count > 0 防负——
     * 负值会让后续抢购多放行）；普通单按明细逐行回补 product_item。
     */
    private void restock(Order order) {
        if (order.getType() == OrderType.SECKILL && order.getSeckillActivityId() != null) {
            seckillActivityMapper.update(null, Wrappers.<SeckillActivity>update()
                    .setSql("sold_count = sold_count - 1")
                    .eq("id", order.getSeckillActivityId())
                    .gt("sold_count", 0));
            // 4b 生命周期挂接：redis 策略下同步回补关口（失败仅 warn 不阻断——key 可后续重建）
            if (seckillProperties.getStrategy()
                    == com.fullstackmall.shop.seckill.service.SeckillDeductStrategy.REDIS) {
                redisStockDeductor.restoreStock(order.getSeckillActivityId());
            }
            return;
        }
        List<OrderItem> lines = loadLines(order.getId());
        for (OrderItem line : lines) {
            productItemMapper.update(null, Wrappers.<ProductItem>update()
                    .setSql("stock = stock + " + line.getQuantity() + ", version = version + 1")
                    .eq("id", line.getProductItemId()));
        }
    }

    private Order requireOwnedOrder(Long id) {
        Long userId = UserContext.getRequired().userId();
        Order order = orderMapper.selectOne(Wrappers.<Order>lambdaQuery()
                .eq(Order::getId, id)
                .eq(Order::getUserId, userId));
        if (order == null) {
            throw new BusinessException(ResultCode.ORDER_NOT_FOUND);
        }
        return order;
    }

    private List<OrderItem> loadLines(Long orderId) {
        return orderItemMapper.selectList(Wrappers.<OrderItem>lambdaQuery()
                .eq(OrderItem::getOrderId, orderId));
    }

    private Payment loadPayment(Long orderId) {
        return paymentMapper.selectOne(Wrappers.<Payment>lambdaQuery()
                .eq(Payment::getOrderId, orderId)
                .orderByDesc(Payment::getId)
                .last("LIMIT 1"));
    }

    // ── DTO 组装 ────────────────────────────────────────────────

    OrderDTO toDTO(Order order, List<OrderItem> lines, Payment payment) {
        OrderDTO dto = new OrderDTO();
        dto.setId(order.getId());
        dto.setOrderNo(order.getOrderNo());
        dto.setType(order.getType() != null ? order.getType().name() : null);
        dto.setStatus(order.getStatus() != null ? order.getStatus().name() : null);
        dto.setPayAmount(order.getPayAmount());
        dto.setExpiredAt(order.getExpiredAt());
        dto.setCreateTime(order.getCreateTime());
        dto.setPaymentNo(payment != null ? payment.getPaymentNo() : null);
        dto.setAddress(parseAddress(order.getAddressSnapshot(), order.getId()));
        dto.setItems(lines.stream().map(this::toItemDTO).toList());
        return dto;
    }

    private AddressSnapshotDTO parseAddress(String json, Long orderId) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readValue(json, AddressSnapshotDTO.class);
        } catch (Exception e) {
            // 地址快照解析失败：烂数据按无地址展示，但必须可追踪（不吞错）
            log.warn("订单地址快照 JSON 解析失败，按无地址兜底展示：orderId={}", orderId, e);
            return null;
        }
    }

    private OrderItemDTO toItemDTO(OrderItem line) {
        OrderItemDTO dto = new OrderItemDTO();
        dto.setProductItemId(line.getProductItemId());
        dto.setPrice(line.getPrice());
        dto.setQuantity(line.getQuantity());
        dto.setSellerId(line.getSellerId());
        try {
            Map<String, Object> snapshot = OBJECT_MAPPER.readValue(
                    line.getItemSnapshot(), new TypeReference<Map<String, Object>>() {});
            dto.setTitle((String) snapshot.get("title"));
            dto.setImageUrl((String) snapshot.get("imageUrl"));
            dto.setConditionGrade((String) snapshot.get("conditionGrade"));
            dto.setSize((String) snapshot.get("size"));
            dto.setColor((String) snapshot.get("color"));
            dto.setBrand((String) snapshot.get("brand"));
            dto.setOwnerType((String) snapshot.get("ownerType"));
        } catch (Exception e) {
            // 快照解析失败不炸订单展示（烂数据按无快照字段展示），但必须可追踪（不吞错）
            log.warn("订单明细快照 JSON 解析失败，按无快照字段兜底展示：orderItemId={}", line.getId(), e);
        }
        return dto;
    }
}
