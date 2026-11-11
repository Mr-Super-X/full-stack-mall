package com.fullstackmall.shop.consignment;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.consignment.controller.AdminConsignmentController;
import com.fullstackmall.shop.consignment.dto.ConsignmentDTO;
import com.fullstackmall.shop.consignment.service.ConsignmentService;
import com.fullstackmall.shop.user.context.LoginUser;
import com.fullstackmall.shop.user.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AdminConsignmentController 切片测试：核价/驳回契约 + 非法流转 + 角色守卫（403 走真实拦截链）。
 */
@WebMvcTest(AdminConsignmentController.class)
class AdminConsignmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ConsignmentService consignmentService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void approvePricing_shouldReturnPricedWithBackfilledFields() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        given(consignmentService.review(eq(1L), any())).willReturn(dto(1L, "PRICED"));

        mockMvc.perform(post("/mall/admin/consignments/1/review")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"approve\":true,\"platformPrice\":99.00,\"commissionRate\":15.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("PRICED"))
                .andExpect(jsonPath("$.data.platformPrice").value(99.00));
    }

    @Test
    void reject_shouldReturnRejectedWithReason() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        ConsignmentDTO rejected = dto(1L, "REJECTED");
        rejected.setRejectReason("图片不清晰，无法鉴定成色");
        given(consignmentService.review(eq(1L), any())).willReturn(rejected);

        mockMvc.perform(post("/mall/admin/consignments/1/review")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"approve\":false,\"rejectReason\":\"图片不清晰，无法鉴定成色\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.rejectReason").isString());
    }

    @Test
    void reReviewPricedListing_shouldReturn400StateIllegal() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        given(consignmentService.review(eq(1L), any()))
                .willThrow(new BusinessException(ResultCode.CONSIGNMENT_STATE_ILLEGAL));

        mockMvc.perform(post("/mall/admin/consignments/1/review")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"approve\":true,\"platformPrice\":99.00,\"commissionRate\":15.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("当前状态不允许该操作"));
    }

    @Test
    void reviewPoolDefault_shouldQuerySubmitted() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(1L, "admin", "ADMIN"));
        given(consignmentService.adminList("SUBMITTED")).willReturn(List.of(dto(1L, "SUBMITTED")));

        mockMvc.perform(get("/mall/admin/consignments")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].status").value("SUBMITTED"));
    }

    @Test
    void normalUserCallingAdminApi_shouldReturn403() throws Exception {
        // buyer（USER 角色）走真实双层拦截链：Auth 解析身份 → Admin 拦角色
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));

        mockMvc.perform(get("/mall/admin/consignments")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("无权限访问"));
    }

    private ConsignmentDTO dto(Long id, String status) {
        ConsignmentDTO dto = new ConsignmentDTO();
        dto.setId(id);
        dto.setBrand("优衣库");
        dto.setTitle("九成新摇粒绒外套");
        dto.setCategoryId(2L);
        dto.setConditionGrade("LIKE_NEW");
        dto.setImages(List.of("https://a.com/1.jpg"));
        dto.setExpectedPrice(new BigDecimal("120.00"));
        dto.setPlatformPrice(status.equals("PRICED") ? new BigDecimal("99.00") : null);
        dto.setStatus(status);
        return dto;
    }
}
