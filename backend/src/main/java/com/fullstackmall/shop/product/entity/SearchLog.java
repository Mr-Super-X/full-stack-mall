package com.fullstackmall.shop.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 搜索埋点日志：一次搜索（带结果数）或一次搜索结果点击（带商品 id）各一条。
 * 动态热搜数据源：近 7 天 result_count > 0 的词按频次取 Top N。
 */
@Data
@TableName("search_log")
public class SearchLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String keyword;

    /** 结果数；点击埋点场景为空 */
    private Integer resultCount;

    /** 点击的商品 id；纯搜索埋点场景为空 */
    private Long clickProductId;

    private LocalDateTime createTime;
}
