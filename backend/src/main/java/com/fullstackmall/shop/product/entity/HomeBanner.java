package com.fullstackmall.shop.product.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 首页轮播实体。
 */
@Data
@TableName("home_banner")
public class HomeBanner {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String picUrl;

    private String linkUrl;

    private Integer sort;

    /** 1 启用 0 停用 */
    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
