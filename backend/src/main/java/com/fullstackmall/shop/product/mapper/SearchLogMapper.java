package com.fullstackmall.shop.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.fullstackmall.shop.product.entity.SearchLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SearchLogMapper extends BaseMapper<SearchLog> {

    /**
     * 动态热搜：近 {days} 天有结果的搜索词按频次 Top {limit}，同频次按最近一次搜索优先。
     */
    List<String> selectHotKeywords(@Param("days") int days, @Param("limit") int limit);
}
