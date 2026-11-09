package com.fullstackmall.shop.order;

import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.cart.entity.CartItem;
import com.fullstackmall.shop.cart.mapper.CartItemMapper;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.order.dto.CreateOrderRequest;
import com.fullstackmall.shop.order.dto.OrderDTO;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.mapper.OrderItemMapper;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.order.service.OrderService;
import com.fullstackmall.shop.order.service.impl.OrderServiceImpl;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductImage;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.product.enums.ConditionGrade;
import com.fullstackmall.shop.product.enums.OwnerType;
import com.fullstackmall.shop.product.enums.SaleMode;
import com.fullstackmall.shop.product.mapper.ProductImageMapper;
import com.fullstackmall.shop.product.mapper.ProductItemMapper;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.context.UserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * OrderServiceImpl.create 真逻辑单测（CART 模式）：
 * 快照铁律、条件扣库存回滚、清购物车行、支付单创建、订单号生成。
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceImplTest {

    @Mock
    private OrderMapper orderMapper;
    @Mock
    private OrderItemMapper orderItemMapper;
    @Mock
    private CartItemMapper cartItemMapper;
    @Mock
    private ProductItemMapper productItemMapper;
    @Mock
    private ProductMapper productMapper;
    @Mock
    private ProductImageMapper productImageMapper;
    @Mock
    private PaymentMapper paymentMapper;
    @Mock
    private AddressMapper addressMapper;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderServiceImpl(orderMapper, orderItemMapper, cartItemMapper,
                productItemMapper, productMapper, productImageMapper, paymentMapper, addressMapper);
        UserContext.set(new LoginUser(3L, "buyer", "USER"));
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void 购物车结算下单成功_三写齐_快照含标题_扣库存_清购物车_建支付单() {
        given(cartItemMapper.selectList(any())).willReturn(List.of(cartRow(1L, 1L, 2)));
        given(addressMapper.selectOne(any())).willReturn(address());
        given(productItemMapper.selectBatchIds(any())).willReturn(List.of(platformItem(1L, 200, "399.00")));
        given(productMapper.selectBatchIds(any())).willReturn(List.of(platformProduct()));
        given(productImageMapper.selectList(any())).willReturn(
                List.of(mainImage(1L, "https://img.example/p1.jpg")));
        // 条件扣库存成功（影响 1 行）
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        OrderDTO result = orderService.create(cartRequest());

        // 订单号 M 开头；支付单号 P 开头；金额 = 399 × 2
        assertThat(result.getOrderNo()).startsWith("M");
        assertThat(result.getPaymentNo()).startsWith("P");
        assertThat(result.getPayAmount()).isEqualByComparingTo("798.00");

        // 三写：订单 + 明细 + 支付单
        verify(orderMapper).insert(any(Order.class));
        ArgumentCaptor<com.fullstackmall.shop.order.entity.OrderItem> itemCaptor =
                ArgumentCaptor.forClass(com.fullstackmall.shop.order.entity.OrderItem.class);
        verify(orderItemMapper).insert(itemCaptor.capture());
        assertThat(itemCaptor.getValue().getItemSnapshot()).contains("陶土色垂感风衣");
        assertThat(itemCaptor.getValue().getItemSnapshot()).contains("https://img.example/p1.jpg");
        assertThat(itemCaptor.getValue().getPrice()).isEqualByComparingTo("399.00");
        verify(paymentMapper).insert(any(com.fullstackmall.shop.payment.entity.Payment.class));

        // 清购物车行
        verify(cartItemMapper).deleteBatchIds(any());
    }

    @Test
    void 库存不足应整体回滚_不写订单() {
        given(cartItemMapper.selectList(any())).willReturn(List.of(cartRow(1L, 1L, 2)));
        given(addressMapper.selectOne(any())).willReturn(address());
        given(productItemMapper.selectBatchIds(any())).willReturn(List.of(platformItem(1L, 1, "399.00")));
        given(productMapper.selectBatchIds(any())).willReturn(List.of(platformProduct()));
        // 条件扣库存命中 0 行（stock 1 < 2）
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        assertThatThrownBy(() -> orderService.create(cartRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.STOCK_NOT_ENOUGH);

        verify(orderMapper, never()).insert(any(Order.class));
        verify(paymentMapper, never()).insert(any(com.fullstackmall.shop.payment.entity.Payment.class));
        verify(cartItemMapper, never()).deleteBatchIds(any());
    }

    @Test
    void 购物车行含他人条目应抛404() {
        given(addressMapper.selectOne(any())).willReturn(address());
        // 归属双条件查询只返回部分行（其余属于他人）
        given(cartItemMapper.selectList(any())).willReturn(List.of());

        assertThatThrownBy(() -> orderService.create(cartRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.CART_ITEM_NOT_FOUND);
    }

    @Test
    void 地址不属于本人应抛404() {
        given(addressMapper.selectOne(any())).willReturn(null);

        assertThatThrownBy(() -> orderService.create(cartRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ADDRESS_NOT_FOUND);
    }

    @Test
    void 购物车模式缺条目列表应抛参数错误() {
        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.CART);
        // cartItemIds 缺失

        assertThatThrownBy(() -> orderService.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    // ── Task 3：DIRECT 寄卖直购 ─────────────────────────────────

    @Test
    void 寄卖直购成功_数量恒1_卖家快照进明细() {
        given(addressMapper.selectOne(any())).willReturn(address());
        ProductItem consignmentItem = platformItem(33L, 1, "12800.00");
        consignmentItem.setProductId(14L);
        given(productItemMapper.selectById(33L)).willReturn(consignmentItem);
        Product consignment = platformProduct();
        consignment.setId(14L);
        consignment.setOwnerType(OwnerType.CONSIGNMENT);
        consignment.setSellerId(2L);
        given(productMapper.selectById(14L)).willReturn(consignment);
        given(productImageMapper.selectList(any())).willReturn(
                List.of(mainImage(14L, "https://img.example/p14.jpg")));
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.DIRECT);
        req.setProductItemId(33L);

        OrderDTO result = orderService.create(req);

        assertThat(result.getType()).isEqualTo("NORMAL");
        assertThat(result.getPayAmount()).isEqualByComparingTo("12800.00");
        ArgumentCaptor<com.fullstackmall.shop.order.entity.OrderItem> itemCaptor =
                ArgumentCaptor.forClass(com.fullstackmall.shop.order.entity.OrderItem.class);
        verify(orderItemMapper).insert(itemCaptor.capture());
        assertThat(itemCaptor.getValue().getQuantity()).isEqualTo(1);
        assertThat(itemCaptor.getValue().getSellerId()).isEqualTo(2L);
        verify(paymentMapper).insert(any(com.fullstackmall.shop.payment.entity.Payment.class));
    }

    @Test
    void 自营商品走直购应抛参数错误() {
        given(addressMapper.selectOne(any())).willReturn(address());
        given(productItemMapper.selectById(1L)).willReturn(platformItem(1L, 200, "399.00"));
        given(productMapper.selectById(1L)).willReturn(platformProduct());

        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.DIRECT);
        req.setProductItemId(1L);

        assertThatThrownBy(() -> orderService.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_REQUEST);
    }

    @Test
    void 寄卖已售直购应抛库存不足() {
        given(addressMapper.selectOne(any())).willReturn(address());
        ProductItem soldOutItem = platformItem(33L, 0, "12800.00");
        soldOutItem.setProductId(14L);
        given(productItemMapper.selectById(33L)).willReturn(soldOutItem);
        Product consignment = platformProduct();
        consignment.setId(14L);
        consignment.setOwnerType(OwnerType.CONSIGNMENT);
        consignment.setSellerId(2L);
        given(productMapper.selectById(14L)).willReturn(consignment);
        // 条件扣库存命中 0 行（stock 0 < 1）
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(0);

        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.DIRECT);
        req.setProductItemId(33L);

        assertThatThrownBy(() -> orderService.create(req))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.STOCK_NOT_ENOUGH);
        verify(orderMapper, never()).insert(any(Order.class));
    }

    // ── Task 4：查询 / 惰性关单 / cancel ────────────────────────

    @Test
    void 查询过期订单应变已取消且回补库存() {
        Order expired = order(1L, OrderStatus.PENDING_PAYMENT, java.time.LocalDateTime.now().minusMinutes(20));
        given(orderMapper.selectOne(any())).willReturn(expired);
        // 条件迁移 CANCELLED 成功
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        given(orderItemMapper.selectList(any())).willReturn(List.of(orderLine(1L, 2)));
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        OrderDTO result = orderService.detail(1L);

        assertThat(result.getStatus()).isEqualTo("CANCELLED");
        // 库存回补被调用（stock + 2）
        verify(productItemMapper, atLeastOnce()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void 未过期订单查询不应关单() {
        Order fresh = order(1L, OrderStatus.PENDING_PAYMENT, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectOne(any())).willReturn(fresh);
        given(orderItemMapper.selectList(any())).willReturn(List.of(orderLine(1L, 2)));

        OrderDTO result = orderService.detail(1L);

        assertThat(result.getStatus()).isEqualTo("PENDING_PAYMENT");
        verify(orderMapper, never()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void 取消已支付订单应抛非法流转() {
        given(orderMapper.selectOne(any()))
                .willReturn(order(1L, OrderStatus.PAID, java.time.LocalDateTime.now().plusMinutes(10)));

        assertThatThrownBy(() -> orderService.cancel(1L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_STATE_ILLEGAL);
    }

    @Test
    void 取消待支付订单成功并回补库存() {
        Order pending = order(1L, OrderStatus.PENDING_PAYMENT, java.time.LocalDateTime.now().plusMinutes(10));
        given(orderMapper.selectOne(any())).willReturn(pending);
        given(orderMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);
        given(orderItemMapper.selectList(any())).willReturn(List.of(orderLine(1L, 2)));
        given(productItemMapper.update(org.mockito.ArgumentMatchers.isNull(), any())).willReturn(1);

        orderService.cancel(1L);

        verify(productItemMapper, atLeastOnce()).update(org.mockito.ArgumentMatchers.isNull(), any());
    }

    @Test
    void 查询他人订单应抛404() {
        given(orderMapper.selectOne(any())).willReturn(null);

        assertThatThrownBy(() -> orderService.detail(9L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.ORDER_NOT_FOUND);
    }

    // ── Task 4 桩 ───────────────────────────────────────────────

    private Order order(Long id, OrderStatus status, java.time.LocalDateTime expiredAt) {
        Order order = new Order();
        order.setId(id);
        order.setOrderNo("M20261109120000-4821");
        order.setUserId(3L);
        order.setType(com.fullstackmall.shop.order.enums.OrderType.NORMAL);
        order.setStatus(status);
        order.setPayAmount(new BigDecimal("798.00"));
        order.setExpiredAt(expiredAt);
        return order;
    }

    private com.fullstackmall.shop.order.entity.OrderItem orderLine(Long productItemId, int quantity) {
        com.fullstackmall.shop.order.entity.OrderItem line = new com.fullstackmall.shop.order.entity.OrderItem();
        line.setId(1L);
        line.setOrderId(1L);
        line.setProductItemId(productItemId);
        line.setPrice(new BigDecimal("399.00"));
        line.setQuantity(quantity);
        line.setItemSnapshot("{\"title\":\"陶土色垂感风衣\"}");
        return line;
    }

    // ── 桩与构造 ────────────────────────────────────────────────

    private CreateOrderRequest cartRequest() {
        CreateOrderRequest req = new CreateOrderRequest();
        req.setAddressId(1L);
        req.setSource(CreateOrderRequest.Source.CART);
        req.setCartItemIds(List.of(1L));
        return req;
    }

    private CartItem cartRow(Long id, Long productItemId, int quantity) {
        CartItem row = new CartItem();
        row.setId(id);
        row.setUserId(3L);
        row.setProductItemId(productItemId);
        row.setQuantity(quantity);
        row.setChecked(1);
        return row;
    }

    private Address address() {
        Address addr = new Address();
        addr.setId(1L);
        addr.setUserId(3L);
        addr.setReceiverName("张三");
        addr.setPhone("13800138000");
        addr.setProvince("浙江省");
        addr.setCity("杭州市");
        addr.setDistrict("西湖区");
        addr.setDetail("天目里 3 幢 101");
        return addr;
    }

    private ProductItem platformItem(Long id, int stock, String price) {
        ProductItem item = new ProductItem();
        item.setId(id);
        item.setProductId(1L);
        item.setSize("M");
        item.setColor("陶土色");
        item.setConditionGrade(ConditionGrade.NEW);
        item.setPrice(new BigDecimal(price));
        item.setStock(stock);
        return item;
    }

    private Product platformProduct() {
        Product product = new Product();
        product.setId(1L);
        product.setOwnerType(OwnerType.PLATFORM);
        product.setSaleMode(SaleMode.NORMAL);
        product.setBrand("拙衣");
        product.setName("陶土色垂感风衣");
        product.setStatus(1);
        return product;
    }

    private ProductImage mainImage(Long productId, String url) {
        ProductImage image = new ProductImage();
        image.setProductId(productId);
        image.setUrl(url);
        image.setSort(0);
        return image;
    }
}
