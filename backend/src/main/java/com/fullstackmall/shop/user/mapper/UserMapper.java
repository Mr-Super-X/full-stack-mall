package com.fullstackmall.shop.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.fullstackmall.shop.user.entity.User;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户表 Mapper：通用 CRUD 由 BaseMapper 承担，复杂查询再另起 XML。
 */
@Mapper
public interface UserMapper extends BaseMapper<User> {
}
