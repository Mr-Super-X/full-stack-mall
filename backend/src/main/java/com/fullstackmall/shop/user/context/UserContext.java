package com.fullstackmall.shop.user.context;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;

/**
 * 请求级登录用户上下文（ThreadLocal）。
 * 红线：Tomcat 线程复用，AuthInterceptor.afterCompletion 必须调用 clear()，否则串号。
 */
public final class UserContext {

    private static final ThreadLocal<LoginUser> HOLDER = new ThreadLocal<>();

    private UserContext() {
    }

    public static void set(LoginUser user) {
        HOLDER.set(user);
    }

    /** 可能为 null（未登录或匿名路径），调用方自行判空 */
    public static LoginUser get() {
        return HOLDER.get();
    }

    /** 受保护路径专用：未登录直接抛 401 */
    public static LoginUser getRequired() {
        LoginUser user = HOLDER.get();
        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return user;
    }

    public static void clear() {
        HOLDER.remove();
    }
}
