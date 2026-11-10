package com.fullstackmall.shop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

/**
 * CORS 配置：允许前端 dev server / dev-gateway 跨域来源并携带凭证
 * （slice 2 起 HttpOnly Cookie 鉴权依赖 allowCredentials）。
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(splitOrigins())
                // PATCH 不可缺：浏览器对非 GET 请求携带 Origin 头，购物车改量等 PATCH 端点
                // 不在此列表会被 CorsFilter 整包拒为 403「Invalid CORS request」
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    private String[] splitOrigins() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .toArray(String[]::new);
    }
}
