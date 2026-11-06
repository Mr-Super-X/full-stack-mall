package com.fullstackmall.shop.user.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.dto.LoginRequest;
import com.fullstackmall.shop.user.dto.RegisterRequest;
import com.fullstackmall.shop.user.dto.UserInfoDTO;
import com.fullstackmall.shop.user.entity.User;
import com.fullstackmall.shop.user.enums.UserRole;
import com.fullstackmall.shop.user.mapper.UserMapper;
import com.fullstackmall.shop.user.service.AuthService;
import org.springframework.beans.BeanUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * 认证业务实现。BCryptPasswordEncoder 为无状态算法组件，直 new 不走 DI（无可替换实现）。
 */
@Service
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AuthServiceImpl(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public UserInfoDTO register(RegisterRequest req) {
        Long exists = userMapper.selectCount(
                Wrappers.<User>lambdaQuery().eq(User::getUsername, req.getUsername()));
        if (exists != null && exists > 0) {
            throw new BusinessException(ResultCode.USERNAME_EXISTS);
        }
        User user = new User();
        user.setUsername(req.getUsername());
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setNickname(StringUtils.hasText(req.getNickname()) ? req.getNickname() : req.getUsername());
        user.setRole(UserRole.USER);
        user.setStatus(1);
        userMapper.insert(user);
        return toInfo(user);
    }

    @Override
    public UserInfoDTO login(LoginRequest req) {
        User user = userMapper.selectOne(
                Wrappers.<User>lambdaQuery().eq(User::getUsername, req.getUsername()));
        // 用户不存在与密码错误同文案，防账号枚举
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new BusinessException(ResultCode.BAD_CREDENTIALS);
        }
        return toInfo(user);
    }

    @Override
    public UserInfoDTO infoOf(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return toInfo(user);
    }

    private UserInfoDTO toInfo(User user) {
        UserInfoDTO info = new UserInfoDTO();
        BeanUtils.copyProperties(user, info, "password");
        info.setRole(user.getRole().name());
        return info;
    }
}
