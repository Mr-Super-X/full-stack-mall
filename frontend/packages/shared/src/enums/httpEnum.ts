/**
 * HTTP 相关枚举 —— 状态码 + 业务码 + Content-Type。
 *
 * 角色：纯枚举模块，与框架解耦；被 `src/api/*` 网络基建和 `src/api/http-errors.ts` 错误分类共同消费。
 *
 * 三组枚举的语义边界：
 * - {@link HttpStatus}：HTTP 协议层状态码（与网络层 `axios` / `XMLHttpRequest` 状态码对齐）
 * - {@link BusinessCode}：业务层自定义码（与后端约定的语义码，可独立于 HTTP 状态码）
 * - {@link ContentType}：请求体 MIME 类型（与 `Content-Type` 请求头对齐）
 *
 * 业务码与 HTTP 码**有意复用**相同数字（如 `200`、`401`）但语义不同：HTTP 码管"网络层是否成功"，
 * 业务码管"应用层语义是否成功"。两个都需检查，不能只看一个。
 *
 * @see [`src/api/http-errors.ts`](../api/http-errors.ts) 错误分类消费方
 * @see [`src/api/http.ts`](../api/http.ts) 拦截器消费方
 * @group 网络基建：状态码
 */

/** HTTP 协议层状态码。来源：IANA 注册的标准状态码（RFC 7231 / RFC 9110） */
export enum HttpStatus {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/**
 * 业务层自定义码。
 *
 * 与 HTTP 码独立：HTTP 200 + BusinessCode.FORBIDDEN 表达"网络成功但业务拒绝"，
 * HTTP 401 + BusinessCode.SUCCESS 不可能存在（业务码在 HTTP 失败时不参与判定）。
 *
 * 当前仅 3 个值；扩展时按业务线（订单/支付/权限）分前缀避免冲突。
 */
export enum BusinessCode {
  SUCCESS = 200,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
}

/** 请求体 MIME 类型。值与 `Content-Type` 请求头严格一致（含 `application/` 前缀） */
export enum ContentType {
  JSON = 'application/json',
  FORM_URLENCODED = 'application/x-www-form-urlencoded',
  FORM_DATA = 'multipart/form-data',
}
