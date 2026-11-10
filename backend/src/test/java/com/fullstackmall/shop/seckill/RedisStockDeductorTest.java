package com.fullstackmall.shop.seckill;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.seckill.entity.SeckillActivity;
import com.fullstackmall.shop.seckill.mapper.SeckillActivityMapper;
import com.fullstackmall.shop.seckill.service.RedisStockDeductor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Redis Lua 预扣契约（Testcontainers 真容器——原子语义无法纯 mock 验证）：
 * ①预扣成功占位 TTL ②抢完 40002 ③重复扣 40003 ④key 缺失 DB 自愈重建。
 */
@Testcontainers
class RedisStockDeductorTest {

    @Container
    static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7")).withExposedPorts(6379);

    private StringRedisTemplate template;
    private SeckillActivityMapper seckillActivityMapper;
    private RedisStockDeductor deductor;

    @BeforeEach
    void setUp() {
        LettuceConnectionFactory factory =
                new LettuceConnectionFactory(REDIS.getHost(), REDIS.getMappedPort(6379));
        factory.afterPropertiesSet();
        template = new StringRedisTemplate(factory);
        template.afterPropertiesSet();
        template.getConnectionFactory().getConnection().flushAll();
        seckillActivityMapper = mock(SeckillActivityMapper.class);
        deductor = new RedisStockDeductor(template, seckillActivityMapper);
    }

    private SeckillActivity activity(int stock, int sold) {
        SeckillActivity a = new SeckillActivity();
        a.setId(16L);
        a.setSeckillStock(stock);
        a.setSoldCount(sold);
        a.setSeckillPrice(new BigDecimal("299.40"));
        return a;
    }

    @Test
    @DisplayName("预扣成功：stock-1，占位 key 存在且 TTL≈900（对齐订单 15min 超时）")
    void deduct_ok_decrementsAndPlacesHolder() {
        template.opsForValue().set("seckill:stock:16", "5");

        deductor.deduct(16L, 3L, "M-TEST-001");

        assertThat(template.opsForValue().get("seckill:stock:16")).isEqualTo("4");
        assertThat(template.opsForValue().get("seckill:order:16:3")).isEqualTo("M-TEST-001");
        Long ttl = template.getExpire("seckill:order:16:3");
        assertThat(ttl).isBetween(850L, 900L);
    }

    @Test
    @DisplayName("抢完：stock=0 抛 40002 SOLD_OUT")
    void deduct_soldOut_throws() {
        template.opsForValue().set("seckill:stock:16", "0");

        assertThatThrownBy(() -> deductor.deduct(16L, 3L, "M-TEST-002"))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.SOLD_OUT);
    }

    @Test
    @DisplayName("限购占位：同用户二次扣抛 40003 LIMIT_EXCEEDED（stock 不被二次扣）")
    void deduct_duplicateUser_throwsLimited() {
        template.opsForValue().set("seckill:stock:16", "5");
        deductor.deduct(16L, 3L, "M-TEST-003");

        assertThatThrownBy(() -> deductor.deduct(16L, 3L, "M-TEST-004"))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.LIMIT_EXCEEDED);
        assertThat(template.opsForValue().get("seckill:stock:16")).isEqualTo("4");
    }

    @Test
    @DisplayName("key 缺失自愈：从 DB (stock-sold) SET NX 重建后重试，预扣成功")
    void deduct_missingKey_selfHealsFromDb() {
        when(seckillActivityMapper.selectById(16L)).thenReturn(activity(5, 0));

        deductor.deduct(16L, 3L, "M-TEST-005");

        assertThat(template.opsForValue().get("seckill:stock:16")).isEqualTo("4");
    }
}
