package com.fullstackmall.shop.common;

import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.context.UserContext;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 令牌桶限流契约（Testcontainers Redis）：①容量耗尽拒（40006）②refill 窗口恢复
 * ③全局桶共享 + 用户桶独立的双层语义（spec §6）。
 */
@Testcontainers
class RateLimitAspectTest {

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7")).withExposedPorts(6379);

    private StringRedisTemplate template;

    @BeforeEach
    void setUp() {
        LettuceConnectionFactory factory =
                new LettuceConnectionFactory(REDIS.getHost(), REDIS.getMappedPort(6379));
        factory.afterPropertiesSet();
        template = new StringRedisTemplate(factory);
        template.afterPropertiesSet();
        template.getConnectionFactory().getConnection().flushAll();
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    private RateLimitAspect aspect(int capacity, int refill) {
        return new RateLimitAspect(template, capacity, refill);
    }

    private RateLimit annotation(String key) {
        RateLimit rl = mock(RateLimit.class);
        when(rl.key()).thenReturn(key);
        return rl;
    }

    private void invoke(RateLimitAspect aspect, String key) throws Throwable {
        ProceedingJoinPoint pjp = mock(ProceedingJoinPoint.class);
        org.mockito.Mockito.when(pjp.proceed()).thenReturn(null);
        aspect.around(pjp, annotation(key));
    }

    @Test
    @DisplayName("容量耗尽：capacity=2 第三次调用抛 40006 RATE_LIMITED（无 UserContext，仅全局桶）")
    void capacityExhausted_throwsRateLimited() throws Throwable {
        RateLimitAspect aspect = aspect(2, 0);
        invoke(aspect, "seckill-order");
        invoke(aspect, "seckill-order");
        assertThatThrownBy(() -> invoke(aspect, "seckill-order"))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.RATE_LIMITED);
    }

    @Test
    @DisplayName("refill 补充：capacity=1/refill=1，第二次即拒，1.2s 窗口后恢复放行")
    void refillWindow_restoresToken() throws Throwable {
        RateLimitAspect aspect = aspect(1, 1);
        invoke(aspect, "seckill-order");
        assertThatThrownBy(() -> invoke(aspect, "seckill-order"))
                .isInstanceOf(BusinessException.class);
        Thread.sleep(1200);
        assertThatCode(() -> invoke(aspect, "seckill-order")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("双层语义：全局桶耗尽后新用户也被拒（共享）；全局清桶后用户桶独立耗尽仍拒")
    void dualLayer_globalShared_userIndependent() throws Throwable {
        RateLimitAspect aspect = aspect(2, 0);
        UserContext.set(new LoginUser(3L, "a", "USER"));
        invoke(aspect, "seckill-order"); // 全局 2→1，用户3 2→1
        UserContext.set(new LoginUser(4L, "b", "USER"));
        invoke(aspect, "seckill-order"); // 全局 1→0，用户4 2→1
        // 全局耗尽：新用户 5 也被拒（全局层共享生效）
        UserContext.set(new LoginUser(5L, "c", "USER"));
        assertThatThrownBy(() -> invoke(aspect, "seckill-order"))
                .isInstanceOf(BusinessException.class);
        // 清全局桶：用户 5 全局层过（2→1），用户层独立计数
        template.delete("seckill:rate-limit:seckill-order");
        invoke(aspect, "seckill-order"); // 用户5 2→1
        invoke(aspect, "seckill-order"); // 用户5 1→0
        assertThatThrownBy(() -> invoke(aspect, "seckill-order"))
                .isInstanceOf(BusinessException.class); // 用户桶耗尽（全局仍有余）
    }
}
