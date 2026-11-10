package com.fullstackmall.shop.seckill.service;

import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.order.entity.Order;
import com.fullstackmall.shop.order.entity.OrderItem;
import com.fullstackmall.shop.order.enums.OrderStatus;
import com.fullstackmall.shop.order.enums.OrderType;
import com.fullstackmall.shop.order.mapper.OrderMapper;
import com.fullstackmall.shop.payment.entity.Payment;
import com.fullstackmall.shop.payment.enums.PayChannel;
import com.fullstackmall.shop.payment.enums.PaymentStatus;
import com.fullstackmall.shop.payment.mapper.PaymentMapper;
import com.fullstackmall.shop.product.entity.Product;
import com.fullstackmall.shop.product.entity.ProductItem;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 建单三步抽取后的行为契约：4a 同步路径与 4b MQ 消费者共用本类，
 * 两条路径必须落出完全一致的订单/支付行（对照实验公平性前提，spec §13#10）。
 */
@ExtendWith(MockitoExtension.class)
class SeckillOrderAssemblerTest {

    @Mock
    private OrderMapper orderMapper;
    @Mock
    private PaymentMapper paymentMapper;

    private SeckillOrderAssembler assembler;

    @BeforeEach
    void setUp() {
        assembler = new SeckillOrderAssembler(orderMapper, paymentMapper);
    }

    private SeckillActivity activity(long id, String price) {
        SeckillActivity a = new SeckillActivity();
        a.setId(id);
        a.setSeckillPrice(new BigDecimal(price));
        return a;
    }

    private Address address() {
        Address a = new Address();
        a.setReceiverName("张三");
        a.setPhone("13800000000");
        a.setProvince("浙江省");
        a.setCity("杭州市");
        a.setDistrict("西湖区");
        a.setDetail("天目里 1 号");
        return a;
    }

    @Test
    @DisplayName("insertOrder：orderNo 由调用方传入直接落库，内部不再自生成（异步路径幂等键=orderNo）")
    void insertOrder_usesProvidedOrderNo() {
        when(orderMapper.insert(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(9001L);
            return 1;
        });

        Order saved = assembler.insertOrder(3L, activity(16L, "299.40"), address(), "M-FIXED-001");

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderMapper).insert(captor.capture());
        assertThat(captor.getValue().getOrderNo()).isEqualTo("M-FIXED-001");
        assertThat(saved.getOrderNo()).isEqualTo("M-FIXED-001");
        assertThat(saved.getId()).isEqualTo(9001L);
    }

    @Test
    @DisplayName("insertOrder：SECKILL 类型 + PENDING_PAYMENT + 秒杀价定格 + 15min 超时窗")
    void insertOrder_seckillSemantics() {
        when(orderMapper.insert(any(Order.class))).thenAnswer(inv -> {
            Order o = inv.getArgument(0);
            o.setId(9002L);
            return 1;
        });
        LocalDateTime before = LocalDateTime.now();

        Order saved = assembler.insertOrder(3L, activity(16L, "299.40"), address(), "M-FIXED-002");

        assertThat(saved.getType()).isEqualTo(OrderType.SECKILL);
        assertThat(saved.getStatus()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(saved.getPayAmount()).isEqualByComparingTo("299.40");
        assertThat(saved.getSeckillActivityId()).isEqualTo(16L);
        assertThat(saved.getExpiredAt()).isAfter(before.plusMinutes(14));
        assertThat(saved.getAddressSnapshot()).contains("张三").contains("天目里");
    }

    @Test
    @DisplayName("buildLine：成交价快照定格传入价（活动结束/改价不回联，快照铁律）")
    void buildLine_priceSnapshotFrozen() {
        ProductItem item = new ProductItem();
        item.setId(1601L);
        item.setSize("M");
        item.setColor("陶土");

        Product product = new Product();
        product.setId(100L);
        product.setName("复古做旧牛仔夹克");
        product.setBrand("拙衣");

        OrderItem line = assembler.buildLine(item, product, new BigDecimal("299.40"), "https://img/p16.jpg");

        assertThat(line.getProductItemId()).isEqualTo(1601L);
        assertThat(line.getPrice()).isEqualByComparingTo("299.40");
        assertThat(line.getQuantity()).isEqualTo(1);
        assertThat(line.getItemSnapshot()).contains("复古做旧牛仔夹克");
    }

    @Test
    @DisplayName("insertPayment：CREATED 态 FAKE 支付单，金额=订单金额")
    void insertPayment_createsFakePayment() {
        when(paymentMapper.insert(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            p.setId(7001L);
            return 1;
        });
        Order order = new Order();
        order.setId(9001L);

        Payment payment = assembler.insertPayment(order.getId(), new BigDecimal("299.40"));

        assertThat(payment.getOrderId()).isEqualTo(9001L);
        assertThat(payment.getAmount()).isEqualByComparingTo("299.40");
        assertThat(payment.getProvider()).isEqualTo(PayChannel.FAKE);
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.CREATED);
        assertThat(payment.getPaymentNo()).isNotBlank();
    }
}
