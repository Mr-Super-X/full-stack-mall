package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.entity.SeckillOrderAcceptance;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper;
import com.fullstackmall.shop.seckill.mq.SeckillDlxMonitor;
import com.fullstackmall.shop.seckill.mq.SeckillOrderMessage;
import com.fullstackmall.shop.seckill.service.RedisStockDeductor;
import com.rabbitmq.client.Channel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * DLX 死信回补契约：落库失败进 DLQ 的消息被监控器消费——DB sold_count 条件回补 +
 * Redis 关口回补 + 受理表置 FAILED（对照表"少卖"行的自动收敛路径，spec §5.5/§8）。
 */
@ExtendWith(MockitoExtension.class)
class SeckillDlxMonitorTest {

    @Mock
    private SeckillActivityMapper seckillActivityMapper;
    @Mock
    private RedisStockDeductor redisStockDeductor;
    @Mock
    private SeckillOrderAcceptanceMapper acceptanceMapper;
    @Mock
    private Channel channel;

    private SeckillDlxMonitor monitor;

    @BeforeEach
    void setUp() {
        monitor = new SeckillDlxMonitor(seckillActivityMapper, redisStockDeductor, acceptanceMapper);
    }

    private Message dlqMessage(SeckillOrderMessage payload) {
        Jackson2JsonMessageConverter converter = new Jackson2JsonMessageConverter();
        MessageProperties props = new MessageProperties();
        props.setHeader("__TypeId__", SeckillOrderMessage.class.getName());
        return converter.toMessage(payload, props);
    }

    private SeckillOrderMessage payload() {
        return new SeckillOrderMessage("M-DLX-001", 16L, 3L, 1601L, 7L,
                new BigDecimal("299.40"), LocalDateTime.now());
    }

    @Test
    @DisplayName("死信消费：DB sold_count-1 条件更新 + Redis 回补 + 受理表 FAILED + ack")
    void onDlqMessage_restocksAndMarksFailed() throws Exception {
        monitor.onMessage(dlqMessage(payload()), channel);

        verify(seckillActivityMapper).update(org.mockito.ArgumentMatchers.isNull(), any());
        verify(redisStockDeductor).restoreStock(16L);
        verify(acceptanceMapper).update(org.mockito.ArgumentMatchers.isNull(), any());
        verify(channel).basicAck(anyLong(), eq(false));
    }

    @Test
    @DisplayName("毒消息（解析失败）：nack 不回流（防监控器自身死循环）")
    void onDlqMessage_poison_nacksWithoutRequeue() throws Exception {
        MessageProperties props = new MessageProperties();
        Message poison = new Message("{bad-json".getBytes(), props);

        monitor.onMessage(poison, channel);

        verify(seckillActivityMapper, never()).update(any(), any());
        verify(channel).basicNack(anyLong(), eq(false), eq(false));
    }
}
