package com.fullstackmall.shop.user.interceptor;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.context.UserContext;
import com.fullstackmall.shop.user.service.JwtService;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 鉴权拦截器：从 HttpOnly Cookie 读 token 解析入 UserContext。
 * 红线：afterCompletion 必须 clear()——Tomcat 线程复用，不清理则下一请求读到上一用户。
 */
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtService jwtService;
    private final String cookieName;

    public AuthInterceptor(JwtService jwtService, String cookieName) {
        this.jwtService = jwtService;
        this.cookieName = cookieName;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String token = resolveToken(request);
        if (token == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        try {
            UserContext.set(jwtService.parse(token));
        } catch (JwtException e) {
            // 过期/篡改/格式错统一按未登录处理，不外泄 JWT 细节
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        UserContext.clear();
    }

    private String resolveToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
