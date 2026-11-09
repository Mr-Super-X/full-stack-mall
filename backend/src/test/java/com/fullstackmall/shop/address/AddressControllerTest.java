package com.fullstackmall.shop.address;

import com.fullstackmall.shop.address.controller.AddressController;
import com.fullstackmall.shop.address.dto.AddressDTO;
import com.fullstackmall.shop.address.service.AddressService;
import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AddressController 切片测试。地址接口挂在 AuthInterceptor 保护路径（/mall/addresses/**），
 * 每个请求需携带合法 Cookie——JwtService 打桩解析为买家身份。
 */
@WebMvcTest(AddressController.class)
class AddressControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AddressService addressService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void 新增地址成功返回200与数据() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(addressService.create(any())).willReturn(address(1L, true));

        mockMvc.perform(post("/mall/addresses")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.isDefault").value(true));
    }

    @Test
    void 手机号非法应返回400() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));

        mockMvc.perform(post("/mall/addresses")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody().replace("13800138000", "123")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void 地址列表仅本人() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(addressService.list()).willReturn(List.of(address(1L, true), address(2L, false)));

        mockMvc.perform(get("/mall/addresses")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void 修改他人地址应返回404() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(addressService.update(eq(9L), any()))
                .willThrow(new BusinessException(ResultCode.ADDRESS_NOT_FOUND));

        mockMvc.perform(patch("/mall/addresses/9")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("地址不存在"));
    }

    @Test
    void 删除他人地址应返回404() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        doThrow(new BusinessException(ResultCode.ADDRESS_NOT_FOUND))
                .when(addressService).remove(9L);

        mockMvc.perform(delete("/mall/addresses/9")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    void 未登录访问应返回401() throws Exception {
        // 不带 Cookie：AuthInterceptor 直接拦
        mockMvc.perform(get("/mall/addresses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    private String validBody() {
        return """
                {"receiverName":"张三","phone":"13800138000","province":"浙江省","city":"杭州市","district":"西湖区","detail":"天目里 3 幢 101","isDefault":true}
                """;
    }

    private AddressDTO address(Long id, boolean isDefault) {
        AddressDTO dto = new AddressDTO();
        dto.setId(id);
        dto.setReceiverName("张三");
        dto.setPhone("13800138000");
        dto.setProvince("浙江省");
        dto.setCity("杭州市");
        dto.setDistrict("西湖区");
        dto.setDetail("天目里 3 幢 101");
        dto.setIsDefault(isDefault);
        return dto;
    }
}
