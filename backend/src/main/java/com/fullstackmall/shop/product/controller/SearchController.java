package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 搜索接口：热搜词（匿名可访问，不挂 AuthInterceptor）。
 * 热搜词为运营位常量（接入配置中心是 v2 事，本期无真实搜索日志）。
 */
@RestController
@RequestMapping("/mall/search")
public class SearchController {

    /** 运营位热搜词（与前端搜索页 chips 展示对齐，8 词） */
    private static final List<String> HOT_WORDS = List.of(
            "连衣裙", "牛仔外套", "乐福鞋", "T恤", "风衣", "针织衫", "半身裙", "短靴");

    @GetMapping("/hot-words")
    public Result<List<String>> hotWords() {
        return Result.success(HOT_WORDS);
    }
}
