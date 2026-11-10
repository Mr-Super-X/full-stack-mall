package com.fullstackmall.shop.seckill.mq;

import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/**
 * 异步出单生产者：受理成功后发消息（JSON + 持久化）。事务提交后发送（spec §5.3b）由调用方保证。
 */
@Slf4j
@Component
public class SeckillOrderCreateProducer {

    private final RabbitTemplate rabbitTemplate;

    public SeckillOrderCreateProducer(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void send(SeckillOrderMessage message) {
        rabbitTemplate.convertAndSend(SeckillMqConfig.EXCHANGE, SeckillMqConfig.ROUTING_KEY, message);
        log.info("[seckill] 出单消息已发送 orderNo={} activityId={}", message.orderNo(), message.activityId());
    }
}
