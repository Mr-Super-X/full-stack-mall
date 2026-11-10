package com.fullstackmall.shop.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 4b 新增错误码断言：40005 SECKILL_UNAVAILABLE / 40006 RATE_LIMITED。
 * code 值为前后端契约（前端按码 toast/分流），变更即破坏兼容。
 */
class ResultCodeTest {

    @Test
    @DisplayName("40005 SECKILL_UNAVAILABLE：Redis 不可用语义，HTTP 映射 503")
    void seckillUnavailable_hasCode40005() {
        assertThat(ResultCode.SECKILL_UNAVAILABLE.getCode()).isEqualTo(40005);
        assertThat(ResultCode.SECKILL_UNAVAILABLE.getMessage()).isNotBlank();
    }

    @Test
    @DisplayName("40006 RATE_LIMITED：令牌桶限流语义，HTTP 映射 429")
    void rateLimited_hasCode40006() {
        assertThat(ResultCode.RATE_LIMITED.getCode()).isEqualTo(40006);
        assertThat(ResultCode.RATE_LIMITED.getMessage()).isNotBlank();
    }

    @Test
    @DisplayName("4xxxx 业务错误码互不重复：前端按码精确分流（400/4xx HTTP 语义码本就允许多业务复用）")
    void businessCodes_areUnique() {
        long distinct = Arrays.stream(ResultCode.values())
                .map(ResultCode::getCode)
                .filter(code -> code >= 10000)
                .distinct()
                .count();
        long businessCount = Arrays.stream(ResultCode.values())
                .filter(rc -> rc.getCode() >= 10000)
                .count();
        assertThat(distinct).isEqualTo(businessCount);
    }
}
