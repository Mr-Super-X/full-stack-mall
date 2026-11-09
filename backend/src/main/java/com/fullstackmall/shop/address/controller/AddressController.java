package com.fullstackmall.shop.address.controller;

import com.fullstackmall.shop.address.dto.AddressDTO;
import com.fullstackmall.shop.address.dto.AddressRequest;
import com.fullstackmall.shop.address.service.AddressService;
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
 * 地址接口：全部需登录（WebMvcConfig 注册 AuthInterceptor 于 /mall/addresses/**）。
 */
@RestController
@RequestMapping("/mall/addresses")
public class AddressController {

    private final AddressService addressService;

    public AddressController(AddressService addressService) {
        this.addressService = addressService;
    }

    @GetMapping
    public Result<List<AddressDTO>> list() {
        return Result.success(addressService.list());
    }

    @PostMapping
    public Result<AddressDTO> create(@Valid @RequestBody AddressRequest req) {
        return Result.success(addressService.create(req));
    }

    @PatchMapping("/{id}")
    public Result<AddressDTO> update(@PathVariable Long id, @Valid @RequestBody AddressRequest req) {
        return Result.success(addressService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public Result<Void> remove(@PathVariable Long id) {
        addressService.remove(id);
        return Result.success(null);
    }
}
