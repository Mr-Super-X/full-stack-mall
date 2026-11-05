/**
 * error-events 单测：事件广播、恢复窗口、通道归类表驱动。
 *
 * 覆盖要点：
 * - isNetworkLevelError 全状态码归类（横幅通道 vs toast 通道的唯一判定源）
 * - emit/订阅/退订契约（订阅方 @vv/ui useNetworkBanner 的正确性前提）
 * - 恢复窗口三态：无错误史零事件 / 窗口内成功即发 / 窗口外成功静默过期
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  onHttpError,
  onHttpRecovered,
  emitHttpError,
  emitHttpRecoveredIfApplicable,
  resetHttpErrorEvents,
  isNetworkLevelError,
  RECOVERY_WINDOW_MS,
} from './error-events'
import { ApiError } from './types/error'

function makeError(status?: number): ApiError {
  return new ApiError({ code: status ?? -1, message: `m-${String(status)}`, status })
}

describe('isNetworkLevelError —— 横幅/toast 通道归类', () => {
  it.each([
    [undefined, true], // 无 HTTP 响应（网络异常/超时/DNS 失败）
    [0, true], // 约定的 0 状态（调用方手动归集场景）
    [502, true],
    [503, true],
    [504, true],
    [400, false],
    [401, false],
    [403, false],
    [404, false],
    [418, false],
    [500, false],
    [200, false],
  ])('status %s → 网络级通道 %s', (status, expected) => {
    expect(isNetworkLevelError(status)).toBe(expected)
  })
})

describe('错误事件广播', () => {
  beforeEach(() => resetHttpErrorEvents())

  it('emit 后订阅者收到 ApiError 负载', () => {
    const seen: ApiError[] = []
    onHttpError((e) => seen.push(e.error))
    emitHttpError(makeError(502))
    expect(seen).toHaveLength(1)
    expect(seen[0]?.status).toBe(502)
  })

  it('多订阅者各自收到；退订后不再收到', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onHttpError(a)
    onHttpError(b)
    emitHttpError(makeError(500))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    emitHttpError(makeError(500))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
  })
})

describe('恢复信号窗口', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetHttpErrorEvents()
  })
  afterEach(() => vi.useRealTimers())

  it('无错误史：成功零事件（常态成功请求零开销）', () => {
    const rec = vi.fn()
    onHttpRecovered(rec)
    emitHttpRecoveredIfApplicable()
    expect(rec).not.toHaveBeenCalled()
  })

  it('错误后立即成功：发恢复信号', () => {
    const rec = vi.fn()
    onHttpRecovered(rec)
    emitHttpError(makeError(502))
    emitHttpRecoveredIfApplicable()
    expect(rec).toHaveBeenCalledTimes(1)
  })

  it('窗口外成功（>RECOVERY_WINDOW_MS）：静默过期不发，且错误史清零', () => {
    const rec = vi.fn()
    onHttpRecovered(rec)
    emitHttpError(makeError(502))
    vi.advanceTimersByTime(RECOVERY_WINDOW_MS + 1)
    emitHttpRecoveredIfApplicable()
    expect(rec).not.toHaveBeenCalled()
    // 窗口已清零：再来成功也不发（错误已是历史，不打扰订阅方）
    emitHttpRecoveredIfApplicable()
    expect(rec).not.toHaveBeenCalled()
  })

  it('恢复后再次错误：窗口重开，成功再发恢复', () => {
    const rec = vi.fn()
    onHttpRecovered(rec)
    emitHttpError(makeError(502))
    emitHttpRecoveredIfApplicable()
    emitHttpError(makeError(503))
    emitHttpRecoveredIfApplicable()
    expect(rec).toHaveBeenCalledTimes(2)
  })
})
