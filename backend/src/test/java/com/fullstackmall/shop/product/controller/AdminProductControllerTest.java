package com.fullstackmall.shop.product.controller;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.PageResult;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.product.dto.AdminProductDTO;
import com.fullstackmall.shop.product.service.AdminProductService;
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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AdminProductController 切片测试：创建/编辑/分页契约 + 参数校验失败 400 +
 * 下架保护业务码透传 + 角色守卫（403/401 走真实拦截链）。
 */
@WebMvcTest(AdminProductController.class)
class AdminProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AdminProductService adminProductService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void createWithValidPayload_shouldReturnProduct() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        AdminProductDTO dto = new AdminProductDTO();
        dto.setId(9L);
        dto.setName("陶土色垂感风衣");
        dto.setStatus(1);
        given(adminProductService.create(any())).willReturn(dto);

        mockMvc.perform(post("/mall/admin/products")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":2,"name":"陶土色垂感风衣",
                                 "items":[{"size":"M","price":199.00,"stock":5}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(9))
                .andExpect(jsonPath("$.data.status").value(1));
    }

    @Test
    void createWithoutName_shouldReturn400WithMessage() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));

        mockMvc.perform(post("/mall/admin/products")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"categoryId":2,"items":[{"size":"M","price":199.00,"stock":5}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("商品名不能为空"));
    }

    @Test
    void updateOffShelfWithSeckillMounted_shouldPassThroughBusinessCode() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        given(adminProductService.update(eq(7L), any()))
                .willThrow(new BusinessException(ResultCode.SECKILL_ACTIVE_ON_PRODUCT));

        mockMvc.perform(patch("/mall/admin/products/7")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("商品挂载未结束的秒杀活动，禁止下架"));
    }

    @Test
    void pageDefault_shouldReturnPagedProducts() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        AdminProductDTO dto = new AdminProductDTO();
        dto.setId(1L);
        dto.setName("云朵感圆领针织");
        PageResult<AdminProductDTO> pageResult = new PageResult<>();
        pageResult.setList(List.of(dto));
        pageResult.setTotal(1);
        pageResult.setPage(1);
        pageResult.setPageSize(10);
        given(adminProductService.page(isNull(), isNull(), eq(1), eq(10))).willReturn(pageResult);

        mockMvc.perform(get("/mall/admin/products")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.list[0].id").value(1))
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void pageWithStatusFilter_shouldPassStatus() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        PageResult<AdminProductDTO> pageResult = new PageResult<>();
        pageResult.setList(List.of());
        pageResult.setTotal(0);
        pageResult.setPage(1);
        pageResult.setPageSize(10);
        given(adminProductService.page(eq(0), isNull(), anyInt(), anyInt())).willReturn(pageResult);

        mockMvc.perform(get("/mall/admin/products?status=0")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(0));
    }

    @Test
    void normalUserCallingAdminApi_shouldReturn403() throws Exception {
        // buyer（USER 角色）走真实双层拦截链：Auth 解析身份 → Admin 拦角色
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));

        mockMvc.perform(get("/mall/admin/products")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("无权限访问"));
    }

    @Test
    void anonymousCallingAdminApi_shouldReturn401() throws Exception {
        mockMvc.perform(get("/mall/admin/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }
}
