package com.fullstackmall.shop.user;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.context.UserContext;
import com.fullstackmall.shop.user.interceptor.AuthInterceptor;
import com.fullstackmall.shop.user.service.JwtService;
import io.jsonwebtoken.ExpiredJwtException;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

/**
 * AuthInterceptor 单测：401 映射（含过期不分流为 500）与 ThreadLocal 清理是红线。
 */
class AuthInterceptorTest {

    private JwtService jwtService;
    private AuthInterceptor interceptor;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        jwtService = mock(JwtService.class);
        interceptor = new AuthInterceptor(jwtService, "token");
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void shouldThrowUnauthorizedWhenNoCookie() {
        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.UNAUTHORIZED);
    }

    @Test
    void shouldMapExpiredTokenTo401Not500() {
        request.setCookies(new Cookie("token", "expired-token"));
        given(jwtService.parse("expired-token"))
                .willThrow(new ExpiredJwtException(null, null, "token expired"));

        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.UNAUTHORIZED);
    }

    @Test
    void shouldWriteUserContextWhenTokenValid() throws Exception {
        request.setCookies(new Cookie("token", "good-token"));
        given(jwtService.parse("good-token")).willReturn(new LoginUser(2L, "seller", "USER"));

        boolean proceed = interceptor.preHandle(request, response, new Object());

        assertThat(proceed).isTrue();
        assertThat(UserContext.get().username()).isEqualTo("seller");
    }

    @Test
    void shouldClearThreadLocalAfterRequestToPreventThreadMixing() throws Exception {
        request.setCookies(new Cookie("token", "good-token"));
        given(jwtService.parse("good-token")).willReturn(new LoginUser(2L, "seller", "USER"));
        interceptor.preHandle(request, response, new Object());

        interceptor.afterCompletion(request, response, new Object(), null);

        assertThat(UserContext.get()).isNull();
    }
}
