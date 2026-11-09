package com.fullstackmall.shop.user.interceptor;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.context.UserContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 管理员角色守卫：仅注册在 /mall/admin/**（WebMvcConfig，且 AuthInterceptor 已先行解析身份）。
 * 职责边界：只校验角色（USER → 403）；身份缺失场景由 UserContext.getRequired() 抛 401，
 * 本拦截器不重复处理——拦截器注册顺序即语义（先 Auth 后 Admin）。
 */
public class AdminInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String role = UserContext.getRequired().role();
        if (!"ADMIN".equals(role)) {
            throw new BusinessException(ResultCode.FORBIDDEN);
        }
        return true;
    }
}
