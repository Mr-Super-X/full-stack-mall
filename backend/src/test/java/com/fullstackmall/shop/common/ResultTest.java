package com.fullstackmall.shop.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ResultTest {

    @Test
    void success_shouldHaveCode200AndCarryData() {
        Result<String> result = Result.success("ok-data");

        assertEquals(200, result.getCode());
        assertEquals("ok", result.getMessage());
        assertEquals("ok-data", result.getData());
    }

    @Test
    void businessErrorCode_shouldPassThroughCodeAndMessage() {
        Result<Void> result = Result.error(ResultCode.PRODUCT_NOT_FOUND);

        assertEquals(404, result.getCode());
        assertEquals("商品不存在", result.getMessage());
        assertNull(result.getData());
    }

    @Test
    void customErrorMessage_shouldOverrideDefaultMessage() {
        Result<Void> result = Result.error(400, "page 必须大于等于 1");

        assertEquals(400, result.getCode());
        assertEquals("page 必须大于等于 1", result.getMessage());
    }
}
