/**
 * useNetworkBanner 控制器单测：错误分流反馈状态机。
 *
 * 黑盒驱动——直接 emit error-events 事件（与真实拦截器驱动路径一致），
 * 断言模块级单例 state 与 ElMessage 兜底调用。事件订阅在模块顶层已挂
 * （import 副作用），resetNetworkBanner 只复位状态不动订阅链。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
}))

// 隔离弹窗族 appContext 依赖：本用例不渲染组件，只测订阅逻辑（useConfirm.spec 同款手法）
const { mockGetDialogAppContext } = vi.hoisted(() => ({
  mockGetDialogAppContext: vi.fn(() => null),
}))
vi.mock('./useDialog', () => ({
  getDialogAppContext: mockGetDialogAppContext,
}))

import { ElMessage } from 'element-plus'
import { emitHttpError, emitHttpRecoveredIfApplicable } from '@vv/shared/api/error-events'
import { ApiError } from '@vv/shared/api/types/error'
import {
  networkBannerState,
  dismissNetworkBanner,
  resetNetworkBanner,
  MANUAL_DISMISS_COOLDOWN_MS,
} from './useNetworkBanner'

const toastError = ElMessage.error as unknown as ReturnType<typeof vi.fn>

function makeError(status?: number): ApiError {
  return new ApiError({ code: status ?? -1, message: `m-${String(status)}`, status })
}

beforeEach(() => {
  vi.useFakeTimers()
  toastError.mockReset()
  resetNetworkBanner()
})

describe('useNetworkBanner —— 错误分流反馈', () => {
  it('网络级错误（502）→ 横幅显示 + 计数 1；不弹 toast', () => {
    emitHttpError(makeError(502))
    expect(networkBannerState.visible).toBe(true)
    expect(networkBannerState.count).toBe(1)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('无响应错误（undefined status：网络异常/超时）→ 同属网络级通道', () => {
    emitHttpError(makeError(undefined))
    expect(networkBannerState.visible).toBe(true)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('持续故障：连续网络错误只保持一条横幅、计数递增（防 Toast 轰炸核心语义）', () => {
    emitHttpError(makeError(502))
    emitHttpError(makeError(503))
    emitHttpError(makeError(504))
    expect(networkBannerState.visible).toBe(true)
    expect(networkBannerState.count).toBe(3)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('业务级错误（400/500）→ ElMessage.error 兜底；横幅无感', () => {
    emitHttpError(makeError(400))
    emitHttpError(makeError(500))
    expect(toastError).toHaveBeenCalledTimes(2)
    expect(networkBannerState.visible).toBe(false)
    expect(networkBannerState.count).toBe(0)
  })

  it('恢复信号：隐藏 + 计数归零', () => {
    emitHttpError(makeError(502))
    emitHttpError(makeError(503))
    emitHttpRecoveredIfApplicable()
    expect(networkBannerState.visible).toBe(false)
    expect(networkBannerState.count).toBe(0)
  })

  it('手动 dismiss 后冷却期内新错误：只计数、不重新弹出', () => {
    emitHttpError(makeError(502))
    dismissNetworkBanner()
    expect(networkBannerState.visible).toBe(false)
    emitHttpError(makeError(502))
    expect(networkBannerState.count).toBe(2)
    expect(networkBannerState.visible).toBe(false)
  })

  it('冷却期外新错误：重新弹出（真实新故障应被感知）', () => {
    dismissNetworkBanner()
    vi.advanceTimersByTime(MANUAL_DISMISS_COOLDOWN_MS + 1)
    emitHttpError(makeError(502))
    expect(networkBannerState.visible).toBe(true)
    expect(networkBannerState.count).toBe(1)
  })

  it('恢复信号清零冷却：dismiss 后网络恢复，再来错误立即可见', () => {
    emitHttpError(makeError(502))
    dismissNetworkBanner()
    // 距末次错误仍在恢复窗口内（fake timers 未推进）→ 恢复信号发出
    emitHttpRecoveredIfApplicable()
    emitHttpError(makeError(502))
    expect(networkBannerState.visible).toBe(true)
  })
})
