package com.fullstackmall.shop.user;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.context.UserContext;
import com.fullstackmall.shop.user.interceptor.AdminInterceptor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * AdminInterceptor 单测：/mall/admin/** 角色守卫。
 * 身份未登录场景由 AuthInterceptor 先拦（401），本拦截器只处理"已登录但非管理员"→ 403。
 */
class AdminInterceptorTest {

    private final AdminInterceptor interceptor = new AdminInterceptor();
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void 无用户上下文应抛未登录() {
        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.UNAUTHORIZED);
    }

    @Test
    void 普通用户应抛无权限() {
        UserContext.set(new LoginUser(3L, "buyer", "USER"));

        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.FORBIDDEN);
    }

    @Test
    void 管理员应放行() throws Exception {
        UserContext.set(new LoginUser(1L, "admin", "ADMIN"));

        boolean proceed = interceptor.preHandle(request, response, new Object());

        assertThat(proceed).isTrue();
    }
}
