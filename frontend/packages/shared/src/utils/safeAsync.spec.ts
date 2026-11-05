import { describe, it, expect, beforeEach, vi } from 'vitest'
import { safeAsync, trySafeSync, _configureSafeAsync } from './safeAsync'

const mockReporter = vi.fn()

beforeEach(() => {
  mockReporter.mockReset()
  vi.spyOn(console, 'error')
    .mockImplementation(() => {})
    .mockClear()
  // 默认：dev log 关闭、reporter 未配置
  _configureSafeAsync(undefined, false)
})

describe('safeAsync（async 包装）', () => {
  it('成功时返回原结果', async () => {
    const result = await safeAsync(async () => 42, {
      source: 'test',
      fallback: 0,
    })()
    expect(result).toBe(42)
  })

  it('失败时返回 fallback，不抛错', async () => {
    const result = await safeAsync(
      async () => {
        throw new Error('boom')
      },
      { source: 'test', fallback: 'default' }
    )()
    expect(result).toBe('default')
  })

  it('失败时调用 reporter 报告错误', async () => {
    _configureSafeAsync(mockReporter, false)
    const err = new Error('boom')
    await safeAsync(
      async () => {
        throw err
      },
      { source: 'parse-config', fallback: null, extra: { foo: 'bar' } }
    )()
    expect(mockReporter).toHaveBeenCalledTimes(1)
    expect(mockReporter).toHaveBeenCalledWith(err, {
      source: 'parse-config',
      extra: { foo: 'bar' },
    })
  })

  it('非 Error 抛出被包装为 Error', async () => {
    _configureSafeAsync(mockReporter, false)
    await safeAsync(
      async () => {
        throw 'plain string'
      },
      { source: 'test', fallback: null }
    )()
    const [reportedErr] = mockReporter.mock.calls[0] as [Error]
    expect(reportedErr).toBeInstanceOf(Error)
    expect(reportedErr.message).toBe('plain string')
  })

  it('传参透传', async () => {
    const fn = vi.fn(async (a: number, b: string) => `${a}-${b}`)
    const safe = safeAsync(fn, { source: 'test', fallback: '' })
    const result = await safe(1, 'hello')
    expect(result).toBe('1-hello')
    expect(fn).toHaveBeenCalledWith(1, 'hello')
  })

  it('dev log 开启时输出 console.error', async () => {
    _configureSafeAsync(mockReporter, true)
    await safeAsync(
      async () => {
        throw new Error('boom')
      },
      { source: 'test', fallback: null }
    )()
    expect(console.error).toHaveBeenCalledWith('[safeAsync:test]', expect.any(Error), undefined)
  })

  it('dev log 关闭时静默', async () => {
    _configureSafeAsync(mockReporter, false)
    await safeAsync(
      async () => {
        throw new Error('boom')
      },
      { source: 'test', fallback: null }
    )()
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe('trySafeSync（sync 包装）', () => {
  it('成功时返回原结果', () => {
    const result = trySafeSync(() => 42, { source: 'test', fallback: 0 })()
    expect(result).toBe(42)
  })

  it('失败时返回 fallback', () => {
    const result = trySafeSync(
      () => {
        throw new Error('parse error')
      },
      { source: 'parse-date', fallback: new Date(0) }
    )()
    expect(result).toEqual(new Date(0))
  })

  it('失败时调用 reporter', () => {
    _configureSafeAsync(mockReporter, false)
    const err = new Error('oops')
    trySafeSync(
      () => {
        throw err
      },
      { source: 'sync-test', fallback: 'fallback' }
    )()
    expect(mockReporter).toHaveBeenCalledWith(err, {
      source: 'sync-test',
      extra: undefined,
    })
  })
})
