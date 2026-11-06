package com.fullstackmall.shop.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ResultTest {

    @Test
    void 成功时code为200且携带data() {
        Result<String> result = Result.success("ok-data");

        assertEquals(200, result.getCode());
        assertEquals("ok", result.getMessage());
        assertEquals("ok-data", result.getData());
    }

    @Test
    void 业务错误码应透传code与message() {
        Result<Void> result = Result.error(ResultCode.PRODUCT_NOT_FOUND);

        assertEquals(404, result.getCode());
        assertEquals("商品不存在", result.getMessage());
        assertNull(result.getData());
    }

    @Test
    void 自定义错误消息应覆盖默认message() {
        Result<Void> result = Result.error(400, "page 必须大于等于 1");

        assertEquals(400, result.getCode());
        assertEquals("page 必须大于等于 1", result.getMessage());
    }
}
