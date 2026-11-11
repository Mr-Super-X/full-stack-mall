package com.fullstackmall.shop.user;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.dto.LoginRequest;
import com.fullstackmall.shop.user.dto.RegisterRequest;
import com.fullstackmall.shop.user.dto.UserInfoDTO;
import com.fullstackmall.shop.user.entity.User;
import com.fullstackmall.shop.user.mapper.UserMapper;
import com.fullstackmall.shop.user.service.AuthService;
import com.fullstackmall.shop.user.service.impl.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

/**
 * AuthService 单测：mapper 打桩、BCrypt 用真实实现（注册哈希与登录校验是安全关键路径，不 mock）。
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserMapper userMapper;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl(userMapper);
    }

    @Test
    void shouldThrowUsernameExistsWhenDuplicateName() {
        // CI 行为由数据库 collation 保证；service 只认 exists 命中
        given(userMapper.selectCount(any())).willReturn(1L);

        assertThatThrownBy(() -> authService.register(registerReq("admin", "123456")))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.USERNAME_EXISTS);
    }

    @Test
    void shouldPersistBcryptHashNotPlaintextWhenRegisterSuccess() {
        given(userMapper.selectCount(any())).willReturn(0L);

        authService.register(registerReq("newbie", "123456"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        String hashed = captor.getValue().getPassword();
        assertThat(hashed).startsWith("$2");
        assertThat(hashed).isNotEqualTo("123456");
        assertThat(new BCryptPasswordEncoder().matches("123456", hashed)).isTrue();
    }

    @Test
    void shouldUseSameMessageForUserNotFoundAndWrongPasswordToPreventEnumeration() {
        given(userMapper.selectOne(any())).willReturn(null);
        assertThatThrownBy(() -> authService.login(loginReq("ghost", "123456")))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.BAD_CREDENTIALS);

        User seller = userWith(2L, "seller", new BCryptPasswordEncoder().encode("seller123"));
        given(userMapper.selectOne(any())).willReturn(seller);
        assertThatThrownBy(() -> authService.login(loginReq("seller", "wrong-pass")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("用户名或密码错误");
    }

    @Test
    void shouldReturnUserInfoWhenLoginSuccess() {
        User seller = userWith(2L, "seller", new BCryptPasswordEncoder().encode("seller123"));
        given(userMapper.selectOne(any())).willReturn(seller);

        UserInfoDTO info = authService.login(loginReq("seller", "seller123"));

        assertThat(info.getId()).isEqualTo(2L);
        assertThat(info.getUsername()).isEqualTo("seller");
        assertThat(info.getRole()).isEqualTo("USER");
    }

    @Test
    void shouldTreatMissingUserAsUnauthorizedWhenInfoOf() {
        given(userMapper.selectById(99L)).willReturn(null);

        assertThatThrownBy(() -> authService.infoOf(99L))
                .isInstanceOf(BusinessException.class)
                .extracting("resultCode").isEqualTo(ResultCode.UNAUTHORIZED);
    }

    private RegisterRequest registerReq(String username, String password) {
        RegisterRequest req = new RegisterRequest();
        req.setUsername(username);
        req.setPassword(password);
        return req;
    }

    private LoginRequest loginReq(String username, String password) {
        LoginRequest req = new LoginRequest();
        req.setUsername(username);
        req.setPassword(password);
        return req;
    }

    private User userWith(Long id, String username, String encodedPassword) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setPassword(encodedPassword);
        user.setNickname(username + "的昵称");
        user.setRole(com.fullstackmall.shop.user.enums.UserRole.USER);
        user.setStatus(1);
        return user;
    }
}
