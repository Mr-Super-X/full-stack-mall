import { describe, it, expect, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useRequest } from './useRequest'

describe('useRequest（基础三态）', () => {
  it('transitions loading → success on resolve', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 })
    const { data, loading, error, execute } = useRequest(fetcher, { immediate: false })

    expect(loading.value).toBe(false)
    expect(data.value).toBe(null)

    const p = execute()
    expect(loading.value).toBe(true)
    await p
    expect(loading.value).toBe(false)
    expect(data.value).toEqual({ id: 1 })
    expect(error.value).toBe(null)
  })

  it('captures error and exposes isEmpty', async () => {
    const fetcher = vi.fn().mockResolvedValue(null)
    const { data, isEmpty, execute } = useRequest(fetcher, { immediate: false })
    await execute()
    expect(data.value).toBe(null)
    expect(isEmpty.value).toBe(true)
  })

  it('invokes onError callback on rejection', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'))
    const onError = vi.fn()
    const { error, execute } = useRequest(fetcher, { immediate: false, onError })
    await execute()
    expect(error.value?.message).toBe('boom')
    expect(onError).toHaveBeenCalledOnce()
  })
})

describe('useRequest（immediate 默认值）', () => {
  it('immediate: true 默认立即执行', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    useRequest(fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('immediate: false 不立即执行', () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    useRequest(fetcher, { immediate: false })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('useRequest（onSuccess）', () => {
  it('成功后回调被调用，传入结果', async () => {
    const onSuccess = vi.fn()
    const { execute } = useRequest(() => Promise.resolve('result'), {
      immediate: false,
      onSuccess,
    })
    await execute()
    expect(onSuccess).toHaveBeenCalledWith('result')
  })
})

describe('useRequest（refresh 别名）', () => {
  it('refresh 与 execute 行为一致', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    const { refresh } = useRequest(fetcher, { immediate: false })
    await refresh()
    expect(fetcher).toHaveBeenCalledTimes(1)
    await refresh()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('useRequest（watch 自动重执行）', () => {
  it('watch: ref 变化时自动重新执行', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    const keyword = ref('a')
    useRequest(fetcher, { immediate: false, watch: [keyword] })
    expect(fetcher).not.toHaveBeenCalled()
    keyword.value = 'b'
    await nextTick()
    expect(fetcher).toHaveBeenCalledTimes(1)
    keyword.value = 'c'
    await nextTick()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('非响应式 watch 不会触发（仅响应式 ref 生效）', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    useRequest(fetcher, { immediate: false, watch: [() => 'plain', () => 'values'] })
    expect(fetcher).not.toHaveBeenCalled()
    await nextTick()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('混合 watch 中只响应 ref 部分', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    const refValue = ref(1)
    useRequest(fetcher, { immediate: false, watch: [refValue, () => 'static'] })
    expect(fetcher).not.toHaveBeenCalled()
    refValue.value = 2
    await nextTick()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('旧名 deps 仍生效（向后兼容）', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    const v = ref(0)
    useRequest(fetcher, { immediate: false, deps: [v] })
    expect(fetcher).not.toHaveBeenCalled()
    v.value = 1
    await nextTick()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('watch 优先于 deps（同名时 watch 生效）', async () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    const v1 = ref(0)
    const v2 = ref(0)
    useRequest(fetcher, { immediate: false, watch: [v1], deps: [v2] })
    v2.value = 1
    await nextTick()
    expect(fetcher).not.toHaveBeenCalled() // deps 被 watch 覆盖
    v1.value = 1
    await nextTick()
    expect(fetcher).toHaveBeenCalledTimes(1) // watch 生效
  })
})

describe('useRequest（错误归一）', () => {
  it('非 Error 抛出归一为 Error', async () => {
    const fetcher = vi.fn().mockRejectedValue('plain string error')
    const onError = vi.fn()
    const { error, execute } = useRequest(fetcher, { immediate: false, onError })
    await execute()
    expect(error.value).toBeInstanceOf(Error)
    expect(error.value?.message).toBe('plain string error')
  })

  it('Error 对象原样捕获', async () => {
    const original = new Error('original')
    const fetcher = vi.fn().mockRejectedValue(original)
    const { error, execute } = useRequest(fetcher, { immediate: false })
    await execute()
    expect(error.value).toBe(original)
  })

  it('axios 超时错误（code=ECONNABORTED）标记 isTimeout', async () => {
    const timeoutErr = Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })
    const fetcher = vi.fn().mockRejectedValue(timeoutErr)
    const { error, execute } = useRequest(fetcher, { immediate: false })
    await execute()
    expect(error.value?.isTimeout).toBe(true)
  })

  it('axios 网络错误（code=ERR_NETWORK）标记 isNetworkError', async () => {
    const netErr = Object.assign(new Error('network'), { code: 'ERR_NETWORK' })
    const fetcher = vi.fn().mockRejectedValue(netErr)
    const { error, execute } = useRequest(fetcher, { immediate: false })
    await execute()
    expect(error.value?.isNetworkError).toBe(true)
  })
})

describe('useRequest（isEmpty 边界）', () => {
  it('loading 时 isEmpty 为 false', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('ok'), 10)))
    const { isEmpty, execute } = useRequest(fetcher, { immediate: false })
    void execute()
    await nextTick()
    expect(isEmpty.value).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  it('error 时 isEmpty 为 false', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('e'))
    const { isEmpty, execute } = useRequest(fetcher, { immediate: false })
    await execute()
    expect(isEmpty.value).toBe(false)
  })

  it('data 有值时 isEmpty 为 false', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 })
    const { isEmpty, execute } = useRequest(fetcher, { immediate: false })
    await execute()
    expect(isEmpty.value).toBe(false)
  })

  it('data=null + 无 loading + 无 error 时 isEmpty 为 true', () => {
    const fetcher = vi.fn().mockResolvedValue('ok')
    const { isEmpty } = useRequest(fetcher, { immediate: false })
    expect(isEmpty.value).toBe(true)
  })
})

describe('useRequest（initialData）', () => {
  it('initialData 预填 data.value', () => {
    const { data } = useRequest(vi.fn(), {
      immediate: false,
      initialData: { id: 0, name: 'loading' },
    })
    expect(data.value).toEqual({ id: 0, name: 'loading' })
  })

  it('initialData 不触发 loading', () => {
    const { loading } = useRequest(vi.fn(), {
      immediate: false,
      initialData: { id: 0 },
    })
    expect(loading.value).toBe(false)
  })

  it('execute 成功后覆盖 initialData', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 99 })
    const { data, execute } = useRequest(fetcher, {
      immediate: false,
      initialData: { id: 0 },
    })
    await execute()
    expect(data.value).toEqual({ id: 99 })
  })
})

describe('useRequest（statusCode）', () => {
  it('成功后 statusCode 设为 200', async () => {
    const { statusCode, execute } = useRequest(vi.fn().mockResolvedValue('ok'), {
      immediate: false,
    })
    expect(statusCode.value).toBe(null)
    await execute()
    expect(statusCode.value).toBe(200)
  })

  it('失败后 statusCode 保持 null（业务层不感知 HTTP 状态）', async () => {
    const { statusCode, execute } = useRequest(vi.fn().mockRejectedValue(new Error('e')), {
      immediate: false,
    })
    await execute()
    expect(statusCode.value).toBe(null)
  })
})

describe('useRequest（cancel + aborted）', () => {
  it('cancel() 标记 aborted=true', async () => {
    let resolveFn!: (v: string) => void
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        })
    )
    const { cancel, aborted, execute } = useRequest(fetcher, { immediate: false })
    void execute()
    await nextTick()
    expect(aborted.value).toBe(false)
    cancel()
    resolveFn('late')
    await new Promise((r) => setTimeout(r, 10))
    expect(aborted.value).toBe(true)
  })

  it('cancel 后 data 不被更新（丢弃结果）', async () => {
    let resolveFn!: (v: string) => void
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        })
    )
    const { cancel, data, execute } = useRequest(fetcher, { immediate: false })
    void execute()
    await nextTick()
    cancel()
    resolveFn('late')
    await new Promise((r) => setTimeout(r, 10))
    expect(data.value).toBe(null) // 仍为初始 null
  })

  it('re-fetch 自动 cancel 旧请求', async () => {
    let resolveFirst!: (v: string) => void
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce('second')

    const { data, execute } = useRequest(fetcher, { immediate: false })
    const p1 = execute()
    const p2 = execute() // 立即重新执行，应自动 cancel 第一次
    await p2
    expect(data.value).toBe('second')
    resolveFirst('first-result')
    await p1
    expect(data.value).toBe('second') // 第一次结果被丢弃
  })

  it('cancel 后 error 包含 isAborted=true', async () => {
    let resolveFn!: (v: string) => void
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve
        })
    )
    const { error, cancel, execute } = useRequest(fetcher, { immediate: false })
    void execute()
    await nextTick()
    cancel()
    resolveFn('late')
    await new Promise((r) => setTimeout(r, 10))
    expect(error.value?.isAborted).toBe(true)
  })
})
