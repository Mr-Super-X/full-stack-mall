package com.fullstackmall.shop.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 全局异常处理：业务异常按码返回（4b 起 40005/40006 映射 HTTP 503/429 供网关/JMeter 统计，
 * body 仍带业务码——前端 envelope 处理不变）；参数校验失败返回 400 并带首条校验消息；
 * 未知异常兜底 500、记录服务端日志但不回显堆栈，避免内部信息外泄。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 4b HTTP 语义映射（spec §4.4/§6）：秒杀不可用 503、限流 429；其余业务码维持 200 + body code
     * （项目信封契约，阶段 1 既定——HTTP 层变化仅限 4b 新增码，避免前端全局拦截器特判存量码）。
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusiness(BusinessException ex) {
        ResultCode code = ex.getResultCode();
        HttpStatus status = switch (code) {
            case SECKILL_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
            case RATE_LIMITED -> HttpStatus.TOO_MANY_REQUESTS;
            default -> HttpStatus.OK;
        };
        return ResponseEntity.status(status).body(Result.error(code));
    }

    /**
     * MethodArgumentNotValidException 在 Spring 6 起继承自 BindException，
     * 声明两者仅为表意清晰，实际由 BindException 分支统一处理。
     */
    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public Result<Void> handleValidation(BindException ex) {
        FieldError fieldError = ex.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : ResultCode.BAD_REQUEST.getMessage();
        return Result.error(ResultCode.BAD_REQUEST.getCode(), message);
    }

    /**
     * 方法级参数校验双路径：类级 @Validated 走 AOP 抛 ConstraintViolationException；
     * Spring 6.1+ 无 AOP 时抛 HandlerMethodValidationException。两者统一映射 400 码，
     * 不处理会被兜底成 500 语义（参数错误≠系统故障）。
     */
    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public Result<Void> handleConstraintViolation(jakarta.validation.ConstraintViolationException ex) {
        String message = ex.getConstraintViolations().stream()
                .map(v -> v.getMessage() != null ? v.getMessage() : ResultCode.BAD_REQUEST.getMessage())
                .findFirst()
                .orElse(ResultCode.BAD_REQUEST.getMessage());
        return Result.error(ResultCode.BAD_REQUEST.getCode(), message);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public Result<Void> handleMethodValidation(HandlerMethodValidationException ex) {
        String message = ex.getAllValidationResults().stream()
                .flatMap(r -> r.getResolvableErrors().stream())
                .findFirst()
                .map(org.springframework.context.MessageSourceResolvable::getDefaultMessage)
                .orElse(ResultCode.BAD_REQUEST.getMessage());
        return Result.error(ResultCode.BAD_REQUEST.getCode(), message);
    }

    @ExceptionHandler({MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class, HttpMessageNotReadableException.class})
    public Result<Void> handleBadRequest(Exception ex) {
        return Result.error(ResultCode.BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> handleUnknown(Exception ex) {
        log.error("未处理异常", ex);
        return Result.error(ResultCode.INTERNAL_ERROR);
    }
}
