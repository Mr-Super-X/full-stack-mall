package com.fullstackmall.shop.user;

import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.service.JwtService;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * JwtService 纯单测：签发/解析往返、过期与篡改两类失败必须分治（拦截器据此映射 401）。
 */
class JwtServiceTest {

    private static final String SECRET = "test-secret-key-for-jwt-signing-32bytes-plus";

    @Test
    void 签发后解析应还原用户身份() {
        JwtService jwtService = new JwtService(SECRET, 24);

        String token = jwtService.sign(2L, "seller", "USER");
        LoginUser user = jwtService.parse(token);

        assertThat(user.userId()).isEqualTo(2L);
        assertThat(user.username()).isEqualTo("seller");
        assertThat(user.role()).isEqualTo("USER");
    }

    @Test
    void 过期token应抛ExpiredJwtException() throws InterruptedException {
        JwtService jwtService = new JwtService(SECRET, 0);
        String token = jwtService.sign(2L, "seller", "USER");

        // exp 精度为秒，睡 1.1s 确保跨过过期点
        Thread.sleep(1100);
        assertThatThrownBy(() -> jwtService.parse(token))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void 篡改签名应抛JwtException() {
        JwtService signer = new JwtService(SECRET, 24);
        JwtService otherKeyParser = new JwtService("another-secret-key-totally-different-32b", 24);
        String token = signer.sign(2L, "seller", "USER");

        assertThatThrownBy(() -> otherKeyParser.parse(token))
                .isInstanceOf(JwtException.class);
    }
}
