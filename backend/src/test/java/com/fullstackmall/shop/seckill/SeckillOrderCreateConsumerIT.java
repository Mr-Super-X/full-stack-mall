package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.seckill.mq.SeckillMqConfig;
import com.fullstackmall.shop.seckill.mq.SeckillOrderCreateConsumer;
import com.fullstackmall.shop.seckill.mq.SeckillOrderMessage;
import com.fullstackmall.shop.seckill.service.SeckillService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.listener.SimpleMessageListenerContainer;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.dao.DuplicateKeyException;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * 消费者传输语义集成测试（Testcontainers RabbitMQ）：生产拓扑对象由 SeckillMqConfig 直接
 * new 出来声明（同一组定义，测试/生产一致性），手动装配 listener container（手动 ack + prefetch=1）。
 */
@Testcontainers
class SeckillOrderCreateConsumerIT {

    @Container
    static final GenericContainer<?> RABBIT =
            new GenericContainer<>(DockerImageName.parse("rabbitmq:3.13-management"))
                    .withExposedPorts(5672)
                    // AMQP 就绪晚于端口可连：等启动日志（management 插件加载完）
                    .waitingFor(org.testcontainers.containers.wait.strategy.Wait
                            .forLogMessage(".*Server startup complete.*", 1));

    private CachingConnectionFactory connectionFactory;
    private RabbitTemplate template;
    private SimpleMessageListenerContainer container;

    @BeforeEach
    void setUp() {
        connectionFactory = new CachingConnectionFactory(RABBIT.getHost(), RABBIT.getMappedPort(5672));
        template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(new Jackson2JsonMessageConverter());
        // 声明拓扑（与生产同一组 Bean 定义）
        RabbitAdmin admin = new RabbitAdmin(connectionFactory);
        SeckillMqConfig cfg = new SeckillMqConfig();
        var queue = cfg.seckillOrderCreateQueue();
        var exchange = cfg.seckillOrderCreateExchange();
        var dlx = cfg.seckillOrderCreateDlx();
        var dlq = cfg.seckillOrderCreateDlq();
        admin.declareQueue(queue);
        admin.declareExchange(exchange);
        admin.declareBinding(cfg.seckillOrderCreateBinding(queue, exchange));
        admin.declareExchange(dlx);
        admin.declareQueue(dlq);
        admin.declareBinding(cfg.seckillOrderCreateDlqBinding(dlq, dlx));
        // 清场（上个用例残留）
        admin.purgeQueue(SeckillMqConfig.QUEUE, true);
        admin.purgeQueue(SeckillMqConfig.DLQ, true);
    }

    @AfterEach
    void tearDown() {
        if (container != null) {
            container.stop();
        }
        connectionFactory.destroy();
    }

    private void startConsumer(SeckillOrderCreateConsumer consumer) {
        container = new SimpleMessageListenerContainer(connectionFactory);
        container.setQueueNames(SeckillMqConfig.QUEUE);
        container.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        container.setPrefetchCount(1);
        container.setMessageListener(consumer);
        container.start();
    }

    private SeckillOrderMessage message(String orderNo) {
        return new SeckillOrderMessage(orderNo, 16L, 3L, 1601L, 7L,
                new BigDecimal("299.40"), LocalDateTime.now());
    }

    @Test
    @DisplayName("正常消费：业务方法被调一次，消息确认消费（队列清空）")
    void consume_success_acksMessage() throws Exception {
        SeckillService service = mock(SeckillService.class);
        CountDownLatch latch = new CountDownLatch(1);
        org.mockito.Mockito.doAnswer(inv -> {
            latch.countDown();
            return null;
        }).when(service).fulfillSeckillOrder(any());

        startConsumer(new SeckillOrderCreateConsumer(service, template, 0));
        template.convertAndSend(SeckillMqConfig.EXCHANGE, SeckillMqConfig.ROUTING_KEY, message("M-IT-001"));

        assertThat(latch.await(10, TimeUnit.SECONDS)).isTrue();
        verify(service, times(1)).fulfillSeckillOrder(any());
    }

    @Test
    @DisplayName("失败重试：带计数重投 2 次后第 3 次进 DLX（业务被调 3 次，DLQ 收到消息）")
    void consume_failure_retriesThreeThenDlq() throws Exception {
        SeckillService service = mock(SeckillService.class);
        CountDownLatch latch = new CountDownLatch(3);
        AtomicInteger calls = new AtomicInteger();
        org.mockito.Mockito.doAnswer(inv -> {
            calls.incrementAndGet();
            latch.countDown();
            throw new RuntimeException("模拟建单失败");
        }).when(service).fulfillSeckillOrder(any());

        startConsumer(new SeckillOrderCreateConsumer(service, template, 0));
        template.convertAndSend(SeckillMqConfig.EXCHANGE, SeckillMqConfig.ROUTING_KEY, message("M-IT-002"));

        assertThat(latch.await(15, TimeUnit.SECONDS)).isTrue();
        // 等待 DLQ 出现死信（第三次失败 nack 后进 DLX）
        Message dead = null;
        for (int i = 0; i < 30 && dead == null; i++) {
            dead = template.receive(SeckillMqConfig.DLQ, 500);
        }
        assertThat(dead).isNotNull();
        assertThat(calls.get()).isEqualTo(3);
    }

    @Test
    @DisplayName("DuplicateKey（重复消费）：ack 丢弃不回流，业务仅调一次")
    void consume_duplicateKey_acksWithoutRetry() throws Exception {
        SeckillService service = mock(SeckillService.class);
        CountDownLatch latch = new CountDownLatch(1);
        org.mockito.Mockito.doAnswer(inv -> {
            latch.countDown();
            throw new DuplicateKeyException("uk_user_activity");
        }).when(service).fulfillSeckillOrder(any());

        startConsumer(new SeckillOrderCreateConsumer(service, template, 0));
        template.convertAndSend(SeckillMqConfig.EXCHANGE, SeckillMqConfig.ROUTING_KEY, message("M-IT-003"));

        assertThat(latch.await(10, TimeUnit.SECONDS)).isTrue();
        Thread.sleep(500);
        verify(service, times(1)).fulfillSeckillOrder(any());
        assertThat(template.receive(SeckillMqConfig.DLQ, 300)).isNull();
    }
}
