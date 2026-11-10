package com.fullstackmall.shop.common;

import lombok.Getter;

/**
 * 业务异常：Service 层主动抛出（如商品不存在），由全局异常处理器翻译成统一信封。
 * 仅用于"可预期的业务失败"，系统异常请直接抛 RuntimeException 走 500 兜底。
 */
@Getter
public class BusinessException extends RuntimeException {

    private final ResultCode resultCode;

    public BusinessException(ResultCode resultCode) {
        super(resultCode.getMessage());
        this.resultCode = resultCode;
    }

    /** 携带场景化文案的业务异常（同一 ResultCode 在不同校验点的具体原因） */
    public BusinessException(ResultCode resultCode, String message) {
        super(message);
        this.resultCode = resultCode;
    }
}
