import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSeckillOrderPolling } from './useSeckillOrderPolling'

// mock API 层：orderStatus 可控时序（vi.fn 队列）
vi.mock('../apis/seckill', () => ({
  h5SeckillApi: {
    orderStatus: vi.fn(),
  },
}))

import { h5SeckillApi } from '../apis/seckill'

const orderStatusMock = vi.mocked(h5SeckillApi.orderStatus)

describe('useSeckillOrderPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    orderStatusMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ACCEPTED 若干轮后 CREATED：返回 paymentNo 并停表', async () => {
    orderStatusMock
      .mockResolvedValueOnce({ status: 'ACCEPTED', paymentNo: null })
      .mockResolvedValueOnce({ status: 'ACCEPTED', paymentNo: null })
      .mockResolvedValueOnce({ status: 'CREATED', paymentNo: 'P777' })

    const { status, paymentNo, start, stop } = useSeckillOrderPolling('M-1', {
      intervalMs: 1000,
      timeoutMs: 15000,
    })
    const promise = start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)

    const result = await promise
    expect(result).toEqual({ status: 'CREATED', paymentNo: 'P777' })
    expect(status.value).toBe('CREATED')
    expect(paymentNo.value).toBe('P777')
    stop()
  })

  it('FAILED：终态返回且不取 paymentNo', async () => {
    orderStatusMock.mockResolvedValueOnce({ status: 'FAILED', paymentNo: null })

    const { status, start } = useSeckillOrderPolling('M-2')
    const promise = start()
    await vi.advanceTimersByTimeAsync(0)

    expect(await promise).toEqual({ status: 'FAILED', paymentNo: null })
    expect(status.value).toBe('FAILED')
  })

  it('超时无终态：TIMEOUT（单次请求失败不中断轮询）', async () => {
    orderStatusMock.mockRejectedValue(new Error('网络抖动'))
    const { status, start } = useSeckillOrderPolling('M-3', { intervalMs: 1000, timeoutMs: 3000 })
    const promise = start()
    await vi.advanceTimersByTimeAsync(3500)

    expect(await promise).toEqual({ status: 'TIMEOUT', paymentNo: null })
    expect(status.value).toBe('TIMEOUT')
  })

  it('stop 清理定时器并让挂起的 start Promise 以 TIMEOUT 收尾（终审 Important-4：不 resolve 会泄漏）', async () => {
    orderStatusMock.mockResolvedValue({ status: 'ACCEPTED', paymentNo: null })
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')

    const polling = useSeckillOrderPolling('M-4', { intervalMs: 1000, timeoutMs: 60000 })
    const promise = polling.start()
    await vi.advanceTimersByTimeAsync(0)
    polling.stop()

    expect(clearSpy).toHaveBeenCalled()
    await expect(promise).resolves.toEqual({ status: 'TIMEOUT', paymentNo: null })
    // 停表后不再发请求
    const calls = orderStatusMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(orderStatusMock.mock.calls.length).toBe(calls)
  })
})
