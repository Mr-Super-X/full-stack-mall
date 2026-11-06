package com.fullstackmall.shop.user;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.controller.AuthController;
import com.fullstackmall.shop.user.dto.UserInfoDTO;
import com.fullstackmall.shop.user.service.AuthService;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AuthController 切片测试。JwtService 一并打桩：WebMvcConfig 注册拦截器需引用它，
 * 而 @WebMvcTest 不会加载 @Component 的 JwtService。
 * me 的拦截链路不在此处测（e2e 验收覆盖），这里只保 Controller 契约。
 */
@WebMvcTest(AuthController.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void 注册成功应返回用户信息() throws Exception {
        given(authService.register(any())).willReturn(info(4L, "newbie"));

        mockMvc.perform(post("/mall/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newbie\",\"password\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.username").value("newbie"));
    }

    @Test
    void 注册重名应返回400与文案() throws Exception {
        given(authService.register(any())).willThrow(new BusinessException(ResultCode.USERNAME_EXISTS));

        mockMvc.perform(post("/mall/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"seller\",\"password\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("用户名已被注册"));
    }

    @Test
    void 注册用户名格式非法应返回400() throws Exception {
        mockMvc.perform(post("/mall/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"a!\",\"password\":\"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void 登录成功应写入HttpOnly且SameSiteLax的Cookie() throws Exception {
        UserInfoDTO info = info(2L, "seller");
        info.setRole("USER");
        given(authService.login(any())).willReturn(info);
        given(jwtService.sign(2L, "seller", "USER")).willReturn("fake-jwt");

        mockMvc.perform(post("/mall/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"seller\",\"password\":\"seller123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("token=fake-jwt")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=Lax")));
    }

    @Test
    void 登录失败应返回400同文案() throws Exception {
        given(authService.login(any())).willThrow(new BusinessException(ResultCode.BAD_CREDENTIALS));

        mockMvc.perform(post("/mall/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"seller\",\"password\":\"wrong\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("用户名或密码错误"));
    }

    @Test
    void 登出应清除Cookie() throws Exception {
        mockMvc.perform(post("/mall/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));
    }

    private UserInfoDTO info(Long id, String username) {
        UserInfoDTO info = new UserInfoDTO();
        info.setId(id);
        info.setUsername(username);
        info.setNickname(username + "的昵称");
        info.setRole("USER");
        return info;
    }
}
