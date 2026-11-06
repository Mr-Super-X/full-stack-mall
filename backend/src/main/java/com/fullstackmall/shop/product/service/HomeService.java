package com.fullstackmall.shop.product.service;

import com.fullstackmall.shop.product.dto.HomeContentDTO;

/**
 * 首页聚合读服务。
 */
public interface HomeService {

    /**
     * 首页五区块聚合：notice/banners/categories/flash/news/recommend；
     * 任一区块无数据返回空集合，整体恒为成功。
     */
    HomeContentDTO homeContent();
}
