package com.fullstackmall.shop.address.service;

import com.fullstackmall.shop.address.dto.AddressDTO;
import com.fullstackmall.shop.address.dto.AddressRequest;

import java.util.List;

/**
 * 地址业务：全部操作限定当前登录用户（UserContext），他人地址按 404 处理防探测。
 */
public interface AddressService {

    /** 本人地址列表，默认地址排前 */
    List<AddressDTO> list();

    /** 新增；isDefault=true 时清除本人旧默认（事务内先清后设） */
    AddressDTO create(AddressRequest req);

    /**
     * 修改；仅本人可操作。
     *
     * @throws com.fullstackmall.shop.common.BusinessException ADDRESS_NOT_FOUND 地址不存在或属于他人
     */
    AddressDTO update(Long id, AddressRequest req);

    /**
     * 删除；仅本人可操作。
     *
     * @throws com.fullstackmall.shop.common.BusinessException ADDRESS_NOT_FOUND 地址不存在或属于他人
     */
    void remove(Long id);
}
