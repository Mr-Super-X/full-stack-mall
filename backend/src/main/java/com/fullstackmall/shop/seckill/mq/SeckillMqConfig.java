package com.fullstackmall.shop.seckill.mq;

import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * 秒杀异步出单拓扑（spec §5.1）：queue(durable, DLX+TTL 兜底) → dlx(fanout) → dlq；
 * 重试由消费者重新发布带 x-retry-count 实现（requeue 不保留 header，计数会丢——实测语义）。
 */
@Configuration
public class SeckillMqConfig {

    public static final String EXCHANGE = "seckill-order-create.exchange";
    public static final String QUEUE = "seckill-order-create.queue";
    public static final String DLX = "seckill-order-create.dlx";
    public static final String DLQ = "seckill-order-create.dlq";
    public static final String ROUTING_KEY = "seckill.order.create";
    /** 消费卡死兜底 TTL（非重试间隔：重试走重新发布，见 Consumer） */
    private static final long MESSAGE_TTL_MS = 300_000;

    @Bean
    public Queue seckillOrderCreateQueue() {
        return new Queue(QUEUE, true, false, false, Map.of(
                "x-dead-letter-exchange", DLX,
                "x-message-ttl", MESSAGE_TTL_MS));
    }

    @Bean
    public DirectExchange seckillOrderCreateExchange() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    public Binding seckillOrderCreateBinding(Queue seckillOrderCreateQueue,
                                             DirectExchange seckillOrderCreateExchange) {
        return BindingBuilder.bind(seckillOrderCreateQueue).to(seckillOrderCreateExchange).with(ROUTING_KEY);
    }

    @Bean
    public FanoutExchange seckillOrderCreateDlx() {
        return new FanoutExchange(DLX, true, false);
    }

    @Bean
    public Queue seckillOrderCreateDlq() {
        return new Queue(DLQ, true);
    }

    @Bean
    public Binding seckillOrderCreateDlqBinding(Queue seckillOrderCreateDlq,
                                                FanoutExchange seckillOrderCreateDlx) {
        return BindingBuilder.bind(seckillOrderCreateDlq).to(seckillOrderCreateDlx);
    }

    @Bean
    public MessageConverter jacksonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /** 手动 ack + prefetch=1：消费者完全控制确认时机（事务成功才 ack，幂等/重试/DLX 语义见 Consumer） */
    @Bean
    public SimpleRabbitListenerContainerFactory seckillListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        factory.setPrefetchCount(1);
        factory.setMessageConverter(jacksonMessageConverter());
        return factory;
    }
}
