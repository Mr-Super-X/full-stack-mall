package com.fullstackmall.shop.config;

import com.fullstackmall.shop.user.interceptor.AdminInterceptor;
import com.fullstackmall.shop.user.interceptor.AuthInterceptor;
import com.fullstackmall.shop.user.service.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * MVC 配置：注册鉴权拦截器。
 * 阶段 1 仅保护 /mall/auth/me；后续阶段在此追加 /mall/cart/**、/mall/orders/** 等。
 * 匿名浏览的商品/首页接口刻意不挂拦截器。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final JwtService jwtService;
    private final String cookieName;

    public WebMvcConfig(JwtService jwtService,
                        @Value("${app.jwt.cookie-name}") String cookieName) {
        this.jwtService = jwtService;
        this.cookieName = cookieName;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册顺序即语义：Auth 先解析身份写 UserContext，Admin 后读上下文校验角色
        registry.addInterceptor(new AuthInterceptor(jwtService, cookieName))
                .addPathPatterns("/mall/auth/me", "/mall/consignments/**", "/mall/addresses/**",
                        "/mall/admin/**", "/mall/cart/**", "/mall/orders/**", "/mall/payments/**",
                        "/mall/seckill/*/orders", "/mall/seckill/orders/**")
                // 支付异步回调与模拟收银台：网关调用/浏览器直开，无用户 Cookie，鉴权靠验签，放行
                .excludePathPatterns("/mall/payments/fake/notify", "/mall/payments/fake/checkout");
        registry.addInterceptor(new AdminInterceptor())
                .addPathPatterns("/mall/admin/**");
    }
}
