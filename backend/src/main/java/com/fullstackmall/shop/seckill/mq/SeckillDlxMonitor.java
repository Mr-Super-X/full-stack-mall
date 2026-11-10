package com.fullstackmall.shop.seckill.mq;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.entity.SeckillOrderAcceptance;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.mapper.SeckillOrderAcceptanceMapper;
import com.fullstackmall.shop.seckill.service.RedisStockDeductor;
import com.rabbitmq.client.Channel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.listener.api.ChannelAwareMessageListener;
import org.springframework.stereotype.Component;

/**
 * DLX 死信监控（spec §5.5/§8）：落库失败 3 次进 DLQ 的消息在此消费——
 * 自动回补三件套（DB sold_count-1 条件防负 / Redis 关口 INCR / 受理表置 FAILED），
 * 死信不人工介入也能收敛；人工只处理 Redis 宕机类（取舍声明 §14）。
 * 监控器自身失败 nack 不回流：毒消息防死循环（重新投递只会再次失败）。
 */
@Slf4j
@Component
public class SeckillDlxMonitor implements ChannelAwareMessageListener {

    /** JSR310 必注册：消息含 LocalDateTime，默认 ObjectMapper 反序列化即抛（T8 实证） */
    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private final RedisStockDeductor redisStockDeductor;
    private final SeckillOrderAcceptanceMapper acceptanceMapper;

    public SeckillDlxMonitor(RedisStockDeductor redisStockDeductor,
                             SeckillOrderAcceptanceMapper acceptanceMapper) {
        this.redisStockDeductor = redisStockDeductor;
        this.acceptanceMapper = acceptanceMapper;
    }

    @Override
    @RabbitListener(queues = SeckillMqConfig.DLQ, containerFactory = "seckillListenerContainerFactory")
    public void onMessage(Message message, Channel channel) throws Exception {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        SeckillOrderMessage payload;
        try {
            payload = objectMapper.readValue(message.getBody(), SeckillOrderMessage.class);
        } catch (Exception e) {
            log.error("[seckill] DLQ 毒消息解析失败，nack 丢弃（防循环）deliveryTag={}", deliveryTag, e);
            channel.basicNack(deliveryTag, false, false);
            return;
        }
        try {
            // ① DB 不动：消费失败的消息从未成功 sold_count+1（事务原子性），-1 会误减他人售出
            //    （终审 Critical-2——旧实现的 gt>0 守卫只是侥幸 no-op，已删除）
            // ② Redis 关口回补（内部已 catch Redis 不可用，warn 不阻断）
            redisStockDeductor.restoreStock(payload.activityId());
            // ③ 受理表置 FAILED（轮询端点据此告知前端"抢购失败，库存已回补"）
            acceptanceMapper.update(null, Wrappers.<SeckillOrderAcceptance>update()
                    .set("status", "FAILED")
                    .eq("order_no", payload.orderNo())
                    .eq("status", "ACCEPTED"));
            channel.basicAck(deliveryTag, false);
        } catch (Exception e) {
            log.error("[seckill] DLQ 回补失败（三件套异常），nack 丢弃防循环 orderNo={}", payload.orderNo(), e);
            channel.basicNack(deliveryTag, false, false);
        }
    }
}
