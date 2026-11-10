package com.fullstackmall.shop.product.utils;

import java.util.regex.Pattern;

/**
 * 搜索关键词清洗：去除 MySQL 全文检索 BOOLEAN MODE 操作符（+-~*><()"@ 等），
 * 压缩连续空白。AGAINST 语法错误会被全局兜底为「系统繁忙」（500），
 * 转义是正确性边界而非体验优化——调用方必须经本工具后再拼 MATCH。
 */
public final class SearchQuerySupport {

    private static final Pattern BOOLEAN_OPERATORS = Pattern.compile("[+\\-~*><()\"@]+");
    private static final Pattern WHITESPACES = Pattern.compile("\\s+");

    private SearchQuerySupport() {
    }

    /**
     * 清洗关键词：BOOLEAN 操作符替换为单空格、连续空白压缩；结果为空返回 null（调用方按未传处理）。
     */
    public static String sanitize(String keyword) {
        if (keyword == null) {
            return null;
        }
        String cleaned = BOOLEAN_OPERATORS.matcher(keyword).replaceAll(" ");
        cleaned = WHITESPACES.matcher(cleaned.trim()).replaceAll(" ");
        return cleaned.isEmpty() ? null : cleaned;
    }
}
