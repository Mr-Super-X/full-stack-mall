package com.fullstackmall.shop.product.utils;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * SearchQuerySupport 真逻辑单测：BOOLEAN 操作符去除、空白压缩、空词返回 null。
 * 防 500 红线：AGAINST 语法错误会被全局兜底为「系统繁忙」，转义是正确性而非体验项。
 */
class SearchQuerySupportTest {

    @Test
    void 普通中文词原样通过() {
        assertThat(SearchQuerySupport.sanitize("T恤")).isEqualTo("T恤");
    }

    @Test
    void 布尔操作符替换为空格() {
        assertThat(SearchQuerySupport.sanitize("牛仔+夹克")).isEqualTo("牛仔 夹克");
        assertThat(SearchQuerySupport.sanitize("a-b*c>d")).isEqualTo("a b c d");
    }

    @Test
    void 连续空白压缩为单空格() {
        assertThat(SearchQuerySupport.sanitize("  牛皮   靴 ")).isEqualTo("牛皮 靴");
    }

    @Test
    void 纯操作符清洗后为空返回null() {
        assertThat(SearchQuerySupport.sanitize("+++")).isNull();
        assertThat(SearchQuerySupport.sanitize("   ")).isNull();
        assertThat(SearchQuerySupport.sanitize("")).isNull();
    }

    @Test
    void 空值原样返回null() {
        assertThat(SearchQuerySupport.sanitize(null)).isNull();
    }
}
