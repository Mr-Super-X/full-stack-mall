package com.fullstackmall.shop.seckill.mq;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fullstackmall.shop.seckill.service.SeckillService;
import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.listener.api.ChannelAwareMessageListener;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 异步出单消费者：传输层职责——ack/nack/重试计数/故障注入；
 * 业务建单事务委托 SeckillService.fulfillSeckillOrder（@Transactional 经代理，规避自调用失效）。
 *
 * 重试模型（spec §5.3）：失败时重新发布带 x-retry-count+1 的新消息并 ack 原消息
 * （basicNack(requeue=true) 保留原消息不保留 header，计数会丢——重新发布才能准确计数）；
 * 第 3 次仍失败 nack(requeue=false) 死信进 DLQ，由 DlxMonitor 回补。
 */
@Slf4j
@Component
public class SeckillOrderCreateConsumer implements ChannelAwareMessageListener {

    /** 最大消费重试次数（第 3 次失败进 DLX） */
    private static final int MAX_RETRY = 3;
    private static final String RETRY_HEADER = "x-retry-count";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SeckillService seckillService;
    private final RabbitTemplate rabbitTemplate;
    /** 故障注入：消费失败率 0~1（spec §8 对照表"落库失败"行；仅压测开启） */
    private final double simulatedFailureRate;

    public SeckillOrderCreateConsumer(SeckillService seckillService,
                                      RabbitTemplate rabbitTemplate,
                                      @Value("${seckill.mq.consumer-simulated-failure-rate:0}") double simulatedFailureRate) {
        this.seckillService = seckillService;
        this.rabbitTemplate = rabbitTemplate;
        this.simulatedFailureRate = simulatedFailureRate;
    }

    @PostConstruct
    void warnIfInjectionEnabled() {
        if (simulatedFailureRate > 0) {
            log.warn("[seckill] ⚠️ 故障注入已开启：consumer-simulated-failure-rate={}（仅压测/对照实验场景，生产必须为 0）",
                    simulatedFailureRate);
        }
    }

    @Override
    @RabbitListener(queues = SeckillMqConfig.QUEUE, containerFactory = "seckillListenerContainerFactory")
    public void onMessage(Message message, Channel channel) throws Exception {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        SeckillOrderMessage payload;
        try {
            payload = objectMapper.readValue(message.getBody(), SeckillOrderMessage.class);
        } catch (Exception e) {
            log.error("[seckill] 消息反序列化失败（毒消息），进 DLX deliveryTag={}", deliveryTag, e);
            channel.basicNack(deliveryTag, false, false);
            return;
        }
        try {
            if (simulatedFailureRate > 0) {
                log.warn("[seckill] 故障注入评估：rate={} orderNo={}", simulatedFailureRate, payload.orderNo());
                if (ThreadLocalRandom.current().nextDouble() < simulatedFailureRate) {
                    throw new IllegalStateException("模拟消费失败（故障注入开关）");
                }
            }
            seckillService.fulfillSeckillOrder(payload);
            channel.basicAck(deliveryTag, false);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // 撞 uk_user_activity：同用户同活动消息已被消费过（重复消费场景）——ack 丢弃不回流
            log.warn("[seckill] 重复消费撞唯一键，ack 丢弃 orderNo={} userId={}", payload.orderNo(), payload.userId());
            channel.basicAck(deliveryTag, false);
        } catch (Exception e) {
            handleRetry(message, channel, deliveryTag, payload, e);
        }
    }

    private void handleRetry(Message message, Channel channel, long deliveryTag,
                             SeckillOrderMessage payload, Exception e) throws Exception {
        int retry = retryCount(message.getMessageProperties());
        if (retry + 1 >= MAX_RETRY) {
            log.error("[seckill] 消费重试 {} 次仍失败，进 DLX（等待 DlxMonitor 回补）orderNo={}", MAX_RETRY, payload.orderNo(), e);
            channel.basicNack(deliveryTag, false, false);
            return;
        }
        log.warn("[seckill] 消费失败，带计数重投 {}/{} orderNo={}", retry + 1, MAX_RETRY, payload.orderNo(), e);
        MessageProperties newProps = new MessageProperties();
        newProps.getHeaders().putAll(message.getMessageProperties().getHeaders());
        newProps.setHeader(RETRY_HEADER, retry + 1);
        newProps.setContentType(MessageProperties.CONTENT_TYPE_JSON);
        rabbitTemplate.send(SeckillMqConfig.EXCHANGE, SeckillMqConfig.ROUTING_KEY,
                new Message(message.getBody(), newProps));
        channel.basicAck(deliveryTag, false);
    }

    private int retryCount(MessageProperties props) {
        Object value = props.getHeader(RETRY_HEADER);
        return value instanceof Number n ? n.intValue() : 0;
    }
}
