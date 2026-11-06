package com.fullstackmall.shop.user.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.user.context.UserContext;
import com.fullstackmall.shop.user.dto.LoginRequest;
import com.fullstackmall.shop.user.dto.RegisterRequest;
import com.fullstackmall.shop.user.dto.UserInfoDTO;
import com.fullstackmall.shop.user.service.AuthService;
import com.fullstackmall.shop.user.service.JwtService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证接口：register/login/logout 匿名可访问，me 由 AuthInterceptor 保护（WebMvcConfig 注册）。
 * Cookie 用 ResponseCookie 构造——jakarta Cookie API 不支持 SameSite 属性。
 */
@RestController
@RequestMapping("/mall/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final String cookieName;
    private final long expireSeconds;

    public AuthController(AuthService authService,
                          JwtService jwtService,
                          @Value("${app.jwt.cookie-name}") String cookieName,
                          @Value("${app.jwt.expire-hours}") long expireHours) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.cookieName = cookieName;
        this.expireSeconds = expireHours * 3600;
    }

    @PostMapping("/register")
    public Result<UserInfoDTO> register(@Valid @RequestBody RegisterRequest req) {
        return Result.success(authService.register(req));
    }

    @PostMapping("/login")
    public Result<UserInfoDTO> login(@Valid @RequestBody LoginRequest req, HttpServletResponse response) {
        UserInfoDTO info = authService.login(req);
        String token = jwtService.sign(info.getId(), info.getUsername(), info.getRole());
        writeCookie(response, token, expireSeconds);
        return Result.success(info);
    }

    @PostMapping("/logout")
    public Result<Void> logout(HttpServletResponse response) {
        // HttpOnly Cookie 前端删不掉，必须由服务端置过期
        writeCookie(response, "", 0);
        return Result.success(null);
    }

    @GetMapping("/me")
    public Result<UserInfoDTO> me() {
        return Result.success(authService.infoOf(UserContext.getRequired().userId()));
    }

    private void writeCookie(HttpServletResponse response, String value, long maxAgeSeconds) {
        ResponseCookie cookie = ResponseCookie.from(cookieName, value)
                .httpOnly(true)
                .sameSite("Lax")
                .path("/api")
                .maxAge(maxAgeSeconds)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
