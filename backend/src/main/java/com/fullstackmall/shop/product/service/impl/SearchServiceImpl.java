package com.fullstackmall.shop.product.service.impl;

import com.fullstackmall.shop.product.dto.SearchTrackRequest;
import com.fullstackmall.shop.product.entity.SearchLog;
import com.fullstackmall.shop.product.mapper.ProductMapper;
import com.fullstackmall.shop.product.mapper.SearchLogMapper;
import com.fullstackmall.shop.product.service.SearchService;
import com.fullstackmall.shop.product.utils.SearchQuerySupport;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * 搜索增强实现：联想走 product FULLTEXT（ngram），热搜/埋点走 search_log。
 */
@Service
public class SearchServiceImpl implements SearchService {

    /** 动态热搜窗口（天）与条数；不足时由常量回退补齐，见 {@link #hotWords()} */
    private static final int HOT_WINDOW_DAYS = 7;
    private static final int HOT_LIMIT = 8;

    /** 运营位热搜词（search_log 无数据时回退，保证首屏不为空） */
    private static final List<String> FALLBACK_HOT_WORDS = List.of(
            "连衣裙", "牛仔外套", "乐福鞋", "T恤", "风衣", "针织衫", "半身裙", "短靴");

    private final ProductMapper productMapper;
    private final SearchLogMapper searchLogMapper;

    public SearchServiceImpl(ProductMapper productMapper, SearchLogMapper searchLogMapper) {
        this.productMapper = productMapper;
        this.searchLogMapper = searchLogMapper;
    }

    @Override
    public List<String> suggest(String keyword) {
        // sanitize 后为空（纯符号输入）按未传处理：联想区留空，不查库
        String cleaned = StringUtils.hasText(keyword) ? SearchQuerySupport.sanitize(keyword.trim()) : null;
        if (cleaned == null) {
            return List.of();
        }
        return productMapper.selectSuggestNames(cleaned);
    }

    @Override
    public List<String> hotWords() {
        List<String> hot = searchLogMapper.selectHotKeywords(HOT_WINDOW_DAYS, HOT_LIMIT);
        // 日志量不足 HOT_LIMIT 时用常量回退补齐——冷热启动首屏均不为空
        if (hot.size() >= HOT_LIMIT) {
            return hot;
        }
        ArrayList<String> merged = new ArrayList<>(hot);
        for (String w : FALLBACK_HOT_WORDS) {
            if (merged.size() >= HOT_LIMIT) {
                break;
            }
            if (!merged.contains(w)) {
                merged.add(w);
            }
        }
        return merged;
    }

    @Override
    public void track(SearchTrackRequest request) {
        String cleaned = SearchQuerySupport.sanitize(request.getKeyword().trim());
        if (cleaned == null) {
            return;
        }
        SearchLog log = new SearchLog();
        log.setKeyword(cleaned);
        log.setResultCount(request.getResultCount());
        log.setClickProductId(request.getClickProductId());
        searchLogMapper.insert(log);
    }
}
