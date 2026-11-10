package com.fullstackmall.shop.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 4b 终审 Critical-1 回归：application.yml 的 spring.data.redis / spring.rabbitmq 绑定。
 * T1 曾把两段误挂在 mybatis-plus 节下（缩进错位），全部配置静默失效、靠默认值侥幸可连——
 * 本测试锁定配置落在顶层 spring 节（属性存在且值正确）。
 */
@SpringJUnitConfig(initializers = ConfigDataApplicationContextInitializer.class)
class MessagingConfigBindingTest {

    @Autowired
    private Environment env;

    @Configuration
    static class EmptyConfig {
    }

    @Test
    @DisplayName("Redis/RabbitMQ 配置绑定在顶层 spring 节（缩进错位时这些属性为 null）")
    void messagingPropertiesBoundUnderTopLevelSpring() {
        assertThat(env.getProperty("spring.data.redis.host")).isEqualTo("localhost");
        assertThat(env.getProperty("spring.data.redis.port")).isEqualTo("6379");
        assertThat(env.getProperty("spring.rabbitmq.host")).isEqualTo("localhost");
        assertThat(env.getProperty("spring.rabbitmq.port")).isEqualTo("5672");
        assertThat(env.getProperty("spring.rabbitmq.listener.simple.acknowledge-mode"))
                .isEqualTo("manual");
        assertThat(env.getProperty("spring.rabbitmq.listener.simple.prefetch")).isEqualTo("1");
        // datasource 同节共存（合并 spring 段时不得覆盖既有键）
        assertThat(env.getProperty("spring.datasource.username")).isEqualTo("root");
    }
}
