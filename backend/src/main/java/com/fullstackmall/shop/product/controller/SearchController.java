package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.product.dto.SearchTrackRequest;
import com.fullstackmall.shop.product.service.SearchService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 搜索接口（匿名可访问，不挂 AuthInterceptor）：
 * 联想词 / 动态热搜 / 埋点落库。动态热搜数据源为 search_log（近 7 天有结果词 Top 8，不足回退常量）。
 */
@Validated
@RestController
@RequestMapping("/mall/search")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/suggest")
    public Result<List<String>> suggest(
            @RequestParam("keyword")
            @NotBlank(message = "keyword 不能为空")
            @Size(max = 50, message = "keyword 长度不能超过 50") String keyword) {
        return Result.success(searchService.suggest(keyword));
    }

    @GetMapping("/hot-words")
    public Result<List<String>> hotWords() {
        return Result.success(searchService.hotWords());
    }

    @PostMapping("/track")
    public Result<Void> track(@Valid @RequestBody SearchTrackRequest request) {
        searchService.track(request);
        return Result.success(null);
    }
}
