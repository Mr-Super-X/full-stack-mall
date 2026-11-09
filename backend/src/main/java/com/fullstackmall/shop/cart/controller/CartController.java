package com.fullstackmall.shop.cart.controller;

import com.fullstackmall.shop.cart.dto.AddCartItemRequest;
import com.fullstackmall.shop.cart.dto.CartItemDTO;
import com.fullstackmall.shop.cart.dto.UpdateCartItemRequest;
import com.fullstackmall.shop.cart.service.CartService;
import com.fullstackmall.shop.common.Result;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 购物车接口：全部需登录（/mall/cart/** 挂 AuthInterceptor）。
 */
@RestController
@RequestMapping("/mall/cart")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public Result<List<CartItemDTO>> list() {
        return Result.success(cartService.list());
    }

    @PostMapping("/items")
    public Result<CartItemDTO> add(@Valid @RequestBody AddCartItemRequest req) {
        return Result.success(cartService.add(req));
    }

    @PatchMapping("/items/{id}")
    public Result<CartItemDTO> update(@PathVariable Long id, @Valid @RequestBody UpdateCartItemRequest req) {
        return Result.success(cartService.update(id, req));
    }

    @DeleteMapping("/items/{id}")
    public Result<Void> remove(@PathVariable Long id) {
        cartService.remove(id);
        return Result.success(null);
    }
}
