package com.fullstackmall.shop.consignment;

import com.fullstackmall.shop.common.BusinessException;
import com.fullstackmall.shop.common.ResultCode;
import com.fullstackmall.shop.consignment.controller.ConsignmentController;
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
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * ConsignmentController 切片测试：提交/我的/详情三接口契约。
 * accept（Task 5）与 admin review（Task 4）场景在各自 Task 追加。
 */
@WebMvcTest(ConsignmentController.class)
class ConsignmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ConsignmentService consignmentService;

    @MockitoBean
    private JwtService jwtService;

    @Test
    void submit_success_shouldReturn200WithSubmittedStatus() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(2L, "seller", "USER"));
        given(consignmentService.submit(any())).willReturn(dto(1L, "SUBMITTED"));

        mockMvc.perform(post("/mall/consignments")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validSubmitBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));
    }

    @Test
    void submitWithEmptyImages_shouldReturn400() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(2L, "seller", "USER"));

        mockMvc.perform(post("/mall/consignments")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validSubmitBody().replace(
                                "\"images\":[\"https://a.com/1.jpg\"]", "\"images\":[]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void submitMissingExpectedPrice_shouldReturn400() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(2L, "seller", "USER"));

        // 去掉 expectedPrice 字段
        String body = validSubmitBody().replace(",\"expectedPrice\":120.00", "");
        mockMvc.perform(post("/mall/consignments")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void detailOthersListing_shouldReturn404() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(consignmentService.detail(1L))
                .willThrow(new BusinessException(ResultCode.CONSIGNMENT_NOT_FOUND));

        mockMvc.perform(get("/mall/consignments/1")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("寄卖单不存在"));
    }

    @Test
    void myConsignmentList_shouldReturnOwnListings() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(2L, "seller", "USER"));
        given(consignmentService.mine()).willReturn(List.of(dto(1L, "SUBMITTED"), dto(2L, "PRICED")));

        mockMvc.perform(get("/mall/consignments/mine")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[1].status").value("PRICED"));
    }

    @Test
    void unauthenticatedSubmit_shouldReturn401() throws Exception {
        mockMvc.perform(post("/mall/consignments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validSubmitBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401));
    }

    private String validSubmitBody() {
        return """
                {"brand":"优衣库","title":"九成新摇粒绒外套","categoryId":2,"conditionGrade":"LIKE_NEW","images":["https://a.com/1.jpg"],"expectedPrice":120.00,"description":"仅试穿"}
                """;
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
        dto.setStatus(status);
        return dto;
    }

    // ── Task 5：accept 铸造上架契约 ──────────────────────────────

    @Test
    void acceptPricing_success_shouldReturnListedWithProductId() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(2L, "seller", "USER"));
        ConsignmentDTO listed = dto(1L, "LISTED");
        listed.setListedProductId(16L);
        given(consignmentService.accept(1L)).willReturn(listed);

        mockMvc.perform(post("/mall/consignments/1/accept")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("LISTED"))
                .andExpect(jsonPath("$.data.listedProductId").value(16));
    }

    @Test
    void acceptUnpricedListing_shouldReturn400StateIllegal() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(2L, "seller", "USER"));
        given(consignmentService.accept(1L))
                .willThrow(new BusinessException(ResultCode.CONSIGNMENT_STATE_ILLEGAL));

        mockMvc.perform(post("/mall/consignments/1/accept")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("当前状态不允许该操作"));
    }

    @Test
    void acceptOthersListing_shouldReturn404() throws Exception {
        given(jwtService.parse("t")).willReturn(new LoginUser(3L, "buyer", "USER"));
        given(consignmentService.accept(1L))
                .willThrow(new BusinessException(ResultCode.CONSIGNMENT_NOT_FOUND));

        mockMvc.perform(post("/mall/consignments/1/accept")
                        .cookie(new jakarta.servlet.http.Cookie("token", "t")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }
}
