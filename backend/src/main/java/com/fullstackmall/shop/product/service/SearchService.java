package com.fullstackmall.shop.product.service;

import com.fullstackmall.shop.product.dto.SearchTrackRequest;

import java.util.List;

/**
 * 搜索增强：联想词 / 动态热搜 / 埋点落库。
 */
public interface SearchService {

    /**
     * 搜索联想词（≤10 个商品名）。keyword trim + sanitize 后为空返回空列表（调用方不展示联想区）。
     */
    List<String> suggest(String keyword);

    /**
     * 动态热搜：近 7 天有结果的搜索词 Top 8；日志为空时回退运营位常量，保证首屏不为空。
     */
    List<String> hotWords();

    /** 搜索埋点落库（sanitize 后写 search_log，异步化是 v2 事） */
    void track(SearchTrackRequest request);
}
