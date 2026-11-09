package com.fullstackmall.shop.address.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fullstackmall.shop.address.dto.AddressDTO;
import com.fullstackmall.shop.address.dto.AddressRequest;
import com.fullstackmall.shop.address.entity.Address;
import com.fullstackmall.shop.address.mapper.AddressMapper;
import com.fullstackmall.shop.address.service.AddressService;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.context.UserContext;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 地址业务实现。归属校验统一走"按 id + userId 双条件查询"——查不到即 404（不暴露存在性）。
 */
@Service
public class AddressServiceImpl implements AddressService {

    private final AddressMapper addressMapper;

    public AddressServiceImpl(AddressMapper addressMapper) {
        this.addressMapper = addressMapper;
    }

    @Override
    public List<AddressDTO> list() {
        Long userId = UserContext.getRequired().userId();
        List<Address> addresses = addressMapper.selectList(Wrappers.<Address>lambdaQuery()
                .eq(Address::getUserId, userId)
                .orderByDesc(Address::getIsDefault)
                .orderByDesc(Address::getId));
        return addresses.stream().map(this::toDTO).toList();
    }

    @Override
    @Transactional
    public AddressDTO create(AddressRequest req) {
        Long userId = UserContext.getRequired().userId();
        if (Boolean.TRUE.equals(req.getIsDefault())) {
            clearDefault(userId);
        }
        Address address = new Address();
        BeanUtils.copyProperties(req, address);
        address.setUserId(userId);
        address.setIsDefault(Boolean.TRUE.equals(req.getIsDefault()) ? 1 : 0);
        addressMapper.insert(address);
        return toDTO(address);
    }

    @Override
    @Transactional
    public AddressDTO update(Long id, AddressRequest req) {
        Address address = requireOwned(id);
        if (Boolean.TRUE.equals(req.getIsDefault())) {
            clearDefault(address.getUserId());
        }
        BeanUtils.copyProperties(req, address, "id", "userId");
        if (req.getIsDefault() != null) {
            address.setIsDefault(req.getIsDefault() ? 1 : 0);
        }
        addressMapper.updateById(address);
        return toDTO(address);
    }

    @Override
    public void remove(Long id) {
        Address address = requireOwned(id);
        addressMapper.deleteById(address.getId());
    }

    /** 按 id + 本人归属双条件取地址；查不到一律 404（不暴露存在性） */
    private Address requireOwned(Long id) {
        Long userId = UserContext.getRequired().userId();
        Address address = addressMapper.selectOne(Wrappers.<Address>lambdaQuery()
                .eq(Address::getId, id)
                .eq(Address::getUserId, userId));
        if (address == null) {
            throw new BusinessException(ResultCode.ADDRESS_NOT_FOUND);
        }
        return address;
    }

    private void clearDefault(Long userId) {
        Address reset = new Address();
        reset.setIsDefault(0);
        addressMapper.update(reset, Wrappers.<Address>lambdaUpdate()
                .eq(Address::getUserId, userId)
                .eq(Address::getIsDefault, 1));
    }

    private AddressDTO toDTO(Address address) {
        AddressDTO dto = new AddressDTO();
        BeanUtils.copyProperties(address, dto);
        dto.setIsDefault(address.getIsDefault() != null && address.getIsDefault() == 1);
        return dto;
    }
}
