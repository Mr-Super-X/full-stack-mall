package com.fullstackmall.shop.common;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 全局异常处理器契约测试：业务异常按码翻译、参数校验失败返回 400 并带首条错误消息。
 */
class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new StubController())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void 业务异常应按码翻译() throws Exception {
        mockMvc.perform(get("/test/biz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("商品不存在"));
    }

    @Test
    void 参数校验失败应返回400() throws Exception {
        mockMvc.perform(get("/test/valid").param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("page 必须大于等于 1"));
    }

    @Test
    void 秒杀服务不可用应返回503且业务码40005() throws Exception {
        mockMvc.perform(get("/test/unavailable"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value(40005));
    }

    @Test
    void 限流应返回429且业务码40006() throws Exception {
        mockMvc.perform(get("/test/rate-limited"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value(40006));
    }

    @RestController
    static class StubController {

        @GetMapping("/test/biz")
        Result<Void> biz() {
            throw new BusinessException(ResultCode.PRODUCT_NOT_FOUND);
        }

        @GetMapping("/test/unavailable")
        Result<Void> unavailable() {
            throw new BusinessException(ResultCode.SECKILL_UNAVAILABLE);
        }

        @GetMapping("/test/rate-limited")
        Result<Void> rateLimited() {
            throw new BusinessException(ResultCode.RATE_LIMITED);
        }

        @GetMapping("/test/valid")
        Result<Void> valid(@Valid @ModelAttribute ValidForm form) {
            return Result.success(null);
        }
    }

    static class ValidForm {

        @Min(value = 1, message = "page 必须大于等于 1")
        private int page;

        public int getPage() {
            return page;
        }

        public void setPage(int page) {
            this.page = page;
        }
    }
}
