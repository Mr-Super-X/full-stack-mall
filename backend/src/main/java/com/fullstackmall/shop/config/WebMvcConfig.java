package com.fullstackmall.shop.config;

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
        registry.addInterceptor(new AuthInterceptor(jwtService, cookieName))
                .addPathPatterns("/mall/auth/me");
    }
}
