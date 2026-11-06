package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.common.Result;
import com.fullstackmall.shop.product.dto.HomeContentDTO;
import com.fullstackmall.shop.product.service.HomeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 首页聚合接口（无需登录）。
 */
@RestController
@RequestMapping("/mall/home")
public class HomeController {

    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @GetMapping("/content")
    public Result<HomeContentDTO> content() {
        return Result.success(homeService.homeContent());
    }
}
